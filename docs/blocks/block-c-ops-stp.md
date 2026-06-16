# Block C — Ops / STP workspace (starter prompt)

> Paste into a fresh session. Read `docs/HANDOFF.md` (Decisions 7, 12) first. Depends on
> Block B producing `trades` (or use seeded awarded/in_stp RFQs: `db/seed-data.ts`
> `rfq:0139` awarded, `rfq:0138` in_stp).

## Post-Block-B corrections (validated against merged `main`, 2026-06-15)

A 2-agent validation ran against merged Block B. Block B is green (63/63 tests, `tsc`
clean, lint clean). Note the following before building:

1. **Seeded `rfq:0139`/`rfq:0138` have NO `trades` rows.** Block B only seeds an award +
   exception for `rfq:0141`. `rfq:0139` (awarded, HALCYON) and `rfq:0138` (in_stp, MERIDIAN)
   ship with quotes but no `trades`, so `generateHandoff()` has nothing to act on out of the
   box. Before building/demoing: either run `approveAward` on an `awaiting_approval` RFQ to
   mint real trades, or add a synthetic `trades` insert to `seed.ts` for `rfq:0139`. Decide
   this first — it gates the whole Ops view.
2. **Reuse Block B's primitives, don't reinvent:**
   - Ref generation: `lib/ref-base.ts:14` `prefixedCrockfordRef(prefix)` (shared base),
     `lib/trade-ref.ts:6` `generateTradeRef()` → `T-XXXXXXXX`, `lib/exception-ref.ts:25`
     `nextExceptionRef(...)` → `EX-YYYY-NNNN` (DB-sequenced). If handoffs need a ref, follow
     the same pattern (random + unique-index backstop, or DB-sequenced for firm-scoped).
   - **Concurrency:** copy the conditional-UPDATE lock from `app/(app)/approvals/actions.ts:88`
     — `.update(...).where(and(eq(id), eq(status, EXPECTED), eq(firmId, caller.firmId))).returning()`,
     assert `[updated]` truthy, else throw a stale error. `advanceHandoff` must guard on the
     handoff's expected current status the same way (no `SELECT FOR UPDATE`).
   - Trades producer to mirror for column shapes: `app/(app)/approvals/actions.ts:174–185`.
3. **Money:** `trades.allocNotionalMinor` is `bigint({mode:'number'})` — Drizzle returns it
   as a JS `number`. Do NOT do arithmetic directly on it in `lib/stp.ts`; route through
   `lib/award-math.ts`. (Fine for MVP scale; precision loss only above ~$90T.)
