import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FILING_FIELDS, RECORDING_PROMISES } from "@/core/copy/consent";
import { FilingConsentDetails, RecordingConsentDetails } from "./consent-details";

describe("the filing consent screen", () => {
  afterEach(cleanup);

  it("lists name, DOB, member ID, diagnosis, procedure codes, dates and charges, each with a reason", () => {
    render(<FilingConsentDetails insurer="Cigna" />);
    const list = screen.getByRole("list", { name: "What we send to Cigna" });
    const items = within(list).getAllByRole("listitem");
    expect(FILING_FIELDS.map((f) => f.key)).toEqual(["name", "dob", "memberId", "diagnosis", "procedureCodes", "dates", "charges"]);
    expect(items).toHaveLength(FILING_FIELDS.length);
    FILING_FIELDS.forEach((field, i) => {
      expect(within(items[i]).getByText(field.label)).toBeTruthy();
      expect(within(items[i]).getByText(field.reason)).toBeTruthy();
      expect(field.reason.length, field.key).toBeGreaterThan(15);
      expect(field.reason, field.key).not.toMatch(/\n/);
    });
    const text = list.textContent ?? "";
    for (const words of [/name/i, /date of birth/i, /member ID/i, /diagnosis/i, /procedure codes/i, /dates/i, /charges/i]) expect(text).toMatch(words);
  });

  it("names no insurer when none is on file yet", () => {
    render(<FilingConsentDetails />);
    expect(screen.getByRole("list", { name: "What we send to your insurer" })).toBeTruthy();
  });
});

describe("the recording consent screen", () => {
  afterEach(cleanup);

  it("says audio is never stored, transcripts are erased within 24 hours and nothing trains a model", () => {
    render(<RecordingConsentDetails />);
    const text = document.body.textContent ?? "";
    expect(RECORDING_PROMISES).toHaveLength(3);
    for (const promise of RECORDING_PROMISES) expect(text).toContain(promise);
    expect(text).toMatch(/audio is never stored/i);
    expect(text).toMatch(/erased within 24 hours/i);
    expect(text).toMatch(/model training/i);
  });
});
