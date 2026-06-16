# Veloce MVP — Engineering Handoff (Remaining Work)

> Source of truth for the remaining MVP build. Locked decisions are **binding** —
> surface conflicts, don't silently deviate. Per-block starter prompts live in
> `docs/blocks/`. Cross-cutting choices still needing Randall's direction live in
> `docs/open-decisions.md`.

## Context

Veloce is a Next.js 15 (App Router) OTC equity derivatives RFQ/auction platform.
Stack: Vercel + Supabase (Postgres, Auth, Storage, Realtime) + Drizzle ORM,
TypeScript strict throughout. Repo: `starfysh-tech/veloce`, branch `main`,
auto-deploys to https://mvp-veloce.vercel.app. A legacy Vite POC lives on the
`poc` branch / `poc-v1` tag; the ported POC source is under `_legacy/` (excluded
from build).

The architecture was settled through a full design-tree walk. **The locked
decisions below are binding. Do not re-litigate or silently deviate — if a
decision blocks you, surface it rather than working around it.**

## Locked architectural decisions (binding)

1. **Parallel-run pilot, functional not certified.** Real workflows, but execution
   stays on existing rails. No real STP transmission, no SOC 2, no bank legal
   onboarding.
2. **Dealers quote directly via magic-link**, no accounts. Trader transcription is
   a fallback (not yet built).
3. **Multi-tenant schema, single-tenant operation.** Every business row carries
   `firmId`; every query is tenant-scoped. No tenant-management UI.
4. **Vercel-native.** Next.js App Router, route handlers + server actions as the
   API. No separate backend service.
5. **Supabase platform + Drizzle access.** All writes and sensitive reads go
   through server route handlers / actions on a service-role or RLS-backed
   connection. RLS is defense-in-depth. The client uses Supabase directly ONLY to
   subscribe to Realtime.
6. **Auction deadline is a stored timestamp; every quote write self-validates
   `now() < deadline` server-side.** Correctness lives in the write path.
7. **Transactional hybrid audit.** Append-only `events` table is the legal record;
   state tables are the read model. Both written atomically through `recordEvent()`
   (`lib/record-event.ts`). **No route handler updates a state table directly —
   every mutation goes through `recordEvent()`.** This is the single most important
   structural rule.
8. **Integer money.** Notional in minor units (`bigint`, **cents** — `$250M =
   250_000_000 * 100`), prices `numeric(12,4)` handled as decimal strings /
   integer ticks. Never floats. Award math is in `lib/award-math.ts`, unit-tested
   against verified figures (2.656% blended vs 2.79% single, 13.4 bps / $335,000 on
   $250M; approval RFQ 0.485% vs 0.520%).
9. **Resend email; Supabase Realtime on the buy-side board only.** Countdown is a
   pure client render off the stored timestamp.
10. **Two-tier auth.** Buy-side = Supabase Auth accounts with `firmId`/`role`.
    Dealers = opaque capability tokens (sha256-hashed in `invitations`), resolved
    server-side, scoped to one RFQ. **Blind masking is a caller-aware projection in
    the read layer (`lib/auth/mask.ts`), never in RLS or the client.**
11. **Hybrid rendering.** Route `page.tsx` server components fetch tenant-scoped,
    pre-masked data; `'use client'` components handle interaction and call server
    actions / route handlers. Rule: **pages fetch, client components interact.**
12. **STP persisted but internal** (payload generated, stored, previewed, never
    transmitted). **Attachments are real Supabase Storage uploads, tenant-scoped,
    access-gated by the same caller rules.**
18. **Realtime is a signal, not a data source.** The board client subscribes to
    `quotes` changes and re-fetches the masked board from the server on any change.
    The Realtime payload itself is never trusted as data.
19. **Lazy auction sweep, no cron.** Effective status derived from the deadline
    timestamp at read time (`lib/auction-status.ts`); a buy-side read
    opportunistically flips `live → under_review` through `recordEvent()` and fires
    the auction-closed email.
20. **Concentration computed for real**, trailing-90-day awarded notional share per
    dealer, all notionals summed as USD (indicative, single-currency basis — label
    it as such in the UI). Projection for the approval flag adds the proposed
    allocation to numerator and denominator.
21. **Thresholds enforced/flagged in-flow, single-approver model** — no approvals
    table, no schema change. The >$250M two-person rule is displayed as a
    requirement but enforced as single-approver-plus-note for the pilot (honest
    gap, no governance theater). The other three rules are fully enforced with
    tests.
22. **Admin read-only**, with code comments marking what each section needs to
    become editable.
23. Trade-transcription fallback deferred — out of MVP scope.
24. Attachment scanning deferred — MIME/size validation only.

