import { npiFromBase } from "../../src/core/npi";
import type { CardLabel, SuperbillLabel } from "./schema";

// Everything here is invented. NPIs pass the check digit but are not looked up; EINs use the
// never-issued 00- prefix, the SSN uses the invalid 000 area, phones use the fictional 555-01xx block.

export type SuperbillRender = {
  style: "statement" | "grid" | "form-handwritten";
  font: "helvetica" | "times" | "courier";
  dateFormat: "mdy" | "iso" | "long";
  npiLabel: string;
  taxLabel: string;
  showPos: boolean;
  showDxPointers: boolean;
  output: "pdf" | "photo" | "fax";
  linesPerPage?: number;
};

export type SuperbillSpec = { label: Omit<SuperbillLabel, "files">; render: SuperbillRender };

type LineInput = {
  date: string;
  cpt: string;
  description: string;
  units?: number;
  unitCents: number;
  modifiers?: string[];
  pointers?: number[];
  pos?: string;
};

const line = (l: LineInput) => ({
  serviceDate: l.date,
  cpt: l.cpt,
  description: l.description,
  units: l.units ?? 1,
  chargeCents: (l.units ?? 1) * l.unitCents,
  modifiers: l.modifiers ?? [],
  diagnosisPointers: l.pointers ?? [1],
  placeOfService: l.pos ?? "11",
});

const sum = (lines: { chargeCents: number }[]) => lines.reduce((t, l) => t + l.chargeCents, 0);

function spec(
  id: string,
  cases: string[],
  parts: Omit<SuperbillLabel, "id" | "files" | "cases" | "totalChargedCents" | "totalPaidCents" | "expectedFlags"> & {
    expectedFlags?: string[];
    paidCents?: number;
  },
  render: SuperbillRender,
): SuperbillSpec {
  const total = sum(parts.lines);
  const { expectedFlags, paidCents, ...rest } = parts;
  return {
    label: {
      id,
      cases,
      ...rest,
      totalChargedCents: total,
      totalPaidCents: paidCents ?? total,
      expectedFlags: expectedFlags ?? [],
    },
    render,
  };
}

const PSYCH_60 = "Psychotherapy, 60 min";
const PSYCH_45 = "Psychotherapy, 45 min";

