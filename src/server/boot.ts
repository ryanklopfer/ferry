import { APP_ICONS, type AppIcon } from "../core/pwa/icons";
import { dataClass, DeployConfigError, deployTier, type Env, isDevDatabase, type Tier } from "./deploy";
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

export function assertBootable(env: Env = process.env, icons: readonly AppIcon[] = APP_ICONS): Tier {
  let tier: Tier;
  try {
    tier = deployTier(env);
  } catch (e) {
    throw new BootRefused([message(e)]);
  }
  const failures: string[] = [];
  // One wrong tier value on a real deployment would turn on fixtures, printed sign-in links and the direct API.
  if (tier === "dev" && !isDevDatabase(env.DATABASE_URL)) failures.push("The dev tier runs only against a database whose name ends in _dev or _test");
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
  const placeholders = icons.filter((i) => i.placeholder).map((i) => i.src);
  if (tier === "prod" && placeholders.length) failures.push(`icons: placeholder app icons are not allowed in the prod tier (${placeholders.join(", ")}); the approved artwork is F11`);
  if (failures.length) throw new BootRefused(failures);
  return tier;
}

const BOOTED = Symbol.for("ferry.booted");

const isPostpone = (e: unknown) => typeof e === "object" && e !== null && (e as { $$typeof?: unknown }).$$typeof === Symbol.for("react.postpone");

// The worker and relay crash on purpose and rely on their supervisor to restart them. Next stays up, as its
// own handlers do: a discarded, late-awaited promise in one render must not take the site down for everyone.
function fatal(processName: string, event: string) {
  return (e: unknown) => {
    if (isPostpone(e)) return;
    process.stderr.write(`${JSON.stringify({ at: new Date().toISOString(), event, kind: processName, error: errorName(e) })}\n`);
    if (processName !== "next") process.exit(1);
  };
}

function scrubConsole(env: Env): boolean {
  if (env.NODE_ENV === "production" || env.FERRY_SCRUB_ERRORS === "1") return true;
  try {
    return deployTier(env) !== "dev";
  } catch {
    return true;
  }
}

// Every entrypoint (Next, worker, relay) calls this before anything else.
export function bootProcess(processName: string, env: Env = process.env): Tier {
  const g = globalThis as { [BOOTED]?: Tier };
  if (g[BOOTED]) return g[BOOTED];
  process.on("uncaughtException", fatal(processName, "process.uncaught_exception"));
  process.on("unhandledRejection", fatal(processName, "process.unhandled_rejection"));
  if (scrubConsole(env)) installConsoleScrubber();
  try {
    g[BOOTED] = assertBootable(env);
  } catch (e) {
    if (e instanceof BootRefused) for (const f of e.failures) process.stderr.write(`${JSON.stringify({ event: "boot.refused", kind: processName, reason: f })}\n`);
    throw e;
  }
  log("boot.ok", { kind: processName, tier: g[BOOTED] });
  return g[BOOTED];
}
