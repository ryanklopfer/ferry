import { dataClass, deployTier, type Env } from "@/server/deploy";

export class DirectApiRefused extends Error {
  constructor(reason: string) {
    super(`The direct Anthropic API is refused: ${reason}`);
    this.name = "DirectApiRefused";
  }
}

// The direct API has no BAA. It may see synthetic data on a developer machine and nothing else.
export function assertSyntheticDirectApi(env: Env = process.env): void {
  const tier = deployTier(env);
  if (tier !== "dev") throw new DirectApiRefused(`tier is ${tier}, not dev`);
  const cls = dataClass(env);
  if (cls !== "synthetic") throw new DirectApiRefused(`data class is ${cls}, not synthetic`);
}
