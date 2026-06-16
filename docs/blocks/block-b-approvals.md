# Block B — Approval workspace + threshold enforcement (starter prompt)

> Paste into a fresh session. Read `docs/HANDOFF.md` (Decisions 7, 20, 21) and
> `docs/open-decisions.md` (D-6, D-7) first. Depends on Block A only loosely — seeded
> `awaiting_approval` RFQs (`db/seed-data.ts`, `rfq:0141`) are enough to build against.

## Post-Block-A corrections (validated against merged `main`, 2026-06-15, 5-agent sweep)

Block A is green (18/18 tests, `tsc` clean, lint clean). After a deeper validation pass,
the following supersede the original draft:

1. **Seed has no award to approve.** Seeded `awaiting_approval` RFQ `rfq:0141`
   (`VEL-2026-0141`, Russell 2000 collar, **$120M** notional, 3-quote ladder: Atlas
   0.4500/50%, Kestrel 0.5200/100%, Marlowe 0.5800/100%) has no `awards` row —
   `seed.ts` never calls `recommendAwardAction`. **Resolution: call
   `recommendAwardAction(rfq.id, 'blended')` from `seed.ts` post-seed** (faithful to
   the real path; exercises the flag/exception logic this block adds at recommend
   time). $120M trips the >$100M gate but NOT the >$250M rule.
2. **D-3 walkback for `notifyAwardApproved`/`notifyAuctionClosed` — NOT a leak.** The
   earlier draft asked Block B to rewrite `rfq.ref` → `rfq.publicRef` in these two
   emails. Validated against the code: both resolve recipient via `rfq.requester.email`,
   and the `users` table is buy-side only by design (Decision 10, `db/schema.ts:67-68`
   comment is explicit; dealers never get `users` rows — they hold opaque invitation
   tokens). There is no code path that routes either email to a dealer. Block A
   already closed the only real dealer-facing path (invitation email uses
   `publicRef`). **Do not modify `notifyAwardApproved` or `notifyAuctionClosed`.**
