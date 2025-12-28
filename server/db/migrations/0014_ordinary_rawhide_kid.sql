CREATE TYPE "public"."document_type" AS ENUM('registration', 'insurance', 'inspection', 'certification', 'manual', 'warranty', 'other');--> statement-breakpoint
CREATE TYPE "public"."inventory_count_item_status" AS ENUM('pending', 'counted', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."inventory_count_status" AS ENUM('in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."location_type" AS ENUM('warehouse', 'bin', 'shelf', 'truck', 'building', 'room', 'other');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'defect_reported' BEFORE 'system';--> statement-breakpoint
CREATE TABLE "asset_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_type" varchar(100) NOT NULL,
	"file_size" bigint NOT NULL,
	"description" text,
	"document_type" "document_type" DEFAULT 'other' NOT NULL,
	"expiry_date" timestamp with time zone,
	"uploaded_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_count_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"location" varchar(100),
	"system_quantity" numeric(12, 2) NOT NULL,
	"counted_quantity" numeric(12, 2),
	"discrepancy" numeric(12, 2),
	"status" "inventory_count_item_status" DEFAULT 'pending' NOT NULL,
	"counted_at" timestamp with time zone,
	"adjusted_at" timestamp with time zone,
	"adjusted_by_id" uuid,
	"adjustment_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_count_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"status" "inventory_count_status" DEFAULT 'in_progress' NOT NULL,
	"name" varchar(200),
	"notes" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"started_by_id" uuid NOT NULL,
	"completed_by_id" uuid,
	"cancelled_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"from_location_id" uuid NOT NULL,
	"to_location_id" uuid NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"transferred_by_id" uuid NOT NULL,
	"notes" text,
	"reference_number" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "part_location_quantities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"quantity" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "part_location_quantities_part_location_unique" UNIQUE("part_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "storage_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"type" "location_type" DEFAULT 'warehouse' NOT NULL,
	"parent_id" uuid,
	"code" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"parent_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"task_template_id" uuid NOT NULL,
	"asset_id" uuid,
	"category_id" uuid,
	"parts_override" jsonb,
	"checklist_override" jsonb,
	"estimated_duration_override" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_templates" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "work_order_parts" ADD COLUMN "source_location_id" uuid;--> statement-breakpoint
ALTER TABLE "asset_documents" ADD CONSTRAINT "asset_documents_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_documents" ADD CONSTRAINT "asset_documents_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_session_id_inventory_count_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."inventory_count_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_adjusted_by_id_users_id_fk" FOREIGN KEY ("adjusted_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_started_by_id_users_id_fk" FOREIGN KEY ("started_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_completed_by_id_users_id_fk" FOREIGN KEY ("completed_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_cancelled_by_id_users_id_fk" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_from_location_id_storage_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."storage_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_to_location_id_storage_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."storage_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_transferred_by_id_users_id_fk" FOREIGN KEY ("transferred_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_location_quantities" ADD CONSTRAINT "part_location_quantities_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_location_quantities" ADD CONSTRAINT "part_location_quantities_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_location_quantities" ADD CONSTRAINT "part_location_quantities_location_id_storage_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."storage_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_parent_id_storage_locations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."storage_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_groups" ADD CONSTRAINT "task_groups_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_groups" ADD CONSTRAINT "task_groups_parent_id_task_groups_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."task_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_overrides" ADD CONSTRAINT "task_overrides_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_overrides" ADD CONSTRAINT "task_overrides_task_template_id_task_templates_id_fk" FOREIGN KEY ("task_template_id") REFERENCES "public"."task_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_overrides" ADD CONSTRAINT "task_overrides_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_overrides" ADD CONSTRAINT "task_overrides_category_id_asset_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."asset_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_documents_asset_id_idx" ON "asset_documents" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_documents_document_type_idx" ON "asset_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "asset_documents_expiry_date_idx" ON "asset_documents" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "asset_documents_created_at_idx" ON "asset_documents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "inventory_count_items_session_id_idx" ON "inventory_count_items" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "inventory_count_items_part_id_idx" ON "inventory_count_items" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "inventory_count_items_status_idx" ON "inventory_count_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inventory_count_sessions_organisation_id_idx" ON "inventory_count_sessions" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "inventory_count_sessions_status_idx" ON "inventory_count_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inventory_count_sessions_started_at_idx" ON "inventory_count_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "inventory_transfers_organisation_id_idx" ON "inventory_transfers" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "inventory_transfers_part_id_idx" ON "inventory_transfers" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "inventory_transfers_from_location_id_idx" ON "inventory_transfers" USING btree ("from_location_id");--> statement-breakpoint
CREATE INDEX "inventory_transfers_to_location_id_idx" ON "inventory_transfers" USING btree ("to_location_id");--> statement-breakpoint
CREATE INDEX "inventory_transfers_transferred_by_id_idx" ON "inventory_transfers" USING btree ("transferred_by_id");--> statement-breakpoint
CREATE INDEX "inventory_transfers_created_at_idx" ON "inventory_transfers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "part_location_quantities_organisation_id_idx" ON "part_location_quantities" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "part_location_quantities_part_id_idx" ON "part_location_quantities" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "part_location_quantities_location_id_idx" ON "part_location_quantities" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "storage_locations_organisation_id_idx" ON "storage_locations" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "storage_locations_parent_id_idx" ON "storage_locations" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "storage_locations_code_idx" ON "storage_locations" USING btree ("code");--> statement-breakpoint
CREATE INDEX "task_groups_organisation_id_idx" ON "task_groups" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "task_groups_parent_id_idx" ON "task_groups" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "task_groups_sort_order_idx" ON "task_groups" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "task_overrides_organisation_id_idx" ON "task_overrides" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "task_overrides_task_template_id_idx" ON "task_overrides" USING btree ("task_template_id");--> statement-breakpoint
CREATE INDEX "task_overrides_asset_id_idx" ON "task_overrides" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "task_overrides_category_id_idx" ON "task_overrides" USING btree ("category_id");--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_group_id_task_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."task_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_parts" ADD CONSTRAINT "work_order_parts_source_location_id_storage_locations_id_fk" FOREIGN KEY ("source_location_id") REFERENCES "public"."storage_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_templates_group_id_idx" ON "task_templates" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "work_order_parts_source_location_id_idx" ON "work_order_parts" USING btree ("source_location_id");