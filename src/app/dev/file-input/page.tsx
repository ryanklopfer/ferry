import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { spikeKeyValid } from "@/server/dev-spike";
import { FileInputCheck } from "./file-input-check";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "File input check", robots: { index: false }, referrer: "no-referrer" };

// No sign-in: dev tier and the per-run key only, otherwise 404 (src/server/dev-spike.ts).
export default async function FileInputPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { k } = await searchParams;
  if (!spikeKeyValid(k)) notFound();
  return <FileInputCheck />;
}
