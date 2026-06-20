# hintof — Obsidian Output Schema (the public contract)

> **This document defines a versioned, tested public contract.** The exact bytes hintof emits are governed here. Changes to it require a `schema_version` bump and a migration (see *Versioning*). Every rule below is backed by a golden-file test `[T4, S2]`.

Current `schema_version`: **2**.

## Design principles `[O1, O2, O6, O5]`

1. **Frontmatter is the machine layer** — rich but flat scalars and lists that Dataview can query. The body is for humans.
2. **Plugin-independent by default** — a hintof note renders correctly as plain Markdown with no Obsidian plugins installed. Obsidian-specific niceties (wiki-links, callouts) are **opt-in toggles**, never the default.
3. **Omit, don't empty** — a field with no value is absent entirely. No `key:` with a blank value, no empty headings, no empty lists.
4. **Always valid YAML** — every emitted document parses with a standard YAML 1.1/1.2 parser.

---

## Frontmatter schema

All keys are lower_snake_case. Order is fixed (below) for stable diffs.

| Key | Type | Required | Notes |
|-----|------|----------|-------|
| `schema_version` | integer | **always** | Currently `2`. |
| `title` | string | **always** | The recipe title. Quoted per escaping rules. |
| `aliases` | list<string> | optional | Alternate names; useful for Obsidian search. Omitted if empty. |
| `tags` | list<string> | optional | Free tags. Normalized: lowercased, spaces→`-`, no leading `#`. Omitted if empty. |
| `cuisine` | string | optional | e.g. `Italian`. |
| `course` | string | optional | e.g. `Main`, `Dessert`. |
| `diet` | list<string> | optional | e.g. `[vegetarian, gluten-free]`. |
| `servings` | integer | optional | Base serving count (used by scaling). |
| `prep_time` | integer | optional | **Minutes.** Integer for Dataview math. |
| `cook_time` | integer | optional | **Minutes.** |
| `total_time` | integer | optional | **Minutes.** Auto-filled as `prep+cook` if both present and not overridden. |
| `source_name` | string | optional | Display name of the source. |
| `source_url` | string | optional | URL. |
| `source_canonical_url` | string | optional | Canonical HTTP(S) URL found during import. |
| `source_publisher` | string | optional | Publisher/site name found during import. |
| `source_imported_at` | string | optional | ISO timestamp for an explicit URL import. |
| `source_parser` | string | optional | Parser that produced imported data, e.g. `json-ld` or `microdata`. |
| `source_author` | string | optional | |
| `source_book` | string | optional | |
| `source_page` | string | optional | Kept as string (can be `12-13`, `xiv`). |
| `adapted_from` | string | optional | Free text. |
| `rating` | integer | optional | 1–5. **v1.1.** |
| `date_made` | list<date> | optional | `YYYY-MM-DD` entries. **v1.1.** |
| `created` | date | **always** | `YYYY-MM-DD`, local date at creation. |
| `updated` | date | **always** | `YYYY-MM-DD`, local date at last edit. |

Notes:
- **Times are minutes** so Dataview can do arithmetic (`prep_time + cook_time`). The human-readable form ("1 hr 5 min") is rendered in the body meta line, not the frontmatter.
- Ingredients and steps are **not** placed in frontmatter (rejected as over-structured/fragile `[O1]`).

### Required vs optional & omission rules `[W2]`

- Always present: `schema_version`, `title`, `created`, `updated`.
- Everything else is emitted **only if it has a value**. Empty strings, empty lists, `null`, and whitespace-only values are treated as "no value" and the key is omitted.
- An all-empty list field is omitted; a list with at least one non-empty entry is emitted with empty entries dropped.

### YAML escaping rules `[T4]`

The hand-rolled serializer applies these deterministically:

- **Strings** are emitted unquoted only when they are "plain-safe": no leading/trailing whitespace; do not start with any of `! & * - ? { } [ ] , # | > @ \` " ' %`; contain no `: ` (colon-space), no ` #` (space-hash), no control chars, and are not a YAML reserved word (`true`, `false`, `yes`, `no`, `null`, `~`, numbers, dates).
- Otherwise strings are **double-quoted**, with `\` → `\\`, `"` → `\"`, and control characters escaped (`\n`, `\t`, etc.).
- **Multiline strings** (e.g. a title that somehow contains a newline — rare, but possible via paste) are emitted as a double-quoted scalar with `\n`, never as a raw block, to keep parsing unambiguous. Long free-text belongs in the body, not frontmatter.
- **Unicode** is preserved as UTF-8 (e.g. `Crème Brûlée`), never escaped to `\uXXXX`.
- **Lists** use block style:
  ```yaml
  tags:
    - weeknight
    - soup
  ```
