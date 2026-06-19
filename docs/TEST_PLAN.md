# hintof — Test Plan

> The output schema is a **public, versioned contract** and must be tested as one `[T4, S2]`. Testing is **full-pyramid, CI-gated**: nothing deploys unless everything below is green `[S2]`.

Tooling: **Vitest** (unit + golden), **Playwright** (e2e, browser, responsive), **@axe-core/playwright** (a11y). All dev-only `[T2]`.

## Unit tests

### Quantity / fractions / ranges `[U1]`
- Parse `½`, `1/2`, `0.5`, `1 1/2`, `1½`, `2-3`, `2–3`, `.5`, `3` → canonical rationals/ranges.
- Reject/handle garbage (`abc`, empty, `1/0`) without throwing.
- Reduce rationals (`4/8 → 1/2`); render unicode vs ascii vs mixed styles.
- **Scaling:** `×1.5`, `×0.5`, `×3`; ranges scale both ends; results re-reduce; render readable (`⅓ × 2 = ⅔`).
- Servings scaling: base 4 → target 6 = ×1.5; target 0 / missing base handled.

### Units `[W3]`
- Display-normalization map (`tablespoon`/`tablespoons`/`Tbsp.` → `tbsp`, etc.).
- **No value conversion ever** — assert a unit change never alters the quantity.

### Ingredient parse (fuzzy) `[W3, S1]`
- Common: `2 cups flour`, `1 tbsp olive oil`, `3 large eggs`, `½ tsp salt`, `2-3 cloves garlic`.
- Hard/ambiguous: `a pinch of salt`, `1 (14oz) can tomatoes`, `salt to taste`, `juice of 1 lemon`, `2 cups flour, sifted`.
- Confidence floor: low-confidence input is preserved verbatim in `item`, not mis-split; never throws.

### Filename generation `[O3]`
- Illegal chars `/ \ : * ? " < > |` and Obsidian `# ^ [ ]` replaced.
- Reserved names (`CON`, `NUL`, `COM1`…) suffixed.
- Trailing dots/spaces trimmed; empty title → `Untitled`; unicode preserved.
- Date prefix correct; length capped ≤ 255 bytes; collisions get ` (2)`, ` (3)`.

### YAML escaping `[T4]`
- Titles with `:`, `#`, `"`, `'`, leading/trailing spaces, `- ` start, reserved words (`true`, `null`, `123`), and unicode (`Crème Brûlée`) → output **parses with a real YAML parser** (used in tests only) and equals the input.
- Multiline/newline-in-string emitted as quoted scalar with `\n`.
- Lists, dates, numbers emitted in expected forms.

### Migration `[R3]`
- vN → vN+1 transforms preserve data; non-destructive; old fixtures still load.

## Golden-file tests (the contract) `[O1, O2, O3]`

Fixture pairs `Recipe (JSON) → expected note (.md)`, byte-compared:
- **Minimal:** title only → matches the minimal example in `OBSIDIAN_SCHEMA.md`.
- **Complete:** the full example (frontmatter + all sections + groups + source).
- **Omission:** empty optionals produce no empty keys, no empty headings.
- **Grouping on/off:** ingredient sub-groups and step sections present vs flat.
- **Toggles:** wiki-links off/on; callouts off/on; unicode vs ascii fractions.
- **Edge content:** colons, quotes, unicode, ranges, per-ingredient notes.
- Golden fixtures are versioned per `schema_version`; old ones retained.

## Integration tests

- `recipeToNote` used by **both** preview and export yields identical output (preview == export).
- Library CRUD over a mocked/real `localStorage`: save, list, reopen, edit, delete, upsert-by-id.
- Autosave → reload → recovery restores the draft `[D2]`.
- JSON export → import round-trip is lossless; merge vs replace behave correctly `[D2, R4]`.
- Malformed/hostile import: invalid entries quarantined, existing library untouched, no code execution `[R4]`.
- Quota-exceeded simulation: current edit preserved, export prompt shown, no silent loss `[R2]`.

## Browser / e2e tests (Playwright)

- Core flow: new → title → add ingredients (incl. paste-parse) → add grouped steps → scale → preview updates → copy → download.
- Copy path: success **and** forced-failure fallback chain (`[R1]`); download always produces a correctly-named file.
- Library flow: save → reload → reopen → edit → delete.
- Theme: light/dark toggle persists; respects `prefers-color-scheme`.
- Cross-browser matrix: Chromium, Firefox, WebKit `[T6]`.

## Accessibility tests `[ACCESSIBILITY.md, S2]`

- **axe** on each primary view (form, preview, library, help) in **both** light and dark; zero serious/critical violations.
- Keyboard-only walkthrough of the full core flow incl. up/down reorder (focus follows, moves announced).
- Focus-visible present on all focusables; dialog focus-trap + `Esc` + focus restore.
- `prefers-reduced-motion` disables non-essential motion.
- Contrast assertions for both token sets.
- (Manual, pre-release) VoiceOver/NVDA smoke test.

## Responsive tests `[D4]`

- Layouts at 320, 375, 768, 1024, 1440 px: no horizontal scroll, Write/Preview toggle works on small screens, touch targets ≥ 44px.
- 200% zoom and 400% reflow remain usable.

## Export tests

Covered by golden + e2e: copy (API + fallback), download filename/content, JSON import/export — explicitly asserted as a named gate.

## Persistence tests

Autosave/recovery, library CRUD, quota handling, migration — as above; explicitly named gate.

## GitHub Pages base-path tests `[T7]`

- Build with the project-subpath base; assert no absolute `/`-rooted asset URLs leak; assets resolve under `/<repo>/`.
- Smoke-load the built `dist` served from a `/<repo>/` subpath (Playwright against a static server) and run the core flow.
- Assert **no external-origin requests** occur at runtime (privacy gate) `[T8]`.
- (v1.1) Service-worker scope/precache computed from base path; offline reload works under subpath `[T5]`.

## Edge-case fixtures (canonical set)

`empty-title`, `unicode-title`, `colon-title`, `reserved-name-title`, `huge-title`, `pinch-and-to-taste`, `parenthetical-can`, `range-qty`, `duplicate-ingredient`, `empty-group`, `notes-with-yaml-breakers`, `malformed-import`, `oversized-import`, `old-schema-version`. Each maps to one or more of the tests above.

## Release-gate commands

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # eslint + prettier --check
npm run test:unit      # vitest run (unit + golden + integration)
npm run test:e2e       # playwright test (browser + responsive + base-path)
npm run test:a11y      # axe via playwright, both themes
npm run build          # vite build (must succeed)
npm run check          # runs all of the above — the CI gate
```

CI (`.github/workflows/deploy.yml`) runs `npm run check`; **deploy only proceeds if it passes** `[S2]`.
