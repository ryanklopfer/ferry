import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Chip } from "@/ui/chip";
import { Field } from "@/ui/field";

describe("component tests", () => {
  afterEach(cleanup);

  it("run under happy-dom", () => {
    expect(navigator.userAgent).toContain("HappyDOM");
  });

  it("render a real component with Testing Library", () => {
    render(
      <>
        <Chip kind="landed" />
        <Field label="Member ID" name="memberId" defaultValue="SYN000" />
      </>,
    );
    expect(screen.getByLabelText("Member ID")).toHaveProperty("value", "SYN000");
  });
});
