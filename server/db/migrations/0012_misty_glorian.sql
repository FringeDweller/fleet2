CREATE TABLE "asset_location_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"location_name" varchar(255),
	"location_address" text,
	"updated_by_id" uuid,
	"notes" text,
	"source" varchar(50) DEFAULT 'manual',
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "location_name" varchar(255);--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "location_address" text;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "last_location_update" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "asset_location_history" ADD CONSTRAINT "asset_location_history_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_location_history" ADD CONSTRAINT "asset_location_history_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_location_history_asset_id_idx" ON "asset_location_history" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_location_history_recorded_at_idx" ON "asset_location_history" USING btree ("recorded_at");