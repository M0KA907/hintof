# CLAUDE.md — hintof project wiki

Compact working context for agents. Read this first; deep detail lives in `docs/`.

## Project context
hintof is a static, client-side web app that turns a structured form into clean, Obsidian-compatible Markdown recipe notes. Public utility + portfolio piece. Deployed on GitHub Pages. No backend, ever.

## Product invariants (do not violate)
- **Title is the only required field.** Everything else is optional and omitted when blank.
- **The Markdown output is a versioned, tested public contract.** Changing emitted bytes requires a `schema_version` bump + migration + updated golden fixtures. See `docs/OBSIDIAN_SCHEMA.md`.
- **Plugin-independent by default.** Default output renders as plain Markdown; wiki-links and callouts are opt-in only.
- **No value conversion of units.** Display-normalize only (e.g. "tablespoon"→"tbsp"). Volume↔weight is out of scope.
- **Fully client-side, zero telemetry, no external network requests at runtime.** No font CDNs — fonts are self-hosted.
- **No drag-only interactions.** Reorder must work via keyboard up/down; drag is enhancement only.

## Architecture
- TypeScript + Vite → plain static files. No UI framework. Vanilla TS + a tiny typed reactive store.
- **Zero runtime dependencies** preferred; dev tooling (Vite/Vitest/Playwright/axe/ESLint) only. New runtime deps need written justification.
- Hand-rolled, golden-tested Markdown/YAML serializer — no YAML library at runtime.
- Persistence: `localStorage` (library + autosaved draft + prefs). Library JSON import/export.
- `recipeToNote(recipe)` is a pure function used by BOTH live preview and export — keep it the single code path.

## Repository map
- `src/model/` — `types.ts` (Recipe etc.), `quantity.ts` (fractions/ranges/scaling), `units.ts` (normalization).
- `src/parse/` — `ingredient-parse.ts` (fuzzy free-text → qty/unit/item).
- `src/serialize/` — `yaml.ts`, `markdown.ts`, `filename.ts`, `index.ts` (the contract).
- `src/store/` — reactive store + actions.
- `src/persist/` — library, autosave, io (JSON), migrate.
- `src/export/` — clipboard (fallback chain), download.
- `src/ui/` — components, views (form/preview/library/help), a11y helpers.
- `src/styles/` — `tokens.css` (light+dark), `app.css`.
- `public/` — self-hosted `fonts/`, flat SVG `geometry/`.
- `tests/` — `unit/`, `golden/`, `e2e/`, `a11y/`.
- `docs/` — full spec set (source of truth for decisions).

## Output-schema invariants
- Frontmatter: lower_snake_case keys, fixed order; rich/Dataview-friendly scalars + lists; body is prose.
- Always present: `schema_version`, `title`, `created`, `updated`. Everything else omitted when empty (no empty keys, no empty headings).
- Times stored as **integer minutes**; tags as a YAML `tags:` list (no inline `#tags`).
- YAML always parses: quote/escape per `docs/OBSIDIAN_SCHEMA.md` (colons, quotes, newlines, reserved words; unicode preserved unescaped).
- Filename: `YYYY-MM-DD Title.md`, minimal safe sanitization, reserved-name + collision handling.

## Design invariants
- Editorial cookbook-page layout (evocative, NOT skeuomorphic book).
- Flat color; no raster textures/grain; flat vector teal geometry as sparing accents.
- Serif headings (Fraunces) + humanist sans body (Source Sans 3), self-hosted.
- Muted cream/ink/terracotta/teal palette; light + dark from day one; AA contrast both modes.
- Subtle, `prefers-reduced-motion`-aware motion. No pills, no glassmorphism, no neon, no SaaS tells, no AI-landing-page hero.

## Security & privacy boundaries
- No network at runtime; no analytics; restrictive CSP (`default-src 'self'`).
- Imported data is untrusted: render as text, never `innerHTML` with user content; no `eval`/`Function`.
- No secrets/tokens/PII in app or repo.

## Commands (intended)
```bash
npm run dev
npm run typecheck && npm run lint
npm run test:unit      # unit + golden + integration
npm run test:e2e       # browser + responsive + base-path + no-network
npm run test:a11y      # axe, both themes
npm run build
npm run check          # the CI gate (all of the above)
```

