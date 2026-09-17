import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { rng } from "./format";

// Quick Look renders the vector page at full resolution; `sips` only upsamples a 72-dpi raster.
export async function rasterizePdfPages(pdf: Uint8Array, longSide = 2200): Promise<Buffer[]> {
  const src = await PDFDocument.load(pdf);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ferry-corpus-"));
  try {
    const out: Buffer[] = [];
    for (let i = 0; i < src.getPageCount(); i++) {
      const single = await PDFDocument.create();
      const [page] = await single.copyPages(src, [i]);
      single.addPage(page);
      const file = path.join(dir, `p${i}.pdf`);
      fs.writeFileSync(file, await single.save());
      execFileSync("qlmanage", ["-t", "-s", String(longSide), "-o", dir, file], { stdio: "ignore" });
      out.push(fs.readFileSync(`${file}.png`));
    }
    return out;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function noise(width: number, height: number, sigma: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 128, g: 128, b: 128 }, noise: { type: "gaussian", mean: 128, sigma } },
  })
    .png()
    .toBuffer();
}

// A phone photo: paper on a desk, slightly rotated and sheared, uneven light, soft focus, JPEG artifacts.
export async function asPhoto(png: Buffer, seed: number, desk = "#6f6152"): Promise<Buffer> {
  const rand = rng(seed);
  const angle = (rand() - 0.5) * 7;
  const shear = (rand() - 0.5) * 0.06;

  // sharp runs operations in a fixed internal order, so each geometric step gets its own pipeline.
  const sheared = await sharp(png)
    .flatten({ background: "#ffffff" })
    .affine([[1, shear], [shear / 2, 1]], { background: desk })
    .toBuffer();
  const rotated = await sharp(sheared).rotate(angle, { background: desk }).toBuffer();
  const paper = await sharp(rotated)
    .extend({ top: 90, bottom: 110, left: 80, right: 100, background: desk })
    .toBuffer();

  const { width = 0, height = 0 } = await sharp(paper).metadata();
  const gx = Math.round(20 + rand() * 60);
  const light = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><radialGradient id="g" cx="${gx}%" cy="30%" r="90%"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.34"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  );

  const lit = await sharp(paper)
    .composite([
      { input: light, blend: "over" },
      { input: await noise(width, height, 9), blend: "soft-light" },
    ])
    .toBuffer();

  return sharp(lit)
    .blur(0.7)
    .modulate({ brightness: 0.97, saturation: 0.9 })
    .resize({ width: 1800, withoutEnlargement: true })
    .jpeg({ quality: 72 })
    .toBuffer();
}

// A received fax: ~130 dpi, bilevel, speckled, a hair crooked.
export async function asFax(png: Buffer, seed: number): Promise<Buffer> {
  const rand = rng(seed);
  const base = await sharp(png)
    .flatten({ background: "#ffffff" })
    .resize({ width: 1100 })
    .rotate((rand() - 0.5) * 1.6, { background: "#ffffff" })
    .grayscale()
    .blur(0.6)
    .toBuffer();
  const { width = 0, height = 0 } = await sharp(base).metadata();
  return sharp(base)
    .composite([{ input: await noise(width, height, 26), blend: "soft-light" }])
    .threshold(150)
    .png()
    .toBuffer();
}

export async function imagesToPdf(pngs: Buffer[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const png of pngs) {
    const img = await doc.embedPng(png);
    const page = doc.addPage([612, 792]);
    const scale = Math.min(612 / img.width, 792 / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    page.drawImage(img, { x: (612 - w) / 2, y: (792 - h) / 2, width: w, height: h });
  }
  return doc.save();
}
