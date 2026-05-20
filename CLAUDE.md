# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

A Notion-backed invoice (견적서) web viewer. Issuers write invoices as rows in
a Notion database; recipients open a token link to read the invoice and
download a PDF — no login. A password-protected admin area lists every invoice
and copies share links.

- PRD: @docs/PRD.md — MVP scope (token viewer + PDF)
- ROADMAP: @docs/ROADMAP.md — v2 scope (admin pages) + phase status

## Critical preamble

`AGENTS.md` warns: **"This is NOT the Next.js you know."** Before writing
non-trivial code that touches Next.js APIs (routing, metadata, image, font,
fetch, server actions, cookies/headers), check the relevant guide under
`node_modules/next/dist/docs/`. The installed version is Next.js 15 with React
19; rules from older training data (sync `params`, sync `cookies()`,
`force-cache` default fetch, etc.) will silently produce wrong code.

## Commands

```
npm run dev          # dev server, uses --turbopack (DO NOT remove the flag — see below)
npm run build        # production build
npm run start        # serve the production build
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run test         # vitest run (one-shot)
npm run test:watch   # vitest watch
npm run format       # prettier --write
npm run check-all    # lint + typecheck + format:check + test
```

Run a single test file or pattern:

```
npx vitest run tests/lib/notion.test.ts
npx vitest run -t "expired filter"
```

`npm run build` does **not** prerender everything as SSG — the invoice and
admin routes (`/invoice/[id]`, `/admin`, `/admin/invoices`, `/admin-login`,
`/api/invoice/[id]/pdf`) and `ƒ Middleware` all show `ƒ (Dynamic)` because they
read `searchParams`/`cookies` or call Notion with no caching. A route flipping
to static (`○`) is a regression.

The `dev` script is intentionally `next dev --turbopack`. On this Windows +
Tailwind v4 setup, plain `next dev` triggered a webpack `.next` self-watch HMR
loop that hammered RSC (`?_rsc=...`) and `webpack.hot-update.json` endlessly.
If you ever see that pattern, the first thing to check is whether the flag was
dropped.

If a hard environment glitch appears (`Cannot find module './XXX.js'`,
`vendor-chunks/...js` missing, RSC manifest errors), do **all three** before
chasing code:

1. kill any leftover `node.exe` listening on port 3000
2. delete `.next/`
3. restart `npm run dev`

## Architecture

Two surfaces with **separate trust boundaries**, sharing one Notion datastore:

```
Anonymous viewer   /invoice/[id]?token=...   token link, no login
                   /api/invoice/[id]/pdf     same token, streams a PDF
Admin              /admin, /admin/invoices   JWT session cookie required
                   /admin-login              password → session
```

There is no database. **Notion is the only datastore** — `lib/notion.ts`
wraps `@notionhq/client` v5. `app/page.tsx` is just a public landing page
explaining the flow.

### Notion data layer (`lib/notion.ts`)

A single server-only module. All Notion access goes through it.

- `getInvoiceById` / `getInvoiceByNo` — full `Invoice` for the viewer.
- `listInvoices` — filtered/sorted/cursor-paginated `InvoiceListItem[]` for the
  admin list.
- `getInvoiceStats` — dashboard KPIs, wrapped in a 60s cache (see below).
- `updateInvoiceToken` — rewrites a row's `access_token` (token regeneration).
- Property mapping helpers (`getTitle`/`getRichText`/`getNumber`/`getDate`/
  `getSelect`) are **shared in-file** by every reader — deliberately not split
  into a separate module, so a Notion schema change is fixed in one place.
- The Notion schema evolved: invoice **line items live in a separate relation
  DB**, not a JSON field. `fetchItemsForInvoice` queries it. Data-source ids
  are lazily resolved and cached (`NOTION_DATA_SOURCE_ID` env or derived from
  `NOTION_DATABASE_ID`).
- **Error contract**: Notion 404 / any 4xx → return `null`; only 5xx throws.
  This is what lets the viewer render a clean 404 instead of a stack trace.

### Token verification gateway (`lib/invoice/load-verified.ts`)

`loadVerified(idOrNo, token)` is the **one chokepoint** the viewer page and the
PDF route both call. It loads the invoice, constant-time compares the token
(`lib/auth/verify-token.ts`), and — critically — **collapses every failure
(missing token, tampered token, missing row) to `null`** so the caller emits an
identical 404 with no information leak. It accepts either a Notion page id or a
human-readable `invoice_no`. Never bypass this to load an invoice for an
externally-reachable response.

### Admin auth and the Edge split

Admin auth is JWT session + scrypt password. The split exists because
**`middleware.ts` runs on the Edge runtime, which has no `node:crypto`**:

- `lib/auth/session.ts` — `jose` HS256, Web Crypto based, Edge-safe. Used by
  middleware to verify the `invoice_admin_session` httpOnly cookie (24h).
- `lib/auth/password.ts` — `node:crypto` scrypt hashing. Marked `"server-only"`
  so it can **never** be imported into middleware. Used only by the login
  Server Action.

`middleware.ts` (matcher: `/admin/:path*`, `/admin-login`) is the gate:

1. **Production admin gate** — in production, if `ENABLE_ADMIN !== "1"`, every
   `/admin*` and `/admin-login` request returns **404** (the admin area is
   sealed by one env var; the token viewer stays live). Non-production is
   always enabled.
2. With admin enabled, `/admin/*` without a valid session → 307 to
   `/admin-login`.