4. **Corrected anchors** (Block B's additions shifted schema lines): `trades`
   `db/schema.ts:225`, `handoffs` `248`, `handoffExceptions` `262`. Still accurate: enums
   `trade_status`/`handoff_status`/`event_type` at `30`/`33`/`43`; `recordEvent`
   `lib/record-event.ts:39`. `recommendAwardAction` moved to
   `app/(app)/rfqs/[id]/actions.ts:22` (was `:13`).
5. **Open carryover bug — D-3 leak still unfixed.** It was folded into Block B and did NOT
   get done. `notifyAwardApproved` and `notifyAuctionClosed` (`lib/email.ts:57,60,76,79`)
   still email the internal sequence `rfq.ref` (`VEL-2026-…`) to dealers. Fix = swap
   `rfq.ref` → `rfq.publicRef` in both functions. Pick it up here or as a standalone fix,
   but it should stop slipping.

Verify-but-likely-fine: Block B's `approveAward` bulk-closes ALL open rows in the compliance
`exceptions` table for an RFQ (no `kind` filter). Block C's exceptions live in the separate
`handoff_exceptions` table, so they should be unaffected — confirm before relying on it.

## Goal

Port `_legacy/views/Ops.jsx` to `/ops`, ops-role only. An awarded-trade economics table;
generate and persist an FpML-style capture payload into `handoffs`; preview the payload;
advance a manual affirmation lifecycle (`sent → matched → affirmed`) on `handoffs` and the
linked `trades`; an exceptions queue (`handoff_exceptions`). **Per Decision 12 the payload
is persisted and previewable but NEVER transmitted** — no network send, no external call.

## Read first (grounding)

- POC: `_legacy/views/Ops.jsx`; the `stpPayload` builder lives at
  `_legacy/components/ui.jsx:212` (`stpPayload(rfq, allocations, trades)` — builds an
  FpML-5.12-style `TradeCaptureReport`: rfq metadata, per-allocation `counterpartyLegs[]`
  with LEI/UTI/pct/notional/price, affirmation channel, audit flags) — port it
  **server-side** (e.g. `lib/stp.ts`), pure function, no I/O.
- Mutation template: `app/(app)/rfqs/[id]/actions.ts:22`, `lib/record-event.ts:39`.
- Schema: `trades` (`db/schema.ts:225`), `handoffs` (248), `handoffExceptions` (262),
  `trade_status` enum (30: captured/sent/matched/affirmed), `handoff_status` enum (33:
  sent/matched/affirmed), `event_type` (43: `handoff_sent`, `handoff_advanced`,
  `exception_opened`/`exception_closed`).

## Build (one commit each)

1. `lib/stp.ts` — pure server-side FpML-style payload builder (port from `ui.jsx`),
   stored as JSON on `handoffs.payload`. No transmission.
2. `lib/queries/ops.ts` — tenant-scoped reads: awarded trades + their handoff state for
   `caller.firmId`; open `handoff_exceptions`.
3. `app/(app)/ops/page.tsx` — server component, ops-gated, fetches the trade/handoff table.
4. `app/(app)/ops/...` client — payload preview + lifecycle controls.
5. `app/(app)/ops/actions.ts`:
   - `generateHandoff(rfqId)` — build payload, insert `handoffs` (status `sent`), advance
     linked `trades` to `sent`, via one `recordEvent()` (`handoff_sent`).
   - `advanceHandoff(handoffId, to)` — `sent→matched→affirmed`, advancing both the handoff
     and its `trades`, via `recordEvent()` (`handoff_advanced`). When all affirmed, flip the
     rfq → `affirmed`.
   - `openException` / `closeException` on `handoff_exceptions`, via `recordEvent()`.

## Acceptance / validation gate

- Payload generated and stored, **never transmitted** (assert no fetch/network in `lib/stp.ts`).
- All lifecycle advances go through `recordEvent()`; handoff + trades move atomically.
- Tenant-scoped reads only.
- `npm test` && `npx tsc --noEmit` pass.

---

## Validation (/vr — 5 agents + Codex, 2026-06-16)

Verdict: **REASONABLE with mandatory revisions below.** Architecture sound (status
machine, Decision 7/12 alignment, one-handoff-per-rfq model). All findings are
localized to actions.ts + builder defensiveness.

### Critical (must fix before shipping)

- **C1 — `closeException` tenant escape.** `handoff_exceptions` has no `firmId`
  (`db/schema.ts:262`). Update must scope through `handoffs → rfqs`:
  ```ts
  update(handoffExceptions).set({ open: false }).where(
    and(
      eq(handoffExceptions.id, id),
      inArray(
        handoffExceptions.handoffId,
        tx.select({ id: handoffs.id }).from(handoffs)
          .innerJoin(rfqs, eq(rfqs.id, handoffs.rfqId))
          .where(eq(rfqs.firmId, caller.firmId)),
      ),
    ),
  ).returning()
  ```
  Assert `[updated]` truthy; throw "Exception not found" (don't leak existence
  cross-tenant — same message regardless of cause).
- **C2 — `generateHandoff` on RFQ with zero trades.** Inside `apply(tx)`, after
  the trades fetch: `if (!tradeRows.length) throw new Error('No trades to hand
  off — approve the award first.')` Mirror `approveAward:108`.
- **C3 — `advanceHandoff` partial trade lock loss.** The conditional trade
  UPDATE must `.returning()` and assert `updated.length === tradeIds.length`;
  else throw "Handoff state drifted — refresh and try again." Mirror
  `approveAward:99` stale guard.
- **C4 — LEI fallback must throw.** If `firm.lei == null && firm.shortCode ==
  null`, throw in `lib/stp.ts`: `Firm ${firm.id} missing LEI and shortCode —
  cannot build STP payload.` STP payload is the audit artifact; silent
  `LEI-UNKNOWN` is unacceptable. (User decision 2026-06-16.)

### Caution (revisions folded into build steps)

- **A1 — `trades` has no `firmId` column** (`db/schema.ts:225`). Trade-update
  predicate is `eq(trades.rfqId, rfqId) AND eq(trades.status, expected)`. The
  tenant gate lives on the rfq conditional UPDATE.
- **A2 — Don't query trades by jsonb membership.** Drive `advanceHandoff` trade
  updates by `eq(trades.rfqId, handoff.rfqId)` + status guard; treat
  `handoffs.tradeIds[]` as a denormalized snapshot for display only.
- **A3 — All-affirmed RFQ flip drift.** If the conditional UPDATE
  `rfqs.status: in_stp → affirmed` returns 0 rows (e.g. drifted to `cancelled`),
  throw inside the tx — do NOT silently skip. Rolls back the trade-affirm to
  preserve consistency.
- **A4 — Purity assertion strategy.** Instead of `expect(source).not.include('fetch')`,
  parse import lines: `expect(source.match(/^import .* from .*$/gm) ?? [])`
  must be a subset of an allowlist (types + pure helpers only). Also assert
  `lib/stp.ts` does NOT import `lib/email.ts`, `node:http`, or `@/lib/supabase/*`.
- **A5 — Seed cascade is sufficient.** `db/seed.ts:42` deletes `rfqs`; handoffs +
  handoff_exceptions cascade via `onDelete: 'cascade'` (`db/schema.ts:251, 264`).
  No manual delete needed. Add a comment in seed.ts noting the cascade.
- **A6 — Per-commit tests (not batched).** Git log (Block B) shows tests landed
  with the code they cover. Restructure plan accordingly.

### Notes

- **N1 — Compliance `exceptions` do not block `in_stp → affirmed`.** Intentional
  per Decision 12 boundary. Document with a one-line comment in actions.ts
  pointing to `app/(app)/approvals/actions.ts:189` (Block B closes all open
  compliance exceptions at award time).
- **N2 — Builder returns object; preview component owns `JSON.stringify(_, null, 2)`.**
  Drizzle handles jsonb serialization for storage; `<pre>` rendering does the
  pretty-print at the boundary. One sentence in the spec eliminates ambiguity.
- **N3 — Nav already wired.** `app/(app)/layout.tsx:18-21` has `/ops` for the
  `ops` role labeled "Trades & STP". No nav change needed.
- **N4 — `rfq.status` writers.** Block C is the first writer of `in_stp` and
  `affirmed` (no prior code touches these). Lazy sweep (`lib/auction-status.ts:51`)
  only flips `live → under_review`; no race with Block C transitions.
- **N5 — D-3 'dealer leak' (handoff doc §5) appears miscategorized.**
  `notifyAuctionClosed` (`lib/email.ts:49`) and `notifyAwardApproved` (`:68`)
  send to `rfq.requester.email` (buy-side), not dealers. Skipped from Block C.
  Confirm with Randall before deleting the §5 note.

### Plan revisions (folded into "Build" section below)

1. **DROP migration 0003.** No `handoffs.ref` unique index. Use random 8-char
   Crockford via `prefixedCrockfordRef('HO-')`; pilot-scale collision ~ 0. Re-add
   if real volume warrants. (User decision 2026-06-16.)
2. **Tests per commit** (not batched at end).
3. **Conditional UPDATEs** on every state transition with explicit stale-error
   throws (no silent skips).
4. **Builder fails loud** on missing LEI + shortCode.
5. **closeException tenant scope** via `handoffs → rfqs` join subquery.

### Revised commit list (7 → 6)

1. `feat(seed): trades + sent handoff for rfq:0138, trades for rfq:0139`
   (one synthetic handoff with one open exception, deterministic refs).
2. `feat(stp): pure FpML-style payload builder + tests`
   (`lib/stp.ts` + `lib/handoff-ref.ts`; LEI throws on missing data; tests
   cover shape, no-network via import allowlist, missing-LEI rejection).
3. `feat(ops): tenant-scoped queries + generated-SQL tests`
   (`lib/queries/ops.ts`).
4. `feat(ops): server actions (generate/advance/exception) + concurrency tests`
   (`app/(app)/ops/actions.ts`).
5. `feat(ops): /ops route + UI` (page + client component).
6. (deferred) — no schema migration; no nav change.

## Shipped (2026-06-16) — branch `feat/block-c-ops-stp`, 6 commits

Test count: **85** (was 63 after Block B, +22 new).

| Commit | Scope |
|--------|-------|
| `2577e7f` | docs: /vr validation results folded into this spec |
| `8b97f60` | `feat(stp)`: `lib/stp.ts` pure FpML builder + `lib/handoff-ref.ts` (11 tests; import-allowlist enforces no transmission) |
| `9b0e649` | `feat(seed)`: backfill trades for `rfq:0139` + trades/handoff/open exception for `rfq:0138` so `/ops` has lifecycle on first load |
| `ac98d21` | `feat(ops)`: `lib/queries/ops.ts` — tenant-scoped reads, 2 generated-SQL tests |
| `99bdea9` | `feat(ops)`: `app/(app)/ops/actions.ts` — 4 server actions (generate/advance/openException/closeException), 9 input-gate tests |
| `50c1305` | `feat(ops)`: `/ops` page + client component |

All /vr critical fixes landed:

- **C1** — `closeException` tenant-scopes via `handoffs → rfqs` join and a defense-in-depth tenant predicate in the conditional UPDATE (`app/(app)/ops/actions.ts:248`).
- **C2** — `generateHandoff` throws `'No trades to hand off — approve the award first.'` when called on an awarded RFQ with zero trade rows (`actions.ts:73`).
- **C3** — `advanceHandoff` asserts `updatedTrades.length === tradeIds.length` and `[updatedHandoff]` truthy; partial drift throws `'Handoff state drifted — refresh and try again.'` (`actions.ts:172, 178`).
- **C4** — `buildStpPayload` throws when a firm has neither LEI nor shortCode rather than emitting `LEI-UNKNOWN` (`lib/stp.ts:78`).

All cautions folded in:

- Trade update predicate is `eq(trades.rfqId, …) AND eq(trades.status, expected)`; `trades` has no firmId column (A1, A2).
- All-affirmed RFQ flip throws on drift inside the tx, rolls back the trade-affirm rather than silently committing against an inconsistent rfq (A3).
- `lib/stp.ts` purity asserted via import-allowlist (`expect(importLines).toEqual([])`) plus belt-and-suspenders source greps for `fetch`/`XMLHttpRequest`/`Resend`/`node:http`/external HTTP clients (A4).
- Seed cleanup relies on the existing `rfqs` delete; handoffs and handoff_exceptions cascade via FK (A5).
- Tests landed per commit, not batched (A6).

Deferred (per /vr):

- No migration 0003 — `handoffs.ref` left unindexed; collision risk at pilot scale is ~ 0. Add a unique index later if real volume warrants.
- Live-DB validator script for concurrency (mirror `scripts/validate-block-b.ts`) — recommended before merge but not blocking.
- D-3 "dealer leak" claim in §5 above appears miscategorized: `notifyAuctionClosed` and `notifyAwardApproved` both send to `rfq.requester.email` (buy-side), not dealers. The only dealer-facing email (`sendInvitation`) already uses `publicRef`. Confirm with Randall, then strike §5.
