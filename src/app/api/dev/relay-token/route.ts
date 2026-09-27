import { z } from "zod";
import { CaptureId } from "@/core/capture/protocol";
import { devRunId, relayUrlFor, spikeKeyValid } from "@/server/dev-spike";
import { issueRelayToken, relaySecret } from "@/server/relay/token";

export const dynamic = "force-dynamic";

const Body = z.object({ k: z.unknown(), captureId: z.unknown() });

const notFound = () => new Response(null, { status: 404 });

// Dev tier and the per-run key only (src/server/dev-spike.ts). k comes in the body, never the URL.
export async function POST(request: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return notFound();
  }
  if (!spikeKeyValid(body.k)) return notFound();
  const captureId = CaptureId.safeParse(body.captureId);
  if (!captureId.success) return Response.json({ code: "invalid_capture", message: "That capture id is not valid." }, { status: 400 });
  const token = issueRelayToken({ captureId: captureId.data, subject: `devRun:${devRunId(body.k)}` }, relaySecret(), Date.now());
  return Response.json({ token, url: relayUrlFor(captureId.data) }, { headers: { "cache-control": "no-store" } });
}
