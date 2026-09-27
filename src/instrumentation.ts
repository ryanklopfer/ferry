import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootProcess } = await import("./server/boot");
  bootProcess("next");
}

// Next would otherwise print the message and stack, which can quote PHI. Name, digest and route template only.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { log } = await import("./server/log");
  const digest = typeof error === "object" && error !== null && "digest" in error ? String((error as { digest: unknown }).digest) : undefined;
  log("request.error", { error, digest, method: request.method, route: context.routePath, kind: context.routeType });
};
