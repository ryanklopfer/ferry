import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { E2E_SPIKE_K } from "./env";

// The real recorder, end to end: getUserMedia → AudioWorklet → WebSocket → the relay the suite starts beside
// Next. The page shows the relay's own count.
const TONE = path.join(process.cwd(), "corpus", "synthetic", "audio", "tone-10s.wav");

test.use({
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${TONE}`] },
  permissions: ["microphone"],
});

async function recordTenSeconds(page: Page) {
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.getByTestId("state")).toHaveText("recording");
  // Ten seconds from the first frame of audio, not from the tap.
  await expect.poll(async () => Number(await page.getByTestId("produced-ms").textContent()), { intervals: [20] }).toBeGreaterThan(0);
  await page.waitForTimeout(10_000);
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByTestId("state")).toHaveText("stopped", { timeout: 10_000 });

  const relayMs = Number(await page.getByTestId("relay-ms").textContent());
  expect(relayMs).toBeGreaterThanOrEqual(9_700);
  expect(relayMs).toBeLessThanOrEqual(10_300);
  // Every frame the browser produced reached the relay, and no gap opened.
  expect(relayMs).toBe(Number(await page.getByTestId("produced-ms").textContent()));
  await expect(page.getByTestId("gaps")).toHaveText("None.");
}

test("the dev pages answer signed out only with this run's key", async ({ request }) => {
  for (const p of ["/dev/mic", "/dev/file-input"]) {
    expect((await request.get(p, { maxRedirects: 0 })).status(), p).toBe(404);
    expect((await request.get(`${p}?k=wrong-key-${"x".repeat(40)}`, { maxRedirects: 0 })).status(), p).toBe(404);
    expect((await request.get(`${p}?k=${E2E_SPIKE_K}`, { maxRedirects: 0 })).status(), p).toBe(200);
  }
  expect((await request.post("/api/dev/relay-token", { data: { captureId: "cap_e2e" }, maxRedirects: 0 })).status()).toBe(404);
  expect((await request.post("/api/dev/relay-token", { data: { k: E2E_SPIKE_K, captureId: "cap_e2e" }, maxRedirects: 0 })).status()).toBe(200);
  expect((await request.get("/api/dev/relay-token", { maxRedirects: 0 })).status()).toBe(404);
  expect((await request.get("/api/dev/manifest", { maxRedirects: 0 })).status()).toBe(404);
  const spike = await request.get(`/api/dev/manifest?k=${E2E_SPIKE_K}`, { maxRedirects: 0 });
  expect(spike.status()).toBe(200);
  expect(await spike.json()).toMatchObject({ start_url: `/dev/mic?k=${E2E_SPIKE_K}` });
});

test("/dev/mic links the keyed spike manifest, not the shared one", async ({ page }) => {
  await page.goto(`/dev/mic?k=${E2E_SPIKE_K}`);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", `/api/dev/manifest?k=${E2E_SPIKE_K}`);
});

// The same path with a WebAudio tone in place of the mic, so the worklet, frames, acks and count are proven on
// every run, including where the OS blocks the fake device below.
test("with a WebAudio tone standing in for the mic, the relay counts 10,000 ms ± 300", async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const ctx = new AudioContext();
      const tone = ctx.createOscillator();
      const out = ctx.createMediaStreamDestination();
      tone.connect(out);
      tone.start();
      await ctx.resume();
      return out.stream;
    };
  });
  await page.goto(`/dev/mic?k=${E2E_SPIKE_K}`);
  await recordTenSeconds(page);
});

// Last in the file: when the OS blocks the fake device, the pending request stalls audio for the rest of this browser.
test("Chromium's fake mic playing tone-10s.wav records for 10 s and the relay counts 10,000 ms ± 300", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(`/dev/mic?k=${E2E_SPIKE_K}`);
  // On macOS, Chromium asks the OS for microphone access even for the fake device. When the app running the
  // suite has never been granted it (System Settings → Privacy & Security → Microphone), getUserMedia never settles.
  // Only that hang skips; a rejection (bad flags, a missing WAV, a policy block) fails with the error's name.
  const mic = await page.evaluate(() =>
    Promise.race([
      navigator.mediaDevices.getUserMedia({ audio: true }).then(
        (s) => (s.getTracks().forEach((t) => t.stop()), "ok"),
        (e: unknown) => `rejected: ${e instanceof Error ? e.name : String(e)}`,
      ),
      new Promise<string>((r) => setTimeout(() => r("timeout"), 5_000)),
    ]),
  );
  test.skip(mic === "timeout", "macOS has not granted microphone access to the app running Playwright, so the fake device never opens");
  expect(mic).toBe("ok");
  await recordTenSeconds(page);
});
