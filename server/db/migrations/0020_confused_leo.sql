CREATE TYPE "public"."form_assignment_target_type" AS ENUM('asset', 'work_order', 'inspection', 'operator');--> statement-breakpoint
CREATE TYPE "public"."form_submission_status" AS ENUM('draft', 'submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "custom_form_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"target_type" "form_assignment_target_type" NOT NULL,
	"category_filter_id" uuid,
	"is_required" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	CONSTRAINT "custom_form_assignments_unique_assignment" UNIQUE("organisation_id","form_id","target_type","category_filter_id")
);
--> statement-breakpoint
CREATE TABLE "custom_form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"responses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "form_submission_status" DEFAULT 'submitted' NOT NULL,
	"submitter_notes" text,
	"review_notes" text,
	"context_type" text,
	"context_id" uuid,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_by_id" uuid,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_form_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"fields" jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"changelog" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operation_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"defect_id" uuid NOT NULL,
	"blocking_severity" varchar(20) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"blocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_id" uuid,
	"overridden_at" timestamp with time zone,
	"overridden_by_id" uuid,
	"override_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "block_vehicle_on_critical_defect" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "blocking_defect_severities" text DEFAULT '["critical"]' NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_form_assignments" ADD CONSTRAINT "custom_form_assignments_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_form_assignments" ADD CONSTRAINT "custom_form_assignments_form_id_custom_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."custom_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_form_assignments" ADD CONSTRAINT "custom_form_assignments_category_filter_id_asset_categories_id_fk" FOREIGN KEY ("category_filter_id") REFERENCES "public"."asset_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_form_assignments" ADD CONSTRAINT "custom_form_assignments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_form_submissions" ADD CONSTRAINT "custom_form_submissions_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_form_submissions" ADD CONSTRAINT "custom_form_submissions_form_id_custom_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."custom_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_form_submissions" ADD CONSTRAINT "custom_form_submissions_version_id_custom_form_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."custom_form_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_form_submissions" ADD CONSTRAINT "custom_form_submissions_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_form_submissions" ADD CONSTRAINT "custom_form_submissions_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_form_versions" ADD CONSTRAINT "custom_form_versions_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_form_versions" ADD CONSTRAINT "custom_form_versions_form_id_custom_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."custom_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_form_versions" ADD CONSTRAINT "custom_form_versions_published_by_id_users_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_blocks" ADD CONSTRAINT "operation_blocks_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_blocks" ADD CONSTRAINT "operation_blocks_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_blocks" ADD CONSTRAINT "operation_blocks_defect_id_defects_id_fk" FOREIGN KEY ("defect_id") REFERENCES "public"."defects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_blocks" ADD CONSTRAINT "operation_blocks_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_blocks" ADD CONSTRAINT "operation_blocks_overridden_by_id_users_id_fk" FOREIGN KEY ("overridden_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_form_assignments_organisation_id_idx" ON "custom_form_assignments" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "custom_form_assignments_form_id_idx" ON "custom_form_assignments" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "custom_form_assignments_target_type_idx" ON "custom_form_assignments" USING btree ("target_type");--> statement-breakpoint
CREATE INDEX "custom_form_assignments_category_filter_id_idx" ON "custom_form_assignments" USING btree ("category_filter_id");--> statement-breakpoint
CREATE INDEX "custom_form_assignments_position_idx" ON "custom_form_assignments" USING btree ("position");--> statement-breakpoint
CREATE INDEX "custom_form_submissions_organisation_id_idx" ON "custom_form_submissions" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "custom_form_submissions_form_id_idx" ON "custom_form_submissions" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "custom_form_submissions_version_id_idx" ON "custom_form_submissions" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "custom_form_submissions_status_idx" ON "custom_form_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "custom_form_submissions_submitted_at_idx" ON "custom_form_submissions" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "custom_form_submissions_context_idx" ON "custom_form_submissions" USING btree ("context_type","context_id");--> statement-breakpoint
CREATE INDEX "custom_form_submissions_submitted_by_idx" ON "custom_form_submissions" USING btree ("submitted_by_id");--> statement-breakpoint
CREATE INDEX "custom_form_versions_organisation_id_idx" ON "custom_form_versions" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "custom_form_versions_form_id_idx" ON "custom_form_versions" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "custom_form_versions_form_version_idx" ON "custom_form_versions" USING btree ("form_id","version");--> statement-breakpoint
CREATE INDEX "custom_form_versions_published_at_idx" ON "custom_form_versions" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "operation_blocks_organisation_id_idx" ON "operation_blocks" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "operation_blocks_asset_id_idx" ON "operation_blocks" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "operation_blocks_defect_id_idx" ON "operation_blocks" USING btree ("defect_id");--> statement-breakpoint
CREATE INDEX "operation_blocks_is_active_idx" ON "operation_blocks" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "operation_blocks_blocked_at_idx" ON "operation_blocks" USING btree ("blocked_at");