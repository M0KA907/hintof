# hintof — Implementation Plan

> Small, ordered, test-first phases. Each task lists purpose, files, dependencies, acceptance checks, tests, and rollback. Build the **core domain + serializer first** (it's the contract), then UI, then persistence, then polish, then v1.1. Do not start coding until the spec is approved.

Conventions: every task is TDD where logic exists (write the failing test first `[S2]`). "Done" = task acceptance met + relevant tests green in CI.

---

## Phase 0 — Project scaffold

### 0.1 Initialize toolchain
- **Purpose:** Vite + TS + Vitest + Playwright + ESLint/Prettier baseline.
- **Files:** `package.json`, `vite.config.ts`, `tsconfig.json`, `.eslintrc`, `.prettierrc`, `index.html`, `src/main.ts`, `vitest.config.ts`, `playwright.config.ts`.
- **Depends on:** none.
- **Acceptance:** `npm run dev` serves a blank page; `npm run typecheck`/`lint`/`test:unit` run (zero tests OK); `npm run build` emits `dist/` with a **relative base** `[T7]`.
- **Tests:** a trivial passing unit test to prove the runner.
- **Rollback:** delete scaffold; no app logic yet.

### 0.2 Design tokens + base styles
- **Purpose:** Encode the design tokens (light+dark) and base typography.
- **Files:** `src/styles/tokens.css`, `src/styles/app.css`, `public/fonts/*` (self-hosted), `index.html` (CSP meta, font preloads).
- **Depends on:** 0.1.
- **Acceptance:** tokens for both modes exist; `prefers-color-scheme` switches; fonts load from `self` only (no external requests) `[T8, G4, G5]`.
- **Tests:** build-time check that no external font/asset URLs are referenced.
- **Rollback:** revert CSS; scaffold still runs.

---

## Phase 1 — Domain model & the output contract (highest priority)

### 1.1 Core types
- **Purpose:** Define `Recipe` and friends as the single source of truth.
- **Files:** `src/model/types.ts`.
- **Depends on:** 0.1.
- **Acceptance:** types compile; match `TECHNICAL_SPEC.md` data model.
- **Tests:** type-level/compile only.
- **Rollback:** isolated file.

### 1.2 Quantities: fractions, ranges, scaling
- **Purpose:** Parse/normalize/scale/render quantities `[U1, U2]`.
- **Files:** `src/model/quantity.ts`, `tests/unit/quantity.test.ts`.
- **Depends on:** 1.1.
- **Acceptance:** all `TEST_PLAN` quantity cases pass; scaling exact; ranges scale both ends; never throws.
- **Tests:** unit (parse, reduce, render unicode/ascii, scale, ranges, garbage).
- **Rollback:** pure module; remove.

### 1.3 Unit normalization
- **Purpose:** Map unit spellings → canonical display; **no value conversion** `[W3]`.
- **Files:** `src/model/units.ts`, `tests/unit/units.test.ts`.
- **Depends on:** 1.1.
- **Acceptance:** normalization map covers common units; a unit change never alters quantity.
- **Tests:** unit.
- **Rollback:** pure module.

### 1.4 YAML frontmatter emitter
- **Purpose:** Deterministic, escaped, omission-correct frontmatter `[O1, T4]`.
- **Files:** `src/serialize/yaml.ts`, `tests/unit/yaml.test.ts`.
- **Depends on:** 1.1.
- **Acceptance:** output parses with a real YAML parser (test-only dep) and round-trips; escaping rules from `OBSIDIAN_SCHEMA.md` hold; empty fields omitted.
- **Tests:** unit (colons, quotes, unicode, reserved words, newlines, lists, dates).
- **Rollback:** pure module.

### 1.5 Markdown body emitter
- **Purpose:** Fixed-heading body with groups/sections, meta line, source line, image embed `[O2, M3]`.
- **Files:** `src/serialize/markdown.ts`, `tests/unit/markdown.test.ts`.
- **Depends on:** 1.2, 1.3.
- **Acceptance:** headings/sections omitted when empty; fractions render per style; toggles (wiki-links/callouts) honored `[O5, O6]`.
- **Tests:** unit.
- **Rollback:** pure module.

### 1.6 Filename generation
- **Purpose:** Safe `YYYY-MM-DD Title.md` `[O3]`.
- **Files:** `src/serialize/filename.ts`, `tests/unit/filename.test.ts`.
- **Depends on:** 1.1.
- **Acceptance:** all `TEST_PLAN` filename cases pass.
- **Tests:** unit.
- **Rollback:** pure module.

### 1.7 `recipeToNote` + golden fixtures
- **Purpose:** Compose 1.4+1.5 into the full note; lock the contract with golden files `[T4]`.
- **Files:** `src/serialize/index.ts`, `tests/golden/*` (minimal, complete, omission, grouping, toggles, edge content).
- **Depends on:** 1.4, 1.5.
- **Acceptance:** golden bytes match `OBSIDIAN_SCHEMA.md` examples; one code path for preview & export.
- **Tests:** golden (byte-compare).
- **Rollback:** revert; lower layers still tested.

---

## Phase 2 — State store & form UI

### 2.1 Reactive store
- **Purpose:** Tiny typed store `[T3]`.
- **Files:** `src/store/store.ts`, `src/store/actions.ts`, `tests/unit/store.test.ts`.
- **Depends on:** 1.1.
- **Acceptance:** subscribe/select/update work; actions are deterministic transitions.
- **Tests:** unit.
- **Rollback:** isolated.

### 2.2 Live preview wiring
- **Purpose:** Render `recipeToNote(state)` live; preview == export.
- **Files:** `src/ui/views/preview.ts`, `src/main.ts`.
- **Depends on:** 1.7, 2.1.
- **Acceptance:** typing updates preview ≤16ms for typical recipes; output equals export.
- **Tests:** integration (preview==export); e2e smoke.
- **Rollback:** revert view.

### 2.3 Core form: title, meta, fields
- **Purpose:** Title (required), description, servings, times, tags+taxonomy, source, image `[W2, U3, M1, M2, M3]`.
- **Files:** `src/ui/components/*`, `src/ui/views/form.ts`.
- **Depends on:** 2.1, 2.2.
- **Acceptance:** all fields edit state; empty fields omitted from output; labels associated `[ACCESSIBILITY]`.
- **Tests:** integration + axe on form.
- **Rollback:** revert components.

### 2.4 Ingredients (rows, groups, reorder, paste-parse)
- **Purpose:** Structured rows, sub-groups, accessible reorder, fuzzy paste `[W3, O2, D3, S1]`.
- **Files:** `src/ui/components/ingredient-row.ts`, `src/parse/ingredient-parse.ts`, tests.
- **Depends on:** 2.3, 1.2, 1.3.
- **Acceptance:** Enter adds next row; up/down reorder w/ focus + announce; paste splits common lines, leaves uncertain ones editable, never wrong-silently `[S1]`.
- **Tests:** unit (parse), e2e (reorder/keyboard), axe.
- **Rollback:** revert; basic free-text rows remain.

### 2.5 Steps (rows, sections, reorder)
- **Purpose:** Numbered steps + section headers + reorder `[W4, D3]`.
- **Files:** `src/ui/components/step-row.ts`, tests.
- **Depends on:** 2.3.
- **Acceptance:** as 2.4 for steps; sections optional.
- **Tests:** e2e + axe.
- **Rollback:** revert.

### 2.6 Optional sections + scaling control
- **Purpose:** Notes/Substitutions/Storage/Equipment + scaling UI `[M4, U2]`.
- **Files:** `src/ui/components/*`, `src/store/actions.ts` (scale).
- **Depends on:** 2.4, 1.2.
- **Acceptance:** sections omitted when empty; scaling by multiplier/servings recomputes live and correctly.
- **Tests:** unit (scale action), e2e.
- **Rollback:** revert; sections optional anyway.

### 2.7 Output toggles
- **Purpose:** Wiki-links, callouts, fraction style, theme toggles `[O5, O6, G5]`.
- **Files:** `src/ui/components/toggle.ts`, prefs in store.
- **Depends on:** 1.5, 2.1.
- **Acceptance:** toggles change output and persist in prefs.
- **Tests:** integration + golden (toggle variants).
- **Rollback:** revert; defaults stand.

---

## Phase 3 — Export & persistence

### 3.1 Copy + download
- **Purpose:** Clipboard fallback chain + `.md` download `[R1, O3]`.
- **Files:** `src/export/clipboard.ts`, `src/export/download.ts`, tests.
- **Depends on:** 1.7, 1.6.
- **Acceptance:** copy success + forced-failure fallback; download named correctly; object URLs revoked.
- **Tests:** e2e (both paths).
- **Rollback:** revert; preview still copyable manually.

### 3.2 Autosave + recovery
- **Purpose:** Debounced draft autosave; restore on load `[D2]`.
- **Files:** `src/persist/autosave.ts`, tests.
- **Depends on:** 2.1.
- **Acceptance:** reload restores unsaved edit.
- **Tests:** integration.
- **Rollback:** revert; lose only autosave.

### 3.3 Library CRUD + view
- **Purpose:** Save/list/reopen/edit/delete `[D1]`.
- **Files:** `src/persist/library.ts`, `src/ui/views/library.ts`, tests.
- **Depends on:** 3.2.
- **Acceptance:** upsert by id; list/open/delete; explicit save distinct from autosave.
- **Tests:** integration + e2e + axe.
- **Rollback:** revert; single-recipe mode still works.

### 3.4 JSON import/export + validation
- **Purpose:** Library backup/transfer; safe import `[D2, R4]`.
- **Files:** `src/persist/io.ts`, tests, edge fixtures.
- **Depends on:** 3.3.
- **Acceptance:** lossless round-trip; malformed quarantined; existing library untouched on failure; merge/replace works; untrusted handling.
- **Tests:** integration (round-trip, malformed, oversized).
- **Rollback:** revert; library still local.

### 3.5 Quota handling + migration scaffold
- **Purpose:** Quota guard + `schema_version` migration framework `[R2, R3, O7]`.
- **Files:** `src/persist/migrate.ts`, quota wrappers, tests.
- **Depends on:** 3.3.
- **Acceptance:** quota error preserves edit + prompts export; v1→v1 identity migration in place; framework ready for future bumps.
- **Tests:** unit (migration), integration (quota sim).
- **Rollback:** revert migration; v1 only.

---

## Phase 4 — A11y, responsive, help, deploy

### 4.1 Accessibility pass
- **Purpose:** Meet `ACCESSIBILITY.md` end-to-end.
- **Files:** `src/ui/a11y.ts` (focus mgmt, live region), component fixes.
- **Depends on:** Phase 2–3.
- **Acceptance:** keyboard-only core flow; live-region announcements; focus-visible everywhere; dialog focus-trap/Esc.
- **Tests:** axe (both themes, all views), keyboard e2e.
- **Rollback:** targeted fixes; revert individually.

### 4.2 Responsive + reduced motion
- **Purpose:** Mobile/tablet layouts, Write/Preview toggle, motion policy `[D4, G6]`.
- **Files:** CSS, `src/ui/views/*`.
- **Depends on:** Phase 2.
- **Acceptance:** usable 320–1440px, 200% zoom, 400% reflow; reduced-motion respected; 44px targets.
- **Tests:** responsive e2e, reduced-motion check.
- **Rollback:** revert CSS.

### 4.3 In-app help + schema reference + empty states
- **Purpose:** Optional, dismissible guidance for newcomers `[W1, S3]`.
- **Files:** `src/ui/views/help.ts`, empty-state components, flat SVG geometry `public/geometry/*`.
- **Depends on:** Phase 2.
- **Acceptance:** helper text dismissible and out of experts' way; schema explainer accessible; warm empty states.
- **Tests:** integration + axe.
- **Rollback:** revert; core unaffected.

### 4.4 CI + Pages deploy + privacy gate
- **Purpose:** Gated deploy `[T7, S2, T8]`.
- **Files:** `.github/workflows/deploy.yml`.
- **Depends on:** all tests exist.
- **Acceptance:** `npm run check` gates deploy; built `dist` works under `/<repo>/` subpath; e2e asserts zero external-origin requests.
- **Tests:** base-path e2e + no-network assertion.
- **Rollback:** disable workflow; manual build still possible.

### 4.5 README + final docs polish
- **Purpose:** Portfolio front door; hand-written, no AI-slop, no screenshots `[S3]`.
- **Files:** `README.md`, `docs/*`.
- **Depends on:** working app + live URL.
- **Acceptance:** README has pitch, live link, privacy note, dev/test steps; docs consistent with shipped behavior.
- **Rollback:** docs-only.

---

## Phase 5 — v1.1 (post-MVP)

### 5.1 Rating + cook history `[M4]`
- **Files:** model fields (`rating`, `datesMade`), UI, frontmatter (`rating`, `date_made`), `schema_version` bump + migration.
- **Acceptance:** logging "made it" appends a date; rating renders; golden fixtures updated; migration tested.

### 5.2 PWA + offline `[T5]`
- **Files:** `manifest.webmanifest`, icons, service worker with base-path-aware scope/precache.
- **Acceptance:** installable; offline reload under subpath works; cache versioned per release; still zero external requests.
- **Tests:** offline e2e under subpath; SW update flow.
- **Rollback:** unregister SW; app stays online-only.

---

## Risk-focused test anchors (carry through all phases)

- Fuzzy paste-parse correctness `[S1]` → 2.4 + parse unit fixtures.
- YAML escaping of multiline/unicode/quotes `[T4]` → 1.4 + golden.
- Filename safety/collisions `[O3]` → 1.6.
- Dark-mode contrast parity `[G5]` → 4.1 axe both themes.
- Pages base-path / PWA cache `[T7, T5]` → 4.4 + 5.2.
