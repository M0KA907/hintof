# hintof — Decision Register (ADR log)

Architecture/Decision log built during the discovery interview. Status: **all Final** unless noted. Each entry: decision, reason, alternatives rejected, dependencies, confidence.

Format note: "Provisional" decisions from the interview were all resolved in later rounds and are recorded here in their resolved state, with the resolution noted.

---

## Product identity

### P1 — Name meaning
**Decision:** *hintof* = culinary "a hint of —"; used lightly in tagline/empty states, never plastered.
**Reason:** On-brand with the warm cookbook visual; gives a memorable hook without being twee.
**Rejected:** Note-taking pun ("hints" = notes); pure meaningless wordmark.
**Depends on:** P4 (voice). **Confidence:** High.

### P2 — Primary users
**Decision:** Obsidian-literate cooks (primary optimization) **and** home cooks new to Obsidian (must also succeed).
**Reason:** User selected both; widens reach for a public utility.
**Rejected:** Author-only; newcomers-only.
**Resolution:** Tension resolved by W1 (fast UI + optional guidance).
**Depends on:** W1. **Confidence:** High.

### P3 — Ambition
**Decision:** Public utility **+** portfolio product.
**Reason:** Justifies the design/a11y/test investment; must be usable by strangers and showcase craft.
**Rejected:** Personal tool only.
**Depends on:** S2, S3, design + a11y specs. **Confidence:** High.

### P4 — Voice
**Decision:** Warm-editorial in headings/empty states; quiet & functional in labels/errors.
**Reason:** Matches visual thesis while keeping forms legible; user chose a mix of 1 & 2.
**Rejected:** All-functional; playful/punny.
**Confidence:** High.

## Workflow

### W1 — Guidance level (resolves P2)
**Decision:** Fast expert-speed UI + optional, dismissible helper text and in-app schema/help.
**Reason:** Serves both audiences without slowing experts.
**Rejected:** Newcomer-first guided UI; expert-only minimal.
**Confidence:** High.

### W2 — Required fields
**Decision:** Title only required; all else optional, omitted when blank.
**Reason:** Lowest friction; matches "capture a hint."
**Rejected:** Require ingredients+steps; require some body.
**Depends on:** O-series omission rules. **Confidence:** High.

### W3 — Ingredient model & units (resolved)
**Decision:** Structured qty/unit/item rows + per-ingredient note + fuzzy paste-parse; **units display-normalized only, no value conversion**; volume↔weight excluded.
**Reason:** Structure unlocks scaling/fractions; conversion (esp. volume↔weight) is ingredient-dependent and dangerous if wrong, so excluded.
**Rejected:** Free-text only; full hybrid parse with conversion; density-table conversion.
**Resolution:** Round-3 chose "no conversion — normalize display."
**Depends on:** U1, U2, S1 (parse risk). **Confidence:** High.

### W4 — Instruction model
**Decision:** Discrete numbered steps with optional section headers.
**Reason:** Enables reorder, grouping, clean ordered lists.
**Rejected:** Single textarea; flat steps only.
**Confidence:** High.

### U1 — Fractions & ranges
**Decision:** Accept unicode + ASCII + decimals; store canonically (rationals); ranges first-class.
**Reason:** Robust parsing + scaling; ranges are real in recipes.
**Rejected:** Decimals-only.
**Depends on:** U2. **Confidence:** High.

### U2 — Scaling
**Decision:** Scale by multiplier **and** target servings; live recompute; **in v1.0**.
**Reason:** Headline differentiator vs a plain template.
**Rejected:** Multiplier-only; defer scaling.
**Depends on:** U1, structured qty (W3), base `servings`. **Confidence:** High.

### U3 — Timers
**Decision:** Structured prep/cook/total durations (minutes); no live countdown.
**Reason:** It's a note generator, not a cooking companion.
**Rejected:** Interactive timers; single total-only.
**Confidence:** High.

