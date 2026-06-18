# Block G — Role-specific dashboards (starter prompt)

> Paste into a fresh session. Read `docs/HANDOFF.md` first. Lowest priority — pure
> read/display polish over data the other blocks already expose. Ship last.

## Post-Block-F corrections (validated against merged `main`, 2026-06-16)

A 2-agent validation ran against merged Blocks A–F. Block F is green (113/113 tests, `tsc`
clean, lint clean) — the platform is complete through attachments. Block G is the last block;
verified ground truth:

1. **Five roles, not six.** Caller roles are `trader | approver | ops | compliance | admin`
   (`db/schema.ts:21–23`, `caller.ts:16`). There is no `bank` user role — the legacy "bank"
   panel is the dealer-token path (`/quote/[token]`), not a logged-in role. The POC's "shared
   landing" is just the role fallback, not a sixth dashboard. Build **five** per-role panels.
2. **Reuse these query helpers — don't write new raw reads** (each takes `firmId: string`,
   returns a Promise; SQL builders also exported for tests):
   - `lib/queries/rfqs.ts` — `listRfqs(firmId)` → rows (ref, title, product, status,
     notionalLabel, quoteCount, invitedCount, deadline…); `getRfq(firmId, rfqId)`. → trader KPIs.
   - `lib/queries/approvals.ts` — `getApprovalQueue(firmId)` (awaiting_approval, award, and open
     exceptions); `getApprovalDetail(firmId, rfqId)`. → approver KPIs.
   - `lib/queries/ops.ts` — `getOpsTrades(firmId)` (awarded trades by status); `getOpsHandoffs(firmId)`
     (handoffs, legs, and open exceptions). → ops KPIs.
   - `lib/queries/compliance.ts` — `getComplianceOverview(firmId)` → `{bestEx[], events[],
     exceptions[], concentration[]}` (calls concentration internally). → compliance KPIs.
   - `lib/queries/concentration.ts` — `getDealerConcentration(firmId, asOf?)` → trailing-90d
     `{dealerFirmId → {shareBps, notionalMinor}}`. **(Omitted from the original spec)** — useful
     for an approver/compliance concentration KPI.
   - `lib/queries/admin.ts` — `getAdminOverview(firmId)` → `{firm, users[], dealers[], panels[],
     templates, auctionRules[], thresholds[], events[]}`. **(Omitted from the original spec)** —
     the admin dashboard's source.
3. **Display helpers in `components/ui.tsx`** (correct path): `fmtMoney`, `fmtMoneyFull`,
   `fmtPrice`, `fmtDateTime`, `notionalLabel`, `Pill({status})`, `statusLabel(status)`,
   `Icon({name})` — a `grid` icon already exists for the dashboard nav link. Reuse these; don't
   reformat money by hand (integer-minor-unit rules live here).
4. **Nav and landing integration** (`app/(app)/layout.tsx`, `app/page.tsx`, login/callback routes):
   the `NAV` record spans lines `9–31` (per-role link arrays); line `37` resolves
   `NAV[caller.role] ?? NAV.trader`. Add a `/dashboard` entry to each role's array and make
   `/dashboard` the root/login/callback landing.
5. **Every role has a seeded login and non-empty KPIs** (8 RFQs / 2 firms): trader `dana@meridian`
   (1 live auction, 1 draft), approver `marcus@meridian` (1 queue item and open exception), ops
   `tomas@meridian` (1 in_stp, sent handoff, and SSI exception) / `priya@halcyon` (1 captured
   trade), compliance `ingrid@meridian` (open exception and reviewable RFQs), admin `alex@meridian`
   (5 users, 3 panels, 5 dealers, event log). No role renders empty.
6. **From Block F (if a dashboard shows attachment counts):** no soft-delete and no
   `attachment_downloaded` event — derive counts from the `attachment_added` event log or
   `listAttachments` metadata; never cache the 5-min signed URLs.

## Goal

Port `_legacy/views/Dashboard.jsx` — five per-role landing panels with KPIs and task lists
(trader, approver, ops, compliance, admin; the "shared landing" is the role fallback, not a
sixth panel). No new data surfaces; read what Blocks A–F already expose.

## Read first (grounding)

- POC: `_legacy/views/Dashboard.jsx` (the role panels and KPI/task shapes).
- Role-aware nav and where a dashboard route plugs in: `app/(app)/layout.tsx` (`NAV` at 9–31,
  role lookup at line 37).
- Existing tenant-scoped reads to reuse/compose: `lib/queries/rfqs.ts`,
  `lib/queries/approvals.ts` (Block B), `lib/queries/ops.ts` (Block C),
  `lib/queries/compliance.ts` (Block D), `lib/queries/concentration.ts` (Block B),
  `lib/queries/admin.ts` (Block E). See the catalog above for exported signatures.
- Money/status display helpers: `components/ui.tsx`.

## Build (one commit each)

