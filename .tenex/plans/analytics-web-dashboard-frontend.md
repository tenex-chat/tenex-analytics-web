# Analytics Web Dashboard Frontend Architecture

## Context

The foundational SvelteKit scaffolding is complete (see `analytics-web-dashboard-scaffolding.md`). The project has core dependencies installed: SvelteKit v2, Recharts v2, Tailwind CSS v3, and better-sqlite3 for SQLite access. The API layer provides server routes that query `~/.tenex/analysis.db` and serve JSON responses.

This plan establishes the frontend UI layer—routes, components, state management, data fetching, and interaction patterns—that transforms raw telemetry data into an intuitive dark-themed analytics dashboard. The frontend visualizes:

- **Token usage over time**: Input, output, cache read/write trends with drill-down capability
- **Cache efficiency**: Hit rates by agent/provider/model with historical trends
- **Cost analysis**: Cost trends and breakdowns by project, agent, provider, and model
- **Context window pressure**: Agents approaching token limits with warning indicators
- **Conversation inspection**: Individual conversations with message breakdown and token distribution

The dashboard is a single-page application (SPA) with client-side routing, persistent URL-based filters, and reactive chart updates. Dark mode is the primary aesthetic; light mode is a secondary option.

## Approach

### Route Structure & Architecture

The frontend adopts a **hub-and-spoke route layout** with a central navigation bar and atomic page templates:

- **Hub**: Root layout (`src/routes/+layout.svelte`) provides persistent navigation, theme context, and header/footer
- **Spokes**: Individual page routes handle specific domains (tokens, cache, costs, context windows, conversations)

**Route hierarchy:**

- `/` — Dashboard overview (home page with key metrics and summary charts)
- `/tokens` — Token usage analysis (detailed trends, filters, drill-down to conversations)
- `/cache` — Cache efficiency dashboard (hit rates, trends by provider/model)
- `/costs` — Cost analysis and trends (by project, agent, provider, model)
- `/context-windows` — Context window utilization (warnings, agent limits)
- `/conversations/[id]` — Conversation detail view (message breakdown, token distribution)

**Route structure rationale**: Separating concerns into dedicated routes reduces page complexity, improves perceived performance (lazy loading), and enables bookmarking specific analyses.

**Alternative considered**: Monolithic dashboard with tabs. Rejected because it prevents URL-based state sharing, complicates browser back-button behavior, and makes individual sections harder to optimize independently.

### Component Hierarchy

The frontend follows a **layered component model**:

1. **Root layout** (`src/routes/+layout.svelte`):
   - Theme context provider via Svelte context API
   - Global navigation bar (header with logo, theme toggle, navigation links)
   - Slot for page content
   - Footer with version/attribution
   - Wraps all pages; ensures consistent styling and navigation

2. **Page components** (`src/routes/+page.svelte`, `/tokens/+page.svelte`, etc.):
   - Route-specific data loading (via SvelteKit `load()` function)
   - FilterBar for page-scoped filters
   - Page-specific layout grid (charts, tables, cards)
   - Error and loading state handling

3. **Reusable UI components** (`src/lib/components/`):
   - **Chart wrappers** (`LineChart.svelte`, `BarChart.svelte`, `PieChart.svelte`): Recharts wrappers with consistent dark theme, responsive sizing, and tooltip customization
   - **MetricCard.svelte**: Displays single metric (total tokens, cache hit rate, avg cost) with optional sparkline
   - **FilterBar.svelte**: Dropdown filters (project, agent, provider, model) and date range picker
   - **Table.svelte**: Generic paginated table component for conversation/message inspection
   - **ThemeToggle.svelte**: Dark/light mode toggle button
   - **Navigation.svelte**: Main navigation bar with breadcrumb support
   - **LoadingState.svelte**: Skeleton screens and spinners for data loading
   - **ErrorBoundary.svelte**: Error state fallback UI with retry button
   - **Breadcrumb.svelte**: Navigation context and drill-down indicators

### State Management (Svelte Stores)

State is organized into **four distinct stores**, each focused on a single responsibility:

#### 1. **Global Filters Store** (`src/lib/stores/filters.ts`)

```typescript
export const filters = writable<FilterState>({
	projectId: null, // Filter by project
	agentId: null, // Filter by agent
	providerId: null, // Filter by provider (OpenAI, Anthropic, etc.)
	modelId: null, // Filter by model
	startDate: null, // Date range start (ISO 8601)
	endDate: null, // Date range end (ISO 8601)
	granularity: 'daily' // Aggregation granularity: hourly, daily, weekly
});
```

**Design rationale:**

- Centralized filter state reduces prop drilling
- URL query parameters (via `$page.url.searchParams`) are the source of truth; store is derived from URL on mount
- Filter changes trigger re-fetch of all relevant data stores (tokens, cache, costs)
- Filters persist across page navigation via URL (deep linking)

**URL sync pattern**:

```
/tokens?projectId=proj-1&startDate=2024-01-01&endDate=2024-01-31&granularity=daily
```

Filter store subscribes to `$page` store; on mount, hydrates from URL query params. On filter change, updates URL via `goto(url)` with `replaceState: true`.

#### 2. **Data Stores** (one per API endpoint, `src/lib/stores/data/`)

**Token Usage Store** (`tokens.ts`):

