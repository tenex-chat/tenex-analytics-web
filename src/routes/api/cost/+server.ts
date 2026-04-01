// GET /api/cost — cost breakdown by model, agent, and over time
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database.js';

function hasTable(name: string): boolean {
	try {
		const db = getDb();
		const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name);
		return row !== undefined;
	} catch {
		return false;
	}
}

function buildMsFilter(url: URL): { clause: string; params: Record<string, number> } {
	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');
	const conditions: string[] = ["status = 'success'"];
	const params: Record<string, number> = {};
	if (from) {
		conditions.push('started_at_ms >= @from');
		params.from = new Date(from).getTime();
	}
	if (to) {
		const toDate = new Date(to);
		toDate.setHours(23, 59, 59, 999);
		conditions.push('started_at_ms <= @to');
		params.to = toDate.getTime();
	}
	return { clause: `WHERE ${conditions.join(' AND ')}`, params };
}

const empty = { trends: [], byModel: [], byAgent: [] };

export const GET: RequestHandler = ({ url }) => {
	if (!hasTable('llm_requests')) return json(empty);

	try {
		const db = getDb();
		const { clause, params } = buildMsFilter(url);

		const trends = (db.prepare(`
			SELECT
				date(started_at_ms/1000, 'unixepoch') AS date,
				COALESCE(SUM(cost_usd), 0) AS totalCost
			FROM llm_requests
			${clause}
			GROUP BY date
			ORDER BY date ASC
		`).all(params) as Record<string, unknown>[]).map((r) => ({ date: r.date as string, totalCost: Number(r.totalCost) }));

		const byModel = (db.prepare(`
			SELECT
				COALESCE(model, 'unknown') AS model,
				COALESCE(SUM(cost_usd), 0) AS totalCost
			FROM llm_requests
			${clause}
			GROUP BY model
			ORDER BY totalCost DESC
		`).all(params) as Record<string, unknown>[]).map((r) => ({ model: r.model as string, totalCost: Number(r.totalCost) }));

		const byAgent = (db.prepare(`
			SELECT
				COALESCE(agent_slug, 'unknown') AS agentSlug,
				COALESCE(SUM(cost_usd), 0) AS totalCost
			FROM llm_requests
			${clause}
			GROUP BY agent_slug
			ORDER BY totalCost DESC
		`).all(params) as Record<string, unknown>[]).map((r) => ({ agentSlug: r.agentSlug as string, totalCost: Number(r.totalCost) }));

		return json({ trends, byModel, byAgent });
	} catch {
		return json(empty);
	}
};
