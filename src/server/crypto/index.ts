import type { Env } from "@/server/deploy";
import { modeFor, NotConfigured, vendorOff } from "@/server/integrations/mode";
import { type EphemeralKeyStore, localEphemeralKeyStore } from "./ephemeral";
import { type KeyProvider, localKeyProvider } from "./key-provider";

// fixture and local are the same on-machine implementation (dev tier only). live and test are KMS and DynamoDB,
// which need the AWS SDK clients S21a wires in over KmsApi and DynamoApi.
export function keyProviderFor(env: Env = process.env): KeyProvider {
  const mode = modeFor("keys", env);
  switch (mode) {
    case "fixture":
    case "local":
      return localKeyProvider(env);
    case "off":
      return vendorOff("keys");
    case "live":
    case "test":
      throw new NotConfigured("keys", mode);
  }
}

export function ephemeralKeyStoreFor(env: Env = process.env): EphemeralKeyStore {
  const mode = modeFor("ephemeralKeys", env);
  switch (mode) {
    case "fixture":
    case "local":
      return localEphemeralKeyStore(env);
    case "off":
      return vendorOff("ephemeralKeys");
    case "live":
    case "test":
      throw new NotConfigured("ephemeralKeys", mode);
  }
}

let provider: KeyProvider | undefined;
let store: EphemeralKeyStore | undefined;
export const keyProvider = () => (provider ??= keyProviderFor());
export const ephemeralKeyStore = () => (store ??= ephemeralKeyStoreFor());
