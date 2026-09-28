import {
  ageOn,
  CLIENT_DOC_TYPES,
  CLINICIAN_DOC_TYPES,
  type ClientDocType,
  type ClinicianDocType,
  type ConsentDocType,
  type ConsentRecord,
  type ConsentState,
  currentConsent,
  isClientDocType,
  isClinicianDocType,
  type LegalBlock,
  SIGNER_RELATIONSHIPS,
  type SignerRelationship,
} from "@/core/legal";
import { clientCtxFor } from "@/server/auth/client-ctx";
import type { ClientCtx, ClinicianCtx, ClinicianOnlyCtx, SelfCtx } from "@/server/auth/ctx";
import { clientConsentsRepo, clinicianConsentsRepo, type ConsentWithdrawn } from "@/server/db/repos/consents";
import { clientsRepo } from "@/server/db/repos/clients";
import { membershipsRepo } from "@/server/db/repos/memberships";
import { plansRepo } from "@/server/db/repos/plans";
import { assertNotClient } from "@/server/db/repos/scope";
import { ConsentMissing, ConsentRefused, ConsentStale, NotOwnedError } from "@/server/errors";
import { liveText } from "@/server/legal";
import { log } from "@/server/log";

export type { ConsentWithdrawn };

export type ConsentInput = {
  docType: ConsentDocType;
  typedName: string;
  // The hash of the text the signer was shown; a text that changed since then is refused rather than signed unseen.
  shownHash: string;
  signerRelationship?: SignerRelationship;
  ip: string | null;
  userAgent: string | null;
};

type Party = ClinicianCtx | ClientCtx;

// In-process listeners for a client's withdrawal (N10 cancels unsent claims, N12 ends a recording). They run after
// the withdrawal commits; other processes hear the same event on the consent_withdrawn channel.
const withdrawnHooks = new Set<(e: ConsentWithdrawn) => void | Promise<void>>();

export function onConsentWithdrawn(handler: (e: ConsentWithdrawn) => void | Promise<void>): () => void {
  withdrawnHooks.add(handler);
  return () => void withdrawnHooks.delete(handler);
}

const today = () => new Date();

export async function recordConsent(ctx: Party, input: ConsentInput): Promise<{ id: string; docType: ConsentDocType; version: string }> {
  const ok = ctx.scope === "client" ? isClientDocType(input.docType) : ctx.scope === "clinician" && isClinicianDocType(input.docType);
  if (!ok) throw new ConsentRefused("wrong_party");
  const typedName = input.typedName.trim();
  if (!typedName) throw new ConsentRefused("no_name");
  const live = await liveText(input.docType);
  if (live.hash !== input.shownHash) throw new ConsentRefused("text_changed");
  const signed = { version: live.doc.version, contentHash: live.hash, typedName, ip: input.ip, userAgent: input.userAgent };

  if (ctx.scope === "client") {
    const docType = input.docType as ClientDocType;
    const signer = input.signerRelationship;
    if (!signer || !SIGNER_RELATIONSHIPS.includes(signer)) throw new ConsentRefused("no_signer");
    if (signer === "self") {
      const client = await clientsRepo.get(ctx, ctx.clientId);
      if (!client) throw new NotOwnedError("Client");
      const age = client.dob ? ageOn(client.dob, today()) : null;
      if (age !== null && age < 18) throw new ConsentRefused("minor_self");
    }
    const { id } = await clientConsentsRepo.create(ctx, { ...signed, docType, signerRelationship: signer });
    log("consent.recorded", { userId: ctx.userId, clientId: ctx.clientId, kind: docType });
    return { id, docType, version: live.doc.version };
  }

  const docType = input.docType as ClinicianDocType;
  const { id } = await clinicianConsentsRepo.create(ctx, { ...signed, docType });
  log("consent.recorded", { userId: ctx.userId, kind: docType });
  return { id, docType, version: live.doc.version };
}

export async function withdrawConsent(ctx: Party, docType: ConsentDocType): Promise<boolean> {
  if (ctx.scope === "client") {
    if (!isClientDocType(docType)) throw new ConsentRefused("wrong_party");
    const event = await clientConsentsRepo.withdraw(ctx, docType);
    if (!event) return false;
    log("consent.withdrawn", { userId: ctx.userId, clientId: ctx.clientId, kind: docType });
    for (const hook of withdrawnHooks) {
      try {
        await hook(event);
      } catch (e) {
        log("consent.withdrawn_hook_failed", { userId: ctx.userId, clientId: ctx.clientId, error: e });
      }
    }
    return true;
  }
  if (ctx.scope !== "clinician" || !isClinicianDocType(docType)) throw new ConsentRefused("wrong_party");
  const withdrawn = await clinicianConsentsRepo.withdraw(ctx, docType);
  if (withdrawn) log("consent.withdrawn", { userId: ctx.userId, kind: docType });
  return withdrawn;
}

