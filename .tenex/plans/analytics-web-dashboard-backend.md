# Analytics Web Dashboard: Backend Data Access Layer

## Context

The TENEX Analytics Web Dashboard is a local SvelteKit webapp that visualizes LLM telemetry data from `~/.tenex/analysis.db`. The foundational scaffolding (`analytics-web-dashboard-scaffolding.md`) establishes the SvelteKit framework, Tailwind styling, Recharts charting, and better-sqlite3 dependency.

This plan defines the **backend/data access layer**: all server-side route handlers, database query patterns, type definitions, and performance strategies that expose telemetry data to the frontend via JSON API endpoints.

### Existing Database Schema

The SQLite database at `~/.tenex/analysis.db` contains four telemetry tables:

**`llm_requests`** (one row per API call to an LLM provider)

- `id` (primary key, auto-increment)
- `agent_slug` (string) — which TENEX agent made the request
- `project_id` (string) — which project the agent belongs to
- `provider` (string) — LLM provider (openai, anthropic, google, etc.)
- `model` (string) — specific model (gpt-4-turbo, claude-3-opus, etc.)
- `conversation_id` (string) — which conversation this request belongs to
- `input_tokens` (integer) — tokens in the request
- `output_tokens` (integer) — tokens in the response
- `cache_read_tokens` (integer) — tokens read from cache (Anthropic, etc.)
- `cache_write_tokens` (integer) — tokens written to cache
- `cost_usd` (real) — cost of the request in USD
- `duration_ms` (integer) — time taken in milliseconds
- `timestamp` (datetime) — when the request occurred

**`llm_request_messages`** (one row per message in an LLM request/response)

- `id` (primary key, auto-increment)
- `llm_request_id` (foreign key to llm_requests)
- `role` (string) — "user", "assistant", "system", "tool"
- `classification` (string) — "system", "user", "tool-call", "tool-result"
- `token_count` (integer) — tokens in this message
- `content_preview` (text) — first 500 chars of message content for inspection

**`context_management_events`** (one row per context window management decision)

- `id` (primary key, auto-increment)
- `llm_request_id` (foreign key to llm_requests)
- `strategy` (string) — pruning strategy applied ("summarize", "drop-oldest", "cache", etc.)
- `tokens_before` (integer) — context tokens before pruning
- `tokens_after` (integer) — context tokens after pruning
- `utilization` (real) — percentage of context window used (0-100)

**`message_carry_runs`** (one row per message carry/pruning session)

- `id` (primary key, auto-increment)
- `conversation_id` (string) — which conversation
- `agent_slug` (string) — which agent performed the pruning
- `strategy` (string) — which strategy was used
- `messages_before` (integer) — message count before pruning
- `messages_after` (integer) — message count after pruning
- `tokens_before` (integer) — tokens before pruning
- `tokens_after` (integer) — tokens after pruning
- `timestamp` (datetime) — when the pruning occurred

### API Contract

The scaffolding plan establishes these API endpoints (routes):

- `GET /api/telemetry/summary` — aggregated metrics
- `GET /api/telemetry` — paginated telemetry data with filters
- `GET /api/tokens` — token usage trends
- `GET /api/cache` — cache efficiency metrics
- `GET /api/cost` — cost trends and breakdowns
- `GET /api/conversations/:id` — individual conversation inspection
- `GET /api/context-windows` — context window utilization trends

This plan details each endpoint's query parameters, response schema, database query logic, and error handling.

## Approach

The backend data access layer follows these principles:

### 1. **Singleton Database Connection**

- Initialize a single better-sqlite3 connection in `src/lib/server/database.ts` at module load time
- Reuse this connection across all API routes (no connection pooling needed; SQLite is single-writer)
- Implement graceful shutdown and error recovery if database file is unavailable

### 2. **Type-Safe Query Builders**

- Create utility functions in `src/lib/server/database.ts` for common query patterns:
  - Aggregations: `COUNT()`, `SUM()`, `AVG()`, `MIN()`, `MAX()`
  - Time-series: `GROUP BY` hour/day/week with COALESCE defaults
  - Filtering: by project_id, agent_slug, provider, model, date range
  - Pagination: LIMIT/OFFSET with cursor support for large datasets
