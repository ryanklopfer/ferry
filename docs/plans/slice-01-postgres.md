# Slice 1 — SQLite → Postgres Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the existing MVP on Postgres 17 through Drizzle with no behavior change, so every later slice builds on the production database engine.

**Architecture:** Engine swap only. The same five tables keep integer ids and epoch-second columns; the data model is reworked in S2. The database module moves to `src/server/db/` (its home per `docs/architecture.md` §3). Migrations become an explicit command instead of the MVP's migrate-on-first-query `ready()`.

**Tech Stack:** Postgres 17 (Homebrew), `pg` (node-postgres), `drizzle-orm/node-postgres`, drizzle-kit, vitest.

## Global Constraints

- Package manager is bun: `bun add`, `bun run`, `bunx`. bun is at `/opt/homebrew/bin`; run `export PATH="/opt/homebrew/bin:$PATH"` first in a non-login shell.
- No behavior change: the 7 tests in `src/lib/followups.test.ts` must pass untouched.
- Synthetic data only. Never put a real superbill or real member data in either database.
- `resetDb()` must refuse to run against any database whose name does not end in `_test`.
- Do not start the S2 work (string ids, `user_id`, `timestamptz`, new tables). If something here seems to need it, stop and say so.
- One local commit at the end. Never push.
- Code style: no comments unless the logic is non-obvious; no docstrings; match the surrounding code.

## Prerequisite (founder, F10)

Postgres 17 must be running with two empty databases. Homebrew's `postgresql@17` is keg-only, so its binaries are not on PATH.

```bash
brew install postgresql@17 && brew services start postgresql@17
```

```bash
/opt/homebrew/opt/postgresql@17/bin/createdb ferry_dev && /opt/homebrew/opt/postgresql@17/bin/createdb ferry_test
```

Verify before starting:

```bash
/opt/homebrew/opt/postgresql@17/bin/psql -d ferry_test -c "select version()"
```

Expected: one row starting `PostgreSQL 17`. If this fails, stop; the slice cannot proceed.

## File Structure

| File | Responsibility |
|---|---|
| `src/server/db/env.ts` (create) | Resolve the connection string: test database under vitest, `DATABASE_URL` otherwise |
| `src/server/db/schema.ts` (create, replaces `src/db/schema.ts`) | The five tables in `pg-core` |
| `src/server/db/index.ts` (create, replaces `src/db/index.ts`) | One shared `Pool`, the `db` handle, `schema` re-export |
| `src/server/db/migrate.ts` (create) | `migrateDb(url)` used by the CLI script and the test setup |
| `src/server/db/testing.ts` (create) | `resetDb()` with the `_test` guard |
| `src/server/db/roundtrip.test.ts` (create) | Proves inserts, JSON column, defaults, cascade, idempotent migration |
| `scripts/db/migrate.ts` (create) | `bun run db:migrate` entry point |
| `vitest.global-setup.ts` (create) | Migrates `ferry_test` once per test run with a clear error if Postgres is down |
| `drizzle.config.ts`, `vitest.config.mts`, `package.json`, `.env.example`, `README.md` (modify) | Config and docs |
| `src/app/actions.ts`, `src/lib/service.ts` (modify) | Drop `ready()`; create the uploads folder where files are written |
| `src/db/`, `drizzle/` SQLite migrations (delete) | Replaced |

---

### Task 1: Postgres connection, migration runner, and a failing round-trip test

**Files:**
- Create: `src/server/db/env.ts`, `src/server/db/migrate.ts`, `src/server/db/testing.ts`, `src/server/db/roundtrip.test.ts`, `scripts/db/migrate.ts`, `vitest.global-setup.ts`
- Modify: `package.json`, `vitest.config.mts`, `.env.example`

**Interfaces:**
- Consumes: nothing.
- Produces: `databaseUrl(): string`; `migrateDb(url: string): Promise<void>`; `resetDb(): Promise<void>`; scripts `db:migrate`, `db:migrate:test`.

- [x] **Step 1: Swap the driver dependency**

```bash
export PATH="/opt/homebrew/bin:$PATH"
bun remove @libsql/client
bun add pg
bun add -d @types/pg
```

Expected: `package.json` no longer lists `@libsql/client`; `pg` is under dependencies.

