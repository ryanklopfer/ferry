# Slice N4 — Tenancy data: clients, memberships, tenantWhere, resolvers

Branch: `slice/n4-tenancy-data`. Scope and acceptance: `docs/sprint-tasks.md` → N4. Access model: architecture §6 rules 3, 4, 5 and 8.

## Steps

1. Tests first (red):
   - `repos/isolation.test.ts` v2: clinicians X and Y, X's clients A1 and A2, Y's client B1, client user U bound to A1 and B1. X reads only A1/A2 rows in every repo; Y reads nothing of X's; Y's updates, deletes and attaches to X's rows change nothing. `clientCtxFor(U, A1)` reads A1's client row, plans, claims, lines and events and nothing of A2's; `clientCtxFor(U, B1)` only B1's. Clinician-only repos refuse a ClientCtx at run time.
   - `auth/client-ctx.test.ts`: forged id, revoked membership, another user's membership, archived client, mismatched `client_user_id` (and a clinician mismatch) each throw `NotOwnedError`; `GET /api/v1/memberships/[id]` answers 404 for each and 200 for the good one.
   - `repos/scope.test.ts`: `tenantWhere` rendered through the pg dialect: `id` for `clients`, `client_id` for CLIENT_SCOPED, a throw for any other table; clinician and system contexts filter `user_id` only.
   - `schema.test.ts`: `scopeViolations()` over synthetic rows proves each failure is caught, then runs on ferry_test.
   - `repos/resolvers.test.ts`: TypeScript AST over `repos/*.ts`: every exported function or repo method in a module holding the db handle takes a ctx first, except in `resolvers.ts` (and the listed auth-owned `users.ts`). Plus the PCN resolver returns ids only.
   - `services/api.test.ts`: `GET /api/v1/claims` lists only the caller's tenant; a client session gets 404.
   - `scripts/dev/demo-seed.test.ts`: two runs, identical row counts; refuses outside the dev tier.
2. Schema: `clients` (`cli_`), `client_memberships` (`mbr_`); `client_id NOT NULL` on plans, claims, claim_lines, events. `ids.ts` adds `cli`, `mbr`. Squash migrations to one file; reset ferry_dev, ferry_test (and ferry_e2e_test if present).
3. `repos/scope.ts`: `CLIENT_SCOPED`, `CLIENT_SELF`, `GLOBAL_TABLES`, `CLIENT_ID_NULLABLE`, `tenantWhere`, `assertNotClient`, `ScopeRefused`.
4. Repos: claims, plans, events (reads take `Ctx`; writes `ClinicianOnlyCtx` + `assertNotClient`); follow-ups, providers (clinician-only); `owned.ts`; new `clients.ts`, `memberships.ts` (SelfCtx); `resolvers.claimByPatientControlNumber`.
5. `auth/client-ctx.ts`: `clientCtxFor(self, membershipId)`. `getClient()` route guard in `ctx.ts`.
6. `core/api/trips.ts` `ClientSelfSchema`; `services/trips.ts` `getClientSelf`; route `GET /api/v1/memberships/[id]`.
7. Services and existing tests: `createPlan(ctx, clientId, input)`; claims take their client from the plan; ctx.test type assertions follow the read/write split.
8. `scripts/dev/demo-seed.ts` + `bun run demo:seed`.
9. `bun run test`, `typecheck`, `lint`; tick N4 in `docs/sprint-tasks.md`; one commit.
