CREATE TYPE "public"."fuel_auth_status" AS ENUM('pending', 'authorized', 'completed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."geofence_alert_type" AS ENUM('entry', 'exit', 'after_hours_movement');--> statement-breakpoint
CREATE TYPE "public"."geofence_category" AS ENUM('work_site', 'depot', 'restricted_zone', 'customer_location', 'fuel_station', 'other');--> statement-breakpoint
CREATE TYPE "public"."geofence_type" AS ENUM('polygon', 'circle');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'geofence_entry' BEFORE 'system';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'geofence_exit' BEFORE 'system';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'after_hours_movement' BEFORE 'system';--> statement-breakpoint
CREATE TABLE "fuel_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"operator_session_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"auth_code" varchar(10) NOT NULL,
	"qr_code_data" text NOT NULL,
	"status" "fuel_auth_status" DEFAULT 'pending' NOT NULL,
	"max_quantity_litres" numeric(10, 2),
	"max_amount_dollars" numeric(10, 2),
	"fuel_transaction_id" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"authorized_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fuel_authorizations_auth_code_unique" UNIQUE("auth_code")
);
--> statement-breakpoint
CREATE TABLE "geofence_alert_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"geofence_id" uuid NOT NULL,
	"alert_on_entry" boolean DEFAULT true NOT NULL,
	"alert_on_exit" boolean DEFAULT true NOT NULL,
	"alert_after_hours" boolean DEFAULT false NOT NULL,
	"notify_by_push" boolean DEFAULT true NOT NULL,
	"notify_by_email" boolean DEFAULT false NOT NULL,
	"notify_user_ids" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geofence_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"geofence_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"operator_session_id" uuid,
	"alert_type" "geofence_alert_type" NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"alerted_at" timestamp with time zone NOT NULL,
	"is_acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geofences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"type" "geofence_type" NOT NULL,
	"category" "geofence_category" DEFAULT 'other',
	"center_latitude" numeric(10, 7),
	"center_longitude" numeric(10, 7),
	"radius_meters" numeric(10, 2),
	"polygon_coordinates" jsonb,
	"active_start_time" time,
	"active_end_time" time,
	"active_days" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"color" varchar(7) DEFAULT '#3B82F6',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fuel_authorizations" ADD CONSTRAINT "fuel_authorizations_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_authorizations" ADD CONSTRAINT "fuel_authorizations_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_authorizations" ADD CONSTRAINT "fuel_authorizations_operator_session_id_operator_sessions_id_fk" FOREIGN KEY ("operator_session_id") REFERENCES "public"."operator_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_authorizations" ADD CONSTRAINT "fuel_authorizations_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_authorizations" ADD CONSTRAINT "fuel_authorizations_fuel_transaction_id_fuel_transactions_id_fk" FOREIGN KEY ("fuel_transaction_id") REFERENCES "public"."fuel_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofence_alert_settings" ADD CONSTRAINT "geofence_alert_settings_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofence_alert_settings" ADD CONSTRAINT "geofence_alert_settings_geofence_id_geofences_id_fk" FOREIGN KEY ("geofence_id") REFERENCES "public"."geofences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofence_alerts" ADD CONSTRAINT "geofence_alerts_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofence_alerts" ADD CONSTRAINT "geofence_alerts_geofence_id_geofences_id_fk" FOREIGN KEY ("geofence_id") REFERENCES "public"."geofences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofence_alerts" ADD CONSTRAINT "geofence_alerts_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofence_alerts" ADD CONSTRAINT "geofence_alerts_operator_session_id_operator_sessions_id_fk" FOREIGN KEY ("operator_session_id") REFERENCES "public"."operator_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofence_alerts" ADD CONSTRAINT "geofence_alerts_acknowledged_by_id_users_id_fk" FOREIGN KEY ("acknowledged_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fuel_authorizations_organisation_id_idx" ON "fuel_authorizations" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "fuel_authorizations_asset_id_idx" ON "fuel_authorizations" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "fuel_authorizations_operator_id_idx" ON "fuel_authorizations" USING btree ("operator_id");--> statement-breakpoint
CREATE INDEX "fuel_authorizations_operator_session_id_idx" ON "fuel_authorizations" USING btree ("operator_session_id");--> statement-breakpoint
CREATE INDEX "fuel_authorizations_auth_code_idx" ON "fuel_authorizations" USING btree ("auth_code");--> statement-breakpoint
CREATE INDEX "fuel_authorizations_status_idx" ON "fuel_authorizations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fuel_authorizations_expires_at_idx" ON "fuel_authorizations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "fuel_authorizations_pending_code_idx" ON "fuel_authorizations" USING btree ("auth_code","status");--> statement-breakpoint
CREATE INDEX "geofence_alert_settings_organisation_id_idx" ON "geofence_alert_settings" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "geofence_alert_settings_geofence_id_idx" ON "geofence_alert_settings" USING btree ("geofence_id");--> statement-breakpoint
CREATE INDEX "geofence_alerts_organisation_id_idx" ON "geofence_alerts" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "geofence_alerts_geofence_id_idx" ON "geofence_alerts" USING btree ("geofence_id");--> statement-breakpoint
CREATE INDEX "geofence_alerts_asset_id_idx" ON "geofence_alerts" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "geofence_alerts_alerted_at_idx" ON "geofence_alerts" USING btree ("alerted_at");--> statement-breakpoint
CREATE INDEX "geofence_alerts_is_acknowledged_idx" ON "geofence_alerts" USING btree ("is_acknowledged");--> statement-breakpoint
CREATE INDEX "geofence_alerts_org_acknowledged_alerted_idx" ON "geofence_alerts" USING btree ("organisation_id","is_acknowledged","alerted_at");--> statement-breakpoint
CREATE INDEX "geofences_organisation_id_idx" ON "geofences" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "geofences_category_idx" ON "geofences" USING btree ("category");--> statement-breakpoint
CREATE INDEX "geofences_is_active_idx" ON "geofences" USING btree ("is_active");