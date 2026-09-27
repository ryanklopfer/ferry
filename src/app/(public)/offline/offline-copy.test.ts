import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import OfflinePage from "./page";

// Nothing is queued while offline, so the page may not suggest that anything will go out when the signal returns.
const LATER_PROMISES = [
  /\bwe(?:'|’)?ll\s+(?:send|sync|upload|file|submit|deliver|save|keep trying|retry|try again)/i,
  /\b(?:will|gets?|is going to)\s+(?:be\s+)?(?:sent|send|synced|uploaded|filed|submitted|delivered)\b/i,
  /\b(?:when|once|as soon as|the moment)\s+(?:you(?:'|’)?re|you are|the signal|your signal|you get|it(?:'|’)?s)\s+back\b/i,
  /\b(?:when|once|as soon as)\s+you(?:'|’)?re\s+online\b/i,
  /\blater\b/i,
  /\bqueued?\b/i,
  /\bautomatically\b/i,
  /\bin the background\b/i,
];

const promisesToSendLater = (text: string) => LATER_PROMISES.filter((p) => p.test(text)).map(String);

function pageText(): string {
  return renderToStaticMarkup(createElement(OfflinePage))
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&apos;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

describe("offline page copy", () => {
  it("contains no promise to send later", () => {
    const text = pageText();
    expect(text.length).toBeGreaterThan(20);
    expect(promisesToSendLater(text)).toEqual([]);
  });

  it("says plainly that nothing was sent", () => {
    expect(pageText()).toMatch(/nothing was sent/i);
  });

  it("catches the promises it is there to catch, including the old copy-bank line", () => {
    for (const bad of [
      "No signal right now. We'll send it the moment you're back.",
      "We’ll send it when you’re back online.",
      "Your note will be sent once you're online.",
      "It's queued and goes out later.",
      "We'll sync it as soon as the signal is back.",
    ]) {
      expect(promisesToSendLater(bad), bad).not.toEqual([]);
    }
  });
});
