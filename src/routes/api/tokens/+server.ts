// GET /api/tokens — token usage trends over time
// Supports ?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=hour|day|week&model=...&agent=...&project=...&provider=...

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getDb,
	buildRequestFilter,
	parseRequestFilters,
	hasTelemetryTable
} from '$lib/server/database.js';

type SqlMetricRow = Record<string, number | string | null>;

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

function mapMetricRow(row: SqlMetricRow) {
	return {
		inputTokens: Number(row.inputTokens ?? 0),
		outputTokens: Number(row.outputTokens ?? 0),
		cacheReadTokens: Number(row.cacheReadTokens ?? 0),
		cacheWriteTokens: Number(row.cacheWriteTokens ?? 0),
		totalTokens: Number(row.totalTokens ?? 0),
		requests: Number(row.requests ?? 0)
	};
}

function mapBreakdownRow(row: SqlMetricRow, key: string, overallTotalTokens: number) {
	const metrics = mapMetricRow(row);
	return {
		key: String(row[key] ?? '(none)'),
		...metrics,
		avgTokensPerRequest:
			metrics.requests > 0 ? Math.round(metrics.totalTokens / metrics.requests) : 0,
		sharePercent:
			overallTotalTokens > 0
				? Math.round((metrics.totalTokens / overallTotalTokens) * 1000) / 10
				: 0
	};
}

function round1(value: number): number {
	return Math.round(value * 10) / 10;
}

function buildInClause(values: string[], prefix: string) {
	const params: Record<string, string> = {};
	const placeholders = values.map((value, index) => {
		const key = `${prefix}${index}`;
		params[key] = value;
		return `@${key}`;
	});
	return {
		clause: placeholders.join(', '),
		params
	};
}

function severityForScore(score: number): 'high' | 'medium' | 'low' {
	if (score >= 8) return 'high';
	if (score >= 5) return 'medium';
	return 'low';
}

