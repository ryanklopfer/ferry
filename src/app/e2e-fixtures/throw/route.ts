import { getSessionUser } from "@/server/auth/ctx";
import { E2E_FIXTURES_ON, SCRUB_MARKER } from "../enabled";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!E2E_FIXTURES_ON() || !(await getSessionUser())) return new Response(null, { status: 404 });
  throw new Error(`route handler failed for ${SCRUB_MARKER}`);
}
