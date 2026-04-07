// GET /api/tokens — token usage trends over time
// Supports ?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=hour|day|week&model=...&agent=...&project=...&provider=...

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
		return json({ granularity: 'day', points: [] });
	}

	const range = parseDateRange(url);
	const granularity = (url.searchParams.get('granularity') ?? 'day') as 'hour' | 'day' | 'week';
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

	const groupExpr =
		granularity === 'hour'
			? "strftime('%Y-%m-%dT%H:00:00', started_at_ms/1000, 'unixepoch')"
			: granularity === 'week'
				? "strftime('%Y-W%W', started_at_ms/1000, 'unixepoch')"
				: "date(started_at_ms/1000, 'unixepoch')";

	const rows = db
		.prepare(
			`
		SELECT
			${groupExpr}                                        AS date,
			COALESCE(SUM(input_tokens), 0)                      AS inputTokens,
			COALESCE(SUM(output_tokens), 0)                     AS outputTokens,
			COALESCE(SUM(input_cache_read_tokens), 0)           AS cacheReadTokens,
			COALESCE(SUM(input_cache_write_tokens), 0)          AS cacheWriteTokens,
			COALESCE(SUM(total_tokens), 0)                      AS totalTokens,
			COUNT(*)                                            AS requests
		FROM llm_requests
		${statusClause}
		GROUP BY ${groupExpr}
		ORDER BY date ASC
	`
		)
		.all(params) as Array<Record<string, number | string>>;

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
