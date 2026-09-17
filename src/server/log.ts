// Structured logs with an allow-list. Anything not named here never reaches stdout, so handing the
// logger a whole claim, plan or error by mistake cannot leak a name, member ID, diagnosis or Tax ID.
const ALLOWED = new Set([
  "cid",
  "userId",
  "claimId",
  "planId",
  "providerId",
  "documentId",
  "followUpId",
  "status",
  "state",
  "from",
  "to",
  "type",
  "kind",
  "channel",
  "payerId",
  "vendor",
  "operation",
  "route",
  "method",
  "httpStatus",
  "code",
  "count",
  "bytes",
  "ms",
  "attempt",
]);

const scalar = (v: unknown): v is string | number | boolean | null => v === null || ["string", "number", "boolean"].includes(typeof v);

export function log(event: string, fields: Record<string, unknown> = {}): void {
  const line: Record<string, unknown> = { at: new Date().toISOString(), event };
  for (const [key, value] of Object.entries(fields)) {
    if (key === "error") line.error = value instanceof Error ? value.name : "Error";
    else if (ALLOWED.has(key) && scalar(value)) line[key] = typeof value === "string" ? value.slice(0, 120) : value;
  }
  console.log(JSON.stringify(line));
}

export function logFor(claimId: string) {
  return (event: string, fields: Record<string, unknown> = {}) => log(event, { ...fields, claimId, cid: claimId });
}
