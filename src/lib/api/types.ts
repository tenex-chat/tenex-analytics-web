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

// ─── Conversation Growth Stats ───────────────────────────────────────────────

export interface ConversationStatPoint {
	timestamp: string; // ISO datetime
	tokensUsed: number; // input + output (no cache)
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	messageCount: number;
	toolCallsCount: number; // classification = 'tool_use' messages
	toolResultsCount: number; // classification = 'tool_result' messages
	toolCallsStripped: number; // removed_tool_exchanges_delta from context_management_events
	tokensRemovedByContextEditing: number; // runtime context removals plus provider-side cleared input tokens
	contextManagementEvent: number; // 1 if a context_management_event fired, else 0
	anthropicClearToolUses: number; // 1 if Anthropic actually cleared tool uses for the request
	roleTokens: {
		system: number;
		user: number;
		assistant: number;
		tool: number; // tool_result messages
	};
}

export interface ConversationStatSummary {
	meanTokensPerRequest: number;
	avgMessagesPerRequest: number;
	totalToolCalls: number;
	totalToolCallsStripped: number;
	minTokens: number;
	maxTokens: number;
	medianTokens: number;
	conversationDurationSeconds: number;
	totalCacheReadTokens: number;
	totalCacheWriteTokens: number;
	requestsWithCacheHits: number; // requests where cacheReadTokens > 0
	requestsWithContextManagement: number; // requests that triggered a context management event
	requestsWithAnthropicToolClear: number; // requests where Anthropic stripped tools server-side
}

export interface ConversationStats {
	conversationId: string;
	timeSeries: ConversationStatPoint[];
	summary: ConversationStatSummary;
}

// ─── Query Parameters ────────────────────────────────────────────────────────

export interface DateRangeParams {
	from?: string; // ISO date: YYYY-MM-DD
	to?: string; // ISO date: YYYY-MM-DD
}

export interface GranularityParams extends DateRangeParams {
	granularity?: 'hour' | 'day' | 'week';
}
