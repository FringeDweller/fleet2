CREATE TYPE "public"."export_entity" AS ENUM('assets', 'work_orders', 'parts', 'inspections', 'fuel_transactions');--> statement-breakpoint
CREATE TYPE "public"."export_format" AS ENUM('csv', 'xlsx');--> statement-breakpoint
CREATE TYPE "public"."export_frequency" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."system_setting_category" AS ENUM('maintenance', 'approval', 'certification', 'fuel', 'notifications', 'general');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'document_expiring' BEFORE 'system';--> statement-breakpoint
CREATE TABLE "scheduled_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"entity" "export_entity" NOT NULL,
	"format" "export_format" DEFAULT 'csv' NOT NULL,
	"columns" jsonb NOT NULL,
	"filters" jsonb DEFAULT '[]'::jsonb,
	"sort_field" varchar(100),
	"sort_direction" varchar(10) DEFAULT 'asc',
	"frequency" "export_frequency" NOT NULL,
	"schedule_day" varchar(10),
	"schedule_time" varchar(5) DEFAULT '06:00' NOT NULL,
	"email_recipients" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"category" "system_setting_category" DEFAULT 'general' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" uuid
);
--> statement-breakpoint
ALTER TABLE "scheduled_exports" ADD CONSTRAINT "scheduled_exports_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_exports" ADD CONSTRAINT "scheduled_exports_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scheduled_exports_organisation_id_idx" ON "scheduled_exports" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "scheduled_exports_created_by_id_idx" ON "scheduled_exports" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "scheduled_exports_entity_idx" ON "scheduled_exports" USING btree ("entity");--> statement-breakpoint
CREATE INDEX "scheduled_exports_is_active_idx" ON "scheduled_exports" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "scheduled_exports_next_run_at_idx" ON "scheduled_exports" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "system_settings_org_key_unique_idx" ON "system_settings" USING btree ("organisation_id","key");--> statement-breakpoint
CREATE INDEX "system_settings_org_id_idx" ON "system_settings" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "system_settings_category_idx" ON "system_settings" USING btree ("category");