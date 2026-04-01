// GET /api/tokens — token usage trends over time
// Supports ?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=hour|day|week

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb, buildDateFilter, parseDateRange, hasTelemetryTable } from '$lib/server/database.js';

export const GET: RequestHandler = ({ url }) => {
	if (!hasTelemetryTable()) {
		return json({ granularity: 'day', points: [] });
	}

	const range = parseDateRange(url);
	const granularity = (url.searchParams.get('granularity') ?? 'day') as 'hour' | 'day' | 'week';
	const { clause, params } = buildDateFilter(range);
	const db = getDb();

	const groupExpr =
		granularity === 'hour'
			? "strftime('%Y-%m-%dT%H:00:00', created_at, 'unixepoch')"
			: granularity === 'week'
				? "strftime('%Y-W%W', created_at, 'unixepoch')"
				: "date(created_at, 'unixepoch')";

	const rows = db.prepare(`
		SELECT
			${groupExpr}                                AS date,
			COALESCE(SUM(input_tokens), 0)              AS inputTokens,
			COALESCE(SUM(output_tokens), 0)             AS outputTokens,
			COALESCE(SUM(cache_read_tokens), 0)         AS cacheReadTokens,
			COALESCE(SUM(cache_write_tokens), 0)        AS cacheWriteTokens,
			COALESCE(SUM(input_tokens + output_tokens + cache_read_tokens + cache_write_tokens), 0) AS totalTokens,
			COUNT(*)                                    AS requests
		FROM llm_usage
		${clause}
		GROUP BY ${groupExpr}
		ORDER BY date ASC
	`).all(params) as Array<Record<string, number | string>>;

	return json({
		granularity,
		points: rows.map((r) => ({
			date: r.date as string,
			inputTokens: Number(r.inputTokens),
			outputTokens: Number(r.outputTokens),
			cacheReadTokens: Number(r.cacheReadTokens),
			cacheWriteTokens: Number(r.cacheWriteTokens),
			totalTokens: Number(r.totalTokens),
			requests: Number(r.requests)
		}))
	});
};
