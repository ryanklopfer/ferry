"use client";

import { useState } from "react";
import { BEHAVIORAL_TAXONOMIES, MODALITIES, MODALITY_LABELS, NOTE_FORMAT_LABELS, NOTE_FORMATS, NPI_TYPES, TAX_ID_TYPES, US_STATES } from "@/core/clinician";
import { ONBOARDING } from "@/core/copy/onboarding";
import { Card } from "../card";
import { Field } from "../field";
import { Notice } from "../notice";
import { SelectField } from "../select";
import { SubmitButton } from "../submit-button";
import type { FormState } from "./form-state";
import { useFormAction } from "./use-form-action";

const copy = ONBOARDING.practice;
const STATES = US_STATES.map((s) => ({ value: s, label: s }));
const withBlank = (options: { value: string; label: string }[]) => [{ value: "", label: "Choose one" }, ...options];

// Steps 2 to 4 and 6 of onboarding, and /app/account/profile. The Tax ID is never filled back in: the page shows
// only its last four, and a blank field keeps the one on file.
export function PracticeForm({ action, initial, taxIdLast4, submit }: { action: (state: FormState, fd: FormData) => Promise<FormState>; initial: Record<string, string>; taxIdLast4: string | null; submit: string }) {
  const [state, formAction] = useFormAction(action, initial);
  const v = state.values;
  const [npiType, setNpiType] = useState(v.npiType || "individual");
  const bad = (field: string) =>
    state.problem && state.fields.some((f) => f === field || f === `address.${field}`) ? (state.problem === "invalid" ? "Check this one." : ONBOARDING.problems[state.problem]) : undefined;

  return (
    <form key={state.answers} action={formAction} className="flex flex-col gap-6">
      {state.problem && <Notice role="alert">{ONBOARDING.problems[state.problem]}</Notice>}
      <Card as="section">
        <h2 className="font-display text-h3">You</h2>
        <Field label={copy.legalName} name="legalName" defaultValue={v.legalName} autoComplete="name" required maxLength={120} error={bad("legalName")} />
        <Field label={copy.credential} name="credential" defaultValue={v.credential} hint={copy.credentialHint} required maxLength={20} error={bad("credential")} />
        <SelectField label={copy.taxonomy} name="taxonomyCode" defaultValue={v.taxonomyCode} required options={withBlank(BEHAVIORAL_TAXONOMIES.map((t) => ({ value: t.code, label: t.label })))} error={bad("taxonomyCode")} />
        <div className="grid gap-3.5 sm:grid-cols-2">
          <SelectField label={copy.licenseState} name="licenseState" defaultValue={v.licenseState} required options={withBlank(STATES)} error={bad("licenseState")} />
          <Field label={copy.licenseNumber} name="licenseNumber" defaultValue={v.licenseNumber} required maxLength={40} error={bad("licenseNumber")} />
        </div>
      </Card>

      <Card as="section">
        <h2 className="font-display text-h3">Billing</h2>
        <Field label={copy.npi} name="npi" defaultValue={v.npi} inputMode="numeric" pattern="\d{10}" maxLength={10} required error={bad("npi")} />
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-1.5 text-label text-slate">{copy.npiType}</legend>
          {NPI_TYPES.map((t) => (
            <label key={t} className="flex min-h-12 items-center gap-3 text-body font-semibold text-navy">
              <input type="radio" name="npiType" value={t} checked={npiType === t} onChange={() => setNpiType(t)} className="size-5 accent-navy" />
              {copy.npiTypes[t]}
            </label>
          ))}
        </fieldset>
        {npiType === "group" && (
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label={copy.groupName} name="groupName" defaultValue={v.groupName} required maxLength={120} error={bad("groupName")} />
            <Field label={copy.groupNpi} name="groupNpi" defaultValue={v.groupNpi} inputMode="numeric" pattern="\d{10}" maxLength={10} required error={bad("groupNpi")} />
          </div>
        )}
        <div className="grid gap-3.5 sm:grid-cols-2">
          <SelectField label={copy.taxIdType} name="taxIdType" defaultValue={v.taxIdType || (npiType === "group" ? "EIN" : "SSN")} options={TAX_ID_TYPES.map((t) => ({ value: t, label: copy.taxIdTypes[t] }))} error={bad("taxIdType")} />
          <Field
            label={copy.taxId}
            name="taxId"
            autoComplete="off"
            inputMode="numeric"
            maxLength={11}
            required={!taxIdLast4}
            hint={taxIdLast4 ? copy.taxIdOnFile(taxIdLast4) : copy.taxIdHint}
            error={bad("taxId")}
          />
        </div>
      </Card>

      <Card as="section">
        <h2 className="font-display text-h3">{copy.address}</h2>
        <Field label={copy.line1} name="line1" defaultValue={v.line1} autoComplete="address-line1" required maxLength={120} error={bad("line1")} />
        <Field label={copy.line2} name="line2" defaultValue={v.line2} autoComplete="address-line2" maxLength={120} />
        <div className="grid gap-3.5 sm:grid-cols-[1fr_8rem_9rem]">
          <Field label={copy.city} name="city" defaultValue={v.city} autoComplete="address-level2" required maxLength={80} error={bad("city")} />
          <SelectField label={copy.state} name="state" defaultValue={v.state} autoComplete="address-level1" required options={withBlank(STATES)} error={bad("state")} />
          <Field label={copy.zip} name="zip" defaultValue={v.zip} autoComplete="postal-code" inputMode="numeric" required maxLength={10} error={bad("zip")} />
        </div>
      </Card>

      <Card as="section">
        <h2 className="font-display text-h3">How you work</h2>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <SelectField label={copy.noteFormat} name="defaultNoteFormat" defaultValue={v.defaultNoteFormat || "dap"} options={NOTE_FORMATS.map((f) => ({ value: f, label: NOTE_FORMAT_LABELS[f] }))} />
          <SelectField label={copy.modality} name="defaultModality" defaultValue={v.defaultModality || "in_person"} options={MODALITIES.map((m) => ({ value: m, label: MODALITY_LABELS[m] }))} />
        </div>
      </Card>

      <div className="self-start">
        <SubmitButton pending="Saving…">{submit}</SubmitButton>
      </div>
    </form>
  );
}
