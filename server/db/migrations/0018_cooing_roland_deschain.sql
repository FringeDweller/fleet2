CREATE TYPE "public"."custom_form_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."discrepancy_type" AS ENUM('quantity_mismatch', 'amount_mismatch', 'asset_mismatch', 'unauthorized', 'timing_mismatch', 'multiple');--> statement-breakpoint
CREATE TYPE "public"."fuel_source" AS ENUM('manual', 'authorization', 'external_sync');--> statement-breakpoint
CREATE TYPE "public"."inspection_item_result" AS ENUM('pass', 'fail', 'na', 'pending');--> statement-breakpoint
CREATE TYPE "public"."inspection_initiation_method" AS ENUM('nfc', 'qr_code', 'manual');--> statement-breakpoint
CREATE TYPE "public"."inspection_status" AS ENUM('in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."inspection_sync_status" AS ENUM('synced', 'pending', 'failed');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('healthy', 'degraded', 'unhealthy', 'offline', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."integration_type" AS ENUM('fuel_backend', 'telematics', 'erp', 'accounting', 'other');--> statement-breakpoint
CREATE TYPE "public"."job_site_visit_status" AS ENUM('in_progress', 'completed');--> statement-breakpoint
CREATE TABLE "custom_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "custom_form_status" DEFAULT 'draft' NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "inspection_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspection_id" uuid NOT NULL,
	"checklist_item_id" varchar(100) NOT NULL,
	"checklist_item_label" varchar(255) NOT NULL,
	"checklist_item_type" varchar(50) NOT NULL,
	"result" "inspection_item_result" DEFAULT 'pending' NOT NULL,
	"numeric_value" numeric(12, 4),
	"text_value" text,
	"photos" jsonb DEFAULT '[]'::jsonb,
	"signature" text,
	"notes" text,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspection_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"category_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"checklist_items" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"operator_session_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"initiation_method" "inspection_initiation_method" NOT NULL,
	"scan_data" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"location_name" varchar(255),
	"location_accuracy" numeric(10, 2),
	"status" "inspection_status" DEFAULT 'in_progress' NOT NULL,
	"sync_status" "inspection_sync_status" DEFAULT 'synced' NOT NULL,
	"notes" text,
	"overall_result" varchar(50),
	"offline_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_health" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"integration_type" "integration_type" NOT NULL,
	"integration_name" varchar(100) NOT NULL,
	"status" "integration_status" DEFAULT 'unknown' NOT NULL,
	"status_message" text,
	"last_successful_sync" timestamp with time zone,
	"last_sync_attempt" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error_message" text,
	"consecutive_errors" integer DEFAULT 0 NOT NULL,
	"total_errors" integer DEFAULT 0 NOT NULL,
	"total_successes" integer DEFAULT 0 NOT NULL,
	"total_records_synced" integer DEFAULT 0 NOT NULL,
	"last_sync_record_count" integer,
	"last_sync_duration_ms" integer,
	"config_endpoint" varchar(500),
	"config_enabled" boolean DEFAULT true NOT NULL,
	"config_sync_interval_minutes" integer DEFAULT 15,
	"config_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_sync_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_health_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"sync_type" varchar(50) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"success" boolean,
	"records_fetched" integer,
	"records_created" integer,
	"records_updated" integer,
	"records_with_errors" integer,
	"discrepancies_found" integer,
	"error_message" text,
	"error_details" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_site_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"geofence_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"operator_session_id" uuid,
	"status" "job_site_visit_status" DEFAULT 'in_progress' NOT NULL,
	"entry_time" timestamp with time zone NOT NULL,
	"exit_time" timestamp with time zone,
	"entry_latitude" numeric(10, 7) NOT NULL,
	"entry_longitude" numeric(10, 7) NOT NULL,
	"exit_latitude" numeric(10, 7),
	"exit_longitude" numeric(10, 7),
	"duration_minutes" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fuel_transactions" ADD COLUMN "source" "fuel_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "fuel_transactions" ADD COLUMN "external_transaction_id" varchar(255);--> statement-breakpoint
ALTER TABLE "fuel_transactions" ADD COLUMN "external_system_id" varchar(100);--> statement-breakpoint
ALTER TABLE "fuel_transactions" ADD COLUMN "authorization_id" uuid;--> statement-breakpoint
ALTER TABLE "fuel_transactions" ADD COLUMN "has_discrepancy" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fuel_transactions" ADD COLUMN "discrepancy_type" "discrepancy_type";--> statement-breakpoint
ALTER TABLE "fuel_transactions" ADD COLUMN "discrepancy_details" jsonb;--> statement-breakpoint
ALTER TABLE "fuel_transactions" ADD COLUMN "discrepancy_resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "fuel_transactions" ADD COLUMN "discrepancy_resolved_by_id" uuid;--> statement-breakpoint
ALTER TABLE "fuel_transactions" ADD COLUMN "discrepancy_resolution_notes" text;--> statement-breakpoint
ALTER TABLE "custom_forms" ADD CONSTRAINT "custom_forms_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_items" ADD CONSTRAINT "inspection_items_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_templates" ADD CONSTRAINT "inspection_templates_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_templates" ADD CONSTRAINT "inspection_templates_category_id_asset_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."asset_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_template_id_inspection_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."inspection_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_operator_session_id_operator_sessions_id_fk" FOREIGN KEY ("operator_session_id") REFERENCES "public"."operator_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_health" ADD CONSTRAINT "integration_health_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_sync_history" ADD CONSTRAINT "integration_sync_history_integration_health_id_integration_health_id_fk" FOREIGN KEY ("integration_health_id") REFERENCES "public"."integration_health"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_sync_history" ADD CONSTRAINT "integration_sync_history_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_site_visits" ADD CONSTRAINT "job_site_visits_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_site_visits" ADD CONSTRAINT "job_site_visits_geofence_id_geofences_id_fk" FOREIGN KEY ("geofence_id") REFERENCES "public"."geofences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_site_visits" ADD CONSTRAINT "job_site_visits_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_site_visits" ADD CONSTRAINT "job_site_visits_operator_session_id_operator_sessions_id_fk" FOREIGN KEY ("operator_session_id") REFERENCES "public"."operator_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_forms_organisation_id_idx" ON "custom_forms" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "custom_forms_status_idx" ON "custom_forms" USING btree ("status");--> statement-breakpoint
CREATE INDEX "custom_forms_name_idx" ON "custom_forms" USING btree ("name");--> statement-breakpoint
CREATE INDEX "inspection_items_inspection_id_idx" ON "inspection_items" USING btree ("inspection_id");--> statement-breakpoint
CREATE INDEX "inspection_items_result_idx" ON "inspection_items" USING btree ("result");--> statement-breakpoint
CREATE INDEX "inspection_items_checklist_item_id_idx" ON "inspection_items" USING btree ("checklist_item_id");--> statement-breakpoint
CREATE INDEX "inspection_templates_organisation_id_idx" ON "inspection_templates" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "inspection_templates_category_id_idx" ON "inspection_templates" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "inspection_templates_is_active_idx" ON "inspection_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "inspections_organisation_id_idx" ON "inspections" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "inspections_asset_id_idx" ON "inspections" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "inspections_template_id_idx" ON "inspections" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "inspections_operator_id_idx" ON "inspections" USING btree ("operator_id");--> statement-breakpoint
CREATE INDEX "inspections_operator_session_id_idx" ON "inspections" USING btree ("operator_session_id");--> statement-breakpoint
CREATE INDEX "inspections_status_idx" ON "inspections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inspections_sync_status_idx" ON "inspections" USING btree ("sync_status");--> statement-breakpoint
CREATE INDEX "inspections_started_at_idx" ON "inspections" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "integration_health_organisation_id_idx" ON "integration_health" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "integration_health_type_idx" ON "integration_health" USING btree ("integration_type");--> statement-breakpoint
CREATE INDEX "integration_health_status_idx" ON "integration_health" USING btree ("status");--> statement-breakpoint
CREATE INDEX "integration_health_org_type_idx" ON "integration_health" USING btree ("organisation_id","integration_type");--> statement-breakpoint
CREATE INDEX "integration_sync_history_health_id_idx" ON "integration_sync_history" USING btree ("integration_health_id");--> statement-breakpoint
CREATE INDEX "integration_sync_history_organisation_id_idx" ON "integration_sync_history" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "integration_sync_history_started_at_idx" ON "integration_sync_history" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "integration_sync_history_success_idx" ON "integration_sync_history" USING btree ("success");--> statement-breakpoint
CREATE INDEX "job_site_visits_organisation_id_idx" ON "job_site_visits" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "job_site_visits_geofence_id_idx" ON "job_site_visits" USING btree ("geofence_id");--> statement-breakpoint
CREATE INDEX "job_site_visits_asset_id_idx" ON "job_site_visits" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "job_site_visits_status_idx" ON "job_site_visits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "job_site_visits_entry_time_idx" ON "job_site_visits" USING btree ("entry_time");--> statement-breakpoint
CREATE INDEX "job_site_visits_org_entry_time_idx" ON "job_site_visits" USING btree ("organisation_id","entry_time");--> statement-breakpoint
CREATE INDEX "job_site_visits_asset_status_idx" ON "job_site_visits" USING btree ("asset_id","status");--> statement-breakpoint
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_discrepancy_resolved_by_id_users_id_fk" FOREIGN KEY ("discrepancy_resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fuel_transactions_source_idx" ON "fuel_transactions" USING btree ("source");--> statement-breakpoint
CREATE INDEX "fuel_transactions_external_id_idx" ON "fuel_transactions" USING btree ("external_transaction_id");--> statement-breakpoint
CREATE INDEX "fuel_transactions_has_discrepancy_idx" ON "fuel_transactions" USING btree ("has_discrepancy");--> statement-breakpoint
CREATE INDEX "fuel_transactions_authorization_id_idx" ON "fuel_transactions" USING btree ("authorization_id");