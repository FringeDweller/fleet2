CREATE TYPE "public"."handover_type" AS ENUM('shift_change', 'break', 'emergency', 'other');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'shift_handover' BEFORE 'system';--> statement-breakpoint
CREATE TABLE "inspection_checkpoint_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"asset_category_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"position" varchar(50) NOT NULL,
	"qr_code" varchar(255),
	"nfc_tag" varchar(255),
	"required" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspection_checkpoint_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspection_id" uuid NOT NULL,
	"checkpoint_definition_id" uuid NOT NULL,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scanned_by_id" uuid NOT NULL,
	"scan_data" text,
	"scan_method" varchar(20) NOT NULL,
	"latitude" varchar(20),
	"longitude" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "defects" ADD COLUMN "inspection_item_id" uuid;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "signature_url" text;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "declaration_text" text;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "signed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "signed_by_id" uuid;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD COLUMN "handover_from_session_id" uuid;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD COLUMN "handover_reason" text;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD COLUMN "handover_type" "handover_type";--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD COLUMN "session_gap" integer;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD COLUMN "is_linked_session" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "handover_threshold_minutes" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "auto_create_work_order_on_defect" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "inspection_checkpoint_definitions" ADD CONSTRAINT "inspection_checkpoint_definitions_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_checkpoint_definitions" ADD CONSTRAINT "inspection_checkpoint_definitions_asset_category_id_asset_categories_id_fk" FOREIGN KEY ("asset_category_id") REFERENCES "public"."asset_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_checkpoint_scans" ADD CONSTRAINT "inspection_checkpoint_scans_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_checkpoint_scans" ADD CONSTRAINT "inspection_checkpoint_scans_checkpoint_definition_id_inspection_checkpoint_definitions_id_fk" FOREIGN KEY ("checkpoint_definition_id") REFERENCES "public"."inspection_checkpoint_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_checkpoint_scans" ADD CONSTRAINT "inspection_checkpoint_scans_scanned_by_id_users_id_fk" FOREIGN KEY ("scanned_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inspection_checkpoint_defs_org_id_idx" ON "inspection_checkpoint_definitions" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "inspection_checkpoint_defs_category_id_idx" ON "inspection_checkpoint_definitions" USING btree ("asset_category_id");--> statement-breakpoint
CREATE INDEX "inspection_checkpoint_defs_position_idx" ON "inspection_checkpoint_definitions" USING btree ("position");--> statement-breakpoint
CREATE INDEX "inspection_checkpoint_defs_qr_code_idx" ON "inspection_checkpoint_definitions" USING btree ("qr_code");--> statement-breakpoint
CREATE INDEX "inspection_checkpoint_defs_nfc_tag_idx" ON "inspection_checkpoint_definitions" USING btree ("nfc_tag");--> statement-breakpoint
CREATE INDEX "inspection_checkpoint_defs_active_idx" ON "inspection_checkpoint_definitions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "inspection_checkpoint_scans_inspection_id_idx" ON "inspection_checkpoint_scans" USING btree ("inspection_id");--> statement-breakpoint
CREATE INDEX "inspection_checkpoint_scans_checkpoint_def_id_idx" ON "inspection_checkpoint_scans" USING btree ("checkpoint_definition_id");--> statement-breakpoint
CREATE INDEX "inspection_checkpoint_scans_scanned_at_idx" ON "inspection_checkpoint_scans" USING btree ("scanned_at");--> statement-breakpoint
CREATE INDEX "inspection_checkpoint_scans_scanned_by_idx" ON "inspection_checkpoint_scans" USING btree ("scanned_by_id");--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_inspection_item_id_inspection_items_id_fk" FOREIGN KEY ("inspection_item_id") REFERENCES "public"."inspection_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_signed_by_id_users_id_fk" FOREIGN KEY ("signed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "defects_inspection_id_idx" ON "defects" USING btree ("inspection_id");--> statement-breakpoint
CREATE INDEX "defects_inspection_item_id_idx" ON "defects" USING btree ("inspection_item_id");--> statement-breakpoint
CREATE INDEX "inspections_signed_by_id_idx" ON "inspections" USING btree ("signed_by_id");--> statement-breakpoint
CREATE INDEX "operator_sessions_handover_from_idx" ON "operator_sessions" USING btree ("handover_from_session_id");