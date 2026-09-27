"use client";

import { useEffect, useState } from "react";
import { BRAND } from "@/core/brand";

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISSED = "ferry.install-dismissed";

const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
// iPadOS reports itself as a Mac; the touch points give it away.
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISSED) === "1";
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [mode, setMode] = useState<"hidden" | "prompt" | "ios">("hidden");
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissed()) return;
    // The browser fires beforeinstallprompt after mount, so the initial mode comes from an effect by design.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isIos()) setMode("ios");
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
      setMode("prompt");
    };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "hidden") return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {}
    setMode("hidden");
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    // A prompt event works once. If the browser offers install again it fires a new one, which brings the banner back.
    setDeferred(null);
    setMode("hidden");
  };

  return (
    <aside aria-label={`Install ${BRAND.name}`} className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 pt-3 text-sm">
      <p className="flex-1 text-stone-700">Keep {BRAND.name} on your home screen. It opens like an app.</p>
      {mode === "prompt" ? (
        <button className="btn-secondary" type="button" onClick={install}>Install {BRAND.name}</button>
      ) : (
        <button className="btn-secondary" type="button" onClick={() => setSheet(true)}>Add to Home Screen</button>
      )}
      <button className="text-stone-600 underline hover:text-stone-900" type="button" onClick={dismiss}>Not now</button>
      {sheet && (
        <div role="dialog" aria-modal="true" aria-labelledby="install-sheet-title" className="fixed inset-x-0 bottom-0 z-50 space-y-3 rounded-t-2xl bg-white p-5 pb-8 shadow-lg">
          <h2 id="install-sheet-title" className="text-base font-semibold">Add {BRAND.name} to your Home Screen</h2>
          <ol className="list-decimal space-y-1 pl-5 text-stone-700">
            <li>Tap the Share button in Safari&apos;s toolbar.</li>
            <li>Choose Add to Home Screen, then Add.</li>
          </ol>
          <p className="text-stone-600">{BRAND.name} then opens from your Home Screen like any other app.</p>
          <button className="btn-secondary" type="button" onClick={() => setSheet(false)}>Done</button>
        </div>
      )}
    </aside>
  );
}
