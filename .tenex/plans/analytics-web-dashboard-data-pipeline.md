# Data Pipeline & Real-Time Updates — TENEX Analytics Web Dashboard

## Context

The TENEX Analytics Web Dashboard will visualize token usage, cache efficiency, context window pressure, and cost data from `~/.tenex/analysis.db`. The database contains:

- `llm_requests` — one row per LLM call with token counts, costs, timing, and model info
- `llm_request_messages` — message-level breakdown for each request (role, classification, token count, content preview)
- `context_management_events` — context manager pressure events (strategy, tokens_before, tokens_after, utilization)
- `message_carry_runs` — message carry/pruning runs

The dashboard expects to handle **hundreds of thousands of rows** with variable query patterns (drill-down by project/agent/provider/model/time range, conversation inspection, context window analysis).

**Architecture Decision:** Direct SQLite access via SvelteKit server routes using `better-sqlite3`. No separate API server layer. This simplifies the stack and is appropriate for a local analytics tool.

## Approach

This plan establishes a **multi-layered data pipeline** with clear separation of concerns:

1. **Server-Side Data Layer** — SvelteKit routes and database connection management
2. **Query Strategy** — efficient SQL patterns for different dashboard views
3. **Client-Side Caching & State** — Svelte stores with smart invalidation
4. **Real-Time Patterns** — lightweight polling for summary metrics, on-demand fetching for drill-down
5. **Performance Optimization** — pagination, aggregation, query optimization
6. **Resilience** — error recovery, graceful degradation, monitoring

This approach prioritizes:
- **Fast initial page load** via SvelteKit `load` functions (server-side rendering)
- **Snappy filter interactions** via cached Svelte stores with smart revalidation
- **No memory leaks** through explicit cache eviction and connection cleanup
- **Observability** via structured query logging and performance metrics

### Alternatives Considered

**Option A: GraphQL with Apollo Client**
- Rejected: Adds complexity for a local, single-user tool. Better-suited for multi-user APIs.

**Option B: Pre-computed aggregations (hourly rollups stored in separate tables)**
- Rejected: Over-engineered for the current use case. On-demand aggregation is adequate given local disk I/O speed.

**Option C: WebSocket with server-pushed updates**
- Deferred: Lower priority. Polling is sufficient. WebSocket can be added later if needed.

**Option D: IndexedDB-based local cache**
- Rejected: SQLite is the source of truth; local browser cache adds complexity without significant benefit.

## File Changes

### `src/lib/server/database.ts` — Database Connection Singleton
- **Action**: Create
- **What**: Establish and manage a single persistent `better-sqlite3` connection to `~/.tenex/analysis.db`. Provide helper methods for common queries (with caching support indicators).
- **Why**: A singleton connection prevents resource leaks, simplifies error handling, and centralizes database access patterns. This is the foundation for all data fetching.

### `src/lib/server/query-service.ts` — Query Service Wrapper
- **Action**: Create
- **What**: Wrap the database connection with type-safe, reusable query methods. Expose methods like `getUsageTotals()`, `getConversationSummaries()`, `getRequestMessageBreakdown()`, and `getContextEvents()`. Each method should:
  - Accept well-defined filter options (time range, project ID, agent slug, etc.)
  - Return structured TypeScript types
  - Include query performance logging
  - Support pagination via cursor-based approach for large result sets
- **Why**: Centralizes SQL logic, enables reuse across endpoints, and provides a testable abstraction layer for database access.

### `src/lib/server/cache.ts` — Server-Side Query Cache
- **Action**: Create
- **What**: Implement an in-memory LRU cache for query results with:
  - Time-based expiry (configurable per query type)
  - Manual invalidation triggers (e.g., on database file modification detection)
  - Cache hit/miss metrics for observability
  - Memory limits (max 100MB, LRU eviction)
- **Why**: Reduces repeated queries to the SQLite database, especially for frequently-accessed views (summary metrics). Avoids disk I/O for repeated drill-down filters.

### `src/routes/api/usage/+server.ts` — Usage Totals Endpoint
- **Action**: Create
- **What**: SvelteKit API route that accepts query parameters (time range, group-by dimensions, filters) and returns aggregated token usage and cache efficiency data. Support:
  - `?since=24h&until=now`
  - `?groupBy=project,agent,provider,model`
  - `?projectId=X&agentSlug=Y`
  - Returns JSON with row count, aggregated metrics, and cache status header
