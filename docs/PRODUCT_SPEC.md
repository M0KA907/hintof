# hintof — Product Specification

> Status: approved-pending. Derived from the discovery interview. Decision IDs in brackets (e.g. `[P1]`) refer to `DECISIONS.md`.

## Problem statement

People who keep recipes in Obsidian end up hand-writing YAML frontmatter and Markdown by feel. It's slow, easy to get wrong (a stray `:` breaks the YAML, fractions render inconsistently, filenames contain illegal characters), and the output drifts from note to note. Existing recipe apps either lock data in a proprietary cloud or export messy Markdown that doesn't fit a vault.

hintof is a small, fast, fully client-side web tool that turns a structured form into clean, correct, **Obsidian-compatible** Markdown — with the YAML escaping, filename safety, and consistent structure handled for you. Nothing leaves the browser.

## Product identity

- **Name** `[P1]` — *hintof* reads as "a hint of —" (a hint of saffron, a hint of thyme). The culinary phrasing shows up lightly in the tagline and a few empty states; it is never plastered across the UI.
- **Nature** `[P3]` — a genuine **public utility** that also serves as a **portfolio piece**. It must be usable by a stranger who lands on the URL, and crafted well enough to show off.
- **Voice** `[P4]` — warm and editorial in headings and empty states (like a good cookbook intro), quiet and functional in form labels, buttons, and error text. Never twee, never jokey.
- **The one-line pitch** — *Write a recipe, get a clean Obsidian note.*

## Target users `[P2, W1]`

Two audiences, served by one interface:

1. **Obsidian-literate cooks (primary optimization target).** They know Markdown, frontmatter, and Dataview. They want speed, correctness, and zero hand-holding. The default experience is tuned for them: keyboard-first, fast entry, no chrome in the way.
2. **Home cooks new to Obsidian (must also succeed).** They don't know what frontmatter is. They are served by *optional, dismissible* helper text and an in-app schema/help reference — never by anything that slows the expert path.

The author is treated as the "must never annoy" power-user persona.

## User stories

- As a cook, I can enter a recipe through a structured form and watch the Markdown note build live, so I trust what I'll get before I export.
- As an Obsidian user, I can copy the note to my clipboard or download a correctly-named `.md` file and drop it straight into my vault.
- As a careful cook, I can scale a recipe to a different number of servings and have the quantities recompute correctly.
- As someone with many recipes, I can save recipes to a local library, reopen them, and edit them later.
- As a newcomer, I can read short inline hints explaining what a field does and what the output looks like, without those hints getting in my way once I understand.
- As a privacy-conscious user, I can use the whole tool offline with confidence that nothing is uploaded anywhere.
- As someone who switches machines, I can export my whole library to a JSON file and import it elsewhere.

## Core workflow

1. Open the app (works offline once cached). A new blank recipe is ready, or the local library is shown.
2. Enter the **title** (the only required field) and any other fields: servings, times, ingredients, steps, tags, source, notes, etc.
3. Ingredients are entered as structured rows (quantity · unit · item · optional note), groupable under sub-headings ("For the sauce"). A free-text line can be **pasted and auto-split** into those fields, always editable afterward.
4. Steps are entered as discrete numbered boxes, groupable under section headers ("Prep", "Bake").
5. The Markdown **preview updates live** as you type.
6. Optionally **scale** by a multiplier or a target serving count; quantities recompute.
7. **Copy** the Markdown or **download** it as `YYYY-MM-DD Title.md`.
8. Optionally **save** the recipe to the local library to reopen/edit later.

## Functional requirements

### Recipe content
- **FR-1** Title is the only required field `[W2]`. Every other field is optional and is omitted cleanly from the output when blank.
- **FR-2** Ingredients are structured rows: quantity, unit, item, optional per-ingredient note `[W3]`. Rows can be grouped under named sub-sections `[O2]`.
- **FR-3** A pasted free-text ingredient line is parsed (fuzzy) into quantity/unit/item where possible, with the result always editable and a safe fall-back to free text when parsing is uncertain `[W3, S1]`.
- **FR-4** Units are **display-normalized only** (e.g. "tablespoon" → "tbsp"). No value conversion of any kind; volume↔weight is out of scope `[W3]`.
- **FR-5** Quantities accept unicode fractions (`½`), ASCII fractions (`1/2`), decimals (`0.5`), and ranges (`2-3`). Ranges are first-class `[U1]`.
- **FR-6** Instructions are discrete numbered steps, groupable under section headers `[W4]`.
- **FR-7** Recipe scaling by multiplier or target servings recomputes ingredient quantities live; ranges scale at both ends; results render in readable fractions `[U2]`.
- **FR-8** Durations: structured prep / cook / total time fields. No live/interactive countdown `[U3]`.
- **FR-9** Tags: free-text tags with autocomplete from previously-used tags, plus optional structured `cuisine`, `course`, and `diet` fields `[M1]`.
- **FR-10** Source/attribution: optional structured fields — URL, canonical URL, publisher, import timestamp/parser, author, book title, page, "adapted from" `[M2]`.
- **FR-11** Images: referenced by filename, emitted as an Obsidian embed `![[file.jpg]]`. No upload, no hosting `[M3]`.
- **FR-12** Optional sections in v1.0: Notes, Substitutions, Storage, Equipment `[M4]`.