async function states<T extends ConsentDocType>(records: readonly ConsentRecord[], docTypes: readonly T[]): Promise<[T, ConsentState][]> {
  return Promise.all(docTypes.map(async (t) => [t, currentConsent(records, t, (await liveText(t)).hash)] as [T, ConsentState]));
}

async function statusOf(ctx: Party): Promise<[ConsentDocType, ConsentState][]> {
  if (ctx.scope === "client") return states(await clientConsentsRepo.listFor(ctx, ctx.clientId), CLIENT_DOC_TYPES);
  return states(await clinicianConsentsRepo.list(ctx), CLINICIAN_DOC_TYPES);
}

// The signer's own consents: a clinician's four agreements, or a client's two consents.
export async function consentStatus(ctx: ClinicianCtx): Promise<Record<ClinicianDocType, ConsentState>>;
export async function consentStatus(ctx: ClientCtx): Promise<Record<ClientDocType, ConsentState>>;
export async function consentStatus(ctx: Party): Promise<Partial<Record<ConsentDocType, ConsentState>>> {
  return Object.fromEntries(await statusOf(ctx));
}

// What the signer must re-consent to: consents signed to an earlier version of a text. Never-signed ones are onboarding's.
export async function staleConsents(ctx: Party): Promise<ConsentDocType[]> {
  return (await statusOf(ctx)).filter(([, s]) => s === "stale").map(([t]) => t);
}

// The first of a client user's memberships with a stale consent, so sign-in can send them to /c/reconsent.
export async function firstStaleMembership(self: SelfCtx): Promise<string | null> {
  for (const id of await membershipsRepo.activeIds(self)) {
    if ((await staleConsents(await clientCtxFor(self, id))).length) return id;
  }
  return null;
}

async function gate(ctx: ClinicianOnlyCtx, clientId: string, clientTypes: readonly ClientDocType[], clinicianTypes: readonly ClinicianDocType[]): Promise<void> {
  assertNotClient(ctx);
  const [clientRecords, clinicianRecords] = await Promise.all([clientConsentsRepo.listFor(ctx, clientId), clinicianTypes.length ? clinicianConsentsRepo.list(ctx) : []]);
  const all = [...(await states(clientRecords, clientTypes)), ...(await states(clinicianRecords, clinicianTypes))];
  const missing = all.filter(([, s]) => s === "none").map(([t]) => t);
  if (missing.length) throw new ConsentMissing(missing);
  const stale = all.filter(([, s]) => s === "stale").map(([t]) => t);
  if (stale.length) throw new ConsentStale(stale);
}

// Filing (and the 270 eligibility check) needs the client's current filing consent and the clinician's current
// filing authorization.
export const requireFilingConsent = (ctx: ClinicianOnlyCtx, clientId: string) => gate(ctx, clientId, ["client_filing"], ["npi_filing_authorization"]);

export const requireRecordingConsent = (ctx: ClinicianOnlyCtx, clientId: string) => gate(ctx, clientId, ["client_recording"], []);

export type ReconsentText = { docType: ConsentDocType; title: string; version: string; placeholder: boolean; blocks: LegalBlock[]; hash: string };

const textsFor = (docTypes: readonly ConsentDocType[]): Promise<ReconsentText[]> =>
  Promise.all(
    docTypes.map(async (docType) => {
      const { doc, hash } = await liveText(docType);
      return { docType, title: doc.title, version: doc.version, placeholder: doc.placeholder, blocks: doc.blocks, hash };
    }),
  );

// The re-consent interstitials: the live texts of what is stale, with the hash each form sends back.
export async function clinicianReconsent(ctx: ClinicianCtx): Promise<ReconsentText[]> {
  return textsFor(await staleConsents(ctx));
}

export async function clientReconsent(self: SelfCtx, membershipId: string): Promise<{ texts: ReconsentText[]; insurer: string | null }> {
  const ctx = await clientCtxFor(self, membershipId);
  const [texts, plans] = await Promise.all([staleConsents(ctx).then(textsFor), plansRepo.list(ctx)]);
  return { texts, insurer: plans[0]?.insurerName ?? null };
}

export async function recordClientConsents(self: SelfCtx, membershipId: string, inputs: readonly ConsentInput[]): Promise<void> {
  const ctx = await clientCtxFor(self, membershipId);
  for (const input of inputs) await recordConsent(ctx, input);
}
