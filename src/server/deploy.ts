export const TIERS = ["dev", "prelaunch", "staging", "prod"] as const;
export type Tier = (typeof TIERS)[number];

export const DATA_CLASSES = ["synthetic", "deidentified", "real"] as const;
export type DataClass = (typeof DATA_CLASSES)[number];

export type Env = Record<string, string | undefined>;

export class DeployConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeployConfigError";
  }
}

export function deployTier(env: Env = process.env): Tier {
  const value = env.FERRY_DEPLOY_TIER;
  if (!value) {
    if (env.NODE_ENV === "production") throw new DeployConfigError("FERRY_DEPLOY_TIER must be set when NODE_ENV=production");
    return "dev";
  }
  if (!(TIERS as readonly string[]).includes(value)) throw new DeployConfigError(`FERRY_DEPLOY_TIER must be one of ${TIERS.join(", ")}`);
  return value as Tier;
}

// The public-site-only mode: the prelaunch tier implies it, and FERRY_PRELAUNCH=1 turns it on in any tier.
// Fails closed, so an unreadable tier serves only the public pages.
export function isPrelaunch(env: Env = process.env): boolean {
  if (env.FERRY_PRELAUNCH === "1") return true;
  try {
    return deployTier(env) === "prelaunch";
  } catch {
    return true;
  }
}

// Fails closed: a process that never declares its data class is treated as holding real PHI, so
// every "synthetic only" check (the direct API, dev:phone, scribe:eval live) needs an explicit value.
export function dataClass(env: Env = process.env): DataClass {
  const value = env.FERRY_DATA_CLASS || "real";
  if (!(DATA_CLASSES as readonly string[]).includes(value)) throw new DeployConfigError(`FERRY_DATA_CLASS must be one of ${DATA_CLASSES.join(", ")}`);
  return value as DataClass;
}

function databaseName(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return decodeURIComponent(new URL(url).pathname.slice(1)) || null;
  } catch {
    return null;
  }
}

export function isDevDatabase(url: string | undefined): boolean {
  const name = databaseName(url);
  return !!name && /_(dev|test)$/.test(name);
}

// Dev scripts (demo:seed, billing:simulate, clock:advance, dev:login, dev:phone) call this first.
export function assertDevTier(env: Env = process.env): void {
  const tier = deployTier(env);
  if (tier !== "dev") throw new DeployConfigError(`This script runs only in the dev tier, not ${tier}`);
  if (!isDevDatabase(env.DATABASE_URL)) throw new DeployConfigError("This script runs only against a database whose name ends in _dev or _test");
}
