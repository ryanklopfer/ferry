import fs from "node:fs/promises";
import path from "node:path";
import { getClaimContext } from "@/lib/service";

export async function GET(_req: Request, { params }: RouteContext<"/api/claims/[id]/superbill">) {
  const { id } = await params;
  const ctx = await getClaimContext(Number(id));
  if (!ctx?.claim.superbillPath) return new Response("Not found", { status: 404 });
  const bytes = await fs.readFile(path.join(process.cwd(), "data", "uploads", path.basename(ctx.claim.superbillPath)));
  return new Response(bytes, { headers: { "content-type": ctx.claim.superbillMime ?? "application/octet-stream" } });
}
