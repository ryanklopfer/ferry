# Ferry — Brand & UI Guidelines

Read this before touching any UI, copy, or theme code. Machine-readable tokens live in `tokens.json`. Logo files live in `assets/`.

## 1. What Ferry is

Ferry is a mobile app for patients who pay out-of-pocket for care and are owed money back by their insurer. The patient snaps a photo of the superbill; Ferry files the out-of-network claim, tracks it, and tells the patient when the reimbursement lands. The patient never fills in a form, never learns a CPT code, never logs into a payer portal.

The brand metaphor: **a small, friendly boat that carries your bill across and brings the money back.** Every screen, string, and animation should feel like that boat: warm, unhurried, competent, on your side.

Working name: **Ferry**. Claims are called **trips** in the UI.

## 2. Voice

Three rules. Apply them to every string, including errors, empty states, and push notifications.

1. **Talk like a helpful friend.** First person plural ("we"), short words, contractions. "We've got it" beats "Your submission has been received."
2. **Celebrate the money, not the app.** The good news belongs to the user. Ferry is just the boat. Never "Ferry successfully processed…"; instead "$184.20 is coming back to you."
3. **Never assign homework.** If a sentence ends in an instruction, rewrite it until it ends in reassurance. When input is genuinely required, ask for one thing, explain why in a few words, and say what happens after.

Style specifics:

- Sentence case everywhere. No ALL CAPS, no Title Case headings.
- Dollar amounts always lead when they exist: "$184.20 is on its way," not "Your reimbursement of $184.20…"
- Dates are short and human: "Sep 12", "around Oct 1", "about 2 weeks". Never ISO dates in UI.
- No exclamation marks in system messages. One is allowed in a "landed" celebration.
- No emoji in UI strings.
- Never use insurer vocabulary: *member, eligible, pending review, adjudication, EOB, CPT, claim number* (show a short reference only on the trip detail screen, labeled "reference").
- Never explain the plumbing (OCR, APIs, payer portals). Describe outcomes.

### Copy bank (use these verbatim where they fit)

| Context | String |
|---|---|
| Home greeting | Good morning. / Good afternoon. / Good evening. |
| Home subline, n trips in flight | Three bills are out on the water. (0: "Nothing on the water right now.") |
| Hero label | Coming back to you |
| Hero subline | $150.00 landed this month. The rest is on its way. |
| Primary CTA | Snap a superbill |
| Section header | Your trips |
| Status: received | We've got it |
| Status: filed | Sent across |
| Status: paid | Landed |
| Status: needs something | One quick thing |
| Camera title | Lay it flat. |
| Camera hint | All four corners in the frame. We'll do the rest. |
| Camera alt action | Upload a PDF |
| Review title | Here's what we saw. |
| Review subline | Tap anything that looks off. Otherwise, send it. |
| Review field labels | Provider · What it was for · Visit date · You paid |
| Insurer line | Sending to your insurer on file |
| Send CTA | Send it across |
| Send alt | Retake the photo |
| Trip reassurance | Nothing else to do. We'll wave when it lands, probably around Oct 1. |
| Trip timeline | Snapped and sent · Your insurer has it · Money lands in your account |
| Trip actions | Back home · Snap another |
| Push: filed | Sent across. $184.20 should land in about 2 weeks. |
| Push: paid | It landed. $184.20 is in your account. |
| Error: blurry photo | That one's a little blurry. One more try? |
| Error: offline | No signal right now. We'll send it the moment you're back. |
| Empty state | Snap your first superbill and we'll take it from there. |

Sounds like: *Snapped it. We'll take it from here.* Not like: *Please review your submission for accuracy.*

## 3. Color

