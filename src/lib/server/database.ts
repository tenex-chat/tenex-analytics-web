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
		const toDate = new Date(range.to);
		// Only expand to end-of-day for date-only strings (YYYY-MM-DD).
		// Full ISO timestamps (containing 'T') already encode hour precision — pass through untouched.
		if (!range.to.includes('T')) {
			toDate.setHours(23, 59, 59, 999);
		}
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

export interface EntityFilters {
	model?: string;
	agent?: string;
	project?: string;
	provider?: string;
	apiKey?: string;
}

/**
 * Parse entity filter query params (model, agent, project, provider).
 */
export function parseEntityFilters(url: URL): EntityFilters {
	return {
		model: url.searchParams.get('model') ?? undefined,
		agent: url.searchParams.get('agent') ?? undefined,
		project: url.searchParams.get('project') ?? undefined,
		provider: url.searchParams.get('provider') ?? undefined,
		apiKey: url.searchParams.get('apiKey') ?? undefined
	};
}

/**
 * Build additional WHERE clause conditions and params for entity filters.
 * The returned conditions are appended to an existing WHERE clause using AND.
 *
 * @param filters  Parsed entity filters from parseEntityFilters()
 * @param columns  Column name mapping (defaults to standard llm_requests column names)
 */
export function buildEntityFilter(
	filters: EntityFilters,
	columns: { model?: string; agent?: string; project?: string; provider?: string; apiKey?: string } = {}
): { conditions: string[]; params: Record<string, string> } {
	const conditions: string[] = [];
	const params: Record<string, string> = {};

	const modelCol = columns.model ?? 'model';
	const agentCol = columns.agent ?? 'agent_slug';
	const projectCol = columns.project ?? 'project_id';
	const providerCol = columns.provider ?? 'provider';
	const apiKeyCol = columns.apiKey ?? 'api_key_identity';

	if (filters.model) {
		conditions.push(`${modelCol} = @model`);
		params.model = filters.model;
	}
	if (filters.agent) {
		conditions.push(`${agentCol} = @agent`);
		params.agent = filters.agent;
	}
	if (filters.project) {
		conditions.push(`${projectCol} = @project`);
		params.project = filters.project;
	}
	if (filters.provider) {
		conditions.push(`${providerCol} = @provider`);
		params.provider = filters.provider;
	}
	if (filters.apiKey) {
		conditions.push(`${apiKeyCol} = @apiKey`);
		params.apiKey = filters.apiKey;
	}

	return { conditions, params };
}

// ─── Unified request filter ───────────────────────────────────────────────────

export interface RequestFilters extends DateRange, EntityFilters {}

export interface RequestFilterOptions {
	/** Column used for date range filtering. Defaults to 'started_at_ms'. */
	dateColumn?: string;
	/** Whether to include `status = 'success'` condition. Defaults to true. */
	includeStatus?: boolean;
	/** Whether to include project_id filter. Defaults to true. */
	includeProject?: boolean;
	/** Whether to include provider filter. Defaults to true. */
	includeProvider?: boolean;
}

/**
 * Parse all standard analytics query params from a URL in one call.
 * Combines date range (from/to) with entity filters (model, agent, project, provider).
 */
export function parseRequestFilters(url: URL): RequestFilters {
	return {
		from: url.searchParams.get('from') ?? undefined,
		to: url.searchParams.get('to') ?? undefined,
		model: url.searchParams.get('model') ?? undefined,
		agent: url.searchParams.get('agent') ?? undefined,
		project: url.searchParams.get('project') ?? undefined,
		provider: url.searchParams.get('provider') ?? undefined,
		apiKey: url.searchParams.get('apiKey') ?? undefined
	};
}

/**
 * Build a complete WHERE clause with all analytics filters applied.
 * Handles date range, status, and entity filters (model, agent, project, provider).
 *
 * Use this as the single filter builder for all llm_requests-backed endpoints.
 */
export function buildRequestFilter(
	filters: RequestFilters,
	options: RequestFilterOptions = {}
): { clause: string; params: Record<string, number | string> } {
	const {
		dateColumn = 'started_at_ms',
		includeStatus = true,
		includeProject = true,
		includeProvider = true
	} = options;

	const conditions: string[] = [];
	const params: Record<string, number | string> = {};

	// Date range
	if (filters.from) {
		conditions.push(`${dateColumn} >= @from`);
		params.from = new Date(filters.from).getTime();
	}
	if (filters.to) {
		const toDate = new Date(filters.to);
		if (!filters.to.includes('T')) {
			toDate.setHours(23, 59, 59, 999);
		}
		conditions.push(`${dateColumn} <= @to`);
		params.to = toDate.getTime();
	}

	// Status
	if (includeStatus) {
		conditions.push("status = 'success'");
	}

	// Entity filters
	if (filters.model) {
		conditions.push('model = @model');
		params.model = filters.model;
	}
	if (filters.agent) {
		conditions.push('agent_slug = @agent');
		params.agent = filters.agent;
	}
	if (includeProject && filters.project) {
		conditions.push('project_id = @project');
		params.project = filters.project;
	}
	if (includeProvider && filters.provider) {
		conditions.push('provider = @provider');
		params.provider = filters.provider;
	}
	if (filters.apiKey) {
		conditions.push('api_key_identity = @apiKey');
		params.apiKey = filters.apiKey;
	}

	return {
		clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
		params
	};
}
