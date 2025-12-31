CREATE TYPE "public"."custom_report_aggregation_type" AS ENUM('count', 'sum', 'avg', 'min', 'max');--> statement-breakpoint
CREATE TYPE "public"."custom_report_data_source" AS ENUM('assets', 'work_orders', 'maintenance_schedules', 'fuel_transactions', 'inspections');--> statement-breakpoint
CREATE TABLE "custom_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"data_source" "custom_report_data_source" NOT NULL,
	"definition" jsonb NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_reports" ADD CONSTRAINT "custom_reports_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_reports" ADD CONSTRAINT "custom_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_reports_organisation_id_idx" ON "custom_reports" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "custom_reports_user_id_idx" ON "custom_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "custom_reports_data_source_idx" ON "custom_reports" USING btree ("data_source");--> statement-breakpoint
CREATE INDEX "custom_reports_is_shared_idx" ON "custom_reports" USING btree ("is_shared");--> statement-breakpoint
CREATE INDEX "custom_reports_is_archived_idx" ON "custom_reports" USING btree ("is_archived");