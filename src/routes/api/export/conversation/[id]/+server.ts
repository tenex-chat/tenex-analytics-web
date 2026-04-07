// GET /api/export/conversation/[id] — per-request trajectory export for a single conversation
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database.js';

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
	'request_index',
	'timestamp',
	'model',
	'input_tokens',
	'output_tokens',
	'cache_read_tokens',
	'cache_write_tokens',
	'total_tokens',
	'cost_usd',
	'message_count',
	'tool_calls_count',
	'tool_uses_stripped_delta',
	'cumulative_tokens'
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

export const GET: RequestHandler = ({ params, url }) => {
	const conversationId = params.id;
	const format = url.searchParams.get('format') ?? 'tsv';

	if (!hasTable('llm_requests')) {
		throw error(404, 'No data available');
	}

	try {
		const db = getDb();

		// Verify the conversation exists
		const exists = db
			.prepare(
				`SELECT 1 FROM llm_requests WHERE conversation_id = @conversationId AND status = 'success' LIMIT 1`
			)
			.get({ conversationId });

		if (!exists) {
			throw error(404, `Conversation not found: ${conversationId}`);
		}

		const requestRows = db
			.prepare(
				`
			SELECT
				ROW_NUMBER() OVER (ORDER BY started_at_ms ASC) AS request_index,
				started_at_ms,
				COALESCE(model, 'unknown') AS model,
				COALESCE(input_tokens, 0) AS input_tokens,
				COALESCE(output_tokens, 0) AS output_tokens,
				COALESCE(input_cache_read_tokens, 0) AS cache_read_tokens,
				COALESCE(input_cache_write_tokens, 0) AS cache_write_tokens,
				COALESCE(total_tokens, 0) AS total_tokens,
				ROUND(COALESCE(cost_usd, 0), 6) AS cost_usd,
				request_id
			FROM llm_requests
			WHERE conversation_id = @conversationId AND status = 'success'
			ORDER BY started_at_ms ASC
		`
			)
			.all({ conversationId }) as Array<Record<string, unknown>>;

		const hasMsg = hasTable('llm_request_messages');
		const hasCme = hasTable('context_management_events');

		// Per-request message and tool-call counts
		const msgMap = new Map<string, { message_count: number; tool_calls_count: number }>();
		if (hasMsg) {
			const msgRows = db
				.prepare(
					`
				SELECT
					request_id,
					COUNT(*) AS message_count,
					SUM(CASE WHEN role = 'assistant' AND classification = 'tool_call' THEN 1 ELSE 0 END) AS tool_calls_count
				FROM llm_request_messages
				WHERE request_id IN (
					SELECT request_id FROM llm_requests
					WHERE conversation_id = @conversationId AND status = 'success'
				)
				GROUP BY request_id
			`
				)
				.all({ conversationId }) as Array<Record<string, unknown>>;
			for (const m of msgRows) {
				msgMap.set(m.request_id as string, {
					message_count: Number(m.message_count),
					tool_calls_count: Number(m.tool_calls_count)
				});
			}
		}

		// Context management events per-request (tool_uses_stripped_delta)
		// context_management_events doesn't have request_id directly; we match by conversation_id
		// and approximate by ordering events chronologically alongside requests.
		// Instead we sum removed_tool_exchanges_total per conversation event that falls between
		// this request's started_at_ms and the next request's started_at_ms.
		const cmeByWindow = new Map<string, number>();
		if (hasCme) {
			// Fetch all cme events for this conversation ordered by time
			const cmeRows = db
				.prepare(
					`
				SELECT
					COALESCE(removed_tool_exchanges_total, 0) AS stripped,
					created_at_ms
				FROM context_management_events
				WHERE conversation_id = @conversationId
				ORDER BY created_at_ms ASC
			`
				)
				.all({ conversationId }) as Array<Record<string, unknown>>;

			if (cmeRows.length > 0) {
				// Assign each CME event's stripped count to the nearest preceding request
				const reqTimes = requestRows.map((r) => ({
					id: r.request_id as string,
					ms: Number(r.started_at_ms)
				}));

				for (const cme of cmeRows) {
					const cmeMs = Number(cme.created_at_ms);
					// Find the latest request that started before this CME event
					let best = reqTimes[0];
					for (const req of reqTimes) {
						if (req.ms <= cmeMs) best = req;
						else break;
					}
					cmeByWindow.set(best.id, (cmeByWindow.get(best.id) ?? 0) + Number(cme.stripped));
				}
			}
		}

		let cumulative = 0;
		const rows: Row[] = requestRows.map((r) => {
			const reqId = r.request_id as string;
			const tokens = Number(r.total_tokens);
			cumulative += tokens;
			const msg = msgMap.get(reqId);
			return {
				request_index: Number(r.request_index),
				timestamp: new Date(Number(r.started_at_ms)).toISOString(),
				model: r.model as string,
				input_tokens: Number(r.input_tokens),
				output_tokens: Number(r.output_tokens),
				cache_read_tokens: Number(r.cache_read_tokens),
				cache_write_tokens: Number(r.cache_write_tokens),
				total_tokens: tokens,
				cost_usd: Number(r.cost_usd),
				message_count: msg?.message_count ?? 0,
				tool_calls_count: msg?.tool_calls_count ?? 0,
				tool_uses_stripped_delta: cmeByWindow.get(reqId) ?? 0,
				cumulative_tokens: cumulative
			};
		});

		const exportedAt = new Date().toISOString();
		const totalCost = rows.reduce((s, r) => s + Number(r.cost_usd), 0).toFixed(6);
		const comment =
			`# TENEX Analytics — Single Conversation Export\n` +
			`# Conversation: ${conversationId}\n` +
			`# Exported: ${exportedAt}\n` +
			`# Requests: ${rows.length}\n` +
			`# Total tokens: ${cumulative} | Total cost: $${totalCost}\n` +
			`# Each row is one LLM request; cumulative_tokens is a running total.\n` +
			`# tool_uses_stripped_delta: tool exchanges removed by context management at/after this request.\n`;

		if (format === 'json') {
			return new Response(
				JSON.stringify({ exportedAt, conversationId, totalTokens: cumulative, rows }, null, 2),
				{ headers: { 'Content-Type': 'application/json' } }
			);
		}

		const body = format === 'csv' ? toCsv(rows) : toTsv(rows);
		const ext = format === 'csv' ? 'csv' : 'tsv';
		const mime = format === 'csv' ? 'text/csv' : 'text/tab-separated-values';
		const filename = `conversation-${conversationId.slice(0, 12)}-export.${ext}`;

		return new Response(comment + body, {
			headers: {
				'Content-Type': `${mime}; charset=utf-8`,
				'Content-Disposition': `attachment; filename="${filename}"`
			}
		});
	} catch (err) {
		// Re-throw SvelteKit errors (404 etc.)
		if (err && typeof err === 'object' && 'status' in err) throw err;
		const msg = err instanceof Error ? err.message : String(err);
		return new Response(`# Error: ${msg}\n`, {
			status: 500,
			headers: { 'Content-Type': 'text/plain' }
		});
	}
};
