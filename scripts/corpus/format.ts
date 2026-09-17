const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(iso: string, style: "mdy" | "iso" | "long"): string {
  const [y, m, d] = iso.split("-");
  if (style === "iso") return iso;
  if (style === "long") return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`;
  return `${m}/${d}/${y}`;
}

export const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const pointerLetters = (pointers: number[]) => pointers.map((p) => String.fromCharCode(64 + p)).join(",");

export const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Small deterministic PRNG so layout jitter is stable between runs.
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
