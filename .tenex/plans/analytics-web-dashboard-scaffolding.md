# Analytics Web Dashboard Scaffolding

## Context

The TENEX Analytics Web Dashboard is a greenfield SvelteKit project for visualizing LLM token usage, cache efficiency, and cost data from TENEX's SQLite telemetry database at `~/.tenex/analysis.db`. The project currently consists of an empty git repository with no dependencies, configuration, or structure.

The dashboard is a **local analytics webapp** with no Nostr integration or external API dependencies. SvelteKit server routes will query the SQLite database directly using better-sqlite3, serving JSON responses to the frontend. The frontend displays this data via responsive dark-themed charts and metrics.

Architecture:

- **Server**: SvelteKit route handlers in `src/routes/api/` query SQLite and return JSON
- **Client**: Svelte components fetch from local API routes and render charts/metrics
- **Database**: Direct read access to `~/.tenex/analysis.db` via better-sqlite3

## Approach

This plan establishes a production-ready SvelteKit foundation with thoughtful dependency selection based on ecosystem fit, ease of use, and alignment with the dark-themed aesthetic goal.

### Dependency Decisions

**SvelteKit** (v2.x) is the primary framework choice because:

- Tight Svelte integration with file-based routing reduces boilerplate
- Built-in TypeScript support with no additional config burden
- Vite for fast HMR and optimized builds
- Server-side rendering (SSR) capability for future enhancements (SEO, initial data loading)
- Native Svelte stores eliminate Redux-like state complexity for this dashboard use case
- **Server routes** (`src/routes/api/`) enable direct SQLite queries without external API server

**better-sqlite3** (v9.x) for SQLite database access:

- Synchronous API simplifies server route handlers
- Fast, reliable, widely used in Node.js ecosystem
- Direct read access to `~/.tenex/analysis.db`
- Type-safe with TypeScript support
- Runs in SvelteKit server context (route handlers, hooks)
- Rejected sql.js: WebAssembly-based, overkill for server-side SQLite
- Rejected sqlite3 npm: async callback-based API complicates route handlers

**Recharts** (v2.x) for data visualization:

- Built on React; Svelte integration via `svelte-recharts` wrapper OR mount React components in Svelte with minimal friction
- Rich, composable charting components (LineChart, BarChart, PieChart, ComposedChart)
- Excellent dark mode support through theming props
- Active maintenance and strong community
- Rejected D3: powerful but overkill for dashboard; steep learning curve
- Rejected Chart.js: less composable; requires manual DOM management in Svelte

**Tailwind CSS** (v3.x) for styling:

- Dark mode via `prefers-color-scheme` (built-in) and manual dark class toggle
- Utility-first approach aligns with rapid iteration and consistency
- Excellent dark theme palette support
- Integrates seamlessly with SvelteKit via PostCSS

**Vitest** (v1.x) for testing:

- Drop-in replacement for Jest with Vite config awareness
- Excellent TypeScript support with no additional setup
- Better performance for SvelteKit projects
- Svelte component testing via `@vitest/ui` and `@testing-library/svelte`

**State Management**: Native Svelte stores

- No external state library needed for this scope (single-page dashboard with local UI state)
- Stores are files in `src/lib/stores/`, imported directly into components
- Future addition of global state (e.g., user theme preference) requires zero refactor

**HTTP Client**: Typed fetch wrapper in `src/lib/api/client.ts`

- No axios or other library overhead
- Full TypeScript inference for request/response types
- Built-in abort controller and timeout patterns
- Keep it simple; add a client only if requirements justify it

**Styling Approach**: Tailwind + custom dark theme

- Dark theme provider using Svelte context (not external library)
- Theme state stored in Svelte store
- Persisted to localStorage for user preference
- CSS custom properties (variables) for brand colors overlaid on Tailwind

**Development & Build**:

- ESLint + Prettier for code quality and formatting
- Husky + lint-staged for pre-commit hooks (optional but recommended)
- npm scripts for dev, build, preview, test, lint
- No Docker in scaffolding; assume local development first

