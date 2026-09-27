ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'pending';--> statement-breakpoint
UPDATE "users" SET "role" = 'pending' WHERE "role" IN ('patient', 'provider');
