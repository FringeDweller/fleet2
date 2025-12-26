CREATE TYPE "public"."schedule_interval_type" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'annually', 'custom');--> statement-breakpoint
CREATE TABLE "maintenance_schedule_work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"work_order_id" uuid NOT NULL,
	"scheduled_date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"asset_id" uuid,
	"category_id" uuid,
	"template_id" uuid,
	"interval_type" "schedule_interval_type" NOT NULL,
	"interval_value" integer DEFAULT 1 NOT NULL,
	"day_of_week" integer,
	"day_of_month" integer,
	"month_of_year" integer,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"last_generated_at" timestamp with time zone,
	"next_due_date" timestamp with time zone,
	"lead_time_days" integer DEFAULT 7 NOT NULL,
	"default_priority" varchar(20) DEFAULT 'medium',
	"default_assignee_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "maintenance_schedule_work_orders" ADD CONSTRAINT "maintenance_schedule_work_orders_schedule_id_maintenance_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."maintenance_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedule_work_orders" ADD CONSTRAINT "maintenance_schedule_work_orders_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_category_id_asset_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."asset_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_template_id_task_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."task_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_default_assignee_id_users_id_fk" FOREIGN KEY ("default_assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "maintenance_schedule_wo_schedule_id_idx" ON "maintenance_schedule_work_orders" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "maintenance_schedule_wo_work_order_id_idx" ON "maintenance_schedule_work_orders" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "maintenance_schedules_organisation_id_idx" ON "maintenance_schedules" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "maintenance_schedules_asset_id_idx" ON "maintenance_schedules" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "maintenance_schedules_category_id_idx" ON "maintenance_schedules" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "maintenance_schedules_next_due_date_idx" ON "maintenance_schedules" USING btree ("next_due_date");--> statement-breakpoint
CREATE INDEX "maintenance_schedules_is_active_idx" ON "maintenance_schedules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "maintenance_schedules_is_archived_idx" ON "maintenance_schedules" USING btree ("is_archived");