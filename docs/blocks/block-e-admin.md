# Block E — Admin workspace (read-only) (starter prompt)

> Paste into a fresh session. Read `docs/HANDOFF.md` (Decision 22) and
> `docs/open-decisions.md` (D-8) first.

## Goal

Port `_legacy/views/Admin.jsx` to `/admin`, admin-role only. Sections: firms & users,
bank panels, product templates, auction rules, approval thresholds, system audit (from
`events`). **For the pilot this is read-only over seeded config (Decision 22).** Mark each
section with a code comment describing what it needs to become editable.

## Read first (grounding)

- POC: `_legacy/views/Admin.jsx`.
- Tenant-scoped read template: `lib/queries/rfqs.ts`.
- Schema: `firms` (`db/schema.ts:54`), `users` (69), `bankPanels`/`bankPanelMembers`
  (84-99), `events` (285).
- Product templates source: `lib/templates.ts` (the constant from Block A, D-4). Approval
  thresholds: surface the Decision 21 constants from `lib/policy.ts` (Block B).

## Build (one commit each)

1. `lib/queries/admin.ts` — tenant-scoped reads for each section.
2. `app/(app)/admin/page.tsx` — server component, admin-gated, fetches all sections.
3. `app/(app)/admin/...` client(s) — sectioned read-only display per POC.

For each read-only section add a comment, e.g.:
`// EDITABLE-TODO: bank panels — make add/remove dealer write through recordEvent()
(panel_updated event) when admin editing lands post-pilot.`

## Acceptance / validation gate

- Genuinely read-only — no mutations (no `recordEvent()` calls in this block unless D-8
  says otherwise).
- Every read tenant-scoped to `caller.firmId`.
- `EDITABLE-TODO` comments mark each future-editable section.
- `npm test` && `npx tsc --noEmit` pass.

## Resolve when starting

- **D-8** — confirm fully read-only (recommended), or make one section (e.g. bank panels)
  editable for the pilot. Editable would need a `recordEvent()` path + new event type.
