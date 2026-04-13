// GET /api/conversations — list conversations grouped from llm_requests
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database.js';
import { buildAnthropicRequestCostSql } from '$lib/server/anthropic-pricing.js';

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

function buildMsFilter(url: URL): { clause: string; params: Record<string, number> } {
	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');
	const conditions: string[] = ["status = 'success'"];
	const params: Record<string, number> = {};
	if (from) {
		conditions.push('started_at_ms >= @from');
		params.from = new Date(from).getTime();
	}
	if (to) {
		const toDate = new Date(to);
		toDate.setHours(23, 59, 59, 999);
		conditions.push('started_at_ms <= @to');
		params.to = toDate.getTime();
	}
	return { clause: `WHERE ${conditions.join(' AND ')}`, params };
}

export const GET: RequestHandler = ({ url }) => {
	if (!hasTable('llm_requests')) return json({ conversations: [] });

	try {
		const db = getDb();
		const { clause, params } = buildMsFilter(url);

		const conversations = (
			db
				.prepare(
					`
			SELECT
				COALESCE(conversation_id, 'unknown') AS conversationId,
				COALESCE(agent_slug, 'unknown') AS agentSlug,
				COALESCE(project_id, 'unknown') AS projectId,
				COALESCE(SUM(total_tokens), 0) AS totalTokens,
				COALESCE(SUM(${buildAnthropicRequestCostSql('llm_requests')}), 0) AS totalCost,
				COUNT(*) AS requestCount,
				MAX(started_at_ms) AS lastTimestampMs,
				COALESCE(SUM(input_cache_read_tokens), 0) AS cacheReadTokens,
				COALESCE(SUM(input_tokens), 0) AS inputTokens
			FROM llm_requests
			${clause}
			GROUP BY conversation_id
			ORDER BY lastTimestampMs DESC
		`
				)
				.all(params) as Record<string, unknown>[]
		).map((r) => {
			const cacheRead = Number(r.cacheReadTokens);
			const inputTok = Number(r.inputTokens);
			const cacheEfficiency = inputTok > 0 ? Math.round((cacheRead / inputTok) * 10000) / 100 : 0;
			return {
				conversationId: r.conversationId as string,
				agentSlug: r.agentSlug as string,
				projectId: r.projectId as string,
				totalTokens: Number(r.totalTokens),
				totalCost: Number(r.totalCost),
				requestCount: Number(r.requestCount),
				lastTimestamp: new Date(Number(r.lastTimestampMs)).toISOString(),
				cacheEfficiency
			};
		});

		return json({ conversations });
	} catch {
		return json({ conversations: [] });
	}
};