| Token | Hex | Use |
|---|---|---|
| cream | #FFF6EC | App background. Every screen except camera. |
| white | #FFFFFF | Cards, sheets, bottom nav. |
| peach | #F0704F | Primary action fill, boat hull. **Always navy text on peach, never white.** |
| blush | #FFD9C2 | Secondary fill, chips, input borders, the "pending" segment of progress bars. |
| sea | #2EA88F | Progress, money, success fills. White text allowed on sea at 12px+ bold only. |
| seaDeep | #176D5C | Money and success *text* on light backgrounds. |
| mint | #E5F5F0 | Tint behind seaDeep text (chips, callouts). |
| navy | #17263F | Primary text, icons, links, the wave in the mark, camera screen background. |
| navySurface | #24375A | Raised surfaces on the camera screen. |
| slate | #566680 | Secondary text, captions, inactive nav. |
| mist | #EEF1F6 | Neutral tint, disabled fills. |
| onNavyText | #C7D2E6 | Secondary text on navy. |
| onNavyMuted | #93A3BD | Placeholder text on navy. |
| danger | #C43D2E | Errors only. Never for money. |

Rules:

- **Sea-green always means "good" or "money".** Never use it decoratively.
- **Peach is for the one primary action per screen** plus the boat. Two peach buttons on one screen is a bug.
- No brown, no rust, no warm greys anywhere. Neutrals are navy/slate/mist (cool). Warmth comes from cream, peach and blush only.
- No gradients, no drop shadows. Depth comes from white-on-cream layering and radius.
- Text contrast: navy or seaDeep on cream/white/blush/mint (all ≥ 4.5:1). Slate on cream is 4.8:1: fine for 13px+. Never slate on blush.
- Dark mode is out of scope for MVP. The camera screen is the only dark surface.

### CSS variables

```css
:root {
  --ferry-cream: #FFF6EC;
  --ferry-white: #FFFFFF;
  --ferry-peach: #F0704F;
  --ferry-blush: #FFD9C2;
  --ferry-sea: #2EA88F;
  --ferry-sea-deep: #176D5C;
  --ferry-mint: #E5F5F0;
  --ferry-navy: #17263F;
  --ferry-navy-surface: #24375A;
  --ferry-slate: #566680;
  --ferry-mist: #EEF1F6;
  --ferry-on-navy: #C7D2E6;
  --ferry-on-navy-muted: #93A3BD;
  --ferry-danger: #C43D2E;

  --ferry-font-display: 'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif;
  --ferry-font-body: 'Figtree', 'Helvetica Neue', Arial, sans-serif;

  --ferry-radius-card: 28px;
  --ferry-radius-card-sm: 22px;
  --ferry-radius-input: 16px;
  --ferry-radius-pill: 999px;
}
```

### Tailwind (v3/v4 theme.extend)

```js
colors: {
  cream: '#FFF6EC', peach: '#F0704F', blush: '#FFD9C2',
  sea: { DEFAULT: '#2EA88F', deep: '#176D5C' }, mint: '#E5F5F0',
  navy: { DEFAULT: '#17263F', surface: '#24375A' }, slate: '#566680', mist: '#EEF1F6',
  onnavy: { DEFAULT: '#C7D2E6', muted: '#93A3BD' }, danger: '#C43D2E',
},
fontFamily: {
  display: ['"Bricolage Grotesque"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
  body: ['Figtree', '"Helvetica Neue"', 'Arial', 'sans-serif'],
},
borderRadius: { card: '28px', 'card-sm': '22px', input: '16px' },
```

## 4. Typography

