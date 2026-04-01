// GET /api/cache — cache efficiency metrics by model and by day
// Supports ?from=YYYY-MM-DD&to=YYYY-MM-DD

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb, buildDateFilter, parseDateRange, hasTelemetryTable } from '$lib/server/database.js';

export const GET: RequestHandler = ({ url }) => {
	if (!hasTelemetryTable()) {
		return json({
			overall: { efficiencyPercent: 0, totalCacheReadTokens: 0, totalCacheWriteTokens: 0 },
			byModel: [],
			byDay: []
		});
	}

	const range = parseDateRange(url);
	const { clause, params } = buildDateFilter(range);
	const db = getDb();

	// Overall totals
	const overall = db.prepare(`
		SELECT
			COALESCE(SUM(cache_read_tokens), 0)   AS totalCacheReadTokens,
			COALESCE(SUM(cache_write_tokens), 0)  AS totalCacheWriteTokens,
			COALESCE(SUM(input_tokens), 0)        AS totalInputTokens
		FROM llm_usage
		${clause}
	`).get(params) as Record<string, number>;

	const cacheRead = Number(overall.totalCacheReadTokens);
	const input = Number(overall.totalInputTokens);
	const efficiencyPercent = cacheRead > 0
		? Math.round((cacheRead / (cacheRead + input)) * 10000) / 100
		: 0;

	// By model
	const byModelRows = db.prepare(`
		SELECT
			COALESCE(model, 'unknown')            AS label,
			COALESCE(SUM(cache_read_tokens), 0)   AS cacheReadTokens,
			COALESCE(SUM(cache_write_tokens), 0)  AS cacheWriteTokens,
			COALESCE(SUM(input_tokens), 0)        AS inputTokens,
			COUNT(*)                              AS requests
		FROM llm_usage
		${clause}
		GROUP BY model
		ORDER BY cacheReadTokens DESC
	`).all(params) as Array<Record<string, number | string>>;

	// By day
	const byDayRows = db.prepare(`
		SELECT
			date(created_at, 'unixepoch')         AS label,
			COALESCE(SUM(cache_read_tokens), 0)   AS cacheReadTokens,
			COALESCE(SUM(cache_write_tokens), 0)  AS cacheWriteTokens,
			COALESCE(SUM(input_tokens), 0)        AS inputTokens,
			COUNT(*)                              AS requests
		FROM llm_usage
		${clause}
		GROUP BY date(created_at, 'unixepoch')
		ORDER BY label ASC
	`).all(params) as Array<Record<string, number | string>>;

	function toPoint(r: Record<string, number | string>) {
		const cr = Number(r.cacheReadTokens);
		const inp = Number(r.inputTokens);
		const eff = cr > 0 ? Math.round((cr / (cr + inp)) * 10000) / 100 : 0;
		return {
			label: r.label as string,
			cacheReadTokens: cr,
			cacheWriteTokens: Number(r.cacheWriteTokens),
			inputTokens: inp,
			efficiencyPercent: eff,
			requests: Number(r.requests)
		};
	}

	return json({
		overall: {
			efficiencyPercent,
			totalCacheReadTokens: cacheRead,
			totalCacheWriteTokens: Number(overall.totalCacheWriteTokens)
		},
		byModel: byModelRows.map(toPoint),
		byDay: byDayRows.map(toPoint)
	});
};
