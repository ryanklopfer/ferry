export const toCents = (dollars: number | null | undefined) => Math.round((dollars ?? 0) * 100);
export const fromCents = (cents: number | null | undefined) => ((cents ?? 0) / 100).toFixed(2);