Two families, both on Google Fonts (free, OFL):

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;800&family=Figtree:wght@400;500;600;700&display=swap">
```

For React Native / Expo: `@expo-google-fonts/bricolage-grotesque` and `@expo-google-fonts/figtree`.

- **Display: Bricolage Grotesque 800** for headings, the wordmark, and every dollar amount. Tight tracking (−2% to −3%).
- **Body: Figtree** 400 for reading, 600 for inputs, 700 for labels, buttons and chips.

| Style | Font | Size / line | Weight | Tracking |
|---|---|---|---|---|
| hero (money) | Display | 44 / 1.0 | 800 | −0.03em |
| h1 | Display | 30 / 1.05 | 800 | −0.02em |
| h2 | Display | 24 / 1.1 | 800 | −0.02em |
| h3 / card title | Display | 22 / 1.15 | 800 | −0.01em |
| amount (list) | Display | 18 / 1.0 | 800 | 0 |
| body | Body | 16 / 1.55 | 400 | 0 |
| secondary | Body | 15 / 1.5 | 400 | 0 |
| caption | Body | 13 / 1.45 | 400 | 0 |
| label | Body | 13 / 1.3 | 700 | 0 |
| chip | Body | 12 / 1.2 | 700 | 0 |
| button | Body | 17 / 1.0 | 700 | 0 |

Dollar amounts are always display-face, always seaDeep when they represent money coming back, navy when neutral. Use tabular figures where the font offers them (`font-variant-numeric: tabular-nums`).

## 5. Layout & spacing

- Phone canvas 390 × 844 (design reference). Screen padding: 60 top (below the OS status bar), 20 sides, 24 bottom (above the home indicator). Never draw a fake status bar.
- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40. Stack gap between screen sections: 20. Inside cards: 14–16.
- Everything is a pill or a big rounded card. Radii: cards 28, list cards 22, inputs 16, chips/buttons/nav 999.
- No dividers/hairlines. Separate items with gap and white-on-cream.
- Minimum touch target 44 × 44. Primary button 60 tall, secondary 56, tertiary 48, nav items 48.

## 6. Components

**Primary button** — height 60, peach fill, navy text 17/700, pill, optional 22px outline icon. One per screen. Pressed: scale 0.97, 120ms.

**Secondary button** — height 56, white (on cream) or blush fill, navy text 15/700, pill.

**Tertiary/text button** — height 48, transparent, navy text 15/700. Used for "Retake the photo", "Upload a PDF".

**Chip / status pill** — padding 4×10 (list) or 6×12 (detail), 12/700, pill.

- We've got it → blush fill, navy text
- Sent across → mint fill, seaDeep text
- Landed → sea fill, white text
- One quick thing → blush fill, navy text, with a 16px outline "hand" icon

**Card** — white, radius 28 (hero/detail) or 22 (list row), padding 22 or 16×18. No border, no shadow.

**Input** — height 48, cream fill, 2px blush border, radius 16, Figtree 16/600 navy. Label above: 13/700 slate. Focus: border → navy. Error: border → danger, helper text in danger 13/400.

**Progress bar (trip)** — three equal 8px pill segments with 6px gap: done = sea, pending = blush. Labels below in 12/700: done = seaDeep, pending = slate. Segments animate width 400ms ease-in-out when a stage completes.

**Bottom nav** — 64 tall white pill, three items (Home · Trips · Insurers), each a 48 tall pill with 20px outline icon + 14/700 label; active item has blush fill and navy text, inactive is slate.

**Timeline row** — 12px dot (sea when done, 2px blush outline when pending) + title 15/700 + time 13/400 slate.

**Camera screen** — the only navy surface. Background navy, raised elements navySurface, text cream/onNavyText, dashed slate frame with four peach corner brackets, 80px peach shutter with 6px cream ring.

## 7. Iconography

Outline icons only: 22px in buttons and headers, 20px in nav, 2.2px stroke, round caps and joins, `currentColor`. Lucide is the reference set; if hand-drawing, match its 24-unit grid. No filled icons, no two-tone, no emoji.

## 8. Logo

Files in `assets/`:

- `ferry-mark.svg` — the boat, full color (sea cabin, peach hull, navy wave). Default.
- `ferry-mark-mono.svg` — single-color version using `currentColor`. Use on peach or in monochrome contexts.
- `ferry-lockup.svg` — mark + "Ferry" wordmark (Bricolage Grotesque 800, tracking −3%). The wordmark is live text; embed the font or convert to outlines before shipping in print.
- `ferry-app-icon.svg` — 1024 app icon: peach ground, navy cabin, cream hull, navy wave.

Rules: clearspace equals the hull's height on every side. Minimum mark size 28px on screen. The boat never tilts, rotates, or gets a face. The wave may animate (gentle 1.8s ease-in-out horizontal drift) in loading/empty states. Reversed on navy: hull peach, cabin sea, wave cream. Never put the mark on sea-green.

## 9. Motion

Keep it to three moments:

1. **Tap feedback** — scale 0.97 over 120ms on any pressable.
2. **Sheet / screen transitions** — 260ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`, slide-up for sheets, push for screens.
3. **The wave** — 1.8s ease-in-out drift under the boat while something is in flight (uploading, filing). This is the only ambient animation in the app.

