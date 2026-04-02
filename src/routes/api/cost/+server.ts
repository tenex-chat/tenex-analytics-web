// GET /api/cost — cost breakdown by model, agent, and over time
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

const empty = { trends: [], byModel: [], byAgent: [], byApiKey: [] };

export const GET: RequestHandler = ({ url }) => {
	if (!hasTable('llm_requests')) return json(empty);

	try {
		const db = getDb();
		const range = parseDateRange(url);
		const { clause, params: dateParams } = buildDateFilter(range);
		const { conditions: entityConditions, params: entityParams } = buildEntityFilter(
			parseEntityFilters(url)
		);
		const params = { ...dateParams, ...entityParams };
		const allConditions = ["status = 'success'", ...entityConditions];
		const clause_ = clause
			? clause + ' AND ' + allConditions.join(' AND ')
			: 'WHERE ' + allConditions.join(' AND ');

		const trends = (db.prepare(`
			SELECT
				date(started_at_ms/1000, 'unixepoch') AS date,
				COALESCE(SUM(cost_usd), 0) AS totalCost
			FROM llm_requests
			${clause_}
			GROUP BY date
			ORDER BY date ASC
		`).all(params) as Record<string, unknown>[]).map((r) => ({ date: r.date as string, totalCost: Number(r.totalCost) }));

		const byModel = (db.prepare(`
			SELECT
				COALESCE(model, 'unknown') AS model,
				COALESCE(SUM(cost_usd), 0) AS totalCost
			FROM llm_requests
			${clause_}
			GROUP BY model
			ORDER BY totalCost DESC
		`).all(params) as Record<string, unknown>[]).map((r) => ({ model: r.model as string, totalCost: Number(r.totalCost) }));

		const byAgent = (db.prepare(`
			SELECT
				COALESCE(agent_slug, 'unknown') AS agentSlug,
				COALESCE(SUM(cost_usd), 0) AS totalCost
			FROM llm_requests
			${clause_}
			GROUP BY agent_slug
			ORDER BY totalCost DESC
		`).all(params) as Record<string, unknown>[]).map((r) => ({ agentSlug: r.agentSlug as string, totalCost: Number(r.totalCost) }));

		const byApiKey = (db.prepare(`
			SELECT
				COALESCE(api_key_identity, 'unknown') AS apiKeyIdentity,
				COALESCE(SUM(cost_usd), 0) AS totalCost
			FROM llm_requests
			${clause_}
			GROUP BY api_key_identity
			ORDER BY totalCost DESC
		`).all(params) as Record<string, unknown>[]).map((r) => ({ apiKeyIdentity: r.apiKeyIdentity as string, totalCost: Number(r.totalCost) }));

		return json({ trends, byModel, byAgent, byApiKey });
	} catch {
		return json(empty);
	}
};
