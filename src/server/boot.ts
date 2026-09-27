import { dataClass, DeployConfigError, deployTier, type Env, type Tier } from "./deploy";
import { modeFor, VENDORS } from "./integrations/mode";
import { errorName, log } from "./log";
import { installConsoleScrubber } from "./scrub";

export class BootRefused extends Error {
  constructor(readonly failures: string[]) {
    super(`Refusing to boot:\n${failures.map((f) => `- ${f}`).join("\n")}`);
    this.name = "BootRefused";
  }
}

const message = (e: unknown) => (e instanceof DeployConfigError ? e.message : errorName(e));

export function assertBootable(env: Env = process.env): Tier {
  let tier: Tier;
  try {
    tier = deployTier(env);
  } catch (e) {
    throw new BootRefused([message(e)]);
  }
  const failures: string[] = [];
  try {
    if (dataClass(env) !== "synthetic" && tier === "staging") failures.push("FERRY_DATA_CLASS must be synthetic in the staging tier");
  } catch (e) {
    failures.push(message(e));
  }
  for (const vendor of VENDORS) {
    try {
      modeFor(vendor, env);
    } catch (e) {
      failures.push(e instanceof DeployConfigError && e.message.startsWith(`${vendor}:`) ? e.message : `${vendor}: ${message(e)}`);
    }
  }
  if (failures.length) throw new BootRefused(failures);
  return tier;
}

const BOOTED = Symbol.for("ferry.booted");

function fatal(processName: string, event: string) {
  return (e: unknown) => {
    process.stderr.write(`${JSON.stringify({ at: new Date().toISOString(), event, kind: processName, error: errorName(e) })}\n`);
    process.exit(1);
  };
}

// Every entrypoint (Next, worker, relay) calls this before anything else.
export function bootProcess(processName: string, env: Env = process.env): Tier {
  const g = globalThis as { [BOOTED]?: Tier };
  if (g[BOOTED]) return g[BOOTED];
  process.on("uncaughtException", fatal(processName, "process.uncaught_exception"));
  process.on("unhandledRejection", fatal(processName, "process.unhandled_rejection"));
  if (env.NODE_ENV === "production" || env.FERRY_SCRUB_ERRORS === "1") installConsoleScrubber();
  try {
    g[BOOTED] = assertBootable(env);
  } catch (e) {
    if (e instanceof BootRefused) for (const f of e.failures) process.stderr.write(`${JSON.stringify({ event: "boot.refused", kind: processName, reason: f })}\n`);
    throw e;
  }
  log("boot.ok", { kind: processName, tier: g[BOOTED] });
  return g[BOOTED];
}
