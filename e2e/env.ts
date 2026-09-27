export const E2E_DATABASE_URL = process.env.DATABASE_URL_E2E ?? "postgres://localhost:5432/ferry_e2e_test";

// Synthetic, dev-tier settings for every server the e2e suite starts. The secret signs e2e sessions only.
export const e2eServerEnv = (port: number): Record<string, string> => ({
  DATABASE_URL: E2E_DATABASE_URL,
  BETTER_AUTH_URL: `http://localhost:${port}`,
  BETTER_AUTH_SECRET: "e2e-only-secret-for-synthetic-sessions-0000",
  FERRY_DEPLOY_TIER: "dev",
  FERRY_DATA_CLASS: "synthetic",
  FERRY_EMAIL_MODE: "fixture",
  ANTHROPIC_API_KEY: "",
});
