import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Field, StatusBadge } from "@/components/ui";

describe("component tests", () => {
  afterEach(cleanup);

  it("run under happy-dom", () => {
    expect(navigator.userAgent).toContain("HappyDOM");
  });

  it("render a real component with Testing Library", () => {
    render(
      <>
        <StatusBadge status="paid" />
        <Field label="Member ID" name="memberId" defaultValue="SYN000" />
      </>,
    );
    expect(screen.getByLabelText("Member ID")).toHaveProperty("value", "SYN000");
  });
});
