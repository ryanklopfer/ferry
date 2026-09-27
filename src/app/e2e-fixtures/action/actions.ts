"use server";

import { requireCtx } from "@/server/auth/ctx";
import { E2E_FIXTURES_ON, SCRUB_MARKER } from "../enabled";

export async function failingAction(): Promise<void> {
  await requireCtx();
  if (!E2E_FIXTURES_ON()) return;
  throw new Error(`server action failed for ${SCRUB_MARKER}`);
}
