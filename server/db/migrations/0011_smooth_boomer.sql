ALTER TABLE "users" ADD COLUMN "hourly_rate" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "labor_cost" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "parts_cost" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "total_cost" numeric(12, 2);