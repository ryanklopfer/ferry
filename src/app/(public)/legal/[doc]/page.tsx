import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadLegal } from "@/server/legal";
import { LegalText } from "@/ui/consent/legal-text";

export async function generateMetadata({ params }: PageProps<"/legal/[doc]">): Promise<Metadata> {
  const doc = await loadLegal((await params).doc);
  return { title: doc?.title };
}

// Rendered from content/legal/<doc>.md. A new version makes every consent to the old one stale (S3b).
export default async function LegalPage({ params }: PageProps<"/legal/[doc]">) {
  const doc = await loadLegal((await params).doc);
  if (!doc) notFound();
  return (
    <article className="mx-auto flex max-w-xl flex-col gap-4 pt-6">
      <h1 className="font-display text-h1">{doc.title}</h1>
      <p className="text-caption text-slate">{doc.placeholder ? "Draft" : `Version ${doc.version}`}</p>
      <LegalText blocks={doc.blocks} />
    </article>
  );
}
