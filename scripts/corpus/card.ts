import sharp from "sharp";
import type { CardSpec } from "./data";
import { escapeXml } from "./format";

const W = 1011;
const H = 638;
const SANS = `font-family="Helvetica, Arial"`;

const ID_LABEL: Record<string, string> = {
  MEDICARE: "Medicare Number",
  MEDICAID: "Member ID",
  HMO: "Medical Record #",
};

function frame(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="36" fill="#ffffff" stroke="#c9ccd2" stroke-width="3"/>${inner}</svg>`;
}

export async function renderCardFront(card: CardSpec): Promise<Buffer> {
  const { label: c, accent, frontExtras } = card;
  const p: string[] = [];
  p.push(`<path d="M0 36 Q0 0 36 0 H${W - 36} Q${W} 0 ${W} 36 V128 H0 Z" fill="${accent}"/>`);
  p.push(`<text x="44" y="84" font-size="46" font-weight="700" fill="#fff" ${SANS}>${escapeXml(c.payerName)}</text>`);
  if (c.planName) p.push(`<text x="44" y="186" font-size="30" font-weight="700" fill="#222" ${SANS}>${escapeXml(c.planName)}</text>`);

  const rows: [string, string][] = [
    ["Name", c.subscriberName],
    [ID_LABEL[c.planType] ?? "Member ID", c.memberId],
  ];
  if (c.groupNumber) rows.push(["Group", c.groupNumber]);
  rows.forEach(([k, v], i) => {
    const y = 250 + i * 66;
    p.push(`<text x="44" y="${y}" font-size="22" fill="#566" ${SANS}>${escapeXml(k)}</text>`);
    p.push(`<text x="44" y="${y + 32}" font-size="34" font-weight="700" fill="#111" ${SANS}>${escapeXml(v)}</text>`);
  });
  frontExtras.forEach((e, i) => {
    p.push(`<text x="${W - 44}" y="${250 + i * 40}" font-size="22" fill="#333" text-anchor="end" ${SANS}>${escapeXml(e)}</text>`);
  });
  return sharp(Buffer.from(frame(p.join("")))).png().toBuffer();
}

export async function renderCardBack(card: CardSpec): Promise<Buffer> {
  const { label: c, backExtras } = card;
  const p: string[] = [];
  p.push(`<rect x="0" y="60" width="${W}" height="70" fill="#2b2b2b"/>`);
  const lines = [
    c.payerPhone ? `Member services: ${c.payerPhone}` : null,
    c.claimsAddress ? "Send claims to:" : null,
    c.claimsAddress,
    ...backExtras,
    "This card is for identification only and is not a guarantee of coverage.",
  ].filter((l): l is string => Boolean(l));
  lines.forEach((l, i) => {
    p.push(`<text x="44" y="${210 + i * 52}" font-size="25" fill="#222" ${SANS}>${escapeXml(l)}</text>`);
  });
  return sharp(Buffer.from(frame(p.join("")))).png().toBuffer();
}
