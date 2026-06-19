# hintof — Design Specification

> Decision IDs (`[G1]` …) reference `DECISIONS.md`. Tokens here are normative; implementation should read them from a single CSS custom-property source.

## Visual thesis

hintof should feel like writing in a well-made cookbook — warm, considered, editorial, domestic. It is emphatically **not** SaaS: no glassmorphism, no neon, no gradient-on-dark dashboard, no AI-landing-page hero. The warmth comes from **colour, typography, composition, and restraint** — not from textures or photography `[G2, G7]`.

The acid test for any design decision: *would this look at home as a page in a printed cookbook, or does it look like a productivity app?* Choose the former.

## Reference-image interpretation `[G1, G2, G7]`

The reference photograph (open book, cream paper, warm light, terracotta/rust textiles, muted-teal geometry) is **inspiration only** — the image is never shipped. We extract:

- **Palette** — cream paper, charcoal ink, terracotta/rust accent, muted teal secondary.
- **Composition** — an editorial *cookbook-page* layout: generous margins, a clear column for entry and a "page" for the live note. Evocative of a book, **not** a skeuomorphic open book (no spine, page-curl, or photoreal paper) `[G1]`.
- **Geometry** — the teal geometric motif becomes **flat vector** accents (dividers, corner rules, empty-state art), used sparingly. No raster texture, no paper grain `[G2]`.

## Layout system `[G1]`

A two-region editorial layout:

- **The form** (left/primary) — where you write the recipe.
- **The page** (right/secondary) — the live Markdown note preview, set like a printed page on the cream field.

Grid: a centered content measure with comfortable margins. Use CSS Grid for the two-region split and container queries for component-level responsiveness. Maximum body measure ~70ch for readability.

### Desktop (≥ 1024px)
Two columns side by side: form left, live page right, both independently scrollable. Sticky action bar (Copy / Download / Save) anchored to the page region.

### Tablet (640–1023px)
Single column by default with a **toggle** between *Write* and *Preview*, or a stacked form-over-preview if width allows. Actions remain reachable (sticky bottom bar).

### Mobile (< 640px) `[D4]`
Single column, generous tap targets (≥ 44px), Write/Preview toggle, sticky bottom action bar. One-handed reachability prioritized. Reorder via up/down buttons (drag is not relied upon) `[D3]`.

## Typography `[G3]`

- **Display / headings:** an editorial serif with character (recommended: **Fraunces**, OFL, variable — warm, slightly old-style; alternative **Spectral**). Used for the wordmark, recipe H1, and section headings.
- **Body / UI:** a warm humanist sans (recommended: **Source Sans 3**, OFL; alternative **IBM Plex Sans**). Used for form labels, inputs, buttons, the preview body, and helper text.
- **Mono (preview source, optional):** a calm monospace (recommended: **IBM Plex Mono**) if the raw-Markdown view is shown as code.

**Fonts are self-hosted and bundled** — no Google Fonts or any external font CDN — to honour the zero-network privacy guarantee `[T8]`. Use `font-display: swap` and subset to Latin.

Type scale (1.25 ratio, fluid via `clamp()`):

| Token | Use | Size (desktop) |
|-------|-----|----------------|
| `--fs-xs` | helper text, captions | 0.8rem |
| `--fs-sm` | secondary labels | 0.9rem |
| `--fs-base` | body, inputs | 1rem (16px) |
| `--fs-md` | emphasized body | 1.125rem |
| `--fs-lg` | section headings | 1.4rem |
| `--fs-xl` | recipe title | 2rem |
| `--fs-2xl` | wordmark / hero | 2.75rem |

Line-height: 1.6 body, 1.2 headings. Headings use the serif; never letter-space the serif tightly.

## Palette `[G4, G5]`

Defined as tokens; both modes ship from day one `[G5]`. Contrast targets: body text ≥ 7:1 where feasible, ≥ 4.5:1 always; large text/UI ≥ 3:1. Verified in tests for both modes.

### Light (default)
```css
--paper:        #F5ECDC; /* app background, "cream paper" */
--surface:      #FBF6EC; /* cards, the note "page" */
--surface-sunk: #EFE4D2; /* insets, input wells */
--ink:          #2A2521; /* primary text */
--ink-soft:     #5C5247; /* secondary text, labels */
--ink-faint:    #8A7E70; /* placeholder, captions */
--line:         #D9CBB3; /* hairline borders, rules */
--terracotta:   #B24E2E; /* primary accent (buttons, active) */
--terracotta-deep:#9A3F22;/* accent text/links on cream (≥4.5:1) */
--rust:         #7E3B1E; /* hover/pressed accent */
--teal:         #2F6E68; /* secondary accent (links, focus aid) */
--teal-deep:    #265853; /* teal text on cream */
--teal-geo:     #4A857F; /* DECORATIVE geometry only — never text */
--focus:        #2F6E68; /* focus ring (teal) */
--danger:       #A33526; /* errors */
--ok:           #3E6B3B; /* success/saved */
```

