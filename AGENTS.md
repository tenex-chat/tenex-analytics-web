# AGENTS.md — TENEX Analytics Web

Project conventions for all agents working in this codebase.

## UI & Styling

This app uses a **minimalist, shadcn-inspired UI** with a pure zinc/charcoal palette. No blue-tinted grays.

### CSS variables — use these exclusively

| Variable | Value | Purpose |
|---|---|---|
| `--bg` | `#09090b` | Page background |
| `--surface` | `#18181b` | Subtle surface (cards, panels) |
| `--border` | `#27272a` | All borders |
| `--text` | `#fafafa` | Primary text |
| `--muted` | `#a1a1aa` | Secondary / muted text |
| `--dim` | `#52525b` | Labels, very dim text |
| `--radius` | `6px` | Border radius |
| `--green` | `#22c55e` | Success / positive |
| `--red` | `#ef4444` | Error / negative |

### ❌ Never use `*-gray-*` Tailwind classes

Tailwind's `gray` scale is blue-tinted and clashes with the zinc palette.

**Banned:** `bg-gray-*`, `text-gray-*`, `border-gray-*`, `ring-gray-*`, `divide-gray-*`, etc.

Also banned in `app.html` body classes or anywhere else — do not put color utility classes on `<body>` or `<html>`.

Use CSS variables instead. If you need a one-off color not covered by the variables above, use a zinc Tailwind class (`zinc-*`) or a raw hex from the zinc scale.

### ❌ Never use old `--color-*` variable names

These do not exist in this project:

- `--color-bg-primary` / `--color-bg-secondary`
- `--color-text-primary` / `--color-text-secondary`
- `--color-border`
- `--color-accent`

### Chart colors

Use `SERIES_COLORS` and `getChartTheme()` from `src/lib/utils/colors.ts`. Do not hardcode hex values in chart config — pull them from that module.

## Deployment

### Overview

- **Adapter:** `@sveltejs/adapter-node` — builds a standalone Node.js server to `build/index.js`
- **Production URL:** `https://tenex-analytics.f7z.io`
- **Reverse proxy:** Caddy (homebrew, running as a launchd service) proxies `tenex-analytics.f7z.io → localhost:3000`
- **Process manager:** macOS launchd — `io.f7z.tenex-analytics` LaunchAgent keeps the Node server alive

### Deploying a change

```bash
# 1. Build the production bundle
npm run build

# 2. Restart the launchd service to pick up new build
launchctl kickstart -k gui/$(id -u)/io.f7z.tenex-analytics
```

That's it — no container, no SSH, just a local build + service restart.

### Relevant files

| File | Purpose |
|---|---|
| `build/index.js` | Production server entry point (generated, gitignored) |
| `~/Library/LaunchAgents/io.f7z.tenex-analytics.plist` | launchd service definition (PORT=3000, NODE_ENV=production) |
| `$(brew --prefix)/etc/Caddyfile` | Caddy reverse proxy config |
| `~/Library/Logs/tenex-analytics.log` | stdout log |
| `~/Library/Logs/tenex-analytics-error.log` | stderr log |

### Caddy config (for reference)

```
tenex-analytics.f7z.io {
    reverse_proxy localhost:3000
}
```

### Checking service status

```bash
# Is the node server running?
launchctl print gui/$(id -u)/io.f7z.tenex-analytics

# Tail logs
tail -f ~/Library/Logs/tenex-analytics.log
tail -f ~/Library/Logs/tenex-analytics-error.log

# Caddy status
brew services info caddy
```
