# TENEX Analytics Dashboard — Product Specification

**Status:** Phase 1 (Scaffolding) complete. Phase 2 (UI implementation) pending.  
**Last updated:** 2026-04-01  
**Owner:** Pablo

---

## 1. Purpose

A local web dashboard for Pablo to inspect TENEX's LLM telemetry — token consumption, cache efficiency, cost trends, and context window pressure — while agents run overnight. The primary audience is **one person (Pablo)** running TENEX locally on his machine.

This is a dev/ops tool, not a public product. Aesthetic: minimal, dark-first, information-dense.

---

## 2. Data Source

**Database:** `~/.tenex/analysis.db` (SQLite)  
**Access pattern:** Read-only, direct file access via `better-sqlite3` in SvelteKit server routes  
**No network dependency.** The app runs entirely locally.

### Core Tables

| Table                       | Key Columns                                                                                                                                                                            | Purpose                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `llm_requests`              | `agent_slug`, `project_id`, `provider`, `model`, `conversation_id`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`, `cost_usd`, `duration_ms`, `timestamp` | One row per LLM API call             |
| `llm_request_messages`      | `role`, `classification` (system/user/tool-call/tool-result), `token_count`, `content_preview`                                                                                         | Individual messages within a request |
| `context_management_events` | `strategy`, `tokens_before`, `tokens_after`, `utilization`                                                                                                                             | When context manager fires           |
| `message_carry_runs`        | _(carry/pruning metadata)_                                                                                                                                                             | Message carry & pruning state        |

**Path override:** Set `TENEX_DB_PATH` env var to point to a different database file.

---

## 3. What It Does (Feature Set)

### 3.1 Dashboard Overview (Phase 2 — next)

Homepage with key metrics at a glance:

- **Total tokens** (input + output breakdown)
- **Cache efficiency %** (cache read / total input × 100)
- **Total cost USD**
- **Total requests**
- Date range of data shown
- Charts: token usage over time (line), cache performance by model (bar)

### 3.2 Token Analysis Page (`/tokens`)

Drill-down into token usage:

- Time-series chart: input/output/cache-read/cache-write over time
- Group-by: hour / day / week
- Filter: project, agent, provider, model, date range
- Table: per-agent token breakdown

### 3.3 Cache Efficiency Page (`/cache`)

Cache hit rates and trends:

- Cache efficiency % by agent, provider, model
- Read vs write token ratio over time
- Heatmap or bar: which agents/models benefit most from caching

### 3.4 Cost Trends Page (`/costs`)

Cost breakdown:

- Total cost over time (line chart)
- Cost by: project, agent, provider, model (bar/pie)
- Most expensive agents/conversations
- Running daily/weekly totals

### 3.5 Context Window Pressure Page (`/context-windows`)

Agents approaching limits:

- Utilization trend per agent (line chart)
- Alert threshold: flag agents >80% utilization
- Context management events (when/how often pruning fires)
- Tokens before vs after pruning

### 3.6 Conversation Inspector (`/conversations/[id]`)

Per-conversation deep dive:

- Message sequence with role/classification and token count per message
- Token distribution: how much is system prompt vs user vs tool results
- Context window fill over the conversation's lifetime
- Cross-reference with Jaeger/telemetry URLs (if available)

### 3.7 Global Filters

Persistent filter bar applied across all pages:

- Project, agent slug, provider, model, date range
- State synced to URL query params (deep-linkable, refreshable)
- 300ms debounce on filter changes

---

## 4. Tech Stack

| Layer      | Choice                                  | Rationale                                 |
| ---------- | --------------------------------------- | ----------------------------------------- |
| Framework  | SvelteKit v2 (Svelte 5)                 | Pablo's stack                             |
| Database   | `better-sqlite3` (server-only)          | Direct file access, no server needed      |
| Charts     | Recharts v2                             | Svelte-compatible, good defaults          |
| Styling    | Tailwind CSS v3 + CSS custom properties | Dark mode via `dark:` classes             |
| State      | Native Svelte stores                    | No external lib, sufficient for scope     |
| Testing    | Vitest + @testing-library/svelte        | Vite-native, ecosystem fit                |
| TypeScript | Strict mode                             | Type safety across server/client boundary |

**No Nostr/NDK.** No external APIs. No cloud dependencies.

---

## 5. Architecture

```
Browser  →  SvelteKit client  →  SvelteKit server routes  →  better-sqlite3  →  ~/.tenex/analysis.db
                                        ↓
                                  JSON responses
                                        ↓
                              Svelte stores (telemetry, filters, theme)
                                        ↓
                              Recharts components + MetricCards
