// GET /api/context-edits — server-side context editing impact over time
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
		'COALESCE(provider_context_edit_count, 0) > 0',
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

	const rows = db.prepare(`
		SELECT
			${groupExpr}                                                    AS date,
			COALESCE(SUM(sent_estimated_input_tokens), 0)                   AS sentTokens,
			COALESCE(SUM(provider_context_cleared_input_tokens), 0)         AS clearedTokens,
			COALESCE(SUM(input_tokens), 0)                                  AS processedTokens,
			COUNT(*)                                                        AS requests,
			ROUND(100.0 * COALESCE(SUM(provider_context_cleared_input_tokens), 0) /
			      NULLIF(COALESCE(SUM(sent_estimated_input_tokens), 0), 0), 1) AS clearancePercent
		FROM llm_requests
		${statusClause}
		GROUP BY ${groupExpr}
		ORDER BY date ASC
	`).all(params) as Array<Record<string, number | string | null>>;

	return json({
		granularity,
		points: rows.map((r) => ({
			date: r.date as string,
			sentTokens: Number(r.sentTokens),
			clearedTokens: Number(r.clearedTokens),
			processedTokens: Number(r.processedTokens),
			requests: Number(r.requests),
			clearancePercent: r.clearancePercent ? Number(r.clearancePercent) : 0
		}))
	});
};
