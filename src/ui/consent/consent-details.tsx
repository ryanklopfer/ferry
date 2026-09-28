import { FILING_FIELDS, RECORDING_PROMISES } from "@/core/copy/consent";

// Shown with the client filing consent: every field a claim sends about the client, and why.
export function FilingConsentDetails({ insurer }: { insurer?: string }) {
  const title = `What we send to ${insurer ?? "your insurer"}`;
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-display text-h3">{title}</h3>
      <ul aria-label={title} className="flex flex-col gap-3">
        {FILING_FIELDS.map((f) => (
          <li key={f.key} className="flex flex-col gap-0.5">
            <span className="text-body font-semibold text-navy">{f.label}</span>
            <span className="text-secondary text-slate">{f.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Shown with the client recording consent.
export function RecordingConsentDetails() {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-display text-h3">What happens to a recording</h3>
      <ul aria-label="What happens to a recording" className="flex flex-col gap-2">
        {RECORDING_PROMISES.map((p) => (
          <li key={p} className="text-body font-semibold text-navy">
            {p}
          </li>
        ))}
      </ul>
    </section>
  );
}
