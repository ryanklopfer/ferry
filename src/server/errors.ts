export class NotOwnedError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotOwnedError";
  }
}

// A gate found no current consent of these types (never signed, or withdrawn).
export class ConsentMissing extends Error {
  constructor(readonly docTypes: string[]) {
    super(`No current consent: ${docTypes.join(", ")}`);
    this.name = "ConsentMissing";
  }
}

// A gate found consents signed to an earlier version of these texts; the signer re-consents at /app/reconsent or /c/reconsent.
export class ConsentStale extends Error {
  constructor(readonly docTypes: string[]) {
    super(`Consent to an earlier text: ${docTypes.join(", ")}`);
    this.name = "ConsentStale";
  }
}

export type ConsentRefusal = "wrong_party" | "minor_self" | "text_changed" | "no_name" | "no_signer";

export class ConsentRefused extends Error {
  constructor(readonly reason: ConsentRefusal) {
    super(`Consent refused: ${reason}`);
    this.name = "ConsentRefused";
  }
}