1. Landing and nav — add `{ href: '/dashboard', label: 'Dashboard', icon: 'grid' }` to each of the
   five buy-side role nav arrays, and change root/login/callback redirects from `/rfqs` to
   `/dashboard` (`app/page.tsx`, `app/login/actions.ts`, `app/auth/callback/route.ts`).
2. `lib/queries/dashboard.ts` — thin role-scoped composition only. Fetch **only the current
   caller role's** dashboard data; do not fetch or return all panels and hide them in the UI.
   Existing page-level role gates are the authorization model, and the query helpers mostly accept
   only `firmId`, so all dashboard role selection must happen server-side after `resolveUser()`.
3. `app/(app)/dashboard/page.tsx` — server component, resolves caller, narrows
   `caller.kind === 'user'`, calls the one role-specific dashboard loader, and renders that role's
   panel. Do not create a client component unless real interaction is added; use `Link` for
   navigation and static formatted dates instead of a live countdown unless the client island is
   deliberately needed.
4. KPI/task copy — keep labels aligned with the data actually returned. KPIs must be data-backed
   from existing helper payloads; do not port legacy hardcoded values such as uptime, hit ratio,
   average turnaround, or static savings claims. `listRfqs(firmId)` is firm-scoped by decision, so
   use "firm RFQs" / "recent RFQs" instead of "your RFQs".
5. Attachments — exclude attachment counts from Block G dashboards. Attachment metadata remains
   available to RFQ detail surfaces, but dashboard counts are not part of this block.
6. Admin — render only the admin dashboard panel for admin callers. Do not add cross-role
   operational summaries to the admin dashboard.
7. Tests — add `lib/queries/dashboard.test.ts` only if `dashboard.ts` introduces new SQL builders
   or non-trivial pure shaping helpers. Use the existing dynamic-import pattern that sets a dummy
   `DATABASE_URL` before importing DB-backed query modules.

## Acceptance / validation gate

- Read/display only — no mutations, no `recordEvent()`.
- Every read tenant-scoped to `caller.firmId`; reuses existing query helpers.
- Do not call `getBoard()` from dashboard code; buy-side board reads may lazy-sweep expired RFQs
  through `recordEvent()`.
- Do not show attachment counts on dashboards in Block G.
- `pages fetch, client components interact` respected.
- `npm test`, `npx tsc --noEmit`, and `npm run lint` pass. Lint is required separately because
  `next.config.mjs` ignores ESLint during builds.

## Decisions confirmed for implementation

- Landing route: make `/dashboard` the root, password-login, and magic-link callback landing.
- KPI source: data-backed only; no legacy hardcoded metrics.
- Trader scope: firm-scoped recent RFQs via `listRfqs(firmId)`.
- Attachments: no dashboard attachment counts.
- Admin: admin callers see the admin panel only, not cross-role summaries.

---

# Validation Results

**Validated:** 2026-06-17
**Verdict:** CAUTION

## Issues Found

### Critical (Must Address)

- None found that block the feature if the revisions above are followed.

### High Risk (Should Address)

- **Role-boundary leakage if all dashboard panels are fetched/rendered for every user**: Existing
  workspaces enforce authorization in page components, while most query helpers only accept
  `firmId`. A dashboard loader that fetches all panels and hides them client-side could expose
  approvals, ops trades, compliance events, or admin user data to the wrong role.
  - _Impact_: Auth boundary regression inside the buy-side app.
  - _Recommendation_: Resolve `caller` server-side, switch on `caller.role`, fetch exactly one
    role dataset, and render exactly one role panel.
  - _File_: `app/(app)/approvals/page.tsx:20-34`, `app/(app)/ops/page.tsx:10-28`,
    `app/(app)/compliance/page.tsx:8-24`, `app/(app)/admin/page.tsx:8-24`,
    `lib/auth/caller.ts:13-20`.

- **New raw child-table reads could leak tenants if added casually**: Child tables such as
  `quotes`, `awards`, `trades`, and `handoffs` do not carry `firmId`; safe reads join through
  `rfqs` and filter by `rfqs.firmId`.
  - _Impact_: Cross-tenant data leakage in dashboard metrics.
  - _Recommendation_: Prefer existing helpers. If a new SQL builder is unavoidable, assert its
    generated SQL includes the tenant predicate and correct join path.
  - _File_: `db/schema.ts:197-280`, `lib/queries/ops.ts:70-119`,
    `lib/queries/compliance.ts:228-265`.

### Simplification Opportunities

- **Client panels by default** → **Server-render role panels with `Link` navigation** (tradeoff:
  no live countdown unless a client island is explicitly imported).
- **Port legacy `Kpi` / `ConcentrationBars` components** → **Use existing CSS classes directly**
  (tradeoff: small inline JSX helper may be useful, but no shared component API is required).
- **Add dashboard SQL for every KPI** → **Derive starter KPIs from existing helper payloads**
  (tradeoff: some legacy KPIs become simpler or copy-only, but no new leakage surface is added).
