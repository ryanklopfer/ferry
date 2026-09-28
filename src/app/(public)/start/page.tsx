import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ONBOARDING } from "@/core/copy/onboarding";
import { getSessionUser } from "@/server/auth/ctx";
import { ButtonLink } from "@/ui/button";
import { Notice } from "@/ui/notice";
import { SubmitButton } from "@/ui/submit-button";
import { continueAsPending } from "./actions";
import { ClinicianSignupForm } from "./clinician-signup-form";

export const metadata: Metadata = { title: "Get started" };

const copy = ONBOARDING.signup;

// Choosing a door never changes a role. The clinician door is Start free: an email, then a magic link that lands on
// onboarding (N5). A client joins through their clinician's invite (N7a).
export default async function StartPage({ searchParams }: PageProps<"/start">) {
  const { door, problem } = await searchParams;
  if (door !== "clinician") {
    return (
      <div className="mx-auto max-w-sm space-y-6 pt-10">
        <h1 className="font-display text-h1">Who&apos;s joining us?</h1>
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

  const user = await getSessionUser();
  if (user?.role === "clinician") redirect("/app");
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-10">
      <div>
        <h1 className="font-display text-h1">{copy.title}</h1>
        <p className="mt-1 text-secondary text-slate">{copy.lead}</p>
      </div>
      {problem === "link" && <Notice role="status">That link was already used or ran out of time. We&apos;ll send you a fresh one.</Notice>}
      {problem === "refused" && <Notice role="status">{copy.betaOnly}</Notice>}
      {user && user.role !== "pending" ? (
        <Notice role="status">{copy.otherRole}</Notice>
      ) : user ? (
        <form action={continueAsPending}>
          <SubmitButton>{copy.continueAs(user.email)}</SubmitButton>
        </form>
      ) : (
        <ClinicianSignupForm />
      )}
    </div>
  );
}
