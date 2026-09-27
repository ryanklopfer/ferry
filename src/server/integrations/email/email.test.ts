import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotConfigured, VendorOff } from "@/server/integrations/mode";
import { email, sentInThisProcess } from "./index";

const message = { to: "jordan.ellis@example.test", subject: "Your claim update", text: "Your visit on 2026-09-01 for F43.25 was paid $120." };
const signIn = { to: "jordan.ellis@example.test", subject: "Your sign-in link", text: "Here's your link: https://localhost:3000/verify?token=abc", signInLink: "https://localhost:3000/verify?token=abc" };

async function consoleOf(run: () => Promise<void>): Promise<string> {
  const lines: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => void lines.push(args.join(" ")));
  await run();
  spy.mockRestore();
  return lines.join("\n");
}

const pathsIn = (out: string) => [...out.matchAll(/\[email:fixture\] (\/\S+\.json)/g)].map((m) => m[1]);

describe("email", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("records what it was asked to send and writes it to the outbox", async () => {
    sentInThisProcess.length = 0;
    const out = await consoleOf(() => email.send(message));
    expect(sentInThisProcess).toEqual([message]);
    const [file] = pathsIn(out);
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual(message);
  });

  it("prints no body text, subject or address for ordinary mail", async () => {
    const out = await consoleOf(() => email.send(message));
    expect(pathsIn(out)).toHaveLength(1);
    for (const secret of ["2026-09-01", "F43.25", "$120", "claim update", "jordan.ellis"]) expect(out).not.toContain(secret);
  });

  it("prints only the outbox path and the link for sign-in mail", async () => {
    const out = await consoleOf(() => email.send(signIn));
    const [file] = pathsIn(out);
    expect(out.split("\n")).toEqual([`[email:fixture] ${file}`, `[email:fixture] sign-in link ${signIn.signInLink}`]);
  });

  it("throws NotConfigured in live and test mode until SES lands", async () => {
    vi.stubEnv("FERRY_EMAIL_MODE", "live");
    await expect(email.send(message)).rejects.toThrow(NotConfigured);
    vi.stubEnv("FERRY_EMAIL_MODE", "test");
    await expect(email.send(message)).rejects.toThrow(NotConfigured);
  });

  it("throws VendorOff when email is off", async () => {
    vi.stubEnv("FERRY_EMAIL_MODE", "off");
    await expect(email.send(message)).rejects.toThrow(VendorOff);
  });

  it("refuses the fixture outside the dev tier", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(email.send(message)).rejects.toThrow(/FERRY_DEPLOY_TIER/);
    vi.stubEnv("FERRY_DEPLOY_TIER", "staging");
    await expect(email.send(message)).rejects.toThrow(VendorOff);
    vi.stubEnv("FERRY_EMAIL_MODE", "fixture");
    await expect(email.send(message)).rejects.toThrow(/email: mode fixture/);
  });
});
