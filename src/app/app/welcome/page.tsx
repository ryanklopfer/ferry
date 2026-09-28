import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ONBOARDING, isOnboardingProblem, type OnboardingProblem } from "@/core/copy/onboarding";
import { centsToDollars } from "@/core/fee-schedule";
import { auth } from "@/server/auth";
import { requireClinician, requireSignedIn } from "@/server/auth/ctx";
import { INTENT_COOKIE } from "@/server/auth/intent";
import { feesView, legalTexts, type LegalTextView, onboardingStep, profileView, signupIntentValid } from "@/server/services/clinician";
import { Card } from "@/ui/card";
import { LegalText } from "@/ui/consent/legal-text";
import { Field } from "@/ui/field";
import { Notice } from "@/ui/notice";
import { FeesForm } from "@/ui/onboarding/fees-form";
import { PracticeForm } from "@/ui/onboarding/practice-form";
import { SubmitButton } from "@/ui/submit-button";
import { AddPasskey } from "../../account/account-actions";
import { profileFormValues } from "../clinician-forms";
import { agreeToTerms, saveFees, savePractice, signAuthorization } from "./actions";

export const dynamic = "force-dynamic";

const STEP_INDEX = { agree: 0, practice: 1, fees: 2, authorize: 3 } as const;

function Heading({ step, title, lead }: { step: keyof typeof STEP_INDEX; title: string; lead: string }) {
  const i = STEP_INDEX[step];
  return (
    <div>
      <p className="text-caption text-slate">
        Step {i + 1} of {ONBOARDING.steps.length} · {ONBOARDING.steps[i]}
      </p>
      <h1 className="font-display text-h1">{title}</h1>
      <p className="mt-1 text-secondary text-slate">{lead}</p>
    </div>
  );
}

function Texts({ texts }: { texts: readonly LegalTextView[] }) {
  return texts.map((t) => (
    <Card as="article" key={t.docType}>
      <div>
        <h2 className="font-display text-h2">{t.title}</h2>
        <p className="text-caption text-slate">{t.placeholder ? ONBOARDING.agree.draft : `Version ${t.version}`}</p>
      </div>
      <LegalText blocks={t.blocks} heading="h3" />
    </Card>
  ));
}

function SignForm({ action, hidden, nameLabel, submit }: { action: (fd: FormData) => Promise<void>; hidden: Record<string, string>; nameLabel: string; submit: string }) {
  return (
    <form action={action} className="flex flex-col gap-4">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Field label={nameLabel} name="typedName" autoComplete="name" required maxLength={200} />
      <div className="self-start">
        <SubmitButton>{submit}</SubmitButton>
      </div>
    </form>
  );
}

async function AgreeStep({ problem }: { problem: OnboardingProblem | null }) {
  const texts = await legalTexts(["terms", "baa"] as const);
  return (
    <>
      <Heading step="agree" title={ONBOARDING.agree.title} lead={ONBOARDING.agree.lead} />
      {problem && <Notice role="alert">{ONBOARDING.problems[problem]}</Notice>}
      <Texts texts={texts} />
      <SignForm action={agreeToTerms} hidden={Object.fromEntries(texts.map((t) => [t.docType, t.hash]))} nameLabel={ONBOARDING.agree.nameLabel} submit={ONBOARDING.agree.submit} />
    </>
  );
}

// Clinician onboarding (N5): agreements, then practice, fees and the filing authorization. A pending user arrives
// here from Start free's magic link holding the signed intent; anyone else is sent back to Start free.
export default async function WelcomePage({ searchParams }: PageProps<"/app/welcome">) {
  const user = await requireSignedIn();
  const { problem: raw } = await searchParams;
  const problem = isOnboardingProblem(raw) ? raw : null;
  const page = (children: React.ReactNode) => <div className="mx-auto flex max-w-2xl flex-col gap-6 pt-6">{children}</div>;

  if (user.role === "pending") {
    if (!(await signupIntentValid((await cookies()).get(INTENT_COOKIE)?.value))) redirect("/start?door=clinician");
    return page(<AgreeStep problem={problem} />);
  }
  if (user.role !== "clinician") return page(<Notice role="status">{ONBOARDING.signup.otherRole}</Notice>);

  const ctx = await requireClinician();
  const step = await onboardingStep(ctx);
  if (step === "done") redirect("/app");
  if (step === "agree") return page(<AgreeStep problem={problem} />);

  if (step === "practice") {
    const passkeys = await auth.api.listPasskeys({ headers: await headers() });
    return page(
      <>
        {passkeys.length === 0 && (
          <Card as="section">
            <h2 className="font-display text-h3">{ONBOARDING.passkey.title}</h2>
            <p className="text-secondary text-slate">{ONBOARDING.passkey.lead}</p>
            <AddPasskey />
          </Card>
        )}
        <Heading step="practice" title={ONBOARDING.practice.title} lead={ONBOARDING.practice.lead} />
        <PracticeForm action={savePractice} initial={profileFormValues(await profileView(ctx))} taxIdLast4={null} submit={ONBOARDING.practice.submit} />
      </>,
    );
  }

  if (step === "fees") {
    const fees = await feesView(ctx);
    return page(
      <>
        <Heading step="fees" title={ONBOARDING.fees.title} lead={ONBOARDING.fees.lead} />
        <FeesForm action={saveFees} initial={Object.fromEntries(fees.map((f) => [f.cptCode, centsToDollars(f.chargeCents)]))} submit={ONBOARDING.fees.submit} />
      </>,
    );
  }

  const texts = await legalTexts(["npi_filing_authorization"] as const);
  return page(
    <>
      <Heading step="authorize" title={ONBOARDING.authorize.title} lead={ONBOARDING.authorize.lead} />
      {problem && <Notice role="alert">{ONBOARDING.problems[problem]}</Notice>}
      <Texts texts={texts} />
      <SignForm action={signAuthorization} hidden={{ shownHash: texts[0].hash }} nameLabel={ONBOARDING.authorize.nameLabel} submit={ONBOARDING.authorize.submit} />
    </>,
  );
}
