import { ClaimListSchema } from "@/core/api/claims";
import { getClinician } from "@/server/auth/ctx";
import { listClaimSummaries } from "@/server/services/api";
import { apiOk, denied } from "../respond";

export async function GET() {
  const ctx = await getClinician();
  if (typeof ctx === "number") return denied(ctx);
  return apiOk(ClaimListSchema, await listClaimSummaries(ctx));
}