### Dark
```css
--paper:        #1F1B17; /* warm near-black, not blue-black */
--surface:      #2A2420;
--surface-sunk: #181410;
--ink:          #EFE6D6;
--ink-soft:     #C3B8A6;
--ink-faint:    #8E8270;
--line:         #3C342C;
--terracotta:   #D97A52; /* brightened for dark */
--terracotta-deep:#E08A63;
--rust:         #C2613A;
--teal:         #6FB3AC;
--teal-deep:    #8AC6BF;
--teal-geo:     #4E8079;
--focus:        #8AC6BF;
--danger:       #E0795F;
--ok:           #7FB069;
```

Mode selection follows `prefers-color-scheme` with a manual override toggle (persisted in localStorage). Both palettes keep the warm, domestic feel — dark mode is "dim kitchen at night", never a cold dashboard.

## Materials & textures `[G2]`

- **No raster textures, no paper grain, no photographic backgrounds.**
- Surfaces are flat fills differentiated by the `--surface*` tokens and hairline `--line` borders.
- Depth is conveyed by **subtle, warm, low-opacity shadows** and borders — not heavy elevation. The "page" preview may sit on the cream field with a soft shadow to read as paper, but stays flat.
- **Flat vector geometry** `[G2]`: a small library of SVG teal motifs (a repeating diamond/tile rule, corner flourishes) used as section dividers, the empty-state illustration, and the footer mark. Decorative only; `aria-hidden`; never load-bearing for meaning; uses `--teal-geo`.

## Spacing, radii, borders

```css
--space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
--space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;
--radius-sm: 3px;  /* inputs, chips — gentle, print-like, NOT pill */
--radius-md: 6px;  /* cards, the page */
--border:    1px solid var(--line);
--shadow-paper: 0 1px 2px rgba(42,37,33,.06), 0 6px 18px rgba(42,37,33,.08);
```
Avoid fully-rounded "pill" shapes (reads as SaaS). Keep radii small and consistent.

## Components

- **Wordmark** — "hintof" set in the serif, lowercase, with a small teal geometric tick. Tagline ("a hint of —") optional, `--fs-sm`, `--ink-soft`.
- **Text field / textarea** — `--surface-sunk` well, hairline border, `--radius-sm`, label above in `--ink-soft`. Clear focus ring (`--focus`, 2px, offset).
- **Ingredient row** — inline group: quantity (narrow), unit (select/combobox), item (grow), note (optional), up/down buttons, remove. Wraps gracefully on mobile.
- **Step row** — auto-numbered, textarea, up/down, remove, optional "section header" insert.
- **Group/section header** — inline editable label, visually a `### ` sub-rule with a small teal divider.
- **Chip / tag input** — tags as removable chips, free entry with autocomplete from prior tags.
- **Toggle** — for wiki-links / callouts / fraction style / theme. Switch styled as a small labeled control, not a glossy iOS pill.
- **Action bar** — Copy, Download, Save to library; primary = terracotta solid, secondary = outline.
- **Live page** — the rendered note (and a "view raw Markdown" affordance). Styled like a cookbook page: serif title, readable body, the same palette.
- **Library list** — cards with title, a few tags, last-updated; open/duplicate/delete.
- **Toast** — small, bottom, for "Copied", "Saved", "Storage full — export to free space".
- **Empty state** — warm copy ("Start with a title. A hint of something good.") with the flat teal geometric art.

## Interaction states

Every interactive element defines: default, hover, focus-visible, active/pressed, disabled, and (where relevant) error and busy. Focus-visible always shows a clearly visible `--focus` ring (never removed). Hover never the *only* signal. Disabled controls retain ≥ 3:1 contrast and explain why where useful.

## Motion policy `[G6]`

- Subtle, purposeful micro-interactions only: row add/remove (height/opacity ~150ms), copy/save toast, theme cross-fade.
- **No** decorative/looping animation, parallax, or page-turn effects.
- **Respect `prefers-reduced-motion: reduce`** — disable non-essential transitions, keep instant state changes. This is tested.
- Durations 120–200ms, easing `cubic-bezier(.2,.0,.2,1)`.

## Anti-patterns (do not ship)

- Glassmorphism, blur panels, neon, saturated gradients, dark "dashboard" chrome.
- Skeuomorphic book (spine, page-curl, leather, photoreal paper) `[G1]`.
- The reference photo as a hero or background `[G7]`.
- Pill buttons, heavy drop shadows, oversized rounded cards (SaaS tells).
- Drag-and-drop as the only reorder method `[D3]`.
- Emoji as load-bearing UI, marketing-speak microcopy, exclamation-mark hype.
- Web-font CDNs or any external asset request `[T8]`.

## Accessibility constraints (design-level)

See `ACCESSIBILITY.md` for the full plan. Design must guarantee: AA contrast in both modes; visible focus everywhere; 44px touch targets; keyboard-operable reorder; semantic headings matching the visual hierarchy; non-colour status cues (icon/text alongside colour); reduced-motion support; and form fields with persistent, programmatically-associated labels.
