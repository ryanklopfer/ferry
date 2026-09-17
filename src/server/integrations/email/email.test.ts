import { afterEach, describe, expect, it, vi } from "vitest";
import { email, sentInThisProcess } from "./index";

const message = { to: "jordan.ellis@example.test", subject: "Hello", text: "A link" };

describe("fixture email sender", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("records what it was asked to send", async () => {
    sentInThisProcess.length = 0;
    await email.send(message);
    expect(sentInThisProcess).toEqual([message]);
  });

  it("refuses to run in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(email.send(message)).rejects.toThrow(/production/);
  });
});
