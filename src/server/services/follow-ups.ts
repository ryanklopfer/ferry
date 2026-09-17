import { draftFollowUp } from "@/lib/ai";
import type { Ctx } from "@/server/auth/ctx";
import { NotOwnedError } from "@/server/errors";
import { eventsRepo } from "@/server/db/repos/events";
import { followUpsRepo } from "@/server/db/repos/follow-ups";
import { getClaim } from "./claims";

export async function generateDraft(ctx: Ctx, id: string): Promise<string> {
  const followUp = await followUpsRepo.get(ctx, id);
  if (!followUp) throw new NotOwnedError("Follow-up");
  const view = await getClaim(ctx, followUp.claimId);
  if (!view) throw new NotOwnedError("Claim");
  const draft = await draftFollowUp(followUp.type, { claim: view.claim, plan: view.plan, lines: view.lines });
  await followUpsRepo.update(ctx, id, { status: "drafted", draftSubject: draft.subject, draftBody: draft.body });
  await eventsRepo.append(ctx, followUp.claimId, "followup:drafted", draft.subject);
  return followUp.claimId;
}

export type FollowUpAction = { action: "sent" | "dismiss" | "save"; subject: string | null; body: string | null };

export async function updateFollowUp(ctx: Ctx, id: string, input: FollowUpAction): Promise<string> {
  const followUp = await followUpsRepo.get(ctx, id);
  if (!followUp) throw new NotOwnedError("Follow-up");
  if (input.action === "sent") {
    await followUpsRepo.update(ctx, id, { status: "sent", sentAt: new Date(), draftSubject: input.subject ?? followUp.draftSubject, draftBody: input.body ?? followUp.draftBody });
    await eventsRepo.append(ctx, followUp.claimId, "followup:sent", followUp.draftSubject ?? followUp.type);
  } else if (input.action === "dismiss") {
    await followUpsRepo.dismiss(ctx, [id]);
  } else {
    await followUpsRepo.update(ctx, id, { draftSubject: input.subject, draftBody: input.body });
  }
  return followUp.claimId;
}
