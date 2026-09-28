"use client";

import { useId, useState } from "react";
import { Button } from "./button";

// One section of a note ("Data", "Assessment", "Plan"). Tap the text to edit it in place.
export function EditableSection({ label, value, onSave }: { label: string; value: string; onSave?: (value: string) => void }) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-chip text-slate">
          {label}
        </label>
        <textarea
          id={id}
          value={text}
          rows={3}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-input border-2 border-navy bg-cream px-3 py-2 text-secondary text-navy outline-none"
        />
        <Button
          variant="tertiary"
          className="self-end"
          onClick={() => {
            setEditing(false);
            onSave?.(text);
          }}
        >
          Done
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="-mx-2 flex cursor-pointer flex-col items-start rounded-input px-2 py-1 text-left hover:bg-cream focus-visible:outline-2 focus-visible:outline-navy"
    >
      <span className="text-chip text-slate">{label}</span>
      <span className="text-secondary">{text}</span>
      <span className="sr-only">, tap to edit</span>
    </button>
  );
}
