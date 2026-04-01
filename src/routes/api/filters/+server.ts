// GET /api/filters — distinct filter values from llm_requests
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

const empty = { projects: [], agents: [], providers: [], models: [] };

export const GET: RequestHandler = () => {
	if (!hasTable('llm_requests')) return json(empty);

	try {
		const db = getDb();

		const projects = (db.prepare(
			`SELECT DISTINCT project_id AS value FROM llm_requests WHERE project_id IS NOT NULL ORDER BY project_id`
		).all() as Record<string, unknown>[]).map((r) => r.value as string);

		const agents = (db.prepare(
			`SELECT DISTINCT agent_slug AS value FROM llm_requests WHERE agent_slug IS NOT NULL ORDER BY agent_slug`
		).all() as Record<string, unknown>[]).map((r) => r.value as string);

		const providers = (db.prepare(
			`SELECT DISTINCT provider AS value FROM llm_requests WHERE provider IS NOT NULL ORDER BY provider`
		).all() as Record<string, unknown>[]).map((r) => r.value as string);

		const models = (db.prepare(
			`SELECT DISTINCT model AS value FROM llm_requests WHERE model IS NOT NULL ORDER BY model`
		).all() as Record<string, unknown>[]).map((r) => r.value as string);

		return json({ projects, agents, providers, models });
	} catch {
		return json(empty);
	}
};
