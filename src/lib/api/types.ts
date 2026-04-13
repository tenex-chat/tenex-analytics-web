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

export interface TokenUsageBreakdownItem {
	key: string;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	totalTokens: number;
	requests: number;
	avgTokensPerRequest: number;
	sharePercent: number;
}

export interface TokenUsageConversationItem {
	conversationId: string;
	projectId: string;
	agentSlug: string;
	apiKeyIdentity: string;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	totalTokens: number;
	requests: number;
	avgTokensPerRequest: number;
	sharePercent: number;
	lastTimestamp: string | null;
}

export interface TokenUsageRunawayItem extends TokenUsageConversationItem {
	suspiciousScore: number;
	severity: 'high' | 'medium' | 'low';
	requestsPerMinute: number;
	avgToolCallsPerRequest: number;
	avgToolResultsPerRequest: number;
	contextEventsPerRequest: number;
	inputGrowthRatio: number;
	repeatedFsReadMax: number;
	repeatedFsReadPath: string | null;
	repeatedShellCommandMax: number;
	repeatedShellCommand: string | null;
	flags: string[];
}

export interface TokenUsageTrend {
	granularity: 'hour' | 'day' | 'week';
	points: TokenUsagePoint[];
	breakdown: {
		projects: TokenUsageBreakdownItem[];
		agents: TokenUsageBreakdownItem[];
		apiKeys: TokenUsageBreakdownItem[];
		conversations: TokenUsageConversationItem[];
		runaways: TokenUsageRunawayItem[];
	};
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
	promptTokensSent: number; // estimated input tokens sent to the provider
	tokensUsed: number; // input + output as reported by the provider
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	messageCount: number;
	toolCallsCount: number; // classification = 'tool_use' messages
	toolResultsCount: number; // classification = 'tool_result' messages
	toolCallsStripped: number; // removed_tool_exchanges_delta from context_management_events
	contextTokensSaved: number; // context_runtime_estimated_input_tokens_saved from llm_requests
	contextManagementEvent: number; // 1 if a context_management_event fired, else 0
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
	totalPromptTokensSent: number;
	totalProcessedTokens: number;
	totalToolCalls: number;
	totalToolCallsStripped: number;
	totalContextTokensSaved: number;
	minTokens: number;
	maxTokens: number;
	medianTokens: number;
	conversationDurationSeconds: number;
	totalCacheReadTokens: number;
	totalCacheWriteTokens: number;
	requestsWithCacheHits: number; // requests where cacheReadTokens > 0
	requestsWithContextManagement: number; // requests that triggered a context management event
	requestsWithToolTrimming: number; // requests where tool call/result exchanges were trimmed
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
