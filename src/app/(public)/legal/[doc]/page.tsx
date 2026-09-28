import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadLegal } from "@/server/legal";

export async function generateMetadata({ params }: PageProps<"/legal/[doc]">): Promise<Metadata> {
  const doc = await loadLegal((await params).doc);
  return { title: doc?.title };
}

// Rendered from content/legal/<doc>.md. S3b adds content hashes and re-consent on a new version.
export default async function LegalPage({ params }: PageProps<"/legal/[doc]">) {
  const doc = await loadLegal((await params).doc);
  if (!doc) notFound();
  return (
    <article className="mx-auto flex max-w-xl flex-col gap-4 pt-6">
      <h1 className="font-display text-h1">{doc.title}</h1>
      <p className="text-caption text-slate">{doc.placeholder ? "Draft" : `Version ${doc.version}`}</p>
      {doc.blocks.map((block, i) =>
        block.kind === "heading" ? (
          <h2 key={i} className="pt-2 font-display text-h3">
            {block.text}
          </h2>
        ) : (
          <p key={i} className="text-secondary text-slate">
            {block.text}
          </p>
        ),
      )}
    </article>
  );
}
