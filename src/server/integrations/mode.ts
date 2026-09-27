import { deployTier, DeployConfigError, type Env, type Tier } from "@/server/deploy";

export const VENDORS = ["keys", "ephemeralKeys", "storage", "email", "sms", "llm", "scribe", "billing", "clearinghouse", "nppes", "fax"] as const;
export type Vendor = (typeof VENDORS)[number];

// local: an on-machine implementation (key directory, disk storage). Dev only, like fixture.
export const MODES = ["live", "test", "fixture", "local", "off"] as const;
export type Mode = (typeof MODES)[number];

export class VendorOff extends Error {
  constructor(readonly vendor: Vendor) {
    super(`${vendor} is off in this deployment`);
    this.name = "VendorOff";
  }
}

export class NotConfigured extends Error {
  constructor(readonly vendor: Vendor, mode: Mode) {
    super(`${vendor} has no ${mode} implementation yet`);
    this.name = "NotConfigured";
  }
}

export class ModeNotAllowed extends DeployConfigError {
  constructor(readonly vendor: Vendor, readonly mode: Mode, readonly tier: Tier) {
    super(`${vendor}: mode ${mode} is not allowed in the ${tier} tier`);
    this.name = "ModeNotAllowed";
  }
}

export function tierAllows(tier: Tier, vendor: Vendor, mode: Mode): boolean {
  switch (tier) {
    case "dev":
      return true;
    case "prelaunch":
      return mode === "off";
    case "staging":
      return mode === "live" || mode === "test" || mode === "off";
    case "prod":
      return mode === "live" || (mode === "off" && (vendor === "sms" || vendor === "fax"));
  }
}

export const modeEnvVar = (vendor: Vendor) => `FERRY_${vendor.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}_MODE`;

export function modeFor(vendor: Vendor, env: Env = process.env): Mode {
  const tier = deployTier(env);
  const name = modeEnvVar(vendor);
  const value = env[name];
  if (value !== undefined && !(MODES as readonly string[]).includes(value)) throw new DeployConfigError(`${name} must be one of ${MODES.join(", ")}`);
  const mode = (value as Mode | undefined) ?? (tier === "dev" ? "fixture" : "off");
  if (!tierAllows(tier, vendor, mode)) throw new ModeNotAllowed(vendor, mode, tier);
  return mode;
}

export function vendorOff(vendor: Vendor): never {
  throw new VendorOff(vendor);
}
