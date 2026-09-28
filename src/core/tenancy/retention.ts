// A canceled clinician's notes stay exportable for 30 days, and filed claims are chased to closure, so the
// tenant key (and with it every sealed row) outlives both.
export const TENANT_KEY_GRACE_DAYS = 30;

export function canDestroyTenantKey({ openClaims, canceledAt, now }: { openClaims: number; canceledAt: Date | null; now: Date }): boolean {
  if (openClaims > 0 || !canceledAt) return false;
  return now.getTime() - canceledAt.getTime() >= TENANT_KEY_GRACE_DAYS * 86_400_000;
}