**No External APIs or Nostr Integration**:

- Dashboard is local-only; no Nostr, NDK, or external service dependencies
- All data sourced from `~/.tenex/analysis.db`
- SvelteKit server routes serve as the exclusive data layer

### Alternatives Considered

**Chart.js + svelte-chartjs**: Rejected because it requires imperative canvas management; Recharts' declarative component model is superior for Svelte.

**Pinia (Vue 3 store)**: Out of scope; Svelte stores are sufficient and avoid external state library overhead.

**Styled Components or emotion**: Rejected in favor of Tailwind for faster iteration, smaller bundle, and native dark mode support.

**tRPC for API**: Overkill for a single-page dashboard; typed fetch wrapper is simpler and equally type-safe.

## File Changes

### `package.json`

- **Action**: create
- **What**: Node.js project metadata, dependency versions, and npm scripts
- **Why**: Required for all Node.js projects; establishes dependency tree and build commands

### `tsconfig.json`

- **Action**: create
- **What**: TypeScript compiler configuration with SvelteKit presets, strict mode, and path aliases
- **Why**: Ensures type safety across the project; path aliases simplify imports

### `vite.config.ts`

- **Action**: create
- **What**: Vite bundler config with SvelteKit plugin, asset optimization
- **Why**: Configures the dev server, build output, and module resolution

### `svelte.config.js`

- **Action**: create
- **What**: SvelteKit framework config with adapter selection, preprocessor setup
- **Why**: Enables TypeScript preprocessing, SSR configuration, and adapter selection

### `.env.example`

- **Action**: create
- **What**: Template environment variables (API URL, database path if applicable)
- **Why**: Documents required configuration for developers; `.env` itself is .gitignored

### `.gitignore`

- **Action**: create
- **What**: Standard Node.js + SvelteKit ignore patterns
- **Why**: Prevents committing node_modules, build artifacts, env files

### `README.md`

- **Action**: create
- **What**: Quick-start guide, project overview, setup instructions
- **Why**: Essential documentation for developers onboarding to the project

### `src/app.html`

- **Action**: create
- **What**: HTML template with meta tags, dark mode detection, root layout
- **Why**: SvelteKit's root template; defines lang, charset, viewport, and initial theme

### `src/app.css`

- **Action**: create
- **What**: Global Tailwind imports, CSS custom properties for dark theme colors
- **Why**: Configures Tailwind and defines brand color palette for light/dark modes

### `src/app.svelte`

- **Action**: create
- **What**: Root layout component with theme provider context, global navigation
- **Why**: Wraps all pages; provides theme context and persistent layout

### `src/routes/+page.svelte`

- **Action**: create
- **What**: Dashboard home page with layout and placeholder sections
- **Why**: Entry point for the dashboard; establishes main page structure

### `src/routes/+layout.svelte`

- **Action**: create
- **What**: Page layout with header, sidebar navigation, footer
- **Why**: Shared layout for all pages; houses navigation and theme toggle

### `src/lib/api/client.ts`

- **Action**: create
- **What**: Typed fetch wrapper with error handling, headers, timeout logic for internal API routes
- **Why**: Centralizes HTTP requests to local `/api/` routes; provides type-safe API communication

### `src/lib/api/types.ts`

- **Action**: create
- **What**: TypeScript interfaces for API requests and responses (telemetry, token usage, cache efficiency, costs)
- **Why**: Ensures type safety for all API interactions; shared between client and server

### `src/routes/api/telemetry/+server.ts`

- **Action**: create
- **What**: SvelteKit route handler for telemetry data queries; queries `~/.tenex/analysis.db` using better-sqlite3
- **Why**: Provides JSON endpoint for frontend charts; handles database access securely on server

### `src/routes/api/telemetry/summary/+server.ts`

- **Action**: create
- **What**: Route handler for aggregated telemetry summary (total tokens, cache efficiency %, total cost)
- **Why**: Powers dashboard summary cards; reduces query load with pre-aggregated data

