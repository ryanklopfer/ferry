"use client";

import { useState } from "react";
import { buttonClass } from "@/ui/button";

// Answers one question for S4b: does picking "Camera" from a plain file input leave a copy in the phone's
// gallery? The photo is never read, uploaded or kept; only its size and type are shown, then it is let go.
export function FileInputCheck() {
  const [picked, setPicked] = useState<{ type: string; kb: number } | null>(null);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="font-display text-h1">File input check (dev only)</h1>
      <p className="text-secondary text-slate">Tap the button, choose Camera, and photograph something that isn&apos;t a person or a document. Then open the phone&apos;s gallery and look for that photo.</p>
      <label className={buttonClass("primary")} htmlFor="photo">
        Take a photo
      </label>
      <input
        id="photo"
        className="sr-only"
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          setPicked(file ? { type: file.type || "unknown", kb: Math.round(file.size / 1024) } : null);
          e.target.value = "";
        }}
      />
      {picked ? (
        <p className="rounded-card-sm bg-white px-4.5 py-4 text-secondary" data-testid="picked">
          Got a {picked.type} of {picked.kb} KB. It was not uploaded or kept. Now check the gallery and record in the device matrix whether a copy was left.
        </p>
      ) : null}
    </div>
  );
}