export const SUPERBILLS: SuperbillSpec[] = [
  spec(
    "sb-01",
    ["clean", "single-line", "solo-provider"],
    {
      billingProvider: {
        name: "Maya Okafor, LCSW",
        npi: npiFromBase("199900001"),
        taxId: "00-1000001",
        taxIdType: "EIN",
        address: { line1: "418 Juniper St Suite 2", city: "Asheville", state: "NC", zip: "28801" },
        phone: "(828) 555-0142",
      },
      renderingProvider: { name: "Maya Okafor", npi: npiFromBase("199900001"), credential: "LCSW", license: "NC C012345" },
      patient: {
        name: "Jordan Ellis",
        dob: "1989-03-14",
        address: { line1: "22 Haywood Rd Apt 3", city: "Asheville", state: "NC", zip: "28806" },
      },
      diagnosisCodes: ["F41.1"],
      lines: [line({ date: "2026-09-08", cpt: "90837", description: PSYCH_60, unitCents: 22500 })],
    },
    { style: "statement", font: "helvetica", dateFormat: "mdy", npiLabel: "NPI", taxLabel: "Tax ID", showPos: true, showDxPointers: false, output: "pdf" },
  ),
  spec(
    "sb-02",
    ["multi-dos", "long-dates"],
    {
      billingProvider: {
        name: "Rachel Steinberg, LCSW",
        npi: npiFromBase("199900002"),
        taxId: "00-1000002",
        taxIdType: "EIN",
        address: { line1: "151 W 19th St Floor 4", city: "New York", state: "NY", zip: "10011" },
        phone: "(212) 555-0117",
      },
      renderingProvider: { name: "Rachel Steinberg", npi: npiFromBase("199900002"), credential: "LCSW", license: "NY 078812" },
      patient: {
        name: "Samira Haddad",
        dob: "1992-11-02",
        address: { line1: "310 W 20th St Apt 5C", city: "New York", state: "NY", zip: "10011" },
      },
      diagnosisCodes: ["F33.1"],
      lines: ["2026-08-04", "2026-08-11", "2026-08-18", "2026-08-25"].map((date) =>
        line({ date, cpt: "90834", description: PSYCH_45, unitCents: 17500 }),
      ),
    },
    { style: "grid", font: "times", dateFormat: "long", npiLabel: "NPI #", taxLabel: "EIN", showPos: false, showDxPointers: false, output: "pdf" },
  ),
  spec(
    "sb-03",
    ["telehealth", "modifier-95", "pos-10", "iso-dates"],
    {
      billingProvider: {
        name: "Marcus Bell, LPC",
        npi: npiFromBase("199900003"),
        taxId: "00-1000003",
        taxIdType: "EIN",
        address: { line1: "1033 SW Yamhill St Suite 210", city: "Portland", state: "OR", zip: "97205" },
        phone: "(503) 555-0163",
      },
      renderingProvider: { name: "Marcus Bell", npi: npiFromBase("199900003"), credential: "LPC", license: "OR C6120" },
      patient: {
        name: "Caleb Turner",
        dob: "1985-06-27",
        address: { line1: "1420 SW Morrison St", city: "Portland", state: "OR", zip: "97205" },
      },
      diagnosisCodes: ["F43.10"],
      lines: ["2026-08-06", "2026-08-20", "2026-09-03"].map((date) =>
        line({ date, cpt: "90837", description: `${PSYCH_60} (telehealth)`, unitCents: 20000, modifiers: ["95"], pos: "10" }),
      ),
    },
    { style: "statement", font: "courier", dateFormat: "iso", npiLabel: "Provider NPI", taxLabel: "TIN", showPos: true, showDxPointers: false, output: "pdf" },
  ),
  spec(
    "sb-04",
    ["psych-testing", "units", "two-diagnoses", "minor-patient"],
    {
      billingProvider: {
        name: "Reyes Psychological Services",
        npi: npiFromBase("199900004"),
        taxId: "00-1000004",
        taxIdType: "EIN",
        address: { line1: "700 Grant St Suite 310", city: "Denver", state: "CO", zip: "80203" },
        phone: "(303) 555-0128",
      },
      renderingProvider: { name: "Daniel Reyes", npi: npiFromBase("199900014"), credential: "PhD", license: "CO PSY.0004471" },
      patient: { name: "Noah Kim", dob: "2015-02-09", address: { line1: "885 Pearl St", city: "Denver", state: "CO", zip: "80203" } },
      diagnosisCodes: ["F90.2", "F81.0"],
      lines: [
        line({ date: "2026-07-21", cpt: "96136", description: "Test admin and scoring, first 30 min", unitCents: 15000, pointers: [1, 2] }),
        line({ date: "2026-07-21", cpt: "96137", description: "Test admin and scoring, each addl 30 min", units: 5, unitCents: 15000, pointers: [1, 2] }),
        line({ date: "2026-07-28", cpt: "96130", description: "Testing evaluation, first hour", unitCents: 30000, pointers: [1, 2] }),
        line({ date: "2026-07-28", cpt: "96131", description: "Testing evaluation, each addl hour", units: 2, unitCents: 30000, pointers: [1, 2] }),
      ],
    },
    { style: "grid", font: "helvetica", dateFormat: "mdy", npiLabel: "NPI", taxLabel: "Tax ID", showPos: true, showDxPointers: true, output: "pdf" },
  ),
  spec(
    "sb-05",
    ["psychiatry", "em-plus-addon", "diagnosis-pointers"],
    {
      billingProvider: {
        name: "Priya Natarajan, MD",
        npi: npiFromBase("199900005"),
        taxId: "00-1000005",
        taxIdType: "EIN",
        address: { line1: "200 Clarendon St Suite 1450", city: "Boston", state: "MA", zip: "02116" },
        phone: "(617) 555-0109",
      },
      renderingProvider: { name: "Priya Natarajan", npi: npiFromBase("199900005"), credential: "MD", license: "MA 251904" },
      patient: { name: "Alicia Brandt", dob: "1978-09-30", address: { line1: "75 Marlborough St", city: "Boston", state: "MA", zip: "02116" } },
      diagnosisCodes: ["F31.81", "F41.1"],
      lines: [
        line({ date: "2026-08-12", cpt: "99214", description: "Office visit, established pt, moderate", unitCents: 25000, pointers: [1, 2] }),
        line({ date: "2026-08-12", cpt: "90833", description: "Psychotherapy add-on, 30 min", unitCents: 12000, pointers: [1] }),
        line({ date: "2026-09-09", cpt: "99213", description: "Office visit, established pt, low", unitCents: 17500, pointers: [2] }),
      ],
    },
    { style: "grid", font: "times", dateFormat: "mdy", npiLabel: "National Provider ID", taxLabel: "Tax ID", showPos: true, showDxPointers: true, output: "pdf" },
  ),
  spec(
    "sb-06",
    ["group-practice", "billing-npi-differs", "two-modifiers", "mixed-pos"],
    {
      billingProvider: {
        name: "Harbor Light Therapy Group LLC",
        npi: npiFromBase("199900006"),
        taxId: "00-1000006",
        taxIdType: "EIN",
        address: { line1: "26 Court St Suite 1200", city: "Brooklyn", state: "NY", zip: "11201" },
        phone: "(718) 555-0155",
      },
      renderingProvider: { name: "Sofia Marchetti", npi: npiFromBase("199900016"), credential: "LMHC", license: "NY 010447" },
      patient: { name: "Devon Price", dob: "1996-01-18", address: { line1: "144 Court St Apt 2", city: "Brooklyn", state: "NY", zip: "11201" } },
      diagnosisCodes: ["F43.23"],
      lines: [
        line({ date: "2026-08-05", cpt: "90791", description: "Psychiatric diagnostic evaluation", unitCents: 30000, modifiers: ["HO"] }),
        line({ date: "2026-08-19", cpt: "90837", description: `${PSYCH_60} (telehealth)`, unitCents: 24000, modifiers: ["HO", "95"], pos: "10" }),
      ],
    },
    { style: "statement", font: "helvetica", dateFormat: "mdy", npiLabel: "NPI", taxLabel: "Tax ID", showPos: true, showDxPointers: false, output: "pdf" },
  ),
  spec(
    "sb-07",
    ["ssn-as-tax-id", "family-therapy", "z-code"],
    {
      billingProvider: {
        name: "Tom Whitfield, LMFT",
        npi: npiFromBase("199900007"),
        taxId: "000-45-6789",
        taxIdType: "SSN",
        address: { line1: "3300 Grand Ave Suite B", city: "Oakland", state: "CA", zip: "94610" },
        phone: "(510) 555-0171",
      },
      renderingProvider: { name: "Tom Whitfield", npi: npiFromBase("199900007"), credential: "LMFT", license: "CA LMFT 104882" },
      patient: { name: "Hannah Whitlock", dob: "1983-12-05", address: { line1: "612 Mandana Blvd", city: "Oakland", state: "CA", zip: "94610" } },
      diagnosisCodes: ["F43.25", "Z63.0"],
      lines: ["2026-09-02", "2026-09-16"].map((date) =>
        line({ date, cpt: "90847", description: "Family psychotherapy w/ patient, 50 min", unitCents: 22000, pointers: [1, 2] }),
      ),
    },
    { style: "statement", font: "times", dateFormat: "long", npiLabel: "NPI", taxLabel: "Tax ID/SSN", showPos: false, showDxPointers: true, output: "pdf" },
  ),
  spec(
    "sb-08",
    ["missing-npi", "photo", "skewed"],
    {
      billingProvider: {
        name: "Elena Vasquez, LPC",
        npi: null,
        taxId: "00-1000008",
        taxIdType: "EIN",
        address: { line1: "1108 Lavaca St Suite 110", city: "Austin", state: "TX", zip: "78701" },
        phone: "(512) 555-0136",
      },
      renderingProvider: { name: "Elena Vasquez", npi: null, credential: "LPC", license: "TX 78214" },
      patient: { name: "Luis Ortega", dob: "1990-07-22", address: { line1: "2209 S 1st St", city: "Austin", state: "TX", zip: "78704" } },
      diagnosisCodes: ["F41.1"],
      lines: ["2026-08-27", "2026-09-10"].map((date) => line({ date, cpt: "90834", description: PSYCH_45, unitCents: 16500 })),
      expectedFlags: ["missing_billing_npi", "missing_rendering_npi"],
    },
    { style: "statement", font: "helvetica", dateFormat: "mdy", npiLabel: "NPI", taxLabel: "EIN", showPos: false, showDxPointers: false, output: "photo" },
  ),
  spec(
    "sb-09",
    ["handwritten", "photo"],
    {
      billingProvider: {
        name: "Karen Liu, PsyD",
        npi: npiFromBase("199900009"),
        taxId: "00-1000009",
        taxIdType: "EIN",
        address: { line1: "680 N Lake Shore Dr Suite 914", city: "Chicago", state: "IL", zip: "60611" },
        phone: "(312) 555-0184",
      },
      renderingProvider: { name: "Karen Liu", npi: npiFromBase("199900009"), credential: "PsyD", license: "IL 071.009921" },
      patient: { name: "Megan Doyle", dob: "1987-04-11", address: null },
      diagnosisCodes: ["F32.1"],
      lines: [line({ date: "2026-09-10", cpt: "90837", description: PSYCH_60, unitCents: 25000 })],
    },
    { style: "form-handwritten", font: "helvetica", dateFormat: "mdy", npiLabel: "NPI", taxLabel: "Tax ID", showPos: true, showDxPointers: false, output: "photo" },
  ),
  spec(
    "sb-10",
    ["fax-quality", "two-page", "group-practice", "mixed-telehealth"],
    {
      billingProvider: {
        name: "Northside Behavioral Health PC",
        npi: npiFromBase("199900010"),
        taxId: "00-1000010",
        taxIdType: "EIN",
        address: { line1: "1375 Peachtree St NE Suite 600", city: "Atlanta", state: "GA", zip: "30309" },
        phone: "(404) 555-0190",
      },
      renderingProvider: { name: "James Abara", npi: npiFromBase("199900020"), credential: "LCSW", license: "GA CSW007315" },
      patient: { name: "Tyrone Bassett", dob: "1975-10-08", address: { line1: "940 Virginia Ave NE", city: "Atlanta", state: "GA", zip: "30306" } },
      diagnosisCodes: ["F33.2"],
      lines: ["2026-07-07", "2026-07-14", "2026-07-21", "2026-07-28", "2026-08-04", "2026-08-11"].map((date, i) =>
        i % 2 === 1
          ? line({ date, cpt: "90837", description: `${PSYCH_60} (telehealth)`, unitCents: 21000, modifiers: ["95"], pos: "10" })
          : line({ date, cpt: "90837", description: PSYCH_60, unitCents: 21000 }),
      ),
      paidCents: 105000,
    },
    { style: "grid", font: "courier", dateFormat: "mdy", npiLabel: "NPI", taxLabel: "Tax ID", showPos: true, showDxPointers: false, output: "fax", linesPerPage: 3 },
  ),
];

