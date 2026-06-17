# Block F — Attachments via Supabase Storage (starter prompt)

> Paste into a fresh session. Read `docs/HANDOFF.md` (Decisions 12, 24) and
> `docs/open-decisions.md` (D-9) first. **This is the only block introducing a new infra
> surface (Storage) — its access-control tests are stop-ship, like the masking tests.**

## Post-Block-E corrections (validated against merged `main`, 2026-06-16)

A 2-agent validation ran against merged Blocks A–E. Block E is green (100/100 tests, `tsc`
clean, lint clean). Block F is greenfield infra — here's the verified ground truth:

1. **The `Caller` type is the access-control spine — branch on the right field**
   (`lib/auth/caller.ts:13–28`):
   ```ts
   type Caller =
     | { kind: 'user';   userId; firmId; role; label }
     | { kind: 'dealer'; dealerFirmId; rfqId; invitationId; label }
     | { kind: 'anonymous' };
   ```
   A **user carries `firmId`; a dealer carries `dealerFirmId` + `rfqId` (NOT `firmId`)**. Every
   storage read/write must check the correct field per variant — getting this wrong is exactly
   the cross-tenant leak the stop-ship tests exist to catch. `resolveUser` `:39`,
   `resolveDealerToken` `:63`.
2. **Replicate the board scope-guard predicate exactly** (`lib/queries/board.ts:21–24`):
   ```ts
   const allowed =
     (caller.kind === 'user'   && caller.firmId === rfq.firmId) ||
     (caller.kind === 'dealer' && caller.rfqId === rfqId);
   if (!allowed) return null;
   ```
   `signedUrl`/`listAttachments` must apply this same two-branch check before touching Storage.
3. **Use the service-role client for ALL Storage ops.** `lib/supabase/server.ts` exports
   `createServiceRoleClient()` (`:40`, bypasses RLS) and `createClient()` (anon, cookie-backed).
   `lib/supabase/client.ts` `createClient()` is browser/Realtime ONLY — never use it for Storage.
   Because service-role bypasses RLS, the caller-scope check (item 2) MUST be done in app code.
4. **Test-rigor template.** Match `lib/auth/mask.test.ts` (79 lines) — the stop-ship no-leak
   precedent. Write the access-control tests in the same shape: explicit cross-tenant and
   cross-rfq denial cases.
5. **event_type enum** (`db/schema.ts:43–52`) now ends with `bank_panel_updated` (added by
   Block E). Block F adds `attachment_added` — enum change + new Drizzle migration. Keep all
   metadata writes inside the `recordEvent(actor, meta, tx => …)` callback.
6. **Wizard integration** (`app/(app)/rfqs/new/wizard.tsx:24`): 4 steps — `['Product & terms',
   'Economics & size', 'Bank panel & auction', 'Review & launch']`. Slot upload as a new step
   before "Review & launch" (or embed in an existing step). The wizard is `force-dynamic` and
   receives data as props from `page.tsx` — thread attachment data through that path. RFQ detail
   `app/(app)/rfqs/[id]/page.tsx` and dealer quote `app/quote/[token]/page.tsx` both exist; the
   quote page has no attachment surface yet.
7. **D-9 is fully greenfield — nothing to migrate.** No Storage bucket is configured anywhere
   (no `SUPABASE_STORAGE_*` env var, no bucket string in source); `SUPABASE_SERVICE_ROLE_KEY` is
   used only in `server.ts:40` + `db/seed.ts`. There is **no `.env.example`** — add the chosen
   bucket var (e.g. `SUPABASE_STORAGE_BUCKET`) to the env list in `CLAUDE.md`, where this repo
   documents env vars. So D-9 is a clean call: bucket name + privacy (private, signed-URLs only),
   path convention (`{firmId}/{rfqId}/{uuid}-{filename}`), allowed MIMEs, max size — unconstrained.

## Goal

Real term-sheet / basket-file uploads on the create-RFQ flow (Block A) and RFQ detail.
Tenant-scoped bucket paths; access gated by the same caller rules — a dealer token may
fetch only its own RFQ's documents; cross-tenant fetch denied. Replace the POC's faked
term-sheet preview. **MIME/size validation only — no scanning (Decision 24).**

