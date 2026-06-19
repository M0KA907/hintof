# hintof — Accessibility Plan

> Target: **WCAG 2.1 AA**, verified in **both light and dark modes** `[G5]`. Accessibility is a release gate, not a nicety `[D4, S2]`.

## Principles

- Everything works **keyboard-only**. No interaction depends on a mouse, hover, or drag `[D3]`.
- Everything works for **screen readers** with meaningful names, roles, and state.
- The interface is usable at **200% zoom** and **400% reflow** (single column, no horizontal scroll).
- **Colour is never the only signal.** Status uses icon/text + colour.
- **Reduced motion** is honoured `[G6]`.

## Keyboard

- Logical, predictable **tab order** following visual order.
- **Enter adds the next row** in ingredient/step lists; the new row receives focus `[D4]`.
- **Reordering** uses up/down buttons reachable by Tab and operable by Enter/Space; focus follows the moved item; the move is announced. Optional drag is an *enhancement* layered on top, never the only path `[D3]`.
- App shortcuts (e.g. copy, download) have visible, discoverable equivalents and don't trap focus or clash with assistive tech.
- **No keyboard traps.** Dialogs (import, confirm-delete) trap focus *within* the dialog while open, restore focus to the trigger on close, and close on `Esc`.
- Visible **focus-visible** ring on every focusable element, using `--focus`, never removed.

## Screen reader / semantics

- Native elements first: real `<button>`, `<label>`, `<input>`, `<select>`, `<textarea>`, `<a>`. ARIA only to fill gaps.
- Each field has a **persistent, programmatically-associated label** (`<label for>`), not placeholder-as-label.
- Headings form a correct outline (`h1` app/recipe title → `h2` sections → `h3` groups) matching the visual hierarchy.
- Landmarks: `header`, `main`, `nav` (library), `footer`.
- **Live region** (`aria-live="polite"`) announces: row added/removed, item moved up/down, "Copied", "Saved", scale applied, and errors (`assertive` for failures).
- Ingredient rows expose composite names (e.g. "Ingredient 2: quantity / unit / item / note") so the grouping is understandable aurally.
- Tag chips: each removable chip is a button labelled "Remove tag X"; the tag input announces autocomplete suggestions appropriately (combobox pattern).
- Toggles (wiki-links, callouts, theme, fraction style) use `role="switch"` / checkbox semantics with clear on/off state.
- Icon-only buttons have `aria-label`; decorative SVG geometry is `aria-hidden="true"`.

## Colour & contrast `[G4, G5]`

- Body text ≥ **4.5:1** (target 7:1) in both modes; large text & UI components ≥ **3:1**.
- Accent-on-surface combinations are chosen so text uses the `*-deep` tokens that meet contrast; `--teal-geo` is decorative only and never used for text.
- Tested automatically for both palettes (see `TEST_PLAN.md`); failures block release.

## Forms & errors

- Errors are announced, associated with their field (`aria-describedby`), and described in text — not by colour alone.
- Required state (the single required Title) is conveyed in the label, not only by an asterisk colour.
- The fuzzy-parse "couldn't confidently split this line" hint is surfaced as field help text, not an inscrutable colour change.

## Motion & sensory `[G6]`

- `prefers-reduced-motion: reduce` disables non-essential transitions; state changes still occur instantly.
- No content flashes more than 3×/second.
- No information conveyed solely by sound or animation.

## Mobile / touch `[D4]`

- Touch targets ≥ **44×44px** with adequate spacing.
- Fully usable single-column layout; Write/Preview toggle; sticky reachable actions.
- Reorder buttons are large enough for touch; drag is not required.

## Zoom / reflow

- Usable at 200% zoom; content reflows to one column by 320px CSS width with no loss of function and no horizontal scrolling (WCAG 1.4.10).
- No fixed pixel heights that clip text when font size increases.

## Testing (summary; full detail in TEST_PLAN.md)

- Automated **axe** checks on every primary view, in **both modes**, in CI `[S2]`.
- Keyboard-only e2e walkthrough of the core flow (create → reorder → scale → copy/download) in Playwright.
- Manual screen-reader smoke test (VoiceOver / NVDA) before each release.
- Contrast assertions for both token sets.

## Non-negotiables (block release)

- Any interactive feature unreachable/inoperable by keyboard.
- Any axe violation of `serious`/`critical` severity.
- Contrast failure in either mode.
- A focusable element with no visible focus indicator.
- Drag-only reordering.
