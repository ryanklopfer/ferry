import { createPlan } from "@/app/actions";
import { Field } from "@/components/ui";
import { requireClinician } from "@/server/auth/ctx";

export default async function NewPlanPage() {
  await requireClinician();
  return (
    <form action={createPlan} className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Add an insurance plan</h1>
      <p className="text-sm text-stone-600">Everything here comes from your insurance card and the &quot;submit a claim&quot; page on your insurer&apos;s site. It gets printed on every claim form and letter.</p>

      <section className="card space-y-3">
        <h2 className="font-medium">Plan</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Insurance company" name="insurerName" required placeholder="Aetna, Cigna, UnitedHealthcare…" />
          <Field label="Plan name (optional)" name="planName" placeholder="Open Access PPO" />
          <Field label="Member ID" name="memberId" required />
          <Field label="Group number" name="groupNumber" />
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">Subscriber and patient</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Subscriber name (on the card)" name="subscriberName" required />
          <Field label="Subscriber date of birth" name="subscriberDob" type="date" />
          <Field label="Patient name (if different)" name="patientName" />
          <Field label="Patient date of birth" name="patientDob" type="date" />
          <div>
            <label className="label" htmlFor="patientRelationship">Patient relationship to subscriber</label>
            <select className="input" id="patientRelationship" name="patientRelationship" defaultValue="self">
              <option value="self">Self</option>
              <option value="spouse">Spouse</option>
              <option value="child">Child</option>
              <option value="other">Other</option>
            </select>
          </div>
          <Field label="Phone" name="patientPhone" type="tel" />
          <Field label="Email" name="patientEmail" type="email" />
          <Field label="Mailing address" name="patientAddress" span placeholder="123 Main St, Apt 4, City, ST 12345" />
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">Where claims go</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="preferredChannel">Preferred submission channel</label>
            <select className="input" id="preferredChannel" name="preferredChannel" defaultValue="portal">
              <option value="portal">Member portal upload</option>
              <option value="fax">Fax</option>
              <option value="mail">Mail</option>
              <option value="email">Email</option>
            </select>
          </div>
          <Field label="Timely filing limit (days from service)" name="timelyFilingDays" type="number" defaultValue={180} />
          <Field label="Member portal URL" name="portalUrl" type="url" placeholder="https://" />
          <Field label="Claims fax" name="claimsFax" type="tel" />
          <Field label="Claims phone (member services)" name="claimsPhone" type="tel" />
          <Field label="Claims mailing address" name="claimsAddress" span placeholder="From the back of your card or your EOB" />
        </div>
      </section>

      <div className="flex gap-2">
        <button className="btn-primary" name="next" value="claim">Save and start a claim</button>
        <button className="btn-secondary" name="next" value="plans">Save</button>
      </div>
    </form>
  );
}