## Read first (grounding)

- Caller rules to mirror exactly: `lib/auth/caller.ts` (`resolveUser`, `resolveDealerToken`)
  and the scope guard in `lib/queries/board.ts:21–24` (user owns firm; dealer scoped to rfq).
- Masking/no-leak precedent: `lib/auth/mask.ts` — same stop-ship rigor applies here.
- Supabase clients: `lib/supabase/server.ts`, `lib/supabase/client.ts`. Use the
  service-role/server path for signed URLs and writes (Decision 5 — client only for Realtime).
- Schema: there is **no attachments table yet** — add a small `attachments` table keyed
  by `rfqId` + owning buy-side `firmId` + storage path + mime + size. `firmId` means
  the RFQ owner's firm, never a dealer firm. Metadata creation is auditable domain state:
  add `attachment_added` and write rows through `recordEvent()` unconditionally.

## Resolve before coding (D-9)

- Bucket name + privacy: **resolved** — `SUPABASE_STORAGE_BUCKET=rfq-attachments`, private
  bucket, signed URLs only.
- Path convention — recommended `{firmId}/{rfqId}/{uuid}-{filename}`.
- Allowed MIME types + max size: **resolved** — PDF, CSV, and XLSX only;
  10 MB max per attachment.
- Attachments table vs metadata-on-rfq. **Resolved by validation:** use an `attachments`
  table, not RFQ JSON metadata.
- Dealer read access after quote/close: **resolved** — dealer read-only page/attachment access
  should resolve tokens with invitation status `pending` or `responded`; quote writes still
  self-validate live status and deadline. Do not allow `expired` or `revoked`.

## Validation-driven corrections (2026-06-17)

- Storage helper signatures must carry the resolved caller on every path:
  `uploadAttachment(caller, rfqId, file)`, `listAttachments(caller, rfqId)`, and
  `signedUrl(caller, attachmentId)`. `listAttachments(rfqId)` is not acceptable because
  attachment metadata can leak before URL signing.
- Apply the board guard before any DB metadata return or Storage operation:
  user `caller.firmId === rfq.firmId`; dealer `caller.rfqId === rfqId`. Dealer access is
  never authorized by comparing `caller.dealerFirmId` to `attachments.firmId`.
- Upload metadata is mandatory audit state. Remove the optional wording around
  `attachment_added`; every successful attachment metadata insert must happen inside
  `recordEvent()` with `firmId` = RFQ owner firm and `rfqId` set.
- Supabase Storage writes are external to the Drizzle transaction. Do not claim true
  atomicity. Upload files before committing metadata; if `recordEvent()` fails, delete
  uploaded objects best-effort and return a failure. Do not send dealer invitations until
  create-RFQ attachments and metadata have succeeded.
- RFQ detail uploads are restricted to `trader` / `admin` users while the RFQ is `live`
  and before its deadline. Post-close term changes are out of Block F.
- Dealer-facing attachment DTOs must be masked and minimal: `id`, display filename,
  MIME, size, created timestamp, and signed URL only. Never return bucket, storage path,
  owning firm id/name, uploader identity, dealer firm id, or invitation id to dealers.
- Use short-lived signed URLs generated on demand after caller scope checks. Do not store
  signed URLs in the DB or event detail.
- Before generating the Block F migration, inspect/repair Drizzle migration metadata.
  **Implementation note:** Block F repaired the missing `0003_admin_panel_event` journal entry;
  Drizzle then generated `0005_glamorous_pixie.sql`, which is kept idempotent with
  `ADD VALUE IF NOT EXISTS` because `0003_admin_panel_event.sql` may already have applied.
- Empirical validation on 2026-06-17 confirmed the current repo has no Storage implementation,
  no attachment schema, no `SUPABASE_STORAGE_BUCKET` documentation, no file-upload pattern beyond
  login `FormData`, and the current validation commands pass (`npm test`: 100 tests,
  `npx tsc --noEmit`: clean, `npm run lint`: clean).

