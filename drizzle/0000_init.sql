CREATE TYPE "public"."auction_mode" AS ENUM('split', 'full');--> statement-breakpoint
CREATE TYPE "public"."award_kind" AS ENUM('single', 'blended');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('rfq_created', 'rfq_launched', 'rfq_cancelled', 'invitation_sent', 'quote_submitted', 'quote_revised', 'auction_closed', 'auction_extended', 'award_recommended', 'award_approved', 'award_rejected', 'clarification_requested', 'trade_captured', 'handoff_sent', 'handoff_advanced', 'exception_opened', 'exception_closed');--> statement-breakpoint
CREATE TYPE "public"."exception_severity" AS ENUM('info', 'warn');--> statement-breakpoint
CREATE TYPE "public"."firm_type" AS ENUM('insurer', 'fund', 'dealer');--> statement-breakpoint
CREATE TYPE "public"."handoff_status" AS ENUM('sent', 'matched', 'affirmed');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'responded', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."rfq_status" AS ENUM('draft', 'live', 'under_review', 'awaiting_approval', 'awarded', 'in_stp', 'affirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."trade_status" AS ENUM('captured', 'sent', 'matched', 'affirmed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('trader', 'approver', 'ops', 'compliance', 'admin');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"kind" "award_kind" NOT NULL,
	"blended_price" numeric(12, 4) NOT NULL,
	"best_single_price" numeric(12, 4),
	"best_single_dealer_id" uuid,
	"savings_bps" numeric(8, 2),
	"savings_minor" bigint,
	"rationale" text,
	"allocations" jsonb NOT NULL,
	"flags" jsonb DEFAULT '[]' NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"recommended_by" uuid,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bank_panel_members" (
	"panel_id" uuid NOT NULL,
	"dealer_firm_id" uuid NOT NULL,
	CONSTRAINT "bank_panel_members_panel_id_dealer_firm_id_pk" PRIMARY KEY("panel_id","dealer_firm_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bank_panels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"rfq_id" uuid,
	"type" "event_type" NOT NULL,
	"actor_user_id" uuid,
	"actor_dealer_firm_id" uuid,
	"actor_label" text NOT NULL,
	"summary" text NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"firm_id" uuid NOT NULL,
	"rfq_id" uuid,
	"severity" "exception_severity" DEFAULT 'warn' NOT NULL,
	"text" text NOT NULL,
	"status" text NOT NULL,
	"open" boolean DEFAULT true NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "firms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "firm_type" NOT NULL,
	"city" text,
	"lei" text,
	"short_code" text,
	"color_hex" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "handoff_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handoff_id" uuid NOT NULL,
	"severity" "exception_severity" DEFAULT 'warn' NOT NULL,
	"text" text NOT NULL,
	"open" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "handoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"rfq_id" uuid NOT NULL,
	"trade_ids" jsonb NOT NULL,
	"channel" text DEFAULT 'MarkitWire (simulated)' NOT NULL,
	"payload_label" text,
	"payload" jsonb NOT NULL,
	"status" "handoff_status" DEFAULT 'sent' NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"dealer_firm_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"dealer_email" text NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"dealer_firm_id" uuid NOT NULL,
	"invitation_id" uuid,
	"price" numeric(12, 4) NOT NULL,
	"pct" integer NOT NULL,
	"note" text,
	"revised_from_price" numeric(12, 4),
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rfq_invited_dealers" (
	"rfq_id" uuid NOT NULL,
	"dealer_firm_id" uuid NOT NULL,
	CONSTRAINT "rfq_invited_dealers_rfq_id_dealer_firm_id_pk" PRIMARY KEY("rfq_id","dealer_firm_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rfqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"firm_id" uuid NOT NULL,
	"requester_id" uuid,
	"title" text NOT NULL,
	"product" text NOT NULL,
	"template" text,
	"side" text,
	"underlying" text,
	"ref_level" text,
	"strike" text,
	"expiry" text,
	"style" text,
	"tenor" text,
	"notional_minor" bigint NOT NULL,
	"ccy" text DEFAULT 'USD' NOT NULL,
	"notional_label" text,
	"quote_unit" text NOT NULL,
	"lower_is_better" boolean DEFAULT true NOT NULL,
	"mode" "auction_mode" DEFAULT 'split' NOT NULL,
	"blind" boolean DEFAULT true NOT NULL,
	"status" "rfq_status" DEFAULT 'draft' NOT NULL,
	"deadline" timestamp with time zone,
	"window_minutes" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"launched_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"rfq_id" uuid NOT NULL,
	"dealer_firm_id" uuid NOT NULL,
	"pct" integer NOT NULL,
	"alloc_notional_minor" bigint NOT NULL,
	"ccy" text NOT NULL,
	"price" numeric(12, 4) NOT NULL,
	"price_unit" text NOT NULL,
	"status" "trade_status" DEFAULT 'captured' NOT NULL,
	"trade_date" text,
	"settle" text,
	"uti" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_id" uuid,
	"firm_id" uuid NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"desk" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth_id_unique" UNIQUE("auth_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "awards" ADD CONSTRAINT "awards_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "awards" ADD CONSTRAINT "awards_best_single_dealer_id_firms_id_fk" FOREIGN KEY ("best_single_dealer_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "awards" ADD CONSTRAINT "awards_recommended_by_users_id_fk" FOREIGN KEY ("recommended_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "awards" ADD CONSTRAINT "awards_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_panel_members" ADD CONSTRAINT "bank_panel_members_panel_id_bank_panels_id_fk" FOREIGN KEY ("panel_id") REFERENCES "public"."bank_panels"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_panel_members" ADD CONSTRAINT "bank_panel_members_dealer_firm_id_firms_id_fk" FOREIGN KEY ("dealer_firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_panels" ADD CONSTRAINT "bank_panels_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_actor_dealer_firm_id_firms_id_fk" FOREIGN KEY ("actor_dealer_firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "handoff_exceptions" ADD CONSTRAINT "handoff_exceptions_handoff_id_handoffs_id_fk" FOREIGN KEY ("handoff_id") REFERENCES "public"."handoffs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitations" ADD CONSTRAINT "invitations_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitations" ADD CONSTRAINT "invitations_dealer_firm_id_firms_id_fk" FOREIGN KEY ("dealer_firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotes" ADD CONSTRAINT "quotes_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotes" ADD CONSTRAINT "quotes_dealer_firm_id_firms_id_fk" FOREIGN KEY ("dealer_firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotes" ADD CONSTRAINT "quotes_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rfq_invited_dealers" ADD CONSTRAINT "rfq_invited_dealers_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rfq_invited_dealers" ADD CONSTRAINT "rfq_invited_dealers_dealer_firm_id_firms_id_fk" FOREIGN KEY ("dealer_firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trades" ADD CONSTRAINT "trades_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trades" ADD CONSTRAINT "trades_dealer_firm_id_firms_id_fk" FOREIGN KEY ("dealer_firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "awards_rfq_idx" ON "awards" USING btree ("rfq_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_panels_firm_idx" ON "bank_panels" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_firm_idx" ON "events" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_rfq_idx" ON "events" USING btree ("rfq_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_created_idx" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exceptions_firm_idx" ON "exceptions" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "handoffs_rfq_idx" ON "handoffs" USING btree ("rfq_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitations_rfq_idx" ON "invitations" USING btree ("rfq_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitations_token_idx" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_rfq_idx" ON "quotes" USING btree ("rfq_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_dealer_rfq_idx" ON "quotes" USING btree ("rfq_id","dealer_firm_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfqs_firm_idx" ON "rfqs" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfqs_status_idx" ON "rfqs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfqs_deadline_idx" ON "rfqs" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfqs_ref_idx" ON "rfqs" USING btree ("firm_id","ref");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trades_rfq_idx" ON "trades" USING btree ("rfq_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_firm_idx" ON "users" USING btree ("firm_id");