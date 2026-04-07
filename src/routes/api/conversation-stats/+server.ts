// GET /api/conversation-stats — aggregate stats across all conversations
// Supports ?from=YYYY-MM-DD&to=YYYY-MM-DD&model=...&agent=...&project=...&provider=...

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

const EMPTY_RESPONSE = {
	summary: {
		totalConversations: 0,
		avgRequestsPerConversation: 0,
		avgTokensPerConversation: 0,
		avgCostPerConversation: 0,
		avgDurationSeconds: 0
	},
	lengthDistribution: [
		{ bucket: '1-2', count: 0 },
		{ bucket: '3-5', count: 0 },
		{ bucket: '6-10', count: 0 },
		{ bucket: '11-20', count: 0 },
		{ bucket: '20+', count: 0 }
	],
	tokenDistribution: [
		{ bucket: '0-10k', count: 0 },
		{ bucket: '10k-50k', count: 0 },
		{ bucket: '50k-200k', count: 0 },
		{ bucket: '200k-500k', count: 0 },
		{ bucket: '500k+', count: 0 }
	],
	costDistribution: [
		{ bucket: '$0-0.10', count: 0 },
		{ bucket: '$0.10-0.50', count: 0 },
		{ bucket: '$0.50-2', count: 0 },
		{ bucket: '$2+', count: 0 }
	],
	dailyNewConversations: [],
	weeklyAvgRequests: [],
	tokenGrowth: [],
	toolStripping: [
		{ label: 'With Tool Stripping', count: 0 },
		{ label: 'Without Tool Stripping', count: 0 }
	],
	contextPressure: [
		{ label: 'Had Context Events', count: 0 },
		{ label: 'No Context Events', count: 0 }
	],
	topExpensive: [],
	avgTokensPerRequestByPosition: [],
	tokenBreakdownByPosition: [],
	contextSavingsByPosition: []
};