## Build (one commit each)

1. Migration: `attachments` table + `attachment_added` enum — `db/schema.ts` +
   `npm run db:generate`. First account for the existing `0003` migration journal mismatch.
2. `lib/storage.ts` — server helpers: `uploadAttachment(caller, rfqId, file)`,
   `listAttachments(caller, rfqId)`, `signedUrl(caller, attachmentId)`. Every helper loads
   the RFQ/attachment server-side, applies the two-branch caller guard, and only then touches
   Storage or returns metadata.
3. Create-RFQ upload: adapt the wizard/action flow to carry files via `FormData` or a route
   handler. Pre-generate `rfqId`, validate MIME/size server-side, upload objects, then insert
   RFQ + invitations + attachment metadata inside the existing launch `recordEvent()` flow.
   If metadata commit fails, delete uploaded objects best-effort. If any attachment fails,
   block launch and do not dispatch dealer emails.
4. RFQ detail upload: add a trader/admin-only live-RFQ upload action and list surface in
   `app/(app)/rfqs/[id]/page.tsx`. Metadata insert goes through `recordEvent()` with
   `attachment_added`.
5. Dealer-side: surface read-only allowed attachments on `/quote/[token]` via signed URLs
   scoped to that token's RFQ only. Return only the masked attachment DTO.

## Acceptance / validation gate — STOP-SHIP

- **Cross-tenant fetch denied** — a user/dealer cannot retrieve another firm's or another
  rfq's file. Write explicit access-control tests (treat like masking tests).
- Dealer token fetches only its own rfq's documents.
- MIME + size validated server-side; oversized/wrong-type rejected.
- Signed URLs only; no public bucket exposure.
- Any metadata mutation through `recordEvent()` with `attachment_added`.
- Storage path, bucket, owning firm, uploader, dealer firm, and invitation id are never exposed
  to dealers.
- Missing bucket config fails loudly via `requireEnv('SUPABASE_STORAGE_BUCKET')`; document the
  variable in `CLAUDE.md` and `AGENTS.md`.
- Chosen bucket is private in Supabase; app uses signed URLs only.
- Storage upload/DB failure paths have explicit cleanup/error handling tests or documented
  manual validation.
- `npm test`, `npx tsc --noEmit`, and `npm run lint` pass.

---

# Validation Results

**Validated:** 2026-06-17
**Verdict:** CAUTION

## Issues Found

### Critical (Must Address)

- **Caller-less listing leaks metadata**: The original helper shape included
  `listAttachments(rfqId)`, which can expose filenames, MIME, size, or attachment ids before
  signed URL authorization. Match the board guard before any metadata return.
  - _Impact_: Cross-tenant or cross-RFQ metadata leakage.
  - _Mitigation_: Use `listAttachments(caller, rfqId)` and apply the guard from
    `lib/queries/board.ts:21-24` before returning rows.
  - _File_: `docs/blocks/block-f-attachments.md:84-86`

- **Optional audit wording conflicts with mutation invariant**: The starter plan made
  `attachment_added` conditional, but attachment metadata is mutable domain state.
  - _Impact_: Attachment rows could drift from the append-only event log.
  - _Mitigation_: Make `attachment_added` mandatory and write metadata inside
    `recordEvent()`.
  - _File_: `lib/record-event.ts:3-9`

- **Storage cannot be transactionally atomic with Drizzle**: `recordEvent()` wraps DB writes;
  Supabase Storage uploads/deletes are external side effects.
  - _Impact_: Upload success plus DB failure creates orphan objects; DB success plus upload
    failure creates broken attachment rows.
  - _Mitigation_: Upload before metadata commit, insert metadata only after upload success,
    and best-effort delete uploaded objects if the DB transaction fails.
  - _File_: `lib/record-event.ts:39-61`

- **Post-launch upload boundary was undefined**: RFQ detail currently requires only a tenant
  user, while create-RFQ is trader/admin gated.
  - _Impact_: Approver/ops/compliance users could alter live terms, or documents could change
    after dealers quote.
  - _Mitigation_: Restrict RFQ detail uploads to trader/admin while the RFQ is live and before
    deadline.
  - _File_: `app/(app)/rfqs/[id]/page.tsx:13-17`