- **Dates** are emitted unquoted in `YYYY-MM-DD` form.
- **Numbers** are emitted bare.

---

## Markdown body structure `[O2]`

Fixed heading order. Any section with no content is omitted entirely.

```
# {{title}}

{{description paragraph, if present}}

**Servings:** {{n}} · **Prep:** {{human time}} · **Cook:** {{human time}} · **Total:** {{human time}}

![[{{image filename}}]]            ← only if an image is referenced [M3]

## Ingredients
### {{group name}}                  ← only when groups are used [O2]
- {{qty}} {{unit}} {{item}}{{ — note}}

## Instructions
### {{section name}}                 ← only when sections are used [W4]
1. {{step}}

## Notes
{{free text}}

## Substitutions
- {{from}} → {{to}}{{ — note}}

## Storage
{{free text}}

## Equipment
- {{item}}

## Source
{{rendered source line}}
```

Rules:
- The **H1 title** is always emitted (portable outside Obsidian; harmless inside it).
- The **meta line** (servings/times) is emitted as plain bold text, only including the parts that have values. Omitted entirely if none.
- **Ingredient rows**: `qty`, `unit`, `item` joined with single spaces, skipping any empty part; a per-ingredient note is appended as ` — note`. Quantities render in the user's fraction style (see below).
- **Ingredient groups / step sections** only appear when the user defined them; otherwise the list is flat under the section heading `[O2, W4]`.
- **Substitutions** render as `original → replacement` lines.
- **Source** renders the present fields into one readable line. Source links are Markdown links only when their protocol is `http` or `https`; other protocols render as escaped plain text. Import provenance is appended in parentheses, e.g.:
  `[Smitten Kitchen](https://…) — Deb Perelman, Smitten Kitchen, *The Smitten Kitchen Cookbook*, p. 112 (adapted) ([canonical](https://…); imported 2026-06-20T12:00:00.000Z; parser: json-ld)`

### Fraction & range rendering `[U1]`

- Stored canonically as exact rationals (numerator/denominator) or ranges (`min`–`max` of rationals).
- Rendered using the configured style (default: unicode where a glyph exists — `½ ⅓ ¼ ⅔ ¾ ⅛` etc. — otherwise `a/b`; mixed numbers as `1½` / `1 1/2`).
- Ranges render as `2–3` (en dash). Scaling multiplies both ends and re-reduces.

### Opt-in Obsidian features

- **Wiki-links** `[O5]` (default off): when enabled, wraps chosen fields (e.g. ingredient items, `cuisine`) in `[[ ]]`. Frontmatter values are **not** wiki-linked (keeps Dataview clean).
- **Callouts** `[O6]` (default off): when enabled, `Notes`/`Substitutions`/`Storage` render as `> [!note]` / `> [!tip]` blocks instead of `##` headings. Degrades to blockquotes elsewhere.

---

## Filename generation `[O3]`

Format: **`YYYY-MM-DD Title.md`** — the `created` date, a space, the human-readable title, `.md`.

