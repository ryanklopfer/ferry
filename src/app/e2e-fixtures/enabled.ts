import { deployTier } from "@/server/deploy";

// Pages under /e2e-fixtures exist only for e2e/scrub.spec.ts: dev tier, and only when the spec turns them on.
export const E2E_FIXTURES_ON = () => process.env.FERRY_E2E_FIXTURES === "1" && deployTier() === "dev";

// Stands in for PHI in an error message. The spec greps the server output for it.
export const SCRUB_MARKER = "Scrub-Marker-Samira-Haddad-U4827193";
