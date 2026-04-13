// GET /api/telemetry/summary — aggregated summary metrics
// Returns total tokens, cache efficiency %, total cost, request count

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
import { buildAnthropicRequestCostSql } from '$lib/server/anthropic-pricing.js';

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

	const row = db
		.prepare(
			`
		SELECT
			COALESCE(SUM(input_tokens), 0)                AS totalInputTokens,
			COALESCE(SUM(output_tokens), 0)               AS totalOutputTokens,
			COALESCE(SUM(input_cache_read_tokens), 0)     AS totalCacheReadTokens,
			COALESCE(SUM(input_cache_write_tokens), 0)    AS totalCacheWriteTokens,
			COALESCE(SUM(total_tokens), 0)                AS totalTokens,
			COALESCE(SUM(${buildAnthropicRequestCostSql('llm_requests')}), 0) AS totalCostUsd,
			COUNT(*)                                      AS totalRequests,
			MIN(date(started_at_ms/1000, 'unixepoch'))    AS dateFrom,
			MAX(date(started_at_ms/1000, 'unixepoch'))    AS dateTo,
			ROUND(
				SUM(input_cache_read_tokens) * 100.0 / NULLIF(SUM(input_tokens), 0),
				2
			) AS cacheEfficiencyPercent
		FROM llm_requests
		${statusClause}
	`
		)
		.get(params) as Record<string, number | string>;

	return json({
		totalInputTokens: Number(row.totalInputTokens),
		totalOutputTokens: Number(row.totalOutputTokens),
		totalCacheReadTokens: Number(row.totalCacheReadTokens),
		totalCacheWriteTokens: Number(row.totalCacheWriteTokens),
		totalTokens: Number(row.totalTokens),
		cacheEfficiencyPercent: Number(row.cacheEfficiencyPercent) || 0,
		totalCostUsd: Number(row.totalCostUsd),
		totalRequests: Number(row.totalRequests),
		dateRange: {
			from: (row.dateFrom as string) ?? '',
			to: (row.dateTo as string) ?? ''
		}
	});
};
