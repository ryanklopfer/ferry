import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL, e2eServerEnv } from "./e2e/env";

const PORT = 3100;

// Helpers in the test process (resetDb) talk to the e2e database, never ferry_dev.
process.env.DATABASE_URL = E2E_DATABASE_URL;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `bunx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/sign-in`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: e2eServerEnv(PORT),
  },
});
