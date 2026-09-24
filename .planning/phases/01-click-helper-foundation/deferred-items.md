# Deferred Items — Phase 01 (click-helper-foundation)

Out-of-scope discoveries logged during plan execution (not fixed — scope boundary).

## Plan 01-02

- **`pnpm test:unit` fails repo-wide, unrelated to 01-02's changes.** No
  `vitest.config.ts` exists in the project (never created by Plan 01-01), so
  `vitest run` falls back to its default file discovery and scans the entire
  repository, including `.claude/skills/**` (this repo's GSD/gstack tool
  tree, which uses `bun:test` — a package not installed here, since this
  project's approved test stack is Vitest/Playwright, not Bun). Result:
  hundreds of unrelated failures ("Cannot find package 'bun:test'"), none
  from this project's own `src/`/`tests/` code.
  - **Not fixed here:** Plan 01-02's tasks (`src/shared/messages.ts`,
    `src/worker/storage-writer.ts`, popup, content script, mode indicator)
    don't touch test tooling config, and no unit test files exist yet in
    this project (both plans so far have relied on Playwright e2e only, per
    `<verification>` in 01-01-PLAN.md and 01-02-PLAN.md — neither lists
    `pnpm test:unit`).
  - **Needed before any plan adds real unit tests:** a `vitest.config.ts`
    that scopes `test.include` to this project's own `tests/`/`src/` unit
    test files and excludes `.claude/**` (mirroring `eslint.config.js`'s
    existing `.claude/**` ignore, added in Plan 01-01's Deviation #1).
