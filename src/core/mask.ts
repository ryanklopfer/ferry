export function last4(value: string | null | undefined): string {
  const kept = (value ?? "").replace(/[^0-9A-Za-z]/g, "");
  return kept.length > 4 ? kept.slice(-4) : "";
}
