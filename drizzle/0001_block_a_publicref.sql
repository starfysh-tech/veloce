ALTER TABLE "rfqs" ADD COLUMN "public_ref" text;--> statement-breakpoint
-- Backfill for existing rows (replaced on next `npm run db:seed`).
-- md5 of (random() || id) so each row gets a distinct value. The earlier
-- generate_series subquery had no outer-row reference, so Postgres evaluated
-- it once and every row got the same string, breaking the unique index below.
UPDATE "rfqs" SET "public_ref" = 'RFQ-' || upper(substr(md5(random()::text || id::text), 1, 8))
  WHERE "public_ref" IS NULL;--> statement-breakpoint
ALTER TABLE "rfqs" ALTER COLUMN "public_ref" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rfqs_public_ref_uniq" ON "rfqs" ("public_ref");--> statement-breakpoint
DROP INDEX IF EXISTS "rfqs_ref_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "rfqs_firm_ref_uniq" ON "rfqs" ("firm_id","ref");
