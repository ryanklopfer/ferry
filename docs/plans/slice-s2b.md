# Slice S2b — Envelope encryption, ephemeral keys, column classification

Branch: `slice/s2b-envelope-encryption`. Scope and acceptance: `docs/sprint-tasks.md` → S2b. Design: architecture §6 "Encryption and keys".

## Steps

1. Tests first (red):
   - `crypto/seal.test.ts`: round trip; one flipped byte (iv, ciphertext or tag) fails to open; two seals of one plaintext differ; a wrong key fails.
   - `crypto/kms.contract.test.ts`, `crypto/dynamodb.contract.test.ts`: one KeyProvider contract and one EphemeralKeyStore contract, each run against the local implementation and the AWS one over a mocked client (encryption context bound to the tenant; PITR off and TTL on checked).
   - `db/columns.test.ts`: the classifier over synthetic rows proves a missing, doubly listed or stale entry fails; then it runs on ferry_test. The four free-text MVP columns are classified. Every SEALED column holds `v1.` values after a write.
   - `db/raw-dump.test.ts`: seeds the isolation world with distinctive synthetic names; `rawDump()` has no client name, email, member ID, diagnosis code or Tax ID, and no ephemeral key or unwrapped tenant key.
   - `db/blind-index.test.ts`: `plansRepo.idsByMemberId` and `clientsRepo.idsByEmail` find rows with `open` never called; another tenant's lookup finds nothing.
   - `db/tenant-key.test.ts`: `clientCtxFor(U, A1)` reads A1's plan in plaintext; Y's keyring cannot open the stored value.
   - `crypto/shred.test.ts`: on `test_only.transcripts_probe` (its own schema, created in the test): back up a sealed row, destroy its key, restore the copy, it cannot be opened. `openEphemeral` returns null after `expires_at` while the key still exists.
   - `boot.test.ts`: `local` keys and ephemeral keys refused by boot outside dev; the local providers refuse to construct outside dev.
   - `core/tenancy/retention.test.ts`: the 29/30-day table.
2. `src/core/tenancy/retention.ts`: `canDestroyTenantKey`.
3. `src/server/crypto/`: `aead.ts` (`seal`/`open`, `v1.<keyId>.<iv>.<ct>.<tag>`), `blind.ts`, `key-provider.ts` (local, aws-kms over `KmsApi`), `ephemeral.ts` (local directory, dynamodb over `DynamoApi`, `sealEphemeral`/`openEphemeral`), `tenant-keys.ts` (`keyringFor(ctx)`), `index.ts` (factories chosen by `modeFor`; `fixture` means local, `live`/`test` need the SDK client from S21a).
4. Schema: `tenant_keys`; sealed columns become `text`; `clients.email_bidx`, `phone_bidx`; `plans.member_id_bidx`; `claims.billing_provider_tax_id_last4`; `providers.tax_id_last4`. Forward migration `0001`.
5. `src/server/db/columns.ts` (SEALED, EPHEMERAL, PLAINTEXT_OK with reasons, BLIND_INDEXES, SEALED_DEFAULTS, AUTH_TABLES) and `src/server/db/codec.ts` (`encodeRow`, `decodeRow`, `blindFor`), used by every repo that touches a sealed column.
6. Repos: clients, plans, providers, claims, events, follow-ups encode on write and decode on read; lookups by blind index.
7. `db/testing.ts`: `rawDump()`, `decryptedDump(tenantId)`. `demo:seed` writes through the codec (and re-seals existing demo rows). `bun run keys:dev`.
8. `.env.example`, architecture note, tick S2b; `bun run test`, `typecheck`, `lint`; one commit.
