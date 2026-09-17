import fs from "node:fs";
import path from "node:path";
import { renderCardBack, renderCardFront } from "./card";
import { CARDS, SUPERBILLS } from "./data";
import { asFax, asPhoto, imagesToPdf, rasterizePdfPages } from "./degrade";
import { renderHandwrittenPng } from "./handwritten";
import { renderSuperbillPdf } from "./pdf";
import { LabelsFileSchema } from "./schema";

const ROOT = path.join(process.cwd(), "corpus", "synthetic");
const write = (rel: string, bytes: Uint8Array) => {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
  return rel;
};

async function superbillFiles(spec: (typeof SUPERBILLS)[number], seed: number): Promise<string[]> {
  const { id } = spec.label;
  if (spec.render.style === "form-handwritten") {
    const png = await renderHandwrittenPng(spec, seed);
    return [write(`superbills/${id}.jpg`, await asPhoto(png, seed))];
  }
  const pdf = await renderSuperbillPdf(spec);
  if (spec.render.output === "pdf") return [write(`superbills/${id}.pdf`, pdf)];

  const pages = await rasterizePdfPages(pdf);
  if (spec.render.output === "photo") {
    const files: string[] = [];
    for (const [i, page] of pages.entries()) {
      const name = pages.length > 1 ? `${id}-p${i + 1}.jpg` : `${id}.jpg`;
      files.push(write(`superbills/${name}`, await asPhoto(page, seed + i)));
    }
    return files;
  }
  const faxed = await Promise.all(pages.map((p, i) => asFax(p, seed + i)));
  return [write(`superbills/${id}.pdf`, await imagesToPdf(faxed))];
}

async function main() {
  fs.rmSync(ROOT, { recursive: true, force: true });

  const superbills = [];
  for (const [i, spec] of SUPERBILLS.entries()) {
    superbills.push({ ...spec.label, files: await superbillFiles(spec, 1000 + i * 17) });
  }

  const cards = [];
  for (const [i, card] of CARDS.entries()) {
    const seed = 5000 + i * 13;
    const front = write(`cards/${card.label.id}-front.jpg`, await asPhoto(await renderCardFront(card), seed, "#3d4652"));
    const back = write(`cards/${card.label.id}-back.jpg`, await asPhoto(await renderCardBack(card), seed + 1, "#3d4652"));
    cards.push({ ...card.label, files: [front, back] });
  }

  const labels = LabelsFileSchema.parse({
    generatedBy: "bun run corpus:generate",
    note: "Synthetic test data. Every person, provider, identifier and member number is invented.",
    superbills,
    cards,
  });
  write("labels.json", Buffer.from(`${JSON.stringify(labels, null, 2)}\n`));
  console.log(`wrote ${superbills.length} superbills, ${cards.length} cards → ${ROOT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
