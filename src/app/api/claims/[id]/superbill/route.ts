import { getClinician } from "@/server/auth/ctx";
import { getSuperbill } from "@/server/services/documents";

export async function GET(_req: Request, { params }: RouteContext<"/api/claims/[id]/superbill">) {
  const ctx = await getClinician();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const superbill = await getSuperbill(ctx, id);
  if (!superbill) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(superbill.bytes), { headers: { "content-type": superbill.mime } });
}