- **Add per-route landing logic** → **Change existing root/login/callback redirects to `/dashboard`**
  (tradeoff: landing behavior changes, but implementation stays simple and role-specific rendering
  happens inside the dashboard route).

## Cross-Model Review (Codex)

*Model: gpt-5.4 | Sandbox: read-only | Status: timed out*

Codex inspected the relevant files but did not return the required structured final response before
the 120s timeout. Validation completed with Claude-only analysis.

### Agreement with Claude Analysis

- Partial trace showed Codex inspecting the same affected files: `components/ui.tsx`,
  `app/(app)/layout.tsx`, `app/globals.css`, `lib/queries/*`, existing role pages,
  `db/schema.ts`, `lib/auth/caller.ts`, `lib/storage.ts`, and legacy dashboard source.
- No structured findings were available to merge.

### Novel Findings

- None available due to timeout.

## Plan Revisions Made

- Changed the build order to include landing redirects, nav, then a role-scoped dashboard loader,
  then a server dashboard page.
- Replaced "compose per-role KPIs/task lists" with an explicit rule to fetch only the current
  caller role's data.
- Added a copy constraint: `listRfqs(firmId)` is firm-scoped, so dashboard labels must not imply
  requester-specific data unless a new helper is added.
- Added `getBoard()` exclusion because buy-side board reads can call `sweepIfExpired()`.
- Replaced attachment-count guidance with an explicit decision to exclude attachment counts.
- Added `npm run lint` to the validation gate because builds ignore lint.
- Narrowed test guidance to generated-SQL tests for new SQL builders and pure tests for non-trivial
  shaping helpers.
- Replaced the earlier `/rfqs` default-landing recommendation with Randall's decision to make
  `/dashboard` the default landing.

## Decisions Confirmed

- [x] **Five dashboards only**: `trader | approver | ops | compliance | admin`; no logged-in
  `bank` dashboard.
- [x] **Landing route**: make `/dashboard` the root/login/callback landing and add `/dashboard` to
  nav.
- [x] **Read-only scope**: no mutations, no server actions, no `recordEvent()` usage.
- [x] **Server-first dashboard**: page fetches tenant-scoped data after `resolveUser()`; client
  components only if real interaction is introduced.
- [x] **KPI source**: data-backed only; no hardcoded legacy KPIs.
- [x] **Trader scope**: firm-scoped recent RFQs; copy must not imply requester-only data.
- [x] **Attachments**: exclude dashboard attachment counts.
- [x] **Admin**: admin panel only; no cross-role dashboard summaries.

## Dependencies Affected

| Component | Impact | Action Needed |
| --- | --- | --- |
| `app/page.tsx` | Root landing changes | Redirect to `/dashboard` |
| `app/login/actions.ts` | Password-login landing changes | Redirect successful password login to `/dashboard` |
| `app/auth/callback/route.ts` | Magic-link callback landing changes | Redirect exchanged sessions to `/dashboard` |
| `app/(app)/layout.tsx` | Nav surface changes for five roles | Add `/dashboard` link with existing `grid` icon |
| `app/(app)/dashboard/page.tsx` | New authenticated route | Resolve and narrow caller; render only current role panel |
| `lib/queries/dashboard.ts` | New read composition module | Use existing helpers; avoid all-role fetching |
| `lib/queries/*` | Source helpers for dashboard data | Do not change existing helper SQL unless needed |
| `components/ui.tsx` / `app/globals.css` | Display utilities/classes | Reuse; do not invent money/status formatting |

## Test Implications

- Tests expected to fail: none if existing query helpers are not changed.
- Tests needing updates: none known for nav-only changes; TypeScript and lint cover the new route.
- New coverage needed: `lib/queries/dashboard.test.ts` if new SQL builders or non-trivial shaping
  helpers are added. Follow the dynamic-import pattern in `lib/queries/rfqs.test.ts:10-16`.

## Validation Questions Answered

- **Why will this not work?** It will not work safely if implemented as an all-role dashboard with
  client-side hiding; query helpers do not encode role access.
- **What will break?** Existing tests should not break if helpers are unchanged. TypeScript will
  fail if `resolveUser()` is used without narrowing `caller.kind === 'user'`.
- **What was missed?** `npm run lint`, `getBoard()` lazy sweep side effects, capped event logs for
  attachment counts, and the lack of current `Kpi` / `ConcentrationBars` exports.
- **What dependencies are affected?** Authenticated app layout, new dashboard route, query helper
  imports, shared display helpers, and CSS classes.
- **What tests will fail?** New DB-backed query tests can fail at import time if they statically
  import modules before setting a dummy `DATABASE_URL`.
- **What edge cases were not addressed?** Empty datasets for non-demo tenants, concentration
  returning `{}`, and admin dealer counts being global dealer metadata.
- **Is there a simpler way?** Yes: server-render one role panel from existing helper payloads, with
  no client component and no new raw SQL unless a KPI truly requires it.
- **What decisions need input?** None remaining after Randall confirmed landing route, KPI source,
  trader scope, attachments, and admin panel scope.
