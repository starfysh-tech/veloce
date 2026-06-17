# Block E — Admin workspace (functional panel management) (starter prompt)

> Paste into a fresh session. Read `docs/HANDOFF.md` (Decision 22) and
> `docs/open-decisions.md` (D-8) first.

## Post-Block-D corrections (validated against merged `main`, 2026-06-16)

A 2-agent validation ran against merged Blocks A–D. Block D is green (92/92 tests, `tsc`
clean, lint clean) and the D-3 ref leak is now fully fixed — no carryover bug remains.
Before building Block E:

1. **Anchors are mostly accurate; only `events` shifted.** `firms` `db/schema.ts:54`,
   `users` `69`, `bankPanels` `84` are correct. `bankPanelMembers` starts at `94` (composite
   PK `(panelId, dealerFirmId)`, no own `firmId` — scope it via a join to `bankPanels.firmId`).
   `events` moved to `291`.
2. **Product templates: the section renders exactly ONE row.** `lib/templates.ts` registers
   only `id: 'put'` (`TemplateId = 'put'`). The 5 product names on seeded RFQs are free-text
   `rfqs.template` strings, NOT registered templates. Don't promise a 5-template admin view —
   it's one, unless D-4's constant is expanded first.
3. **Approval thresholds are functions, not constants.** `lib/policy.ts` exposes them as
   predicates with inline literals, not exported scalars: `requiresApprover` `n > 10_000_000_000`
   (>$100M, minor units) `:42`; `requiresCommitteeNote` `n > 25_000_000_000` (>$250M) `:49`;
   `concentrationFlag` `bps > 3500` (>35%) `:67`. The read-only "approval thresholds" section
   must surface these literals/labels by hand — there's nothing scalar to bind to. (If you
   want them bindable, extract named constants in `policy.ts` first — small, optional.)
4. **Role gate to copy (admin-only).** Mirror `app/(app)/compliance/page.tsx:9` /
   `ops/page.tsx:10`: `const caller = await resolveUser(); if (caller.kind !== 'user') return
   null; if (caller.role !== 'admin') return <not-authorized card>;`. Route handlers don't
   inherit page gates — re-gate independently if you add any.
5. **The `/admin` nav link already exists** (`app/(app)/layout.tsx:29`, "Administration", gear
   icon). Block E only needs to create `app/(app)/admin/page.tsx` + clients — no nav change.
6. **D-8 resolved as functional MVP.** After review, Block E ships one behaviorally
   real editable surface: bank panels. Product templates, auction rules, thresholds,
   and user entitlements remain read-only/TODO until their enforcement paths read
   persisted config. Bank panel edits write through `recordEvent()` using
   `bank_panel_updated` and directly affect Create RFQ.

## Goal

Port `_legacy/views/Admin.jsx` to `/admin`, admin-role only. Sections: firms & users,
bank panels, product templates, auction rules, approval thresholds, system audit (from
`events`). For functional MVP, bank panels are editable because they already drive
Create RFQ; code-backed templates/rules/thresholds and user entitlements remain
read-only with TODO comments until persistence and enforcement wiring exist.

## Read first (grounding)

- POC: `_legacy/views/Admin.jsx`.
- Tenant-scoped read template: `lib/queries/rfqs.ts`.
- Schema: `firms` (`db/schema.ts:54`), `users` (69), `bankPanels` (84) / `bankPanelMembers`
  (94), `events` (291).
- Product templates source: `lib/templates.ts` (the constant from Block A, D-4). Approval
  thresholds: surface the Decision 21 constants from `lib/policy.ts` (Block B).

## Build (one commit each)

1. `lib/queries/admin.ts` — tenant-aware reads for each section.
2. `app/(app)/admin/page.tsx` — server component, admin-gated, fetches all sections.
3. `app/(app)/admin/actions.ts` — admin-only bank panel mutations through `recordEvent()`.
4. `app/(app)/admin/...` client(s) — sectioned UI with editable bank panels and read-only policy/template surfaces.
5. Migration — add `bank_panel_updated` to `event_type`.

For each still-read-only section add a comment, e.g.:
`// EDITABLE-TODO: product templates need a persisted template table and RFQ wizard/action validation wired to it before admin edits can affect behavior.`

## Acceptance / validation gate

- Bank panel create/rename/default/member/delete mutations route through `recordEvent()`.
- Bank panel edits are admin-only and tenant-owned via `bankPanels.firmId`.
- Every read tenant-scoped to `caller.firmId`.
- `EDITABLE-TODO` comments mark still-future-editable sections.
- `npm test`, `npx tsc --noEmit`, and `npm run lint` pass.

## Resolve when starting

- **D-8** — resolved: bank panels editable for functional MVP; remaining sections stay
  read-only until their backing config/enforcement paths exist.
