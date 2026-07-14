ALTER TABLE "transactions" ADD COLUMN "import_key" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "importe_eur" numeric;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_import_key" UNIQUE("user_id","import_key");