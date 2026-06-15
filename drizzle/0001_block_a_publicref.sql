ALTER TABLE "rfqs" ADD COLUMN "public_ref" text;--> statement-breakpoint
-- Crockford base32 backfill for existing rows (replaced on next `npm run db:seed`).
UPDATE "rfqs" SET "public_ref" = 'RFQ-' || (
  SELECT string_agg(substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + (get_byte(gen_random_bytes(1), 0) % 32), 1), '')
  FROM generate_series(1, 8)
) WHERE "public_ref" IS NULL;--> statement-breakpoint
ALTER TABLE "rfqs" ALTER COLUMN "public_ref" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rfqs_public_ref_uniq" ON "rfqs" ("public_ref");--> statement-breakpoint
DROP INDEX IF EXISTS "rfqs_ref_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "rfqs_firm_ref_uniq" ON "rfqs" ("firm_id","ref");