- **Why**: Provides cached aggregated view for dashboard summary cards. Fast response time is critical for UI responsiveness.

### `src/routes/api/conversations/+server.ts` — Conversations List Endpoint
- **Action**: Create
- **What**: API route for conversation-level aggregation. Support:
  - `?since=24h&limit=20&offset=0` (cursor-based pagination)
  - `?projectId=X&agentSlug=Y` (filtering)
  - Returns array of `{conversationId, agentSlug, requestCount, totalTokens, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, startedAt, endedAt}`
- **Why**: Powers the conversations table. Pagination prevents loading 100k+ rows at once.

### `src/routes/api/conversation/[id]/messages/+server.ts` — Message Breakdown Endpoint
- **Action**: Create
- **What**: API route for drilling into a specific conversation's message breakdown. Returns:
  - Per-message details: `{index, role, classification, estimatedTokens, preview, contentLength}`
  - Summary totals (tokens by role, by classification)
- **Why**: Enables deep inspection of individual conversations to understand context window usage and message composition.

### `src/routes/api/context-events/+server.ts` — Context Management Events Endpoint
- **Action**: Create
- **What**: API route for context management pressure analysis. Support filtering and grouping by agent, strategy, time range. Return aggregated events with utilization statistics.
- **Why**: Critical for identifying context window pressure and agents approaching limits.

### `src/lib/stores/cache.ts` — Client-Side Cache Store
- **Action**: Create
- **What**: Svelte stores for caching API responses with:
  - Invalidation on filter change (time range, project, agent, etc.)
  - Background revalidation trigger
  - Loading/error states
  - Type-safe access patterns
- **Why**: Prevents redundant API calls when the user navigates back to a previous filter state. Improves perceived performance.

### `src/lib/stores/polling.ts` — Polling Orchestration Store
- **Action**: Create
- **What**: Manage background polling for summary metrics. Expose:
  - `startPolling(interval: number)` — begin polling usage totals
  - `stopPolling()` — pause polling
  - `pollInterval: Writable<number>` — adjust polling frequency
  - Automatically cancels in-flight requests on filter change
- **Why**: Keeps summary metrics fresh in the background without blocking user interactions. Polling interval can be adjusted by user preference.

### `src/lib/types/api.ts` — Type Definitions
- **Action**: Create
- **What**: Define TypeScript interfaces for all API responses:
  - `UsageTotal`, `UsageTotalRow`, `CacheMetrics`
  - `Conversation`, `ConversationPage`
  - `ConversationMessage`, `MessageBreakdown`
  - `ContextEvent`, `ContextEventAggregation`
- **Why**: Enables type safety across API endpoints and client stores. Catches contract mismatches at compile time.

### `src/routes/+page.svelte` — Dashboard Main Page
- **Action**: Modify (in tandem with frontend architecture plan)
- **What**: Integrate data loading via:
  - SvelteKit `load` function for initial server-side data fetch (usage totals)
  - Client-side store initialization and polling setup
  - Filter controls that trigger revalidation
  - Error boundaries for graceful degradation
- **Why**: Ensures fast initial page load (server-side data) and responsive filter interactions (cached client stores).

### `src/lib/server/telemetry.ts` — Query Logging & Observability
- **Action**: Create
- **What**: Structured logging for:
  - Query execution time (slow query alerts for >500ms)
  - Cache hit/miss rates
  - API endpoint response times
  - Error tracking and stack traces
  - User action logging (filter changes, drill-downs)
- **Why**: Enables debugging performance issues, identifying slow queries, and understanding user behavior patterns.

### `src/lib/server/file-watcher.ts` — Database Change Detection
- **Action**: Create
- **What**: Optional file watcher on `~/.tenex/analysis.db` to detect when the database is updated by the TENEX backend. When changes detected, emit invalidation signal to clear server cache and trigger client revalidation.
- **Why**: Ensures dashboard reflects latest data when TENEX backend writes new telemetry. Avoids stale cache without relying on time-based expiry alone.

## Execution Order

### Phase 1: Foundation (Database Connection & Query Service)

1. **Create `src/lib/server/database.ts`**
   - Implement singleton connection to `~/.tenex/analysis.db` using `better-sqlite3`
   - Add error handling for missing database, connection failures
   - Export `getDatabase()` function
   - Verify: Run unit test confirming connection is reused across calls, cleanup on app shutdown

