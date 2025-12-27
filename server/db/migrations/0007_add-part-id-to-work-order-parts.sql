ALTER TABLE "work_order_parts" ADD COLUMN "part_id" uuid;--> statement-breakpoint
ALTER TABLE "work_order_parts" ADD CONSTRAINT "work_order_parts_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_order_parts_part_id_idx" ON "work_order_parts" USING btree ("part_id");