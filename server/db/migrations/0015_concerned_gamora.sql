CREATE TYPE "public"."operator_session_status" AS ENUM('active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."operator_session_sync_status" AS ENUM('synced', 'pending', 'failed');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."fuel_sync_status" AS ENUM('synced', 'pending');--> statement-breakpoint
CREATE TYPE "public"."fuel_type" AS ENUM('diesel', 'petrol', 'electric', 'lpg', 'other');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'work_order_approval_requested' BEFORE 'defect_reported';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'work_order_approved' BEFORE 'defect_reported';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'work_order_rejected' BEFORE 'defect_reported';--> statement-breakpoint
ALTER TYPE "public"."work_order_status" ADD VALUE 'pending_approval' BEFORE 'open';--> statement-breakpoint
CREATE TABLE "location_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"operator_session_id" uuid NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"accuracy" numeric(10, 2),
	"altitude" numeric(10, 2),
	"speed" numeric(8, 2),
	"heading" numeric(6, 2),
	"recorded_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"start_time" timestamp with time zone DEFAULT now() NOT NULL,
	"end_time" timestamp with time zone,
	"start_odometer" numeric(12, 2),
	"end_odometer" numeric(12, 2),
	"start_hours" numeric(12, 2),
	"end_hours" numeric(12, 2),
	"start_latitude" numeric(10, 7),
	"start_longitude" numeric(10, 7),
	"start_location_name" text,
	"end_latitude" numeric(10, 7),
	"end_longitude" numeric(10, 7),
	"end_location_name" text,
	"trip_distance" numeric(12, 2),
	"trip_duration_minutes" integer,
	"status" "operator_session_status" DEFAULT 'active' NOT NULL,
	"sync_status" "operator_session_sync_status" DEFAULT 'synced' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_order_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"work_order_id" uuid NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"requested_by_id" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_notes" text,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"is_emergency_override" boolean DEFAULT false NOT NULL,
	"emergency_reason" text,
	"emergency_override_by_id" uuid,
	"emergency_override_at" timestamp with time zone,
	"estimated_cost_at_request" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fuel_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"operator_session_id" uuid,
	"user_id" uuid NOT NULL,
	"quantity" numeric(10, 3) NOT NULL,
	"unit_cost" numeric(10, 4),
	"total_cost" numeric(12, 2),
	"fuel_type" "fuel_type" DEFAULT 'diesel' NOT NULL,
	"odometer" numeric(12, 2),
	"engine_hours" numeric(12, 2),
	"receipt_photo_path" varchar(500),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"location_name" varchar(255),
	"location_address" text,
	"vendor" varchar(255),
	"notes" text,
	"sync_status" "fuel_sync_status" DEFAULT 'synced' NOT NULL,
	"transaction_date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "work_order_approval_threshold" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "require_approval_for_all_work_orders" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "location_tracking_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "location_tracking_interval" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "location_records" ADD CONSTRAINT "location_records_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_records" ADD CONSTRAINT "location_records_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_records" ADD CONSTRAINT "location_records_operator_session_id_operator_sessions_id_fk" FOREIGN KEY ("operator_session_id") REFERENCES "public"."operator_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD CONSTRAINT "operator_sessions_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD CONSTRAINT "operator_sessions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD CONSTRAINT "operator_sessions_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_approvals" ADD CONSTRAINT "work_order_approvals_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_approvals" ADD CONSTRAINT "work_order_approvals_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_approvals" ADD CONSTRAINT "work_order_approvals_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_approvals" ADD CONSTRAINT "work_order_approvals_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_approvals" ADD CONSTRAINT "work_order_approvals_emergency_override_by_id_users_id_fk" FOREIGN KEY ("emergency_override_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_operator_session_id_operator_sessions_id_fk" FOREIGN KEY ("operator_session_id") REFERENCES "public"."operator_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "location_records_asset_id_recorded_at_idx" ON "location_records" USING btree ("asset_id","recorded_at");--> statement-breakpoint
CREATE INDEX "location_records_operator_session_id_idx" ON "location_records" USING btree ("operator_session_id");--> statement-breakpoint
CREATE INDEX "location_records_organisation_id_recorded_at_idx" ON "location_records" USING btree ("organisation_id","recorded_at");--> statement-breakpoint
CREATE INDEX "location_records_synced_at_idx" ON "location_records" USING btree ("synced_at");--> statement-breakpoint
CREATE INDEX "operator_sessions_organisation_id_idx" ON "operator_sessions" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "operator_sessions_asset_id_idx" ON "operator_sessions" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "operator_sessions_operator_id_idx" ON "operator_sessions" USING btree ("operator_id");--> statement-breakpoint
CREATE INDEX "operator_sessions_status_idx" ON "operator_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "operator_sessions_start_time_idx" ON "operator_sessions" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "operator_sessions_active_asset_idx" ON "operator_sessions" USING btree ("asset_id","status");--> statement-breakpoint
CREATE INDEX "operator_sessions_active_operator_idx" ON "operator_sessions" USING btree ("operator_id","status");--> statement-breakpoint
CREATE INDEX "work_order_approvals_organisation_id_idx" ON "work_order_approvals" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "work_order_approvals_work_order_id_idx" ON "work_order_approvals" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "work_order_approvals_status_idx" ON "work_order_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "work_order_approvals_requested_by_id_idx" ON "work_order_approvals" USING btree ("requested_by_id");--> statement-breakpoint
CREATE INDEX "work_order_approvals_reviewed_by_id_idx" ON "work_order_approvals" USING btree ("reviewed_by_id");--> statement-breakpoint
CREATE INDEX "fuel_transactions_organisation_id_idx" ON "fuel_transactions" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "fuel_transactions_asset_id_idx" ON "fuel_transactions" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "fuel_transactions_user_id_idx" ON "fuel_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fuel_transactions_transaction_date_idx" ON "fuel_transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "fuel_transactions_fuel_type_idx" ON "fuel_transactions" USING btree ("fuel_type");--> statement-breakpoint
CREATE INDEX "fuel_transactions_sync_status_idx" ON "fuel_transactions" USING btree ("sync_status");