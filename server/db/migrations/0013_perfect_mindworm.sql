CREATE TYPE "public"."defect_severity" AS ENUM('minor', 'major', 'critical');--> statement-breakpoint
CREATE TYPE "public"."defect_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TABLE "defects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"inspection_id" uuid,
	"work_order_id" uuid,
	"reported_by_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"severity" "defect_severity" DEFAULT 'minor' NOT NULL,
	"status" "defect_status" DEFAULT 'open' NOT NULL,
	"location" varchar(255),
	"photos" text,
	"resolved_by_id" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_notes" text,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_reported_by_id_users_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "defects_organisation_id_idx" ON "defects" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "defects_asset_id_idx" ON "defects" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "defects_work_order_id_idx" ON "defects" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "defects_status_idx" ON "defects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "defects_severity_idx" ON "defects" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "defects_reported_at_idx" ON "defects" USING btree ("reported_at");