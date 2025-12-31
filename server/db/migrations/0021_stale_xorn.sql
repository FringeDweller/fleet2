DO $$ BEGIN
 CREATE TYPE "public"."obd_device_type" AS ENUM('elm327', 'obd_link', 'vgate', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."dtc_severity" AS ENUM('info', 'warning', 'critical');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."dtc_code_type" AS ENUM('P', 'C', 'B', 'U');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."dtc_wo_priority_mapping" AS ENUM('use_severity', 'fixed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE "obd_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"bluetooth_device_id" varchar(255) NOT NULL,
	"device_name" varchar(255) NOT NULL,
	"device_type" "obd_device_type" DEFAULT 'elm327' NOT NULL,
	"service_uuid" varchar(36),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_connected_at" timestamp with time zone,
	"metadata" text,
	"paired_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagnostic_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"code" varchar(10) NOT NULL,
	"code_type" "dtc_code_type" NOT NULL,
	"description" text,
	"severity" "dtc_severity" DEFAULT 'warning' NOT NULL,
	"raw_response" text,
	"freeze_frame_data" text,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_by_user_id" uuid NOT NULL,
	"cleared_at" timestamp with time zone,
	"cleared_by_user_id" uuid,
	"work_order_id" uuid,
	"sync_status" varchar(20) DEFAULT 'synced' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dtc_work_order_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"dtc_pattern" varchar(50) NOT NULL,
	"is_regex" boolean DEFAULT false NOT NULL,
	"should_create_work_order" boolean DEFAULT true NOT NULL,
	"priority_mapping" "dtc_wo_priority_mapping" DEFAULT 'use_severity' NOT NULL,
	"fixed_priority" varchar(20) DEFAULT 'medium',
	"work_order_title" varchar(200),
	"work_order_description" text,
	"template_id" uuid,
	"auto_assign_to_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dtc_work_order_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"dtc_code" varchar(20) NOT NULL,
	"dtc_description" text,
	"dtc_severity" varchar(20),
	"asset_id" uuid NOT NULL,
	"rule_id" uuid,
	"work_order_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "obd_devices" ADD CONSTRAINT "obd_devices_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obd_devices" ADD CONSTRAINT "obd_devices_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obd_devices" ADD CONSTRAINT "obd_devices_paired_by_id_users_id_fk" FOREIGN KEY ("paired_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_codes" ADD CONSTRAINT "diagnostic_codes_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_codes" ADD CONSTRAINT "diagnostic_codes_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_codes" ADD CONSTRAINT "diagnostic_codes_read_by_user_id_users_id_fk" FOREIGN KEY ("read_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_codes" ADD CONSTRAINT "diagnostic_codes_cleared_by_user_id_users_id_fk" FOREIGN KEY ("cleared_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_codes" ADD CONSTRAINT "diagnostic_codes_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dtc_work_order_rules" ADD CONSTRAINT "dtc_work_order_rules_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dtc_work_order_rules" ADD CONSTRAINT "dtc_work_order_rules_auto_assign_to_id_users_id_fk" FOREIGN KEY ("auto_assign_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dtc_work_order_rules" ADD CONSTRAINT "dtc_work_order_rules_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dtc_work_order_history" ADD CONSTRAINT "dtc_work_order_history_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dtc_work_order_history" ADD CONSTRAINT "dtc_work_order_history_rule_id_dtc_work_order_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."dtc_work_order_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "obd_devices_organisation_id_idx" ON "obd_devices" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "obd_devices_asset_id_idx" ON "obd_devices" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "obd_devices_bluetooth_device_id_idx" ON "obd_devices" USING btree ("bluetooth_device_id");--> statement-breakpoint
CREATE INDEX "obd_devices_is_active_idx" ON "obd_devices" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "diagnostic_codes_organisation_id_idx" ON "diagnostic_codes" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "diagnostic_codes_asset_id_idx" ON "diagnostic_codes" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "diagnostic_codes_code_idx" ON "diagnostic_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "diagnostic_codes_severity_idx" ON "diagnostic_codes" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "diagnostic_codes_read_at_idx" ON "diagnostic_codes" USING btree ("read_at");--> statement-breakpoint
CREATE INDEX "diagnostic_codes_cleared_at_idx" ON "diagnostic_codes" USING btree ("cleared_at");--> statement-breakpoint
CREATE INDEX "diagnostic_codes_work_order_id_idx" ON "diagnostic_codes" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "dtc_wo_rules_organisation_id_idx" ON "dtc_work_order_rules" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "dtc_wo_rules_is_active_idx" ON "dtc_work_order_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "dtc_wo_rules_dtc_pattern_idx" ON "dtc_work_order_rules" USING btree ("dtc_pattern");--> statement-breakpoint
CREATE INDEX "dtc_wo_history_organisation_id_idx" ON "dtc_work_order_history" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "dtc_wo_history_asset_id_idx" ON "dtc_work_order_history" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "dtc_wo_history_dtc_code_idx" ON "dtc_work_order_history" USING btree ("dtc_code");--> statement-breakpoint
CREATE INDEX "dtc_wo_history_work_order_id_idx" ON "dtc_work_order_history" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "dtc_wo_history_asset_dtc_status_idx" ON "dtc_work_order_history" USING btree ("asset_id", "dtc_code", "status");