No confetti. The "landed" moment is a single sea-green fill sweeping the progress bar plus the push notification copy.

## 10. Accessibility

- All text ≥ 4.5:1 (≥ 3:1 at 24px+). Verified pairs: navy/cream 12.6, slate/cream 4.8, seaDeep/cream 5.6, seaDeep/mint 5.0, navy/peach 4.7, navy/blush 9.9, white/sea 3.1 (bold 12px+ only), cream/navy 12.0, onNavyText/navy 8.1, onNavyMuted/navy 5.2.
- Never rely on color alone for status: every chip carries its label.
- Real semantic controls: `<button>`, `<a>`, `<input>` with `<label>`. Icon-only buttons get `aria-label` ("Back", "Take photo", "Account").
- Respect reduced motion: disable the wave drift and use opacity fades instead of slides.
- Dynamic type: layouts must survive 130% text scaling; amounts may wrap to two lines, cards grow.

## 11. Don'ts (quick check before opening a PR)

- Don't use brown, rust, or warm grey anywhere.
- Don't put white text on peach.
- Don't use sea-green for anything that isn't progress or money.
- Don't add a second peach button to a screen.
- Don't add shadows, gradients, dividers or borders on cards.
- Don't write ALL CAPS, exclamation-heavy, or insurer-speak copy.
- Don't draw a fake status bar, fake keyboard, or fake camera feed.
- Don't use Inter, Roboto, Arial or system-ui as the visible face; they are fallbacks only.

## 12. Amendments (approved 2026-09-17)

These extend sections 2 and 6 so the brand covers every claim outcome, not only the happy path. Where an amendment conflicts with the copy bank above, the amendment wins.

### 12.1 Layered tracker

The product's promise is that every step is visible. The brand's promise is that it never feels like insurance. Both hold by layering:

1. **Lists** show a chip, the three-segment progress bar, and one line of plain copy for the current state. A trip that is being chased says so; it never sits unchanged.
2. **Trip detail** shows every state the trip has passed through as a timeline row in Ferry voice, plus every letter we sent.
3. **Details tap** on a timeline row reveals the short "reference", denial codes with their plain meaning, and the reimbursement math. Insurer vocabulary is allowed only here.

### 12.2 Chips

Chip is chosen from the trip's state and whether we are waiting on the patient.

| Chip | Fill / text | When |
|---|---|---|
| One quick thing | blush / navy, 16px outline hand icon | any time one thing is needed from the patient; overrides every other chip |
| We've got it | blush / navy | read and being prepared |
| Sent across | mint / seaDeep | filed and with the insurer, including while we chase, appeal or escalate |
| On its way | mint / seaDeep | the insurer reports it has paid |
| Landed | sea / white | closed with money back |
| Counted | mint / seaDeep | the amount went toward the deductible; no money back, no fee |
| Closed | mist / slate | closed with no money and no deductible credit |

Sea fill stays reserved for "Landed". "Counted" uses mint because it is good news without money.

### 12.3 Never claim what we can't see

Ferry never touches the money, and most insurers mail a check. Copy states what we know.

- When the insurer reports payment: "On its way. Cigna mailed your check Sep 14." Never "is in your account."
- The "It landed" push and the sea-green sweep fire only after the patient taps that it arrived.
- We check in twice (about 3 weeks and 5 weeks after payment). If neither is answered the trip closes as "Landed" and the detail line states what the insurer reported: "Cigna sent $126 on Sep 14."
- Progress labels: **Snapped and sent · Your insurer has it · Money comes back**. This replaces "Money lands in your account."
- Push: paid becomes "On its way. $184.20, check mailed Sep 14." The copy-bank string "It landed. $184.20 is in your account." is replaced by "It landed. $184.20 is back with you." and is sent only on confirmation.

### 12.4 Notification bodies

SMS carries no names, insurers, codes, dates of service or amounts: a generic prompt and a link only. Push may carry a dollar amount and nothing else identifying, pending attorney review (architecture open question 3).

### 12.5 Missing assets

`tokens.json` and the `assets/` logo files referenced in sections 3 and 8 have not been exported yet. Until they arrive, the wordmark is live text in Bricolage Grotesque 800 and no boat mark is drawn. Do not improvise a logo.
