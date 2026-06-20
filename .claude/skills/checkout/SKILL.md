---
name: checkout
description: Project checkpoint/handoff for hintof. Use when wrapping a work session, handing off, or the user says "/checkout", "checkout", "write a handoff", or "do a checkpoint". Writes the handoff file, refreshes the README status, and audits CLAUDE.md against the real code.
---

# /checkout — hintof session handoff

Produce a clean handoff so the next agent (or the next session) can resume with
zero re-derivation. Three deliverables, in order. Keep prose terse and factual;
never claim a test passed without running it.

## 1. Handoff file — `.remember/remember.md`
Overwrite it with the current state. Required sections:
- **Branch** and what it forks from.
- **Baseline**: Node/npm versions; last known `npm run check` and
  `npm run test:e2e` results (run them if unsure — note that e2e needs
  `npx playwright install chromium` first). Current unit/e2e test counts.
- **Done & committed**: each commit hash + one line on what it changed and any
  non-obvious decision (e.g. test timing hacks, schema choices).
- **Remaining**: the next steps in dependency order, pointing at the files to
  touch. Pull the ordered roadmap from CLAUDE.md / the kickoff metaprompt if one
  exists.
- **Gotchas**: traps that cost time this session (races, IDB connection
  blocking, canonical-JSON undefined handling, etc.).
- **Open questions**: anything awaiting user direction.

## 2. README — `README.md`
Make it accurate, not aspirational. Check and fix:
- The status line (don't leave a stale "Phase 0.1 scaffold").
- The **Privacy** section: it must match real network behavior. Today the app
  makes no runtime network calls; the moment the URL importer is wired, qualify
  any "zero network" wording (opt-in, explicit submit, same-origin endpoint,
  fetched page never returned/stored).
- The **Tech/CI** claim: only state what CI actually gates. Right now the deploy
  workflow runs `npm run check`; do not claim Playwright/axe are gated until they
  are.

## 3. Audit `CLAUDE.md`
Verify each claim against the checked-out code before changing it (don't trust
prior text). Report findings as a short ✅/⚠️/❌ list, then apply only targeted
edits — usually the "Current implementation status" section and any invariant
that drifted from reality. Keep its compact wiki tone; no AI-slop.

## Rules
- Inspect before writing (`git log --oneline -10`, `git status`, `npx vitest run`).
- Small, surgical edits — don't rewrite docs wholesale.
- Run `npm run check` if you changed any source; report the real result.
- Don't commit unless the user asks.
