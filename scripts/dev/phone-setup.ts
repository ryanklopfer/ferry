import { spawnSync } from "node:child_process";
import { toQR } from "toqr";
import { assertDevTier, dataClass, DeployConfigError, type Env } from "@/server/deploy";
import { modeEnvVar, modeFor, VENDORS } from "@/server/integrations/mode";

const TUNNEL_SAFE_MODES = ["fixture", "local", "off"];

// dev:phone puts the dev server on a public tunnel, so it runs only in the dev tier with declared synthetic data,
// and with no vendor live or in test mode: nobody reaching the tunnel may make Ferry send email or call a vendor.
export function assertDevPhone(env: Env = process.env): void {
  assertDevTier(env);
  if (dataClass(env) !== "synthetic") throw new DeployConfigError("dev:phone runs only with FERRY_DATA_CLASS=synthetic: the tunnel is public, so only synthetic speech may go through it");
  const reachable = VENDORS.filter((v) => !TUNNEL_SAFE_MODES.includes(modeFor(v, env)));
  if (reachable.length) throw new DeployConfigError(`dev:phone runs only with every vendor on fixture, local or off: the tunnel is public. Unset or change ${reachable.map(modeEnvVar).join(", ")}`);
}

export const PORTS = { next: 3000, relay: 3001, caddy: 3080 } as const;
export const TOOLS = ["caddy", "cloudflared"] as const;

export const missingTools = (has: (bin: string) => boolean = (bin) => spawnSync("which", [bin]).status === 0) => TOOLS.filter((t) => !has(t));

// What the spike pages load from next dev. Sign-in, the API and the app itself stay off the public tunnel.
export const SPIKE_PATHS = ["/dev/*", "/api/dev/*", "/_next/*", "/__nextjs*", "/worklets/*", "/icons/*", "/manifest.webmanifest", "/sw.js", "/offline", "/favicon.ico"] as const;

// One origin for the phone: /ws/* to the relay, the spike's paths to next dev, 404 for everything else.
// Loopback only; cloudflared is the way in.
export function caddyfile(ports: { caddy: number; next: number; relay: number } = PORTS): string {
  return `{
\tadmin off
\tauto_https off
}

http://:${ports.caddy} {
\tbind 127.0.0.1
\thandle /ws/* {
\t\treverse_proxy 127.0.0.1:${ports.relay}
\t}
\t@spike path ${SPIKE_PATHS.join(" ")}
\thandle @spike {
\t\treverse_proxy 127.0.0.1:${ports.next}
\t}
\thandle {
\t\trespond 404
\t}
}
`;
}

export const tunnelUrlIn = (text: string): string | null => /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(text)?.[0] ?? null;

export const spikeUrl = (origin: string, k: string) => `${origin}/dev/mic?k=${encodeURIComponent(k)}`;

// Two modules per character row (upper and lower half blocks) with the 4-module quiet zone scanners need,
// drawn in explicit black on white so it scans on light and dark terminal themes alike.
export function qr(text: string): string {
  const modules = toQR(text);
  const size = Math.sqrt(modules.length);
  const quiet = 4;
  const dark = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size && modules[y * size + x] === 1;
  const lines: string[] = [];
  for (let y = -quiet; y < size + quiet; y += 2) {
    let line = "";
    for (let x = -quiet; x < size + quiet; x++) {
      const top = dark(x, y);
      const bottom = dark(x, y + 1);
      line += top && bottom ? "█" : top ? "▀" : bottom ? "▄" : " ";
    }
    lines.push(`${BLACK_ON_WHITE}${line}${RESET}`);
  }
  return lines.join("\n");
}

const BLACK_ON_WHITE = "\x1b[38;5;16;48;5;231m";
const RESET = "\x1b[0m";
