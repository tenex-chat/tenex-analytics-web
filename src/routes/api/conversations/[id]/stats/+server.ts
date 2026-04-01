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

export const GET: RequestHandler = ({ params }) => {
	const conversationId = params.id;

	if (!hasTable('llm_requests')) {
		return json({
			conversationId,
			timeSeries: [],
			summary: {
				meanTokensPerRequest: 0,
				avgMessagesPerRequest: 0,
				totalToolCalls: 0,
				totalToolCallsStripped: 0,
				minTokens: 0,
				maxTokens: 0,
				medianTokens: 0,
				conversationDurationSeconds: 0
			}
		} satisfies ConversationStats);
	}

	try {
		const db = getDb();

		// Fetch per-request data with message counts
		const hasMessages = hasTable('llm_request_messages');
		const hasCme = hasTable('context_management_events');

		const requestRows = (db.prepare(`
			SELECT
				r.request_id AS id,
				r.started_at_ms,
				COALESCE(r.input_tokens, 0) + COALESCE(r.output_tokens, 0) AS tokensUsed,
				COALESCE(r.anthropic_clear_tool_uses_enabled, 0) AS clearToolUsesEnabled
			FROM llm_requests r
			WHERE r.conversation_id = @conversationId
			ORDER BY r.started_at_ms ASC
		`).all({ conversationId }) as Array<Record<string, unknown>>);

		if (requestRows.length === 0) {
			return json({
				conversationId,
				timeSeries: [],
				summary: {
					meanTokensPerRequest: 0,
					avgMessagesPerRequest: 0,
					totalToolCalls: 0,
					totalToolCallsStripped: 0,
					minTokens: 0,
					maxTokens: 0,
					medianTokens: 0,
					conversationDurationSeconds: 0
				}
			} satisfies ConversationStats);
		}

		// Message counts per request
		const msgCountByRequest = new Map<string, number>();
		const toolCallCountByRequest = new Map<string, number>();
		if (hasMessages) {
			const msgRows = (db.prepare(`
				SELECT
					request_id,
					COUNT(*) AS total,
					SUM(CASE WHEN classification = 'tool_use' OR classification = 'tool_result' THEN 1 ELSE 0 END) AS toolCount
				FROM llm_request_messages
				WHERE request_id IN (
					SELECT request_id FROM llm_requests WHERE conversation_id = @conversationId
				)
				GROUP BY request_id
			`).all({ conversationId }) as Array<Record<string, unknown>>);
			for (const row of msgRows) {
				msgCountByRequest.set(row.request_id as string, Number(row.total));
				toolCallCountByRequest.set(row.request_id as string, Number(row.toolCount));
			}
		}

		// Tool strips per request from context_management_events
		const strippedByRequest = new Map<string, number>();
		if (hasCme) {
			const cmeRows = (db.prepare(`
				SELECT
					request_id,
					SUM(COALESCE(removed_tool_exchanges_delta, 0)) AS stripped
				FROM context_management_events
				WHERE request_id IN (
					SELECT request_id FROM llm_requests WHERE conversation_id = @conversationId
				)
				GROUP BY request_id
			`).all({ conversationId }) as Array<Record<string, unknown>>);
			for (const row of cmeRows) {
				strippedByRequest.set(row.request_id as string, Number(row.stripped));
			}
		}

		// Build time series
		const timeSeries = requestRows.map((r) => ({
			timestamp: new Date(Number(r.started_at_ms)).toISOString(),
			tokensUsed: Number(r.tokensUsed),
			messageCount: msgCountByRequest.get(r.id as string) ?? 0,
			toolCallsCount: toolCallCountByRequest.get(r.id as string) ?? 0,
			toolCallsStripped: strippedByRequest.get(r.id as string) ?? 0
		}));

		// Compute summary aggregates
		const tokenValues = timeSeries.map((p) => p.tokensUsed);
		const sortedTokens = [...tokenValues].sort((a, b) => a - b);
		const totalTokens = tokenValues.reduce((s, v) => s + v, 0);
		const totalMessages = timeSeries.reduce((s, p) => s + p.messageCount, 0);
		const totalToolCalls = timeSeries.reduce((s, p) => s + p.toolCallsCount, 0);
		const totalStripped = timeSeries.reduce((s, p) => s + p.toolCallsStripped, 0);

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
			conversationDurationSeconds: (lastMs - firstMs) / 1000
		};

		return json({ conversationId, timeSeries, summary } satisfies ConversationStats);
	} catch {
		return json({
			conversationId,
			timeSeries: [],
			summary: {
				meanTokensPerRequest: 0,
				avgMessagesPerRequest: 0,
				totalToolCalls: 0,
				totalToolCallsStripped: 0,
				minTokens: 0,
				maxTokens: 0,
				medianTokens: 0,
				conversationDurationSeconds: 0
			}
		} satisfies ConversationStats);
	}
};