### `src/routes/api/tokens/+server.ts`

- **Action**: create
- **What**: Route handler for token usage trends over time (hourly/daily aggregation)
- **Why**: Powers token usage chart; supports date range filtering and drill-down

### `src/routes/api/cache/+server.ts`

- **Action**: create
- **What**: Route handler for cache efficiency metrics by model or time period
- **Why**: Powers cache efficiency charts and metrics

### `src/lib/server/database.ts`

- **Action**: create
- **What**: Database connection initialization and query utilities using better-sqlite3
- **Why**: Centralizes database access; ensures single connection instance; handles path expansion (~/.tenex/analysis.db)

### `src/lib/stores/theme.ts`

- **Action**: create
- **What**: Svelte store for theme state (dark/light), localStorage persistence
- **Why**: Manages global theme preference; shared across all components

### `src/lib/stores/telemetry.ts`

- **Action**: create
- **What**: Svelte store for telemetry data (token usage, cache efficiency, costs)
- **Why**: Centralizes dashboard data; enables reactivity across components

### `src/lib/components/ThemeToggle.svelte`

- **Action**: create
- **What**: Button component for light/dark mode switching
- **Why**: User-facing theme control; placed in header

### `src/lib/components/Card.svelte`

- **Action**: create
- **What**: Reusable card component with dark theme support
- **Why**: Building block for dashboard sections (metrics, charts)

### `src/lib/components/Header.svelte`

- **Action**: create
- **What**: Top navigation bar with logo, theme toggle, user menu
- **Why**: Consistent header across all pages

### `src/lib/utils/colors.ts`

- **Action**: create
- **What**: Color palette constants and utility functions for light/dark themes
- **Why**: Ensures consistency across charts and UI components

### `src/lib/utils/format.ts`

- **Action**: create
- **What**: Formatting functions for numbers, currency, dates, tokens
- **Why**: Reusable formatting across dashboard (e.g., 10.5M tokens, $12.34)

### `.eslintrc.cjs`

- **Action**: create
- **What**: ESLint config for Svelte + TypeScript
- **Why**: Enforces code quality standards

### `.prettierrc`

- **Action**: create
- **What**: Prettier config for consistent code formatting
- **Why**: Automated formatting on save or pre-commit

### `.prettierignore`

- **Action**: create
- **What**: Files to exclude from Prettier formatting
- **Why**: Prevents formatting of generated files, lock files, etc.

### `vitest.config.ts`

- **Action**: create
- **What**: Vitest configuration for unit and component tests
- **Why**: Sets up testing framework with Vite awareness

### `src/lib/__tests__/utils.test.ts`

- **Action**: create
- **What**: Example unit tests for utility functions (format, colors)
- **Why**: Demonstrates testing patterns; validates utilities work correctly

### `.husky/pre-commit`

- **Action**: create
- **What**: Husky pre-commit hook to run lint-staged
- **Why**: Prevents commits of linting violations (optional but recommended)

### `.lintstagedrc.json`

- **Action**: create
- **What**: lint-staged config to lint/format staged files only
- **Why**: Improves pre-commit performance; avoids linting entire repo

### `tenex/docs/DEVELOPMENT.md`

- **Action**: create
- **What**: Developer setup guide, architecture overview, coding conventions
- **Why**: Establishes project conventions for future contributors

## Execution Order

### Phase 1: Initialize SvelteKit Project Structure

1. **Create package.json and install core dependencies**
   - Run `npm init -y` to scaffold package.json
   - Add scripts section with dev, build, preview, test, lint targets
   - Install SvelteKit and Vite: `npm install -D svelte @sveltejs/kit vite`
   - Install TypeScript: `npm install -D typescript`
   - Verify: `npm run dev` should start dev server without errors

