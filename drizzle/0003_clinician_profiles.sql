ALTER TABLE "claims" DROP CONSTRAINT "claims_billing_provider_id_providers_id_fk";--> statement-breakpoint
ALTER TABLE "claims" DROP CONSTRAINT "claims_rendering_provider_id_providers_id_fk";--> statement-breakpoint
ALTER TABLE "claims" DROP COLUMN "billing_provider_id";--> statement-breakpoint
ALTER TABLE "claims" DROP COLUMN "rendering_provider_id";--> statement-breakpoint
DROP TABLE "providers";--> statement-breakpoint
CREATE TABLE "clinician_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"legal_name" text NOT NULL,
	"credential" text NOT NULL,
	"npi" text NOT NULL,
	"npi_type" text NOT NULL,
	"taxonomy_code" text NOT NULL,
	"group_name" text,
	"group_npi" text,
	"tax_id" text NOT NULL,
	"tax_id_type" text NOT NULL,
	"tax_id_bidx" text,
	"tax_id_last4" text,
	"practice_address" text NOT NULL,
	"license_state" text NOT NULL,
	"license_number" text NOT NULL,
	"default_note_format" text NOT NULL,
	"default_modality" text NOT NULL,
	"nppes_checked_at" timestamp with time zone,
	"nppes_name_match" boolean,
	"identity_verified_at" timestamp with time zone,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clinician_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "clinician_profiles_npi_type" CHECK ("clinician_profiles"."npi_type" in ('individual', 'group')),
	CONSTRAINT "clinician_profiles_tax_id_type" CHECK ("clinician_profiles"."tax_id_type" in ('EIN', 'SSN')),
	CONSTRAINT "clinician_profiles_note_format" CHECK ("clinician_profiles"."default_note_format" in ('soap', 'dap', 'birp', 'intake')),
	CONSTRAINT "clinician_profiles_modality" CHECK ("clinician_profiles"."default_modality" in ('in_person', 'telehealth')),
	CONSTRAINT "clinician_profiles_group" CHECK ("clinician_profiles"."npi_type" = 'individual' or ("clinician_profiles"."group_npi" is not null and "clinician_profiles"."group_name" is not null and "clinician_profiles"."tax_id_type" = 'EIN'))
);
--> statement-breakpoint
CREATE TABLE "fee_schedule_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"cpt_code" text NOT NULL,
	"charge_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fee_schedule_items_charge_positive" CHECK ("fee_schedule_items"."charge_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "clinician_profiles" ADD CONSTRAINT "clinician_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_schedule_items" ADD CONSTRAINT "fee_schedule_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clinician_profiles_npi_idx" ON "clinician_profiles" USING btree ("npi");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_schedule_items_user_cpt_idx" ON "fee_schedule_items" USING btree ("user_id","cpt_code");