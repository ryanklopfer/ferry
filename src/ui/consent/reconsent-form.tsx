import { RECONSENT, SIGNER_LABELS } from "@/core/copy/consent";
import { SIGNER_RELATIONSHIPS } from "@/core/legal";
import type { ConsentRefusal } from "@/server/errors";
import type { ReconsentText } from "@/server/services/consents";
import { Card } from "../card";
import { Field } from "../field";
import { Notice } from "../notice";
import { SubmitButton } from "../submit-button";
import { FilingConsentDetails, RecordingConsentDetails } from "./consent-details";
import { LegalText } from "./legal-text";

type Props = {
  party: "clinician" | "client";
  texts: readonly ReconsentText[];
  next: string;
  action: (fd: FormData) => Promise<void>;
  membershipId?: string;
  insurer?: string | null;
  problem?: ConsentRefusal;
};

// The re-consent interstitial: each changed text in full, then one typed-name signature for all of them.
export function ReconsentForm({ party, texts, next, action, membershipId, insurer, problem }: Props) {
  const copy = RECONSENT[party];
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 pt-6">
      <div>
        <h1 className="font-display text-h1">{copy.title}</h1>
        <p className="mt-1 text-secondary text-slate">{copy.lead}</p>
      </div>
      {problem && <Notice role="alert">{RECONSENT.problems[problem]}</Notice>}
      {texts.map((t) => (
        <Card as="article" key={t.docType}>
          <div>
            <h2 className="font-display text-h2">{t.title}</h2>
            <p className="text-caption text-slate">{t.placeholder ? RECONSENT.draft : `Version ${t.version}`}</p>
          </div>
          {t.docType === "client_filing" && <FilingConsentDetails insurer={insurer ?? undefined} />}
          {t.docType === "client_recording" && <RecordingConsentDetails />}
          <LegalText blocks={t.blocks} heading="h3" />
        </Card>
      ))}
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        {membershipId && <input type="hidden" name="m" value={membershipId} />}
        {texts.map((t) => (
          <input key={t.docType} type="hidden" name="doc" value={`${t.docType}:${t.hash}`} />
        ))}
        {party === "client" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="pb-1.5 text-label text-slate">{RECONSENT.signerLabel}</legend>
            {SIGNER_RELATIONSHIPS.map((r) => (
              <label key={r} className="flex min-h-12 items-center gap-3 text-body font-semibold text-navy">
                <input type="radio" name="signer" value={r} required defaultChecked={r === "self"} className="size-5 accent-navy" />
                {SIGNER_LABELS[r]}
              </label>
            ))}
          </fieldset>
        )}
        <Field label={RECONSENT.nameLabel} name="typedName" autoComplete="name" required />
        <SubmitButton>{RECONSENT.agree}</SubmitButton>
      </form>
    </div>
  );
}