2. **Create TypeScript and build configuration**
   - Create `tsconfig.json` with SvelteKit preset and strict mode enabled
   - Create `vite.config.ts` with SvelteKit plugin configured
   - Create `svelte.config.js` with auto adapter selection
   - Verify: `npm run build` completes without errors

3. **Create root HTML template and app structure**
   - Create `src/app.html` with meta tags, theme detection script
   - Create `src/app.svelte` as root layout component
   - Create `src/app.css` with Tailwind imports
   - Verify: `npm run dev` loads page without 404

### Phase 2: Install Database and Server Dependencies

4. **Install better-sqlite3 for SQLite access**
   - `npm install better-sqlite3`
   - `npm install -D @types/better-sqlite3`
   - Create `src/lib/server/database.ts` with database initialization
   - Implement path expansion logic: resolve `~/.tenex/analysis.db` to absolute path using `path.expandUser()` or equivalent
   - Add singleton pattern to ensure single database connection per application
   - Implement error handling for missing database file (graceful fallback for dev)
   - Verify: `node -e "require('better-sqlite3')"` loads without errors

### Phase 3: Create Server-Side API Types and Database Module

5. **Create typed API response interfaces**
   - Create `src/lib/api/types.ts` with TypeScript interfaces for telemetry API responses
   - Define types for: `TelemetrySummary`, `TokenUsageTrend`, `CacheMetric`, `CostData`
   - Ensure types match what the SQLite schema provides
   - Verify: Types compile without errors and are importable from components

6. **Create server-side database module**
   - Create `src/lib/server/database.ts` with better-sqlite3 initialization
   - Implement path expansion for `~/.tenex/analysis.db` (handle Windows/Mac/Linux paths)
   - Create prepared statement wrappers for common queries
   - Implement query utility functions: `getTokenSummary()`, `getTokenTrends(startDate, endDate)`, `getCacheMetrics()`, `getCostData()`
   - Add error handling for missing/corrupt database
   - Add logging for query performance monitoring
   - Verify: Database connection initializes; dummy queries return expected structure (or fail gracefully)

7. **Create telemetry API server routes**
   - Create `src/routes/api/telemetry/+server.ts` (GET handler for full telemetry data)
   - Create `src/routes/api/telemetry/summary/+server.ts` (GET handler for summary metrics: total tokens, cache %, total cost)
   - Create `src/routes/api/tokens/+server.ts` (GET handler for token usage trends, supports `?from=YYYY-MM-DD&to=YYYY-MM-DD` query params)
   - Create `src/routes/api/cache/+server.ts` (GET handler for cache efficiency by model or time)
   - Each route queries database via `src/lib/server/database.ts` and returns typed JSON
   - Add proper HTTP status codes and error messages
   - Verify: `curl http://localhost:5173/api/telemetry/summary` returns valid JSON; no server errors

### Phase 4: Install UI & Styling Dependencies

8. **Install and configure Tailwind CSS**
   - `npm install -D tailwindcss postcss autoprefixer`
   - `npx tailwindcss init -p` to generate tailwind.config.js and postcss.config.js
   - Configure `content` paths to scan src/ and routes files
   - Add dark mode config: `darkMode: 'class'`
   - Create custom theme color palette in tailwind.config.js (dark theme colors)
   - Verify: Tailwind utilities are available in Svelte components; `npm run dev` compiles CSS without errors

9. **Install Recharts for data visualization**
   - `npm install recharts`
   - Install React (peer dependency): `npm install react react-dom`
   - Create `src/lib/utils/colors.ts` with Recharts-compatible color palette constants
   - Export functions for getting colors by theme (dark/light)
   - Verify: Recharts import works; color utilities are accessible

10. **Create foundational UI components**
    - Create `src/lib/components/Card.svelte` with Tailwind styling for dark mode
    - Create `src/lib/components/ThemeToggle.svelte` with dark/light mode toggle logic
    - Create `src/lib/components/Header.svelte` with logo and theme toggle
    - Verify: Components render in browser; dark mode toggle works visually

### Phase 5: Set Up Frontend State Management and API Client

