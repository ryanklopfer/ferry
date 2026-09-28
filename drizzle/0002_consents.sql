CREATE TABLE "client_consents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"client_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"doc_type" text NOT NULL,
	"signer_relationship" text NOT NULL,
	"version" text NOT NULL,
	"content_hash" text NOT NULL,
	"typed_name" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone,
	CONSTRAINT "client_consents_doc_type" CHECK ("client_consents"."doc_type" in ('client_filing', 'client_recording')),
	CONSTRAINT "client_consents_signer" CHECK ("client_consents"."signer_relationship" in ('self', 'parent_guardian', 'legal_representative'))
);
--> statement-breakpoint
CREATE TABLE "clinician_consents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"doc_type" text NOT NULL,
	"version" text NOT NULL,
	"content_hash" text NOT NULL,
	"typed_name" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone,
	CONSTRAINT "clinician_consents_doc_type" CHECK ("clinician_consents"."doc_type" in ('terms', 'privacy', 'baa', 'npi_filing_authorization'))
);
--> statement-breakpoint
ALTER TABLE "client_consents" ADD CONSTRAINT "client_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_consents" ADD CONSTRAINT "client_consents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_consents" ADD CONSTRAINT "client_consents_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinician_consents" ADD CONSTRAINT "clinician_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_consents_client_idx" ON "client_consents" USING btree ("user_id","client_id","doc_type");--> statement-breakpoint
CREATE INDEX "clinician_consents_user_idx" ON "clinician_consents" USING btree ("user_id","doc_type");