- Export typed query functions that return strongly-typed results

### 3. **Prepared Statements**

- All user-provided filters (dates, IDs, strings) are parameterized to prevent SQL injection
- Statement caching via better-sqlite3's `.prepare()` with `.bind()` for repeated queries
- No string concatenation for WHERE clauses; use `?` placeholders

### 4. **Validation & Filtering**

- Use Zod schemas for all query parameter validation in route handlers
- Reject invalid date ranges, out-of-range filters, and malformed IDs with 400 errors
- Document all supported filters and their valid ranges in JSDoc comments

### 5. **Response Type Safety**

- Define TypeScript interfaces in `src/lib/api/types.ts` for every API response
- Database query functions return data that directly satisfies response interfaces
- IDE type inference confirms response structure at compile time

### 6. **Performance-First Queries**

- Minimize SELECT columns (don't fetch unused data)
- Use database-level aggregations instead of in-memory looping
- Add strategic indexes on frequently filtered columns (agent_slug, project_id, provider, timestamp)
- Implement pagination defaults and limits (e.g., max 1000 rows per request)
- Cache expensive time-series queries if same parameters are requested within 60 seconds

### 7. **Error Handling**

- Distinguish HTTP error types (400 bad request, 404 not found, 500 server error)
- Return structured error responses with actionable messages
- Log database errors with context (query, parameters, error code) for debugging
- Gracefully degrade if database is unavailable (return empty results with a warning header)

### 8. **No Data Mutation**

- All routes are read-only; assert that the database is opened in read-only mode
- This prevents accidental writes and makes the API safe for parallel requests

### Alternatives Considered

**Option A: REST Endpoints with Drilldown Relationships**  
Each resource type (tokens, cache, cost) is a separate endpoint with related sub-resources (e.g., `/api/tokens/:timeframe/providers`). Rejected because it creates too many endpoints; filters on a single endpoint are simpler.

**Option B: GraphQL Query Language**  
Clients specify exactly which fields they want; reduces over-fetching. Rejected because the dashboard is simple enough that fixed response shapes are cleaner; GraphQL adds unnecessary complexity for this use case.

**Option C: Server-Side Caching with Redis**  
Cache expensive queries in a separate in-memory store for fast repeated access. Rejected because this is a local dev tool with a single SQLite database; in-process JavaScript caching via a simple Map is sufficient.

**Option D: Streaming Responses (Server-Sent Events)**  
Push telemetry updates to the frontend as they arrive. Rejected for now because the analysis.db is a historical database (not real-time); polling every 30-60 seconds is appropriate for this use case.

## File Changes

### `src/lib/server/database.ts`

- **Action**: create
- **What**:
  - Initialize better-sqlite3 connection with read-only mode
  - Path expansion for `~/.tenex/analysis.db` (handle tilde expansion on Windows/Mac/Linux)
  - Singleton pattern with module-level export
  - Error handling for missing/inaccessible database
  - Query builder functions for common patterns: `getTokenSummary()`, `getTokenTrends()`, `getCacheMetrics()`, `getCostBreakdown()`, `getConversationDetails()`, `getContextWindowTrends()`
  - Prepared statement helpers with parameterized query execution
  - Logging for query performance (duration > 500ms)
  - Database schema validation on init (check that all expected tables exist)
- **Why**: Centralizes all database access; ensures type safety, parameterization, and consistent error handling

### `src/lib/server/validators.ts`

- **Action**: create
- **What**:
  - Zod schemas for common query parameters: DateRange, ProjectId, AgentSlug, Provider, Model, TimeFrame (hour/day/week), Pagination
  - Schemas for each endpoint's unique filters (e.g., CostBreakdownFilter with groupBy: "provider" | "model" | "agent")
  - Type extraction helpers: `z.infer<typeof DateRangeSchema>` for TypeScript types
  - Validation utilities: `validateQueryParams()`, `validateDateRange()`, `validatePagination()`
  - Constants for limits: MAX_PAGE_SIZE = 1000, DEFAULT_PAGE_SIZE = 100, MAX_DATE_RANGE = 365 days
  - Error message templates for common validation failures
- **Why**: Centralized, reusable validation; prevents code duplication across route handlers

### `src/lib/api/types.ts` (MODIFY)

- **Action**: modify (add to existing file from scaffolding)
- **What**: Expand with backend-specific types:
  - `TelemetrySummaryResponse` — total input/output/cache tokens, cache hit rate, total cost, avg cost per request, request count, time range
  - `TelemetryDataResponse` — paginated array of `TelemetryRecord[]` with pagination metadata
  - `TelemetryRecord` — id, agent_slug, project_id, provider, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd, duration_ms, timestamp, conversation_id
  - `TokenTrendResponse` — array of `{ timestamp: datetime, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, request_count }`
  - `CacheMetricResponse` — array of `{ agent_slug | provider | model, cache_read_tokens, cache_write_tokens, total_requests, cache_hit_rate: percentage }`
  - `CostBreakdownResponse` — array of `{ agent_slug | provider | model, total_cost_usd, request_count, avg_cost_per_request, cost_percentage_of_total }`
  - `ConversationDetailResponse` — messages array with role, token_count, classification, content_preview; context_management_events with strategy, tokens_before, tokens_after, utilization
  - `ContextWindowTrendResponse` — array of `{ timestamp, agent_slug, provider, model, utilization_percentage, strategy_applied }`
  - `ErrorResponse` — { error: string, details?: object, timestamp: datetime }
  - `PaginationMetadata` — { page, page_size, total_count, has_next_page }
- **Why**: Ensures frontend and backend share consistent type definitions; IDE autocomplete confirms correct usage

### `src/routes/api/telemetry/+server.ts`

- **Action**: create
- **What**:
  - GET handler for `/api/telemetry`
  - Query parameters: `project_id`, `agent_slug`, `provider`, `model`, `from` (YYYY-MM-DD), `to` (YYYY-MM-DD), `page` (default 1), `page_size` (default 100, max 1000)
  - Validate all parameters using Zod schemas
  - Call `db.getTelemetryRecords(filters, offset, limit)` from database module
  - Return `TelemetryDataResponse` with pagination metadata
  - HTTP 400 for invalid filters, 500 for database errors
- **Why**: Provides full telemetry data with filtering and pagination; frontend uses this for drill-down views

### `src/routes/api/telemetry/summary/+server.ts`

- **Action**: create
- **What**:
  - GET handler for `/api/telemetry/summary`
  - Query parameters: `project_id`, `agent_slug`, `from`, `to`
  - Validate parameters; use defaults if not provided (last 7 days)
  - Call `db.getTokenSummary(filters)` to aggregate metrics
  - Calculate derived metrics: cache_hit_rate = cache_read / (cache_read + input), avg_cost = total_cost / request_count
  - Return `TelemetrySummaryResponse` (single object, not array)
  - HTTP 200 with empty summary if no data found (don't 404)
- **Why**: Powers dashboard summary cards; single aggregated query is fast even for large datasets

### `src/routes/api/tokens/+server.ts`

- **Action**: create
- **What**:
  - GET handler for `/api/tokens`
  - Query parameters: `timeframe` (hour | day | week, default "day"), `project_id`, `agent_slug`, `provider`, `from`, `to`
  - Call `db.getTokenTrends(filters, timeframe)` for time-series data
  - Return `TokenTrendResponse` — array of { timestamp, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, request_count }
  - Group by timeframe: hour uses `strftime('%Y-%m-%d %H:00:00', timestamp)`, day uses `DATE(timestamp)`, week uses `strftime('%Y-W%W', timestamp)`
  - Fill gaps with zero rows (COALESCE) so frontend charts don't have holes
  - HTTP 400 for invalid timeframe, 200 with empty array if no data
- **Why**: Powers token usage chart; time-bucketing is database-efficient and avoids frontend aggregation

### `src/routes/api/cache/+server.ts`

- **Action**: create
- **What**:
  - GET handler for `/api/cache`
  - Query parameters: `group_by` (agent | provider | model, default "provider"), `from`, `to`
  - Call `db.getCacheMetrics(filters, groupBy)` to aggregate cache efficiency per group
  - Return `CacheMetricResponse` — array of { group_value, cache_read_tokens, cache_write_tokens, total_requests, cache_hit_rate }
  - Cache hit rate = cache_read / (input_tokens) for that group (or 0 if no input tokens)
  - Sort by cache_hit_rate descending
  - HTTP 400 for invalid group_by, 200 with empty array if no data
- **Why**: Powers cache efficiency dashboard; groups by agent/provider/model for comparative analysis

### `src/routes/api/cost/+server.ts`

- **Action**: create
- **What**:
  - GET handler for `/api/cost`
  - Query parameters: `group_by` (agent | provider | model, default "provider"), `from`, `to`
  - Call `db.getCostBreakdown(filters, groupBy)` to aggregate costs per group
  - Return `CostBreakdownResponse` — array of { group_value, total_cost_usd, request_count, avg_cost_per_request, cost_percentage_of_total }
  - Calculate percentage as: (group_cost / total_cost) \* 100
  - Sort by total_cost descending
  - HTTP 400 for invalid group_by, 200 with empty array if no data
- **Why**: Powers cost analysis dashboard; shows which agents/providers/models are most expensive

### `src/routes/api/conversations/[id]/+server.ts`

- **Action**: create
- **What**:
  - GET handler for `/api/conversations/:id`
  - URL parameter: `id` (conversation_id string)
  - Call `db.getConversationDetails(conversationId)` to fetch all requests and messages
  - Return `ConversationDetailResponse` — { conversation_id, agent_slug, project_id, requests: [ { id, timestamp, provider, model, input_tokens, output_tokens, cost_usd, duration_ms, messages: [...], context_events: [...] } ] }
  - Nested array of llm_request_messages and context_management_events per request
  - Sort by timestamp ascending
  - HTTP 404 if conversation_id has no records, 200 with empty requests array if conversation exists but has no requests
- **Why**: Powers conversation inspection view; shows full message history and context management events

### `src/routes/api/context-windows/+server.ts`

- **Action**: create
- **What**:
  - GET handler for `/api/context-windows`
  - Query parameters: `threshold` (percentage, default 80), `from`, `to`, `agent_slug`, `provider`, `model`
  - Call `db.getContextWindowTrends(filters, threshold)` to find agents/models approaching their context limit
  - Return `ContextWindowTrendResponse` — array of { timestamp, agent_slug, provider, model, utilization_percentage, strategy_applied }
  - Include only requests where utilization >= threshold
  - Sort by utilization descending
  - HTTP 400 for invalid threshold, 200 with empty array if no data
- **Why**: Alerts frontend to context window pressure; helps identify agents that need optimization

### `src/lib/server/database.ts` — Query Functions (Detailed Implementation)

#### `getTokenSummary(filters: Filters): TokenSummaryData`

```sql
SELECT
  COUNT(*) as request_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(cache_read_tokens) as total_cache_read_tokens,
  SUM(cache_write_tokens) as total_cache_write_tokens,
  SUM(cost_usd) as total_cost_usd,
  AVG(duration_ms) as avg_duration_ms,
  MIN(timestamp) as first_timestamp,
  MAX(timestamp) as last_timestamp
FROM llm_requests
WHERE [filters applied as AND conditions]
```

- Filters: agent_slug, project_id, provider, model, date_range (WHERE timestamp >= from AND timestamp <= to)
- All filters are optional; omit WHERE clause if no filters provided

#### `getTokenTrends(filters: Filters, timeframe: "hour" | "day" | "week"): TokenTrendData[]`

```sql
WITH time_buckets AS (
  SELECT
    CASE
      WHEN ? = 'hour' THEN strftime('%Y-%m-%d %H:00:00', timestamp)
      WHEN ? = 'day' THEN DATE(timestamp)
      WHEN ? = 'week' THEN strftime('%Y-W%W', timestamp)
    END as bucket,
    input_tokens, output_tokens, cache_read_tokens, cache_write_tokens
  FROM llm_requests
  WHERE [filters applied]
)
SELECT
  bucket as timestamp,
  SUM(input_tokens) as input_tokens,
  SUM(output_tokens) as output_tokens,
  SUM(cache_read_tokens) as cache_read_tokens,
  SUM(cache_write_tokens) as cache_write_tokens,
  COUNT(*) as request_count
FROM time_buckets
GROUP BY bucket
ORDER BY bucket ASC
```

- Fill gaps: if a bucket has no data, create a row with all tokens = 0 and request_count = 0
- This prevents frontend charts from showing disconnected lines

#### `getCacheMetrics(filters: Filters, groupBy: "agent" | "provider" | "model"): CacheMetricData[]`

```sql
SELECT
  CASE
    WHEN ? = 'agent' THEN agent_slug
    WHEN ? = 'provider' THEN provider
    WHEN ? = 'model' THEN model
  END as group_value,
  SUM(cache_read_tokens) as cache_read_tokens,
  SUM(cache_write_tokens) as cache_write_tokens,
  COUNT(*) as total_requests,
  ROUND(100.0 * SUM(cache_read_tokens) / NULLIF(SUM(input_tokens), 0), 2) as cache_hit_rate
FROM llm_requests
WHERE [filters applied]
GROUP BY group_value
ORDER BY cache_hit_rate DESC
```

- cache_hit_rate is the percentage of input tokens that came from cache
- NULLIF prevents division by zero; use 0.0 if denominator is zero

#### `getCostBreakdown(filters: Filters, groupBy: "agent" | "provider" | "model"): CostBreakdownData[]`

```sql
WITH costs AS (
  SELECT
    CASE
      WHEN ? = 'agent' THEN agent_slug
      WHEN ? = 'provider' THEN provider
      WHEN ? = 'model' THEN model
    END as group_value,
    cost_usd,
    COUNT(*) as request_count
  FROM llm_requests
  WHERE [filters applied]
  GROUP BY group_value
),
totals AS (
  SELECT SUM(cost_usd) as total_cost FROM costs
)
SELECT
  group_value,
  SUM(cost_usd) as total_cost_usd,
  COUNT(*) as request_count,
  ROUND(SUM(cost_usd) / COUNT(*), 4) as avg_cost_per_request,
  ROUND(100.0 * SUM(cost_usd) / (SELECT total_cost FROM totals), 2) as cost_percentage_of_total
FROM costs
GROUP BY group_value
ORDER BY total_cost_usd DESC
```

#### `getTelemetryRecords(filters: Filters, limit: number, offset: number): TelemetryRecord[]`

```sql
SELECT
  id, agent_slug, project_id, provider, model, conversation_id,
  input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
  cost_usd, duration_ms, timestamp
FROM llm_requests
WHERE [filters applied]
ORDER BY timestamp DESC
LIMIT ? OFFSET ?
```

- Always order by timestamp descending (newest first)
- Pagination: limit defaults to 100, offset = (page - 1) \* limit

#### `getConversationDetails(conversationId: string): ConversationDetailData`

```sql
SELECT
  r.id, r.timestamp, r.agent_slug, r.project_id, r.provider, r.model,
  r.input_tokens, r.output_tokens, r.cache_read_tokens, r.cache_write_tokens,
  r.cost_usd, r.duration_ms,
  -- Nested: messages for this request
  (SELECT json_group_array(json_object(
    'id', m.id, 'role', m.role, 'classification', m.classification,
    'token_count', m.token_count, 'content_preview', m.content_preview
  )) FROM llm_request_messages m WHERE m.llm_request_id = r.id) as messages,
  -- Nested: context events for this request
  (SELECT json_group_array(json_object(
    'id', c.id, 'strategy', c.strategy, 'tokens_before', c.tokens_before,
    'tokens_after', c.tokens_after, 'utilization', c.utilization
  )) FROM context_management_events c WHERE c.llm_request_id = r.id) as context_events
FROM llm_requests r
WHERE r.conversation_id = ?
ORDER BY r.timestamp ASC
```

- Uses SQLite's `json_group_array()` and `json_object()` to build nested JSON structures
- Returns one row per request; each row contains the messages and context events as JSON arrays

#### `getContextWindowTrends(filters: Filters, threshold: number): ContextWindowTrendData[]`

```sql
SELECT
  timestamp, agent_slug, provider, model, utilization as utilization_percentage,
  strategy as strategy_applied
FROM context_management_events
INNER JOIN llm_requests ON context_management_events.llm_request_id = llm_requests.id
WHERE context_management_events.utilization >= ? AND [filters applied]
ORDER BY utilization DESC
```

- filters apply to llm_requests table (agent_slug, provider, model, date_range)
- threshold is a percentage (0-100); return only events >= threshold

## Database Indexing Strategy

Create indexes on frequently filtered columns to speed up queries:

```sql
CREATE INDEX idx_llm_requests_timestamp ON llm_requests(timestamp DESC);
CREATE INDEX idx_llm_requests_agent_slug ON llm_requests(agent_slug);
CREATE INDEX idx_llm_requests_project_id ON llm_requests(project_id);
CREATE INDEX idx_llm_requests_provider ON llm_requests(provider);
CREATE INDEX idx_llm_requests_model ON llm_requests(model);
CREATE INDEX idx_llm_requests_conversation_id ON llm_requests(conversation_id);
CREATE INDEX idx_llm_request_messages_request_id ON llm_request_messages(llm_request_id);
CREATE INDEX idx_context_management_events_request_id ON context_management_events(llm_request_id);
CREATE INDEX idx_message_carry_runs_conversation_id ON message_carry_runs(conversation_id);
```

**Rationale**:

- timestamp DESC for sorting by recency (most queries want newest-first)
- agent_slug, project_id, provider, model for WHERE clause filtering
- conversation_id for detail view lookups
- foreign key indexes for JOIN performance
- Don't index every column; focus on high-cardinality columns used in WHERE/ORDER BY/JOIN

## Execution Order

### 1. Create Database Module with Query Builders

- Create `src/lib/server/database.ts` with better-sqlite3 initialization
- Implement path expansion for `~/.tenex/analysis.db` (use `path.expandUser()` or equivalent)
- Implement `getTokenSummary()`, `getTokenTrends()`, `getCacheMetrics()`, `getCostBreakdown()`, `getTelemetryRecords()`, `getConversationDetails()`, `getContextWindowTrends()` functions
- Add error handling for missing/inaccessible database
- Verify: `node -e "const db = require('./src/lib/server/database.ts'); console.log(db.getTokenSummary())"` returns expected object structure (or empty object if no data)

### 2. Create Validation Schemas

- Create `src/lib/server/validators.ts` with Zod schemas for all query parameters
- Implement: DateRange, ProjectId, AgentSlug, Provider, Model, TimeFrame, Pagination, and endpoint-specific filters
- Export validation helper functions
- Verify: `npm run build` compiles without TypeScript errors

### 3. Expand Type Definitions

- Modify `src/lib/api/types.ts` to add all backend response types
- Ensure types match database query return values
- Add JSDoc comments explaining each type's purpose
- Verify: TypeScript type checking passes (`tsc --noEmit`)

### 4. Create Telemetry Summary Endpoint

- Create `src/routes/api/telemetry/summary/+server.ts`
- Implement GET handler with query parameter validation
- Call `db.getTokenSummary(filters)` and return `TelemetrySummaryResponse`
- Add error handling and HTTP status codes
- Verify: `curl http://localhost:5173/api/telemetry/summary?from=2024-01-01&to=2024-01-31` returns valid JSON matching `TelemetrySummaryResponse` interface

### 5. Create Full Telemetry Endpoint

- Create `src/routes/api/telemetry/+server.ts`
- Implement GET handler with query parameters: project_id, agent_slug, provider, model, from, to, page, page_size
- Call `db.getTelemetryRecords(filters, limit, offset)` and return `TelemetryDataResponse`
- Include pagination metadata (page, page_size, total_count, has_next_page)
- Verify: `curl 'http://localhost:5173/api/telemetry?page=1&page_size=50'` returns paginated results

### 6. Create Token Trends Endpoint

- Create `src/routes/api/tokens/+server.ts`
- Implement GET handler with query parameters: timeframe, project_id, agent_slug, provider, from, to
- Call `db.getTokenTrends(filters, timeframe)` and return `TokenTrendResponse`
- Ensure time gaps are filled with zero rows
- Verify: `curl 'http://localhost:5173/api/tokens?timeframe=day'` returns array with consistent 24-hour buckets

### 7. Create Cache Metrics Endpoint

- Create `src/routes/api/cache/+server.ts`
- Implement GET handler with query parameters: group_by, from, to
- Call `db.getCacheMetrics(filters, groupBy)` and return `CacheMetricResponse`
- Verify: `curl 'http://localhost:5173/api/cache?group_by=provider'` returns metrics grouped by provider

### 8. Create Cost Breakdown Endpoint

- Create `src/routes/api/cost/+server.ts`
- Implement GET handler with query parameters: group_by, from, to
- Call `db.getCostBreakdown(filters, groupBy)` and return `CostBreakdownResponse`
- Verify: `curl 'http://localhost:5173/api/cost?group_by=agent'` returns cost breakdown by agent

### 9. Create Conversation Detail Endpoint

- Create `src/routes/api/conversations/[id]/+server.ts`
- Implement GET handler with URL parameter: id (conversation_id)
- Call `db.getConversationDetails(id)` and return `ConversationDetailResponse`
- Handle missing conversations gracefully (404 or empty array)
- Verify: `curl 'http://localhost:5173/api/conversations/abc123'` returns conversation with messages and context events

### 10. Create Context Window Endpoint

- Create `src/routes/api/context-windows/+server.ts`
- Implement GET handler with query parameters: threshold, from, to, agent_slug, provider, model
- Call `db.getContextWindowTrends(filters, threshold)` and return `ContextWindowTrendResponse`
- Verify: `curl 'http://localhost:5173/api/context-windows?threshold=80'` returns context events above 80% utilization

### 11. Test All Endpoints

- Create `src/routes/api/__tests__/endpoints.test.ts` with tests for each route
- Test valid queries, invalid filters, pagination, missing data scenarios
- Test error responses (400, 404, 500)
- Run `npm run test` and verify all tests pass
- Verify: `npm run test -- --coverage` shows >80% coverage of database query functions

### 12. Performance Validation

- Insert 10,000+ mock rows into analysis.db (or use production data)
- Run each endpoint with large date ranges (full year)
- Verify response times are < 500ms (excluding network latency)
- Check that database indexes are being used (EXPLAIN QUERY PLAN in sqlite3 CLI)
- Add slow-query logging (queries > 500ms) to `src/lib/server/database.ts`

## Verification

### API Endpoint Contracts

**All endpoints return responses matching TypeScript interfaces** (no type mismatches):

- `curl http://localhost:5173/api/telemetry/summary` returns object matching `TelemetrySummaryResponse`
- `curl http://localhost:5173/api/telemetry?page=1` returns object with `data: TelemetryRecord[]` and `pagination: PaginationMetadata`
- `curl http://localhost:5173/api/tokens?timeframe=day` returns `TokenTrendResponse` array with consistent time buckets
- `curl http://localhost:5173/api/cache?group_by=provider` returns `CacheMetricResponse` array sorted by cache_hit_rate DESC
- `curl http://localhost:5173/api/cost?group_by=model` returns `CostBreakdownResponse` array with cost percentages summing to ~100%
- `curl http://localhost:5173/api/conversations/xyz` returns conversation with nested messages and context_events
- `curl http://localhost:5173/api/context-windows?threshold=85` returns events with utilization >= 85

### Error Handling

- `curl http://localhost:5173/api/telemetry?from=invalid-date` returns HTTP 400 with error message
- `curl http://localhost:5173/api/tokens?timeframe=invalid` returns HTTP 400
- `curl http://localhost:5173/api/conversations/nonexistent` returns HTTP 404 or empty array with 200
- Database unavailable (delete analysis.db): endpoints return HTTP 500 with structured error or gracefully return empty data
- All error responses include `error` string and optional `details` object

### Query Performance

- `npm run test` passes all tests with >80% coverage
- No query takes > 500ms on a database with 100,000+ rows
- EXPLAIN QUERY PLAN shows index usage for WHERE/JOIN clauses
- Pagination works correctly: page=1, page_size=100 returns different results than page=2
- Time-series queries fill gaps: no missing hours/days in time-bucketed results

### Type Safety

- `tsc --noEmit` reports no TypeScript errors
- All database query functions have explicit return types
- Route handlers have no `any` types; all parameters and responses are strongly typed
- Frontend code using API client has full type inference (IDE autocomplete works)

### Database Integrity

- All queries are parameterized (no SQL injection vectors)
- Database is opened in read-only mode (no accidental writes)
- Foreign key constraints are respected (no orphaned references)
- Date filtering works across timezones (use UTC for all timestamps)
