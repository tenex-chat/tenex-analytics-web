// GET /api/conversations/[id]/stats — per-conversation growth stats
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database.js';
import type { ConversationStats } from '$lib/api/types.js';

function hasTable(name: string): boolean {
	try {
		const db = getDb();
		const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name);
		return row !== undefined;
	} catch {
		return false;
	}
}

function median(sorted: number[]): number {
	if (sorted.length === 0) return 0;
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const emptySummary = {
	meanTokensPerRequest: 0,
	avgMessagesPerRequest: 0,
	totalToolCalls: 0,
	totalToolCallsStripped: 0,
	minTokens: 0,
	maxTokens: 0,
	medianTokens: 0,
	conversationDurationSeconds: 0,
	totalCacheReadTokens: 0,
	totalCacheWriteTokens: 0,
	requestsWithCacheHits: 0,
	requestsWithContextManagement: 0,
	requestsWithAnthropicToolClear: 0
};

export const GET: RequestHandler = ({ params }) => {
	const conversationId = params.id;

	if (!hasTable('llm_requests')) {
		return json({ conversationId, timeSeries: [], summary: emptySummary } satisfies ConversationStats);
	}

	try {
		const db = getDb();

		const hasMessages = hasTable('llm_request_messages');
		const hasCme = hasTable('context_management_events');

		// Per-request token breakdown + control flags
		const requestRows = (db.prepare(`
			SELECT
				r.request_id AS id,
				r.started_at_ms,
				COALESCE(r.input_tokens, 0) AS inputTokens,
				COALESCE(r.output_tokens, 0) AS outputTokens,
				COALESCE(r.input_cache_read_tokens, 0) AS cacheReadTokens,
				COALESCE(r.input_cache_write_tokens, 0) AS cacheWriteTokens,
				COALESCE(r.input_tokens, 0) + COALESCE(r.output_tokens, 0) AS tokensUsed,
				COALESCE(r.anthropic_clear_tool_uses_enabled, 0) AS anthropicClearToolUses
			FROM llm_requests r
			WHERE r.conversation_id = @conversationId
			ORDER BY r.started_at_ms ASC
		`).all({ conversationId }) as Array<Record<string, unknown>>);

		if (requestRows.length === 0) {
			return json({ conversationId, timeSeries: [], summary: emptySummary } satisfies ConversationStats);
		}

		// Message counts per request — separate tool_use vs tool_result counts
		const msgCountByRequest = new Map<string, number>();
		const toolCallCountByRequest = new Map<string, number>();
		const toolResultCountByRequest = new Map<string, number>();
		// Per-role estimated token sums per request
		const roleTokensByRequest = new Map<string, { system: number; user: number; assistant: number; tool: number }>();
		if (hasMessages) {
			const msgRows = (db.prepare(`
				SELECT
					request_id,
					COUNT(*) AS total,
					SUM(CASE WHEN classification = 'tool_use' THEN 1 ELSE 0 END) AS toolUseCount,
					SUM(CASE WHEN classification = 'tool_result' THEN 1 ELSE 0 END) AS toolResultCount
				FROM llm_request_messages
				WHERE request_id IN (
					SELECT request_id FROM llm_requests WHERE conversation_id = @conversationId
				)
				GROUP BY request_id
			`).all({ conversationId }) as Array<Record<string, unknown>>);
			for (const row of msgRows) {
				msgCountByRequest.set(row.request_id as string, Number(row.total));
				toolCallCountByRequest.set(row.request_id as string, Number(row.toolUseCount));
				toolResultCountByRequest.set(row.request_id as string, Number(row.toolResultCount));
			}

			const roleRows = (db.prepare(`
				SELECT
					request_id,
					role,
					SUM(COALESCE(estimated_tokens, 0)) AS tokens
				FROM llm_request_messages
				WHERE request_id IN (
					SELECT request_id FROM llm_requests WHERE conversation_id = @conversationId
				)
				GROUP BY request_id, role
			`).all({ conversationId }) as Array<Record<string, unknown>>);
			for (const row of roleRows) {
				const rid = row.request_id as string;
				const role = (row.role as string).toLowerCase();
				const tokens = Number(row.tokens);
				const entry = roleTokensByRequest.get(rid) ?? { system: 0, user: 0, assistant: 0, tool: 0 };
				if (role === 'system') entry.system += tokens;
				else if (role === 'user') entry.user += tokens;
				else if (role === 'assistant') entry.assistant += tokens;
				else if (role === 'tool') entry.tool += tokens;
				roleTokensByRequest.set(rid, entry);
			}
		}

		// Context management events per request
		// Note: removed_messages_delta is not in the schema — using removed_tool_exchanges_delta as proxy
		const strippedByRequest = new Map<string, number>();
		const cmeByRequest = new Map<string, number>(); // 1 if event fired
		const tokensRemovedByRequest = new Map<string, number>();
		if (hasCme) {
			const cmeRows = (db.prepare(`
				SELECT
					request_id,
					COUNT(*) AS eventCount,
					SUM(COALESCE(removed_tool_exchanges_delta, 0)) AS stripped,
					SUM(COALESCE(estimated_tokens_before, 0) - COALESCE(estimated_tokens_after, 0)) AS tokensRemoved
				FROM context_management_events
				WHERE request_id IN (
					SELECT request_id FROM llm_requests WHERE conversation_id = @conversationId
				)
				GROUP BY request_id
			`).all({ conversationId }) as Array<Record<string, unknown>>);
			for (const row of cmeRows) {
				strippedByRequest.set(row.request_id as string, Number(row.stripped));
				cmeByRequest.set(row.request_id as string, Number(row.eventCount) > 0 ? 1 : 0);
				tokensRemovedByRequest.set(row.request_id as string, Math.max(0, Number(row.tokensRemoved)));
			}
		}

		// Build time series
		const timeSeries = requestRows.map((r) => ({
			timestamp: new Date(Number(r.started_at_ms)).toISOString(),
			tokensUsed: Number(r.tokensUsed),
			inputTokens: Number(r.inputTokens),
			outputTokens: Number(r.outputTokens),
			cacheReadTokens: Number(r.cacheReadTokens),
			cacheWriteTokens: Number(r.cacheWriteTokens),
			messageCount: msgCountByRequest.get(r.id as string) ?? 0,
			toolCallsCount: toolCallCountByRequest.get(r.id as string) ?? 0,
			toolResultsCount: toolResultCountByRequest.get(r.id as string) ?? 0,
			toolCallsStripped: strippedByRequest.get(r.id as string) ?? 0,
			tokensRemovedByContextEditing: tokensRemovedByRequest.get(r.id as string) ?? 0,
			contextManagementEvent: cmeByRequest.get(r.id as string) ?? 0,
			anthropicClearToolUses: Number(r.anthropicClearToolUses),
			roleTokens: roleTokensByRequest.get(r.id as string) ?? { system: 0, user: 0, assistant: 0, tool: 0 }
		}));

		// Summary aggregates
		const tokenValues = timeSeries.map((p) => p.tokensUsed);
		const sortedTokens = [...tokenValues].sort((a, b) => a - b);
		const totalTokens = tokenValues.reduce((s, v) => s + v, 0);
		const totalMessages = timeSeries.reduce((s, p) => s + p.messageCount, 0);
		const totalToolCalls = timeSeries.reduce((s, p) => s + p.toolCallsCount, 0);
		const totalStripped = timeSeries.reduce((s, p) => s + p.toolCallsStripped, 0);
		const totalCacheRead = timeSeries.reduce((s, p) => s + p.cacheReadTokens, 0);
		const totalCacheWrite = timeSeries.reduce((s, p) => s + p.cacheWriteTokens, 0);
		const requestsWithCacheHits = timeSeries.filter((p) => p.cacheReadTokens > 0).length;
		const requestsWithContextManagement = timeSeries.filter((p) => p.contextManagementEvent > 0).length;
		const requestsWithAnthropicToolClear = timeSeries.filter((p) => p.anthropicClearToolUses > 0).length;

		const firstMs = Number(requestRows[0].started_at_ms);
		const lastMs = Number(requestRows[requestRows.length - 1].started_at_ms);

		const summary = {
			meanTokensPerRequest: timeSeries.length > 0 ? totalTokens / timeSeries.length : 0,
			avgMessagesPerRequest: timeSeries.length > 0 ? totalMessages / timeSeries.length : 0,
			totalToolCalls,
			totalToolCallsStripped: totalStripped,
			minTokens: sortedTokens[0] ?? 0,
			maxTokens: sortedTokens[sortedTokens.length - 1] ?? 0,
			medianTokens: median(sortedTokens),
			conversationDurationSeconds: (lastMs - firstMs) / 1000,
			totalCacheReadTokens: totalCacheRead,
			totalCacheWriteTokens: totalCacheWrite,
			requestsWithCacheHits,
			requestsWithContextManagement,
			requestsWithAnthropicToolClear
		};

		return json({ conversationId, timeSeries, summary } satisfies ConversationStats);
	} catch {
		return json({ conversationId, timeSeries: [], summary: emptySummary } satisfies ConversationStats);
	}
};