- [x] **Step 2: Write the failing test**

Create `src/server/db/roundtrip.test.ts`:

```ts
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, pool, schema } from "@/server/db";
import { databaseUrl } from "@/server/db/env";
import { migrateDb } from "@/server/db/migrate";
import { resetDb } from "@/server/db/testing";

const { plans, claims, lineItems } = schema;

const planValues = { insurerName: "Cigna", memberId: "U1", subscriberName: "Jordan Ellis", patientName: "Jordan Ellis" };

describe("postgres round trip", () => {
  beforeEach(resetDb);
  afterAll(() => pool.end());

  it("applies column defaults on insert", async () => {
    const [plan] = await db.insert(plans).values(planValues).returning();
    expect(plan.id).toBeGreaterThan(0);
    expect(plan.timelyFilingDays).toBe(180);
    expect(plan.preferredChannel).toBe("portal");
    expect(plan.createdAt).toBeGreaterThan(1_700_000_000);
  });

  it("stores diagnosis codes as JSON and reads them back as an array", async () => {
    const [plan] = await db.insert(plans).values(planValues).returning();
    const [claim] = await db.insert(claims).values({ planId: plan.id, diagnosisCodes: ["F41.1", "F33.1"], totalCharged: 22500 }).returning();
    expect(claim.status).toBe("draft");
    const found = await db.query.claims.findFirst({ where: eq(claims.id, claim.id) });
    expect(found?.diagnosisCodes).toEqual(["F41.1", "F33.1"]);
  });

  it("deletes line items when their claim is deleted", async () => {
    const [plan] = await db.insert(plans).values(planValues).returning();
    const [claim] = await db.insert(claims).values({ planId: plan.id }).returning();
    await db.insert(lineItems).values({ claimId: claim.id, cptCode: "90837", charge: 22500 });
    await db.delete(claims).where(eq(claims.id, claim.id));
    expect(await db.select().from(lineItems)).toHaveLength(0);
  });

  it("restarts ids after resetDb", async () => {
    const [first] = await db.insert(plans).values(planValues).returning();
    await resetDb();
    const [second] = await db.insert(plans).values(planValues).returning();
    expect(second.id).toBe(first.id);
  });

  it("can be migrated a second time without error", async () => {
    await expect(migrateDb(databaseUrl())).resolves.toBeUndefined();
  });
});
```

- [x] **Step 3: Run it and confirm it fails for the right reason**

Run: `bun run test`
Expected: FAIL in `src/server/db/roundtrip.test.ts` with `Cannot find module '@/server/db'` (or `'@/server/db/env'`). The other 66 tests pass.

- [x] **Step 4: Connection string resolution**

Create `src/server/db/env.ts`:

```ts
const TEST_DEFAULT = "postgres://localhost:5432/ferry_test";

export function databaseUrl(): string {
  if (process.env.VITEST) return process.env.DATABASE_URL_TEST ?? TEST_DEFAULT;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  return url;
}
```

- [x] **Step 5: Migration runner**

Create `src/server/db/migrate.ts`:

```ts
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

export async function migrateDb(url: string): Promise<void> {
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  } finally {
    await pool.end();
  }
}
```

Create `scripts/db/migrate.ts`:

```ts
import { migrateDb } from "../../src/server/db/migrate";

const test = process.argv.includes("--test");
const url = test ? (process.env.DATABASE_URL_TEST ?? "postgres://localhost:5432/ferry_test") : process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  process.exit(1);
}
await migrateDb(url);
console.log(`migrated ${new URL(url).pathname.slice(1)}`);
```

- [x] **Step 6: Test reset helper with the safety guard**

Create `src/server/db/testing.ts`:

```ts
import { pool } from "./index";

export async function resetDb(): Promise<void> {
  const { rows } = await pool.query<{ name: string }>("select current_database() as name");
  if (!rows[0].name.endsWith("_test")) throw new Error(`resetDb refused: "${rows[0].name}" is not a test database`);
  await pool.query("TRUNCATE plans, claims, line_items, follow_ups, events RESTART IDENTITY CASCADE");
}
```

- [x] **Step 7: Migrate the test database once per test run**

Create `vitest.global-setup.ts`:

