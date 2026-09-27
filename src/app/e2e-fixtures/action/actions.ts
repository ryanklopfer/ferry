"use server";

import { requireSignedIn } from "@/server/auth/ctx";
import { E2E_FIXTURES_ON, SCRUB_MARKER } from "../enabled";

export async function failingAction(): Promise<void> {
  await requireSignedIn();
  if (!E2E_FIXTURES_ON()) return;
  throw new Error(`server action failed for ${SCRUB_MARKER}`);
}
