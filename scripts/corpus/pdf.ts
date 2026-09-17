import { PDFDocument, type PDFFont, type PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { SuperbillSpec } from "./data";
import { formatDate, money, pointerLetters } from "./format";

const W = 612;
const H = 792;
const M = 48;
const INK = rgb(0.1, 0.1, 0.12);
const RULE = rgb(0.55, 0.55, 0.58);

const FONTS = {
  helvetica: [StandardFonts.Helvetica, StandardFonts.HelveticaBold],
  times: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold],
  courier: [StandardFonts.Courier, StandardFonts.CourierBold],
} as const;

type Pen = { page: PDFPage; font: PDFFont; bold: PDFFont; y: number };

function text(pen: Pen, s: string, x: number, size = 10, bold = false) {
  pen.page.drawText(s, { x, y: pen.y, size, font: bold ? pen.bold : pen.font, color: INK });
}

function rightText(pen: Pen, s: string, xRight: number, size = 10, bold = false) {
  const f = bold ? pen.bold : pen.font;
  pen.page.drawText(s, { x: xRight - f.widthOfTextAtSize(s, size), y: pen.y, size, font: f, color: INK });
}

function rule(pen: Pen, thickness = 0.7) {
  pen.page.drawLine({ start: { x: M, y: pen.y }, end: { x: W - M, y: pen.y }, thickness, color: RULE });
}

function providerLines(spec: SuperbillSpec): string[] {
  const { billingProvider: b, renderingProvider: r } = spec.label;
  const { npiLabel, taxLabel } = spec.render;
  const out = [b.address.line1, `${b.address.city}, ${b.address.state} ${b.address.zip}`];
  if (b.phone) out.push(`Phone: ${b.phone}`);
  if (b.npi) out.push(`${npiLabel}: ${b.npi}`);
  if (b.taxId) out.push(`${taxLabel}: ${b.taxId}`);
  const sameProvider = b.npi === r.npi && b.name.startsWith(r.name);
  if (sameProvider) {
    if (r.license) out.push(`License: ${r.license}`);
  } else {
    out.push(`Rendering provider: ${r.name}, ${r.credential ?? ""}`.trim());
    if (r.npi) out.push(`Rendering ${npiLabel}: ${r.npi}`);
    if (r.license) out.push(`License: ${r.license}`);
  }
  return out;
}

function patientLines(spec: SuperbillSpec): string[] {
  const { patient } = spec.label;
  const out = [patient.name];
  if (patient.dob) out.push(`DOB: ${formatDate(patient.dob, spec.render.dateFormat)}`);
  if (patient.address) out.push(patient.address.line1, `${patient.address.city}, ${patient.address.state} ${patient.address.zip}`);
  return out;
}

function header(pen: Pen, spec: SuperbillSpec, pageNo: number, pageCount: number) {
  const { billingProvider: b } = spec.label;
  if (spec.render.style === "statement") {
    text(pen, b.name, M, 16, true);
    rightText(pen, "SUPERBILL", W - M, 14, true);
    pen.y -= 14;
    rightText(pen, "Statement for insurance reimbursement", W - M, 9);
    pen.y -= 6;
  } else {
    const title = "Superbill / Receipt for Services";
    pen.page.drawText(title, { x: (W - pen.bold.widthOfTextAtSize(title, 15)) / 2, y: pen.y, size: 15, font: pen.bold, color: INK });
    pen.y -= 18;
  }
  if (pageCount > 1) {
    rightText(pen, `Page ${pageNo} of ${pageCount}`, W - M, 9);
  }
  pen.y -= 12;

  if (pageNo > 1) {
    text(pen, `${b.name}  |  Client: ${spec.label.patient.name} (continued)`, M, 10, true);
    pen.y -= 18;
    return;
  }

  const top = pen.y;
  if (spec.render.style === "grid") {
    text(pen, "PROVIDER", M, 8, true);
    pen.y -= 13;
    text(pen, b.name, M, 11, true);
    pen.y -= 13;
  }
  for (const l of providerLines(spec)) {
    text(pen, l, M, 10);
    pen.y -= 13;
  }
  const leftBottom = pen.y;

  pen.y = top;
  const cx = 360;
  text(pen, spec.render.style === "grid" ? "CLIENT" : "Client", cx, 8, true);
  pen.y -= 13;
  for (const l of patientLines(spec)) {
    text(pen, l, cx, 10);
    pen.y -= 13;
  }
  pen.y = Math.min(leftBottom, pen.y) - 8;
  rule(pen);
  pen.y -= 16;

  const dx = spec.label.diagnosisCodes;
  const dxText = spec.render.showDxPointers
    ? dx.map((c, i) => `${String.fromCharCode(65 + i)}. ${c}`).join("    ")
    : dx.join(", ");
  const dxLabel = "Diagnosis (ICD-10):";
  text(pen, dxLabel, M, 10, true);
  text(pen, dxText, M + pen.bold.widthOfTextAtSize(dxLabel, 10) + 10, 10);
  pen.y -= 20;
}

