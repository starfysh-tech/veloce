# Block B — Approval workspace + threshold enforcement (starter prompt)

> Paste into a fresh session. Read `docs/HANDOFF.md` (Decisions 7, 20, 21) and
> `docs/open-decisions.md` (D-6, D-7) first. Depends on Block A only loosely — seeded
> `awaiting_approval` RFQs (`db/seed-data.ts`, `rfq:0141`) are enough to build against.

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
- Schema: `awards` (`db/schema.ts:197`), `trades` (221), `exceptions` (268),
  `event_type` (43: `award_approved`, `award_rejected`, `clarification_requested`,
  `trade_captured`, `exception_opened`/`exception_closed`).
- Email: `lib/email.ts:68` (`notifyAwardApproved`).
- Concentration logic (Decision 20) — build a shared helper now, reused by Block D:
  `lib/queries/concentration.ts` (trailing-90-day awarded `trades.allocNotionalMinor`
  share per dealer, scoped to firm, all summed as USD; projection adds the proposed
  allocation to numerator + denominator).

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
(`lib/policy.test.ts`) against figures from the seed (the >$100M and 0.520%-vs-best cases).

## Build (one commit each)

1. `lib/policy.ts` + tests — the four threshold rules as pure functions.
2. `lib/queries/concentration.ts` — shared concentration helper (+ projection).
3. Wire flags (c)/(d) into the recommend path (extend `recommendAwardAction`): set
   `awards.flags`, add deviation note, auto-open exception via the same `recordEvent` tx.
4. `lib/queries/approvals.ts` — tenant-scoped queue read: `awaiting_approval` RFQs for
   `caller.firmId` with their award, quote ladder, flags, concentration context.
5. `app/(app)/approvals/page.tsx` — server component, approver-gated, fetches the queue.
6. `app/(app)/approvals/[id]/...` (or inline panel) — detail with evidence + actions client.
7. `app/(app)/approvals/actions.ts` — `approveAward`, `rejectAward`, `requestClarification`,
   each a single `recordEvent()` call. Approve: flip rfq → `awarded`, set
   `awards.approved/approvedBy/approvedAt`, insert `trades` (one per allocation; D-6 ref
   format), close open exception, then `notifyAwardApproved` after commit. Approve must
   re-validate flag acknowledgments and the >$250M note server-side.

## Acceptance / validation gate

- Approve/reject/clarify each a single `recordEvent()` tx; `trades` generated inside it.
- Tenant-scoped reads; an approver only sees their firm's queue.
- Money: `trades.allocNotionalMinor` derived from rfq notional × allocation pct in cents,
  integer-exact (no float).
- All four threshold rules unit-tested.
- >$250M note enforced server-side, not just UI.
- `npm test` && `npx tsc --noEmit` pass.

## Resolve when starting

- **D-6** trade ref format. - **D-7** real-vs-seeded concentration (affects how populated
  the context looks; recommendation: real figures even if sparse).
