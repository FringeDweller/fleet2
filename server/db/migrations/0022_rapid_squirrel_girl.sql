ALTER TYPE "public"."notification_type" ADD VALUE 'fuel_anomaly' BEFORE 'system';--> statement-breakpoint
CREATE TABLE "fuel_alert_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"high_consumption_threshold" numeric(5, 2) DEFAULT '30.00' NOT NULL,
	"low_consumption_threshold" numeric(5, 2) DEFAULT '30.00' NOT NULL,
	"critical_threshold" numeric(5, 2) DEFAULT '50.00' NOT NULL,
	"min_distance_between_refuels" numeric(10, 2) DEFAULT '10.00' NOT NULL,
	"enable_high_consumption_alerts" boolean DEFAULT true NOT NULL,
	"enable_low_consumption_alerts" boolean DEFAULT true NOT NULL,
	"enable_refuel_without_distance_alerts" boolean DEFAULT true NOT NULL,
	"enable_missing_odometer_alerts" boolean DEFAULT true NOT NULL,
	"send_email_notifications" boolean DEFAULT false NOT NULL,
	"send_in_app_notifications" boolean DEFAULT true NOT NULL,
	"notes" text,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fuel_alert_settings_organisation_id_unique" UNIQUE("organisation_id")
);
--> statement-breakpoint
ALTER TABLE "fuel_alert_settings" ADD CONSTRAINT "fuel_alert_settings_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_alert_settings" ADD CONSTRAINT "fuel_alert_settings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fuel_alert_settings_organisation_id_idx" ON "fuel_alert_settings" USING btree ("organisation_id");