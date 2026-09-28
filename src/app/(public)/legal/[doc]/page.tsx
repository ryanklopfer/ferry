import { notFound } from "next/navigation";

// The texts S3b versions under content/legal/. Until then each page says it is still being written.
const TITLES: Record<string, string> = {
  terms: "Terms of service",
  privacy: "Privacy policy",
  baa: "Business associate agreement",
  "npi-filing-authorization": "Filing authorization",
  "client-filing": "Consent to file claims",
  "client-recording": "Consent to record sessions",
};

export default async function LegalPage({ params }: PageProps<"/legal/[doc]">) {
  const { doc } = await params;
  if (!Object.hasOwn(TITLES, doc)) notFound();
  return (
    <div className="mx-auto max-w-xl space-y-4 pt-10">
      <h1 className="font-display text-h1">{TITLES[doc]}</h1>
      <p className="text-secondary text-slate">We&apos;re finishing this text with our attorney. It will be here before anything depends on it.</p>
    </div>
  );
}
