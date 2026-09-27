import { errorName, isErrorLike } from "./log";

// Next and libraries print error messages and stacks through console.error/warn. A message can carry
// PHI (a failed insert quotes the row), so outside the dev tier only error names ever reach the output.
export function installConsoleScrubber(): void {
  const scrubbed = (level: string) => (...args: unknown[]) => {
    const names = args.filter(isErrorLike).map(errorName);
    process.stderr.write(`${JSON.stringify({ at: new Date().toISOString(), event: `console.${level}`, error: names.length ? names.join(",") : undefined })}\n`);
  };
  console.error = scrubbed("error");
  console.warn = scrubbed("warn");
}