11. **Create Svelte stores for theme and data**
    - Create `src/lib/stores/theme.ts` with writable store for dark/light mode
    - Add localStorage persistence (SSR-safe with `browser` check)
    - Create `src/lib/stores/telemetry.ts` writable store for telemetry data (initial state: empty)
    - Verify: Theme preference persists across page reloads; stores are importable

12. **Create typed API client for frontend**
    - Create `src/lib/api/client.ts` with typed fetch wrapper for local `/api/` routes
    - Implement methods: `getTelemetrySummary()`, `getTokenTrends(from?, to?)`, `getCacheMetrics()`
    - Add error handling, JSON parsing, and optional retry logic
    - Add timeout handling (5s default)
    - Verify: API client imports without errors; methods have proper TypeScript typing

### Phase 6: Create Initial Pages and Layout

13. **Create main layout with navigation**
    - Create `src/routes/+layout.svelte` with header, sidebar, footer
    - Integrate theme toggle in header
    - Integrate theme provider context via Svelte context API
    - Establish global CSS reset and base styles
    - Verify: Layout renders across all routes; theme toggle is functional and persistent

14. **Create dashboard home page**
    - Create `src/routes/+page.svelte` as main dashboard
    - Structure: summary metric cards (total tokens, cache %, cost), chart sections for trends
    - Wire up API client to fetch telemetry data on component load (`onMount`)
    - Display loading and error states
    - Verify: Page loads data from API routes and displays without errors; charts populate with data

### Phase 7: Install and Configure Development Tools

15. **Install and configure linting and formatting**
    - `npm install -D eslint eslint-plugin-svelte @typescript-eslint/eslint-plugin @typescript-eslint/parser`
    - Create `.eslintrc.cjs` with Svelte, TypeScript, and accessibility rules
    - `npm install -D prettier prettier-plugin-svelte`
    - Create `.prettierrc` with formatting options
    - Add `lint`, `lint:fix`, `format`, and `format:check` scripts to package.json
    - Verify: `npm run lint` and `npm run format` execute without errors

16. **Install and configure testing framework**
    - `npm install -D vitest @testing-library/svelte @testing-library/user-event happy-dom`
    - Create `vitest.config.ts` with Svelte and happy-dom support
    - Create example test file `src/lib/__tests__/utils.test.ts` for format/color utilities
    - Add `test`, `test:watch`, and `test:ui` scripts to package.json
    - Verify: `npm run test` runs tests and passes

17. **Set up pre-commit hooks (optional but recommended)**
    - `npm install -D husky lint-staged`
    - `npx husky install` to initialize git hooks
    - Create `.husky/pre-commit` to run lint-staged
    - Create `.lintstagedrc.json` to lint/format staged TypeScript and Svelte files only
    - Verify: Pre-commit hook runs on `git commit`

### Phase 8: Create Documentation

18. **Create project documentation**
    - Create `README.md` with quick-start instructions, project overview, architecture, and folder structure
    - Create `tenex/docs/DEVELOPMENT.md` with detailed setup guide, SQLite schema expectations, and coding conventions
    - Create `.env.example` with required environment variables (API base URL if applicable; database path if overridable)
    - Create `.gitignore` with Node.js, SvelteKit, and OS-specific patterns
    - Verify: Documentation covers scaffolding, local development, and architecture

19. **Final integration verification**
    - Run `npm install` to ensure all dependencies lock correctly
    - Run `npm run dev` and manually test in browser:
      - Page loads without console errors
      - Theme toggle switches dark/light mode correctly
      - Summary cards and charts render (may be empty if no database)
      - API routes return JSON: `curl http://localhost:5173/api/telemetry/summary`
    - Run `npm run build` and verify build artifacts in `.svelte-kit/build`
    - Run `npm run lint` and `npm run test`
    - Verify git tracking: `git status` shows no node_modules or .env files
    - Commit all scaffolding: `git add . && git commit -m "chore: initial SvelteKit project scaffolding with SQLite integration"`

