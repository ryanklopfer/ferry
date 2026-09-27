import { bootProcess } from "@/server/boot";
import type { Tier } from "@/server/deploy";
import { errorName, log } from "@/server/log";

// `bun run relay`. Boot checks run before any relay code is loaded.
let tier: Tier;
try {
  tier = bootProcess("relay");
} catch (e) {
  process.stderr.write(`${JSON.stringify({ event: "boot.failed", kind: "relay", error: errorName(e) })}\n`);
  process.exit(1);
}

const { relaySecret, RelaySecretMissing } = await import("./token");
const { startRelay } = await import("./server");

let secret: string;
try {
  secret = relaySecret();
} catch (e) {
  process.stderr.write(`${e instanceof RelaySecretMissing ? e.message : errorName(e)}\n`);
  process.exit(1);
}

// Loopback in dev (Caddy fronts it for dev:phone); every interface behind the load balancer.
const relay = await startRelay({ port: Number(process.env.RELAY_PORT || 3001), secret, host: tier === "dev" ? "127.0.0.1" : "0.0.0.0" });
log("relay.listening", { port: relay.port, tier });

for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, () => void relay.close().then(() => process.exit(0)));
