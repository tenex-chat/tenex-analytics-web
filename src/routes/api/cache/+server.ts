// GET /api/cache — cache efficiency metrics by model and by day
// Supports ?from=YYYY-MM-DD&to=YYYY-MM-DD&model=...&agent=...&project=...&provider=...

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getDb,
	buildDateFilter,
	parseDateRange,
	hasTelemetryTable,
	parseEntityFilters,
	buildEntityFilter
} from '$lib/server/database.js';

export const GET: RequestHandler = ({ url }) => {
	if (!hasTelemetryTable()) {
		return json({
			overall: { efficiencyPercent: 0, totalCacheReadTokens: 0, totalCacheWriteTokens: 0 },
			byModel: [],
			byDay: []
		});
	}

	const range = parseDateRange(url);
	const { clause, params: dateParams } = buildDateFilter(range);
	const { conditions: entityConditions, params: entityParams } = buildEntityFilter(
		parseEntityFilters(url)
	);
	const params = { ...dateParams, ...entityParams };
	const db = getDb();

	const allConditions = ["status = 'success'", ...entityConditions];
	const statusClause = clause
		? clause + ' AND ' + allConditions.join(' AND ')
		: 'WHERE ' + allConditions.join(' AND ');

	// Overall totals
	const overall = db.prepare(`
		SELECT
			COALESCE(SUM(input_cache_read_tokens), 0)   AS totalCacheReadTokens,
			COALESCE(SUM(input_cache_write_tokens), 0)  AS totalCacheWriteTokens,
			COALESCE(SUM(input_tokens), 0)              AS totalInputTokens
		FROM llm_requests
		${statusClause}
	`).get(params) as Record<string, number>;

	const cacheRead = Number(overall.totalCacheReadTokens);
	const input = Number(overall.totalInputTokens);
	const efficiencyPercent = input > 0
		? Math.round((cacheRead / input) * 10000) / 100
		: 0;

	// By model
	const byModelRows = db.prepare(`
		SELECT
			COALESCE(model, 'unknown')                  AS label,
			COALESCE(SUM(input_cache_read_tokens), 0)   AS cacheReadTokens,
			COALESCE(SUM(input_cache_write_tokens), 0)  AS cacheWriteTokens,
			COALESCE(SUM(input_tokens), 0)              AS inputTokens,
			COUNT(*)                                    AS requests
		FROM llm_requests
		${statusClause}
		GROUP BY model
		ORDER BY cacheReadTokens DESC
	`).all(params) as Array<Record<string, number | string>>;

	// By day
	const byDayRows = db.prepare(`
		SELECT
			date(started_at_ms/1000, 'unixepoch')       AS label,
			COALESCE(SUM(input_cache_read_tokens), 0)   AS cacheReadTokens,
			COALESCE(SUM(input_cache_write_tokens), 0)  AS cacheWriteTokens,
			COALESCE(SUM(input_tokens), 0)              AS inputTokens,
			COUNT(*)                                    AS requests
		FROM llm_requests
		${statusClause}
		GROUP BY date(started_at_ms/1000, 'unixepoch')
		ORDER BY label ASC
	`).all(params) as Array<Record<string, number | string>>;

	function toPoint(r: Record<string, number | string>) {
		const cr = Number(r.cacheReadTokens);
		const inp = Number(r.inputTokens);
		const eff = inp > 0 ? Math.round((cr / inp) * 10000) / 100 : 0;
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