2. **Create `src/lib/server/query-service.ts`**
   - Implement `QueryService` class with methods:
     - `getUsageTotals(filters)` — aggregated token/cache metrics
     - `getConversationSummaries(filters)` — conversation-level summaries with pagination
     - `getConversationMessages(conversationId)` — message breakdown for one conversation
     - `getContextEvents(filters)` — context management events with aggregation
   - Each method should accept TypeScript types for filters, return typed results
   - Verify: Execute sample queries, measure execution time for 100k+ row dataset

3. **Create `src/lib/types/api.ts`**
   - Define all response types
   - Ensure type safety across endpoints
   - Verify: TypeScript compilation with strict mode, no `any` types

### Phase 2: Server-Side Caching & Monitoring

4. **Create `src/lib/server/cache.ts`**
   - Implement LRU cache with configurable TTL per query type
   - Cache key generation from filter parameters
   - Memory limit enforcement (100MB max, LRU eviction)
   - Metrics: hit/miss rates, evictions
   - Verify: Load test with repeated queries, confirm memory stays under limit

5. **Create `src/lib/server/telemetry.ts`**
   - Structured logging for queries, API endpoints, errors
   - Slow query detection (>500ms threshold)
   - Verify: Run queries and confirm logs appear with timing info

6. **Create `src/lib/server/file-watcher.ts`** (Optional)
   - Use `fs.watch()` on `~/.tenex/analysis.db`
   - Debounce file change events (100ms)
   - Emit cache invalidation signal
   - Verify: Modify database externally, confirm invalidation is triggered

### Phase 3: API Routes

7. **Create `src/routes/api/usage/+server.ts`**
   - Implement `GET` handler with query parameter parsing
   - Call `QueryService.getUsageTotals()` with filters
   - Set HTTP cache headers: `Cache-Control: max-age=30` (30-second cache)
   - Return JSON response
   - Verify: Call endpoint with curl, inspect response time and cache headers

8. **Create `src/routes/api/conversations/+server.ts`**
   - Implement cursor-based pagination (limit 50 rows per page)
   - Support filters: `since`, `until`, `projectId`, `agentSlug`, `limit`, `offset`
   - Return paginated results with `hasMore` flag
   - Cache with `max-age=60`
   - Verify: Paginate through 100k+ row dataset, confirm performance

9. **Create `src/routes/api/conversation/[id]/messages/+server.ts`**
   - Accept conversation ID from URL param
   - Return message breakdown with summaries by role/classification
   - No caching (always fresh)
   - Verify: Inspect conversation with 100+ messages, confirm all fields present

10. **Create `src/routes/api/context-events/+server.ts`**
    - Support grouping and filtering
    - Return aggregated context events with utilization percentiles
    - Cache with `max-age=60`
    - Verify: Query context events, confirm aggregations are correct

### Phase 4: Client-Side State Management

11. **Create `src/lib/stores/cache.ts`**
    - Implement stores for usage totals, conversations list, cache invalidation
    - Each store should:
      - Track loading and error states
      - Invalidate on filter change
      - Support background revalidation
    - Example: `usageStore = writable(null); filterStore.subscribe(() => usageStore.set(null))`
    - Verify: Change filter in browser, confirm store invalidates and refetches

12. **Create `src/lib/stores/polling.ts`**
    - Implement polling controller with start/stop/setInterval methods
    - Poll usage totals at configurable interval (default: 30s)
    - Cancel in-flight requests on filter change
    - Verify: Start polling, observe requests every 30s, change filter and confirm request cancellation

### Phase 5: Integration & Optimization

13. **Update `src/routes/+page.svelte`** (or relevant dashboard routes)
    - Add SvelteKit `load` function for initial server-side data fetch
    - Initialize polling and cache stores on mount
    - Wire filter controls to cache invalidation
    - Add error boundaries for graceful degradation
    - Verify: Load dashboard, observe fast initial render, filter interactions are snappy

14. **Performance Verification**
    - Measure initial page load time (target: <1s server-side data load)
    - Measure filter interaction latency (target: <200ms for cached response)
    - Profile memory usage over 1-hour session (target: <500MB)
    - Execute slow query detection (confirm >500ms queries are logged)
    - Verify: Load test simulating 100k+ row dataset, confirm all targets met

