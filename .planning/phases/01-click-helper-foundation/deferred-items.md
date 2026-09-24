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

## Plan 01-15

- **`tests/e2e/spike.e2e.ts`'s `파일 입력을 잡고 스페이스바를 누르면 filechooser
  이벤트가 온다` test failed once (`page.waitForEvent('filechooser', { timeout:
  5000 })` timed out) during a full-suite CI=true run repeated 3× for this
  plan's final verification (systematic-debugging: reproduced the full suite
  twice more and ran `spike.e2e.ts` alone once — all three passed cleanly,
  so it is not a 100%-reproducible failure).
  - **Not fixed here:** Plan 01-15 only touches zoom messaging and overlay
    CSS scale (`messages.ts`, `background.ts`, `mode-indicator.ts`,
    `ring.ts`, `hints.ts`, `confirm-dialog.ts`, `toast.ts`, `content.ts`'s
    `placeLabels` call) — no file-input or native-dialog code path. 01-13's
    own decisions log already documents this file's native-popup-dialog
    timing as a known source of flakiness in this sandbox (retries were
    deliberately removed there after root-causing a different flake, not
    added back here).
  - **Needed:** if this test fails again, root-cause the native file-chooser
    dialog timing in this sandbox specifically (not the zoom/overlay-scale
    change) — do not add `retries` to mask it (forbidden by
    `learned_after_01_12`).
