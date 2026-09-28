CREATE TABLE "tenant_keys" (
	"key_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kek_ref" text NOT NULL,
	"wrapped_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_keys_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "claims" ALTER COLUMN "diagnosis_codes" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "claims" ALTER COLUMN "diagnosis_codes" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "dob" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "subscriber_dob" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "patient_dob" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "patient_relationship" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "billing_provider_tax_id_last4" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "email_bidx" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "phone_bidx" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "member_id_bidx" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "tax_id_last4" text;--> statement-breakpoint
ALTER TABLE "tenant_keys" ADD CONSTRAINT "tenant_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_email_bidx_idx" ON "clients" USING btree ("user_id","email_bidx");--> statement-breakpoint
CREATE INDEX "clients_phone_bidx_idx" ON "clients" USING btree ("user_id","phone_bidx");--> statement-breakpoint
CREATE INDEX "plans_member_id_bidx_idx" ON "plans" USING btree ("user_id","member_id_bidx");