// Shared by vitest.config.mts and src/repo-hygiene.test.ts, so a test file the plan names can't silently never run.
export const NODE_INCLUDE = ["src/**/*.test.ts", "scripts/**/*.test.ts", "infra/**/*.test.ts"];
export const DOM_INCLUDE = ["src/**/*.test.tsx"];
