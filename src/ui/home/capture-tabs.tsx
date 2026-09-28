"use client";

import { Check, Mic, PenLine, ScanLine, Send } from "lucide-react";
import { type ReactNode, useState } from "react";
import { HOME } from "@/core/copy/home";
import { Card } from "../card";
import { Tag } from "../chip";
import { Icon } from "../icon";
import { SegmentedControl } from "../segmented-control";

type Mode = (typeof HOME.how.modes)[number]["value"];

const ICONS = { live: Mic, dictate: Send, type: PenLine, scan: ScanLine } as const;

// docs/spec.html "Ways to capture": pressed buttons over one panel each. Every panel is in the page; the others
// are hidden, so the whole copy renders without script. The steps sit beside the panels on wide screens.
export function CaptureTabs({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("live");
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <SegmentedControl<Mode>
        label={HOME.how.label}
        options={HOME.how.modes.map((m) => ({ value: m.value, label: m.label, icon: <Icon icon={ICONS[m.value]} size={18} /> }))}
        defaultValue="live"
        onChange={setMode}
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div>
          {HOME.how.modes.map((m) => (
            <div key={m.value} data-panel={m.value} hidden={m.value !== mode} className="flex min-h-55 flex-col gap-3 rounded-card bg-blush p-7">
              <Card size="sm">
                <span className="flex flex-wrap items-center justify-between gap-3">
                  <b>{m.title}</b>
                  {"tag" in m && <Tag>{m.tag}</Tag>}
                  {"saved" in m && <Tag tone="mint">{m.saved}</Tag>}
                </span>
                <span className="text-caption text-slate">{m.meta}</span>
              </Card>
              <p className="flex items-center gap-2.5 rounded-input bg-mint px-4 py-3.5 text-secondary font-semibold text-sea-deep">
                <Icon icon={Check} size={18} className="shrink-0" />
                {m.notice}
              </p>
            </div>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}
