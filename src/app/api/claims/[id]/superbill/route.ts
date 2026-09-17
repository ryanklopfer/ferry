import fs from "node:fs/promises";
import path from "node:path";
import { getClaimContext } from "@/lib/service";
import { getCtx } from "@/server/auth/ctx";

export async function GET(_req: Request, { params }: RouteContext<"/api/claims/[id]/superbill">) {
  if (!(await getCtx())) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const ctx = await getClaimContext(Number(id));
  if (!ctx?.claim.superbillPath) return new Response("Not found", { status: 404 });
  const bytes = await fs.readFile(path.join(process.cwd(), "data", "uploads", path.basename(ctx.claim.superbillPath)));
  return new Response(bytes, { headers: { "content-type": ctx.claim.superbillMime ?? "application/octet-stream" } });
}
