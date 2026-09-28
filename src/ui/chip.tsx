import { Hand } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./icon";

// FERRY_BRAND §12.2. "One quick thing" overrides every other chip; sea fill is reserved for "Landed".
export const CHIPS = {
  quick: { label: "One quick thing", tone: "bg-blush text-navy", hand: true },
  received: { label: "We've got it", tone: "bg-blush text-navy", hand: false },
  sent: { label: "Sent across", tone: "bg-mint text-sea-deep", hand: false },
  "on-its-way": { label: "On its way", tone: "bg-mint text-sea-deep", hand: false },
  landed: { label: "Landed", tone: "bg-sea text-white", hand: false },
  counted: { label: "Counted", tone: "bg-mint text-sea-deep", hand: false },
  closed: { label: "Closed", tone: "bg-mist text-slate", hand: false },
} as const;

export type ChipKind = keyof typeof CHIPS;

const SHAPE = { list: "gap-1.5 px-2.5 py-1", detail: "gap-1.5 px-3 py-1.5" };
const BASE = "inline-flex items-center whitespace-nowrap rounded-pill text-chip";

export function Chip({ kind, size = "list" }: { kind: ChipKind; size?: keyof typeof SHAPE }) {
  const chip = CHIPS[kind];
  return (
    <span data-chip={kind} className={cx(BASE, SHAPE[size], chip.tone)}>
      {chip.hand && <Icon icon={Hand} size={16} />}
      {chip.label}
    </span>
  );
}

const TAG_TONES = { mist: "bg-mist text-navy", mint: "bg-mint text-sea-deep", blush: "bg-blush text-navy" };

// Neutral facts ("48 min in the room"), not a trip state. Mint only for good news ("Audio deleted").
export function Tag({ tone = "mist", children }: { tone?: keyof typeof TAG_TONES; children: ReactNode }) {
  return <span className={cx(BASE, SHAPE.list, TAG_TONES[tone])}>{children}</span>;
}

// A suggested code on the clinician's note: "90834 · 48 min", "F41.1".
export function CodeChip({ code, detail }: { code: string; detail?: string }) {
  return (
    <span data-code={code} className={cx(BASE, SHAPE.list, TAG_TONES.mist, "tabular-nums")}>
      {detail ? `${code} · ${detail}` : code}
    </span>
  );
}