export const GET: RequestHandler = ({ url }) => {
	if (!hasTelemetryTable()) {
		return json(EMPTY_RESPONSE);
	}

	const range = parseDateRange(url);
	const { clause, params: dateParams } = buildDateFilter(range);
	const { conditions: entityConditions, params: entityParams } = buildEntityFilter(
		parseEntityFilters(url)
	);
	const params = { ...dateParams, ...entityParams };
	const db = getDb();

	const extraConditions = [
		"status = 'success'",
		'conversation_id IS NOT NULL',
		...entityConditions
	];
	const whereClause = clause
		? clause + ' AND ' + extraConditions.join(' AND ')
		: 'WHERE ' + extraConditions.join(' AND ');

	// ── Summary ──────────────────────────────────────────────────────────────
	const summaryRow = db
		.prepare(
			`
		SELECT
			COUNT(DISTINCT conversation_id)                             AS totalConversations,
			CAST(COUNT(*) AS REAL) / COUNT(DISTINCT conversation_id)   AS avgRequests,
			CAST(SUM(total_tokens) AS REAL) / COUNT(DISTINCT conversation_id) AS avgTokens,
			CAST(SUM(cost_usd) AS REAL) / COUNT(DISTINCT conversation_id)     AS avgCost
		FROM llm_requests
		${whereClause}
	`
		)
		.get(params) as Record<string, number>;

	// Average duration: (MAX - MIN started_at_ms) per conversation, then average
	const durationRow = db
		.prepare(
			`
		SELECT AVG(duration_ms) / 1000.0 AS avgDurationSeconds
		FROM (
			SELECT conversation_id, MAX(started_at_ms) - MIN(started_at_ms) AS duration_ms
			FROM llm_requests
			${whereClause}
			GROUP BY conversation_id
		)
	`
		)
		.get(params) as Record<string, number>;

	const summary = {
		totalConversations: Number(summaryRow.totalConversations) || 0,
		avgRequestsPerConversation: Number(summaryRow.avgRequests) || 0,
		avgTokensPerConversation: Number(summaryRow.avgTokens) || 0,
		avgCostPerConversation: Number(summaryRow.avgCost) || 0,
		avgDurationSeconds: Number(durationRow?.avgDurationSeconds) || 0
	};

	// ── Length distribution ──────────────────────────────��────────────────────
	const convLengths = db
		.prepare(
			`
		SELECT conversation_id, COUNT(*) AS req_count
		FROM llm_requests
		${whereClause}
		GROUP BY conversation_id
	`
		)
		.all(params) as Array<{ req_count: number }>;

	const lengthBuckets: Record<string, number> = {
		'1-2': 0,
		'3-5': 0,
		'6-10': 0,
		'11-20': 0,
		'20+': 0
	};
	for (const row of convLengths) {
		const n = Number(row.req_count);
		if (n <= 2) lengthBuckets['1-2']++;
		else if (n <= 5) lengthBuckets['3-5']++;
		else if (n <= 10) lengthBuckets['6-10']++;
		else if (n <= 20) lengthBuckets['11-20']++;
		else lengthBuckets['20+']++;
	}
	const lengthDistribution = Object.entries(lengthBuckets).map(([bucket, count]) => ({
		bucket,
		count
	}));

	// ── Token distribution ────────────────────────────────────────────────────
	const convTokens = db
		.prepare(
			`
		SELECT conversation_id, SUM(total_tokens) AS total_tokens
		FROM llm_requests
		${whereClause}
		GROUP BY conversation_id
	`
		)
		.all(params) as Array<{ total_tokens: number }>;

	const tokenBuckets: Record<string, number> = {
		'0-10k': 0,
		'10k-50k': 0,
		'50k-200k': 0,
		'200k-500k': 0,
		'500k+': 0
	};
	for (const row of convTokens) {
		const t = Number(row.total_tokens);
		if (t < 10000) tokenBuckets['0-10k']++;
		else if (t < 50000) tokenBuckets['10k-50k']++;
		else if (t < 200000) tokenBuckets['50k-200k']++;
		else if (t < 500000) tokenBuckets['200k-500k']++;
		else tokenBuckets['500k+']++;
	}
	const tokenDistribution = Object.entries(tokenBuckets).map(([bucket, count]) => ({
		bucket,
		count
	}));

	// ── Cost distribution ─────────────────────────────────────────────────────
	const convCosts = db
		.prepare(
			`
		SELECT conversation_id, SUM(cost_usd) AS total_cost
		FROM llm_requests
		${whereClause}
		GROUP BY conversation_id
	`
		)
		.all(params) as Array<{ total_cost: number }>;

	const costBuckets: Record<string, number> = {
		'$0-0.10': 0,
		'$0.10-0.50': 0,
		'$0.50-2': 0,
		'$2+': 0
	};
	for (const row of convCosts) {
		const c = Number(row.total_cost);
		if (c < 0.1) costBuckets['$0-0.10']++;
		else if (c < 0.5) costBuckets['$0.10-0.50']++;
		else if (c < 2.0) costBuckets['$0.50-2']++;
		else costBuckets['$2+']++;
	}
	const costDistribution = Object.entries(costBuckets).map(([bucket, count]) => ({
		bucket,
		count
	}));

	// ── Daily new conversations ───────────────────────────────────────────────
	const dailyRowsFixed = db
		.prepare(
			`
		SELECT date, COUNT(*) AS count
		FROM (
			SELECT conversation_id, date(MIN(started_at_ms)/1000, 'unixepoch') AS date
			FROM llm_requests
			${whereClause}
			GROUP BY conversation_id
		)
		GROUP BY date
		ORDER BY date ASC
	`
		)
		.all(params) as Array<{ date: string; count: number }>;

	const dailyNewConversations = dailyRowsFixed.map((r) => ({
		date: r.date as string,
		count: Number(r.count)
	}));

	// ── Weekly avg requests per conversation ──────────────────────────────────
	const weeklyRows = db
		.prepare(
			`
		SELECT week, AVG(req_count) AS avgRequests
		FROM (
			SELECT
				conversation_id,
				strftime('%Y-W%W', MIN(started_at_ms)/1000, 'unixepoch') AS week,
				COUNT(*) AS req_count
			FROM llm_requests
			${whereClause}
			GROUP BY conversation_id
		)
		GROUP BY week
		ORDER BY week ASC
	`
		)
		.all(params) as Array<{ week: string; avgRequests: number }>;

	const weeklyAvgRequests = weeklyRows.map((r) => ({
		week: r.week as string,
		avgRequests: Number(r.avgRequests)
	}));

	// ── Token growth (first vs last request tokens per conversation, by day) ──
	const tokenGrowthRows = db
		.prepare(
			`
		SELECT
			date(conv_start/1000, 'unixepoch') AS date,
			AVG(first_tokens) AS avgFirstTokens,
			AVG(last_tokens)  AS avgLastTokens
		FROM (
			SELECT
				conversation_id,
				MIN(started_at_ms) AS conv_start,
				FIRST_VALUE(total_tokens) OVER (PARTITION BY conversation_id ORDER BY started_at_ms ASC)  AS first_tokens,
				FIRST_VALUE(total_tokens) OVER (PARTITION BY conversation_id ORDER BY started_at_ms DESC) AS last_tokens
			FROM llm_requests
			${whereClause}
		)
		GROUP BY conversation_id, conv_start
	`
		)
		.all(params) as Array<{ date: string; avgFirstTokens: number; avgLastTokens: number }>;

	// Aggregate by date
	const growthByDate = new Map<string, { sumFirst: number; sumLast: number; count: number }>();
	for (const row of tokenGrowthRows) {
		const d = row.date as string;
		const entry = growthByDate.get(d) ?? { sumFirst: 0, sumLast: 0, count: 0 };
		entry.sumFirst += Number(row.avgFirstTokens);
		entry.sumLast += Number(row.avgLastTokens);
		entry.count++;
		growthByDate.set(d, entry);
	}
	const tokenGrowth = Array.from(growthByDate.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, e]) => ({
			date,
			avgFirstTokens: e.sumFirst / e.count,
			avgLastTokens: e.sumLast / e.count
		}));

	// ── Tool stripping ────────────────────────────────────────────────────────
	const toolStrippingRow = db
		.prepare(
			`
		SELECT
			SUM(CASE WHEN has_strip = 1 THEN 1 ELSE 0 END) AS withStrip,
			SUM(CASE WHEN has_strip = 0 THEN 1 ELSE 0 END) AS withoutStrip
		FROM (
			SELECT conversation_id, MAX(anthropic_clear_tool_uses_enabled) AS has_strip
			FROM llm_requests
			${whereClause}
			GROUP BY conversation_id
		)
	`
		)
		.get(params) as Record<string, number>;

	const toolStripping = [
		{ label: 'With Tool Stripping', count: Number(toolStrippingRow?.withStrip) || 0 },
		{ label: 'Without Tool Stripping', count: Number(toolStrippingRow?.withoutStrip) || 0 }
	];

	// ── Context pressure ──────────────────────────────────────────────────────
	// Join context_management_events to llm_requests via request_id to apply same filters
	const contextPressureRow = db
		.prepare(
			`
		SELECT
			COUNT(DISTINCT CASE WHEN cme.request_id IS NOT NULL THEN r.conversation_id END) AS withEvents,
			COUNT(DISTINCT CASE WHEN cme.request_id IS NULL     THEN r.conversation_id END) AS withoutEvents
		FROM llm_requests r
		LEFT JOIN (SELECT DISTINCT request_id FROM context_management_events) cme
			ON cme.request_id = r.request_id
		${whereClause}
	`
		)
		.get(params) as Record<string, number>;

	const contextPressure = [
		{ label: 'Had Context Events', count: Number(contextPressureRow?.withEvents) || 0 },
		{ label: 'No Context Events', count: Number(contextPressureRow?.withoutEvents) || 0 }
	];

	// ── Top expensive conversations ───────────────────────────────────────────
	const topExpensiveRows = db
		.prepare(
			`
		SELECT
			conversation_id                           AS conversationId,
			MAX(agent_slug)                           AS agentSlug,
			MAX(project_id)                           AS projectId,
			SUM(cost_usd)                             AS totalCost,
			COUNT(*)                                  AS requestCount,
			SUM(total_tokens)                         AS totalTokens
		FROM llm_requests
		${whereClause}
		GROUP BY conversation_id
		ORDER BY totalTokens DESC
		LIMIT 10
	`
		)
		.all(params) as Array<Record<string, string | number>>;

	const topExpensive = topExpensiveRows.map((r) => ({
		conversationId: String(r.conversationId ?? ''),
		agentSlug: String(r.agentSlug ?? ''),
		projectId: String(r.projectId ?? ''),
		totalCost: Number(r.totalCost),
		requestCount: Number(r.requestCount),
		totalTokens: Number(r.totalTokens)
	}));

	// ── Avg tokens per request by position ───────────────────────────────────
	// Use a subquery with ROW_NUMBER to get position within conversation
	const positionRows = db
		.prepare(
			`
		SELECT position, AVG(total_tokens) AS avgTokens
		FROM (
			SELECT
				total_tokens,
				ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY started_at_ms ASC) AS position
			FROM llm_requests
			${whereClause}
		)
		WHERE position <= 10
		GROUP BY position
		ORDER BY position ASC
	`
		)
		.all(params) as Array<{ position: number; avgTokens: number }>;

	const avgTokensPerRequestByPosition = positionRows.map((r) => ({
		position: Number(r.position),
		avgTokens: Number(r.avgTokens)
	}));

	// ── Token breakdown by position (stacked by message classification) ──────
	// Joins llm_request_messages to get per-classification token averages
	const tokenBreakdownRows = db
		.prepare(
			`
		SELECT
			position,
			AVG(system_tok)      AS avgSystem,
			AVG(user_tok)        AS avgUser,
			AVG(assistant_tok)   AS avgAssistant,
			AVG(tool_call_tok)   AS avgToolCall,
			AVG(tool_result_tok) AS avgToolResult
		FROM (
			SELECT
				r.conversation_id,
				ROW_NUMBER() OVER (PARTITION BY r.conversation_id ORDER BY r.started_at_ms ASC) AS position,
				SUM(CASE WHEN m.classification = 'system'      THEN COALESCE(m.estimated_tokens, 0) ELSE 0 END) AS system_tok,
				SUM(CASE WHEN m.classification = 'user'        THEN COALESCE(m.estimated_tokens, 0) ELSE 0 END) AS user_tok,
				SUM(CASE WHEN m.classification = 'assistant'   THEN COALESCE(m.estimated_tokens, 0) ELSE 0 END) AS assistant_tok,
				SUM(CASE WHEN m.classification = 'tool-call'   THEN COALESCE(m.estimated_tokens, 0) ELSE 0 END) AS tool_call_tok,
				SUM(CASE WHEN m.classification = 'tool-result' THEN COALESCE(m.estimated_tokens, 0) ELSE 0 END) AS tool_result_tok
			FROM llm_requests r
			JOIN llm_request_messages m ON m.request_id = r.request_id
			${whereClause}
			GROUP BY r.conversation_id, r.request_id
		)
		WHERE position <= 15
		GROUP BY position
		ORDER BY position ASC
	`
		)
		.all(params) as Array<{
		position: number;
		avgSystem: number;
		avgUser: number;
		avgAssistant: number;
		avgToolCall: number;
		avgToolResult: number;
	}>;

	const tokenBreakdownByPosition = tokenBreakdownRows.map((r) => ({
		pos: `#${r.position}`,
		system: Math.round(Number(r.avgSystem) || 0),
		user: Math.round(Number(r.avgUser) || 0),
		assistant: Math.round(Number(r.avgAssistant) || 0),
		toolCall: Math.round(Number(r.avgToolCall) || 0),
		toolResult: Math.round(Number(r.avgToolResult) || 0)
	}));

	// ── Context savings by position ───────────────────────────────────────────
	// Shows avg actual tokens sent vs tokens saved by context editing
	const savingsRows = db
		.prepare(
			`
		SELECT
			position,
			AVG(actual_tokens) AS avgActualTokens,
			AVG(saved_tokens)  AS avgSavedTokens
		FROM (
			SELECT
				r.conversation_id,
				ROW_NUMBER() OVER (PARTITION BY r.conversation_id ORDER BY r.started_at_ms ASC) AS position,
				COALESCE(r.context_runtime_estimated_input_tokens_after, r.input_tokens, 0) AS actual_tokens,
				COALESCE(r.context_runtime_estimated_input_tokens_saved, 0) +
					COALESCE(r.estimated_input_tokens_saved, 0)               AS saved_tokens
			FROM llm_requests r
			${whereClause}
		)
		WHERE position <= 15
		GROUP BY position
		ORDER BY position ASC
	`
		)
		.all(params) as Array<{ position: number; avgActualTokens: number; avgSavedTokens: number }>;

	const contextSavingsByPosition = savingsRows.map((r) => ({
		pos: `#${r.position}`,
		actualTokens: Math.round(Number(r.avgActualTokens) || 0),
		savedTokens: Math.round(Number(r.avgSavedTokens) || 0)
	}));

	return json({
		summary,
		lengthDistribution,
		tokenDistribution,
		costDistribution,
		dailyNewConversations,
		weeklyAvgRequests,
		tokenGrowth,
		toolStripping,
		contextPressure,
		topExpensive,
		avgTokensPerRequestByPosition,
		tokenBreakdownByPosition,
		contextSavingsByPosition
	});
};
