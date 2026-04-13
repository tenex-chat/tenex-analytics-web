// GET /api/export/conversations — flat tabulated export of per-conversation aggregate data
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database.js';
import { buildAnthropicRequestCostSql } from '$lib/server/anthropic-pricing.js';

function hasTable(name: string): boolean {
	try {
		const db = getDb();
		const row = db
			.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
			.get(name);
		return row !== undefined;
	} catch {
		return false;
	}
}

const COLUMNS = [
	'conversation_id',
	'project',
	'agent',
	'started_at',
	'ended_at',
	'duration_seconds',
	'request_count',
	'total_input_tokens',
	'total_output_tokens',
	'total_cache_read_tokens',
	'total_cache_write_tokens',
	'total_tokens',
	'total_cost_usd',
	'avg_tokens_per_request',
	'max_tokens_single_request',
	'total_tool_calls',
	'tool_uses_stripped',
	'had_context_pressure',
	'message_count'
];

type Row = Record<string, string | number>;

function toTsv(rows: Row[]): string {
	const header = COLUMNS.join('\t');
	const lines = rows.map((r) =>
		COLUMNS.map((c) => {
			const val = r[c] ?? '';
			return String(val).replace(/\t/g, ' ').replace(/\n/g, ' ');
		}).join('\t')
	);
	return [header, ...lines].join('\n');
}

function toCsv(rows: Row[]): string {
	const escape = (v: string | number) => {
		const s = String(v ?? '');
		return s.includes(',') || s.includes('"') || s.includes('\n')
			? `"${s.replace(/"/g, '""')}"`
			: s;
	};
	const header = COLUMNS.map(escape).join(',');
	const lines = rows.map((r) => COLUMNS.map((c) => escape(r[c] ?? '')).join(','));
	return [header, ...lines].join('\n');
}

