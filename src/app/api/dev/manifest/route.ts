import { appManifest } from "@/core/pwa/manifest";
import { spikeKeyValid, spikeManifestStartUrl } from "@/server/dev-spike";

export const dynamic = "force-dynamic";

const notFound = () => new Response(null, { status: 404 });

// The manifest /dev/mic links to, so the installed spike opens on /dev/mic. Dev tier and this run's k only
// (src/server/dev-spike.ts); the shared /manifest.webmanifest never sees the key.
export function GET(request: Request) {
  const k = new URL(request.url).searchParams.get("k");
  if (!spikeKeyValid(k)) return notFound();
  return Response.json(appManifest({ id: "/dev/mic", startUrl: spikeManifestStartUrl(k) }), {
    headers: { "content-type": "application/manifest+json", "cache-control": "no-store" },
  });
}

export { notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE, notFound as OPTIONS };
