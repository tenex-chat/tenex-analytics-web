// GET /api/context-windows — context window utilization from context_management_events
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
	const conditions: string[] = [];
	const params: Record<string, number> = {};
	if (from) {
		conditions.push('created_at_ms >= @from');
		params.from = new Date(from).getTime();
	}
	if (to) {
		const toDate = new Date(to);
		toDate.setHours(23, 59, 59, 999);
		conditions.push('created_at_ms <= @to');
		params.to = toDate.getTime();
	}
	return { clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

const empty = { events: [], byAgent: [] };

export const GET: RequestHandler = ({ url }) => {
	if (!hasTable('context_management_events')) return json(empty);

	try {
		const db = getDb();
		const { clause, params } = buildMsFilter(url);

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
			${clause}
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
			${clause}
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
