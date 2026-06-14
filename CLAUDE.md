# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Veloce is an OTC equity-derivatives RFQ/auction platform (Next.js 15 App Router, TypeScript strict, Supabase + Drizzle ORM/Postgres). Mock data only — no live trading.

## Commands

- `npm run dev` — local dev server
- `npm test` — run Vitest once (`npm run test:watch` to watch)
- Single test: `npx vitest run -t "<name>"`
- `npm run lint` — Next.js ESLint
- Typecheck: `npx tsc --noEmit` (no dedicated script)
- `npm run db:generate` — generate Drizzle migration from `db/schema.ts`
- `npm run db:migrate` — apply migrations (needs `DATABASE_URL`)
- `npm run db:seed` — idempotent demo seed; clears prior demo rows, creates Supabase Auth users (needs `SUPABASE_SERVICE_ROLE_KEY`)

## Architecture invariants

- **All state changes go through `recordEvent()` (`lib/record-event.ts`)** — it atomically appends an event and updates state. Never write direct table mutations for domain state.
- **Money is integer math.** Notional in minor units (bigint); prices `numeric(12,4)` converted to "ticks" (×10,000) before arithmetic to avoid float drift. See `lib/award-math.ts`.

## Domain gotchas

- **Lazy auction sweep:** no cron. Expired auctions flip `live` → `under_review` opportunistically when a user loads the RFQ. Correctness must never depend on the flip — the write path independently validates against the deadline.
- **Realtime is a signal only:** the quote board subscribes to Supabase Realtime but always re-fetches the masked board via the `/board` endpoint. Never trust the Realtime payload itself.
- **Dealers don't use Supabase Auth.** Access is via opaque capability tokens (`invitations` table); public routes like `/quote/[token]` are gated by token existence.
- **Auth:** `middleware.ts` refreshes the Supabase session cookie on every request; role-based gating is per route.
- **Email degrades gracefully:** if `RESEND_API_KEY` is absent (local dev), `lib/email.ts` logs and skips instead of throwing.

## Gotchas

- `next.config.mjs` sets `eslint.ignoreDuringBuilds: true` — builds do NOT fail on lint errors. Run `npm run lint` and `npx tsc --noEmit` manually.
- `/_legacy` is an old Vite POC, excluded from the build — ignore it.

## Required env vars

`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (seed), `RESEND_API_KEY` (optional), `RESEND_FROM`, `NEXT_PUBLIC_SITE_URL`.
