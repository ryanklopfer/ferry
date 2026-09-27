# Capture device matrix (Gate A)

Ryan fills this in on the evening of Tue Sep 29. The results decide D4 on Sep 30. Use synthetic speech only: play `corpus/synthetic/audio/speech-synthetic.wav` from the Mac's speakers at the phone, or read the invented lines aloud. Never record a real session through the tunnel.

## Before you start (one time)

1. Install the two tools (founder approval F-N3b): `brew install caddy cloudflared`.
2. In the repo: `bun run dev:phone`. It refuses to start unless `FERRY_DATA_CLASS=synthetic` and the dev tier. It prints a QR code and a link to `/dev/mic?k=…`. The key changes every run, and the pages answer 404 without it.
3. Scan the QR code with the phone's camera.

## What each column means

| Column | How to check it |
|---|---|
| 5-minute continuous | Start recording, leave the phone unlocked and on the page for 5 minutes. Pass if **Gaps** says None and **Relay counted** is within a second of **Wall time**. |
| Screen lock | While recording, lock the phone for 30 seconds, unlock and return to the page. Write what the page shows: a gap with its cause (`hidden`, `context_interrupted`, …) and whether audio resumed on its own or needed **Resume mic**. |
| Incoming call | While recording, call the phone from another phone, decline or answer for 15 seconds, return. Same notes as above. |
| App switch | While recording, switch to another app for 30 seconds, return. Same notes. |
| Wake lock held | The **Wake lock** line: `held`, `failed` or `unsupported` (needs iOS 18.4+ for installed apps). Also note whether the screen stayed on without touching it for 2 minutes. |
| Mic works after reopen | After the lock, call and switch tests, does audio come back (Audio produced rising), either by itself or after **Resume mic**? For installed mode, also fully close the app, reopen it from the Home Screen and start a new recording. |
| Gap shown | Every interruption above shows up under **Gaps** with a duration. A gap with cause `unexplained`, or Relay counted falling behind Audio produced, is silent loss: note it. |
| Gallery copy left | Android file-input row only: open the "Android file-input check" link, tap **Take a photo**, choose Camera, take a picture of something neutral. Then open the gallery: is the photo there? |

"Installed" means Share → Add to Home Screen (iPhone) or Install app (Android) while on the `/dev/mic` page; the installed app opens straight on the spike.

## Results

Device and OS version: iPhone ________ (iOS ____), Android ________ (Android ____)

| Mode | 5-minute continuous | Screen lock | Incoming call | App switch | Wake lock held | Mic works after reopen | Gap shown | Gallery copy left |
|---|---|---|---|---|---|---|---|---|
| iPhone Safari tab | | | | | | | | n/a |
| iPhone installed | | | | | | | | n/a |
| Android Chrome tab | | | | | | | | n/a |
| Android installed | | | | | | | | n/a |
| macOS Chrome | | n/a | n/a | | | | | n/a |
| macOS Safari | | n/a | n/a | | | | | n/a |
| Android file input | n/a | n/a | n/a | n/a | n/a | n/a | n/a | |

## Pass bar and what it decides

- **Pass:** 5 minutes continuous in at least one iPhone mode, and every lock, call or app switch shows as a visible gap, never silent loss.
- If installed mode fails but the Safari tab passes, launch records in a Safari tab (D4).
- The Android file-input row decides whether S4b's live viewfinder can slip: if no gallery copy is left, the plain file input is enough for beta.

## Notes

(Anything odd: prompts, audio routing to the earpiece, the page reloading, the tunnel dropping.)
