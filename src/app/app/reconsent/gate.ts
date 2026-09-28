import { redirect } from "next/navigation";
import { isClinicianDocType } from "@/core/legal";
import { ConsentStale } from "@/server/errors";

// Wraps a gated screen: when the clinician's own agreement is stale, show the re-consent interstitial, which comes
// back to `here` once signed, so the screen picks up where it stopped. A stale client consent is the client's to renew.
export async function withReconsent<T>(here: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof ConsentStale && e.docTypes.some(isClinicianDocType)) redirect(`/app/reconsent?next=${encodeURIComponent(here)}`);
    throw e;
  }
}
