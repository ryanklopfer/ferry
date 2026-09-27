import { afterEach, describe, expect, it, vi } from "vitest";
import { draftFollowUp, extractSuperbill } from "@/lib/ai";
import { assertSyntheticDirectApi, DirectApiRefused } from "./guard";

const REFUSED = [
  { FERRY_DEPLOY_TIER: "dev", FERRY_DATA_CLASS: "" },
  { FERRY_DEPLOY_TIER: "dev", FERRY_DATA_CLASS: "deidentified" },
  { FERRY_DEPLOY_TIER: "dev", FERRY_DATA_CLASS: "real" },
  { FERRY_DEPLOY_TIER: "prelaunch", FERRY_DATA_CLASS: "synthetic" },
  { FERRY_DEPLOY_TIER: "staging", FERRY_DATA_CLASS: "synthetic" },
  { FERRY_DEPLOY_TIER: "prod", FERRY_DATA_CLASS: "synthetic" },
  { FERRY_DEPLOY_TIER: "prod", FERRY_DATA_CLASS: "real" },
];

const letterCtx = {
  claim: { id: "clm_1", serviceDateStart: "2026-09-01", serviceDateEnd: null, submittedAt: new Date("2026-09-02"), submissionChannel: "mail", confirmationNumber: null, diagnosisCodes: [], totalCharged: 20000, totalPaid: 20000, billingProviderName: "Synthetic Provider", renderingProviderName: null },
  plan: { insurerName: "Synthetic Health", memberId: "SYN000", groupNumber: null, subscriberName: "Synthetic Subscriber", patientName: "Synthetic Subscriber", patientDob: null, patientPhone: null, patientEmail: null, preferredChannel: "mail" },
  lines: [],
} as never;

const fakeMessage = () =>
  new Response(JSON.stringify({ id: "msg_1", type: "message", role: "assistant", model: "m", content: [{ type: "text", text: '{"subject":"s","body":"b"}' }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }), {
    headers: { "content-type": "application/json" },
  });

describe("assertSyntheticDirectApi", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each(REFUSED)("refuses tier $FERRY_DEPLOY_TIER with data class $FERRY_DATA_CLASS", (env) => {
    expect(() => assertSyntheticDirectApi(env)).toThrow(DirectApiRefused);
  });

  it("allows synthetic data in the dev tier", () => {
    expect(() => assertSyntheticDirectApi({ FERRY_DEPLOY_TIER: "dev", FERRY_DATA_CLASS: "synthetic" })).not.toThrow();
  });

  it("refuses when FERRY_DATA_CLASS was never declared", () => {
    expect(() => assertSyntheticDirectApi({})).toThrow(/data class is real/);
    expect(() => assertSyntheticDirectApi({ FERRY_DEPLOY_TIER: "dev" })).toThrow(DirectApiRefused);
  });

  it.each(REFUSED)("makes no request from src/lib/ai.ts in tier $FERRY_DEPLOY_TIER with $FERRY_DATA_CLASS", async (env) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => fakeMessage());
    vi.stubEnv("ANTHROPIC_API_KEY", "test-placeholder-not-a-key");
    vi.stubEnv("FERRY_DEPLOY_TIER", env.FERRY_DEPLOY_TIER);
    vi.stubEnv("FERRY_DATA_CLASS", env.FERRY_DATA_CLASS);
    await expect(extractSuperbill(Buffer.from("x"), "image/png")).rejects.toThrow(DirectApiRefused);
    await expect(draftFollowUp("status_inquiry", letterCtx)).rejects.toThrow(DirectApiRefused);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("lets src/lib/ai.ts through for synthetic data in dev (fetch stubbed, nothing leaves the machine)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => fakeMessage());
    vi.stubEnv("ANTHROPIC_API_KEY", "test-placeholder-not-a-key");
    vi.stubEnv("FERRY_DEPLOY_TIER", "dev");
    vi.stubEnv("FERRY_DATA_CLASS", "synthetic");
    await draftFollowUp("status_inquiry", letterCtx);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
