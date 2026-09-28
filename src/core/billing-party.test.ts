import { describe, expect, it } from "vitest";
import { type BillingProfile, billingParty, BillingPartyError } from "./clinician";

const address = { line1: "2 Practice St", line2: "Suite 4", city: "Oakland", state: "CA", zip: "94610" };
const solo: BillingProfile = {
  legalName: "Rachel Steinberg",
  credential: "LCSW",
  npi: "1999000023",
  npiType: "individual",
  groupName: null,
  groupNpi: null,
  taxId: "900114242",
  taxIdType: "SSN",
  practiceAddress: address,
  taxonomyCode: "1041C0700X",
};
const group: BillingProfile = { ...solo, npiType: "group", groupName: "Bayside Counseling Group", groupNpi: "1234567893", taxId: "001000002", taxIdType: "EIN" };

describe("billingParty", () => {
  it.each([
    {
      name: "solo NPI-1 bills and renders",
      profile: solo,
      billing: { entity: "person", name: "Rachel Steinberg", npi: "1999000023", taxId: "900114242", taxIdType: "SSN" },
      rendering: { name: "Rachel Steinberg", credential: "LCSW", npi: "1999000023" },
    },
    {
      name: "solo NPI-1 may bill under an EIN",
      profile: { ...solo, taxId: "001000002", taxIdType: "EIN" as const },
      billing: { entity: "person", name: "Rachel Steinberg", npi: "1999000023", taxId: "001000002", taxIdType: "EIN" },
      rendering: { name: "Rachel Steinberg", credential: "LCSW", npi: "1999000023" },
    },
    {
      name: "a group bills under its NPI-2 and EIN, with the clinician's NPI-1 rendering",
      profile: group,
      billing: { entity: "organization", name: "Bayside Counseling Group", npi: "1234567893", taxId: "001000002", taxIdType: "EIN" },
      rendering: { name: "Rachel Steinberg", credential: "LCSW", npi: "1999000023" },
    },
  ])("$name", ({ profile, billing, rendering }) => {
    const party = billingParty(profile);
    expect(party.billing).toEqual({ ...billing, address, taxonomyCode: "1041C0700X" });
    expect(party.rendering).toEqual({ ...rendering, taxonomyCode: "1041C0700X" });
  });

  it("refuses a group without its NPI-2 or name, or billing under an SSN", () => {
    expect(() => billingParty({ ...group, groupNpi: null })).toThrow(BillingPartyError);
    expect(() => billingParty({ ...group, groupName: null })).toThrow(BillingPartyError);
    expect(() => billingParty({ ...group, taxIdType: "SSN" })).toThrow(/group_needs_ein/);
  });
});
