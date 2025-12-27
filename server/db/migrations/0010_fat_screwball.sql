ALTER TABLE "parts" ADD COLUMN "on_order_quantity" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "on_order_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "on_order_notes" text;