15. **Large Dataset Handling**
    - Implement time-series aggregation for charts (hourly rollups if needed)
    - Verify pagination works for conversations table with 100k+ rows
    - Test virtual scrolling on frontend (delegated to frontend architecture plan)
    - Verify: Load 1M-row dataset, confirm query times stay under 1s

### Phase 6: Resilience & Error Handling

16. **Database Connection Resilience**
    - Retry logic for connection failures (exponential backoff: 100ms, 500ms, 2s)
    - Graceful degradation if database is unavailable (show error message, not crash)
    - Connection timeout of 5s
    - Verify: Kill database process, confirm app shows error gracefully

17. **Request Error Handling**
    - Retry failed API calls with exponential backoff (max 3 retries)
    - Timeout on API requests (30s)
    - User-facing error messages for failed data loads
    - Partial data loading (show cached data while refetching)
    - Verify: Simulate slow/failed queries, confirm UX gracefully handles it

18. **Race Condition Prevention**
    - Implement request deduplication: if user filters while a request is in-flight, cancel and use new request
    - Abort pattern: store AbortController per request, cancel on filter change
    - Use `requestIdempotencyKey` to detect stale responses
    - Verify: Rapidly change filters, confirm only latest response is shown

### Phase 7: Monitoring & Observability

19. **Query Performance Logging**
    - Log execution time for all queries
    - Alert when query exceeds 500ms
    - Capture slow query SQL and parameters
    - Verify: Run slow query, confirm alert is logged

20. **API Endpoint Metrics**
    - Log response time, status code, result set size for each endpoint
    - Track cache hit rate per endpoint
    - Verify: Call endpoints, confirm metrics are logged

21. **User Action Logging**
    - Log filter changes (time range, project, agent, etc.)
    - Log drill-down actions (navigation to conversation)
    - Log errors encountered by user
    - Verify: Perform dashboard actions, confirm logs capture intent

## Verification

### Initial Page Load Performance
```bash
# Verify server-side data fetch latency
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:5173/api/usage?since=24h

# Expected: <1s total time, <500ms database query time
```

### Filter Interaction Latency
```bash
# Test cached response time
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:5173/api/usage?since=24h
# (first call, hits database)

curl -w "@curl-format.txt" -o /dev/null -s http://localhost:5173/api/usage?since=24h
# (second call, hits cache)

# Expected: <50ms for cached response
```

### Large Dataset Handling
```bash
# Create a test database with 100k+ rows (simulated telemetry data)
# Run: npm run test:load-large-dataset

# Expected: all queries complete in <1s, memory usage stays <500MB
```

### Pagination
```bash
# Test conversations endpoint with pagination
curl 'http://localhost:5173/api/conversations?limit=50&offset=0'
curl 'http://localhost:5173/api/conversations?limit=50&offset=50'

# Expected: fast response, hasMore flag accurate
```

### Error Handling
```bash
# Simulate database unavailability
# Stop the database, confirm API returns 500 with error message
# Check client shows graceful error UI

# Restore database, confirm data reappears after retry
```

### Memory Leaks
```bash
# Run dashboard for 1 hour, periodically take heap snapshots
# Confirm memory usage plateaus under 500MB

# Expected: no unbounded growth, cached data is evicted
```

### Request Deduplication
```bash
# Open browser devtools, Network tab
# Rapidly change filter (e.g., click 5 times in 1 second)
# Expected: only last request completes, previous requests are aborted
```

### Cache Invalidation
```bash
# Change filter (time range, project, etc.)
# Confirm client-side cache is invalidated
# Confirm new request is sent to API
# Expected: cache miss, then cache hit on subsequent identical filter
```

### Monitoring
```bash
# Check application logs for:
# - Query execution times
# - Slow query alerts (>500ms)
# - Cache hit/miss rates
# - API endpoint metrics
# - Error tracking

# Expected: observability data is rich enough to diagnose performance issues
```

## Data Synchronization Strategy

### Detecting Database Updates

**Problem:** The TENEX backend continuously writes new telemetry to `~/.tenex/analysis.db`. The dashboard must reflect this new data without stale cache.

**Solution: Multi-level invalidation**

1. **Time-based expiry** (primary)
   - Usage totals: 30-second cache TTL (sufficient for typical filter interactions)
   - Conversations list: 60-second cache TTL (less frequently updated)
   - Conversation messages: No caching (always fetch fresh)

