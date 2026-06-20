# hintof — Technical Specification

> Decision IDs reference `DECISIONS.md`.

## Selected architecture `[T1, T2, T3, T4]`

- **Language/build:** TypeScript + Vite, output as plain static files `[T1]`.
- **UI:** no framework. Vanilla TS with a tiny custom typed reactive store driving DOM updates `[T3]`.
- **Dependencies:** minimal & vetted — **zero runtime dependencies** preferred; dev-only tooling (Vite, Vitest, Playwright, axe, linter/formatter) is allowed `[T2]`.
- **Serialization:** a hand-rolled, golden-file-tested Markdown/YAML emitter — no YAML library at runtime `[T4]`.
- **Persistence:** browser `localStorage` only `[D2, T8]`.
- **Deploy:** GitHub Actions builds and publishes to GitHub Pages; relative base path `[T7]`.
- **Privacy:** fully client-side, zero telemetry, no external network requests at runtime `[T8]`.

### Rationale

The product is essentially one rich form plus a deterministic text generator. A framework would add bundle weight and a "SaaS app" texture for little gain; vanilla TS with a small store keeps it light, durable, and fully under our control — which matters most for the **output contract**, where we want exact control over escaping and formatting (hence a hand-rolled serializer rather than a general YAML dumper). TypeScript + Vitest gives us the type safety and test rigor the versioned contract demands. This is the smallest architecture that safely satisfies the requirements.

## Repository structure (planned)

```
hintof/
├─ index.html
├─ src/
│  ├─ main.ts                 # bootstrap, mount, wire store→view
│  ├─ store/
│  │  ├─ store.ts             # tiny reactive store (subscribe/set/select)
│  │  └─ actions.ts           # state transitions (add ingredient, scale, …)
│  ├─ model/
│  │  ├─ types.ts             # Recipe, Ingredient, Step, Source, etc.
│  │  ├─ quantity.ts          # rationals, fractions, ranges, parsing, scaling
│  │  └─ units.ts             # unit display-normalization table
│  ├─ parse/
│  │  └─ ingredient-parse.ts  # fuzzy free-text → {qty,unit,item}
│  ├─ serialize/
│  │  ├─ yaml.ts              # frontmatter emitter + escaping
│  │  ├─ markdown.ts          # body emitter
│  │  ├─ filename.ts          # safe filename generation
│  │  └─ index.ts             # Recipe → full note string
│  ├─ persist/
│  │  ├─ library.ts           # CRUD over localStorage
│  │  ├─ autosave.ts          # draft autosave + recovery
│  │  ├─ io.ts                # JSON import/export, validation
│  │  └─ migrate.ts           # schema_version migrations
│  ├─ export/
│  │  ├─ clipboard.ts         # copy with fallback chain
│  │  └─ download.ts          # .md download
│  ├─ ui/
│  │  ├─ components/          # field, ingredient-row, step-row, chips, toggles…
│  │  ├─ views/               # form, preview, library, help
│  │  └─ a11y.ts              # focus management, live-region announcer
│  └─ styles/
│     ├─ tokens.css           # design tokens (light + dark)
│     └─ app.css
├─ public/
│  ├─ fonts/                  # self-hosted, subset fonts
│  └─ geometry/               # flat SVG teal motifs
├─ tests/
│  ├─ unit/                   # quantity, units, parse, filename, migrate
│  ├─ golden/                 # serializer golden fixtures (per schema_version)
│  ├─ e2e/                    # Playwright flows
│  └─ a11y/                   # axe checks
├─ .github/workflows/deploy.yml
├─ docs/                      # this spec set
├─ vite.config.ts
├─ README.md
└─ CLAUDE.md
```

## Data model `[O1, M4, U1]`

```ts
type SchemaVersion = 1 | 2;

interface Recipe {
  id: string;                 // uuid, stable across edits
  schemaVersion: SchemaVersion;
  title: string;              // required (non-empty to export)
  description?: string;
  aliases?: string[];
  tags?: string[];
  cuisine?: string;
  course?: string;
  diet?: string[];
  servings?: number;          // base servings (scaling pivot)
  prepTime?: number;          // minutes
  cookTime?: number;          // minutes
  totalTime?: number;         // minutes (auto = prep+cook unless overridden)
  totalTimeManual?: boolean;
  image?: string;             // filename only
  ingredientGroups: IngredientGroup[];
  stepSections: StepSection[];
  notes?: string;
  substitutions?: Substitution[];
  storage?: string;
  equipment?: string[];
  source?: Source;
  rating?: number;            // 1..5  (v1.1)
  datesMade?: string[];       // YYYY-MM-DD (v1.1)
  created: string;            // YYYY-MM-DD
  updated: string;            // YYYY-MM-DD
  options: NoteOptions;
}

interface IngredientGroup { name?: string; ingredients: Ingredient[]; }
interface Ingredient { qty?: Quantity; unit?: string; item: string; note?: string; }
interface StepSection { name?: string; steps: string[]; }
interface Substitution { from: string; to: string; note?: string; }
interface Source {
  name?: string; url?: string; canonicalUrl?: string; publisher?: string;
  importedAt?: string; parser?: string; author?: string; book?: string;
  page?: string; adaptedFrom?: string;
}

// Quantity: exact, scalable, range-aware
type Rational = { n: number; d: number };           // normalized, d>0
type Quantity =
  | { kind: "single"; value: Rational }
  | { kind: "range"; min: Rational; max: Rational };

interface NoteOptions {
  wikiLinks: { ingredients: boolean; cuisine: boolean };  // default all false
  callouts: boolean;                                       // default false
  fractionStyle: "unicode" | "ascii";                     // default "unicode"
}
```

