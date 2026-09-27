import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootProcess } = await import("./server/boot");
  bootProcess("next");
}

// A structured line with the error name, digest and route template only. This does not stop Next printing the
// error itself through console.error; installConsoleScrubber (from bootProcess) is what keeps the message out.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { log } = await import("./server/log");
  const digest = typeof error === "object" && error !== null && "digest" in error ? String((error as { digest: unknown }).digest) : undefined;
  log("request.error", { error, digest, method: request.method, route: context.routePath, kind: context.routeType });
};
