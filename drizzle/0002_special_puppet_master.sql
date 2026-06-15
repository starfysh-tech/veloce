CREATE UNIQUE INDEX IF NOT EXISTS "awards_rfq_uniq" ON "awards" USING btree ("rfq_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "exceptions_firm_ref_uniq" ON "exceptions" USING btree ("firm_id","ref");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "trades_ref_uniq" ON "trades" USING btree ("ref");
