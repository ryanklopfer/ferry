import type { Metadata } from "next";

export const metadata: Metadata = { title: "No signal" };

// Precached by the service worker and shown when a page can't load. Nothing is queued offline, so this copy
// must never promise that something will go out later (offline-copy.test.ts).
export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-sm space-y-4 pt-10">
      <h1 className="text-xl font-semibold">No signal right now.</h1>
      <p className="text-sm text-stone-600">
        Ferry needs a connection to work, so nothing was sent from this screen and nothing is waiting to go out. Everything we already had is safe with us.
      </p>
      <a className="btn-secondary" href="/home">Try again</a>
    </div>
  );
}
