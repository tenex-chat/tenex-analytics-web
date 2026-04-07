# Development Guide

## Overview

TENEX Analytics Web Dashboard is a SvelteKit application that reads from a local SQLite database (`~/.tenex/analysis.db`) and serves analytics data through SvelteKit server routes to a Svelte frontend.

## Prerequisites

- **Node.js 18+** — required for SvelteKit and better-sqlite3
- **npm 9+** — package manager
- **TENEX installed** — optional; provides the analysis database at `~/.tenex/analysis.db`

## Local Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd tenex-analytics-web-k8m2p4

# 2. Install dependencies
npm install

# 3. (Optional) Configure environment
cp .env.example .env
# Edit .env if you want to override TENEX_DB_PATH

# 4. Start the development server
npm run dev
```

The dashboard will be available at [http://localhost:5173](http://localhost:5173).

If `~/.tenex/analysis.db` doesn't exist, the API routes return empty/zero data gracefully — the UI still loads without errors.

## Architecture

### Data Flow

```
Browser → SvelteKit server route → better-sqlite3 → ~/.tenex/analysis.db
                                ↓
                         JSON response
                                ↓
                    Svelte component (chart/metric)
```

### Key Directories

| Path                  | Purpose                                                              |
| --------------------- | -------------------------------------------------------------------- |
| `src/routes/api/`     | Server-only SvelteKit route handlers; all SQLite queries happen here |
| `src/lib/server/`     | Server-only modules (database connection, query utilities)           |
| `src/lib/components/` | Reusable Svelte UI components                                        |
| `src/lib/stores/`     | Svelte writable stores for client-side state                         |
| `src/lib/api/`        | Typed fetch wrapper and TypeScript interfaces for API responses      |
| `src/lib/utils/`      | Pure utility functions (formatting, color palette)                   |

### Server vs. Client Boundary

SvelteKit enforces a strict server/client boundary:

- Files under `src/lib/server/` are **server-only** and cannot be imported by client components
- Files under `src/routes/api/` export `GET`/`POST` handlers that run on the server
- The `better-sqlite3` import lives exclusively in `src/lib/server/database.ts`

## SQLite Schema Expectations

The dashboard reads from `~/.tenex/analysis.db`. The expected schema (inferred from TENEX):

```sql
-- Telemetry events table (primary table queried)
CREATE TABLE IF NOT EXISTS telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,           -- ISO 8601: "2024-01-15T10:30:00.000Z"
    model TEXT NOT NULL,               -- e.g. "claude-3-5-sonnet-20241022"
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cache_read_tokens INTEGER DEFAULT 0,
    cache_write_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0.0,
    agent_name TEXT,
    project_id TEXT,
    conversation_id TEXT
);
```

> **Note:** The actual schema may differ. The `src/lib/server/database.ts` module handles missing tables/columns gracefully by catching SQL errors and returning empty results.

## Database Module

`src/lib/server/database.ts` provides:

- **Singleton connection** — one `Database` instance per server process
- **Path expansion** — resolves `~` to `$HOME` for cross-platform compatibility
- **Graceful fallback** — returns `null` connection if the database file doesn't exist
- **Query utilities** — `getTokenSummary()`, `getTokenTrends()`, `getCacheMetrics()`, `getCostData()`

To override the database path in development:

```bash
# .env
TENEX_DB_PATH=/path/to/test.db
```

## API Routes

All API routes are in `src/routes/api/` and follow SvelteKit's `+server.ts` convention.

### `GET /api/telemetry`

Returns raw telemetry rows with optional date range filtering.

Query params: `from=YYYY-MM-DD`, `to=YYYY-MM-DD`

### `GET /api/telemetry/summary`

Returns aggregated totals:

```json
{
	"totalInputTokens": 1234567,
	"totalOutputTokens": 890123,
	"totalCacheReadTokens": 456789,
	"totalCacheWriteTokens": 123456,
	"totalCostUsd": 12.34,
	"requestCount": 42,
	"cacheEfficiencyPct": 27.3
}
```

### `GET /api/tokens`

Returns token usage trends grouped by day.

Query params: `from=YYYY-MM-DD`, `to=YYYY-MM-DD`

### `GET /api/cache`

Returns cache efficiency metrics grouped by model.

## Coding Conventions

### TypeScript

- Strict mode is enabled in `tsconfig.json` — no `any` types
- All API response types are defined in `src/lib/api/types.ts`
- Server-side query results are typed via `@types/better-sqlite3`
- Use `import type` for type-only imports

### Svelte Components

- Props are typed with `export let propName: Type`
- Use Svelte stores (`$store`) for shared state — not prop drilling
- Dark mode is handled via the `theme` store; use Tailwind's `dark:` prefix
- Component files use PascalCase: `Card.svelte`, `Header.svelte`

### Styling

- Tailwind utility classes are preferred over custom CSS
- Dark mode is enabled via `darkMode: 'class'` in `tailwind.config.js`
- Custom colors are defined as CSS variables in `src/app.css`
- Chart color palette is centralized in `src/lib/utils/colors.ts`

### File Naming

| Type               | Convention           | Example                      |
| ------------------ | -------------------- | ---------------------------- |
| Svelte components  | PascalCase           | `Card.svelte`                |
| TypeScript modules | camelCase            | `database.ts`, `client.ts`   |
| SvelteKit routes   | SvelteKit convention | `+page.svelte`, `+server.ts` |
| Test files         | `*.test.ts`          | `utils.test.ts`              |

### Imports

Use the `$lib` path alias for all imports from `src/lib/`:

```typescript
import { db } from '$lib/server/database';
import type { TelemetrySummary } from '$lib/api/types';
import { theme } from '$lib/stores/theme';
```

## Development Scripts

```bash
npm run dev           # Start dev server (HMR on http://localhost:5173)
npm run build         # Production build
npm run preview       # Preview production build
npm run test          # Run Vitest suite
npm run test:watch    # Watch mode
npm run lint          # ESLint check
npm run lint:fix      # Auto-fix ESLint violations
npm run format        # Prettier format
npm run format:check  # Check formatting without writing
```

## Testing

Tests live in `src/lib/__tests__/`. Run with:

```bash
npm run test
```

The testing stack:

- **Vitest** — test runner (Vite-aware, no separate config needed)
- **@testing-library/svelte** — component testing
- **happy-dom** — DOM implementation (faster than jsdom)

Focus test coverage on:

- Utility functions in `src/lib/utils/`
- API type validation
- Component rendering (happy path + error states)

## Troubleshooting

### Dev server fails to start

Check that all dependencies are installed: `npm install`

### Database not found errors

The dashboard works without a database — API routes return empty data. To use real data, ensure TENEX is installed and has run at least once (creating `~/.tenex/analysis.db`).

### better-sqlite3 native binding errors

If you see `Error: Cannot find module '...better_sqlite3.node'`, rebuild the native module:

```bash
npm rebuild better-sqlite3
```

This can happen after upgrading Node.js or switching architectures (e.g., x86 → ARM).

### TypeScript errors after adding a new API field

Update the interface in `src/lib/api/types.ts` first, then the server route, then the component. The TypeScript compiler will guide you through the remaining type errors.
