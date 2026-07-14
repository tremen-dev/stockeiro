ALTER TABLE "symbols" DROP CONSTRAINT "symbols_ticker_unique";--> statement-breakpoint
ALTER TABLE "symbols" ADD COLUMN "mic_code" text;--> statement-breakpoint
ALTER TABLE "symbols" ADD COLUMN "exchange" text;--> statement-breakpoint
ALTER TABLE "symbols" ADD COLUMN "name" text;--> statement-breakpoint
CREATE INDEX "symbols_ticker_idx" ON "symbols" USING btree ("ticker");--> statement-breakpoint
ALTER TABLE "symbols" ADD CONSTRAINT "symbols_ticker_mic" UNIQUE("ticker","mic_code");