# Open decisions & assumptions — need Randall's direction

These are NOT in the locked set. Each needs a call before (or during) the block
that depends on it. Tags: **(blocks A)** = resolve before starting Block A.

## Cross-cutting

### D-1. Multi-event launch transaction **(blocks A)** — ✅ RESOLVED
**Decision: extend `recordEvent()` to accept N event rows in one tx** (Option B).
Launch records `rfq_launched` + one `invitation_sent` per dealer, all atomic with the
state change. This touches the single structural chokepoint (`lib/record-event.ts:39`) —
keep the change minimal and backward-compatible (accept either one event or an array;
existing single-event callers unchanged). All existing 17 tests must still pass.

### D-2. Draft vs launch-only **(blocks A)** — ✅ RESOLVED
**Decision: launch-only.** Wizard holds state client-side; on launch the RFQ goes
straight to `live`. No draft persistence in MVP.

### D-3. RFQ `ref` generation **(blocks A)** — ✅ RESOLVED (D3b)
**Decision: sequence-based internal ref + random external `publicRef`.**
- Internal `rfqs.ref` = `VEL-{year}-{maxSeqForFirmThisYear+1, zero-padded 4}`, computed
  inside the launch tx. **Buy-side surfaces only.**
- **External/dealer-facing surfaces must NOT expose the sequence ref** — it leaks deal
  volume/ordering. Affected: invitation email (`lib/email.ts:36`, currently passes
  `rfqRef`) and the dealer `/quote/[token]` page.
- **New `rfqs.publicRef`** = random, non-sequential, human-quotable short code (e.g.
  `RFQ-` + 8-char Crockford base32), unique (add unique index), generated in the launch tx
  with retry-on-conflict. Shown to dealers instead of `ref`. **Schema change** (one column +
  migration) — folded into Block A.

**Why not just drop the ref (the rejected D3a):** machine linkage never depended on a
visible ref — the opaque token resolves to one `rfqId` server-side
(`lib/auth/caller.ts:63`), and quotes/events join on `rfqId`. But OTC dealers and traders
cross-reference deals out-of-band (phone, email). The token can't be that anchor (it's
secret, and per-dealer — two dealers on one RFQ hold different tokens). `publicRef` is the
shared, non-leaking external identifier. Internal sequence ref and external `publicRef`
both live on the RFQ row; nothing else changes.

**If `publicRef` is ever dropped, reconnection still holds.** `publicRef` is a human
convenience anchor, not a linkage dependency. The durable connection back to the deal is
always available two ways: (1) each dealer's quote-link token resolves to the exact `rfqId`
server-side; (2) the buy-side uses the internal sequence `ref`. Dropping `publicRef` loses
only the spoken/emailed cross-reference, never the ability to connect a quote to its RFQ.

### D-4. Product templates source **(blocks A, E)** — ✅ RESOLVED
**Decision: typed constant** (`lib/templates.ts`), no schema change. Panels read live
from the DB for `caller.firmId`. Block E's templates section is read-only over the constant.

### D-5. Late-quote auto-extension — ✅ RESOLVED
**Decision: drop auto-extension.** Hard deadline only (Decision 19 lazy sweep). Remove the
POC copy that implies "late-quote auto-extension active" so we don't claim behavior we
don't have.

## Block A — accepted MVP gaps (post-merge, 2026-06-15)

Block A shipped in PR #1 with the following deliberate gaps. Each is logged
here so future blocks can revisit. None block the demo loop; all have known
remediation paths.

- **Email delivery failure invisible to trader.** `lib/email.ts:22-24` swallows
  Resend errors silently. If `RESEND_API_KEY` is missing or Resend returns a
  4xx/5xx, the trader sees a healthy quote board with no responses and no
  signal that the invitation never reached the dealer. **Remediation path:**
  add `invitations.lastEmailError` + `lastEmailAttemptAt` columns; surface a
  per-dealer "Resend invitation" banner on `/rfqs/[id]`.

- **Post-commit crash leaves RFQ live without delivered tokens.** Vercel can
  SIGTERM a serverless invocation between the `recordEvent` commit and the
  post-commit `sendInvitation` loop (`app/(app)/rfqs/new/actions.ts`). The RFQ
  is `live`, tokens exist hashed in `invitations`, but the dispatch never
  happened. Dealers have no Supabase Auth — no token = no access path.
  **Remediation path:** same as above (resend button drains undelivered rows),
  or a small "pending email" queue swept by a buy-side reader.

- **Dealer-email slug collisions silent.** `dealerEmailFor(firmName)` in
  `actions.ts` slugifies firm names into `randall+<slug>@starfysh.net`. Two
  firms slugging to the same value (e.g. `"KST Capital"` and `"KST-Capital"`)
  both succeed; `invitations.dealerEmail` has no unique constraint
  (`db/schema.ts:158-171`). Only the inbox owner notices. **Remediation
  path:** add `unique(rfqId, dealerEmail)` and let the unique-violation drive
  a `+digit` retry, OR introduce `firms.shortCode` and slug from that.

