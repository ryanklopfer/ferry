CREATE TABLE `claims` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plan_id` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`provider_name` text,
	`provider_npi` text,
	`provider_tax_id` text,
	`provider_address` text,
	`provider_phone` text,
	`service_date_start` text,
	`service_date_end` text,
	`place_of_service` text DEFAULT '11',
	`diagnosis_codes` text DEFAULT '[]' NOT NULL,
	`total_charged` integer DEFAULT 0 NOT NULL,
	`total_paid` integer DEFAULT 0 NOT NULL,
	`superbill_path` text,
	`superbill_mime` text,
	`extraction_notes` text,
	`submitted_at` integer,
	`submission_channel` text,
	`confirmation_number` text,
	`decision_at` integer,
	`denial_reason` text,
	`info_requested` text,
	`amount_reimbursed` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`claim_id` integer NOT NULL,
	`type` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`claim_id`) REFERENCES `claims`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `follow_ups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`claim_id` integer NOT NULL,
	`type` text NOT NULL,
	`due_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`draft_subject` text,
	`draft_body` text,
	`sent_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`claim_id`) REFERENCES `claims`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `line_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`claim_id` integer NOT NULL,
	`service_date` text,
	`cpt_code` text NOT NULL,
	`modifier` text,
	`description` text,
	`units` integer DEFAULT 1 NOT NULL,
	`charge` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`claim_id`) REFERENCES `claims`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`insurer_name` text NOT NULL,
	`plan_name` text,
	`member_id` text NOT NULL,
	`group_number` text,
	`subscriber_name` text NOT NULL,
	`subscriber_dob` text,
	`patient_name` text NOT NULL,
	`patient_dob` text,
	`patient_relationship` text DEFAULT 'self' NOT NULL,
	`patient_address` text,
	`patient_phone` text,
	`patient_email` text,
	`claims_address` text,
	`claims_fax` text,
	`claims_phone` text,
	`portal_url` text,
	`preferred_channel` text DEFAULT 'portal' NOT NULL,
	`timely_filing_days` integer DEFAULT 180 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