```typescript
export const tokenData = writable<TokenData>({
	data: [], // Array of {timestamp, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens}
	loading: false,
	error: null,
	lastFetch: null
});
```

**Cache Metrics Store** (`cache.ts`):

```typescript
export const cacheData = writable<CacheData>({
	data: [], // Array of {period, hitRate, missRate, agentId, provider}
	loading: false,
	error: null,
	lastFetch: null
});
```

**Cost Data Store** (`costs.ts`):

```typescript
export const costData = writable<CostData>({
	data: [], // Array of {period, totalCost, costByProvider, costByModel}
	loading: false,
	error: null,
	lastFetch: null
});
```

**Context Windows Store** (`contextWindows.ts`):

```typescript
export const contextWindowData = writable<ContextWindowData>({
	data: [], // Array of {agentId, model, usedTokens, maxTokens, percentUtilization, warning}
	loading: false,
	error: null,
	lastFetch: null
});
```

**Design rationale:**

- Each store is independently fetchable and cacheable
- `loading` and `error` fields enable granular UI state management (per chart)
- Stores are derived from filters: subscriptions to `filters` trigger refetch
- Cache invalidation via `lastFetch` timestamp; stale data (>5 min old) triggers automatic refetch

#### 3. **Theme Store** (`src/lib/stores/theme.ts`)

```typescript
export const theme = writable<'light' | 'dark' | 'system'>('system');
```

**Features:**

- Wraps Svelte store with localStorage persistence (SSR-safe via `browser` check)
- On mount, reads user preference from localStorage; falls back to system preference
- Theme changes update `document.documentElement.classList` to toggle `dark` class
- Recharts and chart wrappers read theme store to adjust colors dynamically

#### 4. **Sidebar/Navigation State** (`src/lib/stores/ui.ts`)

```typescript
export const sidebarOpen = writable<boolean>(true);
export const selectedConversationId = writable<string | null>(null);
```

**Design rationale:**

- Manages UI state that doesn't affect data (sidebar collapse, modal state, selected item)
- Persisted to localStorage for UX consistency
- Separate from data and filter stores for clarity

### Data Fetching & Caching Strategy

#### Server-Side Data Loading (SvelteKit `load()`)

Page components use SvelteKit's `load()` function for initial data loading:

```typescript
// src/routes/+page.svelte - Dashboard home
export const load = (async ({ fetch, url }) => {
	const filters = parseUrlFilters(url.searchParams);

	const [summary, tokenTrends] = await Promise.all([
		fetch(`/api/telemetry/summary?${qs.stringify(filters)}`),
		fetch(`/api/tokens?${qs.stringify(filters)}`)
	]);

	return {
		initialData: {
			summary: await summary.json(),
			tokenTrends: await tokenTrends.json()
		}
	};
}) satisfies PageLoad;
```

**Benefits:**

- Server-side rendering (SSR) for faster initial page load
- Data is available before client-side JavaScript runs
- Reduced client-side loading spinners (users see data immediately)

#### Client-Side Fetching (Filter Updates)

When filters change on the client, data stores are updated via `fetch()`:

```typescript
// In a component or store subscription:
filters.subscribe(async (newFilters) => {
	tokenData.update((d) => ({ ...d, loading: true }));

	try {
		const res = await fetch(`/api/tokens?${qs.stringify(newFilters)}`);
		const data = await res.json();
		tokenData.set({
			data,
			loading: false,
			error: null,
			lastFetch: Date.now()
		});
	} catch (err) {
		tokenData.update((d) => ({ ...d, error: err.message, loading: false }));
	}
});
```

#### Cache Invalidation

Stores implement a simple **time-based cache** with manual invalidation:

```typescript
// Automatic refetch if stale (>5 minutes)
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// In store subscription:
if (Date.now() - lastFetch > CACHE_TTL) {
	// Refetch
}
```

**Manual invalidation**: User-triggered actions (download report, refresh button) call an `invalidate()` function that resets `lastFetch` to trigger immediate refetch.

#### Debouncing Filter Changes

Filter dropdowns use debounced input to avoid excessive API calls:

```typescript
// In FilterBar.svelte:
function handleFilterChange(key: string, value: any) {
	clearTimeout(filterTimeout);
	filterTimeout = setTimeout(() => {
		goto(`?${qs.stringify({ ...currentFilters, [key]: value })}`);
	}, 300);
}
```

Debounce delay: 300ms. This allows rapid filter changes without hammering the API.

#### Request Lifecycle

```
User changes filter
  ↓
Debounce timer (300ms)
  ↓
Update URL query params
  ↓
Trigger store subscription (filters)
  ↓
Set store loading = true
  ↓
Fetch from /api/{endpoint}?...
  ↓
Update store with data, set loading = false
  ↓
Component subscribes to store, re-renders chart
```

### Chart Integration & Recharts Theming

#### Chart Wrapper Components

Each chart type has a reusable wrapper that handles dark mode, responsive sizing, and interactions:

