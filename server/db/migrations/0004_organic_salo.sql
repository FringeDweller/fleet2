CREATE TYPE "public"."schedule_type" AS ENUM('time_based', 'usage_based', 'combined');--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ALTER COLUMN "interval_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ALTER COLUMN "start_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ADD COLUMN "schedule_type" "schedule_type" DEFAULT 'time_based' NOT NULL;--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ADD COLUMN "interval_mileage" integer;--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ADD COLUMN "interval_hours" integer;--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ADD COLUMN "last_triggered_mileage" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ADD COLUMN "last_triggered_hours" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ADD COLUMN "threshold_alert_percent" integer DEFAULT 90;--> statement-breakpoint
CREATE INDEX "maintenance_schedules_schedule_type_idx" ON "maintenance_schedules" USING btree ("schedule_type");