# hintof

Write a recipe, get a clean Obsidian note.

hintof is a small, fast, fully client-side web tool for turning a structured form into properly formatted, Obsidian-compatible Markdown — with the YAML escaping, safe filenames, and consistent note structure handled for you. It runs entirely in your browser. Nothing you type is ever uploaded anywhere.

> Status: **implementation started.** Phase 0.1 has the Vite/TypeScript toolchain scaffold; see [`docs/`](docs/) for the full spec set.

## Why

If you keep recipes in Obsidian, you've probably hand-written frontmatter and watched a stray colon break your YAML, or fought with a title that won't become a valid filename. hintof does that part for you and gets it right every time, while keeping the note readable and plugin-independent.

## What it does

- Enter a recipe through a structured form; watch the Markdown build live.
- Structured ingredients (quantity · unit · item · note), groupable, with smart paste that splits a pasted line into fields.
- Numbered steps, groupable into sections.
- Fractions, ranges, and recipe **scaling** by multiplier or target servings.
- Tags + cuisine/course/diet, structured source/attribution, image references (`![[file.jpg]]`), plus Notes / Substitutions / Storage / Equipment.
- **Copy** to clipboard or **download** as `YYYY-MM-DD Title.md`.
- A **local library** of your recipes, autosaved, with JSON import/export for backup and transfer.
- Light and dark themes; keyboard-first on desktop, touch-first on mobile.

## Privacy

Fully client-side. No accounts, no servers, no analytics, no trackers, and no external network requests at runtime. Your recipes live in your browser's local storage and in the files you export. (PWA/offline support is planned for v1.1.)

## The output

hintof emits Obsidian-compatible Markdown: rich, Dataview-friendly YAML frontmatter plus a clean prose body. Obsidian niceties like wiki-links and callouts are opt-in; the default output renders correctly as plain Markdown with no plugins. The exact format is a versioned, tested contract — see [`docs/OBSIDIAN_SCHEMA.md`](docs/OBSIDIAN_SCHEMA.md).

## Documentation

- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) — problem, users, requirements, MVP, non-goals.
- [`docs/DESIGN_SPEC.md`](docs/DESIGN_SPEC.md) — visual thesis, layout, tokens, components.
- [`docs/TECHNICAL_SPEC.md`](docs/TECHNICAL_SPEC.md) — architecture, data model, pipelines, budgets.
- [`docs/OBSIDIAN_SCHEMA.md`](docs/OBSIDIAN_SCHEMA.md) — the output contract.
- [`docs/ACCESSIBILITY.md`](docs/ACCESSIBILITY.md) — the a11y plan.
- [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) — what we test and the release gate.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — the decision register.
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — ordered build phases.

## Tech

TypeScript + Vite, no UI framework, zero runtime dependencies, deployed as static files to GitHub Pages. Tested with Vitest (unit + golden-file contract tests), Playwright (browser/responsive), and axe (accessibility) — all gated in CI before deploy.

## Development

```bash
npm install
npm run dev      # local dev server
npm run check    # current scaffold gate: typecheck + lint + unit + build
npm run build    # static build for GitHub Pages
```

## License

See [`LICENSE`](LICENSE).