## Testing expectations
- TDD for all logic (failing test first). Full CI-gated pyramid; deploy only on green `npm run check`.
- The serializer/schema is golden-file tested per `schema_version`; keep old fixtures.
- axe runs on every primary view in BOTH themes; keyboard-only e2e for the core flow.

## Agent workflow
- Follow `docs/IMPLEMENTATION_PLAN.md` phase order: domain + serializer (the contract) first, then UI, persistence, polish, then v1.1.
- Don't add runtime dependencies or new external requests.
- When changing output, bump `schema_version`, add a migration, update golden fixtures and `docs/OBSIDIAN_SCHEMA.md`.
- Keep `recipeToNote` the single source for preview + export.
- Update the relevant `docs/` file when behavior changes. Docs are hand-written quality — no AI-slop tone, no screenshots in README.

## Known risks
- Fuzzy ingredient paste-parse correctness (must never emit wrong structured data silently; fall back to free text).
- YAML escaping of multiline/unicode/quoted content.
- GitHub Pages base-path breakage (assets + v1.1 service-worker scope).
- Dark-mode contrast parity.
- Filename collisions / reserved names / illegal chars.

## Definition of done
Acceptance criteria met; unit/golden/e2e/a11y tests pass in CI; works light+dark, keyboard+touch; zero external network calls; relevant docs updated; deployed Pages build reflects it.

## Current implementation status
**In active development.** Shipped on `main`: editor scaffold, golden-tested serializer, library list/graph views, Obsidian live preview, themes, mobile pills.

In progress on `feat/storage-import-roadmap` (see `.remember/remember.md` for the live handoff): a reliability + import roadmap.
- Engine (pure/tested with `fake-indexeddb`, dev-only): async `RecipeRepository` — `src/persist/repo/*` (IndexedDB, idempotent transactional localStorage→IDB migration, draft-conflict decision, 5-snapshot retention) and `src/persist/backup.ts` (backup v2 + SHA-256 checksum + restore-preview classification + `applyRestore`); importer/search leaf modules — `src/import/url-guard.ts` (SSRF), `src/import/schema-org.ts` (DOM-free JSON-LD/microdata extractor), `src/search/*` (fuzzy search + unit aliases).
- Wired into the live app (Phases 2/5/6/7): durable async save via the repo through `src/persist/live.ts` (saving→saved/failed; never reports saved before the IDB transaction; localStorage fallback when IDB is absent); non-blocking draft-restore prompt (`decideDraftRestore`, no `confirm()`); `requestPersistentStorage` after first save; storage-unavailable note; backup v2 export + import-review screen (Merge/Replace/Cancel, snapshot before Replace) replacing the old `io.ts`; Save/Copy/Download consolidated into one bookmark dropdown pill.
- Not yet wired: source provenance + output-schema bump (Phase 8), Cloudflare Pages `functions/api/import-recipe.ts` (Phases 9/10), import-mapping review for the URL importer (Phase 12), search UI (Phase 13), Playwright-in-CI (Phase 15).

### Roadmap invariants (do not regress)
- Never report "saved" before the IndexedDB transaction completes; mark unsaved on failure.
- Migration is one-shot/idempotent and must never delete or overwrite legacy localStorage.
- Backups are versioned + checksummed; Replace-restore snapshots first; keep newest 5 snapshots.
- The URL importer is server-side only: no public CORS proxy, never return raw fetched HTML, re-validate every redirect, keep the SSRF guard strict, never log full URLs.
- Imported data enters a review screen before saving; original ingredient lines preserved; spelling fixes are suggestions, never silent mutations.
- Once the importer ships, qualify the "no external network requests at runtime" invariant (opt-in, explicit submit, same-origin endpoint).

## MVP vs v1.1
- **v1.0:** core create/edit/preview/copy/download, library, all fields + Notes/Substitutions/Storage/Equipment, structured ingredients + paste-parse, grouped steps, fractions/ranges + scaling, tags/source/image-refs, both themes, full a11y, wiki-link/callout toggles, golden-tested serializer.
- **v1.1:** rating + cook-history; PWA install + offline.
- **Non-goals:** volume↔weight conversion, nutrition, accounts/cloud/server, URL scraping, user-editable templates.
