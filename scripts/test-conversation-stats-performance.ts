#!/usr/bin/env tsx
/**
 * Test the performance of the conversation-stats endpoint queries.
 * Measures execution time for each query section to identify bottlenecks.
 *
 * Run with: npx tsx scripts/test-conversation-stats-performance.ts
 */
/* eslint-disable no-console */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';

const DB_PATH = process.env.TENEX_DB_PATH ?? join(homedir(), '.tenex', 'data', 'trace-analysis.db');

console.log(`Testing queries on: ${DB_PATH}\n`);
const db = new Database(DB_PATH, { readonly: true });

// Test parameters (from your curl command)
const from = new Date('2026-04-13T23:10:27.714Z').getTime();
const to = new Date('2026-04-14T11:10:27.714Z').getTime();
const params = { from, to };

const whereClause =
	"WHERE started_at_ms >= @from AND started_at_ms <= @to AND status = 'success' AND conversation_id IS NOT NULL";
const extraConditions = ["status = 'success'", 'conversation_id IS NOT NULL'];

function timeQuery(name: string, query: string, params: Record<string, number>): number {
	const start = performance.now();
	const stmt = db.prepare(query);
	const result = stmt.all(params);
	const elapsed = performance.now() - start;
	console.log(`${name.padEnd(40)} ${elapsed.toFixed(2).padStart(8)}ms  (${result.length} rows)`);
	return elapsed;
}

console.log('Query Performance Test\n');
console.log('='.repeat(70));

let totalTime = 0;

// Summary query
totalTime += timeQuery(
	'1. Summary stats',
	`
	SELECT
		COUNT(DISTINCT conversation_id) AS totalConversations,
		CAST(COUNT(*) AS REAL) / COUNT(DISTINCT conversation_id) AS avgRequests,
		CAST(SUM(total_tokens) AS REAL) / COUNT(DISTINCT conversation_id) AS avgTokens
	FROM llm_requests
	${whereClause}
`,
	params
);

// Duration query
totalTime += timeQuery(
	'2. Duration calculation',
	`
	SELECT AVG(duration_ms) / 1000.0 AS avgDurationSeconds
	FROM (
		SELECT conversation_id, MAX(started_at_ms) - MIN(started_at_ms) AS duration_ms
		FROM llm_requests
		${whereClause}
		GROUP BY conversation_id
	)
`,
	params
);

// Length distribution
totalTime += timeQuery(
	'3. Length distribution',
	`
	SELECT conversation_id, COUNT(*) AS req_count
	FROM llm_requests
	${whereClause}
	GROUP BY conversation_id
`,
	params
);

// Token distribution
totalTime += timeQuery(
	'4. Token distribution',
	`
	SELECT conversation_id, SUM(total_tokens) AS total_tokens
	FROM llm_requests
	${whereClause}
	GROUP BY conversation_id
`,
	params
);

// Daily new conversations
totalTime += timeQuery(
	'5. Daily new conversations',
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
`,
	params
);

// Weekly avg requests
totalTime += timeQuery(
	'6. Weekly avg requests',
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
`,
	params
);

// Token growth (optimized version)
totalTime += timeQuery(
	'7. Token growth (optimized)',
	`
	SELECT
		date(conv_start_ms/1000, 'unixepoch') AS date,
		AVG(first_tokens) AS avgFirstTokens,
		AVG(last_tokens)  AS avgLastTokens
	FROM (
		SELECT
			r.conversation_id,
			MIN(r.started_at_ms) AS conv_start_ms,
			(SELECT total_tokens FROM llm_requests
			 WHERE conversation_id = r.conversation_id AND ${extraConditions.join(' AND ')}
			 ORDER BY started_at_ms ASC LIMIT 1) AS first_tokens,
			(SELECT total_tokens FROM llm_requests
			 WHERE conversation_id = r.conversation_id AND ${extraConditions.join(' AND ')}
			 ORDER BY started_at_ms DESC LIMIT 1) AS last_tokens
		FROM llm_requests r
		${whereClause}
		GROUP BY r.conversation_id
	)
	GROUP BY date
	ORDER BY date ASC
`,
	params
);

// Avg tokens per request by position
totalTime += timeQuery(
	'8. Avg tokens by position',
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
`,
	params
);

// Token breakdown by position (optimized with CTE)
totalTime += timeQuery(
	'9. Token breakdown (optimized)',
	`
	WITH ranked_requests AS (
		SELECT
			request_id,
			conversation_id,
			ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY started_at_ms ASC) AS position
		FROM llm_requests
		${whereClause}
	)
	SELECT
		position,
		AVG(system_tok)      AS avgSystem,
		AVG(user_tok)        AS avgUser,
		AVG(assistant_tok)   AS avgAssistant
	FROM (
		SELECT
			r.position,
			SUM(CASE WHEN m.classification = 'system'      THEN COALESCE(m.estimated_tokens, 0) ELSE 0 END) AS system_tok,
			SUM(CASE WHEN m.classification = 'user'        THEN COALESCE(m.estimated_tokens, 0) ELSE 0 END) AS user_tok,
			SUM(CASE WHEN m.classification = 'assistant'   THEN COALESCE(m.estimated_tokens, 0) ELSE 0 END) AS assistant_tok
		FROM ranked_requests r
		JOIN llm_request_messages m ON m.request_id = r.request_id
		WHERE r.position <= 15
		GROUP BY r.conversation_id, r.request_id, r.position
	)
	GROUP BY position
	ORDER BY position ASC
`,
	params
);

// Context savings by position
totalTime += timeQuery(
	'10. Context savings by position',
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
				COALESCE(r.estimated_input_tokens_saved, 0) AS saved_tokens
		FROM llm_requests r
		${whereClause}
	)
	WHERE position <= 15
	GROUP BY position
	ORDER BY position ASC
`,
	params
);

console.log('='.repeat(70));
console.log(`${'TOTAL TIME'.padEnd(40)} ${totalTime.toFixed(2).padStart(8)}ms\n`);

if (totalTime < 1000) {
	console.log('✓ Excellent performance! Under 1 second total.');
} else if (totalTime < 5000) {
	console.log('✓ Good performance. Under 5 seconds total.');
} else if (totalTime < 10000) {
	console.log('⚠ Acceptable performance. Could be optimized further.');
} else {
	console.log('✗ Slow performance. Consider additional optimization.');
}

db.close();
