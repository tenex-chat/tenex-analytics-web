// GET /api/telemetry/summary — aggregated summary metrics
// Returns total tokens, cache efficiency %, total cost, request count

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb, buildDateFilter, parseDateRange, hasTelemetryTable } from '$lib/server/database.js';

export const GET: RequestHandler = ({ url }) => {
	if (!hasTelemetryTable()) {
		return json({
			totalInputTokens: 0,
			totalOutputTokens: 0,
			totalCacheReadTokens: 0,
			totalCacheWriteTokens: 0,
			totalTokens: 0,
			cacheEfficiencyPercent: 0,
			totalCostUsd: 0,
			totalRequests: 0,
			dateRange: { from: '', to: '' }
		});
	}

	const range = parseDateRange(url);
	const { clause, params } = buildDateFilter(range);
	const db = getDb();

	const row = db.prepare(`
		SELECT
			COALESCE(SUM(input_tokens), 0)        AS totalInputTokens,
			COALESCE(SUM(output_tokens), 0)       AS totalOutputTokens,
			COALESCE(SUM(cache_read_tokens), 0)   AS totalCacheReadTokens,
			COALESCE(SUM(cache_write_tokens), 0)  AS totalCacheWriteTokens,
			COALESCE(SUM(input_tokens + output_tokens + cache_read_tokens + cache_write_tokens), 0) AS totalTokens,
			COALESCE(SUM(total_cost_usd), 0)      AS totalCostUsd,
			COUNT(*)                              AS totalRequests,
			MIN(date(created_at, 'unixepoch'))    AS dateFrom,
			MAX(date(created_at, 'unixepoch'))    AS dateTo
		FROM llm_usage
		${clause}
	`).get(params) as Record<string, number | string>;

	const cacheRead = Number(row.totalCacheReadTokens);
	const input = Number(row.totalInputTokens);
	const cacheEfficiencyPercent = cacheRead > 0
		? Math.round((cacheRead / (cacheRead + input)) * 10000) / 100
		: 0;

	return json({
		totalInputTokens: Number(row.totalInputTokens),
		totalOutputTokens: Number(row.totalOutputTokens),
		totalCacheReadTokens: cacheRead,
		totalCacheWriteTokens: Number(row.totalCacheWriteTokens),
		totalTokens: Number(row.totalTokens),
		cacheEfficiencyPercent,
		totalCostUsd: Number(row.totalCostUsd),
		totalRequests: Number(row.totalRequests),
		dateRange: {
			from: (row.dateFrom as string) ?? '',
			to: (row.dateTo as string) ?? ''
		}
	});
};
