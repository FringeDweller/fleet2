CREATE TABLE "task_template_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"quantity" numeric(12, 2) DEFAULT '1' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_template_parts" ADD CONSTRAINT "task_template_parts_template_id_task_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."task_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_template_parts" ADD CONSTRAINT "task_template_parts_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_template_parts_template_id_idx" ON "task_template_parts" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "task_template_parts_part_id_idx" ON "task_template_parts" USING btree ("part_id");