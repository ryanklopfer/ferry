import Anthropic from "@anthropic-ai/sdk";
import { assertSyntheticDirectApi } from "@/server/integrations/llm/guard";
import type { FollowUpType } from "@/server/db/schema";
import { EMPTY_EXTRACTION, EXTRACTION_PROMPT, parseExtraction, type Extraction } from "./extraction";
import { claimSummaryBlock, templateFor, type LetterContext } from "./templates";
import { FOLLOW_UP_LABELS } from "./followups";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

function client() {
  assertSyntheticDirectApi();
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function extractSuperbill(file: Buffer, mime: string): Promise<Extraction> {
  if (!aiEnabled()) {
    return { ...EMPTY_EXTRACTION, notes: "AI extraction is off (no ANTHROPIC_API_KEY). Fill in the fields from your superbill." };
  }
  const data = file.toString("base64");
  const source =
    mime === "application/pdf"
      ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data } } as const)
      : ({ type: "image", source: { type: "base64", media_type: mime as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data } } as const);

  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [{ role: "user", content: [source, { type: "text", text: EXTRACTION_PROMPT }] }],
  });
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return parseExtraction(text);
}

export async function draftFollowUp(type: FollowUpType, ctx: LetterContext): Promise<{ subject: string; body: string }> {
  const template = templateFor(type, ctx);
  if (!aiEnabled()) return template;

  const { claim, plan } = ctx;
  const prompt = `You are helping a patient get reimbursed by their health insurer for an out-of-network claim. Write a ${FOLLOW_UP_LABELS[type].toLowerCase()} letter from the patient/subscriber to ${plan.insurerName}.

Claim facts:
${claimSummaryBlock(ctx)}
${claim.denialReason ? `Denial reason from EOB: ${claim.denialReason}` : ""}
${claim.infoRequested ? `Information the insurer requested: ${claim.infoRequested}` : ""}
Preferred submission channel: ${plan.preferredChannel}

Here is a baseline template to improve on:
---
${template.body}
---

Requirements: firm, polite, specific; cite claim identifiers at the top; make concrete asks with a response deadline; reference prompt-pay / ERISA appeal rights only where accurate and relevant; never invent facts not provided (use [brackets] for anything the patient must fill in); plain text, no markdown. Return JSON: {"subject": string, "body": string}.`;

  const res = await client().messages.create({ model: MODEL, max_tokens: 2000, messages: [{ role: "user", content: prompt }] });
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  try {
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}");
    const json = JSON.parse(text.slice(s, e + 1));
    if (typeof json.subject === "string" && typeof json.body === "string") return json;
  } catch {}
  return template;
}