## Verification

**Build & Development:**

- `npm run dev` starts dev server on http://localhost:5173 without errors
- Hot module reload (HMR) works: editing a component updates browser instantly
- `npm run build` completes successfully; artifacts in `.svelte-kit/build`
- `npm run preview` serves production build locally without errors

**SQLite Database Access:**

- `src/lib/server/database.ts` initializes and returns a database connection
- Database path resolution handles `~/.tenex/analysis.db` correctly on current OS
- Graceful error handling if database file is missing (no crash on dev startup)
- API routes execute queries and return valid JSON responses

**API Routes:**

- `curl http://localhost:5173/api/telemetry/summary` returns valid JSON with no errors
- `curl http://localhost:5173/api/tokens?from=2024-01-01&to=2024-01-31` returns valid JSON
- `curl http://localhost:5173/api/cache` returns valid JSON
- All API responses match TypeScript interfaces in `src/lib/api/types.ts`
- Error responses include proper HTTP status codes (400 for bad params, 500 for server errors)

**Frontend API Client:**

- `src/lib/api/client.ts` imports without TypeScript errors
- Client methods are type-safe: `getTelemetrySummary()` returns correct types
- API calls execute and resolve promises correctly

**Code Quality:**

- `npm run lint` reports no errors or fixable warnings
- `npm run format` reformats code consistently; re-running is idempotent
- `npm run test` passes all unit tests with >80% coverage of utils and formatting functions

**Browser Functionality:**

- Dashboard loads without console errors
- Dark/light theme toggle switches appearance correctly
- Theme preference persists across page reloads and browser restart
- No layout shift when theme changes (no flash of unstyled content)
- Summary metric cards display data fetched from API
- Charts render (may show placeholder data if database is empty)

**TypeScript:**

- `tsc --noEmit` produces no type errors
- All API responses are properly typed from `src/lib/api/types.ts`
- Server-side database queries have correct type inference
- Hovering over variables in IDE shows correct types
- `@ts-expect-error` is never needed for valid code

**Git:**

- `git status` shows no untracked node_modules or .env files
- `git log --oneline` shows scaffolding commit with all files
- All source files in `src/` and `tenex/` are tracked
- `.gitignore` correctly ignores node_modules, `.svelte-kit`, `.env`, and build artifacts

**Project Structure:**

```
tenex-analytics-web-k8m2p4/
├── src/
│   ├── app.svelte               # Root component
│   ├── app.css                  # Global styles + Tailwind
│   ├── app.html                 # HTML template
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts        # Typed fetch wrapper for API routes
│   │   │   └── types.ts         # API request/response TypeScript interfaces
│   │   ├── components/
│   │   │   ├── Card.svelte
│   │   │   ├── Header.svelte
│   │   │   └── ThemeToggle.svelte
│   │   ├── server/
│   │   │   └── database.ts      # better-sqlite3 initialization & query utilities
│   │   ├── stores/
│   │   │   ├── theme.ts         # Dark/light mode state + persistence
│   │   │   └── telemetry.ts     # Dashboard data store
│   │   ├── utils/
│   │   │   ├── colors.ts        # Color palette + theme utilities
│   │   │   └── format.ts        # Formatting utilities (numbers, dates)
│   │   └── __tests__/
│   │       └── utils.test.ts    # Example unit tests
│   └── routes/
│       ├── +layout.svelte       # Page layout with header/footer
│       ├── +page.svelte         # Dashboard home page
│       ├── api/
│       │   ├── telemetry/
│       │   │   ├── +server.ts   # GET /api/telemetry (full data)
│       │   │   └── summary/
│       │   │       └── +server.ts # GET /api/telemetry/summary
│       │   ├── tokens/
│       │   │   └── +server.ts   # GET /api/tokens (trends with date range)
│       │   └── cache/
│       │       └── +server.ts   # GET /api/cache (efficiency metrics)
│       └── (future pages)
├── .env.example                 # Environment template
├── .eslintrc.cjs                # ESLint config
├── .gitignore                   # Git ignore patterns
├── .husky/
│   └── pre-commit               # Pre-commit hook
├── .lintstagedrc.json           # lint-staged config
├── .prettierignore              # Prettier ignore patterns
├── .prettierrc                  # Prettier config
├── package.json                 # Dependencies + scripts
├── package-lock.json            # Dependency lock
├── postcss.config.js            # PostCSS config (Tailwind)
├── README.md                    # Quick-start guide
├── svelte.config.js             # SvelteKit config
├── tailwind.config.js           # Tailwind theme + config
├── tsconfig.json                # TypeScript config
├── vite.config.ts               # Vite bundler config
├── vitest.config.ts             # Vitest config
└── tenex/
    └── docs/
        └── DEVELOPMENT.md       # Developer guide & conventions
```

