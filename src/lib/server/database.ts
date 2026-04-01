// Database connection and query utilities for ~/.tenex/data/trace-analysis.db
// Server-only module — never import from client-side Svelte components

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';

const DB_PATH = process.env.TENEX_DB_PATH ?? join(homedir(), '.tenex', 'data', 'trace-analysis.db');

let _db: Database.Database | null = null;

/**
 * Returns a singleton better-sqlite3 connection.
 * Opens the database read-only so we never accidentally mutate analytics data.
 */
export function getDb(): Database.Database {
	if (!_db) {
		_db = new Database(DB_PATH, { readonly: true, fileMustExist: false });
		// Enable WAL mode for better concurrent read performance
		try {
			_db.pragma('journal_mode = WAL');
		} catch {
			// read-only DB may not support WAL pragma — safe to ignore
		}
	}
	return _db;
}

/**
 * Close the database connection. Used in tests or hot-reload scenarios.
 */
export function closeDb(): void {
	if (_db) {
		_db.close();
		_db = null;
	}
}

// ─── Schema helpers ───────────────────────────────────────────────────────────

/**
 * Check whether the telemetry table exists in the database.
 * Returns false if the database file does not yet exist.
 */
export function hasTelemetryTable(): boolean {
	try {
		const db = getDb();
		const row = db
			.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='llm_requests'")
			.get();
		return row !== undefined;
	} catch {
		return false;
	}
}

// ─── Query builders ──────────────────────────────────────────────────────────

export interface DateRange {
	from?: string; // YYYY-MM-DD
	to?: string; // YYYY-MM-DD
}

/**
 * Build a WHERE clause fragment and bound params for an optional date range.
 * Uses the `started_at_ms` column (Unix timestamp milliseconds).
 * YYYY-MM-DD strings are converted to unix milliseconds.
 */
export function buildDateFilter(
	range: DateRange,
	column = 'started_at_ms'
): { clause: string; params: Record<string, number> } {
	const conditions: string[] = [];
	const params: Record<string, number> = {};

	if (range.from) {
		conditions.push(`${column} >= @from`);
		params.from = new Date(range.from).getTime();
	}
	if (range.to) {
		// Include the full day by going to 23:59:59.999
		const toDate = new Date(range.to);
		toDate.setHours(23, 59, 59, 999);
		conditions.push(`${column} <= @to`);
		params.to = toDate.getTime();
	}

	return {
		clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
		params
	};
}

/**
 * Parse date range query params; returns empty object if both are absent.
 */
export function parseDateRange(url: URL): DateRange {
	return {
		from: url.searchParams.get('from') ?? undefined,
		to: url.searchParams.get('to') ?? undefined
	};
}
