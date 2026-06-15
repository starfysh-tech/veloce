# Block D — Compliance / best-execution workspace (starter prompt)

> Paste into a fresh session. Read `docs/HANDOFF.md` (Decisions 20, 22) and
> `docs/open-decisions.md` (D-7) first. Read-heavy block; the only "write" is an export
> that changes no state.

## Goal

Port `_legacy/views/Compliance.jsx` to `/compliance`, compliance-role only. Four read
surfaces: (1) best-ex evidence per RFQ — archived quote ladder + award decision + event
log, exportable as JSON; (2) a flattened cross-RFQ event log from the `events` table;
(3) exceptions & overrides report; (4) dealer concentration view (Decision 20).

## Read first (grounding)

- POC: `_legacy/views/Compliance.jsx`.
- Tenant-scoped read template: `lib/queries/rfqs.ts`, `lib/queries/board.ts`.
- Concentration helper (built in Block B): `lib/queries/concentration.ts` — reuse it.
  If Block B isn't done yet, build it here per Decision 20 (trailing-90-day awarded
  `trades.allocNotionalMinor` share per dealer, firm-scoped, summed as USD, labelled
  "indicative, single-currency (USD) basis").
- Schema: `events` (`db/schema.ts:285`), `exceptions` (268), `awards` (197), `quotes` (174).

## Build (one commit each)

1. `lib/queries/compliance.ts` — tenant-scoped reads: best-ex bundle per RFQ; flattened
   event log (`events` for `firmId`, newest first, joined to actor/rfq labels); open +
   closed exceptions; concentration table.
2. `app/(app)/compliance/page.tsx` — server component, compliance-gated, fetches the above.
3. `app/(app)/compliance/...` client(s) — the four views; tab/section layout per POC.
4. Export: a route handler `app/(app)/compliance/export/[rfqId]/route.ts` returning the
   best-ex JSON bundle (ladder + decision + event log) as a download. **No state change** —
   not a `recordEvent()` call; it's a pure read serialized to JSON.

## Acceptance / validation gate

- Every read tenant-scoped to `caller.firmId`; no cross-tenant event/quote leakage.
- Concentration labelled as indicative single-currency (USD) basis in the UI.
- Export changes no state (read-only).
- `npm test` && `npx tsc --noEmit` pass.

## Resolve when starting

- **D-7** — show real concentration figures even if sparse (recommended) vs seed extra
  awarded trades to populate the view.
