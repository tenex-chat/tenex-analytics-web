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
