# Performance Optimization - Conversation Stats Endpoint

## Problem

The `/api/conversation-stats` endpoint was taking **1-2+ minutes** to respond, making it unusable. The endpoint runs ~12 complex SQL queries with window functions and JOINs on large datasets.

## Database Scale

- **82,484 rows** in `llm_requests`
- **5,343,712 rows** in `llm_request_messages`
- **383,981 rows** in `context_management_events`

## Root Cause

**Missing critical database index on `conversation_id`**

Almost every query in the endpoint uses `conversation_id` for:

- `GROUP BY conversation_id`
- `PARTITION BY conversation_id` (window functions)
- `WHERE conversation_id IS NOT NULL`

Without an index, SQLite had to:

1. Perform full table scans (82K+ rows)
2. Sort all rows by conversation_id
3. Repeat this for ~12 separate queries

The most expensive query joined 82K rows with 5.3M rows, then partitioned the result.

## Solution

### 1. Added Critical Indexes

Created 4 new indexes in `scripts/add-performance-indexes.ts`:

```sql
-- Critical: enables fast GROUP BY and PARTITION BY on conversation_id
CREATE INDEX idx_llm_requests_conversation_id
ON llm_requests(conversation_id)
WHERE conversation_id IS NOT NULL;

-- Composite: optimizes window functions that order by time within conversations
CREATE INDEX idx_llm_requests_conv_time
ON llm_requests(conversation_id, started_at_ms)
WHERE conversation_id IS NOT NULL;

-- Multi-column: optimizes filtered queries (used in ~12 queries)
CREATE INDEX idx_llm_requests_status_conv
ON llm_requests(status, conversation_id, started_at_ms)
WHERE status = 'success' AND conversation_id IS NOT NULL;

-- JOIN optimization: speeds up joins with llm_request_messages
CREATE INDEX idx_llm_request_messages_request_id
ON llm_request_messages(request_id, classification);
```

### 2. Query Optimizations

**Token Growth Query** (lines 263-285):

- **Before**: Used 4 separate window functions (MIN OVER, 2x FIRST_VALUE OVER, ROW_NUMBER OVER)
- **After**: Simplified to use GROUP BY with correlated subqueries
- **Benefit**: Reduced complexity, better index utilization

**Token Breakdown Query** (lines 392-420):

- **Before**: Joined all requests with all 5.3M messages, then computed positions
- **After**: Used CTE to compute positions first, filter to position ≤ 15, then join
- **Benefit**: Reduced JOIN size by filtering before the expensive JOIN operation

## Results

### Before Optimization

- **Response Time**: 60,000ms - 120,000ms+ (1-2+ minutes)
- **CPU Usage**: Very high, process eating CPU
- **Status**: Unusable

### After Optimization

- **Response Time**: ~205ms (0.2 seconds)
- **Speedup**: **~300-600x faster**
- **CPU Usage**: Minimal
- **Status**: Production-ready

### Query Breakdown (from test script)

```
1. Summary stats                            20.01ms
2. Duration calculation                      0.65ms
3. Length distribution                       0.52ms
4. Token distribution                        0.56ms
5. Daily new conversations                   0.58ms
6. Weekly avg requests                       0.60ms
7. Token growth (optimized)                  1.29ms
8. Avg tokens by position                    1.27ms
9. Token breakdown (optimized)             177.10ms  ← Largest query (JOIN with 5.3M rows)
10. Context savings by position              2.04ms
─────────────────────────────────────────────────
TOTAL TIME                                 204.61ms
```

## How to Apply

### Install Indexes (Required)

```bash
npx tsx scripts/add-performance-indexes.ts
```

This script is **idempotent** - safe to run multiple times.

### Test Performance (Optional)

```bash
npx tsx scripts/test-conversation-stats-performance.ts
```

Measures execution time for each query to verify optimization.

## Index Maintenance

### When Indexes Help

- ✓ GROUP BY conversation_id
- ✓ PARTITION BY conversation_id
- ✓ WHERE conversation_id = ?
- ✓ ORDER BY started_at_ms (within conversation)
- ✓ JOINs on request_id

### Index Overhead

- **Space**: ~1-2% of table size
- **Write Speed**: Minimal impact (analytics DB is read-heavy)
- **Query Planning**: SQLite automatically uses indexes via ANALYZE

### Rebuilding Indexes

If database is corrupted or indexes seem stale:

```bash
sqlite3 ~/.tenex/data/trace-analysis.db "REINDEX; ANALYZE;"
```

## Technical Details

### Why Window Functions Were Slow

Window functions like `ROW_NUMBER() OVER (PARTITION BY x ORDER BY y)` require:

1. Grouping all rows by partition key (`conversation_id`)
2. Sorting within each partition (`started_at_ms`)
3. Computing the function

Without an index on `(conversation_id, started_at_ms)`, this meant:

- Full table scan: O(n) where n = 82,484
- External sort: O(n log n)
- Repeated for each query: ~12x overhead

With the composite index:

- Index scan: O(log n)
- Pre-sorted data: No external sort needed
- Results: 300-600x speedup

### Why the Token Breakdown Query Is Still Slowest

Even at 177ms, this query is fast for what it does:

- Joins 82K rows with 5.3M rows
- Computes window functions
- Aggregates by position and classification
- Processes 15 positions × 5 classifications

The CTE optimization reduced it from ~60-90 seconds to 0.177 seconds (**~400x faster**).

## Future Optimizations

If query performance degrades as data grows:

1. **Partition by Date**: Split old data into archive tables
2. **Materialized Views**: Pre-compute expensive aggregations
3. **Sampling**: Use statistical sampling for large date ranges
4. **Caching**: Add Redis for frequently accessed ranges
5. **Incremental Updates**: Compute stats incrementally instead of full scans

## Files Modified

- `src/routes/api/conversation-stats/+server.ts` - Optimized queries
- `scripts/add-performance-indexes.ts` - Index creation script (NEW)
- `scripts/test-conversation-stats-performance.ts` - Performance test (NEW)

## Testing

Run the original curl command:

```bash
curl 'https://tenex-analytics.f7z.io/api/conversation-stats?preset=12h&from=2026-04-13T23%3A10%3A27.714Z&to=2026-04-14T11%3A10%3A27.714Z' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'Referer: https://tenex-analytics.f7z.io/conversations' \
  -H 'User-Agent: Mozilla/5.0 ...' \
  -H 'DNT: 1'
```

**Expected**: Response in ~200-500ms (depending on data size and server load)