### M1 — Tags
**Decision:** Free tags + autocomplete from prior tags + optional cuisine/course/diet.
**Reason:** Flexible for search + Dataview-friendly structure.
**Rejected:** Free-only; taxonomy-only.
**Confidence:** High.

### M2 — Attribution
**Decision:** Strong structured optional fields: URL, author, book, page, adapted-from.
**Reason:** Respects provenance; Dataview-queryable.
**Rejected:** Single free-text line; URL-only.
**Confidence:** High.

### M3 — Images
**Decision:** Reference by filename → `![[file.jpg]]`; no upload/hosting.
**Reason:** Static, privacy-first; Obsidian-native; no storage bloat.
**Rejected:** Local picker + zip bundle; no images.
**Depends on:** T8. **Confidence:** High.

### M4 — Optional sections (split by release)
**Decision:** v1.0 — Notes, Substitutions, Storage, Equipment. v1.1 — Rating, cook-history/"last made". Nutrition excluded.
**Reason:** High-value extras first; stateful logging follows once library exists.
**Rejected:** Nutrition (inaccurate/risky).
**Resolution:** Round-12 moved rating/history to v1.1.
**Depends on:** D1, S1. **Confidence:** High.

### D1 — Local library
**Decision:** Library of many recipes (save/list/reopen/edit/delete).
**Reason:** Needed for re-opening, editing, and (v1.1) history/ratings.
**Rejected:** Single recipe; single + autosave only.
**Depends on:** D2. **Confidence:** High.

### D2 — Persistence
**Decision:** Autosave + crash recovery + explicit "Save to library" + whole-library JSON import/export.
**Reason:** No data loss; clear draft/saved model; portability/backup.
**Rejected:** Any single mechanism alone.
**Depends on:** R2, R3, R4. **Confidence:** High.

### D3 — Reordering
**Decision:** Keyboard-accessible up/down buttons as baseline; drag as progressive enhancement.
**Reason:** Accessibility; testability.
**Rejected:** Drag-primary; buttons-only (acceptable fallback).
**Depends on:** ACCESSIBILITY. **Confidence:** High.

### D4 — Ergonomics
**Decision:** Keyboard-first desktop **and** touch-first mobile, both first-class.
**Reason:** Widest reach; user chose "both equally."
**Rejected:** Keyboard-primary with lesser mobile.
**Depends on:** responsive + a11y tests. **Confidence:** High.

## Obsidian output contract

### O1 — Frontmatter design
**Decision:** Rich, Dataview-friendly scalars + lists; body stays prose.
**Reason:** Queryable metadata + readable note.
**Rejected:** Minimal frontmatter; maximal (ingredients/steps in YAML).
**Confidence:** High.

### O2 — Body structure
**Decision:** Standard fixed headings + ingredient sub-groups + step sections.
**Reason:** Predictable, plugin-independent, readable; stable contract.
**Rejected:** Flat lists; user-configurable order.
**Confidence:** High.

### O3 — Filename (resolved)
**Decision:** `YYYY-MM-DD Title.md`; preserve case/spaces; sanitize only OS/Obsidian-illegal chars; fix reserved names/trailing dots; collision suffixes.
**Reason:** Keeps human-readable look while guaranteeing valid, safe files.
**Rejected:** Title verbatim (unsafe — pushed back and overridden); kebab slug; truly verbatim.
**Resolution:** Round-7 chose minimal-sanitization over the verbatim choice of Round-6.
**Confidence:** High.

### O4 — Export outputs
**Decision:** Markdown-only per note (copy + .md); structured JSON only at library level.
**Reason:** Keeps notes clean & plugin-independent.
**Rejected:** Embedded JSON block; sidecar .json.
**Confidence:** High.

### O5 — Wiki-links
**Decision:** Plain text default; opt-in toggle to wiki-link chosen fields; frontmatter never wiki-linked.
**Reason:** Portability by default; power for graph users.
**Rejected:** Never; wiki-link by default.
**Confidence:** High.