### High Risk (Should Address)

- **Dealer token semantics are inconsistent**: `resolveDealerToken()` filters invitations to
  `pending`, while quote submission marks the invitation `responded`. Reusing this resolver may
  deny attachment access after a dealer submits a quote.
  - _Impact_: Dealer page/file access can disappear after first quote submission.
  - _Recommendation_: Decide whether quote links should remain readable after response and, if
    yes, add a read resolver that allows intended statuses while still denying revoked/expired.
  - _File_: `lib/auth/caller.ts:65-70`, `app/quote/[token]/actions.ts:62-66`

- **Dealer liveness semantics are undocumented**: The resolver comment says live RFQ is enforced,
  but implementation only checks invitation existence/status and RFQ existence.
  - _Impact_: Pending dealer tokens may access attachments after auction close unless Block F
    explicitly gates reads.
  - _Recommendation_: Decide whether dealer downloads remain available after close; enforce that
    in attachment list/sign helpers.
  - _File_: `lib/auth/caller.ts:58-83`

- **Migration metadata mismatch can break generation/order**: `drizzle/0003_admin_panel_event.sql`
  existed while `_journal.json` listed only `0000` through `0002` before implementation.
  - _Impact_: Block F migration generation could create a duplicate enum migration.
  - _Resolution_: Repaired the journal entry for `0003` and kept generated enum additions
    idempotent.
  - _File_: `drizzle/meta/_journal.json:4-26`, `drizzle/0003_admin_panel_event.sql:1`

- **Wizard step indexes are hard-coded**: Adding an upload step can break navigation, validation,
  or launch gating if indexes are updated inconsistently.
  - _Impact_: Upload step can be skipped or launch button can appear on the wrong step.
  - _Recommendation_: Derive `lastStepIndex` from `STEPS.length - 1` and update the validation
    array with the new step.
  - _File_: `app/(app)/rfqs/new/wizard.tsx:24`, `app/(app)/rfqs/new/wizard.tsx:98-103`,
    `app/(app)/rfqs/new/wizard.tsx:360-369`

- **Server Action file-size behavior is unvalidated**: Current create flow sends a typed object,
  not file `FormData`.
  - _Impact_: Large files may fail at the framework/platform boundary before custom validation.
  - _Recommendation_: Validate the chosen max size with a real upload; use a route handler if
    Server Action limits interfere.
  - _File_: `app/(app)/rfqs/new/wizard.tsx:107-134`, `app/(app)/rfqs/new/actions.ts:28-75`

### Simplification Opportunities

- **Avoid dealer uploads in Block F** -> **Dealer read-only signed links only** (tradeoff: dealers
  cannot return amended docs, but this matches the stated RFQ term-sheet/basket-file goal).
- **Use one private bucket + one metadata table** -> **Avoid per-tenant buckets or RFQ JSON**
  (tradeoff: bucket lifecycle cleanup needs app logic, but access logic is centralized).
- **Small attachment DTO** -> **Prevent accidental path/uploader/firm leaks by type shape**
  (tradeoff: add a narrow mapping function, but dealer surfaces stay safe).
- **Generate signed URLs on demand** -> **Do not persist signed URLs in metadata/events**
  (tradeoff: extra Storage call per render/click, but avoids stale bearer links in audit data).

## Validation Question Answers