- **`resolveDealerToken` doesn't enforce RFQ live state** despite the
  comment claiming it does (`lib/auth/caller.ts:58-74`). Dealers with a valid
  token can load the read-only `/quote/[token]` page after the deadline.
  Quote *actions* still enforce the deadline separately at
  `app/quote/[token]/actions.ts:24-26` so no writes leak through.
  **Remediation path:** add a `rfq.status === 'live'` and `deadline > now()`
  check in `resolveDealerToken`; one-liner.

## Block A — implementation walkbacks from D-1 and D-3

During Block A implementation, two locked decisions were walked back further
than originally written. The decisions themselves still hold; the implementation
shape differs from what those entries describe.

- **D-1 walkback.** The locked decision said extend `recordEvent()` to accept
  N event rows so launch could write `rfq_launched + N × invitation_sent`
  atomically. As shipped: `recordEvent()` is unchanged. The launch writes a
  single `rfq_launched` event whose `detail.invitedDealerIds` carries the
  dealer list. The spirit of D-1 (atomicity, single chokepoint) is preserved
  via the surrounding tx; the event-log shape is different — N+1 rows became
  1 row. If the audit trail needs per-dealer rows later, the walkback can be
  reversed without touching the schema.

- **D-3 walkback.** The locked decision said `publicRef` should be generated
  inside the launch tx with retry-on-conflict. As shipped: `publicRef` is
  generated one-shot outside the tx; the `rfqs.publicRef` unique constraint
  is the collision backstop. The retry was removed because Postgres aborts a
  tx on any unique-violation (`current transaction is aborted, commands
  ignored until end of transaction block`), making the inside-tx retry
  structurally impossible without savepoints. The walked-back shape is also
  simpler — one-shot with a single backstop instead of a retry loop.

## Block B — accepted MVP gaps + walkbacks (post-merge, 2026-06-16)

Block B shipped in PR #3 with the following deliberate gaps. Each is logged here
so future blocks can revisit; none block the demo loop.

- **`notifyAwardApproved` email failure invisible.** Same shape as Block A's
  email gap. Approve commits successfully, then fires `notifyAwardApproved`
  fire-and-forget (`app/(app)/approvals/actions.ts:215`). If Resend is down,
  the requester isn't told the award was approved. **Remediation path:** when
  the broader email outbox / retry is built (cross-cutting), both Block A and
  Block B inherit it.

- **`exception_opened` and `exception_closed` enum values reserved-but-unused.**
  Per the plan's "Audit shape" decision, recommend + approve each emit ONE
  aggregate event (`award_recommended` / `award_approved`) whose `detail`
  carries `openedExceptionRef` or `closedExceptionRefs`. The two enum values
  exist in the `event_type` enum (`db/schema.ts:50`) but no writer uses them.
  Mirrors D-1's walkback shape (one aggregate event, rich detail). If
  per-exception event rows are wanted later, the enum is ready.

- **`exceptions.status` is free-form text + `exceptions.open` boolean.**
  Block B writes one of `'open' | 'acknowledged' | 'closed'` via the
  `ExceptionStatus` TS union exported from `lib/policy.ts`. No pgEnum
  migration — Block D may promote to a Postgres enum later if it wants
  RLS-level enforcement. The `open` boolean and `status` text overlap (`open
  = (status === 'open')`); Block B does not enforce that invariant at the DB
  level.

- **`nextExceptionRef` (firm-scoped `EX-YYYY-NNNN`) has a SELECT-MAX+1 race.**
  Two concurrent recommends in the same firm can both observe `max_seq = N`,
  both write `EX-YYYY-(N+1)`; the `exceptions_firm_ref_uniq` index aborts the
  second tx. The losing recommend then loses its award too — not just the
  exception row. Documented as "astronomically rare" in
  `lib/exception-ref.ts`; under real load this becomes "merely rare". A
  Postgres sequence would be the durable fix.

- **Concentration "drift since recommend" check is best-effort.** The check
  inside the approve tx re-fetches the snapshot then compares against
  `award.flags`. If the concentration moved enough that a NEW warn flag
  would emerge, approve throws and asks the trader to re-recommend. But the
  check only looks at "is there a flag now that wasn't there at recommend"
  — it does not detect "concentration went down" or "flagged dealer now
  35.1% vs recommend's 36.0%". For the pilot's threshold-trip-on-change
  semantics this is fine.

- **>$250M committee gate is single-approver-plus-note** per Decision 21.
  Block B enforces a ≥20-char trimmed note server-side and shows the
  "two-person committee required" banner client-side, but does not actually
  require a second distinct approver. Documented pilot gap; Block D may
  layer real two-approver enforcement.

