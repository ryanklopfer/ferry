import type { Metadata } from "next";
import { ButtonLink } from "@/ui/button";
import { Notice } from "@/ui/notice";

export const metadata: Metadata = { title: "Get started" };

// Plain links: choosing a door never changes a role. Clinician sign-up (N5) replaces the clinician door, which
// until then explains itself here rather than sending a pending user through /sign-in and /home back to /start.
// A client joins through their clinician's invite (N7a).
export default async function StartPage({ searchParams }: PageProps<"/start">) {
  const { door } = await searchParams;
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-10">
      <h1 className="font-display text-h1">Who&apos;s joining us?</h1>
      {door === "clinician" && (
        <Notice role="status">Clinician sign-up opens soon. There&apos;s nothing to set up before then.</Notice>
      )}
      <div className="flex flex-col gap-3">
        <ButtonLink variant="primary" href="/start?door=clinician">
          I&apos;m a clinician
        </ButtonLink>
        <ButtonLink variant="secondary" href="/for-clients">
          I&apos;m a client
        </ButtonLink>
      </div>
    </div>
  );
}