### O6 — Callouts
**Decision:** Plain headings default; opt-in Obsidian callouts.
**Reason:** Plugin-independent default; nice-to-have for Obsidian.
**Rejected:** Never; callouts by default.
**Confidence:** High.

### O7 — Templates & versioning
**Decision:** Fixed canonical template + `schema_version` stamp now; user-editable templates = future.
**Reason:** Stable, testable, migratable contract; custom templates would destabilize it.
**Rejected:** No version field; user templates now.
**Depends on:** R3. **Confidence:** High.

## Design

### G1 — Layout literalness
**Decision:** Editorial cookbook-page layout; evocative, not skeuomorphic.
**Reason:** Distinctive + readable + responsive/a11y-friendly; avoids gimmick.
**Rejected:** Literal open-book; merely-modern-with-warm-colors.
**Confidence:** High.

### G2 — Materials (resolved)
**Decision:** Flat color, no raster textures/grain; **flat vector teal geometry as sparing accents**.
**Reason:** Honors the seed's "geometric patterns" while staying light, high-contrast, on-brand; user chose flat but the geometry is a named brand element.
**Rejected:** Rich/maximal texture; truly zero decoration; one-pattern-once.
**Resolution:** Round-9 reconciled "flat color only" to allow flat vector geometry.
**Confidence:** High.

### G3 — Typography
**Decision:** Editorial serif headings + humanist sans body/UI.
**Reason:** Personality + legibility balance.
**Rejected:** All-serif; all-sans.
**Confidence:** High.

### G4 — Palette
**Decision:** Muted, desaturated cream/ink/terracotta/teal.
**Reason:** Earthy, print-like, easiest to hit contrast.
**Rejected:** Saturated; near-neutral single-accent.
**Confidence:** High.

### G5 — Dark mode
**Decision:** Light **+** dark from day one; respect `prefers-color-scheme` + manual override.
**Reason:** User chose both; expected by users.
**Rejected:** Light-only at launch; dark as non-goal.
**Depends on:** contrast tests both modes. **Confidence:** High.

### G6 — Motion
**Decision:** Subtle, purposeful, `prefers-reduced-motion`-aware; no decorative animation.
**Reason:** Calm editorial tone; avoids "AI landing page" feel; accessible.
**Rejected:** No animation; rich/characterful motion.
**Confidence:** High.

### G7 — Reference photo
**Decision:** Inspiration only; never shipped as an asset.
**Reason:** Licensing risk, weight, conflicts with flat aesthetic + no-network.
**Rejected:** Hero image; background texture.
**Depends on:** T8. **Confidence:** High.

## Architecture

### T1 — Stack
**Decision:** TypeScript + Vite → static files.
**Reason:** Types + test rigor for the contract; static output for Pages.
**Rejected:** Plain HTML/JS no-build; UI framework.
**Confidence:** High.

### T2 — Dependencies
**Decision:** Minimal & vetted; zero runtime deps preferred; dev tooling allowed.
**Reason:** Small bundle, small supply-chain, longevity.
**Rejected:** Strict zero (incl. build); liberal.
**Confidence:** High.

### T3 — State model
**Decision:** Vanilla TS + tiny custom typed reactive store.
**Reason:** Smallest runtime, full control, testable; fits a single rich form.
**Rejected:** Lit/web components; signals lib.
**Confidence:** High.

### T4 — Serialization
**Decision:** Hand-rolled, golden-file-tested emitter; no YAML runtime dep.
**Reason:** Exact control over escaping/aesthetics for the fixed schema.
**Rejected:** YAML library; hybrid parse/emit.
**Depends on:** O-series, S2. **Confidence:** High.

### T5 — Offline/PWA (v1.1)
**Decision:** Installable PWA + full offline; deferred to v1.1.
**Reason:** Great for kitchen use; adds SW + cache/base-path complexity, so not in MVP.
**Rejected:** Offline-no-install; online-only.
**Resolution:** Round-12 moved to v1.1.
**Depends on:** T7. **Confidence:** High.

