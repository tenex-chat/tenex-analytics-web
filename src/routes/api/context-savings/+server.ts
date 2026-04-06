// GET /api/context-savings — local context-management savings over time
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

	const allConditions = [
		"status = 'success'",
		'COALESCE(context_runtime_estimated_input_tokens_saved, 0) > 0',
		...entityConditions
	];
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
			${groupExpr}                                                    AS date,
			COALESCE(SUM(sent_estimated_input_tokens), 0)                   AS sentTokens,
			COALESCE(SUM(context_runtime_estimated_input_tokens_saved), 0)  AS savedTokens,
			COALESCE(SUM(input_tokens), 0)                                  AS processedTokens,
			COUNT(*)                                                        AS requests,
			ROUND(100.0 * COALESCE(SUM(context_runtime_estimated_input_tokens_saved), 0) /
			      NULLIF(COALESCE(SUM(sent_estimated_input_tokens), 0), 0), 1) AS savingsPercent
		FROM llm_requests
		${statusClause}
		GROUP BY ${groupExpr}
		ORDER BY date ASC
	`
		)
		.all(params) as Array<Record<string, number | string | null>>;

	return json({
		granularity,
		points: rows.map((r) => ({
			date: r.date as string,
			sentTokens: Number(r.sentTokens),
			savedTokens: Number(r.savedTokens),
			processedTokens: Number(r.processedTokens),
			requests: Number(r.requests),
			savingsPercent: r.savingsPercent ? Number(r.savingsPercent) : 0
		}))
	});
};
