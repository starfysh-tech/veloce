# AGENTS.md

## Source Of Truth
- This is the current app: Next.js 15 App Router, TypeScript strict, Supabase, Drizzle/Postgres, Vercel. The root `README.md` still describes the old Vite/browser-memory POC; trust `package.json`, config files, `CLAUDE.md`, and `docs/HANDOFF.md` over it.
- `_legacy/` is the stable ported Vite POC and is excluded from TypeScript and Next build. It may need direct POC changes when explicitly requested; otherwise do not treat it as current MVP behavior.
- Durable product/build decisions live in `docs/HANDOFF.md`; unresolved or accepted MVP gaps live in `docs/open-decisions.md`.

## Commands
- Install with `npm install`; this repo uses `package-lock.json` and npm scripts.
- Dev server: `npm run dev`.
- Build: `npm run build`; builds ignore ESLint because `next.config.mjs` has `eslint.ignoreDuringBuilds: true`.
- Lint: `npm run lint`.
- Typecheck: `npx tsc --noEmit`.
- Tests: `npm test`; focused test: `npx vitest run -t "<name>"`; watch: `npm run test:watch`.
- Drizzle migration generation: `npm run db:generate`; apply migrations: `npm run db:migrate` with `DATABASE_URL`.
- Seed demo data: `npm run db:seed`; uses `tsx --env-file-if-exists=.env db/seed.ts`, clears prior demo rows, and creates Supabase Auth users.
- Post-approval state validator: `npx tsx --env-file-if-exists=.env scripts/validate-block-b.ts` after manually approving `rfq:0141` in the browser.

## Environment
- Required server/runtime vars: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` for seed, `RESEND_FROM`, `NEXT_PUBLIC_SITE_URL`; `RESEND_API_KEY` is optional locally.
- `db/index.ts` requires `DATABASE_URL` and uses `postgres(..., { prepare: false })` for the Supabase transaction pooler.
- Use `requireEnv()` from `lib/env.ts` for server env reads that must fail clearly.

## Architecture Rules
- All domain state mutations must go through `recordEvent()` in `lib/record-event.ts`; it writes mutable state and the append-only `events` row in one transaction.
- Money stays integer/exact: notionals are minor units, Drizzle `bigint({ mode: 'number' })`; prices are `numeric(12,4)` strings converted to integer ticks in `lib/award-math.ts`.
- Auction deadlines are authoritative in write paths. Lazy sweep may flip `live -> under_review` on buy-side reads, but correctness must not depend on that flip.
- Realtime is only a signal. The quote board must re-fetch masked data from `/rfqs/[id]/board`; never trust Supabase Realtime payload data.
- Dealers do not use Supabase Auth. `/quote/[token]` is public and resolves opaque hashed invitation tokens server-side; new dealer-facing surfaces must preserve blind masking and never expose competitor levels/identities.
- Buy-side routes live under `app/(app)/` and resolve `resolveUser()` in the server component/layout; role nav is in `app/(app)/layout.tsx`.
- Hybrid rendering convention from the handoff: pages fetch tenant-scoped, pre-masked data; client components handle interaction and call server actions/route handlers.

## Database And Auth
- Schema is in `db/schema.ts`; migrations output to `drizzle/` via `drizzle.config.ts`.
- Every business read/write should be tenant-scoped by `firmId` or token-scoped for dealer flows. Use existing query helpers in `lib/queries/` as templates.
- Supabase session cookies are refreshed by `middleware.ts`; authorization gating is per route/action, not in middleware.
- Email in `lib/email.ts` degrades gracefully when `RESEND_API_KEY` is missing; do not make local dev depend on email delivery.

## Testing Notes
- Vitest aliases `@/` to the repo root in `vitest.config.ts`; scoped packages like `@supabase/ssr` are intentionally not matched.
- Existing tests include pure math/policy tests, generated SQL/query tests, masking tests, and server-action input gates. Add focused tests near the changed module.
- Before claiming a block/change is validated, run at least `npm test` and `npx tsc --noEmit`; run `npm run lint` separately because builds do not enforce lint.