export const GET: RequestHandler = ({ url }) => {
	const format = url.searchParams.get('format') ?? 'tsv';
	const project = url.searchParams.get('project');
	const agent = url.searchParams.get('agent');
	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');
	const limitParam = Math.min(parseInt(url.searchParams.get('limit') ?? '500', 10) || 500, 5000);

	if (!hasTable('llm_requests')) {
		return respondEmpty(format);
	}

	try {
		const db = getDb();
		const conditions: string[] = ["r.status = 'success'"];
		const params: Record<string, string | number> = {};

		if (project) {
			conditions.push('r.project_id = @project');
			params.project = project;
		}
		if (agent) {
			conditions.push('r.agent_slug = @agent');
			params.agent = agent;
		}
		if (from) {
			conditions.push('r.started_at_ms >= @from');
			params.from = new Date(from).getTime();
		}
		if (to) {
			const toDate = new Date(to);
			toDate.setHours(23, 59, 59, 999);
			conditions.push('r.started_at_ms <= @to');
			params.to = toDate.getTime();
		}

		const whereClause = `WHERE ${conditions.join(' AND ')}`;

		const hasCme = hasTable('context_management_events');
		const hasMsg = hasTable('llm_request_messages');

		// Build the main aggregation query from llm_requests
		const baseRows = db
			.prepare(
				`
			SELECT
				COALESCE(r.conversation_id, 'unknown') AS conversation_id,
				COALESCE(r.project_id, 'unknown') AS project,
				COALESCE(r.agent_slug, 'unknown') AS agent,
				MIN(r.started_at_ms) AS started_at_ms,
				MAX(r.started_at_ms) AS ended_at_ms,
				ROUND((MAX(r.started_at_ms) - MIN(r.started_at_ms)) / 1000.0, 1) AS duration_seconds,
				COUNT(*) AS request_count,
				COALESCE(SUM(r.input_tokens), 0) AS total_input_tokens,
				COALESCE(SUM(r.output_tokens), 0) AS total_output_tokens,
				COALESCE(SUM(r.input_cache_read_tokens), 0) AS total_cache_read_tokens,
				COALESCE(SUM(r.input_cache_write_tokens), 0) AS total_cache_write_tokens,
				COALESCE(SUM(r.total_tokens), 0) AS total_tokens,
				ROUND(COALESCE(SUM(${buildAnthropicRequestCostSql('r')}), 0), 6) AS total_cost_usd,
				ROUND(COALESCE(AVG(r.total_tokens), 0), 1) AS avg_tokens_per_request,
				COALESCE(MAX(r.total_tokens), 0) AS max_tokens_single_request
			FROM llm_requests r
			${whereClause}
			GROUP BY r.conversation_id
			ORDER BY started_at_ms DESC
			LIMIT @limit
		`
			)
			.all({ ...params, limit: limitParam }) as Array<Record<string, unknown>>;

		// Fetch context management data if table exists
		const cmeMap = new Map<string, { tool_uses_stripped: number; had_context_pressure: number }>();
		if (hasCme) {
			const cmeRows = db
				.prepare(
					`
				SELECT
					COALESCE(conversation_id, 'unknown') AS conversation_id,
					COALESCE(SUM(removed_tool_exchanges_total), 0) AS tool_uses_stripped,
					1 AS had_context_pressure
				FROM context_management_events
				GROUP BY conversation_id
			`
				)
				.all() as Array<Record<string, unknown>>;
			for (const c of cmeRows) {
				cmeMap.set(c.conversation_id as string, {
					tool_uses_stripped: Number(c.tool_uses_stripped),
					had_context_pressure: 1
				});
			}
		}

		// Fetch tool call counts from llm_request_messages if table exists
		const toolCallMap = new Map<string, { total_tool_calls: number; message_count: number }>();
		if (hasMsg) {
			const toolRows = db
				.prepare(
					`
				SELECT
					COALESCE(r.conversation_id, 'unknown') AS conversation_id,
					SUM(CASE WHEN m.role = 'assistant' AND m.classification = 'tool_call' THEN 1 ELSE 0 END) AS total_tool_calls,
					COUNT(*) AS message_count
				FROM llm_request_messages m
				JOIN llm_requests r ON m.request_id = r.request_id
				GROUP BY r.conversation_id
			`
				)
				.all() as Array<Record<string, unknown>>;
			for (const t of toolRows) {
				toolCallMap.set(t.conversation_id as string, {
					total_tool_calls: Number(t.total_tool_calls),
					message_count: Number(t.message_count)
				});
			}
		}

		const rows: Row[] = baseRows.map((r) => {
			const convId = r.conversation_id as string;
			const cme = cmeMap.get(convId);
			const tc = toolCallMap.get(convId);
			return {
				conversation_id: convId,
				project: r.project as string,
				agent: r.agent as string,
				started_at: new Date(Number(r.started_at_ms)).toISOString(),
				ended_at: new Date(Number(r.ended_at_ms)).toISOString(),
				duration_seconds: Number(r.duration_seconds),
				request_count: Number(r.request_count),
				total_input_tokens: Number(r.total_input_tokens),
				total_output_tokens: Number(r.total_output_tokens),
				total_cache_read_tokens: Number(r.total_cache_read_tokens),
				total_cache_write_tokens: Number(r.total_cache_write_tokens),
				total_tokens: Number(r.total_tokens),
				total_cost_usd: Number(r.total_cost_usd),
				avg_tokens_per_request: Number(r.avg_tokens_per_request),
				max_tokens_single_request: Number(r.max_tokens_single_request),
				total_tool_calls: tc?.total_tool_calls ?? 0,
				tool_uses_stripped: cme?.tool_uses_stripped ?? 0,
				had_context_pressure: cme?.had_context_pressure ?? 0,
				message_count: tc?.message_count ?? 0
			};
		});

		const exportedAt = new Date().toISOString();
		const comment =
			`# TENEX Analytics — Conversation Export\n` +
			`# Exported: ${exportedAt}\n` +
			`# Rows: ${rows.length} (limit: ${limitParam})\n` +
			`# Filters: project=${project ?? 'all'} agent=${agent ?? 'all'} from=${from ?? 'all'} to=${to ?? 'all'}\n` +
			`# Each row is one conversation aggregated across all LLM requests within it.\n`;

		if (format === 'json') {
			return new Response(JSON.stringify({ exportedAt, rows }, null, 2), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const body = format === 'csv' ? toCsv(rows) : toTsv(rows);
		const ext = format === 'csv' ? 'csv' : 'tsv';
		const mime = format === 'csv' ? 'text/csv' : 'text/tab-separated-values';

		return new Response(comment + body, {
			headers: {
				'Content-Type': `${mime}; charset=utf-8`,
				'Content-Disposition': `attachment; filename="conversations-export.${ext}"`
			}
		});
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return new Response(`# Error: ${msg}\n`, {
			status: 500,
			headers: { 'Content-Type': 'text/plain' }
		});
	}
};

function respondEmpty(format: string): Response {
	if (format === 'json') {
		return new Response(
			JSON.stringify({ exportedAt: new Date().toISOString(), rows: [] }, null, 2),
			{
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
	const ext = format === 'csv' ? 'csv' : 'tsv';
	const mime = format === 'csv' ? 'text/csv' : 'text/tab-separated-values';
	const header = COLUMNS.join(format === 'csv' ? ',' : '\t');
	return new Response(`# No data available\n${header}\n`, {
		headers: {
			'Content-Type': `${mime}; charset=utf-8`,
			'Content-Disposition': `attachment; filename="conversations-export.${ext}"`
		}
	});
}
