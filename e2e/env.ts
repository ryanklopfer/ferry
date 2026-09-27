import path from "node:path";

export const E2E_DATABASE_URL = process.env.DATABASE_URL_E2E ?? "postgres://localhost:5432/ferry_e2e_test";

// Set explicitly on the servers so a FERRY_OUTBOX_DIR in .env.local can't point them somewhere the helper doesn't read.
export const E2E_OUTBOX_DIR = path.join(process.cwd(), "data", "outbox");

// The relay the suite starts beside Next, and the secrets the two share. Test-only values.
export const E2E_RELAY_PORT = 3102;
export const E2E_RELAY_SECRET = "e2e-only-relay-secret-for-synthetic-audio-00";
export const E2E_SPIKE_K = "e2e-only-spike-key-for-the-mic-spike-pages-000";

// Synthetic, dev-tier settings for every server the e2e suite starts. The secret signs e2e sessions only.
export const e2eServerEnv = (port: number): Record<string, string> => ({
  DATABASE_URL: E2E_DATABASE_URL,
  BETTER_AUTH_URL: `http://localhost:${port}`,
  BETTER_AUTH_SECRET: "e2e-only-secret-for-synthetic-sessions-0000",
  FERRY_DEPLOY_TIER: "dev",
  FERRY_DATA_CLASS: "synthetic",
  FERRY_EMAIL_MODE: "fixture",
  FERRY_OUTBOX_DIR: E2E_OUTBOX_DIR,
  ANTHROPIC_API_KEY: "",
  RELAY_SECRET: E2E_RELAY_SECRET,
  RELAY_PORT: String(E2E_RELAY_PORT),
  FERRY_RELAY_URL: `ws://localhost:${E2E_RELAY_PORT}`,
  FERRY_SPIKE_K: E2E_SPIKE_K,
});