### Decision 20 — Concentration (Blocks B, D)
Trailing-90-day awarded dealer share, scoped to the owning firm. Numerator: sum of
`trades.allocNotionalMinor` per `dealerFirmId` where the parent award is within the
last 90 days. Denominator: sum across all dealers for that firm over the same
window. Sum all notionals as USD regardless of the RFQ's actual currency — pilot
simplification; label the metric "indicative, single-currency (USD) basis"
wherever shown. The approval-flag projection ("this award would lift dealer X to
N%") recomputes with the proposed allocation added to both numerator and
denominator. No FX conversion in MVP.

### Decision 21 — Threshold enforcement (Block B), single-approver model
Four rules, fired in-flow with tests, NO schema change (no approvals table):
- (a) notional >$100M → award cannot be finalized without the approver step (block
  any auto-award path).
- (b) notional >$250M → display "two-person committee approval required" in the UI,
  but enforce as single-approver in MVP; the approver must add a note acknowledging
  the requirement. Deliberate, documented pilot gap — do not build two-person
  approval, and do not hide the requirement either.
- (c) dealer trailing-90-day share >35% (per Decision 20's projection) → flag on the
  awards row at recommend time; approval requires explicit acknowledgment of the
  flag.
- (d) award allocation ≠ best quoted price → mandatory best-execution deviation note
  at recommend time AND auto-open an exceptions row.

Rules (c) and (d) compute at recommend time; (a) and (b) gate the approve action.
Each rule gets a unit test.

## Already-built reference patterns (do not rebuild; extend these)

| Pattern | Use it as the template for | File |
| --- | --- | --- |
| `recommendAwardAction` | Any `recordEvent()` mutation | `app/(app)/rfqs/[id]/actions.ts:13` |
| `approveAward` / conditional UPDATE | Concurrency-safe state flip inside a tx | `app/(app)/approvals/actions.ts` |
| `lib/policy.ts` | Pure threshold rules + `AwardFlag` with stable sha1 id | `lib/policy.ts` |
| `getDealerConcentration` | Cross-tx-safe query taking optional `db \| tx` executor | `lib/queries/concentration.ts` |
| `getBoard` / `maskBoard` | Tenant-scoped + masked read | `lib/queries/board.ts`, `lib/auth/mask.ts` |
| `getApprovalQueue` / `getApprovalDetail` | Tenant-scoped queue + detail read with generated-SQL tests | `lib/queries/approvals.ts` |
| `getRfqFirmIdOrThrow` | Pre-tx tenant gate before `recordEvent` | `lib/queries/rfqs.ts` |
| `allocNotionalMinor` | Per-allocation BigInt half-up rounding | `lib/award-math.ts` |
| `prefixedCrockfordRef` | Short collision-resistant random refs (RFQ-, T-) | `lib/ref-base.ts` |
| `nextExceptionRef` | Firm-scoped sequence (`EX-YYYY-NNNN`) in a tx | `lib/exception-ref.ts` |
| `requireEnv` (server) | Loud failure for missing env on server side | `lib/env.ts` |
| Dealer `/quote/[token]` | Token-scoped, no-leak surface | `app/quote/[token]/` |
| `sweepIfExpired` | Lazy state flip on read | `lib/auction-status.ts` |
| `rfqListQuery` | Tenant-scoped list read | `lib/queries/rfqs.ts:29` |
| Role-aware nav | Where new routes plug in | `app/(app)/layout.tsx:9` |
| `scripts/validate-block-b.ts` | One-shot post-state validator pattern | `scripts/` |

Also built: schema (`db/schema.ts`, 14 tables) + migrations 0001–0002; `recordEvent()`;
award math + tests; masking projection + tests; Block B threshold rules + projection
helper (`lib/policy.ts`, 30 tests); concentration helper (`lib/queries/concentration.ts`,
4 tests); approvals queue + detail reads (`lib/queries/approvals.ts`, 3 tests); approve/
reject/clarify server actions (`app/(app)/approvals/actions.ts`, 8 input-gate tests);
the `/approvals` UI; `lib/env.ts` (replaces silent `process.env.X!` casts in supabase
and middleware); Supabase clients; caller resolution + dealer-token resolver
(`lib/auth/caller.ts`); seed (`db/seed.ts`, `db/seed-data.ts`, includes a seeded award
and an open exception for `rfq:0141`); login (password + magic-link); RFQ blotter; RFQ
detail with quote board, single-vs-blended comparison, Realtime-signal refetch, and
`recommendAward`; lazy sweep; Resend wrapper (`lib/email.ts`); dealer `/quote/[token]`.

Test count after Block B: **63 tests** across `npm test`.

## Remaining blocks (each independently shippable)

| Block | Scope | POC view | Route(s) |
| --- | --- | --- | --- |
| ~~**A**~~ | ~~Create-RFQ wizard + dealer invitations~~ | shipped PR #1 | `/rfqs/new` |
| ~~**B**~~ | ~~Approval workspace + threshold enforcement~~ | shipped PR #3 | `/approvals` |
| **C** | Ops / STP workspace | `_legacy/views/Ops.jsx` | `/ops` |
| **D** | Compliance / best-execution workspace | `_legacy/views/Compliance.jsx` | `/compliance` |
| **E** | Admin workspace (read-only) | `_legacy/views/Admin.jsx` | `/admin` |
| **F** | Attachments via Supabase Storage | new infra surface | create-RFQ + RFQ detail |
| **G** | Role-specific dashboards (polish, ship last) | `_legacy/views/Dashboard.jsx` | per-role landing |

Priority next: C → D → E → F → G. Commit incrementally (one logical commit per
piece). Every mutation through `recordEvent()`. Every read tenant- or token-scoped.
Run `npm test` and `npx tsc --noEmit` before each commit.

## Per-block validation gate (Claude checks every block)

- Every mutation routes through `recordEvent()` (no direct state-table writes).
- Reads are tenant- or token-scoped; no cross-tenant or competitor leakage.
- Masking holds on any new dealer-facing surface.
- Money stays integer/numeric (cents); never floats.
- `pages fetch, client components interact` respected.
- `npm test` and `npx tsc --noEmit` pass.
- Block matches its locked decisions.

New dealer-facing or Storage-access surfaces get the same stop-ship scrutiny as the
masking tests.
