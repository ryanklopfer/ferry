import { ClaimListSchema } from "@/core/api/claims";
import { getClinician } from "@/server/auth/ctx";
import { listClaimSummaries } from "@/server/services/api";
import { apiError, apiOk } from "../respond";

export async function GET() {
  const ctx = await getClinician();
  if (!ctx) return apiError(401, "unauthorized", "Sign in first.");
  return apiOk(ClaimListSchema, await listClaimSummaries(ctx));
}
