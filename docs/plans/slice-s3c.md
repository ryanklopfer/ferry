# Slice S3c — UI foundation: brand tokens and components for clinician desktop and client phone

Branch: `slice/s3c-ui-foundation`. Scope and acceptance: `docs/sprint-tasks.md` → S3c.

## Steps

1. Tests first:
   - `src/ui/tokens.test.ts`: reads FERRY_BRAND.md and `src/app/globals.css`. Every §3 `--ferry-*` variable exists with the same value; every name in the §3 Tailwind block exists as `--color-*`, `--font-*` or `--radius-*` with the same value; every §4 type style exists as `--text-<style>` with its size, line height, weight and tracking; the §5 sizes exist as named spacing tokens. No hex colour appears in any file under src/ except globals.css, and `src/core/brand.ts` `COLORS` (the manifest and viewport need literal colours) must equal the theme's values.
   - `src/ui/chips.test.tsx` (happy-dom): parses the §12.2 table and renders each chip; it carries `bg-<fill>` and `text-<text>`, its label, and the hand icon only on "One quick thing".
   - `src/ui/banned-classes.test.ts`: no `stone-`, `shadow`, `divide-`, `bg-gradient` or `uppercase` class and no "Superbill Claims" anywhere in src/; every gallery screen, rendered to HTML, has at most one primary action (`data-variant="primary"`).
   - `e2e/gallery.spec.ts`: `/dev/ui?k=…` at 390 px and 1280 px with `scrollWidth <= innerWidth`, again with the root font at 130%; the wave animates normally and not at all under reduced motion; axe finds no violations; every icon-only button has an aria-label; every element with a pointer cursor is (or sits inside) a button, a, input, textarea, select or label; chip colours computed in the browser match the tokens.
2. `src/app/globals.css`: the §3 CSS variables verbatim on `:root`; `@theme` resets Tailwind's default colours, fonts and shadows, then maps the brand names (`@theme inline`) and adds the §4 text styles (rem, so text scales) and §5 sizes. Wave keyframes and the reduced-motion rule.
3. Fonts: Bricolage Grotesque (600, 800) and Figtree (400–700) via `next/font/google` in `layout.tsx`; Lucide via `lucide-react` behind one `Icon` wrapper (22 px, 2.2 stroke, aria-hidden).
4. `src/ui/`: Button/ButtonLink/IconButton, Card, Chip (the §12.2 seven) and Tag, Field (Input), ProgressBar, TimelineRow, Screen, Wordmark, Wave, BottomNav (client, clinician), DesktopHeader, SegmentedControl, CodeChip, RecordButton, EditableSection, PricingCard, Disclosure. `src/components/*` moves: LineItemsEditor and SubmitButton to src/ui restyled; `ui.tsx`'s Field becomes the new Field, StatusBadge (the pre-pivot 8 statuses) gives way to Chip, and its unused Empty and date/money helpers go.
5. Branding: `package.json` name `ferry`; layout on cream with the text wordmark; every existing page moves off the stone/amber classes and the old `.btn`/`.card`/`.input` CSS classes onto the components.
6. `/dev/ui` gallery (dev tier and spike key, like `/dev/mic`), screens defined in `src/app/dev/ui/screens.tsx` so the unit test renders the same list.
7. FERRY_BRAND.md §13 "Clinician surfaces" DRAFT from docs/spec.html.
8. `bun run test`, `typecheck`, `lint`, `test:e2e`; tick S3c in `docs/sprint-tasks.md`; one commit. Not merged to main.
