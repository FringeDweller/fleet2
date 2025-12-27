CREATE TABLE "asset_category_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_category_parts" ADD CONSTRAINT "asset_category_parts_category_id_asset_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."asset_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_category_parts" ADD CONSTRAINT "asset_category_parts_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_parts" ADD CONSTRAINT "asset_parts_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_parts" ADD CONSTRAINT "asset_parts_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_category_parts_category_id_idx" ON "asset_category_parts" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "asset_category_parts_part_id_idx" ON "asset_category_parts" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "asset_parts_asset_id_idx" ON "asset_parts" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_parts_part_id_idx" ON "asset_parts" USING btree ("part_id");