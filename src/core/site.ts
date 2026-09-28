// Placeholder until Ryan names the address (S11c founder blocker). "Talk to us" and "Join the beta" open it.
export const SITE = { contactEmail: "hello@ferry.example" } as const;

const query = (fields: Record<string, string>) =>
  Object.entries(fields)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

export const mailto = (to: string, fields: Record<string, string>) => `mailto:${to}?${query(fields)}`;

export const contactMailto = (subject: string) => mailto(SITE.contactEmail, { subject });
