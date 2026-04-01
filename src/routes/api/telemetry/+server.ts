// GET /api/telemetry — full telemetry data bundle
// Returns summary + token trends + cache metrics + cost data

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb, buildDateFilter, parseDateRange, hasTelemetryTable } from '$lib/server/database.js';

export const GET: RequestHandler = ({ url }) => {
	if (!hasTelemetryTable()) {
		return json({
			summary: emptyTelemetrySummary(),
			tokenTrends: { granularity: 'day', points: [] },
			cacheMetrics: { overall: { efficiencyPercent: 0, totalCacheReadTokens: 0, totalCacheWriteTokens: 0 }, byModel: [], byDay: [] },
			costData: { total: 0, byDay: [], byModel: [] }
		});
	}

	const range = parseDateRange(url);
	const { clause, params } = buildDateFilter(range);
	const db = getDb();

	// Summary
	const summaryRow = db.prepare(`
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

	const cacheEff = summaryRow.totalCacheReadTokens > 0
		? (Number(summaryRow.totalCacheReadTokens) /
			(Number(summaryRow.totalCacheReadTokens) + Number(summaryRow.totalInputTokens))) * 100
		: 0;

	const summary = {
		totalInputTokens: Number(summaryRow.totalInputTokens),
		totalOutputTokens: Number(summaryRow.totalOutputTokens),
		totalCacheReadTokens: Number(summaryRow.totalCacheReadTokens),
		totalCacheWriteTokens: Number(summaryRow.totalCacheWriteTokens),
		totalTokens: Number(summaryRow.totalTokens),
		cacheEfficiencyPercent: Math.round(cacheEff * 100) / 100,
		totalCostUsd: Number(summaryRow.totalCostUsd),
		totalRequests: Number(summaryRow.totalRequests),
		dateRange: {
			from: (summaryRow.dateFrom as string) ?? '',
			to: (summaryRow.dateTo as string) ?? ''
		}
	};

	// Token trends (daily)
	const trendRows = db.prepare(`
		SELECT
			date(created_at, 'unixepoch')         AS date,
			COALESCE(SUM(input_tokens), 0)        AS inputTokens,
			COALESCE(SUM(output_tokens), 0)       AS outputTokens,
			COALESCE(SUM(cache_read_tokens), 0)   AS cacheReadTokens,
			COALESCE(SUM(cache_write_tokens), 0)  AS cacheWriteTokens,
			COALESCE(SUM(input_tokens + output_tokens + cache_read_tokens + cache_write_tokens), 0) AS totalTokens,
			COUNT(*)                              AS requests
		FROM llm_usage
		${clause}
		GROUP BY date(created_at, 'unixepoch')
		ORDER BY date ASC
	`).all(params) as Array<Record<string, number | string>>;

	const tokenTrends = {
		granularity: 'day' as const,
		points: trendRows.map((r) => ({
			date: r.date as string,
			inputTokens: Number(r.inputTokens),
			outputTokens: Number(r.outputTokens),
			cacheReadTokens: Number(r.cacheReadTokens),
			cacheWriteTokens: Number(r.cacheWriteTokens),
			totalTokens: Number(r.totalTokens),
			requests: Number(r.requests)
		}))
	};

	// Cache metrics by model
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

	const byModelPoints = byModelRows.map((r) => {
		const cacheRead = Number(r.cacheReadTokens);
		const input = Number(r.inputTokens);
		const eff = cacheRead > 0 ? (cacheRead / (cacheRead + input)) * 100 : 0;
		return {
			label: r.label as string,
			cacheReadTokens: cacheRead,
			cacheWriteTokens: Number(r.cacheWriteTokens),
			inputTokens: input,
			efficiencyPercent: Math.round(eff * 100) / 100,
			requests: Number(r.requests)
		};
	});

	// Cache metrics by day
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

	const byDayPoints = byDayRows.map((r) => {
		const cacheRead = Number(r.cacheReadTokens);
		const input = Number(r.inputTokens);
		const eff = cacheRead > 0 ? (cacheRead / (cacheRead + input)) * 100 : 0;
		return {
			label: r.label as string,
			cacheReadTokens: cacheRead,
			cacheWriteTokens: Number(r.cacheWriteTokens),
			inputTokens: input,
			efficiencyPercent: Math.round(eff * 100) / 100,
			requests: Number(r.requests)
		};
	});

	const cacheMetrics = {
		overall: {
			efficiencyPercent: summary.cacheEfficiencyPercent,
			totalCacheReadTokens: summary.totalCacheReadTokens,
			totalCacheWriteTokens: summary.totalCacheWriteTokens
		},
		byModel: byModelPoints,
		byDay: byDayPoints
	};

	// Cost data by day
	const costByDayRows = db.prepare(`
		SELECT
			date(created_at, 'unixepoch')           AS date,
			COALESCE(SUM(total_cost_usd), 0)        AS totalCostUsd,
			COALESCE(SUM(input_cost_usd), 0)        AS inputCostUsd,
			COALESCE(SUM(output_cost_usd), 0)       AS outputCostUsd,
			COALESCE(SUM(cache_read_cost_usd + cache_write_cost_usd), 0) AS cacheCostUsd,
			COUNT(*)                                AS requests
		FROM llm_usage
		${clause}
		GROUP BY date(created_at, 'unixepoch')
		ORDER BY date ASC
	`).all(params) as Array<Record<string, number | string>>;

	// Cost data by model
	const costByModelRows = db.prepare(`
		SELECT
			COALESCE(model, 'unknown')              AS model,
			COALESCE(SUM(total_cost_usd), 0)        AS totalCostUsd,
			COALESCE(SUM(input_cost_usd), 0)        AS inputCostUsd,
			COALESCE(SUM(output_cost_usd), 0)       AS outputCostUsd,
			COALESCE(SUM(cache_read_cost_usd + cache_write_cost_usd), 0) AS cacheCostUsd,
			COUNT(*)                                AS requests
		FROM llm_usage
		${clause}
		GROUP BY model
		ORDER BY totalCostUsd DESC
	`).all(params) as Array<Record<string, number | string>>;

	const costData = {
		total: Number(summaryRow.totalCostUsd),
		byDay: costByDayRows.map((r) => ({
			date: r.date as string,
			totalCostUsd: Number(r.totalCostUsd),
			inputCostUsd: Number(r.inputCostUsd),
			outputCostUsd: Number(r.outputCostUsd),
			cacheCostUsd: Number(r.cacheCostUsd),
			requests: Number(r.requests)
		})),
		byModel: costByModelRows.map((r) => ({
			model: r.model as string,
			totalCostUsd: Number(r.totalCostUsd),
			inputCostUsd: Number(r.inputCostUsd),
			outputCostUsd: Number(r.outputCostUsd),
			cacheCostUsd: Number(r.cacheCostUsd),
			requests: Number(r.requests),
			avgCostPerRequest: Number(r.requests) > 0 ? Number(r.totalCostUsd) / Number(r.requests) : 0
		}))
	};

	return json({ summary, tokenTrends, cacheMetrics, costData });
};

function emptyTelemetrySummary() {
	return {
		totalInputTokens: 0,
		totalOutputTokens: 0,
		totalCacheReadTokens: 0,
		totalCacheWriteTokens: 0,
		totalTokens: 0,
		cacheEfficiencyPercent: 0,
		totalCostUsd: 0,
		totalRequests: 0,
		dateRange: { from: '', to: '' }
	};
}