3. **Corrected schema anchors** (Block A's new column shifted line numbers): `awards`
   `db/schema.ts:197` (not 200), `trades` `224`, `exceptions` `271` (compliance table;
   `handoff_exceptions` at `260` is unrelated). Still accurate: `event_type` enum at
   `42-50`, `recommendAwardAction` at `app/(app)/rfqs/[id]/actions.ts:13` with
   signature `(rfqId, mode: 'single' | 'blended')`, `recordEvent` single-event
   signature at `lib/record-event.ts:39`, `notifyAwardApproved` at `lib/email.ts:68`.
4. **`trades` has no `open` boolean.** Status lives in the `tradeStatus` enum
   (`captured | sent | matched | affirmed`, `db/schema.ts:30-32`); new rows default to
   `'captured'`. Concentration counts **all statuses** (committed exposure, not
   settlement state).
5. **`awards.flags` shape:** `{ severity: 'info' | 'warn'; text: string }[]` (severity
   from `exceptionSeverity` enum at `db/schema.ts:36`). No TS type exists yet — define
   and export one from `lib/policy.ts`. Today `recommendAwardAction` always writes
   `flags: []` (stub) and never opens an exception — extend, don't replace.
6. **`exceptions` table currently has zero writers.** Block B is the first. Use `ref`
   format `EX-YYYY-NNNN` (internal-facing, matches `T-`/`VEL-` style). The
   `exception_opened` / `exception_closed` event types (`db/schema.ts:50`) are reserved
   but unused — Block B activates them.
7. **Multi-currency punt.** `rfqs.ccy` defaults USD but is per-RFQ; `trades.ccy` is
   per-row, no FX table exists. Concentration helper filters to USD only with an
   inline `TODO(multi-ccy)`; sufficient for MVP.

Heads-up (not Block B's job, but don't trust the comment): `resolveDealerToken`
(`lib/auth/caller.ts:61`) claims it enforces RFQ-live state — it does NOT. Deadline
enforcement lives only in `app/quote/[token]/actions.ts:25`.

## Goal

Port `_legacy/views/Approvals.jsx` to `/approvals`, approver-role only. A queue of
`awaiting_approval` RFQs; each shows the proposed award, the archived quote ladder as
best-execution evidence, concentration context, and policy flags. Actions: **approve**
(→ `awarded`, generate `trades`, fire `notifyAwardApproved`, close any open exception),
**reject** (→ `under_review`), **request clarification** (→ `under_review` + note). All
through `recordEvent()`. The existing `recommendAwardAction` already creates the `awards`
row and flips to `awaiting_approval` — approve/reject consume that.

## Read first (grounding)

- POC: `_legacy/views/Approvals.jsx`.
- Existing producer of the award: `app/(app)/rfqs/[id]/actions.ts:13` (`recommendAwardAction`)
  — it writes `awards` with `allocations`, `flags: []`, `approved: false`. Block B consumes it.
- Mutation template + role gate: same file, `lib/record-event.ts`.
- Award math (for flag computation): `lib/award-math.ts` (`bestSingle`, `bestBlended`).
- Schema: `awards` (`db/schema.ts:197`), `trades` (224), `exceptions` (271 — compliance
  table; not the unrelated `handoff_exceptions` at 260),
  `event_type` (42-50: `award_approved`, `award_rejected`, `clarification_requested`,
  `trade_captured`, `exception_opened`/`exception_closed`).
- Email: `lib/email.ts:68` (`notifyAwardApproved`). Internal-only — do not modify.
- Concentration logic (Decision 20) — build a shared helper now, reused by Block D:
  `lib/queries/concentration.ts` (trailing-90-day `trades.allocNotionalMinor` share per
  dealer, scoped to firm via `trades.rfqId → rfqs.firmId` since `trades` has no direct
  `firmId`). Counts **all `tradeStatus` values** (no `open` boolean exists). Filter to
  USD only with a `TODO(multi-ccy)` comment. Projection helper adds the proposed
  allocation to numerator + denominator. No new index for MVP volume.

## Threshold rules (Decision 21) — each gets a unit test

Computed at **recommend** time (move into `recommendAwardAction` or a shared
`lib/policy.ts`): (c) dealer projected share >35% → flag on the award; (d) award alloc ≠
best quoted price → mandatory deviation note + auto-open `exceptions` row.
Gated at **approve** time: (a) notional >$100M → cannot finalize without this approver
step (already true since approve is the approver action; assert no auto-award path
exists); (b) notional >$250M → UI shows "two-person committee approval required", approve
requires a note acknowledging it (single-approver pilot gap — display the requirement,
enforce as single-approver-plus-note).

Put the four rules in `lib/policy.ts` as pure functions and unit-test each
(`lib/policy.test.ts`). The >$100M and 0.520%-vs-best cases anchor on seed figures
(`rfq:0141`, $120M); the >$250M and 35%-concentration cases use synthetic values —
no seed RFQ is that large or that concentrated.

## Build (one commit each)

1. **Schema migration** — add the integrity constraints the rest of the block depends on:
   - `uniqueIndex('awards_rfq_uniq').on(rfqId)` — recommend is idempotent.
   - `uniqueIndex('trades_ref_uniq').on(ref)` — trade refs globally unique.
   - `uniqueIndex('exceptions_firm_ref_uniq').on(firmId, ref)` — match the rfqs pattern.
   - `npm run db:generate && db:migrate`.
2. `lib/policy.ts` + `lib/policy.test.ts` — the four threshold rules as pure functions.
   Exports:
   - `type AwardFlag = { id: string; severity: 'info' | 'warn'; text: string }` (re-used by
     `awards.flags` and the approve action). `id` is `sha1(severity+'|'+text)` — stable, lets
     the approve action verify ack-set equality without trusting client-side text.
   - `type ExceptionStatus = 'open' | 'acknowledged' | 'closed'` — closed string union; do
     NOT migrate `exceptions.status` to pgEnum mid-block. Block D may promote later.
   - `projectConcentration(current, { dealerFirmId, proposedNotionalMinor })` — pure
     projection helper, lives here (not in `lib/queries/`) because the 35% rule consumes it.
3. `lib/queries/concentration.ts` — `getDealerConcentration(firmId, asOf?)`. USD-only with
   `TODO(multi-ccy)`, counts all `tradeStatus` values, 90-day trailing, joins through
   `trades.rfqId → rfqs.firmId` (no direct `trades.firmId`). Generated-SQL test asserts both
   firm and USD predicates appear in numerator AND denominator (tenant-isolation guard).
4. **Extend `recommendAwardAction`** (today it writes `flags: []` and opens no exception):
   - Populate `awards.flags` (with `id`).
   - Append deviation note to `awards.rationale` when rule (d) fires.
   - When rule (d) fires, also insert ONE `exceptions` row inside the same `apply(tx)` —
     `ref: EX-YYYY-NNNN` (firm-scoped sequence, mirrors `VEL-YYYY-NNNN`), `status: 'open'`,
     `severity: 'warn'`. The `award_recommended` event's `detail` carries the new
     `openedExceptionRef` (one event per `recordEvent` call — see "Audit shape" below).
   - The `awards_rfq_uniq` index from step 1 makes this idempotent against double-click.
5. **Update `db/seed.ts`** to call `recommendAwardAction(rfq.id, 'blended')` for `rfq:0141`
   post-seed so the queue has content. Seed deletes prior demo rows, so no idempotency risk.
6. `lib/queries/approvals.ts` — tenant-scoped queue read: `awaiting_approval` RFQs for
   `caller.firmId` joined with `awards`, archived quote ladder, flags, dealer concentration
   snapshot, `exceptions` (open). Generated-SQL test for firm scoping.
7. `app/(app)/approvals/page.tsx` + `[id]/` (or inline panel) — server component,
   approver-role gated, fetches the queue and detail view with evidence.
8. `app/(app)/approvals/actions.ts` — `approveAward`, `rejectAward`, `requestClarification`.
   Each is a single `recordEvent()` call wrapping the listed work in `apply(tx)`:
   - **All three:** start with a **conditional update**
     `UPDATE rfqs SET status=<next> WHERE id=$id AND status='awaiting_approval' RETURNING *`
     — if `.returning()` yields zero rows, throw a typed `StaleApprovalError`. This is the
     concurrency guard (no `SELECT FOR UPDATE` needed; the conditional update is atomic).
     Drizzle's `.returning()` on UPDATE is confirmed working in this codebase
     (`lib/auction-status.ts:51-55`).
   - **Approve specifically:**
     - Re-fetch concentration inside the tx and re-evaluate rule (c) against the proposed
       allocation. Fail loudly if breach (not a stale-snapshot pass).
     - Server-side validate the ack-set equals every `warn`-severity flag id on the award.
     - Server-side validate the >$250M note: `note.trim().length >= 20` if rule (b) fires.
       (Pilot gap per `HANDOFF.md:91` — single-approver-plus-note, NOT a real committee.
       Document the gap in a `policy.test.ts` case.)
     - Set `awards.{approved=true, approvedBy, approvedAt}`.
     - Insert one `trades` row per allocation. `ref` = `'T-' + crockfordBase32(5 bytes)`
       via a new `lib/trade-ref.ts` (mirrors `lib/public-ref.ts:1-18` — Crockford alphabet,
       no I/L/O/U, 8 chars, ~10^12 collision space). No DB query needed. `trades_ref_uniq`
       index from step 1 is defense-in-depth.
     - Close **all** open `exceptions` rows for the rfq (`status='closed', open=false`) —
       no kind discriminator exists; closing everything open for the rfq is unambiguous and
       cheap.
     - Emit ONE aggregate `award_approved` event whose `detail` includes
       `{ tradeRefs: [...], closedExceptionRefs: [...], ackedFlagIds: [...] }`. The
       `trade_captured` and `exception_closed` enum values stay reserved-but-unused — this
       is the same pattern as D-1's walkback (one event with rich detail).
     - **Post-commit:** fire `notifyAwardApproved(rfqId)` fire-and-forget. `lib/email.ts:15`
       swallows Resend errors — this is the accepted gap per `open-decisions.md:67-75`. No
       outbox in Block B.

## Acceptance / validation gate

- Approve/reject/clarify each ONE `recordEvent()` call; all DB mutations inside `apply(tx)`.
- Concurrency: stale approve attempts (rfq already moved) throw `StaleApprovalError` —
  manual test with two browser tabs, expect one success + one typed error.
- Tenant-scoped reads; generated-SQL tests for both `approvals` queue read AND
  `getDealerConcentration` assert the firm filter is in the SQL.
- Money: `trades.allocNotionalMinor = Number(BigInt(rfq.notionalMinor) * BigInt(pct) / 100n)`.
  Cast to `BigInt` before multiplying — both `rfqs.notionalMinor` and `trades.allocNotionalMinor`
  are declared `bigint(..., { mode: 'number' })` (`db/schema.ts:124, 230`), so JS reads them
  as `number`; doing the math as `number * number` would silently float-corrupt at large
  notionals. Anchor unit test: `rfq:0141` $120M × 50% (Atlas) = 6,000,000,000 cents exactly.
  Anchor a non-cleanly-dividing case too (e.g. notional × 33%).
- All four threshold rules unit-tested. >$250M test asserts trimmed-empty note rejects.
- Recommend is idempotent: calling `recommendAwardAction` twice on the same RFQ throws on
  the unique-index violation (test).
- `npm test` && `npx tsc --noEmit` && `npm run lint` pass.

## Decisions resolved (2026-06-15, with /vr validation)

- **D-6 trade ref format:** **random base32 via `lib/trade-ref.ts`** (NOT `T-YYYY-NNNN` —
  /vr surfaced that a per-firm sequence requires `trades.firmId` denorm and a MAX+1 race).
  Internal-facing only. Backed by `trades_ref_uniq`.
- **D-7 concentration source:** real figures from `trades` even if sparse — no synthetic data.
- **Concentration trade-status filter:** all `tradeStatus` values (committed exposure ≠
  settlement state).
- **Currency scope:** USD-only for MVP with inline `TODO(multi-ccy)`.
- **`exceptions.ref` format:** `EX-YYYY-NNNN`, firm-scoped sequence (mirrors `VEL-`).
- **Audit shape (validation gate):** ONE aggregate event per action; rich `detail` carries
  the trade refs, closed exception refs, and acked flag ids. Mirrors D-1 walkback.
  `trade_captured`/`exception_opened`/`exception_closed` enum values remain reserved.
- **Concurrency guard:** conditional UPDATE returning the row, NOT `SELECT FOR UPDATE`.
- **$250M policy:** single-approver-plus-note (≥20 chars trimmed), per `HANDOFF.md:91`.
  UI shows the "two-person committee required" banner; pilot gap documented in tests.
- **Email durability:** fire-and-forget; failures logged only. Accepted gap per
  `open-decisions.md:67-75`.

## /vr validation appendix (2026-06-15) — VERDICT: CAUTION → REASONABLE after revisions

5-agent sweep (code-explorer, silent-failure-hunter, Plan, Codex, prior fact-finders).
Findings folded into the build steps above. Original plan had three blockers:

| # | Concern | Severity | Resolution (in plan above) |
|---|---------|----------|---------------------------|
| 1 | `recordEvent` single-event constraint can't express multi-step approve audit | CRITICAL | Aggregate `award_approved` event with rich `detail` (step 8) |
| 2 | Concurrent approve → duplicate trades + double email; no row lock; no unique constraints | CRITICAL | Conditional UPDATE returning row + `awards_rfq_uniq` / `trades_ref_uniq` indexes (steps 1, 8) |
| 3 | `recommendAwardAction` not idempotent → double-click creates two awards + two exceptions | HIGH | `awards_rfq_uniq` index (step 1) |
| 4 | `trades.ref` collision (`SELECT MAX+1` race; no unique index) | HIGH | Random base32 + `trades_ref_uniq` (step 1, 8) |
| 5 | Concentration projection stale between queue render and approve click | HIGH | Re-evaluate rule (c) inside approve tx (step 8) |
| 6 | `notifyAwardApproved` swallows Resend errors silently | HIGH | Accepted gap per `open-decisions.md:67-75`. Not Block B's problem. |
| 7 | `>250M` note empty-string bypass (`typeof === 'string'` passes `''`) | HIGH | `note.trim().length >= 20` server-side (step 8) |
| 8 | Flag-ack theater (no stable flag id) | MEDIUM | `AwardFlag.id = sha1(severity+text)` (step 2) |
| 9 | Multiple open `exceptions` per rfq → ambiguous "close the open one" | MEDIUM | Close ALL open exceptions for the rfq on approve (step 8) |
| 10 | `exceptions.status` free-form text overlapping `open` bool | MEDIUM | TS union `'open'\|'acknowledged'\|'closed'` exported from policy.ts (step 2). No pgEnum migration. |
| 11 | $250M rule weaker than docs imply (no real committee gate) | MEDIUM | Confirmed pilot gap per HANDOFF.md:91; documented in policy.test.ts (step 8) |
| 12 | Concentration tenant-isolation hole if join missed | MEDIUM | Generated-SQL test asserts firm + USD predicates (step 3) |

**Simplifications applied:**
- `T-YYYY-NNNN` firm-scoped trade ref → random base32 (no sequence query, no firmId denorm).
- Multi-event audit → single aggregate event (no `recordEvent` API change).
- No outbox pattern (matches Block A; defer to a cross-cutting Block).

**Open question deferred to runtime:** if rule (d) deviation reasoning needs a structured
ack (not just a free-form note), revisit in a follow-up. Pilot is fine with rationale text.
