import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import { format } from "date-fns";
import { fromCents } from "./extraction";
import { coverLetter, type LetterContext } from "./templates";

const PAGE: [number, number] = [612, 792];
const M = 54;

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(private doc: PDFDocument, private font: PDFFont, private bold: PDFFont) {
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage(PAGE);
    this.y = PAGE[1] - M;
  }
  ensure(h: number) {
    if (this.y - h < M) this.newPage();
  }
  text(s: string, opts: { size?: number; bold?: boolean; x?: number; gap?: number } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.font;
    const maxW = PAGE[0] - 2 * M - ((opts.x ?? M) - M);
    for (const para of s.split("\n")) {
      const lines = wrap(para, font, size, maxW);
      for (const line of lines) {
        this.ensure(size + 4);
        this.page.drawText(line, { x: opts.x ?? M, y: this.y - size, size, font, color: rgb(0.1, 0.1, 0.1) });
        this.y -= size + 4;
      }
      if (lines.length === 0) this.y -= size + 4;
    }
    this.y -= opts.gap ?? 0;
  }
  heading(s: string) {
    this.y -= 6;
    this.text(s, { size: 12, bold: true, gap: 2 });
    this.page.drawLine({ start: { x: M, y: this.y + 2 }, end: { x: PAGE[0] - M, y: this.y + 2 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
    this.y -= 6;
  }
  field(label: string, value: string | null | undefined) {
    this.ensure(14);
    this.page.drawText(label, { x: M, y: this.y - 10, size: 9, font: this.bold, color: rgb(0.35, 0.35, 0.35) });
    this.page.drawText(value?.trim() || "—", { x: M + 170, y: this.y - 10, size: 10, font: this.font });
    this.y -= 15;
  }
  row(cols: string[], widths: number[], bold = false) {
    this.ensure(14);
    let x = M;
    cols.forEach((c, i) => {
      this.page.drawText(clip(c, bold ? this.bold : this.font, 9, widths[i] - 4), { x, y: this.y - 10, size: 9, font: bold ? this.bold : this.font });
      x += widths[i];
    });
    this.y -= 14;
  }
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(t, size) > maxW && cur) {
      out.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}

function clip(s: string, font: PDFFont, size: number, maxW: number) {
  let t = s;
  while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxW) t = t.slice(0, -2) + "…";
  return t;
}

const mdy = (s: string | null | undefined) => (s ? format(new Date(s + "T00:00:00"), "MM/dd/yyyy") : "—");

export async function buildPacket(ctx: LetterContext, superbill?: { bytes: Buffer; mime: string }) {
  const { claim, plan, lineItems } = ctx;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(doc, font, bold);

  // Page 1: cover letter
  w.text(coverLetter(ctx));

  // Page 2: claim form
  w.newPage();
  w.text("OUT-OF-NETWORK MEDICAL CLAIM FORM", { size: 16, bold: true });
  w.text(`Prepared ${format(new Date(), "MM/dd/yyyy")} · Claim ref SC-${claim.id}`, { size: 9, gap: 4 });

  w.heading("1. Insurance information");
  w.field("Insurance company", plan.insurerName);
  w.field("Plan name", plan.planName);
  w.field("Member / Subscriber ID", plan.memberId);
  w.field("Group number", plan.groupNumber);

  w.heading("2. Subscriber");
  w.field("Subscriber name", plan.subscriberName);
  w.field("Subscriber date of birth", mdy(plan.subscriberDob));
  w.field("Address", plan.patientAddress);
  w.field("Phone / email", [plan.patientPhone, plan.patientEmail].filter(Boolean).join("  ·  "));

  w.heading("3. Patient");
  w.field("Patient name", plan.patientName);
  w.field("Patient date of birth", mdy(plan.patientDob));
  w.field("Relationship to subscriber", plan.patientRelationship);

  w.heading("4. Provider");
  w.field("Provider / practice", claim.providerName);
  w.field("NPI", claim.providerNpi);
  w.field("Tax ID (EIN)", claim.providerTaxId);
  w.field("Address", claim.providerAddress);
  w.field("Phone", claim.providerPhone);
  w.field("Place of service code", claim.placeOfService);

  w.heading("5. Diagnosis (ICD-10)");
  w.text(claim.diagnosisCodes.map((c, i) => `${String.fromCharCode(65 + i)}. ${c}`).join("    ") || "—", { gap: 2 });

  w.heading("6. Services rendered");
  const widths = [80, 70, 55, 190, 40, 69];
  w.row(["Date of service", "CPT/HCPCS", "Modifier", "Description", "Units", "Charge"], widths, true);
  for (const li of lineItems) {
    w.row([mdy(li.serviceDate), li.cptCode, li.modifier ?? "", li.description ?? "", String(li.units), `$${fromCents(li.charge)}`], widths);
  }
  w.y -= 4;
  w.field("Total charged", `$${fromCents(claim.totalCharged)}`);
  w.field("Amount paid by patient", `$${fromCents(claim.totalPaid)}`);
  w.field("Assignment of benefits", "None — pay subscriber directly");

  w.heading("7. Certification and signature");
  w.text(
    "I certify that the information above is true and correct, that the services were received by the patient named, and that I paid the provider the amount shown. I authorize the release of any medical information necessary to process this claim.",
    { size: 9, gap: 18 },
  );
  w.text("Signature: ______________________________________        Date: ________________", { size: 10 });

  // Superbill attachment
  if (superbill) {
    if (superbill.mime === "application/pdf") {
      const src = await PDFDocument.load(superbill.bytes);
      const pages = await doc.copyPages(src, src.getPageIndices());
      pages.forEach((p) => doc.addPage(p));
    } else if (superbill.mime === "image/png" || superbill.mime === "image/jpeg") {
      const img = superbill.mime === "image/png" ? await doc.embedPng(superbill.bytes) : await doc.embedJpg(superbill.bytes);
      const page = doc.addPage(PAGE);
      const scale = Math.min((PAGE[0] - 2 * M) / img.width, (PAGE[1] - 2 * M - 20) / img.height, 1);
      page.drawText("Attachment: itemized superbill", { x: M, y: PAGE[1] - M, size: 10, font: bold });
      page.drawImage(img, { x: M, y: PAGE[1] - M - 20 - img.height * scale, width: img.width * scale, height: img.height * scale });
    }
  }

  return doc.save();
}