### Output & export
- **FR-13** The generated note is **Obsidian-compatible Markdown** with rich, Dataview-friendly YAML frontmatter and a human-readable prose body `[O1, O2]`. See `OBSIDIAN_SCHEMA.md` — the schema is a versioned, tested contract.
- **FR-14** Copy-to-clipboard with a graceful fallback chain (Clipboard API → manual select → download) `[R1]`.
- **FR-15** Download as `.md` with a safe, collision-aware filename `YYYY-MM-DD Title.md` `[O3]`.
- **FR-16** Links are plain text by default, with an opt-in toggle to wrap chosen fields in `[[wiki-links]]` `[O5]`.
- **FR-17** Notes-type sections render as plain headings by default, with an opt-in toggle for Obsidian callouts `[O6]`.
- **FR-18** A `schema_version` is stamped in frontmatter `[O7]`.

### Library & persistence
- **FR-19** A local library holds many recipes (save, list, reopen, edit, delete) `[D1]`.
- **FR-20** The in-progress edit autosaves and is recovered after reload/crash; "Save to library" is a distinct, deliberate action `[D2]`.
- **FR-21** The whole library can be exported to / imported from a JSON file `[D2]`. Import validates input, fails safely, and offers merge-vs-replace `[R4]`.
- **FR-22** Storage-quota errors are detected and surfaced without losing the current edit; the user is prompted to export `[R2]`.
- **FR-23** Stored data is migrated forward, non-destructively, when `schema_version` changes `[R3]`.

### Interaction
- **FR-24** Ingredients and steps reorder via keyboard-accessible up/down controls; drag-and-drop is an optional enhancement, never the only method `[D3]`.
- **FR-25** Keyboard-first desktop flow (Enter adds the next row, complete tab order, copy/download shortcuts) and a fully usable touch-first mobile layout are **both first-class** `[D4]`.

## Non-functional requirements

- **NFR-1 Privacy** — fully client-side; no telemetry, analytics, trackers, or external network requests at runtime `[T8]`.
- **NFR-2 Offline** — installable PWA with full offline use (v1.1) `[T5]`; the v1.0 app must still work when reloaded with assets cached.
- **NFR-3 Accessibility** — WCAG 2.1 AA, verified in both light and dark modes; no drag-only interactions. See `ACCESSIBILITY.md`.
- **NFR-4 Performance** — small bundle, fast first paint, live preview with no perceptible lag. Budgets in `TECHNICAL_SPEC.md`.
- **NFR-5 Correctness** — the output contract is golden-file tested; YAML is always valid `[T4, S2]`.
- **NFR-6 Browser support** — modern evergreen desktop + mobile (last ~2 versions) `[T6]`.
- **NFR-7 Durability** — minimal dependencies, plain static deployment `[T1, T2, T7]`.

## MVP (v1.0) `[S1]`

In scope:
- Create / edit / live-preview / copy / download a recipe.
- All core fields + optional sections (Notes, Substitutions, Storage, Equipment).
- Structured ingredients with grouping + **fuzzy paste-parse**.
- Grouped numbered steps.
- Fractions/ranges + **recipe scaling**.
- Tags + structured taxonomy + structured source + image filename refs.
- Local library + autosave/recovery + JSON import/export.
- Light **and** dark themes.
- Full keyboard + mobile support, full a11y.
- Wiki-link and callout opt-in toggles.
- Hand-rolled, golden-tested Markdown/YAML serializer with `schema_version`.

Deferred to v1.1:
- PWA install + offline service worker `[T5]`.
- Rating + cook-history / "last made" logging `[M4]`.

## Non-goals `[S4, W3]`

- Volume↔weight conversion (e.g. cups→grams) — excluded; ingredient-dependent and error-prone.
- Nutrition / calorie data.
- Accounts, cloud sync, or any server/backend.
- Importing recipes by scraping URLs.
- User-editable note templates (a possible future feature, not v1.x) `[O7]`.
- Interactive cooking timers/countdowns `[U3]`.

## Future possibilities

PWA/offline and rating+history (v1.1); user-editable templates; opt-in privacy-respecting analytics (only if ever justified); additional optional sections; richer taxonomy suggestions; a design/process case-study writeup.

## Acceptance criteria

- A recipe with only a title produces a valid note containing just `title`, the bookkeeping fields, and an `# H1` — no empty sections, no empty YAML keys.
- A fully-populated recipe round-trips: export → re-import → identical structured data.
- The emitted YAML always parses with a standard YAML parser, including titles/notes containing `:`, `#`, quotes, newlines, unicode, and leading/trailing whitespace.
- Filenames never contain OS- or Obsidian-illegal characters and never collide silently.
- Scaling `serves 4 → 6` multiplies quantities by 1.5 and renders readable fractions; ranges scale at both ends.
- Copy works, or degrades through the fallback chain; download always works.
- The tool functions with no network connection (after first load) and makes zero external requests.
- Every interactive feature is operable by keyboard alone and passes automated a11y checks in light and dark modes.
- The full CI test pyramid is green.

## Definition of done

A feature is done when: it meets its acceptance criteria; it has unit/golden/e2e/a11y tests as applicable and they pass in CI `[S2]`; it works in light and dark, on desktop keyboard and mobile touch; it makes no external network calls; the relevant spec docs are updated; and the deployed Pages build reflects it.
