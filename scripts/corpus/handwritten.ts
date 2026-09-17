import sharp from "sharp";
import type { SuperbillSpec } from "./data";
import { escapeXml, formatDate, money, rng } from "./format";

const W = 1700;
const H = 2200;
const PRINT = `font-family="Helvetica, Arial" fill="#222"`;

// A pre-printed practice form with the values written in by hand.
export async function renderHandwrittenPng(spec: SuperbillSpec, seed: number): Promise<Buffer> {
  const rand = rng(seed);
  const { billingProvider: b, renderingProvider: r, patient, diagnosisCodes, lines, totalChargedCents, totalPaidCents } = spec.label;
  const parts: string[] = [];

  const label = (s: string, x: number, y: number, size = 26) =>
    parts.push(`<text x="${x}" y="${y}" font-size="${size}" ${PRINT}>${escapeXml(s)}</text>`);
  const underline = (x: number, y: number, w: number) =>
    parts.push(`<line x1="${x}" y1="${y + 8}" x2="${x + w}" y2="${y + 8}" stroke="#555" stroke-width="2"/>`);
  const hand = (s: string, x: number, y: number, size = 44) => {
    const rot = (rand() - 0.5) * 3;
    const dy = (rand() - 0.5) * 8;
    parts.push(
      `<text x="${x}" y="${y + dy}" font-size="${size}" font-family="Bradley Hand" fill="#1b2a6b" transform="rotate(${rot.toFixed(2)} ${x} ${y})">${escapeXml(s)}</text>`,
    );
  };
  const field = (name: string, value: string, x: number, y: number, w: number) => {
    label(name, x, y);
    const lx = x + name.length * 14 + 24;
    underline(lx, y, w);
    hand(value, lx + 10, y);
  };

  parts.push(`<rect width="${W}" height="${H}" fill="#fdfcf8"/>`);
  parts.push(`<text x="120" y="170" font-size="54" font-weight="700" ${PRINT}>${escapeXml(b.name)}</text>`);
  label(`${b.address.line1}, ${b.address.city}, ${b.address.state} ${b.address.zip}   ${b.phone ?? ""}`, 120, 222, 28);
  parts.push(`<text x="${W - 120}" y="170" font-size="46" font-weight="700" text-anchor="end" ${PRINT}>SUPERBILL</text>`);
  parts.push(`<line x1="120" y1="260" x2="${W - 120}" y2="260" stroke="#222" stroke-width="3"/>`);

  field("Client name", patient.name, 120, 360, 620);
  if (patient.dob) field("DOB", formatDate(patient.dob, "mdy"), 1080, 360, 360);
  field("Provider", `${r.name} ${r.credential ?? ""}`.trim(), 120, 470, 620);
  if (r.license) field("License", r.license, 1080, 470, 360);
  if (b.npi) field(spec.render.npiLabel, b.npi, 120, 580, 420);
  if (b.taxId) field(spec.render.taxLabel, b.taxId, 1080, 580, 360);
  field("Diagnosis (ICD-10)", diagnosisCodes.join("  "), 120, 690, 520);

  const top = 820;
  const cols = [120, 440, 600, 820, 1200, 1380, W - 120];
  const heads = ["Date of service", "POS", "CPT", "Description", "Units", "Fee"];
  parts.push(`<rect x="120" y="${top}" width="${W - 240}" height="70" fill="#e9e6dc"/>`);
  heads.forEach((h, i) => label(h, cols[i] + 12, top + 46, 26));
  const rows = Math.max(lines.length, 5);
  for (let i = 0; i <= rows; i++) {
    const y = top + 70 + i * 100;
    parts.push(`<line x1="120" y1="${y}" x2="${W - 120}" y2="${y}" stroke="#555" stroke-width="2"/>`);
  }
  for (const x of cols) {
    parts.push(`<line x1="${x}" y1="${top}" x2="${x}" y2="${top + 70 + rows * 100}" stroke="#555" stroke-width="2"/>`);
  }
  lines.forEach((l, i) => {
    const y = top + 70 + i * 100 + 66;
    hand(formatDate(l.serviceDate, "mdy"), cols[0] + 16, y);
    hand(l.placeOfService, cols[1] + 30, y);
    hand([l.cpt, ...l.modifiers].join(" "), cols[2] + 16, y);
    hand(l.description, cols[3] + 16, y, 32);
    hand(String(l.units), cols[4] + 60, y);
    hand(money(l.chargeCents), cols[5] + 16, y);
  });

  const ty = top + 70 + rows * 100 + 110;
  field("Total charges", money(totalChargedCents), 900, ty, 360);
  field("Paid today", money(totalPaidCents), 900, ty + 110, 360);
  label("Provider signature", 120, ty + 260);
  underline(400, ty + 260, 640);
  hand(r.name, 430, ty + 255, 58);
  field("Date", formatDate(lines[lines.length - 1].serviceDate, "mdy"), 1120, ty + 260, 300);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join("")}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
