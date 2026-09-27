import type { SystemCtx } from "./ctx";

// Lint-restricted (ferry/ctx-constructors) to jobs, the relay, webhooks and services/ops.ts.
export function systemCtx(tenantId: string, job: string): SystemCtx {
  return { scope: "system", userId: tenantId, job };
}
