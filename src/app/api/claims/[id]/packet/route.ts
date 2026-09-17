import fs from "node:fs/promises";
import path from "node:path";
import { getClaimContext, logEvent } from "@/lib/service";
import { buildPacket } from "@/lib/packet";
import { getCtx } from "@/server/auth/ctx";

export async function GET(_req: Request, { params }: RouteContext<"/api/claims/[id]/packet">) {
  if (!(await getCtx())) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const ctx = await getClaimContext(Number(id));
  if (!ctx) return new Response("Not found", { status: 404 });
  let superbill: { bytes: Buffer; mime: string } | undefined;
  if (ctx.claim.superbillPath && ctx.claim.superbillMime) {
    superbill = { bytes: await fs.readFile(path.join(process.cwd(), "data", "uploads", path.basename(ctx.claim.superbillPath))), mime: ctx.claim.superbillMime };
  }
  const pdf = await buildPacket(ctx, superbill);
  await logEvent(ctx.claim.id, "packet:generated");
  const name = `claim-${ctx.plan.insurerName.replace(/\W+/g, "-")}-${ctx.claim.serviceDateStart ?? ctx.claim.id}.pdf`;
  return new Response(Buffer.from(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${name}"` } });
}
