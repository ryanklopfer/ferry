import type { Metadata } from "next";

export const metadata: Metadata = { title: "Get started" };

// Plain links: choosing a door never changes a role. Clinician sign-up (N5) replaces the sign-in link and is
// the only place a pending user becomes a clinician; a client joins through their clinician's invite (N7a).
export default function StartPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-10">
      <h1 className="text-xl font-semibold">Who&apos;s joining us?</h1>
      <div className="flex flex-col gap-3">
        <a className="btn-primary text-center" href="/sign-in">I&apos;m a clinician</a>
        <a className="btn-secondary text-center" href="/for-clients">I&apos;m a client</a>
      </div>
    </div>
  );
}
