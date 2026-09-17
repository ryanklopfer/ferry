import { getCtx } from "@/server/auth/ctx";
import { buildClaimPacket } from "@/server/services/documents";

export async function GET(_req: Request, { params }: RouteContext<"/api/claims/[id]/packet">) {
  const ctx = await getCtx();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const packet = await buildClaimPacket(ctx, id);
  if (!packet) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(packet.pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${packet.filename}"` } });
}
