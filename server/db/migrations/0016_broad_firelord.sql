CREATE TYPE "public"."certification_enforcement" AS ENUM('block', 'warn');--> statement-breakpoint
CREATE TABLE "operator_certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"certification_name" varchar(100) NOT NULL,
	"certification_number" varchar(100),
	"issuer" varchar(255),
	"issued_date" timestamp with time zone,
	"expiry_date" timestamp with time zone,
	"document_url" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_categories" ADD COLUMN "required_certifications" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "certification_enforcement" "certification_enforcement" DEFAULT 'warn' NOT NULL;--> statement-breakpoint
ALTER TABLE "operator_certifications" ADD CONSTRAINT "operator_certifications_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_certifications" ADD CONSTRAINT "operator_certifications_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operator_certifications_organisation_id_idx" ON "operator_certifications" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "operator_certifications_operator_id_idx" ON "operator_certifications" USING btree ("operator_id");--> statement-breakpoint
CREATE INDEX "operator_certifications_expiry_date_idx" ON "operator_certifications" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "operator_certifications_org_active_idx" ON "operator_certifications" USING btree ("organisation_id","is_active");