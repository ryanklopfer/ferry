import { buildPacket } from "@/lib/packet";
import type { Ctx } from "@/server/auth/ctx";
import { eventsRepo } from "@/server/db/repos/events";
import { getFile } from "@/server/storage/local";
import { getClaim } from "./claims";

export async function getSuperbill(ctx: Ctx, claimId: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const view = await getClaim(ctx, claimId);
  if (!view?.superbill) return null;
  return { bytes: await getFile(view.superbill.storageKey), mime: view.superbill.mime };
}

export async function buildClaimPacket(ctx: Ctx, claimId: string): Promise<{ pdf: Uint8Array; filename: string } | null> {
  const view = await getClaim(ctx, claimId);
  if (!view) return null;
  const superbill = view.superbill ? { bytes: await getFile(view.superbill.storageKey), mime: view.superbill.mime } : undefined;
  const pdf = await buildPacket({ claim: view.claim, plan: view.plan, lines: view.lines }, superbill);
  await eventsRepo.append(ctx, claimId, "packet:generated");
  const filename = `claim-${view.plan.insurerName.replace(/\W+/g, "-")}-${view.claim.serviceDateStart ?? view.claim.id}.pdf`;
  return { pdf, filename };
}
