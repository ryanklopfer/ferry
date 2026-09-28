// Placeholder until Ryan names the address (S11c founder blocker). "Talk to us" and "Join the beta" open it.
// Boot refuses the prelaunch and prod tiers while it is a placeholder (src/server/boot.ts).
export const SITE = { contactEmail: "hello@ferry.example" } as const;

// Reserved names (RFC 2606, RFC 6761) that can never receive mail.
export const isPlaceholderAddress = (email: string) => /(?:[@.]example\.(?:com|net|org)|\.(?:example|invalid|test|localhost))$/i.test(email);

const query = (fields: Record<string, string>) =>
  Object.entries(fields)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

export const mailto = (to: string, fields: Record<string, string>) => `mailto:${to}?${query(fields)}`;

export const contactMailto = (subject: string) => mailto(SITE.contactEmail, { subject });
