// TypeScript interfaces for API requests and responses
// Shared between client (fetch callers) and server (route handlers)

// ─── Telemetry Summary ──────────────────────────────────────────────────────

export interface TelemetrySummary {
	totalInputTokens: number;
	totalOutputTokens: number;
	totalCacheReadTokens: number;
	totalCacheWriteTokens: number;
	totalTokens: number;
	cacheEfficiencyPercent: number; // 0–100
	totalCostUsd: number;
	totalRequests: number;
	dateRange: {
		from: string; // ISO date
		to: string; // ISO date
	};
}

// ─── Token Usage Trends ──────────────────────────────────────────────────────

export interface TokenUsagePoint {
	date: string; // ISO date or datetime
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	totalTokens: number;
	requests: number;
}

export interface TokenUsageTrend {
	granularity: 'hour' | 'day' | 'week';
	points: TokenUsagePoint[];
}

// ─── Cache Efficiency ────────────────────────────────────────────────────────

export interface CacheMetricPoint {
	label: string; // model name or date
	cacheReadTokens: number;
	cacheWriteTokens: number;
	inputTokens: number;
	efficiencyPercent: number; // cacheRead / (cacheRead + input) * 100
	requests: number;
}

export interface CacheMetrics {
	overall: {
		efficiencyPercent: number;
		totalCacheReadTokens: number;
		totalCacheWriteTokens: number;
	};
	byModel: CacheMetricPoint[];
	byDay: CacheMetricPoint[];
}

// ─── Cost Data ───────────────────────────────────────────────────────────────

export interface CostPoint {
	date: string; // ISO date
	totalCostUsd: number;
	inputCostUsd: number;
	outputCostUsd: number;
	cacheCostUsd: number;
	requests: number;
}

export interface CostByModel {
	model: string;
	totalCostUsd: number;
	inputCostUsd: number;
	outputCostUsd: number;
	cacheCostUsd: number;
	requests: number;
	avgCostPerRequest: number;
}

export interface CostData {
	total: number;
	byDay: CostPoint[];
	byModel: CostByModel[];
}

// ─── Full Telemetry Response ─────────────────────────────────────────────────

export interface TelemetryData {
	summary: TelemetrySummary;
	tokenTrends: TokenUsageTrend;
	cacheMetrics: CacheMetrics;
	costData: CostData;
}

// ─── API Error ───────────────────────────────────────────────────────────────

export interface ApiError {
	error: string;
	message: string;
	statusCode: number;
}

// ─── Query Parameters ────────────────────────────────────────────────────────

export interface DateRangeParams {
	from?: string; // ISO date: YYYY-MM-DD
	to?: string; // ISO date: YYYY-MM-DD
}

export interface GranularityParams extends DateRangeParams {
	granularity?: 'hour' | 'day' | 'week';
}
