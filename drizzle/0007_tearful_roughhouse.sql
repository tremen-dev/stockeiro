ALTER TABLE "notifications" DROP CONSTRAINT "notifications_zone_trigger_id_zone_triggers_id_fk";
--> statement-breakpoint
ALTER TABLE "zone_triggers" DROP CONSTRAINT "zone_triggers_watched_symbol_id_watched_symbols_id_fk";
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_zone_trigger_id_zone_triggers_id_fk" FOREIGN KEY ("zone_trigger_id") REFERENCES "public"."zone_triggers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_triggers" ADD CONSTRAINT "zone_triggers_watched_symbol_id_watched_symbols_id_fk" FOREIGN KEY ("watched_symbol_id") REFERENCES "public"."watched_symbols"("id") ON DELETE cascade ON UPDATE no action;