```typescript
// src/lib/components/LineChart.svelte
<script>
  import { LineChart as RChartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
  import { theme } from '$lib/stores/theme';
  import { getChartColors } from '$lib/utils/colors';

  export let data = [];
  export let xKey = 'timestamp';
  export let lines = []; // [ { key: 'inputTokens', stroke: 'blue', name: 'Input' }, ...]
  export let height = 300;

  $: colors = getChartColors($theme);

  function handleLineClick(data) {
    // Drill-down: navigate to /conversations?conversationId=...
  }
</script>

<ResponsiveContainer width="100%" height={height}>
  <RChartsLineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
    <CartesianGrid strokeDasharray="3 3" stroke={colors.gridStroke} />
    <XAxis dataKey={xKey} stroke={colors.xAxisStroke} />
    <YAxis stroke={colors.yAxisStroke} />
    <Tooltip contentStyle={{ backgroundColor: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}` }} />
    <Legend />
    {#each lines as line}
      <Line type="monotone" dataKey={line.key} stroke={line.stroke} dot={false} />
    {/each}
  </RChartsLineChart>
</ResponsiveContainer>
```

**Reusable wrapper benefits:**

- Centralized dark mode theming (all charts update when theme changes)
- Consistent tooltip and legend styling
- Consistent interaction handlers (drill-down, filtering)
- Responsive sizing via ResponsiveContainer
- Reduced boilerplate in page components

#### Dark Mode Theming for Charts

Color palette utility (`src/lib/utils/colors.ts`):

```typescript
export function getChartColors(theme: 'light' | 'dark') {
	if (theme === 'dark') {
		return {
			gridStroke: '#374151', // gray-700
			xAxisStroke: '#9CA3AF', // gray-400
			yAxisStroke: '#9CA3AF',
			tooltipBg: '#1F2937', // gray-900
			tooltipBorder: '#4B5563', // gray-800
			lineColors: {
				primary: '#60A5FA', // blue-400
				success: '#34D399', // emerald-400
				warning: '#FBBF24', // amber-400
				danger: '#F87171' // red-400
			}
		};
	} else {
		return {
			gridStroke: '#E5E7EB', // gray-200
			xAxisStroke: '#6B7280', // gray-500
			yAxisStroke: '#6B7280',
			tooltipBg: '#FFFFFF',
			tooltipBorder: '#E5E7EB',
			lineColors: {
				primary: '#3B82F6', // blue-500
				success: '#10B981', // emerald-500
				warning: '#F59E0B', // amber-500
				danger: '#EF4444' // red-500
			}
		};
	}
}
```

Charts subscribe to theme store; when theme changes, colors are recalculated and Recharts components re-render automatically.

### Interaction Patterns & Drill-Down

#### Click-to-Drill-Down

Clicking on data points in charts navigates to filtered views or details:

1. **Agent name click** → Filter `/tokens` or `/cache` page to that agent:

   ```typescript
   // In LineChart.svelte click handler:
   function handleClick(data) {
   	goto(`/tokens?agentId=${data.agentId}`);
   }
   ```

2. **Data point in token chart** → Open conversation details:

   ```typescript
   function handleClick(data) {
   	goto(`/conversations/${data.conversationId}`);
   }
   ```

3. **Cost breakdown segment** → Filter `/costs` to that provider/model:
   ```typescript
   function handleClick(data) {
   	goto(`/costs?providerId=${data.providerId}&modelId=${data.modelId}`);
   }
   ```

#### Filter Bar Updates

When user changes filters in FilterBar:

1. URL is updated via `goto()` with `replaceState: true` (browser back button skips filter-only changes)
2. `filters` store is updated (via subscription to `$page`)
3. All relevant data stores trigger refetch
4. Charts re-render with new data

#### Breadcrumb Navigation

Pages include breadcrumbs showing applied filters and drill-down depth:

```
Dashboard > Tokens > Agent: claude-3-sonnet (2024-01-01 to 2024-01-31)
```

Clicking breadcrumb segments removes filters or navigates up.

#### URL Query Parameters (Deep Linking)

All filter state is encoded in URL:

```
/tokens?projectId=proj-1&agentId=agent-1&startDate=2024-01-01&endDate=2024-01-31&granularity=daily
/conversations/conv-123?agentId=agent-1
```

Users can bookmark or share URLs; on reload, filters are restored from query params.

### Dark Theme Implementation

#### Tailwind Dark Mode

The project uses Tailwind's `dark:` class-based dark mode:

```typescript
// svelte.config.js or tailwind.config.js:
module.exports = {
	darkMode: 'class' // Enable dark mode via class toggle
};
```

Root HTML element's `dark` class is toggled by theme store:

```typescript
// src/lib/stores/theme.ts:
theme.subscribe((value) => {
	if (typeof document === 'undefined') return;

	if (value === 'dark') {
		document.documentElement.classList.add('dark');
	} else {
		document.documentElement.classList.remove('dark');
	}
});
```

#### CSS Custom Properties for Brand Colors

Additional theme colors via CSS variables (`src/app.css`):

```css
:root {
	--color-primary: #3b82f6; /* light mode primary */
	--color-primary-dark: #60a5fa; /* dark mode primary */
	--color-bg: #ffffff;
	--color-bg-dark: #0f1419;
	--color-text: #1f2937;
	--color-text-dark: #f3f4f6;
}

.dark {
	--color-primary: var(--color-primary-dark);
	--color-bg: var(--color-bg-dark);
	--color-text: var(--color-text-dark);
}
```

Utility classes in components:

```svelte
<div class="bg-[var(--color-bg)] text-[var(--color-text)] dark:bg-[var(--color-bg-dark)] dark:text-[var(--color-text-dark)]">
```

#### Recharts Theming

Recharts components use `getChartColors()` utility to adapt to theme (see Chart Integration section).

#### No Flash of Unstyled Content

To prevent light mode flash on dark mode load:

```html
<!-- src/app.html -->
<script>
	const theme = localStorage.getItem('theme') || 'system';
	if (
		theme === 'dark' ||
		(theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
	) {
		document.documentElement.classList.add('dark');
	}
</script>
```

This runs before page renders, ensuring correct theme from start.

### Responsive Design

#### Mobile-First Tailwind Utilities

Layout adapts via Tailwind breakpoints:

```svelte
<!-- Filter bar: vertical stack on mobile, horizontal on desktop -->
<div class="flex flex-col gap-2 md:flex-row md:gap-4">
	<FilterDropdown label="Project" />
	<FilterDropdown label="Agent" />
	<DateRangePicker />
</div>

<!-- Chart grid: 1 column on mobile, 2 on tablet, 3 on desktop -->
<div class="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
	<MetricCard />
	<MetricCard />
	<MetricCard />
</div>
```

#### Chart Responsiveness

Charts use Recharts' `ResponsiveContainer` for fluid width:

```svelte
<ResponsiveContainer width="100%" height={300}>
	<LineChart {data}>...</LineChart>
</ResponsiveContainer>
```

On very small screens (mobile), charts have fixed height but flexible width; if data is dense, horizontal scrolling is enabled via CSS.

#### Table Scrolling on Mobile

Tables use horizontal scroll on mobile:

```svelte
<div class="overflow-x-auto">
	<table class="w-full">...</table>
</div>
```

Column widths are set to prevent squishing; table scrolls horizontally on narrow viewports.

### Accessibility

#### ARIA Labels & Roles

Interactive elements have descriptive ARIA labels:

```svelte
<!-- Filter dropdown -->
<select aria-label="Filter by project"> ... </select>

<!-- Chart container -->
<div role="region" aria-label="Token usage trends">
	<LineChart {data} />
</div>

<!-- Loading state -->
<div role="status" aria-live="polite" aria-label="Loading data">
	<LoadingState />
</div>
```

#### Keyboard Navigation

- **Tab navigation**: All interactive elements (buttons, dropdowns, chart interactions) are focusable
- **Enter/Space**: Buttons and selects respond to Enter and Space keys
- **Escape**: Modals and dropdowns close on Escape
- **Arrow keys**: Date pickers allow arrow key navigation; tables allow arrow key movement

#### Semantic HTML

- `<header>`, `<nav>`, `<main>`, `<footer>` landmark elements
- `<h1>`, `<h2>`, `<h3>` for page structure (not divs with styling)
- `<button>` for clickable elements (not `<div onclick>`)
- `<a>` for navigation links
- `<table>` for tabular data

#### Color Contrast

- Dark theme: Light text on dark backgrounds (WCAG AA compliant)
- Light theme: Dark text on light backgrounds
- Chart colors chosen for sufficient contrast (e.g., blue, green, amber, red are all distinguishable)
- Status indicators (warnings, errors) use icons + color (not color alone)

## File Changes

### Route Components

#### `src/routes/+layout.svelte`

- **Action**: create
- **What**: Root layout component with header, navigation, footer, and theme context provider
- **Why**: Wraps all pages; provides persistent navigation and theme infrastructure

#### `src/routes/+page.svelte`

- **Action**: create
- **What**: Dashboard home page with summary metric cards and overview charts
- **Why**: Entry point showing KPIs and trends at a glance

#### `src/routes/tokens/+page.svelte`

- **Action**: create
- **What**: Token usage analysis page with detailed trends, filters, drill-down
- **Why**: Dedicated page for deep-dive token analysis

#### `src/routes/cache/+page.svelte`

- **Action**: create
- **What**: Cache efficiency dashboard with hit rates and trends
- **Why**: Specialized view for cache performance monitoring

#### `src/routes/costs/+page.svelte`

- **Action**: create
- **What**: Cost analysis and trends by project, agent, provider, model
- **Why**: Financial insights and cost tracking

#### `src/routes/context-windows/+page.svelte`

- **Action**: create
- **What**: Context window utilization dashboard with warning indicators
- **Why**: Monitor agents approaching token limits

#### `src/routes/conversations/[id]/+page.svelte`

- **Action**: create
- **What**: Conversation detail view with message breakdown and token distribution
- **Why**: Inspect individual conversations for deep analysis

#### `src/routes/conversations/[id]/+page.ts`

- **Action**: create
- **What**: Page load function that fetches conversation data by ID
- **Why**: Server-side data loading for initial render

### Stores

#### `src/lib/stores/filters.ts`

- **Action**: create
- **What**: Global filters store with URL synchronization
- **Why**: Centralized filter state; enables deep linking and filter persistence

#### `src/lib/stores/data/tokens.ts`

- **Action**: create
- **What**: Token usage data store with loading/error states
- **Why**: Reactive token data across multiple pages

#### `src/lib/stores/data/cache.ts`

- **Action**: create
- **What**: Cache metrics data store
- **Why**: Reactive cache data updates

#### `src/lib/stores/data/costs.ts`

- **Action**: create
- **What**: Cost analysis data store
- **Why**: Reactive cost data updates

#### `src/lib/stores/data/contextWindows.ts`

- **Action**: create
- **What**: Context window utilization data store
- **Why**: Reactive context window monitoring

#### `src/lib/stores/ui.ts`

- **Action**: create
- **What**: UI state store (sidebar, modals, selection)
- **Why**: Manage non-data UI state separately from data stores

#### `src/lib/stores/theme.ts` (from scaffolding)

- **Action**: enhance
- **What**: Add reactive theme subscription for Recharts color updates
- **Why**: Ensures all charts update when theme changes

### Components

#### `src/lib/components/LineChart.svelte`

- **Action**: create
- **What**: Recharts LineChart wrapper with dark mode and drill-down
- **Why**: Reusable component for time-series data (tokens, cache trends, costs)

#### `src/lib/components/BarChart.svelte`

- **Action**: create
- **What**: Recharts BarChart wrapper for categorical comparisons
- **Why**: Display data by agent, provider, or model

#### `src/lib/components/PieChart.svelte`

- **Action**: create
- **What**: Recharts PieChart wrapper for proportional data
- **Why**: Cost breakdown, cache hit/miss ratios

#### `src/lib/components/MetricCard.svelte`

- **Action**: create
- **What**: Card displaying single metric with optional sparkline
- **Why**: KPI displays (total tokens, cache hit rate, avg cost)

#### `src/lib/components/FilterBar.svelte`

- **Action**: create
- **What**: Dropdowns and date range picker for filtering
- **Why**: User-facing filter controls on every page

#### `src/lib/components/Table.svelte`

- **Action**: create
- **What**: Generic paginated table component
- **Why**: Display conversations, messages in tabular format

#### `src/lib/components/Breadcrumb.svelte`

- **Action**: create
- **What**: Navigation breadcrumbs showing current filters and path
- **Why**: Provide context and enable quick navigation

#### `src/lib/components/LoadingState.svelte`

- **Action**: create
- **What**: Skeleton screens and spinners for loading states
- **Why**: Better UX during data fetch

#### `src/lib/components/ErrorBoundary.svelte`

- **Action**: create
- **What**: Error fallback UI with retry button
- **Why**: Graceful error handling for failed API calls

#### `src/lib/components/Navigation.svelte` (from scaffolding)

- **Action**: enhance
- **What**: Add active link highlighting, responsive mobile menu
- **Why**: Better navigation UX on mobile

#### `src/lib/components/ThemeToggle.svelte` (from scaffolding)

- **Action**: enhance
- **What**: Add 'system' preference option, smooth transitions
- **Why**: More user choice and better UX

### Utilities

#### `src/lib/utils/colors.ts` (from scaffolding)

- **Action**: enhance
- **What**: Add `getChartColors()` function for Recharts theming
- **Why**: Centralized dark mode color management for charts

#### `src/lib/utils/format.ts` (from scaffolding)

- **Action**: enhance
- **What**: Add functions for formatting large numbers (1.2M tokens), percentages (95.3%), currency
- **Why**: Consistent number formatting across dashboard

#### `src/lib/utils/api.ts`

- **Action**: create
- **What**: API call helpers for data stores (getTrendData, getCacheMetrics, etc.)
- **Why**: Reduce boilerplate in store subscriptions

#### `src/lib/utils/url.ts`

- **Action**: create
- **What**: URL query parameter parsing and serialization, filter state encoding
- **Why**: Handle URL ↔ filter store synchronization

#### `src/lib/utils/cache.ts`

- **Action**: create
- **What**: Cache validation and invalidation utilities (isStale, invalidate, etc.)
- **Why**: Manage cache TTL and manual invalidation across stores

## Execution Order

### Phase 1: Core Store Infrastructure

1. **Implement filters store with URL synchronization**
   - Create `src/lib/stores/filters.ts`
   - Implement writable store with filter state
   - Add subscription to `$page` store for URL sync on mount
   - Add function to sync filters back to URL via `goto()`
   - Verify: Filter changes update URL; page reload restores filters from URL

2. **Create data stores with loading/error states**
   - Create `src/lib/stores/data/tokens.ts`, `cache.ts`, `costs.ts`, `contextWindows.ts`
   - Each store has `data`, `loading`, `error`, `lastFetch` fields
   - Add subscription to filters store; refetch on filter change
   - Add helper to check cache staleness (>5 min)
   - Verify: Stores are importable, subscribe/update work, refetch triggers on filter change

3. **Create UI state store**
   - Create `src/lib/stores/ui.ts` with sidebar and selection state
   - Add localStorage persistence for sidebar state
   - Verify: Store persists across page reloads

4. **Enhance theme store for Recharts integration**
   - Modify `src/lib/stores/theme.ts` (from scaffolding)
   - Add export for theme-aware color palette
   - Verify: Theme store exports are accessible from chart components

### Phase 2: Utility Functions & Color Palette

5. **Implement color utilities for dark mode**
   - Create/enhance `src/lib/utils/colors.ts`
   - Implement `getChartColors(theme)` function returning color palette
   - Implement `getChartLineColors(theme, lineIndex)` for consistent line coloring
   - Verify: Colors are appropriate for dark/light themes; all line types have distinct colors

6. **Implement number and date formatting utilities**
   - Enhance `src/lib/utils/format.ts`
   - Add `formatTokens(num)` → "1.2M tokens"
   - Add `formatCurrency(num)` → "$12.34"
   - Add `formatPercent(num)` → "95.3%"
   - Add `formatDate(date)` → "Jan 01, 2024"
   - Verify: Formatting functions work for edge cases (0, very large numbers, null)

7. **Create URL and cache utilities**
   - Create `src/lib/utils/url.ts` with `parseUrlFilters()` and `encodeFilters()`
   - Create `src/lib/utils/cache.ts` with `isStale()`, `invalidate()` helpers
   - Verify: URL encoding/decoding is reversible; cache checks are accurate

8. **Create API call helpers**
   - Create `src/lib/utils/api.ts` with functions:
     - `fetchTokenTrends(filters)` → returns typed TokenData
     - `fetchCacheMetrics(filters)` → returns typed CacheData
     - `fetchCostAnalysis(filters)` → returns typed CostData
     - `fetchContextWindows()` → returns typed ContextWindowData
   - Each function uses typed fetch client from scaffolding
   - Verify: API helpers return correctly typed data; error handling works

### Phase 3: Component Infrastructure

9. **Create Recharts wrapper components**
   - Create `src/lib/components/LineChart.svelte` (time-series)
   - Create `src/lib/components/BarChart.svelte` (categorical)
   - Create `src/lib/components/PieChart.svelte` (proportional)
   - Each wrapper:
     - Accepts `data`, `dataKey`, interactive props
     - Subscribes to theme store for color updates
     - Implements click handlers for drill-down
     - Responsive sizing via ResponsiveContainer
     - Custom tooltips with dark theme styling
   - Verify: Charts render with data; theme changes update colors; clicks trigger navigation

10. **Create reusable UI components**
    - Create `src/lib/components/MetricCard.svelte` with optional sparkline
    - Create `src/lib/components/FilterBar.svelte` with dropdowns and date range
    - Create `src/lib/components/Table.svelte` with pagination
    - Create `src/lib/components/Breadcrumb.svelte` with drill-down navigation
    - Create `src/lib/components/LoadingState.svelte` with skeleton screens
    - Create `src/lib/components/ErrorBoundary.svelte` with retry button
    - Verify: Components render with correct styling; interactive elements work (filters update, pagination changes)

11. **Enhance Layout & Navigation**
    - Enhance `src/routes/+layout.svelte` (from scaffolding):
      - Add Svelte context provider for theme
      - Add header with navigation bar
      - Add responsive sidebar/mobile menu
      - Ensure theme toggle is visible
    - Enhance `src/lib/components/Navigation.svelte` with active link indicators
    - Enhance `src/lib/components/ThemeToggle.svelte` with 'system' option
    - Verify: Layout renders; navigation highlights current page; theme toggle works; sidebar toggles on mobile

### Phase 4: Page Components & Data Loading

12. **Create dashboard home page**
    - Create `src/routes/+page.svelte`:
      - Load summary data and token/cache trends via SvelteKit `load()`
      - Display 4 metric cards (total tokens, cache hit %, total cost, avg cost per call)
      - Display 3 mini-charts (token trends, cache trends, cost trends)
      - Each chart includes drill-down link to detailed page
      - Add FilterBar for quick filtering
    - Verify: Page loads, data displays, filters update URL, drill-down links work

13. **Create token analysis page**
    - Create `src/routes/tokens/+page.svelte`:
      - Full-width LineChart of token usage over time
      - Options to group by: agent, provider, model
      - FilterBar with date range and entity filters
      - Drill-down: click point → conversation detail
    - Verify: Chart displays; filters refetch data; drill-down navigates to conversation

14. **Create cache efficiency page**
    - Create `src/routes/cache/+page.svelte`:
      - BarChart of cache hit rates by agent/provider/model
      - LineChart of cache efficiency trends
      - MetricCards for current hit rate, miss rate, avg response time
      - FilterBar for time range and entity filtering
    - Verify: Charts display; filters work; data is readable

15. **Create cost analysis page**
    - Create `src/routes/costs/+page.svelte`:
      - PieChart of cost breakdown by provider/model
      - LineChart of cost trends over time
      - Table of cost by project/agent/model with details
      - FilterBar for filtering and grouping
    - Verify: Charts and table display; filters work

16. **Create context window page**
    - Create `src/routes/context-windows/+page.svelte`:
      - Table of agents with context window utilization
      - Warning indicators for agents >80% utilization
      - BarChart of utilization by agent
      - Color coding: green (<50%), yellow (50-80%), red (>80%)
    - Verify: Table displays with warnings; chart color-codes correctly

17. **Create conversation detail page**
    - Create `src/routes/conversations/[id]/+page.ts` (load function):
      - Fetch conversation by ID from API
      - Return conversation data with messages
    - Create `src/routes/conversations/[id]/+page.svelte`:
      - Display conversation metadata (agent, model, date, total tokens)
      - Table of messages with: timestamp, role, tokens, content preview
      - BarChart of tokens by message (showing distribution)
      - Breadcrumb showing drill-down path
    - Verify: Page loads with correct conversation; metadata displays; message tokens are accurate

### Phase 5: Integration & Verification

18. **Integrate stores with pages**
    - Update all page components to subscribe to data stores
    - Implement loading and error states using LoadingState and ErrorBoundary
    - Ensure charts update reactively when filters change
    - Test filter changes trigger correct data refetch
    - Verify: Pages display data correctly; filter changes update all relevant charts; error states display

19. **Test dark mode across all components**
    - Toggle theme in all pages
    - Verify charts update colors smoothly
    - Check text contrast in dark mode (WCAG AA)
    - Verify no flash of light mode on page load
    - Verify theme preference persists across page reloads
    - Verify: Dark mode looks polished; no contrast issues; smooth transitions

20. **Test responsive design**
    - Test all pages on mobile (375px), tablet (768px), desktop (1920px)
    - Verify FilterBar stacks on mobile, horizontal on desktop
    - Verify charts scale correctly on all sizes
    - Verify tables scroll horizontally on mobile
    - Verify navigation is accessible on mobile (sidebar or hamburger menu)
    - Verify: Layout is functional on all screen sizes; no horizontal scroll except tables

21. **Test accessibility**
    - Test keyboard navigation (Tab, Enter, Escape)
    - Test screen reader with page and chart areas
    - Verify ARIA labels on interactive elements
    - Verify color contrast in dark mode
    - Test form inputs (date range picker, dropdowns)
    - Verify: All features accessible via keyboard; screen reader announces content correctly

22. **Test deep linking and URL state**
    - Share a filtered URL (e.g., `/tokens?agentId=...&startDate=...`)
    - Reload and verify filters are restored
    - Change filters and verify URL updates
    - Verify browser back/forward buttons work correctly
    - Test edge cases: empty filters, invalid filter values
    - Verify: URL is always in sync with filter state; reload restores state

23. **Performance & optimization**
    - Profile page load times with DevTools
    - Check that initial data loads server-side (no spinner at start)
    - Verify chart rendering is smooth (no jank when updating data)
    - Check network requests: no duplicate fetches, proper caching
    - Test with large datasets (if possible) to identify bottlenecks
    - Verify: Pages load in <2s; charts render smoothly; no excessive API calls

24. **Final integration test**
    - Run full end-to-end flow:
      - Load home page → view metrics and trends
      - Click drill-down link → navigate to detailed page
      - Change filters → data updates
      - Toggle theme → colors update everywhere
      - Test conversation detail → inspect message breakdown
      - Share URL with filters → verify restoration on reload
    - Run `npm run build` and preview production build
    - Verify: All features work; no console errors; production build is fast
    - Commit all components: `git add . && git commit -m "feat: implement frontend UI layer with routes, stores, and components"`

## Verification

### Build & Development

- `npm run dev` starts dev server; all pages load without errors
- Hot module reload (HMR) works: editing a component updates browser instantly
- `npm run build` completes successfully; `.svelte-kit/build` contains optimized assets

### Route Navigation

- All routes are accessible via URL bar
- Breadcrumbs correctly show current location
- Browser back/forward buttons work (including filter-only navigation)
- URL query parameters are always in sync with filter state

### Data Fetching & Stores

- Initial page load uses SvelteKit `load()` for server-side data (fast initial render)
- Changing filters triggers refetch of relevant data stores
- Loading state displays while data is fetching
- Error state displays if API call fails (with retry button)
- Cache invalidation works (stale data >5 min old triggers refetch)

### Component Rendering

- All pages render without console errors
- MetricCards display values correctly (formatted with getFormatter utilities)
- Charts render with data and are interactive (click → drill-down, hover → tooltip)
- FilterBar updates are debounced (rapid changes don't hammer API)
- Tables paginate correctly and are sortable

### Dark Mode

- Theme toggle switches all pages between light and dark
- All text has sufficient contrast in both modes (WCAG AA)
- Charts update colors when theme changes (no re-render required)
- Theme preference persists across page reloads and browser restart
- No flash of unstyled content on page load

### Responsive Design

- Mobile (375px): single-column layout, FilterBar stacks, navigation is accessible
- Tablet (768px): adaptive grid layout, FilterBar is horizontal
- Desktop (1920px): full layout with sidebars, charts scale to screen width
- No horizontal scroll on any page except tables (which scroll for data)

### Accessibility

- All interactive elements are keyboard-focusable (Tab navigation works)
- Buttons, links, and form inputs respond to Enter/Space keys
- Dropdowns and modals close on Escape
- ARIA labels describe chart regions, status indicators, loading states
- Screen reader announces page headings, form labels, and error messages
- Color is not the only indicator (icons + colors for status; text for error messages)

### Deep Linking & URL State

- Share a URL with filters (e.g., `/tokens?agentId=...&startDate=...&endDate=...`)
- Recipient loads URL and sees filters applied and data already loaded
- Modifying filters updates URL; browser back/forward restores filter state
- Reloading page with complex filters restores exact state

### Chart Interactions

- Clicking agent name in chart filters page to that agent
- Clicking data point opens conversation detail
- Clicking legend items toggle visibility (if applicable)
- Hover shows tooltip with values and labels
- Drill-down navigation breadcrumbs show path

### Performance

- Initial page load (home) completes in <2 seconds
- Chart rendering is smooth (no jank when data updates)
- Filter changes debounced (300ms) to avoid excessive API calls
- No memory leaks (component cleanup via `onDestroy`)
- Network tab shows no duplicate requests; API responses are cached appropriately

### TypeScript & Type Safety

- `tsc --noEmit` produces no type errors across all pages and components
- API responses are typed from `src/lib/api/types.ts`
- Store values have correct inferred types
- Props are typed for all components
- Hovering over variables in IDE shows correct types

### Code Quality

- `npm run lint` reports no errors
- `npm run format:check` passes (all code formatted consistently)
- Component props are well-documented with JSDoc comments
- Store subscriptions are cleaned up in `onDestroy` (no memory leaks)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ src/app.svelte (Root Layout)                               │
│ ├─ Theme Context Provider (Svelte context API)           │
│ ├─ Header + Navigation (Navigation.svelte, ThemeToggle)  │
│ └─ <slot /> (Page content)                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ src/routes/+layout.svelte                                   │
│ ├─ Shared layout for all pages (header, sidebar, footer)  │
│ └─ <slot /> (Page-specific content)                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
    ┌─────────────────────┬──────────────────────┐
    ↓                     ↓                      ↓
src/routes/             src/routes/tokens/     src/routes/
+page.svelte            +page.svelte           cache/+page.svelte
(Dashboard)             (Token Trends)         (Cache Efficiency)
    │                       │                      │
    ├─ FilterBar          ├─ FilterBar          ├─ FilterBar
    ├─ MetricCard         ├─ LineChart          ├─ BarChart (hit rates)
    ├─ LineChart          │   (token trends)    ├─ LineChart (trends)
    │   (sparklines)      ├─ BarChart           └─ MetricCards
    └─ Breadcrumb         │   (by agent)
                          └─ Breadcrumb

    ┌─────────────────────┐  ┌──────────────────┐  ┌──────────────────┐
    ↓                     ↓  ↓                  ↓  ↓                  ↓
costs/                context-windows/        conversations/[id]/
+page.svelte          +page.svelte            +page.svelte
(Cost Analysis)       (Context Limits)        (Detail View)
├─ FilterBar          ├─ FilterBar            ├─ Breadcrumb
├─ PieChart           ├─ Table                ├─ MetricCard (metadata)
│   (breakdown)       │   (agents)            ├─ BarChart
├─ LineChart          ├─ BarChart             │   (token distribution)
│   (trends)          │   (utilization %)     └─ Table
├─ Table              └─ Status indicators    │   (messages)
│   (by category)            (warnings)
└─ Breadcrumb

Data Layer (Svelte Stores):
┌──────────────────────────────────────────────────┐
│ src/lib/stores/                                  │
│ ├─ filters.ts (Global filter state + URL sync)  │
│ ├─ ui.ts (Sidebar, modals, selection)          │
│ ├─ theme.ts (Dark/light mode + persistence)    │
│ └─ data/                                         │
│    ├─ tokens.ts (Token usage data)             │
│    ├─ cache.ts (Cache metrics)                 │
│    ├─ costs.ts (Cost analysis)                 │
│    └─ contextWindows.ts (Context limits)       │
└──────────────────────────────────────────────────┘
         ↓ (subscriptions on filter changes)
┌──────────────────────────────────────────────────┐
│ API Layer (SvelteKit server routes)              │
│ ├─ /api/telemetry/summary → MetricCards        │
│ ├─ /api/tokens → LineChart (trends)             │
│ ├─ /api/cache → BarChart (metrics)             │
│ ├─ /api/costs → PieChart + LineChart           │
│ └─ /api/context-windows → Table                │
└──────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────┐
│ Database Layer                                    │
│ ~/.tenex/analysis.db (SQLite)                   │
└──────────────────────────────────────────────────┘

Component Dependency Tree:
LineChart, BarChart, PieChart → Recharts components
                              → getChartColors(theme) → colors.ts
                              → formatNumber(), formatDate() → format.ts

MetricCard → format.ts
           → optional sparkline (miniature LineChart)

FilterBar → debounced filter changes
          → updates URL via goto()
          → triggers filters store update
          → stores subscribe, refetch data

Table → paginated, sortable
      → formatNumber(), formatDate()
      → optional drill-down clicks

Breadcrumb → shows filter state + drill-down path
           → click segments to navigate/remove filters
```

## Styling Strategy

### Tailwind Class Organization

```
Layout utilities: flex, grid, container, gap
Sizing utilities: w-, h-, max-w, min-h
Spacing utilities: p-, m-, pt-, mb-
Color utilities: bg-, text-, border-, shadow-, dark:bg-, dark:text-
Typography utilities: text-sm, text-lg, font-bold, leading-tight
Responsive utilities: md:, lg:, xl: prefixes for breakpoints
```

### Dark Mode Class Naming

All dark-mode overrides use Tailwind's `dark:` prefix:

```svelte
<div class="bg-white text-gray-900 dark:bg-gray-900 dark:text-white">Content</div>
```

### Component Structure Example

```svelte
<!-- src/lib/components/Card.svelte -->
<div
	class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-lg"
>
	<slot />
</div>
```

## Notes on Future Enhancements

This plan covers the core UI layer. Future enhancements (out of scope):

- **Export/Download**: Add buttons to export chart data as CSV/PDF
- **Alerts & Notifications**: Real-time alerts for context window breaches or unusual cost spikes
- **Custom Reports**: Allow users to create and save custom report configurations
- **Sharing**: Generate shareable dashboard snapshots with data embedded
- **Time-Travel**: Ability to inspect historical snapshots of the dashboard
- **Webhooks/Integrations**: Send alerts to Slack, email, or other systems
- **Multi-user Support**: User accounts, role-based access, shared workspaces (requires backend changes)
