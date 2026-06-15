# Block F — Attachments via Supabase Storage (starter prompt)

> Paste into a fresh session. Read `docs/HANDOFF.md` (Decisions 12, 24) and
> `docs/open-decisions.md` (D-9) first. **This is the only block introducing a new infra
> surface (Storage) — its access-control tests are stop-ship, like the masking tests.**

## Goal

Real term-sheet / basket-file uploads on the create-RFQ flow (Block A) and RFQ detail.
Tenant-scoped bucket paths; access gated by the same caller rules — a dealer token may
fetch only its own RFQ's documents; cross-tenant fetch denied. Replace the POC's faked
term-sheet preview. **MIME/size validation only — no scanning (Decision 24).**

## Read first (grounding)

- Caller rules to mirror exactly: `lib/auth/caller.ts` (`resolveUser`, `resolveDealerToken`)
  and the scope guard in `lib/queries/board.ts:21` (user owns firm; dealer scoped to rfq).
- Masking/no-leak precedent: `lib/auth/mask.ts` — same stop-ship rigor applies here.
- Supabase clients: `lib/supabase/server.ts`, `lib/supabase/client.ts`. Use the
  service-role/server path for signed URLs and writes (Decision 5 — client only for Realtime).
- Schema: there is **no attachments table yet** — decide whether to add one (recommended:
  small `attachments` table keyed by `rfqId` + `firmId` + storage path + mime + size) or
  store metadata on the rfq. A table is the clean option; it's a schema change
  (`npm run db:generate` → `db:migrate`).

## Resolve before coding (D-9)

- Bucket name + privacy (private bucket; signed URLs only).
- Path convention — recommended `{firmId}/{rfqId}/{uuid}-{filename}`.
- Allowed MIME types (e.g. pdf, csv, xlsx) + max size.
- Attachments table vs metadata-on-rfq.

## Build (one commit each)

1. Migration: `attachments` table (if chosen) — `db/schema.ts` + `npm run db:generate`.
2. `lib/storage.ts` — server helpers: `uploadAttachment`, `listAttachments(rfqId)`,
   `signedUrl(attachmentId, caller)`. Every read/write re-checks caller scope (user owns
   firm OR dealer scoped to that rfq) before touching Storage. Record the metadata write
   through `recordEvent()` if an attachment counts as an auditable action (recommended: yes,
   add an `attachment_added` event type — schema change to the enum).
3. Wire upload into `app/(app)/rfqs/new/wizard.tsx` (Block A) and the RFQ detail page.
4. Dealer-side: surface allowed attachments on `/quote/[token]` via signed URLs scoped to
   that token's rfq only.

## Acceptance / validation gate — STOP-SHIP

- **Cross-tenant fetch denied** — a user/dealer cannot retrieve another firm's or another
  rfq's file. Write explicit access-control tests (treat like masking tests).
- Dealer token fetches only its own rfq's documents.
- MIME + size validated server-side; oversized/wrong-type rejected.
- Signed URLs only; no public bucket exposure.
- Any metadata mutation through `recordEvent()` (if the audit-event decision is yes).
- `npm test` && `npx tsc --noEmit` pass.