export const GET: RequestHandler = ({ url }) => {
	if (!hasTelemetryTable()) {
		return json({
			granularity: 'day',
			points: [],
			breakdown: {
				projects: [],
				agents: [],
				apiKeys: [],
				conversations: [],
				runaways: []
			}
		});
	}

	const filters = parseRequestFilters(url);
	const granularity = (url.searchParams.get('granularity') ?? 'day') as 'hour' | 'day' | 'week';
	const { clause, params } = buildRequestFilter(filters);
	const db = getDb();

	const groupExpr =
		granularity === 'hour'
			? "strftime('%Y-%m-%dT%H:00:00', started_at_ms/1000, 'unixepoch')"
			: granularity === 'week'
				? "strftime('%Y-W%W', started_at_ms/1000, 'unixepoch')"
				: "date(started_at_ms/1000, 'unixepoch')";

	const pointsRows = db
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
		${clause}
		GROUP BY ${groupExpr}
		ORDER BY date ASC
	`
		)
		.all(params) as SqlMetricRow[];

	const points = pointsRows.map((row) => ({
		date: String(row.date),
		...mapMetricRow(row)
	}));

	const overallTotalTokens = points.reduce((sum, point) => sum + point.totalTokens, 0);

	const breakdownSelect = `
		COALESCE(SUM(input_tokens), 0)            AS inputTokens,
		COALESCE(SUM(output_tokens), 0)           AS outputTokens,
		COALESCE(SUM(input_cache_read_tokens), 0) AS cacheReadTokens,
		COALESCE(SUM(input_cache_write_tokens), 0) AS cacheWriteTokens,
		COALESCE(SUM(total_tokens), 0)            AS totalTokens,
		COUNT(*)                                  AS requests
	`;

	const projects = (
		db
			.prepare(
				`
			SELECT
				COALESCE(project_id, '(none)') AS project,
				${breakdownSelect}
			FROM llm_requests
			${clause}
			GROUP BY COALESCE(project_id, '(none)')
			ORDER BY totalTokens DESC, project ASC
		`
			)
			.all(params) as SqlMetricRow[]
	).map((row) => mapBreakdownRow(row, 'project', overallTotalTokens));

	const agents = (
		db
			.prepare(
				`
			SELECT
				COALESCE(agent_slug, '(none)') AS agent,
				${breakdownSelect}
			FROM llm_requests
			${clause}
			GROUP BY COALESCE(agent_slug, '(none)')
			ORDER BY totalTokens DESC, agent ASC
		`
			)
			.all(params) as SqlMetricRow[]
	).map((row) => mapBreakdownRow(row, 'agent', overallTotalTokens));

	const apiKeys = (
		db
			.prepare(
				`
			SELECT
				COALESCE(api_key_identity, '(none)') AS apiKey,
				${breakdownSelect}
			FROM llm_requests
			${clause}
			GROUP BY COALESCE(api_key_identity, '(none)')
			ORDER BY totalTokens DESC, apiKey ASC
		`
			)
			.all(params) as SqlMetricRow[]
	).map((row) => mapBreakdownRow(row, 'apiKey', overallTotalTokens));

	const conversations = (
		db
			.prepare(
				`
			SELECT
				COALESCE(conversation_id, 'unknown') AS conversationId,
				CASE
					WHEN COUNT(DISTINCT COALESCE(project_id, '(none)')) = 1 THEN COALESCE(MAX(project_id), '(none)')
					ELSE '(multiple)'
				END AS projectId,
				CASE
					WHEN COUNT(DISTINCT COALESCE(agent_slug, '(none)')) = 1 THEN COALESCE(MAX(agent_slug), '(none)')
					ELSE '(multiple)'
				END AS agentSlug,
				CASE
					WHEN COUNT(DISTINCT COALESCE(api_key_identity, '(none)')) = 1 THEN COALESCE(MAX(api_key_identity), '(none)')
					ELSE '(multiple)'
				END AS apiKeyIdentity,
				${breakdownSelect},
				MIN(started_at_ms) AS firstTimestampMs,
				MAX(started_at_ms) AS lastTimestampMs
			FROM llm_requests
			${clause}
			GROUP BY COALESCE(conversation_id, 'unknown')
			ORDER BY totalTokens DESC, lastTimestampMs DESC
			LIMIT 50
		`
			)
			.all(params) as SqlMetricRow[]
	).map((row) => {
		const metrics = mapMetricRow(row);
		return {
			conversationId: String(row.conversationId ?? 'unknown'),
			projectId: String(row.projectId ?? '(none)'),
			agentSlug: String(row.agentSlug ?? '(none)'),
			apiKeyIdentity: String(row.apiKeyIdentity ?? '(none)'),
			...metrics,
			avgTokensPerRequest:
				metrics.requests > 0 ? Math.round(metrics.totalTokens / metrics.requests) : 0,
			sharePercent:
				overallTotalTokens > 0
					? Math.round((metrics.totalTokens / overallTotalTokens) * 1000) / 10
					: 0,
			firstTimestamp:
				row.firstTimestampMs !== null ? new Date(Number(row.firstTimestampMs)).toISOString() : null,
			lastTimestamp:
				row.lastTimestampMs !== null ? new Date(Number(row.lastTimestampMs)).toISOString() : null
		};
	});

	type ConversationRuntimeStats = {
		toolCalls: number;
		toolResults: number;
		contextEvents: number;
		maxInputTokens: number;
		minPositiveInputTokens: number;
		topFsReadPath: string | null;
		topFsReadCount: number;
		topShellCommand: string | null;
		topShellCommandCount: number;
	};

	const runtimeByConversation = new Map<string, ConversationRuntimeStats>();
	const analyzedConversationIds = conversations.map((conversation) => conversation.conversationId);

	if (analyzedConversationIds.length > 0) {
		const { clause: conversationInClause, params: conversationParams } = buildInClause(
			analyzedConversationIds,
			'conversationId'
		);

		for (const conversationId of analyzedConversationIds) {
			runtimeByConversation.set(conversationId, {
				toolCalls: 0,
				toolResults: 0,
				contextEvents: 0,
				maxInputTokens: 0,
				minPositiveInputTokens: 0,
				topFsReadPath: null,
				topFsReadCount: 0,
				topShellCommand: null,
				topShellCommandCount: 0
			});
		}

		const requestRuntimeRows = db
			.prepare(
				`
			SELECT
				COALESCE(conversation_id, 'unknown') AS conversationId,
				MAX(COALESCE(input_tokens, 0)) AS maxInputTokens,
				MIN(NULLIF(COALESCE(input_tokens, 0), 0)) AS minPositiveInputTokens
			FROM llm_requests
			WHERE COALESCE(conversation_id, 'unknown') IN (${conversationInClause})
			GROUP BY COALESCE(conversation_id, 'unknown')
		`
			)
			.all(conversationParams) as SqlMetricRow[];

		for (const row of requestRuntimeRows) {
			const entry = runtimeByConversation.get(String(row.conversationId));
			if (!entry) continue;
			entry.maxInputTokens = Number(row.maxInputTokens ?? 0);
			entry.minPositiveInputTokens = Number(row.minPositiveInputTokens ?? 0);
		}

		if (hasTable('llm_request_messages')) {
			const toolCountRows = db
				.prepare(
					`
				SELECT
					COALESCE(r.conversation_id, 'unknown') AS conversationId,
					SUM(CASE WHEN m.classification = 'tool-call' THEN 1 ELSE 0 END) AS toolCalls,
					SUM(CASE WHEN m.classification = 'tool-result' THEN 1 ELSE 0 END) AS toolResults
				FROM llm_request_messages m
				JOIN llm_requests r ON r.request_id = m.request_id
				WHERE COALESCE(r.conversation_id, 'unknown') IN (${conversationInClause})
				GROUP BY COALESCE(r.conversation_id, 'unknown')
			`
				)
				.all(conversationParams) as SqlMetricRow[];

			for (const row of toolCountRows) {
				const entry = runtimeByConversation.get(String(row.conversationId));
				if (!entry) continue;
				entry.toolCalls = Number(row.toolCalls ?? 0);
				entry.toolResults = Number(row.toolResults ?? 0);
			}

			const fsReadRows = db
				.prepare(
					`
				WITH fs_reads AS (
					SELECT
						COALESCE(r.conversation_id, 'unknown') AS conversationId,
						CASE
							WHEN instr(m.preview, '"path":"') > 0
								THEN substr(
									m.preview,
									instr(m.preview, '"path":"') + 8,
									instr(substr(m.preview, instr(m.preview, '"path":"') + 8), '"') - 1
								)
							ELSE '(unknown)'
						END AS path,
						COUNT(*) AS readCount
					FROM llm_request_messages m
					JOIN llm_requests r ON r.request_id = m.request_id
					WHERE COALESCE(r.conversation_id, 'unknown') IN (${conversationInClause})
						AND m.classification = 'tool-call'
						AND m.preview LIKE '%"toolName":"fs_read"%'
					GROUP BY COALESCE(r.conversation_id, 'unknown'), path
				),
				ranked AS (
					SELECT
						*,
						ROW_NUMBER() OVER (PARTITION BY conversationId ORDER BY readCount DESC, path ASC) AS rank
					FROM fs_reads
				)
				SELECT conversationId, path, readCount
				FROM ranked
				WHERE rank = 1
			`
				)
				.all(conversationParams) as SqlMetricRow[];

			for (const row of fsReadRows) {
				const entry = runtimeByConversation.get(String(row.conversationId));
				if (!entry) continue;
				entry.topFsReadPath = String(row.path ?? '(unknown)');
				entry.topFsReadCount = Number(row.readCount ?? 0);
			}

			const shellRows = db
				.prepare(
					`
				WITH shell_cmds AS (
					SELECT
						COALESCE(r.conversation_id, 'unknown') AS conversationId,
						CASE
							WHEN instr(m.preview, '"command":"') > 0
								THEN substr(
									m.preview,
									instr(m.preview, '"command":"') + 11,
									instr(substr(m.preview, instr(m.preview, '"command":"') + 11), '"') - 1
								)
							ELSE '(unknown)'
						END AS command,
						COUNT(*) AS commandCount
					FROM llm_request_messages m
					JOIN llm_requests r ON r.request_id = m.request_id
					WHERE COALESCE(r.conversation_id, 'unknown') IN (${conversationInClause})
						AND m.classification = 'tool-call'
						AND m.preview LIKE '%"toolName":"shell"%'
					GROUP BY COALESCE(r.conversation_id, 'unknown'), command
				),
				ranked AS (
					SELECT
						*,
						ROW_NUMBER() OVER (
							PARTITION BY conversationId
							ORDER BY commandCount DESC, command ASC
						) AS rank
					FROM shell_cmds
				)
				SELECT conversationId, command, commandCount
				FROM ranked
				WHERE rank = 1
			`
				)
				.all(conversationParams) as SqlMetricRow[];

			for (const row of shellRows) {
				const entry = runtimeByConversation.get(String(row.conversationId));
				if (!entry) continue;
				entry.topShellCommand = String(row.command ?? '(unknown)');
				entry.topShellCommandCount = Number(row.commandCount ?? 0);
			}
		}

		if (hasTable('context_management_events')) {
			const contextRows = db
				.prepare(
					`
				SELECT
					COALESCE(r.conversation_id, 'unknown') AS conversationId,
					COUNT(*) AS contextEvents
				FROM context_management_events c
				JOIN llm_requests r ON r.request_id = c.request_id
				WHERE COALESCE(r.conversation_id, 'unknown') IN (${conversationInClause})
				GROUP BY COALESCE(r.conversation_id, 'unknown')
			`
				)
				.all(conversationParams) as SqlMetricRow[];

			for (const row of contextRows) {
				const entry = runtimeByConversation.get(String(row.conversationId));
				if (!entry) continue;
				entry.contextEvents = Number(row.contextEvents ?? 0);
			}
		}
	}

	const runaways = conversations
		.map((conversation) => {
			const runtime = runtimeByConversation.get(conversation.conversationId);
			const firstTimestampMs = conversation.firstTimestamp
				? new Date(conversation.firstTimestamp).getTime()
				: conversation.lastTimestamp
					? new Date(conversation.lastTimestamp).getTime()
					: 0;
			const lastTimestampMs = conversation.lastTimestamp
				? new Date(conversation.lastTimestamp).getTime()
				: firstTimestampMs;
			const durationMinutes = Math.max((lastTimestampMs - firstTimestampMs) / 60000, 1);
			const requestsPerMinute = round1(conversation.requests / durationMinutes);
			const avgToolCallsPerRequest = round1(
				(runtime?.toolCalls ?? 0) / Math.max(conversation.requests, 1)
			);
			const avgToolResultsPerRequest = round1(
				(runtime?.toolResults ?? 0) / Math.max(conversation.requests, 1)
			);
			const contextEventsPerRequest = round1(
				(runtime?.contextEvents ?? 0) / Math.max(conversation.requests, 1)
			);
			const inputGrowthRatio =
				runtime && runtime.minPositiveInputTokens > 0
					? round1(runtime.maxInputTokens / runtime.minPositiveInputTokens)
					: 1;

			const flags: string[] = [];
			let suspiciousScore = 0;

			if (conversation.totalTokens >= 1_000_000) {
				suspiciousScore += 3;
				flags.push(`${formatInteger(conversation.totalTokens)} total tokens`);
			}
			if (requestsPerMinute >= 3) {
				suspiciousScore += 2;
				flags.push(`${requestsPerMinute.toFixed(1)} req/min`);
			}
			if (avgToolCallsPerRequest >= 8) {
				suspiciousScore += 2;
				flags.push(`${avgToolCallsPerRequest.toFixed(1)} tool calls/req`);
			}
			if (contextEventsPerRequest >= 1) {
				suspiciousScore += 2;
				flags.push(`${contextEventsPerRequest.toFixed(1)} ctx events/req`);
			}
			if (inputGrowthRatio >= 3) {
				suspiciousScore += 2;
				flags.push(`${inputGrowthRatio.toFixed(1)}x input growth`);
			}
			if ((runtime?.topFsReadCount ?? 0) >= 25) {
				suspiciousScore += 2;
				flags.push(`${formatInteger(runtime?.topFsReadCount ?? 0)} reads of same file`);
			}
			if ((runtime?.topShellCommandCount ?? 0) >= 10) {
				suspiciousScore += 2;
				flags.push(`${formatInteger(runtime?.topShellCommandCount ?? 0)} repeated shell cmds`);
			}

			return {
				...conversation,
				suspiciousScore,
				severity: severityForScore(suspiciousScore),
				requestsPerMinute,
				avgToolCallsPerRequest,
				avgToolResultsPerRequest,
				contextEventsPerRequest,
				inputGrowthRatio,
				repeatedFsReadMax: runtime?.topFsReadCount ?? 0,
				repeatedFsReadPath: runtime?.topFsReadPath ?? null,
				repeatedShellCommandMax: runtime?.topShellCommandCount ?? 0,
				repeatedShellCommand: runtime?.topShellCommand ?? null,
				flags
			};
		})
		.filter((conversation) => conversation.suspiciousScore >= 5)
		.sort((a, b) => {
			if (b.suspiciousScore !== a.suspiciousScore) return b.suspiciousScore - a.suspiciousScore;
			if (b.totalTokens !== a.totalTokens) return b.totalTokens - a.totalTokens;
			return b.requests - a.requests;
		})
		.slice(0, 10);

	return json({
		granularity,
		points,
		breakdown: {
			projects,
			agents,
			apiKeys,
			conversations: conversations.map(
				({ firstTimestamp: _firstTimestamp, ...conversation }) => conversation
			),
			runaways
		}
	});
};

function formatInteger(value: number): string {
	return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}
