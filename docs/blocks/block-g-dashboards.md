# Block G — Role-specific dashboards (starter prompt)

> Paste into a fresh session. Read `docs/HANDOFF.md` first. Lowest priority — pure
> read/display polish over data the other blocks already expose. Ship last.

## Goal

Port `_legacy/views/Dashboard.jsx` — six per-role landing pages with KPIs and task lists
(trader, approver, ops, compliance, admin, and the shared landing). No new data surfaces;
read what Blocks A–E already expose.

## Read first (grounding)

- POC: `_legacy/views/Dashboard.jsx` (the six role panels + KPI/task shapes).
- Role-aware nav + where a dashboard route plugs in: `app/(app)/layout.tsx:9`.
- Existing tenant-scoped reads to reuse/compose: `lib/queries/rfqs.ts`,
  `lib/queries/approvals.ts` (Block B), `lib/queries/ops.ts` (Block C),
  `lib/queries/compliance.ts` (Block D).
- Money/status display helpers: `components/ui.tsx`.

## Build (one commit each)

1. `lib/queries/dashboard.ts` — compose per-role KPIs/task lists from existing queries
   (no new raw reads where an existing query already returns the rows).
2. `app/(app)/dashboard/page.tsx` (or make `/rfqs` the landing per role) — server
   component, resolves caller, renders the role's panel.
3. Per-role client panels as needed (display only).

## Acceptance / validation gate

- Read/display only — no mutations, no `recordEvent()`.
- Every read tenant-scoped to `caller.firmId`; reuses existing query helpers.
- `pages fetch, client components interact` respected.
- `npm test` && `npx tsc --noEmit` pass.

## Decide when starting

- Landing route: keep `/rfqs` as the default landing and add `/dashboard`, or make the
  dashboard the post-login landing per role. Recommended: add `/dashboard`, leave `/rfqs`.
