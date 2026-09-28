import type { LegalBlock } from "@/core/legal";

// The body of a content/legal text: "## " headings and paragraphs. Inside a card the headings sit one level lower.
export function LegalText({ blocks, heading: Heading = "h2" }: { blocks: readonly LegalBlock[]; heading?: "h2" | "h3" }) {
  return blocks.map((block, i) =>
    block.kind === "heading" ? (
      <Heading key={i} className="pt-2 font-display text-h3">
        {block.text}
      </Heading>
    ) : (
      <p key={i} className="text-secondary text-slate">
        {block.text}
      </p>
    ),
  );
}