2. **File watching** (optional enhancement)
   - Monitor `~/.tenex/analysis.db` file modification time
   - On change detected, emit invalidation signal
   - Clear server cache, trigger client revalidation
   - Debounce file change events (100ms) to avoid thrashing

3. **User-triggered refresh** (explicit)
   - "Refresh Data" button in UI (delegated to frontend architecture)
   - Manual cache invalidation via action

### Long-Running Sessions

**Problem:** Users may keep the dashboard open for hours. Memory must remain stable.

**Solution:**

1. **Cache eviction**
   - LRU eviction when cache exceeds 100MB
   - Per-entry TTL enforcement (evict expired entries)

2. **Connection cleanup**
   - Periodically close and reopen database connection (every 1 hour)
   - Prevents connection resource leaks

3. **Polling pause**
   - Pause background polling if user hasn't interacted in 5 minutes
   - Resume on user interaction
   - Reduces unnecessary requests

4. **Heap monitoring**
   - Log heap usage every 5 minutes
   - Alert if heap exceeds 600MB
   - Force garbage collection if approaching limit

## Concurrency & Race Conditions

### Request Ordering

**Problem:** User filters rapidly. Multiple requests are in-flight. Responses arrive out-of-order.

**Solution:**

1. **Request ID tagging**
   - Assign unique ID to each request
   - Include ID in response headers
   - Client discards stale responses (ID < latest request ID)

2. **Request deduplication**
   - If user changes filter while request is in-flight, cancel in-flight request
   - Send new request with new filters
   - Only the latest request result is used

3. **Abort controller pattern**
   ```typescript
   // In polling.ts
   let currentAbortController: AbortController | null = null;

   function cancelInFlight() {
     if (currentAbortController) {
       currentAbortController.abort();
     }
   }

   async function poll() {
     cancelInFlight();
     currentAbortController = new AbortController();
     const response = await fetch('/api/usage', {
       signal: currentAbortController.signal,
     });
     // ...
   }
   ```

### Optimistic UI Updates

**Pattern:** Show UI change immediately, sync with server asynchronously.

Example: User changes time range filter
1. UI immediately shows "loading" state
2. New request sent to API
3. Old cached data still shown (if cache hit)
4. Response arrives, UI updates with new data
5. If request fails, error is shown, user can retry

## Database Connection Management

### Connection Singleton

**File:** `src/lib/server/database.ts`

```typescript
let connection: Database | null = null;

export function getDatabase(): Database {
  if (!connection) {
    const dbPath = path.resolve(os.homedir(), '.tenex', 'analysis.db');
    connection = new Database(dbPath, { readonly: true });
    connection.pragma('journal_mode = WAL'); // Better concurrency
  }
  return connection;
}

export function closeDatabase() {
  if (connection) {
    connection.close();
    connection = null;
  }
}

// On app shutdown
process.on('SIGTERM', () => closeDatabase());
```

### Connection Timeout & Error Handling

```typescript
const QUERY_TIMEOUT = 5000; // 5 seconds

function executeQuery(sql: string, params?: any[]): any[] {
  try {
    const db = getDatabase();
    const stmt = db.prepare(sql);
    
    // SQLite doesn't support per-query timeout; use interrupt
    const results: any[] = [];
    for (const row of stmt.iterate(...(params || []))) {
      results.push(row);
    }
    return results;
  } catch (error) {
    logger.error('Query failed', { sql, error });
    throw new Error(`Database query failed: ${error.message}`);
  }
}
```

### Connection Pooling Consideration

**Decision:** Single connection is sufficient. SQLite is file-based (no network overhead), and `better-sqlite3` serializes all operations. Connection pooling adds complexity without benefit.

## Performance Optimization Deep Dive

### Query Optimization

1. **Index Strategy**
   - Dashboard queries should use existing indices from TENEX backend schema
   - Verify TENEX has indices on: `timestamp`, `project_id`, `agent_slug`, `provider`, `model`, `conversation_id`
   - If missing, create indices in a migration (delegated to backend setup)

2. **Prepared Statements**
   - Use parameterized queries to prevent SQL injection and improve performance
   - SQLite caches prepared statements

   ```typescript
   const stmt = db.prepare(`
     SELECT project_id, SUM(input_tokens) as total_input
     FROM llm_requests
     WHERE timestamp > ?
     GROUP BY project_id
   `);
   const results = stmt.all(sinceTimestamp);
   ```