The single source of truth for what is stored, exported, and serialized. Empty optional fields are absent (not `""`) so omission rules are trivial.

## State flow `[T3]`

```
user input → action (pure-ish transition) → store.set(nextState)
          → store notifies subscribers
          → view re-renders affected regions  (form echoes, live preview)
          → autosave debounced → localStorage draft
```

- The store is a small generic: `createStore<State>(initial)` with `get`, `set`, `update`, `subscribe`, and `select(selector, onChange)` to avoid full re-renders.
- Serialization is a **pure function** `recipeToNote(recipe): string`, called to produce the live preview and the export — same code path, so preview == export, always.
- No global mutable state outside the store.

## Storage strategy `[D2, R2, R3]`

- **Keys:** `hintof:library` (array of recipes), `hintof:draft` (current edit), `hintof:prefs` (theme, fraction style, toggles), `hintof:schemaVersion`.
- **Autosave:** the draft is written debounced (~500ms) on every change; restored on load if present `[D2]`.
- **Save to library:** explicit action; upserts by `id` `[D2]`.
- **Quota:** all writes are wrapped; on `QuotaExceededError`, the current edit is preserved in memory, a toast/dialog prompts JSON export, and no silent drop occurs `[R2]`.
- **Migration:** on load, compare stored `schemaVersion`; run forward migrations in memory; offer a pre-migration export; only persist migrated data on a user save `[R3]`.

## Export pipeline `[O3, O4, R1]`

1. `recipeToNote(recipe)` → full Markdown string (frontmatter + body), via `serialize/`.
2. **Copy:** try `navigator.clipboard.writeText`; on failure/denied/insecure-context, select the text in a hidden textarea + `execCommand('copy')` fallback, then instruct manual copy; `.md` download is always offered as the guaranteed path `[R1]`.
3. **Download:** `Blob` + object URL + `<a download>` with the safe filename from `serialize/filename.ts` `[O3]`. Object URLs revoked after use.
4. **Library JSON:** `persist/io.ts` exports `{format, schema_version, recipes}`; import validates + migrates + merges/replaces `[R4]`.

## Error handling

- **Serialization** is total: it never throws on user data; questionable inputs are escaped/quoted defensively.
- **Parsing** (fuzzy ingredient) never throws; on low confidence it leaves the line as the `item` field and flags it for the user to split.
- **Clipboard/download** failures degrade per `[R1]`; user always has a path to their data.
- **Import** failures are reported per-entry; the existing library is never mutated on a failed import `[R4]`.
- **Storage** failures surface via `[R2]`; the in-memory edit is the source of truth until saved.
- A top-level error boundary catches unexpected exceptions, shows a recovery message, and preserves the autosaved draft.

## Security & privacy `[T8, R4]`

- **No network at runtime.** No analytics, no fonts/CDNs, no remote APIs. (CI may fetch dev deps; the shipped app does not fetch anything.) Enforced by a test that asserts no external origins in built assets and (in e2e) zero cross-origin requests.
- A restrictive **Content-Security-Policy** meta is shipped (`default-src 'self'`; no inline script; `img-src 'self' data:` for generated blobs only).
- **Imported data is untrusted:** rendered as text, never as HTML; no `innerHTML` with user content; no `eval`/`Function`; JSON parsed with `JSON.parse` and schema-validated `[R4]`.
- No secrets, tokens, or PII exist in the product or repo.

## Dependency policy `[T2]`

- Runtime: **zero** preferred. Any proposed runtime dep requires written justification (what risk it removes), a license check, and a size/maintenance review; default answer is no.
- Dev: Vite, Vitest, Playwright, @axe-core/playwright, ESLint, Prettier, TypeScript. Pinned; updated deliberately.

## Browser support `[T6]`

Last ~2 versions of Chrome, Edge, Firefox, Safari (desktop) and iOS Safari + Android Chrome. Uses Clipboard API (with fallback), CSS Grid, container queries, custom properties, `prefers-color-scheme`, `prefers-reduced-motion`. No legacy/no-JS support target (the app is inherently JS-driven).

## GitHub Pages deployment `[T7]`

- `vite.config.ts` `base` resolves correctly for the `/<repo>/` project subpath, a custom domain (root), and local dev — via relative/asset-aware config, not a hardcoded path.
- **All asset references are base-aware** (no leading-slash absolute URLs that break under a subpath).
- `.github/workflows/deploy.yml`: on push to the default branch → install → typecheck → test (full pyramid) → build → upload artifact → deploy Pages. **Deploy is gated on green tests** `[S2]`.
- PWA service worker (v1.1) must compute its scope/precache from the same base path to avoid the classic subpath cache breakage `[T5]`.

## Performance budgets `[NFR-4]`

- Initial JS (gzipped) ≤ **60 KB**; initial CSS ≤ **20 KB**; self-hosted fonts (subset, woff2) ≤ **120 KB** total.
- Time-to-interactive on mid mobile ≤ **2s** on a warm cache.
- Live-preview update ≤ **16ms** for typical recipes (no perceptible lag while typing); serialization is O(n) in recipe size.
- No layout shift on load (CLS ~0); fonts use `swap` with metric-compatible fallbacks.
- Lighthouse: Performance ≥ 95, Accessibility = 100, Best-Practices ≥ 95 (checked in CI where practical).
