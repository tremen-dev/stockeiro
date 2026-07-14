CREATE TABLE "symbol_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"broker_name" text NOT NULL,
	"market_label" text NOT NULL,
	"symbol_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "symbol_alias_user_broker_market" UNIQUE("user_id","broker_name","market_label")
);
--> statement-breakpoint
ALTER TABLE "symbol_aliases" ADD CONSTRAINT "symbol_aliases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symbol_aliases" ADD CONSTRAINT "symbol_aliases_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "symbol_alias_user_idx" ON "symbol_aliases" USING btree ("user_id");