- **Re-recommend after a reject erases history of prior recommend's flags.**
  `awards_rfq_uniq` index means there's at most one `awards` row per RFQ.
  After reject → under_review → re-recommend, the second recommend would
  fail on the unique constraint (the prior recommend's `awards` row is
  still there). The current shape: reject doesn't delete the award row, so
  re-recommend is blocked. Either reject should `tx.delete(awards)` for
  the rfq, or recommend should `tx.update` on conflict. Either way is a
  follow-up.

## Block B — implementation walkbacks

- **Concentration snapshot moved inside `apply(tx)`.** The plan said
  "snapshot before opening the tx" relying on the conditional UPDATE's rfq
  row lock to prevent drift. /vr surfaced that the lock prevents
  concurrent approvals on the SAME rfq but NOT concurrent approvals on
  OTHER rfqs in the same firm (which can also commit trades that move
  concentration). The shipped code calls `getDealerConcentration(firmId,
  asOf, tx)` inside `apply(tx)` after the conditional UPDATE returns. The
  concentration helper accepts an optional executor (`db | Tx`) to make
  this work.

- **`StaleApprovalError` is a sentinel-string error, not a class.** The
  plan called for a typed error class. Next's `'use server'` boundary
  forbids non-async exports from action files, so the shipped form is a
  factory + sentinel message; the client matches on the substring "no
  longer awaiting approval". Same external behavior, different shape.

- **`trades.ref` random, not firm-scoped sequence.** See D-6.

## Block-specific (resolve when the block starts)

### D-6. Block B — `trades.ref` / `handoffs.ref` format — ✅ RESOLVED
**Decision: random base32 via `lib/trade-ref.ts` (mirrors `lib/public-ref.ts`).**
`T-` + 8 chars Crockford (no I/L/O/U) over 40 random bits — ~10^12 distinct values
per call. Backed by `trades_ref_uniq` unique index. The Crockford encoder is shared
by both `lib/public-ref.ts` and `lib/trade-ref.ts` via `lib/ref-base.ts`
(`prefixedCrockfordRef(prefix)`).

Why not the originally-proposed firm-scoped `T-YYYY-NNNN` sequence: /vr surfaced
that SELECT-MAX+1 has a TOCTOU race under concurrent approvals; a per-firm sequence
also requires a `trades.firmId` denorm (trades currently joins through
`rfqId → rfqs.firmId`). Random refs sidestep both.

`handoffs.ref` deferred to Block C.

### D-7. Block D — concentration "real vs seeded" — ✅ RESOLVED (at Block B)
**Decision: real figures from `trades` even when sparse.** Block B already wires
this end-to-end; Block D consumes the same `getDealerConcentration(firmId, asOf?,
executor?)` helper (`lib/queries/concentration.ts`). USD-only with `TODO(multi-ccy)`,
counts all `tradeStatus` values, scoped via `trades.rfqId → rfqs.firmId`.

### D-8. Block E — what (if anything) becomes editable — ✅ RESOLVED
**Decision: bank panels editable for functional MVP; all other admin sections remain
read-only/TODO until they have real persistence and enforcement wiring.**
Bank panels already drive Create RFQ, so edits are behaviorally real. Product templates
and policy thresholds are code-backed (`lib/templates.ts`, `lib/policy.ts`), and user
creation needs Supabase Auth handling, so those are deferred rather than shipped as
no-op controls.

### D-9. Block F — Storage bucket layout & MIME/size limits
Decision 12 + 24: real uploads, tenant-scoped paths, MIME/size validation only (no
scanning). Need: bucket name, path convention (e.g. `{firmId}/{rfqId}/{filename}`),
allowed MIME types, max size. → decide at Block F.

## Assumptions to validate (from the original handoff)

- **Hero RFQ deadline for demos.** Seed sets the live RFQ to +18 min
  (`db/seed-data.ts:81`), so it lazy-closes mid-demo. Confirm: re-seed to reset, or
  set a far-future deadline for the hero RFQ specifically?
- **Prod re-seed required.** Prod (`kmhwchgixvcolwrqiryu`) is a different Supabase
  project than dev; seeding is per-project and dealer tokens are per-project.
  Confirm prod is seeded and the team has prod tokens. Watch ambient-env shadowing
  (unset `DATABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
  before seed/migrate, or the wrong project gets written).
- **`NEXT_PUBLIC_SITE_URL` in prod env.** Magic-link callbacks and invitation links
  use it (`lib/email.ts:11`); confirm it's the prod URL or dealer emails break.
- **`RESEND_API_KEY` in prod env.** Without it, sends are logged and skipped
  (`lib/email.ts:13`). Confirm set before Block A is demoed.
- **Money rounding at percentage boundaries.** Award math assumes whole-percent
  fills (`take` ∈ integers, `lib/award-math.ts:45`). Confirm whole-percent is
  sufficient for all pilot products; fractional-percent would need re-examination of
  integer-tick rounding.