```ts
import { migrateDb } from "./src/server/db/migrate";

export default async function setup() {
  const url = process.env.DATABASE_URL_TEST ?? "postgres://localhost:5432/ferry_test";
  try {
    await migrateDb(url);
  } catch (e) {
    throw new Error(
      `Could not migrate the test database at ${url}. Is Postgres running? ` +
        `Start it with: brew services start postgresql@17, then create it with: ` +
        `/opt/homebrew/opt/postgresql@17/bin/createdb ferry_test\n${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
```

Replace `vitest.config.mts` with:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    globalSetup: "./vitest.global-setup.ts",
    fileParallelism: false,
  },
});
```

`fileParallelism: false` because every database test shares `ferry_test`; the suite is small enough that serial files cost nothing.

- [x] **Step 8: Scripts and env example**

In `package.json` scripts, add after `db:generate`:

```json
"db:migrate": "bun scripts/db/migrate.ts",
"db:migrate:test": "bun scripts/db/migrate.ts --test",
```

Append to `.env.example`:

```
# Postgres. Homebrew's postgresql@17 accepts your macOS user with no password on localhost.
DATABASE_URL=postgres://localhost:5432/ferry_dev
# Optional; tests default to this value.
# DATABASE_URL_TEST=postgres://localhost:5432/ferry_test
```

Do not commit yet: the test still fails until Task 2 provides `@/server/db` and the migration.

---

### Task 2: Port the schema, generate the Postgres migration, move the module

**Files:**
- Create: `src/server/db/schema.ts`, `src/server/db/index.ts`, `drizzle/0000_*.sql` (generated)
- Modify: `drizzle.config.ts`, every file importing `@/db` or `@/db/schema`
- Delete: `src/db/index.ts`, `src/db/schema.ts`, `drizzle/0000_conscious_rattler.sql`, `drizzle/meta/`

**Interfaces:**
- Consumes: `databaseUrl()` from Task 1.
- Produces: `db`, `pool`, `schema` from `@/server/db`; the types `Plan`, `Claim`, `LineItem`, `FollowUp`, `Event`, `ClaimStatus`, `FollowUpType` and the constants `CLAIM_STATUSES`, `FOLLOW_UP_TYPES` from `@/server/db/schema`, with the same names and shapes as today.

- [x] **Step 1: Write the Postgres schema**

Create `src/server/db/schema.ts`:

```ts
import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";

const now = () => sql`(extract(epoch from now())::integer)`;
const id = () => integer("id").primaryKey().generatedAlwaysAsIdentity();

export const plans = pgTable("plans", {
  id: id(),
  insurerName: text("insurer_name").notNull(),
  planName: text("plan_name"),
  memberId: text("member_id").notNull(),
  groupNumber: text("group_number"),
  subscriberName: text("subscriber_name").notNull(),
  subscriberDob: text("subscriber_dob"),
  patientName: text("patient_name").notNull(),
  patientDob: text("patient_dob"),
  patientRelationship: text("patient_relationship").notNull().default("self"),
  patientAddress: text("patient_address"),
  patientPhone: text("patient_phone"),
  patientEmail: text("patient_email"),
  claimsAddress: text("claims_address"),
  claimsFax: text("claims_fax"),
  claimsPhone: text("claims_phone"),
  portalUrl: text("portal_url"),
  preferredChannel: text("preferred_channel").notNull().default("portal"),
  timelyFilingDays: integer("timely_filing_days").notNull().default(180),
  createdAt: integer("created_at").notNull().default(now()),
});

export const CLAIM_STATUSES = [
  "draft",
  "submitted",
  "acknowledged",
  "info_requested",
  "denied",
  "appealed",
  "paid",
  "closed",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const claims = pgTable("claims", {
  id: id(),
  planId: integer("plan_id").notNull().references(() => plans.id),
  status: text("status").$type<ClaimStatus>().notNull().default("draft"),
  providerName: text("provider_name"),
  providerNpi: text("provider_npi"),
  providerTaxId: text("provider_tax_id"),
  providerAddress: text("provider_address"),
  providerPhone: text("provider_phone"),
  serviceDateStart: text("service_date_start"),
  serviceDateEnd: text("service_date_end"),
  placeOfService: text("place_of_service").default("11"),
  diagnosisCodes: jsonb("diagnosis_codes").$type<string[]>().notNull().default([]),
  totalCharged: integer("total_charged").notNull().default(0),
  totalPaid: integer("total_paid").notNull().default(0),
  superbillPath: text("superbill_path"),
  superbillMime: text("superbill_mime"),
  extractionNotes: text("extraction_notes"),
  submittedAt: integer("submitted_at"),
  submissionChannel: text("submission_channel"),
  confirmationNumber: text("confirmation_number"),
  decisionAt: integer("decision_at"),
  denialReason: text("denial_reason"),
  infoRequested: text("info_requested"),
  amountReimbursed: integer("amount_reimbursed"),
  createdAt: integer("created_at").notNull().default(now()),
  updatedAt: integer("updated_at").notNull().default(now()),
});

export const lineItems = pgTable("line_items", {
  id: id(),
  claimId: integer("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  serviceDate: text("service_date"),
  cptCode: text("cpt_code").notNull(),
  modifier: text("modifier"),
  description: text("description"),
  units: integer("units").notNull().default(1),
  charge: integer("charge").notNull().default(0),
});

export const FOLLOW_UP_TYPES = [
  "timely_filing_warning",
  "status_inquiry",
  "escalation",
  "regulator_escalation",
  "info_response",
  "appeal",
] as const;
export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number];

export const followUps = pgTable("follow_ups", {
  id: id(),
  claimId: integer("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  type: text("type").$type<FollowUpType>().notNull(),
  dueAt: integer("due_at").notNull(),
  status: text("status").$type<"pending" | "drafted" | "sent" | "dismissed">().notNull().default("pending"),
  draftSubject: text("draft_subject"),
  draftBody: text("draft_body"),
  sentAt: integer("sent_at"),
  createdAt: integer("created_at").notNull().default(now()),
});

export const events = pgTable("events", {
  id: id(),
  claimId: integer("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  note: text("note"),
  createdAt: integer("created_at").notNull().default(now()),
});

export type Plan = typeof plans.$inferSelect;
export type Claim = typeof claims.$inferSelect;
export type LineItem = typeof lineItems.$inferSelect;
export type FollowUp = typeof followUps.$inferSelect;
export type Event = typeof events.$inferSelect;
```

- [x] **Step 2: Write the database module**

Create `src/server/db/index.ts`:

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { databaseUrl } from "./env";
import * as schema from "./schema";

// Next's dev server re-evaluates modules on every edit; without this each reload would open a new pool.
const g = globalThis as unknown as { __ferryPool?: Pool };
export const pool = (g.__ferryPool ??= new Pool({ connectionString: databaseUrl() }));
export const db = drizzle({ client: pool, schema });

export { schema };
```

- [x] **Step 3: Point drizzle-kit at Postgres and regenerate the migration**

Replace `drizzle.config.ts` with:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://localhost:5432/ferry_dev" },
});
```

Then:

```bash
rm -rf drizzle src/db
bun run db:generate
```

Expected: a new `drizzle/0000_<name>.sql` containing `CREATE TABLE "plans"`, `GENERATED ALWAYS AS IDENTITY`, `"diagnosis_codes" jsonb DEFAULT '[]'::jsonb NOT NULL`, and `ON DELETE cascade` on the three child tables. Open the file and confirm all four.

- [x] **Step 4: Update every import of the old module**

```bash
grep -rln '"@/db' src
```

Expected files: `src/app/actions.ts`, `src/components/ui.tsx`, `src/components/follow-up-card.tsx`, `src/lib/ai.ts`, `src/lib/followups.ts`, `src/lib/followups.test.ts` (if present in the list), `src/lib/service.ts`, `src/lib/templates.ts`, plus any page the grep finds. In each, change `"@/db/schema"` to `"@/server/db/schema"` and `"@/db"` to `"@/server/db"`. Change nothing else in those lines.

Run `grep -rn '"@/db' src` afterwards. Expected: no output.

- [x] **Step 5: Remove `ready()`**

In `src/lib/service.ts`: change the import on line 2 to `import { db, schema } from "@/server/db";` and delete all five `await ready();` lines.

In `src/app/actions.ts`: change the import on line 8 to `import { db, schema } from "@/server/db";` and delete all six `await ready();` lines.

Run `grep -rn "ready()" src`. Expected: no output. (Executed 2026-09-17: a bare `ready` also matches the unrelated words "draft ready" and "already".)

- [x] **Step 6: Create the uploads folder where files are written**

The old database module created `data/uploads` as a side effect. In `src/app/actions.ts`, inside `createClaimFromUpload`, replace:

```ts
    await fs.writeFile(path.join(process.cwd(), "data", "uploads", name), bytes);
```

with:

```ts
    const dir = path.join(process.cwd(), "data", "uploads");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), bytes);
```

- [x] **Step 7: Run the tests**

Run: `bun run test`
Expected: PASS, 71 tests (66 existing + 5 round-trip). If global setup reports that Postgres is unreachable, fix the prerequisite; do not mock the database.

- [x] **Step 8: Typecheck and lint**

Run: `bun run typecheck && bun run lint`
Expected: both clean. A type error in a page usually means an id that was a `number` is now typed differently; ids are still integers in this slice, so investigate rather than cast.

---

### Task 3: Migrate the dev database, walk the app, document, commit

**Files:**
- Modify: `README.md`, `docs/sprint-tasks.md`
- Create: `.env.local` (founder's machine only, gitignored)

**Interfaces:**
- Consumes: everything from Tasks 1–2.
- Produces: a migrated `ferry_dev`, updated run instructions, the slice ticked.

- [x] **Step 1: Local env and dev migration**

```bash
cp -n .env.example .env.local
bun run db:migrate
bun run db:migrate
```

Expected: `migrated ferry_dev` both times; the second run changes nothing.

- [x] **Step 2: Walk the app in a browser**

Start `bun run dev` with the session's preview tooling and, at http://localhost:3000:

1. Insurance plans → add a plan (insurer "Cigna", member ID "U4827193 01", subscriber "Samira Haddad"). It appears in the list.
2. New claim → choose the plan → upload `corpus/synthetic/superbills/sb-02.pdf`. Without `ANTHROPIC_API_KEY` the edit form opens with an "AI extraction is off" note; type one line (2026-08-04, 90834, 175.00) and save.
3. Claim page → download the packet PDF. It opens and includes the superbill pages.
4. Mark submitted (today's date). Three follow-ups appear: status inquiry +14 days, escalation +30, regulator notice +45.
5. Delete the claim. The dashboard is empty again.

Expected: no server errors in the dev log; `data/uploads/` contains the uploaded file.

Confirm the rows landed in Postgres, not a file:

```bash
/opt/homebrew/opt/postgresql@17/bin/psql -d ferry_dev -c "select id, insurer_name from plans"
ls data/
```

Expected: the Cigna plan is listed; `data/` contains only `uploads/`, no `app.db`.

- [x] **Step 3: Update the README**

In `README.md`, replace the "Run it" code block with:

```sh
brew install postgresql@17 && brew services start postgresql@17
/opt/homebrew/opt/postgresql@17/bin/createdb ferry_dev
/opt/homebrew/opt/postgresql@17/bin/createdb ferry_test
bun install
cp .env.example .env.local   # DATABASE_URL; add ANTHROPIC_API_KEY for synthetic-only AI extraction
bun run db:migrate
bun run dev                  # http://localhost:3000
```

In the "Layout" block, replace the `src/db/` line with:

```
src/server/db/    drizzle schema + Postgres pool (migrations in ./drizzle, applied with bun run db:migrate)
```

Replace the sentence about `./data` with: "Uploaded superbills live in `./data/uploads` (gitignored). Use synthetic documents from `corpus/synthetic/` only."

In the Scripts line, add `bun run db:migrate` after `bun run db:generate`.

- [x] **Step 4: Tick the slice**

In `docs/sprint-tasks.md`, change `### [ ] S1 — SQLite → Postgres` to `### [x] S1 — SQLite → Postgres` and tick its five acceptance boxes.

- [x] **Step 5: Final check and commit**

```bash
bun run test && bun run typecheck && bun run lint
grep -rn "libsql\|sqlite" src drizzle.config.ts package.json
```

Expected: all green; the grep prints nothing.

```bash
git add -A
git commit -m "S1: move the MVP from SQLite to Postgres

Engine swap only: same five tables, integer ids, epoch-second columns.
Explicit db:migrate replaces migrate-on-first-query. Database module
moves to src/server/db.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
