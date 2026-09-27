import { ClaimDetailSchema } from "@/core/api/claims";
import { getClinician } from "@/server/auth/ctx";
import { getClaimDetail } from "@/server/services/api";
import { apiError, apiOk, denied } from "../../respond";

export async function GET(_req: Request, { params }: RouteContext<"/api/v1/claims/[id]">) {
  const ctx = await getClinician();
  if (typeof ctx === "number") return denied(ctx);
  const { id } = await params;
  const detail = await getClaimDetail(ctx, id);
  if (!detail) return apiError(404, "not_found", "No claim with that id.");
  return apiOk(ClaimDetailSchema, detail);
}