| Question | Answer |
| --- | --- |
| Why will this NOT work? | Caller-less listing, optional audit, and true Storage/DB atomicity do not work with current invariants. |
| What will BREAK? | Create-RFQ currently sends typed JSON; file uploads require `FormData` or a route handler. Wizard step indexes can break navigation. |
| What was MISSED? | Orphan cleanup, dealer post-quote token status, dealer post-close access, and migration journal mismatch. |
| What DEPENDENCIES are affected? | Supabase Storage service-role client, Drizzle schema/migrations, Next server actions/route handlers, `recordEvent()`, dealer token resolver. |
| What TESTS will fail? | New code using `attachment_added` fails typecheck/runtime until enum + migration are added; wizard tests would need updates if added. |
| What EDGE CASES were not addressed? | Empty file list, oversized files, spoofed MIME/extension, Storage upload success + DB failure, signed URL failure, quote token after `responded`. |
| Is there a SIMPLER way? | Keep dealer side read-only, use one private bucket/table, and centralize all auth in `lib/storage.ts`. |
| What DECISIONS need input? | Resolved after validation: bucket `rfq-attachments`; PDF/CSV/XLSX; 10 MB; dealer read-only access allows `pending` and `responded`; writes remain live/deadline-gated. |

## Cross-Model Review (Codex)

*Model: gpt-5.4 | Sandbox: read-only | Status: timed out*

Codex inspected the requested files but did not return the required structured output before the
120s timeout. Validation completed with Claude subagent analysis.

## Plan Revisions Made

- Changed attachment metadata audit from optional to mandatory because `recordEvent()` is the
  repo's mutation invariant.
- Changed storage helper API from caller-optional/list-by-RFQ to caller-explicit on upload, list,
  and sign because service-role Storage bypasses RLS.
- Added explicit Storage/DB failure ordering and orphan cleanup because Storage writes cannot join
  the Drizzle transaction.
- Added RFQ detail upload constraints: trader/admin only, live RFQ only, before deadline.
- Added dealer DTO masking constraints so path, bucket, firm, uploader, dealer, and invitation data
  cannot leak on `/quote/[token]`.
- Added migration journal mismatch as a prerequisite before generating the Block F migration.
- Added `npm run lint` to the validation gate because builds ignore lint in this repo.

## Decisions Confirmed

- [x] **Attachment audit**: Mandatory `attachment_added` event through `recordEvent()`.
- [x] **RFQ detail upload boundary**: Trader/admin only, live RFQ only, before deadline.
- [x] **Create launch atomicity policy**: Block launch and dealer emails if selected attachment
  upload or metadata commit fails.
- [x] **Storage bucket**: `SUPABASE_STORAGE_BUCKET=rfq-attachments`, private, signed URLs only.
- [x] **MIME and size**: PDF, CSV, XLSX only; 10 MB max per attachment.
- [x] **Dealer read access**: `pending` and `responded` invitation tokens can read page and
  attachments; quote writes continue to enforce live RFQ and deadline. `expired` and `revoked`
  remain denied.

## Dependencies Affected

| Component | Impact | Action Needed |
| --- | --- | --- |
| `db/schema.ts` | New table + enum value | Add `attachments`, `attachment_added`, relations/indexes, migration |
| `drizzle/meta/_journal.json` | Existing metadata mismatch | Account for `0003_admin_panel_event.sql` before Block F generation |
| `lib/storage.ts` | New service-role boundary | Centralize caller guard, validation, Storage upload/sign/list |
| `app/(app)/rfqs/new/actions.ts` | Launch payload changes | Support files via `FormData` or route handler while preserving launch invariants |
| `app/(app)/rfqs/new/wizard.tsx` | Step and payload changes | Add upload step and derive last-step logic |
| `app/(app)/rfqs/[id]/page.tsx` | New upload/list surface | Fetch scoped attachments and enforce trader/admin live-only upload |
| `app/quote/[token]/page.tsx` | Dealer read-only links | Resolve token and render masked attachment DTO only |
| `CLAUDE.md`, `AGENTS.md` | Env docs | Add `SUPABASE_STORAGE_BUCKET` |

## Test Implications

- Tests expected to fail until implemented: typecheck/runtime paths that reference
  `attachment_added` before schema/migration updates.
- Tests needing updates: create-RFQ action tests if they cover launch payload shape; any future
  wizard step tests if added.
- New coverage needed: user cross-tenant denial, dealer cross-RFQ denial, anonymous denial,
  dealer masked DTO no-leak, MIME rejection, size rejection, missing bucket config, signed URL
  failure propagation, upload-success/DB-failure cleanup, trader/admin live-only RFQ detail upload.
