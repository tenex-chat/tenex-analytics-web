#!/usr/bin/env tsx
/**
 * Add performance indexes to the tenex analytics database.
 *
 * This script adds critical indexes that dramatically improve query performance,
 * especially for the /api/conversation-stats endpoint which uses window functions
 * and grouping by conversation_id extensively.
 *
 * Run with: npx tsx scripts/add-performance-indexes.ts
 */
/* eslint-disable no-console */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';

const DB_PATH = process.env.TENEX_DB_PATH ?? join(homedir(), '.tenex', 'data', 'trace-analysis.db');

console.log(`Opening database: ${DB_PATH}`);
const db = new Database(DB_PATH);

// Check if indexes already exist
function indexExists(name: string): boolean {
	const result = db
		.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name = ?")
		.get(name);
	return result !== undefined;
}

try {
	console.log('\n=== Adding Performance Indexes ===\n');

	// Critical: Index on conversation_id for GROUP BY and PARTITION BY operations
	const conversationIdIndex = 'idx_llm_requests_conversation_id';
	if (!indexExists(conversationIdIndex)) {
		console.log(`Creating ${conversationIdIndex}...`);
		db.prepare(
			`
			CREATE INDEX ${conversationIdIndex}
			ON llm_requests(conversation_id)
			WHERE conversation_id IS NOT NULL
		`
		).run();
		console.log('✓ Created index on conversation_id');
	} else {
		console.log(`✓ ${conversationIdIndex} already exists`);
	}

	// Composite index for conversation + time ordering (used in window functions)
	const convTimeIndex = 'idx_llm_requests_conv_time';
	if (!indexExists(convTimeIndex)) {
		console.log(`Creating ${convTimeIndex}...`);
		db.prepare(
			`
			CREATE INDEX ${convTimeIndex}
			ON llm_requests(conversation_id, started_at_ms)
			WHERE conversation_id IS NOT NULL
		`
		).run();
		console.log('✓ Created composite index on conversation_id + started_at_ms');
	} else {
		console.log(`✓ ${convTimeIndex} already exists`);
	}

	// Index for status filtering (used in almost all queries)
	const statusConvIndex = 'idx_llm_requests_status_conv';
	if (!indexExists(statusConvIndex)) {
		console.log(`Creating ${statusConvIndex}...`);
		db.prepare(
			`
			CREATE INDEX ${statusConvIndex}
			ON llm_requests(status, conversation_id, started_at_ms)
			WHERE status = 'success' AND conversation_id IS NOT NULL
		`
		).run();
		console.log('✓ Created index on status + conversation_id + started_at_ms');
	} else {
		console.log(`✓ ${statusConvIndex} already exists`);
	}

	// Index for llm_request_messages.request_id (used in JOINs)
	const messagesRequestIndex = 'idx_llm_request_messages_request_id';
	if (!indexExists(messagesRequestIndex)) {
		console.log(`Creating ${messagesRequestIndex}...`);
		db.prepare(
			`
			CREATE INDEX ${messagesRequestIndex}
			ON llm_request_messages(request_id, classification)
		`
		).run();
		console.log('✓ Created index on llm_request_messages.request_id');
	} else {
		console.log(`✓ ${messagesRequestIndex} already exists`);
	}

	console.log('\n=== Analyzing Database ===\n');
	db.prepare('ANALYZE').run();
	console.log('✓ Updated query planner statistics');

	console.log('\n=== Index Creation Complete ===\n');

	// Show current indexes
	const indexes = db
		.prepare(
			`
		SELECT name, tbl_name
		FROM sqlite_master
		WHERE type='index'
		AND name LIKE 'idx_%'
		ORDER BY tbl_name, name
	`
		)
		.all();

	console.log('Current indexes:');
	let currentTable = '';
	for (const idx of indexes as Array<{ name: string; tbl_name: string }>) {
		if (idx.tbl_name !== currentTable) {
			currentTable = idx.tbl_name;
			console.log(`\n  ${currentTable}:`);
		}
		console.log(`    - ${idx.name}`);
	}
} catch (error) {
	console.error('Error creating indexes:', error);
	process.exit(1);
} finally {
	db.close();
}