Login (`app/admin-login/actions.ts`) verifies `ADMIN_PASSWORD_HASH`, signs a
session, sets the cookie. Token regeneration (`app/admin/invoices/actions.ts`)
re-checks the session inside the Server Action — middleware is the gate, but
mutations re-verify — and calls `revalidatePath` for both the admin list and
the affected `/invoice/[id]`.

### Cross-cutting modules

- `lib/rate-limit.ts` — in-memory token-bucket limiter. `LOGIN_LIMIT`,
  `REGEN_LIMIT`, `PDF_LIMIT`. Keyed by client IP. Per-lambda on Vercel, so it
  weakens under serverless fan-out (Upstash is the planned upgrade).
- `lib/cache.ts` — in-memory TTL cache; currently only `getInvoiceStats`.
  Call `invalidate(prefix)` after a mutation (`updateInvoiceToken` does).
- `lib/logger.ts` — structured JSON-line logger. Always pass an object with an
  `event` key. **Never log tokens or secrets** (PRD §7). `LOG_LEVEL` env.

### Security headers — `vercel.json` is the single source

`next.config.ts` is intentionally empty; all response headers live in
`vercel.json`. Four route patterns (`/invoice/*`, `/api/invoice/*/pdf`,
`/admin/*`, `/admin-login`) get `Cache-Control: no-store` +
`X-Robots-Tag: noindex, nofollow` + `Referrer-Policy: no-referrer`. The PDF
route also has `maxDuration: 10`. Add header changes here, not in code.

### PDF generation

`app/api/invoice/[id]/pdf/route.ts` declares `export const runtime = "nodejs"`
explicitly — `@react-pdf/renderer` needs `Buffer`, and without the line Next
may auto-promote the route to Edge and break it. The PDF component
(`components/invoice/pdf/`) renders the same `Invoice` data as the viewer.

## Next 15 routing / data conventions

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
- A route that calls Notion or reads `searchParams`/`cookies` is dynamic;
  `app/admin/page.tsx` also pins `export const dynamic = "force-dynamic"`.

## Server-first rule

Every page and layout is a Server Component by default. Push `"use client"`
down into the smallest possible island under `components/<feature>/` and keep
`app/<route>/page.tsx` a Server Component so `metadata` export still works.
Client islands exist for genuine browser needs only: theme toggle, mobile nav
sheet, the login form (`useActionState`), and admin list controls
(`navigator.clipboard` in `copy-button.tsx`, share/regenerate buttons, search/
filter/pagination inputs).

## UI conventions

Add new UI by `npx shadcn@latest add <name>` first; only hand-roll when shadcn
has no equivalent.

### shadcn radix-nova

`components.json` uses `"style": "radix-nova"`, which imports primitives from
the unified `radix-ui` package (e.g. `import { DropdownMenu as
DropdownMenuPrimitive } from "radix-ui"`) rather than the per-package
`@radix-ui/react-dropdown-menu` form. Generated components use
`data-slot` / `data-variant` attributes and `Slot.Root` (from `radix-ui`) for
`asChild`. Keep these conventions so future shadcn CLI updates don't fight your
changes.

### Tailwind v4 + dark mode

`globals.css` uses the v4 `@import "tailwindcss"` + `@theme inline` + OKLCH CSS
variables pattern. Dark mode is class-based via `@custom-variant dark
(&:is(.dark *))`; `next-themes` toggles the `.dark` class on `<html>`. Don't
introduce a competing dark-mode strategy.

### Root layout and site config

`app/layout.tsx` mounts `ThemeProvider` → `TooltipProvider` →
`SiteHeader` / `main` / `SiteFooter` → `Toaster`. `<html>` has
`suppressHydrationWarning` because `next-themes` toggles its class on the
client. The Geist font maps to the CSS variable `--font-sans`, which the
`globals.css` `@theme inline` token chain depends on — renaming it breaks the
body font silently. `lib/site-config.ts` is the single source for site name,
description, and nav items; header/footer/metadata all read it.

## Testing

`vitest` with the `node` environment; tests live in `tests/**/*.test.ts`.
`vitest.config.ts` injects `.env.local` via `loadEnv` (vitest doesn't load it
automatically) and aliases the `server-only` build sentinel to a stub
(`tests/_helpers/server-only.ts`) so server-only modules are importable in
tests. Notion is mocked, not hit live.

## Environment variables

Server-only unless prefixed `NEXT_PUBLIC_`:

- `NOTION_TOKEN` — Notion integration secret (required)
- `NOTION_DATABASE_ID` — invoices DB id (required)
- `NOTION_DATA_SOURCE_ID` — optional; skips a lookup if set
- `SESSION_SECRET` — JWT signing key, must be ≥ 32 chars
- `ADMIN_PASSWORD_HASH` — `scrypt$N$r$p$saltHex$hashHex`; generate with
  `node scripts/hash-password.mjs` (stdin prompt — never pass the password as
  an argv or it lands in shell history)
- `ENABLE_ADMIN` — must be exactly `"1"` to expose admin in production
- `NEXT_PUBLIC_SITE_URL` — base for copied share links; falls back to a
  path-only link when unset
- `LOG_LEVEL` — `debug`/`info`/`warn`/`error`, default `info`

`.env.local.example` lists the keys. Tests need at least `SESSION_SECRET`.

## See also

- `AGENTS.md` — short and load-bearing; read once per session.
- `node_modules/next/dist/docs/` — authoritative docs for the installed Next
  version, prefer over external sources.
- `docs/decisions/` — ADRs for non-obvious architecture changes (e.g. items
  moving from a JSON field to a relation DB).
