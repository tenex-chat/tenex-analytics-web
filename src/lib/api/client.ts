// Typed fetch wrapper for local /api/ routes
// Used by Svelte components to fetch data from SvelteKit server routes

import type {
	TelemetrySummary,
	TokenUsageTrend,
	CacheMetrics,
	CostData,
	TelemetryData,
	DateRangeParams,
	GranularityParams
} from './types.js';

const DEFAULT_TIMEOUT_MS = 5000;

class ApiError extends Error {
	constructor(
		public statusCode: number,
		public errorCode: string,
		message: string
	) {
		super(message);
		this.name = 'ApiError';
	}
}

/**
 * Internal fetch helper with timeout and error handling
 */
async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
	const url = new URL(path, window.location.origin);
	if (params) {
		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== '') {
				url.searchParams.set(key, value);
			}
		});
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

	try {
		const response = await fetch(url.toString(), {
			signal: controller.signal,
			headers: { Accept: 'application/json' }
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			let errorData: { error?: string; message?: string } = {};
			try {
				errorData = await response.json();
			} catch {
				// ignore JSON parse errors on error responses
			}
			throw new ApiError(
				response.status,
				errorData.error ?? 'UNKNOWN_ERROR',
				errorData.message ?? `HTTP ${response.status}: ${response.statusText}`
			);
		}

		return response.json() as Promise<T>;
	} catch (err) {
		clearTimeout(timeoutId);
		if (err instanceof ApiError) throw err;
		if (err instanceof DOMException && err.name === 'AbortError') {
			throw new ApiError(408, 'TIMEOUT', `Request timed out after ${DEFAULT_TIMEOUT_MS}ms`);
		}
		throw new ApiError(0, 'NETWORK_ERROR', `Network error: ${(err as Error).message}`);
	}
}

/**
 * Build optional date range query params
 */
function dateParams(range?: DateRangeParams): Record<string, string> {
	const params: Record<string, string> = {};
	if (range?.from) params.from = range.from;
	if (range?.to) params.to = range.to;
	return params;
}

// ─── Public API Client Methods ───────────────────────────────────────────────

export interface SummaryParams extends DateRangeParams {
	project?: string;
	agent?: string;
	provider?: string;
	model?: string;
	apiKey?: string;
}

/**
 * GET /api/telemetry/summary
 * Returns aggregated summary metrics: total tokens, cache %, total cost
 */
export async function getTelemetrySummary(params?: SummaryParams): Promise<TelemetrySummary> {
	const queryParams: Record<string, string> = {};
	if (params) {
		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== '') queryParams[key] = value as string;
		});
	}
	return apiFetch<TelemetrySummary>('/api/telemetry/summary', queryParams);
}

/**
 * GET /api/tokens
 * Returns token usage trend data, optionally filtered by date range and granularity
 */
export async function getTokenTrends(params?: GranularityParams): Promise<TokenUsageTrend> {
	const queryParams: Record<string, string> = {};
	if (params?.from) queryParams.from = params.from;
	if (params?.to) queryParams.to = params.to;
	if (params?.granularity) queryParams.granularity = params.granularity;
	return apiFetch<TokenUsageTrend>('/api/tokens', queryParams);
}

/**
 * GET /api/cache
 * Returns cache efficiency metrics by model and by day
 */
export async function getCacheMetrics(range?: DateRangeParams): Promise<CacheMetrics> {
	return apiFetch<CacheMetrics>('/api/cache', dateParams(range));
}

/**
 * GET /api/telemetry
 * Returns full telemetry data bundle (summary + trends + cache + cost)
 */
export async function getTelemetryData(range?: DateRangeParams): Promise<TelemetryData> {
	return apiFetch<TelemetryData>('/api/telemetry', dateParams(range));
}

/**
 * GET /api/cost (cost data from telemetry endpoint)
 */
export async function getCostData(range?: DateRangeParams): Promise<CostData> {
	const data = await apiFetch<{ costData: CostData }>('/api/telemetry', dateParams(range));
	return data.costData;
}

export { ApiError };
