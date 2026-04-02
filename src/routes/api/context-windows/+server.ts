// GET /api/context-windows — context window utilization from context_management_events
// Supports ?from=YYYY-MM-DD&to=YYYY-MM-DD&model=...&agent=...&project=...&provider=...
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getDb,
	buildDateFilter,
	parseDateRange,
	parseEntityFilters,
	buildEntityFilter
} from '$lib/server/database.js';

function hasTable(name: string): boolean {
	try {
		const db = getDb();
		const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name);
		return row !== undefined;
	} catch {
		return false;
	}
}

const empty = { events: [], byAgent: [] };

export const GET: RequestHandler = ({ url }) => {
	if (!hasTable('context_management_events')) return json(empty);

	try {
		const db = getDb();
		// context_management_events uses created_at_ms column
		const range = parseDateRange(url);
		const { clause, params: dateParams } = buildDateFilter(range, 'created_at_ms');
		const { conditions: entityConditions, params: entityParams } = buildEntityFilter(
			parseEntityFilters(url),
			{ agent: 'agent_slug', model: 'model' }
		);
		const params = { ...dateParams, ...entityParams };
		const clause_ = entityConditions.length
			? clause
				? clause + ' AND ' + entityConditions.join(' AND ')
				: 'WHERE ' + entityConditions.join(' AND ')
			: clause;

		const events = (db.prepare(`
			SELECT
				created_at_ms,
				COALESCE(agent_slug, 'unknown') AS agentSlug,
				COALESCE(model, 'unknown') AS model,
				COALESCE(estimated_tokens_before, 0) AS tokensBefore,
				COALESCE(estimated_tokens_after, 0) AS tokensAfter,
				COALESCE(utilization_percent, 0) AS utilization,
				COALESCE(strategy_name, 'unknown') AS strategy
			FROM context_management_events
			${clause_}
			ORDER BY created_at_ms DESC
			LIMIT 500
		`).all(params) as Record<string, unknown>[]).map((r) => ({
			timestamp: new Date(Number(r.created_at_ms)).toISOString(),
			agentSlug: r.agentSlug as string,
			model: r.model as string,
			tokensBefore: Number(r.tokensBefore),
			tokensAfter: Number(r.tokensAfter),
			utilization: Math.round(Number(r.utilization) * 100) / 100,
			strategy: r.strategy as string
		}));

		const byAgent = (db.prepare(`
			SELECT
				COALESCE(agent_slug, 'unknown') AS agentSlug,
				ROUND(AVG(utilization_percent), 2) AS avgUtilization,
				ROUND(MAX(utilization_percent), 2) AS maxUtilization,
				COUNT(*) AS pruneCount
			FROM context_management_events
			${clause_}
			GROUP BY agent_slug
			ORDER BY maxUtilization DESC
		`).all(params) as Record<string, unknown>[]).map((r) => ({
			agentSlug: r.agentSlug as string,
			avgUtilization: Number(r.avgUtilization),
			maxUtilization: Number(r.maxUtilization),
			pruneCount: Number(r.pruneCount)
		}));

		return json({ events, byAgent });
	} catch {
		return json(empty);
	}
};
