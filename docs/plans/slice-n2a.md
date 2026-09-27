# Slice N2a — Access model: contexts, roles, guards and staff:grant

Branch: `slice/n2a-access-model`. Scope and acceptance: `docs/sprint-tasks.md` → N2a.

## Steps

1. Tests first: `src/server/auth/ctx.test.ts` (type-level refusals for every `claimsRepo` method, scope narrowing, `requireClinician`/`requireClient`/`requireStaff` by role), `auth.test.ts` (pending default, role injection ignored, unknown role denied), `scripts/ops/staff-grant.test.ts`, new `boundaries.test.ts` cases.
2. `src/server/auth/ctx.ts`: `Role = pending | clinician | client | staff`; `ClinicianCtx`, `SelfCtx`, `ClientCtx`, `InviteCtx` (type only), `SystemCtx`, `StaffCtx` discriminated on `scope`; `Ctx` and `ClinicianOnlyCtx`. Session helpers: `sessionFromHeaders` (unknown role → null), `roleCtxFromHeaders(h, role)`, `getSessionUser`, `getClinician`, `requireSignedIn`, `requireClinician`, `requireClient`, `requireStaff` (no session → /sign-in; wrong role → 404).
3. `src/server/auth/system-ctx.ts`: `systemCtx(tenantId, job)`. No `ClientCtx` or `InviteCtx` constructor yet (N4, N7a).
4. `src/server/services/roles.ts`: `setRoleOnServer(userId, role)` (compare-and-set from pending, via `repos/users.ts`) and `grantStaff(email)` (email → id in `repos/resolvers.ts`; refuses an unknown email and a clinician or client, since one role per user). `scripts/ops/staff-grant.ts` + `bun run staff:grant <email>`. Lint (`ferry/privileged-imports`) limits who may import them.
5. Better Auth `role` default `pending` (`input: false` kept); regenerate `auth-schema.ts`; `db:generate` migration that also moves old `patient`/`provider` rows to `pending`.
6. `createTestUser(role, email?)` in `src/server/db/testing.ts`; existing tests move to `createTestUser('clinician')`.
7. Every repo and service types ctx as `ClinicianOnlyCtx`. MVP pages, actions and routes use `requireClinician()` / `getClinician()`; the sign-in page, `/home` and the e2e fixtures use the role-agnostic session helpers. `guards.test.ts` accepts the new guards (N2b makes them per-area).
8. ESLint: `ferry/ctx-constructors` — `systemCtx` only in src/server/jobs/**, src/server/relay/**, src/app/api/webhooks/**, src/server/services/ops.ts (and its own module); `inviteCtx` only in src/server/services/invites.ts. A plugin rule rather than `no-restricted-imports`, which each layer already sets and a second config object would silently replace.
9. `bun run test`, `typecheck`, `lint`; tick N2a in `docs/sprint-tasks.md`; one commit.