## npm Scripts Reference

All scripts defined in `package.json`:

- `npm run dev` — Start development server with HMR
- `npm run build` — Build production bundle
- `npm run preview` — Preview production build locally
- `npm run test` — Run Vitest suite
- `npm run test:watch` — Run tests in watch mode
- `npm run test:ui` — Open Vitest UI dashboard
- `npm run lint` — Run ESLint
- `npm run lint:fix` — Fix fixable linting violations
- `npm run format` — Run Prettier
- `npm run format:check` — Check Prettier compliance without fixing

## Key Dependencies & Versions

```json
{
	"devDependencies": {
		"@sveltejs/kit": "^2.0.0",
		"@sveltejs/vite-plugin-svelte": "^3.0.0",
		"@testing-library/svelte": "^4.0.0",
		"@testing-library/user-event": "^14.0.0",
		"@types/better-sqlite3": "^7.6.0",
		"@typescript-eslint/eslint-plugin": "^6.0.0",
		"@typescript-eslint/parser": "^6.0.0",
		"autoprefixer": "^10.4.0",
		"eslint": "^8.0.0",
		"eslint-plugin-svelte": "^2.0.0",
		"happy-dom": "^12.0.0",
		"husky": "^8.0.0",
		"lint-staged": "^15.0.0",
		"postcss": "^8.4.0",
		"prettier": "^3.0.0",
		"prettier-plugin-svelte": "^3.0.0",
		"svelte": "^4.0.0",
		"tailwindcss": "^3.4.0",
		"typescript": "^5.0.0",
		"vite": "^5.0.0",
		"vitest": "^1.0.0"
	},
	"dependencies": {
		"better-sqlite3": "^9.0.0",
		"react": "^18.2.0",
		"react-dom": "^18.2.0",
		"recharts": "^2.10.0"
	}
}
```

### Rationale for Key Versions

- **SvelteKit 2.x**: Latest stable; excellent TypeScript and Vite integration; server routes enable API endpoints
- **Svelte 4.x**: Latest stable; improved compiler and performance
- **better-sqlite3 9.x**: Synchronous SQLite library; perfect for SvelteKit server routes (no async callback complexity); native bindings for performance
- **@types/better-sqlite3 7.6.x**: Type definitions for better-sqlite3; ensures server-side query type safety
- **Tailwind 3.4.x**: Stable with dark mode and JIT compilation; supports dark theme toggle
- **Recharts 2.10.x**: Mature, stable charting library with React peer dependency; works well with Svelte
- **Vitest 1.x**: Drop-in Vite-aware test replacement for Jest; seamless SvelteKit integration
- **happy-dom 12.x**: Lightweight DOM implementation for Vitest (faster than jsdom for unit tests)
- **TypeScript 5.x**: Latest stable with improved type inference; enables full type safety for database queries
- **ESLint 8.x, Prettier 3.x**: Latest stable versions; enforce consistent code quality
- **React 18.x**: Peer dependency for Recharts; not used directly in Svelte components
- **Husky 8.x, lint-staged 15.x**: Pre-commit hooks; selective file linting for fast feedback