Sanitization (applied to the title portion only; preserves case and internal spaces so it still looks like the title):
1. Replace OS-illegal chars `/ \ : * ? " < > |` with a space.
2. Replace Obsidian-unsafe chars `# ^ [ ] |` with a space.
3. Collapse runs of whitespace to a single space; trim ends.
4. Strip trailing dots and spaces (Windows).
5. If the result is empty, use `Untitled`.
6. If a reserved device name results (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`, case-insensitive), suffix with `_`.
7. Truncate the title portion so the whole filename stays ≤ 255 bytes.
8. **Collision handling:** when saving to the library or downloading multiple, append ` (2)`, ` (3)`, … before `.md`.

Examples:
- `Mac & Cheese: Mom's` on 2026-06-19 → `2026-06-19 Mac & Cheese Mom's.md`
- `Pasta w/ Garlic` → `2026-06-19 Pasta w Garlic.md`
- `   ` → `2026-06-19 Untitled.md`

---

## Example — minimal note

Title only, created 2026-06-19:

```markdown
---
schema_version: 2
title: Weeknight Tomato Soup
created: 2026-06-19
updated: 2026-06-19
---

# Weeknight Tomato Soup
```

## Example — complete note

```markdown
---
schema_version: 2
title: "Crème Brûlée"
aliases:
  - Burnt Cream
tags:
  - dessert
  - make-ahead
cuisine: French
course: Dessert
diet:
  - vegetarian
servings: 6
prep_time: 20
cook_time: 40
total_time: 60
source_name: Smitten Kitchen
source_url: "https://smittenkitchen.com/creme-brulee"
source_canonical_url: "https://smittenkitchen.com/recipes/creme-brulee"
source_publisher: Smitten Kitchen
source_imported_at: "2026-06-20T12:00:00.000Z"
source_parser: json-ld
source_author: Deb Perelman
source_book: The Smitten Kitchen Cookbook
source_page: "112"
adapted_from: "Mom's version: less sugar"
created: 2026-06-19
updated: 2026-06-19
---

# Crème Brûlée

A make-ahead custard with a brittle caramel top.

**Servings:** 6 · **Prep:** 20 min · **Cook:** 40 min · **Total:** 1 hr

![[creme-brulee.jpg]]

## Ingredients
### Custard
- 2 cups heavy cream
- 1 vanilla bean — split and scraped
- 5 egg yolks
- ½ cup sugar

### Topping
- 6 tbsp sugar — for the caramel

## Instructions
### Prep
1. Heat the cream with the vanilla until steaming; steep 15 min.
2. Whisk yolks and sugar until pale.

### Bake
1. Temper the yolks, strain, divide into ramekins.
2. Bake in a water bath at 325°F for 40 min, until just set.

## Notes
Chill at least 2 hours before torching.

## Substitutions
- vanilla bean → 1 tsp vanilla extract

## Storage
Keeps 3 days covered in the fridge; torch just before serving.

## Equipment
- 6 ramekins
- kitchen torch

## Source
[Smitten Kitchen](https://smittenkitchen.com/creme-brulee) — Deb Perelman, Smitten Kitchen, *The Smitten Kitchen Cookbook*, p. 112 (adapted: Mom's version: less sugar) ([canonical](https://smittenkitchen.com/recipes/creme-brulee); imported 2026-06-20T12:00:00.000Z; parser: json-ld)
```

Note how `:` in the title and `adapted_from` forces double-quoting, while `Crème Brûlée` keeps its unicode unescaped.

---

## Library JSON (import/export) `[D2, R4]`

This is the **internal** structured format — separate from the per-note Markdown `[O4]`. It is JSON, not YAML.

```jsonc
{
  "format": "hintof-library",
  "schema_version": 2,
  "exported_at": "2026-06-19T12:00:00Z",
  "recipes": [ /* array of Recipe objects, see TECHNICAL_SPEC.md data model */ ]
}
```

Import rules: validate `format` and `schema_version`; migrate forward if older `[R3]`; validate each recipe against the schema; quarantine invalid entries with a clear report rather than aborting the whole file; offer **merge** (add/update by id) vs **replace**; treat all string content as untrusted text (no HTML/code execution, safe rendering only) `[R4]`.

---

## Versioning & migration `[O7, R3]`

- `schema_version` is an integer, bumped on **any** change to frontmatter keys, body structure, filename rules, or escaping that changes emitted bytes.
- v2 adds source provenance fields (`source_canonical_url`, `source_publisher`, `source_imported_at`, `source_parser`) and migrates v1 recipes forward on read.
- Each bump ships a forward migration `N → N+1` for both the per-recipe data and the library JSON.
- Migrations are **non-destructive**: stored data is migrated in memory on load; the on-disk/localStorage copy is only rewritten on a user-initiated save, and a pre-migration export is offered.
- Golden-file fixtures exist per version; old fixtures are kept to prove migrations and backward-readability.

## Plugin-independent guarantees

With **no plugins** installed, a hintof note: renders all headings/lists/text correctly; shows valid, parseable frontmatter; has a working `# H1`. **Dataview** (if installed) can query every frontmatter field. **No** feature of the default output depends on any community plugin. Wiki-links and callouts are the only Obsidian-flavored output, and both are opt-in.
