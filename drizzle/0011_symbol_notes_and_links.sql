CREATE TABLE "symbol_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol_id" uuid NOT NULL,
	"url" text NOT NULL,
	"label" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "symbol_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol_id" uuid NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "symbol_notes_user_symbol" UNIQUE("user_id","symbol_id")
);
--> statement-breakpoint
ALTER TABLE "symbol_links" ADD CONSTRAINT "symbol_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symbol_links" ADD CONSTRAINT "symbol_links_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symbol_notes" ADD CONSTRAINT "symbol_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symbol_notes" ADD CONSTRAINT "symbol_notes_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "symbol_links_user_symbol_idx" ON "symbol_links" USING btree ("user_id","symbol_id");