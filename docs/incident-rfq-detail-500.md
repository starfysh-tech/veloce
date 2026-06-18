# Incident handoff — `/rfqs/[id]` returns 500 on the deployed demo

> For a dev to validate, fix, and confirm. Found 2026-06-18 while capturing
> partner-demo screenshots against `https://mvp-veloce.vercel.app`. Blocks the
> partner-site user guide (the quote-board / approval / ops / compliance
> walkthroughs all drill into an RFQ detail page) **and** breaks the demo itself —
> a partner clicking any RFQ from the dashboard hits an error page.

## Symptom (reproducible)

- Logged in as a seeded buy-side user (`dana@meridian.example` / `veloce-ft`),
  open any RFQ detail page, e.g. from the dashboard or `/rfqs` blotter.
- Every RFQ returns **"Application error: a server-side exception has occurred"**
  with the **identical digest `1180052749`** — confirmed on 3 different RFQs
  (draft `VEL-2026-0143`, under-review `VEL-2026-0142`, awarded `VEL-2026-0141`).
- `/dashboard`, `/rfqs` (blotter), and `/rfqs/new` (wizard) all render fine.

The uniform digest across unrelated RFQs ⇒ a single shared code path on the detail
route is throwing, independent of RFQ data.

## Root cause (validated in prod logs)

The deployed detail route failed because the production database was missing the
Block F migration that creates `attachments`.

Evidence gathered 2026-06-18:

- Browser repro still returned digest `1180052749` on RFQ detail pages.
- Vercel production runtime logs for that digest showed
  `relation "attachments" does not exist`, Postgres code `42P01`.
- Direct DB inspection showed the seeded RFQs existed, but
  `to_regclass('public.attachments')` returned missing before the fix.
- `drizzle.__drizzle_migrations` had only three rows before the fix; repo journal
  expects migrations through `0005_glamorous_pixie`.

The throwing path was:

- `app/(app)/rfqs/[id]/page.tsx:21` calls
  `listAttachmentsWithUrls(caller, rfq.id)` on every detail render.
- `lib/storage.ts:217-220` queries `attachments` before touching Supabase Storage.
- Because the table did not exist, the page failed before any bucket/env lookup.

Secondary issue found during validation:

- Vercel Production was also missing `SUPABASE_STORAGE_BUCKET`.
- Block F resolved the bucket name as `rfq-attachments` in
  `docs/blocks/block-f-attachments.md`.
- This was not the current 500 root cause, but it would break attachment uploads
  and signed URL generation once attachment rows exist.

## Fix applied 2026-06-18

- Ran `npm run db:migrate` against the production `DATABASE_URL`.
  - `attachments` table now exists.
  - `drizzle.__drizzle_migrations` now has five rows, through
    `0005_glamorous_pixie`.
- Created private Supabase Storage bucket `rfq-attachments`.
- Added Vercel Production env var
  `SUPABASE_STORAGE_BUCKET=rfq-attachments`.
- Redeployed production from the previous deployment so the new env var is loaded.

## Validation completed 2026-06-18

- Rechecked deployed detail pages as seeded user
  `dana@meridian.example`:
  - `VEL-2026-0143` draft detail loads.
  - `VEL-2026-0142` under-review detail loads.
  - `VEL-2026-0141` awarded detail loads.
  - `VEL-2026-0138` in-STP detail loads.
- Attachments panel renders on the detail pages. Current production attachment
  row count is `0`, so no signed URL with an existing attachment was available to
  validate.
- Recent Vercel serverless error logs after redeploy returned no errors.
- Local gates:
  - `npm test` — 117 tests passed.
  - `npx tsc --noEmit` — exit 0.
  - `npm run lint` — no ESLint warnings or errors.

## Remaining note

If future seed/demo data adds attachment rows, validate one signed URL end to end
from both `/rfqs/[id]` and `/quote/[token]`.
