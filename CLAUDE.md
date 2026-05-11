# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical preamble

`AGENTS.md` warns: **"This is NOT the Next.js you know."** Before writing
non-trivial code that touches Next.js APIs (routing, metadata, image, font,
fetch, server actions, cookies/headers), check the relevant guide under
`node_modules/next/dist/docs/`. The installed version is Next.js 15 with React
19; rules from older training data (sync `params`, sync `cookies()`,
`force-cache` default fetch, etc.) will silently produce wrong code.

## Commands

```
npm run dev    # dev server, uses --turbopack (DO NOT remove the flag — see below)
npm run build  # production build, all routes prerender as SSG
npm run start  # serve the production build
npm run lint   # eslint
```

There is no test suite configured.

The `dev` script is intentionally `next dev --turbopack`. On this Windows +
Tailwind v4 setup, plain `next dev` triggered a webpack `.next` self-watch HMR
loop that hammered `/showcase?_rsc=...` and `webpack.hot-update.json` endlessly.
If you ever see that pattern, the first thing to check is whether the flag was
dropped.

If a hard environment glitch appears (`Cannot find module './XXX.js'`,
`vendor-chunks/...js` missing, RSC manifest errors), do **all three** before
chasing code:
1. kill any leftover `node.exe` listening on port 3000
2. delete `.next/`
3. restart `npm run dev`

## Architecture

The project is a Next.js 15 App Router starter shaped as a thin marketing site
with auth scaffolding and a component showcase. The intent is "drop in a new
page and inherit consistent UX for free."

### Layering

```
Foundation     globals.css OKLCH tokens, Geist font, lib/utils.ts (cn)
Atoms          components/ui/*  (shadcn radix-nova: button, input, label, ...)
Molecules      shadcn composites (card, dropdown-menu, dialog, sheet, sonner)
Organisms      components/layouts/* + components/theme-toggle, theme-provider
Templates      components/layouts/container.tsx + auth-card
Pages          app/page.tsx, app/login, app/signup, app/showcase
```

Add new UI by `npx shadcn@latest add <name>` first; only hand-roll components
when shadcn has no equivalent.

### Server-first rule

Every page and layout is a Server Component by default. The only files that
carry `"use client"` are:

- `components/theme-provider.tsx`, `components/theme-toggle.tsx`
- `components/layouts/mobile-nav.tsx` (Sheet open/close state)
- `components/auth/login-form.tsx`, `components/auth/signup-form.tsx`
- `components/demo/toast-demo.tsx`
- `app/error.tsx`, `app/global-error.tsx` (required to be client)

When a new page needs an interactive island, isolate the client part into a
small component under `components/<feature>/` and keep the `app/<route>/page.tsx`
itself a Server Component so `metadata` export and SSG still work.

### Root layout wiring

`app/layout.tsx` mounts, in order: `ThemeProvider` → `TooltipProvider` →
`SiteHeader` / `main` / `SiteFooter` → `Toaster`. The `<html>` element has
`suppressHydrationWarning` because `next-themes` toggles its class on the
client. The Geist font is mapped to the CSS variable `--font-sans` so that
`globals.css`'s Tailwind v4 `@theme inline` token chain (`--font-sans:
var(--font-sans)`) resolves correctly — renaming that variable breaks the body
font silently.

### Single source of truth

`lib/site-config.ts` exports `siteConfig` (name, description, nav items,
external links). The header, footer, mobile nav, and root `metadata` all read
from this object. Add nav links here, never inline.

### Routing / data conventions for Next 15

- `params` and `searchParams` are `Promise` values — `async` the function and
  `await` them.
- `cookies()` and `headers()` from `next/headers` return Promises — `await`
  them.
- `fetch()` default is `no-store`; pass `{ cache: 'force-cache' }` or
  `{ next: { revalidate: N } }` explicitly when you want caching.
- `error.tsx` files receive `{ error, reset }` (note: `reset`, **not**
  `unstable_retry`). `error.tsx` must be `"use client"`.
- `app/global-error.tsx` is kept in the repo even though it looks redundant —
  some turbopack setups fail RSC manifest resolution without it.

### shadcn radix-nova specifics

`components.json` uses `"style": "radix-nova"`, which imports primitives from
the unified `radix-ui` package (e.g. `import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"`)
rather than the per-package `@radix-ui/react-dropdown-menu` form. Generated
components use `data-slot` / `data-variant` attributes for styling hooks and a
`Slot.Root` (from `radix-ui`) for the `asChild` pattern. When extending or
overriding these components, keep the same conventions so future shadcn CLI
updates don't fight your changes.

### Tailwind v4 + dark mode

`globals.css` uses the v4 `@import "tailwindcss"` + `@theme inline` + OKLCH CSS
variables pattern. Dark mode is class-based via `@custom-variant dark
(&:is(.dark *))`; the actual `.dark` class is added/removed on `<html>` by
`next-themes`. Don't introduce a competing dark-mode strategy.

## Demo auth pages

`/login` and `/signup` mount the same `AuthCard` wrapper and submit handlers
fire `sonner` toasts only — no real authentication. Treat them as UI scaffolds
to wire to a real provider later, not as a security boundary.

## See also

- `AGENTS.md` — short and load-bearing; read once per session.
- `node_modules/next/dist/docs/` — authoritative docs for the installed Next
  version, prefer over external sources.