### T6 — Browser support
**Decision:** Modern evergreen desktop + mobile (last ~2 versions).
**Reason:** Enables modern APIs/CSS; matches real users.
**Rejected:** Broad/no-JS; cutting-edge-only.
**Confidence:** High.

### T7 — Deploy / base path
**Decision:** Relative base + GitHub Actions auto-deploy; works at subpath, custom domain, local.
**Reason:** Avoids the classic Pages base-path footgun; portfolio-grade CI.
**Rejected:** Hardcoded `/hintof/`; manual gh-pages.
**Depends on:** S2 gate. **Confidence:** High.

### T8 — Privacy
**Decision:** Fully client-side; zero telemetry; no external network at runtime.
**Reason:** Strong trust story; fits local-first ethos.
**Rejected:** Anonymous analytics; no guarantee.
**Confidence:** High.

## Scope & quality

### S1 — MVP cut
**Decision:** v1.0 = polished core + scaling + fuzzy paste-parse + all v1.0 sections + library + both themes + a11y + toggles. v1.1 = PWA/offline + rating/history.
**Reason:** User selected scaling + paste-parse as must-have; deferred PWA + history.
**Rejected:** Ship-everything-at-once; ultra-thin MVP.
**Risk:** Fuzzy paste-parse correctness (see S1 risk in PRODUCT_SPEC). **Confidence:** High.

### S2 — Testing depth
**Decision:** Full CI-gated pyramid: unit + golden + e2e/responsive + a11y; all green to deploy.
**Reason:** Versioned-contract + portfolio bar.
**Rejected:** Core-only; light/manual.
**Confidence:** High.

### S3 — Docs/presentation
**Decision:** Polished README (live link, privacy note, dev steps) + in-app help & schema reference; **no screenshots; all docs hand-polished to avoid AI-slop tone**; full docs/ set maintained as living docs (seed deliverable). Case-study optional.
**Reason:** Portfolio front door; user explicitly wants human-quality, screenshot-free docs.
**Rejected:** README-only; case-study required now.
**Confidence:** High.

### S4 — Non-goals
**Decision:** Nutrition data; accounts/cloud/server; URL recipe-scraping. (Volume↔weight excluded per W3.)
**Reason:** Scope, accuracy, privacy, legal.
**Confidence:** High.

## Edge-case policies

### R1 — Clipboard failure
**Decision:** Graceful fallback chain (API → manual select → download always available).
**Rejected:** Error-only; download-only. **Confidence:** High.

### R2 — Storage quota
**Decision:** Detect, warn, preserve current work, prompt export; no silent loss.
**Rejected:** Assume space; auto-prune. **Confidence:** High.

### R3 — Migration
**Decision:** Versioned, non-destructive forward-migrations with backup.
**Rejected:** Best-effort; pin-and-refuse. **Depends on:** O7. **Confidence:** High.

### R4 — Malformed import
**Decision:** Validate, safe-fail, quarantine bad entries, merge/replace choice; treat input as untrusted.
**Rejected:** Trust input; all-or-nothing reject. **Confidence:** High.

---

## Open / assumed (apply default unless amended)

- **A1** Volume↔weight stays excluded (W3 authoritative); not formally a "declared non-goal" but treated as out of scope.
- **A2** Tags emitted as a YAML `tags:` list; no duplicated inline `#tags` in body.
- **A3** Fonts self-hosted/bundled (no font CDN) to honour T8.
- **A4** Dates use local `YYYY-MM-DD` for filename prefix and date fields.
- **A5** Times stored as integer minutes in frontmatter; human-readable in body.
- **A6** Exact frontmatter field names/types per `OBSIDIAN_SCHEMA.md`.
- **A7** Recommended fonts: Fraunces (serif) + Source Sans 3 (sans), both OFL — finalize at build.
