CREATE TABLE "quote_diagnostics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_diagnostics_symbol_id_unique" UNIQUE("symbol_id")
);
--> statement-breakpoint
ALTER TABLE "quote_diagnostics" ADD CONSTRAINT "quote_diagnostics_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE no action ON UPDATE no action;