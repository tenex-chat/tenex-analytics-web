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

	const statusClause = clause
		? clause + " AND status = 'success'"
		: "WHERE status = 'success'";

	// Summary
	const summaryRow = db.prepare(`
		SELECT
			COALESCE(SUM(input_tokens), 0)                AS totalInputTokens,
			COALESCE(SUM(output_tokens), 0)               AS totalOutputTokens,
			COALESCE(SUM(input_cache_read_tokens), 0)     AS totalCacheReadTokens,
			COALESCE(SUM(input_cache_write_tokens), 0)    AS totalCacheWriteTokens,
			COALESCE(SUM(total_tokens), 0)                AS totalTokens,
			COALESCE(SUM(cost_usd), 0)                    AS totalCostUsd,
			COUNT(*)                                      AS totalRequests,
			MIN(date(started_at_ms/1000, 'unixepoch'))    AS dateFrom,
			MAX(date(started_at_ms/1000, 'unixepoch'))    AS dateTo
		FROM llm_requests
		${statusClause}
	`).get(params) as Record<string, number | string>;

	const cacheRead = Number(summaryRow.totalCacheReadTokens);
	const inputTokens = Number(summaryRow.totalInputTokens);
	const cacheEff = inputTokens > 0 ? (cacheRead / inputTokens) * 100 : 0;

	const summary = {
		totalInputTokens: inputTokens,
		totalOutputTokens: Number(summaryRow.totalOutputTokens),
		totalCacheReadTokens: cacheRead,
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
			date(started_at_ms/1000, 'unixepoch')         AS date,
			COALESCE(SUM(input_tokens), 0)                AS inputTokens,
			COALESCE(SUM(output_tokens), 0)               AS outputTokens,
			COALESCE(SUM(input_cache_read_tokens), 0)     AS cacheReadTokens,
			COALESCE(SUM(input_cache_write_tokens), 0)    AS cacheWriteTokens,
			COALESCE(SUM(total_tokens), 0)                AS totalTokens,
			COUNT(*)                                      AS requests
		FROM llm_requests
		${statusClause}
		GROUP BY date(started_at_ms/1000, 'unixepoch')
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
			COALESCE(model, 'unknown')                    AS label,
			COALESCE(SUM(input_cache_read_tokens), 0)     AS cacheReadTokens,
			COALESCE(SUM(input_cache_write_tokens), 0)    AS cacheWriteTokens,
			COALESCE(SUM(input_tokens), 0)                AS inputTokens,
			COUNT(*)                                      AS requests
		FROM llm_requests
		${statusClause}
		GROUP BY model
		ORDER BY cacheReadTokens DESC
	`).all(params) as Array<Record<string, number | string>>;

	const byModelPoints = byModelRows.map((r) => {
		const cr = Number(r.cacheReadTokens);
		const inp = Number(r.inputTokens);
		const eff = inp > 0 ? (cr / inp) * 100 : 0;
		return {
			label: r.label as string,
			cacheReadTokens: cr,
			cacheWriteTokens: Number(r.cacheWriteTokens),
			inputTokens: inp,
			efficiencyPercent: Math.round(eff * 100) / 100,
			requests: Number(r.requests)
		};
	});

	// Cache metrics by day
	const byDayRows = db.prepare(`
		SELECT
			date(started_at_ms/1000, 'unixepoch')         AS label,
			COALESCE(SUM(input_cache_read_tokens), 0)     AS cacheReadTokens,
			COALESCE(SUM(input_cache_write_tokens), 0)    AS cacheWriteTokens,
			COALESCE(SUM(input_tokens), 0)                AS inputTokens,
			COUNT(*)                                      AS requests
		FROM llm_requests
		${statusClause}
		GROUP BY date(started_at_ms/1000, 'unixepoch')
		ORDER BY label ASC
	`).all(params) as Array<Record<string, number | string>>;

	const byDayPoints = byDayRows.map((r) => {
		const cr = Number(r.cacheReadTokens);
		const inp = Number(r.inputTokens);
		const eff = inp > 0 ? (cr / inp) * 100 : 0;
		return {
			label: r.label as string,
			cacheReadTokens: cr,
			cacheWriteTokens: Number(r.cacheWriteTokens),
			inputTokens: inp,
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
			date(started_at_ms/1000, 'unixepoch')         AS date,
			COALESCE(SUM(cost_usd), 0)                    AS totalCostUsd,
			COUNT(*)                                      AS requests
		FROM llm_requests
		${statusClause}
		GROUP BY date(started_at_ms/1000, 'unixepoch')
		ORDER BY date ASC
	`).all(params) as Array<Record<string, number | string>>;

	// Cost data by model
	const costByModelRows = db.prepare(`
		SELECT
			COALESCE(model, 'unknown')                    AS model,
			COALESCE(SUM(cost_usd), 0)                    AS totalCostUsd,
			COUNT(*)                                      AS requests
		FROM llm_requests
		${statusClause}
		GROUP BY model
		ORDER BY totalCostUsd DESC
	`).all(params) as Array<Record<string, number | string>>;

	const costData = {
		total: Number(summaryRow.totalCostUsd),
		byDay: costByDayRows.map((r) => ({
			date: r.date as string,
			totalCostUsd: Number(r.totalCostUsd),
			requests: Number(r.requests)
		})),
		byModel: costByModelRows.map((r) => ({
			model: r.model as string,
			totalCostUsd: Number(r.totalCostUsd),
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
