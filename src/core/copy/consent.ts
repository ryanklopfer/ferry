// The consent screens' own words, around the attorney's texts (F4). The filing list names every field a claim
// carries about the client, each with the one-line reason the insurer needs it (S3b, P0-4.2).
export const FILING_FIELDS = [
  { key: "name", label: "Your name", reason: "So your insurer can match the claim to you." },
  { key: "dob", label: "Your date of birth", reason: "Insurers check it with your name to be sure it's you." },
  { key: "memberId", label: "The member ID on your insurance card", reason: "It tells your insurer which plan to pay from." },
  { key: "diagnosis", label: "A diagnosis code", reason: "Insurers pay only for care with a diagnosis, so every claim needs one." },
  { key: "procedureCodes", label: "Procedure codes", reason: "They say what kind of session it was and how long it ran." },
  { key: "dates", label: "Session dates", reason: "Insurers pay visit by visit, and each claim has a deadline counted from its date." },
  { key: "charges", label: "Charges", reason: "Your insurer works out what it pays you back from what was charged." },
] as const;

export const RECORDING_PROMISES = [
  "Audio is never stored.",
  "Transcripts are erased within 24 hours.",
  "Nothing from your sessions is used for model training.",
] as const;

export const SIGNER_LABELS = {
  self: "Me",
  parent_guardian: "A parent or guardian",
  legal_representative: "A legal representative",
} as const;

export const RECONSENT = {
  clinician: { title: "We've updated our terms.", lead: "Read what changed and sign below. You'll pick up right where you left off." },
  client: { title: "We've updated a consent.", lead: "Read what changed and sign below. Everything carries on as before." },
  nameLabel: "Type your full name to sign",
  signerLabel: "Who's signing?",
  agree: "I agree",
  draft: "Draft",
  problems: {
    no_name: "Type your name to sign.",
    no_signer: "Tell us who's signing.",
    minor_self: "For someone under 18, a parent or guardian signs.",
    text_changed: "That text just changed. Here's the latest.",
    wrong_party: "That one isn't yours to sign.",
  },
} as const;