```

### API Endpoints (planned — Phase 2)

| Method | Endpoint                 | Description                                    |
| ------ | ------------------------ | ---------------------------------------------- |
| GET    | `/api/telemetry/summary` | Aggregate totals (tokens, cost, cache %)       |
| GET    | `/api/telemetry`         | Paginated rows, multi-dim filter               |
| GET    | `/api/tokens`            | Time-series token trends (hourly/daily/weekly) |
| GET    | `/api/cache`             | Cache efficiency by agent/provider/model       |
| GET    | `/api/cost`              | Cost breakdown by dimension                    |
| GET    | `/api/conversations/:id` | Conversation inspection with messages          |
| GET    | `/api/context-windows`   | Utilization trends + threshold alerts          |

All endpoints accept: `?from=YYYY-MM-DD&to=YYYY-MM-DD&agent=<slug>&project=<id>&provider=<name>&model=<name>`

### Current API Endpoints (Phase 1 — implemented)

| Endpoint                 | File                                          | Status |
| ------------------------ | --------------------------------------------- | ------ |
| `/api/telemetry/summary` | `src/routes/api/telemetry/summary/+server.ts` | ✅     |
| `/api/telemetry`         | `src/routes/api/telemetry/+server.ts`         | ✅     |
| `/api/tokens`            | `src/routes/api/tokens/+server.ts`            | ✅     |
| `/api/cache`             | `src/routes/api/cache/+server.ts`             | ✅     |

---

## 6. Current State (Phase 1 Complete)

### What's built

- SvelteKit project fully scaffolded and building cleanly
- `better-sqlite3` connected, singleton pattern, read-only, path from env or `~/.tenex/analysis.db`
- 4 API server routes implemented
- Svelte stores: `telemetry.ts`, `theme.ts`
- Utility modules: `format.ts` (number/cost/percent formatters), `colors.ts`
- Base components: `Card.svelte`, `Header.svelte`, `ThemeToggle.svelte`
- Layout: `+layout.svelte`, root `+page.svelte` (dashboard overview skeleton)
- API client: `src/lib/api/client.ts` + `src/lib/api/types.ts`
- Dark theme CSS variables, Tailwind dark mode configured
- Dev server starts successfully on `localhost:5173`
- `README.md`, `DEVELOPMENT.md`, `.env.example`

### What the homepage currently shows (Phase 1 skeleton)

- **3 metric cards:** Total Tokens, Cache Efficiency %, Total Cost USD
- **2 chart placeholders** labeled "Phase 2"
- Loads live data from `/api/telemetry/summary` on mount

### What's missing (Phase 2 work)

- [ ] Real charts (Recharts — token trends, cache breakdown)
- [ ] Additional pages: `/tokens`, `/cache`, `/costs`, `/context-windows`
- [ ] Conversation inspector route `/conversations/[id]`
- [ ] Global filter bar (project/agent/model/date — URL-synced)
- [ ] Additional API endpoints: `/api/cost`, `/api/conversations/:id`, `/api/context-windows`
- [ ] Data polling / auto-refresh
- [ ] Mobile responsive polish

---

## 7. Design Principles

1. **Dark-first.** Primary aesthetic. Light mode toggle exists but dark is default.
2. **Data-dense.** No marketing fluff. Numbers front and center.
3. **Local-only.** No telemetry on the telemetry tool. Runs on localhost.
4. **Graceful degradation.** If `analysis.db` doesn't exist, the UI loads with zeros — no broken state.
5. **URL-addressable state.** Filters live in URL params. Deep linking works. Refresh works.

---

## 8. Running the App

```bash
# Install
npm install

# Run
npm run dev  # → http://localhost:5173

# Optional: point to a different DB
TENEX_DB_PATH=/path/to/analysis.db npm run dev
```

---

## 9. Phase 2 Execution Plan

The next thing to build is the full UI layer:

1. **Add Recharts** to the homepage (token usage over time line chart, cache by model bar chart)
2. **Filter bar component** — project/agent/provider/model/date pickers, URL-synced
3. **Token page** (`/tokens`) — time-series with aggregation selector
4. **Cache page** (`/cache`) — efficiency breakdown by agent/provider
5. **Cost page** (`/costs`) — cost trends + breakdown
6. **Context window page** (`/context-windows`) — utilization + pruning events
7. **Conversation inspector** (`/conversations/[id]`) — message-level token breakdown
8. **Additional API routes** — `/api/cost`, `/api/conversations/:id`, `/api/context-windows`
9. **Auto-refresh** — polling every N seconds (configurable)

Implementation should follow the detailed plans in:

- `.tenex/plans/analytics-web-dashboard-frontend.md`
- `.tenex/plans/analytics-web-dashboard-backend.md`
