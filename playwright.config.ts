import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL, E2E_KEY_DIR, E2E_LEGAL_DIR, E2E_LOCAL_KEK, E2E_RELAY_PORT, e2eServerEnv } from "./e2e/env";

const PORT = 3100;

// Helpers in the test process (resetDb, seeding through the repos) talk to the e2e database, never ferry_dev, and
// share the servers' keys and legal texts.
process.env.DATABASE_URL = E2E_DATABASE_URL;
process.env.FERRY_DATA_CLASS = "synthetic";
process.env.FERRY_LOCAL_KEK = E2E_LOCAL_KEK;
process.env.FERRY_KEY_DIR = E2E_KEY_DIR;
process.env.FERRY_LEGAL_DIR = E2E_LEGAL_DIR;

// Fresh texts for each run, copied once by the runner (workers load this file too).
if (!process.env.TEST_WORKER_INDEX) {
  fs.rmSync(E2E_LEGAL_DIR, { recursive: true, force: true });
  fs.cpSync(path.join(process.cwd(), "content", "legal"), E2E_LEGAL_DIR, { recursive: true });
}

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `bun run build:sw && bunx next dev --port ${PORT}`,
      url: `http://localhost:${PORT}/sign-in`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: e2eServerEnv(PORT),
    },
    // The capture relay answers 404 to plain HTTP, so readiness is the open port.
    { command: "bun run relay", port: E2E_RELAY_PORT, reuseExistingServer: false, timeout: 30_000, env: e2eServerEnv(PORT) },
  ],
});
