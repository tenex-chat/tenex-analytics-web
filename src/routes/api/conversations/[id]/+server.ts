// GET /api/conversations/[id] — single conversation with request + message detail
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database.js';
import {
	allocatePromptCostByTokens,
	inferAnthropicRequestCost
} from '$lib/server/anthropic-pricing.js';

function hasTable(name: string): boolean {
	try {
		const db = getDb();
		const row = db
			.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
			.get(name);
		return row !== undefined;
	} catch {
		return false;
	}
}

function countSystemReminders(text: string): number {
	let count = 0;
	// Count direct child tags inside each <system-reminders>...</system-reminders> block
	const blockPattern = /<system-reminders>([\s\S]*?)(<\/system-reminders>|$)/g;
	let block;
	while ((block = blockPattern.exec(text)) !== null) {
		const inner = block[1];
		// Walk through inner content counting only depth-0 opening tags
		const tagPattern = /<(\/?)[a-z][a-z0-9-]*/g;
		let depth = 0;
		let tag;
		while ((tag = tagPattern.exec(inner)) !== null) {
			if (tag[1] === '/') {
				depth = Math.max(0, depth - 1);
			} else {
				if (depth === 0) count++;
				depth++;
			}
		}
	}
	// Count standalone <system-reminder> (singular) tags — each is one reminder
	const singular = text.match(/<system-reminder[\s>]/g);
	if (singular) {
		count += singular.filter((m) => !m.startsWith('<system-reminders')).length;
	}
	return count;
}

function extractToolName(classification: string, preview: string): string | null {
	if (!preview || (classification !== 'tool-call' && classification !== 'tool-result')) {
		return null;
	}

	try {
		const parsed = JSON.parse(preview) as { toolName?: unknown };
		if (typeof parsed.toolName === 'string' && parsed.toolName.length > 0) {
			return parsed.toolName;
		}
	} catch {
		const match = preview.match(/"toolName":"([^"]+)"/);
		if (match?.[1]) return match[1];
	}

	return null;
}

export const GET: RequestHandler = ({ params }) => {
	const conversationId = params.id;

	if (!hasTable('llm_requests')) {
		return json({ conversationId, requests: [] });
	}

	try {
		const db = getDb();

		const requestRows = db
			.prepare(
				`
			SELECT
				request_id AS id,
				started_at_ms,
				COALESCE(provider, '') AS provider,
				COALESCE(model, 'unknown') AS model,
				COALESCE(input_tokens, 0) AS inputTokens,
				COALESCE(output_tokens, 0) AS outputTokens,
				COALESCE(input_cache_read_tokens, 0) AS cacheReadTokens,
				COALESCE(input_cache_write_tokens, 0) AS cacheWriteTokens,
				COALESCE(cost_usd, 0) AS totalCostUsd,
				COALESCE(status, '') AS status
			FROM llm_requests
			WHERE conversation_id = @conversationId
			ORDER BY started_at_ms ASC
		`
			)
			.all({ conversationId }) as Array<Record<string, unknown>>;

		const hasMessages = hasTable('llm_request_messages');
		const msgStmt = hasMessages
			? db.prepare(`
				SELECT
					COALESCE(role, 'unknown') AS role,
					COALESCE(classification, '') AS classification,
					COALESCE(estimated_tokens, 0) AS tokenCount,
					COALESCE(preview, '') AS contentPreview
				FROM llm_request_messages
				WHERE request_id = @requestId
				ORDER BY message_index ASC
			`)
			: null;

		const requests = requestRows.map((r) => {
			let messages: Array<{
				role: string;
				classification: string;
				tokenCount: number;
				contentPreview: string;
				systemReminderCount: number;
				toolName: string | null;
				promptCostUsd: number;
			}> = [];
			if (msgStmt) {
				try {
					messages = (msgStmt.all({ requestId: r.id }) as Array<Record<string, unknown>>).map(
						(m) => {
							const classification = m.classification as string;
							const contentPreview = m.contentPreview as string;
							return {
								role: m.role as string,
								classification,
								tokenCount: Number(m.tokenCount),
								contentPreview,
								systemReminderCount: countSystemReminders(contentPreview),
								toolName: extractToolName(classification, contentPreview),
								promptCostUsd: 0
							};
						}
					);
				} catch {
					// ignore
				}
			}

			const inferredCost = inferAnthropicRequestCost({
				provider: r.provider as string,
				model: r.model as string,
				inputTokens: Number(r.inputTokens),
				outputTokens: Number(r.outputTokens),
				cacheReadTokens: Number(r.cacheReadTokens),
				cacheWriteTokens: Number(r.cacheWriteTokens)
			});
			const rawCostUsd = Number(r.totalCostUsd);
			const totalCostUsd = rawCostUsd > 0 ? rawCostUsd : (inferredCost?.totalCostUsd ?? 0);
			const promptCostUsd = inferredCost?.promptCostUsd ?? 0;
			const messagePromptCosts = allocatePromptCostByTokens(
				messages.map((message) => message.tokenCount),
				promptCostUsd
			);
			messages = messages.map((message, index) => ({
				...message,
				promptCostUsd: messagePromptCosts[index] ?? 0
			}));

			return {
				id: r.id as string,
				timestamp: new Date(Number(r.started_at_ms)).toISOString(),
				provider: r.provider as string,
				model: r.model as string,
				inputTokens: Number(r.inputTokens),
				outputTokens: Number(r.outputTokens),
				cacheReadTokens: Number(r.cacheReadTokens),
				cacheWriteTokens: Number(r.cacheWriteTokens),
				totalCostUsd,
				rawCostUsd,
				costSource: rawCostUsd > 0 ? 'recorded' : inferredCost ? 'inferred' : 'unavailable',
				promptCostUsd,
				outputCostUsd: inferredCost?.outputCostUsd ?? 0,
				inputCostUsd: inferredCost?.inputCostUsd ?? 0,
				cacheReadCostUsd: inferredCost?.cacheReadCostUsd ?? 0,
				cacheWriteCostUsd: inferredCost?.cacheWriteCostUsd ?? 0,
				pricingModel: inferredCost?.canonicalModel ?? null,
				cacheWriteTtl: inferredCost?.cacheWriteTtl ?? null,
				status: r.status as string,
				messages
			};
		});

		return json({ conversationId, requests });
	} catch {
		return json({ conversationId, requests: [] });
	}
};
