# Block D — Compliance / best-execution workspace

> Paste into a fresh session. Read `docs/HANDOFF.md` (Decisions 20, 22) and
> `docs/open-decisions.md` (D-7) first. Read-heavy block; the only "write" is an export
> that changes no state.

## Post-Block-C corrections (validated against merged `main`, 2026-06-16)

A 2-agent validation ran against merged Blocks A–C. Block C is green (85/85 tests, `tsc`
clean, lint clean); its four pre-ship criticals were all fixed. Before building Block D:

1. **Reuse the Block B concentration helper as-is.** `lib/queries/concentration.ts` exports
   `getDealerConcentration(firmId, asOf?, executor?)` → `Record<dealerFirmId, { shareBps:
   0–10000, notionalMinor }>`, plus `dealerConcentrationQuery(...)` (raw query, DB-free
   testable) and `aggregateToShareBps(rows)` (pure). It is **USD-only** by design and already
   carries the "indicative, single-currency (USD) basis" label (`concentration.ts:51–53`).
   Call it directly — no changes (the spec's "if Block B isn't done, build it here" path is moot).
2. **D-7 decision, with the actual seed facts.** After `npm run db:seed` only TWO trades
   exist: `rfq:0139` (HALCYON, **EUR** 450K) and `rfq:0138` (MERIDIAN, **USD** 150M, Kestrel).
   Because concentration filters `rfqs.ccy = 'USD'`, the EUR HALCYON trade is excluded →
   HALCYON's concentration view returns `{}` (empty); MERIDIAN shows Kestrel ~100%.
   **Recommendation: ship real figures even if sparse** — the emptiness is accurate and
   correctly labelled. A fuller demo is a seed change, not a query change.
3. **The flattened event log needs no joins.** `events` (`db/schema.ts:291`) carries a
   denormalized `actorLabel` (text) + `summary` (text) — filter `eq(events.firmId, firmId)`,
   order `desc(events.createdAt)`. Join to `rfqs` via nullable `events.rfqId` only if you need
   `rfqs.ref`/product for the RFQ column. Indexes exist on `firmId`, `rfqId`, `createdAt`.
4. **Two exceptions tables — read the right one.** View (3) "exceptions & overrides" reads the
   COMPLIANCE `exceptions` table (`db/schema.ts:273`; columns `id`, `ref`, `firmId`, `rfqId`,
   `severity`, `text`, `status`, `open`, `openedAt`). Do NOT read `handoff_exceptions` (`262`)
   — that's Block C's STP-break table, scoped to a `handoffId` with no `firmId`.
5. **D-3 follow-up fixed in this block.** Empirical validation showed
   `notifyAuctionClosed` and `notifyAwardApproved` send to `rfq.requester.email` (buy-side),
   not dealers, but they still exposed the internal sequence in outbound email. The actual
   dealer-token data-shape leak was `lib/queries/dealer-view.ts` selecting `rfqs.ref` and
   returning it in the RFQ object. Block D fixes both: the two email templates use
   `rfq.publicRef`, and the dealer-view query no longer selects internal `ref`.

## Goal

Port `_legacy/views/Compliance.jsx` to `/compliance`, available to `compliance` and `admin`.
Four read surfaces: (1) best-ex evidence per RFQ — latest stored quote ladder + award
decision + event log, exportable as JSON; (2) a flattened cross-RFQ event log from the
`events` table; (3) exceptions & overrides report; (4) dealer concentration view
(Decision 20).

## Read first (grounding)

- POC: `_legacy/views/Compliance.jsx`.
- Tenant-scoped read template: `lib/queries/rfqs.ts`, `lib/queries/board.ts`.
- Concentration helper (built in Block B): `lib/queries/concentration.ts` — reuse it.
  If Block B isn't done yet, build it here per Decision 20 (trailing-90-day awarded
  `trades.allocNotionalMinor` share per dealer, firm-scoped, summed as USD, labelled
  "indicative, single-currency (USD) basis").
- Schema: `events` (`db/schema.ts:291`), `exceptions` (273 — the compliance table, NOT
  `handoff_exceptions` at 262), `awards` (200), `quotes` (177).
- Current schema stores latest quote rows only. Quote revisions update the same row and keep
  only `revisedFromPrice`; do not claim immutable/archived quote-ladder snapshots without a
  separate schema/event snapshot change.

## Build (one commit each)

1. `lib/queries/compliance.ts` — tenant-scoped reads: best-ex bundle per RFQ; flattened
   event log (`events` for `firmId`, newest first, limited in overview); open + closed
   compliance exceptions; concentration table. Any optional RFQ metadata join on `events` or
   `exceptions` must join on both `rfqs.id` and `rfqs.firmId` to avoid leaking labels from a
   mismatched row.
2. `app/(app)/compliance/page.tsx` — server component, gated to `compliance` and `admin`,
   fetches the above.
3. `app/(app)/compliance/...` client(s) — the four views; tab/section layout per POC.
4. Export: a route handler `app/(app)/compliance/export/[rfqId]/route.ts` returning the
   best-ex JSON bundle (latest stored ladder + decision + event log) as a download. **No
   state change** — not a `recordEvent()` call; it's a pure read serialized to JSON. Route
   handlers do not inherit page role gates, so the route must call `resolveUser()`, require
   `compliance` or `admin`, and query by `caller.firmId` + `rfqId`.
5. `app/(app)/layout.tsx` — expose `/compliance` in the admin nav as well as the compliance
   nav.

## Acceptance / validation gate

- Every read tenant-scoped to `caller.firmId`; no cross-tenant event/quote leakage.
- Concentration labelled as indicative single-currency (USD) basis in the UI.
- Quote ladder labelled as latest stored rows, not immutable/archived history.
- Export changes no state (read-only).
- `npm test`, `npx tsc --noEmit`, and `npm run lint` pass.

## Implemented in this branch (2026-06-16)

- D-3 fixed in `lib/email.ts` and `lib/queries/dealer-view.ts`.
- Compliance workspace added under `app/(app)/compliance/`.
- Read-only export route added at `app/(app)/compliance/export/[rfqId]/route.ts`.
- Admin nav now includes `/compliance`.
- Regression coverage added in `lib/queries/compliance.test.ts` and
  `lib/queries/dealer-view.test.ts`.
- Minimal ESLint config added in `.eslintrc.json`, with `eslint` and `eslint-config-next`
  dev dependencies pinned to the Next 15 line so `npm run lint` is non-interactive.
- Root font loading moved to `next/font/google` to satisfy lint without changing the design
  tokens.
- Validation evidence: `npm test` passed (91/91); `npx tsc --noEmit` passed;
  `npm run lint` passed with no warnings or errors.

## Resolve when starting

- **D-7 resolved for this branch** — show real concentration figures even if sparse; do not
  seed extra awarded trades just to populate the view.