export type CardSpec = {
  label: Omit<CardLabel, "files">;
  accent: string;
  frontExtras: string[];
  backExtras: string[];
};

// Member data is synthetic. For S7, swap in Stedi's documented mock subscribers here and regenerate,
// so a card photo drives a real mock 271.
export const CARDS: CardSpec[] = [
  {
    label: {
      id: "card-01", payerName: "Aetna", payerDirectoryKey: "aetna", planName: "Open Choice PPO", planType: "PPO", gated: false,
      memberId: "W268417359", groupNumber: "0285716-10-001", subscriberName: "Jordan Ellis",
      claimsAddress: "Aetna, PO Box 981106, El Paso, TX 79998-1106", payerPhone: "1-800-555-0110",
    },
    accent: "#7D3F98",
    frontExtras: ["RxBIN 610502", "RxPCN ADV", "PCP $30  Spec $50", "OON Ded $1,500  OON Coins 30%"],
    backExtras: ["Payer ID 60054"],
  },
  {
    label: {
      id: "card-02", payerName: "Cigna", payerDirectoryKey: "cigna", planName: "Open Access Plus", planType: "PPO", gated: false,
      memberId: "U4827193 01", groupNumber: "3340127", subscriberName: "Samira Haddad",
      claimsAddress: "Cigna, PO Box 182223, Chattanooga, TN 37422-7223", payerPhone: "1-800-555-0120",
    },
    accent: "#0A6EB4",
    frontExtras: ["RxBIN 017010", "RxGrp 3340127", "In-Net Ded $750  OON Ded $2,000", "Coinsurance 80% / 60%"],
    backExtras: ["Payer ID 62308"],
  },
  {
    label: {
      id: "card-03", payerName: "UnitedHealthcare", payerDirectoryKey: "uhc", planName: "Choice Plus", planType: "POS", gated: false,
      memberId: "918452673", groupNumber: "706214", subscriberName: "Caleb Turner",
      claimsAddress: "UnitedHealthcare, PO Box 30555, Salt Lake City, UT 84130-0555", payerPhone: "1-866-555-0130",
    },
    accent: "#002677",
    frontExtras: ["Payer ID 87726", "RxBIN 610279", "Office $25  Specialist $50", "Behavioral health: United Behavioral Health"],
    backExtras: ["Mental health claims: PO Box 30757, Salt Lake City, UT 84130"],
  },
  {
    label: {
      id: "card-04", payerName: "Anthem Blue Cross", payerDirectoryKey: "anthem_ca", planName: "Prudent Buyer PPO", planType: "PPO", gated: false,
      memberId: "JQU123A45678", groupNumber: "CA4471B", subscriberName: "Hannah Whitlock",
      claimsAddress: "Anthem Blue Cross, PO Box 60007, Los Angeles, CA 90060-0007", payerPhone: "1-800-555-0140",
    },
    accent: "#0079C2",
    frontExtras: ["Plan code 040", "RxBIN 020099", "Office visit $35", "Out-of-network deductible $3,000"],
    backExtras: ["Providers: file claims with your local Blue Cross and/or Blue Shield plan"],
  },
  {
    label: {
      id: "card-05", payerName: "Blue Cross and Blue Shield of Texas", payerDirectoryKey: "bcbs_tx", planName: "Blue Choice PPO", planType: "PPO", gated: false,
      memberId: "ZGP845210937", groupNumber: "128844", subscriberName: "Luis Ortega",
      claimsAddress: "BCBSTX, PO Box 660044, Dallas, TX 75266-0044", payerPhone: "1-800-555-0150",
    },
    accent: "#1B75BC",
    frontExtras: ["Plan 84", "RxBIN 011552", "PCP $30  SCP $60", "Ded $1,000 / OON $2,500"],
    backExtras: ["Payer ID 84980"],
  },
  {
    label: {
      id: "card-06", payerName: "Kaiser Permanente", payerDirectoryKey: "kaiser", planName: "Traditional HMO", planType: "HMO", gated: true,
      memberId: "11024839", groupNumber: "604418", subscriberName: "Megan Doyle",
      claimsAddress: null, payerPhone: "1-800-555-0160",
    },
    accent: "#006BA6",
    frontExtras: ["Medical record number shown above", "Office visit $20", "Region: Northern California"],
    backExtras: ["Care must be received at Kaiser Permanente facilities except emergencies"],
  },
  {
    label: {
      id: "card-07", payerName: "Amerigroup Community Care", payerDirectoryKey: null, planName: "Georgia Families (Medicaid)", planType: "MEDICAID", gated: true,
      memberId: "722104938201", groupNumber: null, subscriberName: "Tyrone Bassett",
      claimsAddress: "Amerigroup, PO Box 61010, Virginia Beach, VA 23466-1010", payerPhone: "1-800-555-0170",
    },
    accent: "#00A79D",
    frontExtras: ["Medicaid ID 722104938201", "PCP: Northside Family Medicine", "Effective 01/01/2026"],
    backExtras: ["This card does not guarantee eligibility"],
  },
  {
    label: {
      id: "card-08", payerName: "Medicare", payerDirectoryKey: "cms_medicare", planName: "Medicare Health Insurance", planType: "MEDICARE", gated: true,
      memberId: "1EG4-TE5-MK73", groupNumber: null, subscriberName: "Alicia Brandt",
      claimsAddress: null, payerPhone: "1-800-MEDICARE",
    },
    accent: "#C8102E",
    frontExtras: ["Entitled to: HOSPITAL (PART A) 03-01-2016", "MEDICAL (PART B) 03-01-2016"],
    backExtras: ["You can use this card at doctors and hospitals that accept Medicare"],
  },
];
