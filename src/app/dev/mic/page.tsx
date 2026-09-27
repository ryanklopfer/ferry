import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { spikeKeyValid, spikeManifestUrl } from "@/server/dev-spike";
import { MicSpike } from "./mic-spike";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// With a valid k, this page links the keyed manifest, so "Add to Home Screen" here opens the installed app on the spike.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { k } = await searchParams;
  return { title: "Mic spike", robots: { index: false }, referrer: "no-referrer", ...(spikeKeyValid(k) ? { manifest: spikeManifestUrl(k) } : {}) };
}

// No sign-in: dev tier and the per-run key only, otherwise 404 (src/server/dev-spike.ts).
export default async function MicSpikePage({ searchParams }: Props) {
  const { k } = await searchParams;
  if (!spikeKeyValid(k)) notFound();
  return <MicSpike k={k} />;
}