function table(pen: Pen, spec: SuperbillSpec, lines: SuperbillSpec["label"]["lines"]) {
  const { showPos, showDxPointers, dateFormat, style } = spec.render;
  const cols: { title: string; x: number; right?: boolean; get: (l: (typeof lines)[number]) => string }[] = [];
  let x = M;
  const add = (title: string, width: number, get: (l: (typeof lines)[number]) => string, right = false) => {
    cols.push({ title, x: right ? x + width : x, right, get });
    x += width;
  };
  const dateTitle = "Date of service";
  const dateWidth = Math.max(dateFormat === "long" ? 84 : 72, pen.bold.widthOfTextAtSize(dateTitle, 8.5) + 12);
  add(dateTitle, dateWidth, (l) => formatDate(l.serviceDate, dateFormat));
  if (showPos) add("POS", 30, (l) => l.placeOfService);
  add("CPT", 42, (l) => l.cpt);
  add("Mod", 40, (l) => l.modifiers.join(" "));
  const fixedRight = (showDxPointers ? 30 : 0) + 36 + 62;
  add("Description", W - M - x - fixedRight, (l) => l.description);
  if (showDxPointers) add("Dx", 30, (l) => pointerLetters(l.diagnosisPointers));
  add("Units", 36, (l) => String(l.units), true);
  add("Charge", 62, (l) => money(l.chargeCents), true);

  for (const c of cols) (c.right ? rightText : text)(pen, c.title, c.x, 8.5, true);
  pen.y -= 6;
  rule(pen, 1);
  pen.y -= 14;

  for (const l of lines) {
    for (const c of cols) {
      const v = c.get(l);
      if (c.title === "Description") {
        const next = cols[cols.indexOf(c) + 1];
        const max = next.x - c.x - (next.right ? 40 : 6);
        // The label must match what is printed, so an overflow is a data error, not something to truncate.
        if (pen.font.widthOfTextAtSize(v, 9.5) > max) throw new Error(`${spec.label.id}: description does not fit: "${v}"`);
      }
      (c.right ? rightText : text)(pen, v, c.x, 9.5);
    }
    pen.y -= style === "grid" ? 8 : 16;
    if (style === "grid") {
      rule(pen, 0.4);
      pen.y -= 12;
    }
  }
}

function totals(pen: Pen, spec: SuperbillSpec) {
  const { totalChargedCents: charged, totalPaidCents: paid } = spec.label;
  pen.y -= 6;
  for (const [k, v, bold] of [
    ["Total charges", money(charged), false],
    ["Amount paid by client", money(paid), false],
    ["Balance due", money(charged - paid), true],
  ] as const) {
    rightText(pen, k, W - M - 80, 10, bold);
    rightText(pen, v, W - M, 10, bold);
    pen.y -= 15;
  }
  pen.y -= 28;
  pen.page.drawLine({ start: { x: M, y: pen.y }, end: { x: M + 220, y: pen.y }, thickness: 0.7, color: RULE });
  pen.y -= 12;
  const r = spec.label.renderingProvider;
  text(pen, `${r.name}${r.credential ? `, ${r.credential}` : ""}`, M, 9);
  pen.y -= 12;
  text(pen, "I certify that the services listed above were provided to the client named.", M, 8);
}

export async function renderSuperbillPdf(spec: SuperbillSpec): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Superbill ${spec.label.id}`);
  const [regular, boldName] = FONTS[spec.render.font];
  const font = await doc.embedFont(regular);
  const bold = await doc.embedFont(boldName);

  const perPage = spec.render.linesPerPage ?? spec.label.lines.length;
  const chunks: SuperbillSpec["label"]["lines"][] = [];
  for (let i = 0; i < spec.label.lines.length; i += perPage) chunks.push(spec.label.lines.slice(i, i + perPage));

  chunks.forEach((chunk, i) => {
    const pen: Pen = { page: doc.addPage([W, H]), font, bold, y: H - M - 10 };
    header(pen, spec, i + 1, chunks.length);
    table(pen, spec, chunk);
    if (i === chunks.length - 1) totals(pen, spec);
  });

  return doc.save();
}
