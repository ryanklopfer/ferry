import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";
import { DOM_INCLUDE, NODE_INCLUDE } from "./vitest.globs.mjs";

export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: {
    fileParallelism: false,
    silent: "passed-only",
    env: { FERRY_OUTBOX_DIR: path.join(os.tmpdir(), "ferry-vitest-outbox"), FERRY_DATA_CLASS: "synthetic" },
    projects: [
      { extends: true, test: { name: "node", include: NODE_INCLUDE, environment: "node", globalSetup: "./vitest.global-setup.ts" } },
      { extends: true, test: { name: "dom", include: DOM_INCLUDE, environment: "happy-dom" } },
    ],
  },
});