3. **LIMIT Clauses**
   - Always limit results: conversations endpoint returns max 50 rows
   - Prevents loading entire 100k+ row table into memory

4. **Aggregation Pushdown**
   - Perform aggregation in SQL, not in application code
   - `SUM()`, `COUNT()`, `AVG()` in database is faster than JavaScript

5. **Time-Series Aggregation**
   - For charts with millions of data points, pre-aggregate by hour/day
   - Example: Instead of plotting 1M individual requests, return 24 hourly buckets
   - Implemented via separate query method: `getUsageTimeSeries(timeGranularity: 'hour' | 'day')`

### Response Payload Optimization

1. **Field Selection**
   - Select only needed fields: `SELECT id, name, count FROM table` not `SELECT *`
   - Reduce JSON payload size

2. **Gzip Compression**
   - SvelteKit automatically gzip compresses API responses
   - Verify with `Content-Encoding: gzip` header

3. **Pagination**
   - Conversations endpoint returns max 50 rows (not 100k)
   - Client handles pagination and virtual scrolling (delegated to frontend)

4. **Number Formatting**
   - Return numbers as JSON numbers, not strings
   - Reduces payload size slightly

### Frontend Optimization (Delegated to Frontend Architecture Plan)

- Virtual scrolling for large tables (only render visible rows)
- Chart decimation for line charts with 1000+ points (plot every Nth point)
- Lazy loading of drill-down data

## Error Recovery & Resilience

### Database Connection Failures

**Scenario:** Database file is moved, deleted, or corrupted.

**Recovery:**
1. Detect error on first query attempt
2. Log error: `"Database connection failed: [reason]"`
3. Return HTTP 500 to client
4. Client shows error message: "Analytics data unavailable. Check that TENEX backend is running."
5. User can manually refresh (browser refresh)

### Slow Queries

**Scenario:** User has very large dataset (1M+ rows). Query takes >5 seconds.

**Recovery:**
1. Log slow query warning: `"Slow query detected: [sql] took [time]ms"`
2. If query exceeds QUERY_TIMEOUT (5s), database.interrupt() is called
3. Client retries with lower limits (e.g., conversations endpoint returns fewer rows)
4. User sees message: "Results limited due to large dataset. Refine filters."

### Network Failures (Client-Side)

**Scenario:** Network glitch causes API request to fail.

**Recovery:**
1. Retry with exponential backoff: 100ms, 500ms, 2s (max 3 attempts)
2. If all retries fail, show user message: "Unable to load data. Check your connection."
3. Show cached data if available (graceful degradation)
4. Provide manual "Retry" button

### Stale Cache

**Scenario:** TENEX backend writes new telemetry while dashboard is open. Dashboard shows old data.

**Recovery:**
1. Time-based expiry: cache entries expire after 30-60 seconds
2. File watcher (optional): detect database modification, invalidate cache immediately
3. User can manually refresh

## Observability & Monitoring Checklist

- [ ] Query execution time logging (threshold: >500ms)
- [ ] API endpoint response time metrics (per route)
- [ ] Cache hit/miss rates (per query type)
- [ ] Error tracking (database errors, API failures, client errors)
- [ ] User action logging (filter changes, drill-downs, navigation)
- [ ] Memory profiling (heap usage over time)
- [ ] Database file size monitoring (detect unbounded growth)
- [ ] Slow query detection with SQL logging
- [ ] Connection state monitoring (open/closed)
- [ ] Integration with TENEX observability infrastructure (if available)

**Implementation:** Use structured logging (JSON format) for easy parsing by external tools.

---

## Summary

This plan establishes a **high-performance, resilient data pipeline** for the TENEX Analytics Web Dashboard. Key principles:

1. **Direct SQLite access** via SvelteKit server routes (no separate API layer)
2. **Multi-level caching** (server-side LRU + client-side Svelte stores) with smart invalidation
3. **Lightweight polling** for summary metrics (30s interval) + on-demand fetching for drill-down
4. **Pagination and lazy loading** for large datasets (100k+ rows)
5. **Graceful error handling** with retry logic and fallback UI
6. **Comprehensive monitoring** for debugging and optimization

The implementation is phased: foundation → caching → API routes → client integration → optimization → resilience → observability. Each phase is independently verifiable.
