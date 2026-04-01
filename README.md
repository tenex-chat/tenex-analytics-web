# TENEX Analytics Web Dashboard

A local analytics webapp for visualizing LLM token usage, cache efficiency, and cost data from TENEX's SQLite telemetry database.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

> **Note:** The dashboard reads from `~/.tenex/analysis.db`. If this file doesn't exist, the app starts gracefully with empty data.

## Prerequisites

- Node.js 18+
- npm 9+
- TENEX installed with at least some telemetry data in `~/.tenex/analysis.db`

## Architecture

```
tenex-analytics-web/
├── src/
│   ├── app.html                 # HTML entry template
│   ├── app.css                  # Global styles + Tailwind
│   ├── app.svelte               # Root component
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts        # Typed fetch wrapper for API routes
│   │   │   └── types.ts         # API request/response TypeScript interfaces
│   │   ├── components/
│   │   │   ├── Card.svelte      # Reusable metric card
│   │   │   ├── Header.svelte    # Top navigation bar
│   │   │   └── ThemeToggle.svelte
│   │   ├── server/
│   │   │   └── database.ts      # better-sqlite3 initialization & queries
│   │   ├── stores/
│   │   │   ├── theme.ts         # Dark/light mode state + localStorage
│   │   │   └── telemetry.ts     # Dashboard data store
│   │   └── utils/
│   │       ├── colors.ts        # Chart color palette utilities
│   │       └── format.ts        # Number/date/token formatters
│   └── routes/
│       ├── +layout.svelte       # Page layout with header
│       ├── +page.svelte         # Dashboard home page
│       └── api/
│           ├── telemetry/+server.ts          # GET /api/telemetry
│           ├── telemetry/summary/+server.ts  # GET /api/telemetry/summary
│           ├── tokens/+server.ts             # GET /api/tokens
│           └── cache/+server.ts              # GET /api/cache
├── .env.example                 # Environment variable template
├── svelte.config.js
├── vite.config.ts
└── tenex/docs/DEVELOPMENT.md    # Detailed developer guide
```

**Data flow:** Browser → SvelteKit route handlers → better-sqlite3 → `~/.tenex/analysis.db`

## npm Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with HMR on port 5173 |
| `npm run build` | Build production bundle |
| `npm run preview` | Preview production build |
| `npm run test` | Run Vitest test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix auto-fixable lint errors |
| `npm run format` | Run Prettier |
| `npm run format:check` | Check Prettier compliance |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/telemetry` | Full telemetry bundle (summary + trends + cache + cost) |
| `GET /api/telemetry/summary` | Aggregated summary metrics |
| `GET /api/tokens?from=YYYY-MM-DD&to=YYYY-MM-DD` | Token usage trends with optional date range |
| `GET /api/cache` | Cache efficiency metrics by model and day |

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

## Tech Stack

- **[SvelteKit 2](https://kit.svelte.dev/)** — Full-stack framework with file-based routing
- **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** — Synchronous SQLite for server routes
- **[Tailwind CSS 3](https://tailwindcss.com/)** — Utility-first CSS with dark mode
- **[Recharts 2](https://recharts.org/)** — Composable React charts (used in Svelte)
- **[Vitest](https://vitest.dev/)** — Vite-native test runner
- **TypeScript 5** — Full type safety throughout

## Development

See [tenex/docs/DEVELOPMENT.md](tenex/docs/DEVELOPMENT.md) for detailed setup, conventions, and architecture notes.
