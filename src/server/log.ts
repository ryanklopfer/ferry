// Structured logs with an allow-list. Anything not named here never reaches stdout, so handing the
// logger a whole claim, plan or error by mistake cannot leak a name, member ID, diagnosis or Tax ID.
const IDS = [
  "cid",
  "userId",
  "claimId",
  "planId",
  "providerId",
  "documentId",
  "followUpId",
  "clientId",
  "membershipId",
  "encounterId",
  "captureId",
  "noteId",
  "scanId",
  "letterId",
  "taskId",
  "subscriptionId",
  "timerId",
  "payerId",
  "digest",
];
const OTHER = ["channel", "vendor", "mode", "tier", "job", "operation", "route", "method", "httpStatus", "count", "bytes", "ms", "attempt"];

// Values that could otherwise carry a name or a diagnosis code must look like a code identifier.
const IDENTIFIER = /^[a-z][a-z0-9_]{0,40}$/;
const PATTERNS: Record<string, RegExp> = {
  code: /^[a-z][a-z0-9_]{1,40}$/,
  type: IDENTIFIER,
  kind: IDENTIFIER,
  status: IDENTIFIER,
  state: IDENTIFIER,
  from: IDENTIFIER,
  to: IDENTIFIER,
};

const ALLOWED = new Set([...IDS, ...OTHER, ...Object.keys(PATTERNS)]);

const scalar = (v: unknown): v is string | number | boolean | null => v === null || ["string", "number", "boolean"].includes(typeof v);

export function errorName(e: unknown): string {
  const errorLike = e instanceof Error || (typeof e === "object" && e !== null && "stack" in e);
  const name = errorLike ? (e as { name?: unknown }).name : undefined;
  return typeof name === "string" && /^[A-Za-z][A-Za-z0-9_]{0,60}$/.test(name) ? name : "Error";
}

export function log(event: string, fields: Record<string, unknown> = {}): void {
  const line: Record<string, unknown> = { at: new Date().toISOString(), event };
  for (const [key, value] of Object.entries(fields)) {
    if (key === "error") line.error = errorName(value);
    else if (!ALLOWED.has(key) || !scalar(value)) continue;
    else if (PATTERNS[key]) {
      if (typeof value === "string" && PATTERNS[key].test(value)) line[key] = value;
    } else line[key] = typeof value === "string" ? value.slice(0, 120) : value;
  }
  console.log(JSON.stringify(line));
}

export function logFor(claimId: string) {
  return (event: string, fields: Record<string, unknown> = {}) => log(event, { ...fields, claimId, cid: claimId });
}
