CREATE TYPE "public"."part_unit" AS ENUM('each', 'liters', 'gallons', 'kg', 'lbs', 'meters', 'feet', 'box', 'set', 'pair');--> statement-breakpoint
CREATE TYPE "public"."part_usage_type" AS ENUM('work_order', 'adjustment', 'restock', 'return', 'damaged', 'expired');--> statement-breakpoint
CREATE TABLE "part_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"category_id" uuid,
	"sku" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"unit" "part_unit" DEFAULT 'each' NOT NULL,
	"quantity_in_stock" numeric(12, 2) DEFAULT '0' NOT NULL,
	"minimum_stock" numeric(12, 2) DEFAULT '0',
	"reorder_threshold" numeric(12, 2),
	"reorder_quantity" numeric(12, 2),
	"unit_cost" numeric(12, 2),
	"supplier" varchar(200),
	"supplier_part_number" varchar(100),
	"location" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "part_usage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"part_id" uuid NOT NULL,
	"work_order_id" uuid,
	"usage_type" "part_usage_type" NOT NULL,
	"quantity_change" numeric(12, 2) NOT NULL,
	"previous_quantity" numeric(12, 2) NOT NULL,
	"new_quantity" numeric(12, 2) NOT NULL,
	"unit_cost_at_time" numeric(12, 2),
	"notes" text,
	"reference" varchar(200),
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "part_categories" ADD CONSTRAINT "part_categories_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_category_id_part_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."part_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_usage_history" ADD CONSTRAINT "part_usage_history_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_usage_history" ADD CONSTRAINT "part_usage_history_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_usage_history" ADD CONSTRAINT "part_usage_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "part_categories_organisation_id_idx" ON "part_categories" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "part_categories_parent_id_idx" ON "part_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "parts_organisation_id_idx" ON "parts" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "parts_category_id_idx" ON "parts" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "parts_sku_idx" ON "parts" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "part_usage_history_part_id_idx" ON "part_usage_history" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "part_usage_history_work_order_id_idx" ON "part_usage_history" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "part_usage_history_created_at_idx" ON "part_usage_history" USING btree ("created_at");