---
phase: 01-click-helper-foundation
fixed_at: 2026-09-24T13:25:00Z
review_path: .planning/phases/01-click-helper-foundation/01-REVIEW.md
iteration: 1
findings_in_scope: 18
fixed: 18
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-09-24T13:25:00Z (warnings pass finished; critical pass finished 2026-09-24T12:15:28Z)
**Source review:** .planning/phases/01-click-helper-foundation/01-REVIEW.md
**Iteration:** 1 (two passes: critical, then warnings)
**Scope:** CR-01..CR-08 (Critical, first pass) + WR-01..WR-10 (Warnings, second pass) = 18 findings. IN-* (Info) is explicitly out of scope for both passes.

## Warnings pass (WR-01..WR-10) — added by second fixer

**Method (user-specified):** reproduce first, then fix with TDD, same discipline as the critical pass. For each finding: RED test that fails for the stated reason → commit (RED) → minimal fix → GREEN → commit (fix). Verification ran in the main working tree (`workflow.use_worktrees` was not consulted for this run either — the launcher pinned the branch and working tree directly via `git_rules`/root-pin.sh, so all edits, test runs, and commits happened in `/home/user/project_260923` on branch `claude/project-thread-ew8d9u`, not an isolated worktree).

**Summary (warnings pass only):**
- Findings in scope: 10 (WR-01..WR-10)
- Fixed: 10
- Skipped: 0
- Not reproduced: 0
- Needs decision: 0

### WR-01: Space-hold confirm could stay armed past a lost keyup (window blur)

**Files modified:** `src/page/input/pipeline.ts`
**RED commit:** `f247e3b` — reproduces window `blur` mid-hold not resetting the confirm guard's hold timer
**Fix commit:** `7b07ec3`
**Test file:** `tests/e2e/confirm.e2e.ts`
**Applied fix:** `window` `blur` and `document` `visibilitychange` (when hidden) now send a synthetic `keyup` for `keymap.press` into the modal handler, resetting `confirm-guard.ts`'s `holdStartedAt`. A `document.hasFocus()` check inside the 100ms modal tick was also tried as a broader backstop, but reverted — it proved unreliable in this CI/headless environment (returned `false` spuriously during a legitimate held Space, breaking the pre-existing "hold for 1s confirms" test) — documented as a deliberate scope reduction.
**Status:** fixed (the window-blur/visibilitychange path is fixed and tested; the secondary "focus moves into a same-tab child iframe without a content script" scenario described in the review was not independently reproduced/verified — `document.hasFocus()` is not a reliable signal for that case in this environment, so no code targets it specifically).

### WR-02: Hint danger flag was a snapshot; a late-arriving danger never re-triggered confirm

**Files modified:** `src/entrypoints/content.ts`, `src/worker/relay.ts`, `src/entrypoints/background.ts`, `src/shared/messages.ts`
**RED commit:** `1542c9f`
**Fix commit:** `18a797f`
**Test file:** `tests/e2e/confirm.e2e.ts`
**Applied fix:** `pressHintEntry(itemId, confirmed = false)` re-checks live `danger` (via `collector.items()`) before pressing. For the top frame's own items, a newly-dangerous element opens `openDangerConfirm` instead of pressing. For child-frame items, a new `press/refused` message (frame → SW → top, `frameId` overwritten by relay from `sender.frameId` the same way `frame/report` already does, for spoof-safety) lets the child frame refuse and the top frame open the confirm from its cached `composedItemsCache` entry. `hints/press`/`press/request` gained a `confirmed: boolean` field so a press that already went through confirm (`finish('confirm') → pressHintEntry(itemId, true)`) isn't asked twice.
**Status:** fixed (frame-0 own-item path has a dedicated e2e test; the child-frame `press/refused` round trip is implemented per the review's exact suggestion and exercised implicitly by the existing cross-frame confirm e2e tests passing, but has no dedicated new test of its own — the frame-0 case was chosen for the dedicated RED/GREEN test because it's the simpler, directly reproducible scenario, and the child-frame code path reuses the identical `confirmed` gating logic).

### WR-03: Hint labels didn't follow scroll or layout change while open

**Files modified:** `src/entrypoints/content.ts`
**RED commit:** `3beb3fc` (see fix commit's note below — the RED's chosen scroll target was clamped by the document's max scroll extent, so it failed for a coincidental rather than the intended reason; corrected and re-verified against unfixed code in the fix commit before fixing)
**Fix commit:** `085c974`
**Test file:** `tests/e2e/hints.e2e.ts`
**Applied fix:** Extracted `composeCurrentItems()` (the compose logic `openHints()` already had) so it can be reused. `collector.onChange` (already fired on scroll/resize/DOM mutation, D-04) now, when `hintsActive`, rebuilds `composedItemsCache` and calls `openChapter(hintChapterIndex)` — same number-to-item assignment, freshly computed screen positions.
**Status:** fixed.

### WR-04: Press history never matched links/images/divs and froze at 200 entries

**Files modified:** `src/page/collector/collector.ts`, `src/worker/storage-writer.ts`
**RED commit:** `5fe99f3`
**Fix commit:** `6df94f8`
**Test file:** `tests/e2e/hints.e2e.ts`
**Applied fix:** `buttonTextOf()` now also covers `<a>`/`<img>` — own text, then descendant `img[alt]` (same order as CR-05), then the anchor's `pathname` as a last resort — giving links without id/name/aria a second comparable fingerprint field (`domPath` + `buttonText` = matchScore 2). The 200-entry eviction in `recordPress` no longer blindly sorts-and-slices (which, being a stable sort, always put a freshly-appended count-1 entry last among ties and therefore evicted it immediately) — a just-inserted entry is now excluded from the sort/trim and re-appended afterward, so it's never the one evicted on the same write that created it.
**Status:** fixed.

### WR-05: Child-frame press history used the wrong origin and an inconsistent framePath

**Files modified:** `src/entrypoints/content.ts`, `src/worker/relay.ts`, `src/entrypoints/background.ts`
**RED commit:** `a9020d1`
**Fix commit:** `47779c8`
**Test file:** `tests/e2e/frames.e2e.ts`
**Applied fix:** `sendRecordPress` now uses a `cachedTopOrigin` learned once from the existing `site/query` round trip (falls back to `window.location.origin` before that resolves, matching the D-06 "assume defaults before settings load" pattern elsewhere) instead of always using the sending frame's own origin — cross-origin child presses now land under the top page's `presses:<origin>` key, where `readPinsAndPresses()` actually looks. `background.ts`'s recordPress origin check now also accepts the sender's *tab* origin (not just the sending frame's own origin), matching `site/query`'s existing "every frame's `sender.tab.url` is the top document's URL" assumption. Direct in-frame presses (magnet/dwell/Space — not routed through the hints round trip, which already carries the correct composed `framePath`) now tag their fingerprint's `framePath` with a per-frame, non-`[]` marker (`local:<that frame's URL>`) instead of leaving it `[]` (indistinguishable from the top frame's own items) — this stops the described false-merge with an unrelated top-frame element sharing the same `domPath`+text (a common shared-template scenario), though it does not achieve full composed-path accuracy (a magnet press and a later hint press on the *same* child element won't accumulate under one entry) — a documented, deliberately smaller scope than a full framePath-plumbing change would have required.
**Status:** fixed (scope note above).

### WR-06: Popup cards had no tremor filtering (double-tap, held key)

**Files modified:** `src/entrypoints/popup/main.ts`
**RED commit:** `5ce13a9`
**Fix commit:** `20cf465`, with a same-day follow-up `02c95f1` (see below)
**Test file:** `tests/e2e/helper-toggle.e2e.ts`
**Applied fix:** `createCard`'s `click`/`keydown` handlers now go through the same `core/tremor-filter.ts` the page pipeline uses, keyed on the card's own `getBoundingClientRect()` position (same card = same "spot" = filtered if within the interval; different card = different spot = not filtered). `keydown` `repeat` events are rejected before reaching the filter. The filter is built once from `defaultSettings()` and deliberately *never* rebuilt from the actually-stored `tremorIntervalMs` — an earlier version tried to "upgrade" to the stored value once `loadInitial()`'s async read resolved, but that resolution landing between two rapid presses discarded the filter's "just pressed here" memory and reopened the exact race being fixed (reproduced, then reverted); since Phase 1 has no UI to change this interval, the defaults-only filter is simpler and race-free with no practical loss.
**Follow-up commit `02c95f1`:** running the full suite for the first time after this fix (during WR-09 verification) surfaced two more pre-existing tests with the same "turn card off, then immediately on, no wait" pattern that the tremor filter now legitimately treats as one action's accidental double-registration: `confirm.e2e.ts`'s CR-02 test and `hints.e2e.ts`'s CR-06 test. Both got the same fix as the tests already handled in the WR-06 commit (a 350ms wait between the two clicks, past the default 300ms interval) — this is the same adaptation every other "re-press the same thing" test in the suite already needed once the filter existed, just missed on the first pass since they live in different files.
**Status:** fixed.

### WR-07: A rejected `chrome.storage.sync.set` could deadlock the site-disable queue

**Files modified:** `src/worker/storage-writer.ts`, `src/entrypoints/background.ts`
**RED commit:** `289a8cc`
**Fix commit:** `d4e7d9f`
**Test file:** `tests/e2e/site-toggle.e2e.ts`
**Applied fix:** `runSiteWriteQueue`'s loop body and `state.writing = false` are now wrapped in `try`/`finally`, and a rejected `enqueue(...)` is caught per-iteration and turned into `{ ok: false, reason: 'write-failed' }` (new `SetSiteDisabledResult` variant) for the waiters of that iteration, instead of throwing out of the loop and leaving `state.writing` stuck `true` forever with unresolved waiters. `background.ts`'s four `storage/request` message handlers (`setEnabled`, `updateSettings`, `setSiteDisabled`, `recordPress`) each got a `.catch(() => sendResponse({ ok: false }))` as defense-in-depth at the message boundary.
**Status:** fixed.

### WR-08: A missing `settings` key was treated as corruption; the migration-failed notice never cleared

**Files modified:** `src/worker/storage-writer.ts`, `src/types/chrome.d.ts` (added `StorageArea.remove()`, needed by the fix)
**RED commit:** `40c4c59`
**Fix commit:** `6458c04`
**Test file:** `tests/e2e/lifecycle.e2e.ts`
**Applied fix:** `readAndValidateSettings()` now checks `raw === undefined` directly (before calling `migrate()`, which otherwise reports `no-version` — the same "corrupted" classification a genuinely malformed value gets) and writes `defaultSettings()` immediately rather than returning `preserved-original` forever. Every successful return path (freshly-defaulted, migrated-and-rewritten, or already-valid) now fires a fire-and-forget `chrome.storage.local.remove(MIGRATION_NOTICE_KEY)` — safe even when no notice exists — so a settings value that becomes valid again (self-heals via cross-device sync, or via this same fix) stops showing the stale toast/warning card on the next successful write.
**Status:** fixed.

### WR-09: Extension fonts were web-accessible without `use_dynamic_url` (extension-detection/fingerprinting risk)

**Files modified:** `wxt.config.ts`
**RED commit:** `242dbfe`
**Fix commit:** `591d37d`
**Test file:** `tests/e2e/fonts.e2e.ts` (new file)
**Applied fix:** Added `use_dynamic_url: true` to the `fonts/*.woff2` `web_accessible_resources` entry. `chrome.runtime.getURL()` (already the only call site, in `mode-indicator.ts`) automatically returns the dynamic per-session URL form once this is set — no call-site changes needed. Verified a same-origin overlay-perf/hints smoke pass still loads fonts correctly (no visual/layout regression) after the change.
**Status:** fixed. `matches` was left at `<all_urls>` (not narrowed) — the overlay itself needs to render on any site per D-02/D-21, so narrowing `web_accessible_resources.matches` would not reduce real exposure without also changing where the content script runs; left as the review's "also consider" (optional) item, not applied.

### WR-10: Two confirm-flow e2e tests had a verification gap / relied on a fixed sleep

**Files modified:** `tests/e2e/confirm.e2e.ts` (test-only; no source change)
**Fix commit:** `7a7e9e3` (no separate RED commit — see method note below)
**Method note:** this finding is about test quality, not product behaviour, so there is no product-code RED/GREEN cycle. Per the review's own suggested verification method, used mutation testing instead: temporarily removed `confirm-guard.ts`'s `keyup` → `holdStartedAt = null` reset, ran the *existing* "1초 전에 떼면 확인되지 않는다" test, confirmed it still **passed** against the broken guard (proving the gap the review described — the test only asserted the counter at ~300ms, long before the described bug's effect appears at 1000ms). Extended the test to also assert the counter is still `0` and the dialog still visible at 1200ms since the original keydown; re-ran against the same mutation and confirmed it now **fails**; reverted the mutation (clean `git diff`) and confirmed the updated test **passes** against the real code.
**Applied fix:** (1) the space-hold-release test now re-checks the counter/dialog at 1200ms post-keydown, not just ~300ms. (2) `openDangerConfirm()`'s fixed 50ms sleep before reading hint labels (racing `openHints()`'s two `chrome.storage` reads) was replaced with `expect.poll(() => numberForElement(...)).not.toBe('')`. (3) `magnet.test.ts`'s danger-priority assertion, which the original review flagged as asserting the CR-04 defect as intended behaviour, was already inverted by the CR-04 commit (`d697430`, critical pass) — re-verified only, no further change needed here.
**Status:** fixed.

**Method (user-specified):** reproduce first, then fix with TDD. For each finding: RED test that fails for the stated reason → commit (RED) → minimal fix → GREEN → commit (fix). Verification ran in the main working tree (`workflow.use_worktrees` was not consulted for this run — the launcher pinned the branch and working tree directly via `git_rules`/root-pin.sh instead of the standard worktree bootstrap, so all edits, test runs, and commits happened in `/home/user/project_260923` on branch `claude/project-thread-ew8d9u`, not an isolated worktree).

**Summary:**
- Findings in scope: 8
- Fixed: 8
- Skipped: 0
- Not reproduced: 0
- Needs decision: 0

## Fixed Issues

### CR-01: Confirm modal did not block pointer or dwell input

**Files modified:** `src/page/input/pipeline.ts`, `src/entrypoints/content.ts`
**RED commit:** `ff6033e` — `test(01): CR-01 확인 화면 중 포인터가 모달을 무시하는 문제 재현 (RED)`
**Fix commit:** `e70be54` — `fix(01): CR-01 확인 화면 중 포인터·자석·머무르기를 모달로 처리`
**Test file:** `tests/e2e/confirm.e2e.ts` (new test: clicks the real cancel button while a page button sits 15px away, within the 48px capture margin)
**Applied fix:** `pipeline.ts`'s `pointerdown` handler now checks `modalHandler` first and passes the event straight through (clearing `pressSwallowed`/`pendingPressExecute`) instead of running the magnet/tremor filter. `content.ts`'s `evaluateMagnet()` now also short-circuits while `activeConfirmKeyHandler` is set, and `openDangerConfirm()` clears `currentTargetId`, hides the ring, and stops the dwell loop the instant the dialog opens.
**Status:** fixed

### CR-02: Turning the helper off while confirm was open left an invisible, re-armable modal

**Files modified:** `src/entrypoints/content.ts`
**RED commit:** `d24b825` — `test(01): CR-02 도우미 끄기·켜기가 열린 확인을 취소하지 않는 문제 재현 (RED)`
**Fix commit:** `218da9c` — `fix(01): CR-02 도우미가 꺼질 때 열린 확인을 함께 취소`
**Test file:** `tests/e2e/confirm.e2e.ts` (opens confirm, waits past the 1s guard, toggles the helper off then on via the popup, then presses a plain Enter and asserts the danger button was NOT pressed)
**Applied fix:** `applyEnabled(false)` now cancels any open confirm (`inputPipeline.setModal(null)`, clears `activeConfirmKeyHandler`, calls `closeConfirm()`, broadcasts `confirm/state {open:false}`) — the same cleanup `finish('cancel')` does. `cleanupOldHelper()` does the same for the extension-invalidation path.
**Status:** fixed

### CR-03: "이 사이트에서 끄기" did not disable the input pipeline

**Files modified:** `src/page/input/pipeline.ts`, `src/entrypoints/content.ts`
**RED commit:** `6f5bee0` — `test(01): CR-03 사이트별 끄기가 입력 파이프라인을 끄지 못하는 문제 재현 (RED)`
**Fix commit:** `2cf2809` — `fix(01): CR-03 사이트별 끄기가 입력 파이프라인 상태에도 반영되도록 연결`
**Test file:** `tests/e2e/site-toggle.e2e.ts` (site-disable via popup, then asserts a 100ms-apart double click and a 5x auto-repeat key both reach the page unfiltered)
**Applied fix:** `createInputPipeline` accepts an optional `isEnabled()` callback; `content.ts` passes `() => currentEnabled ?? true` (the `?? true` preserves the pre-existing D-06 "assume enabled before settings load" behaviour). `isHelperEnabled()` in the pipeline now prefers this combined callback over the raw global `settings.data.enabled`.
**Status:** fixed

### CR-04: A precise click on a danger button was redirected to a normal neighbour

**Files modified:** `src/core/magnet.ts`
**RED commit:** `fceff7a` — `test(01): CR-04 danger-at-zero 매그넷 우선순위 재현 (RED)` (inverted the encoding test at `tests/unit/magnet.test.ts:97-103`, per the required method's explicit instruction, since it asserted the bug as intended behaviour)
**Fix commit:** `d697430` — `fix(01): CR-04 커서가 danger 위일 때 일반 후보로 새지 않도록 우선순위 수정`
**Test file:** `tests/unit/magnet.test.ts` (pure `src/core` logic — used a Vitest unit test per the required method's preference)
**Applied fix:** `pickTarget()` now checks `dangerAtZero` before `normalInRange` — swapped the order of the two existing branches so a cursor exactly on a danger rect always wins, even when a normal candidate is in capture range.
**Status:** fixed

### CR-05: Danger detection missed `<input type=button value=삭제>`, `<a><img alt=삭제></a>`, and `aria-labelledby` names

**Files modified:** `src/page/collector/collector.ts`, `tests/practice-site/danger.html`
**RED commit:** `0bc613f` — `test(01): CR-05 레거시 위험 버튼 패턴 danger 미탐지 재현 (RED)`
**Fix commit:** `cf6a7ae` — `fix(01): CR-05 레거시 위험 버튼 이름 판정 보강 (...)`
**Test file:** `tests/e2e/danger.e2e.ts` (new practice-site buttons for all three patterns, asserts dashed border + "! 위험" label)
**Applied fix:** `computeName()` now calls `ariaOf()` (already used by `computeFingerprint`, so aria-label *and* aria-labelledby are covered), widens the input-value check from `type==='submit'` to `submit|button|reset`, and falls back to a descendant `img[alt]` when the element itself has no text/alt. Also found and fixed a fixture bug during reproduction: a `src`-less `<img>` with only `width`/`height` *attributes* renders at Chromium's broken-image intrinsic size (48×21) rather than the requested size — fixed by also setting CSS `width`/`height` on the practice-site fixture image.
**Status:** fixed

### CR-06: Hint labels and the confirm dialog lost their styles after any helper off→on cycle

**Files modified:** `src/page/overlay/hints.ts`, `src/page/overlay/confirm-dialog.ts`
**RED commit:** `3e9fec9` — `test(01): CR-06 도우미 껐다 켜기 뒤 번호표 스타일이 사라지는 문제 재현 (RED)`
**Fix commit:** `ff8f7ad` — `fix(01): CR-06 번호표·확인 화면 스타일을 shadow root별로 기억`
**Follow-up:** `238e990` — `test(01): CR-06 시험의 TS strict null 오류 수정` (typecheck fix for the new test, found by `pnpm typecheck` during final verification; no behavioural change)
**Test file:** `tests/e2e/hints.e2e.ts` (opens hints, toggles the helper off/on via the popup, reopens hints, compares label position and size before/after)
**Applied fix:** Replaced the module-level `styleInjected` boolean in both files with a `WeakSet<ShadowRoot>` keyed by the actual shadow root, matching the review's suggested pattern — so a freshly created shadow root (after `destroyOverlayRoot()`) gets its `<style>` re-injected instead of being silently skipped.
**Status:** fixed

### CR-07: A stale `pendingPressExecute` could cause a phantom click

**Files modified:** `src/page/input/pipeline.ts`
**RED commit:** `ae3cdf8` — `test(01): CR-07 오른쪽 클릭이 남긴 대신 누르기 예약이 되살아나는 문제 재현 (RED)`
**Fix commit:** `b2fdf4e` — `fix(01): CR-07 새 누름 묶음마다 옛 대신 누르기 예약을 지운다`
**Test file:** `tests/e2e/press.e2e.ts` (right-clicks near a magnet-capturable button, then left-clicks an unrelated empty spot, asserts the old button was not phantom-pressed)
**Applied fix:** `pointerdown` now clears `pendingPressExecute` at the very start of every new gesture (before the button/isPrimary check), and short-circuits (without intercepting) for non-primary-button / non-primary-pointer events — this also fixes the secondary complaint that right/middle mousedown-mouseup was being swallowed, breaking sites' own context menus. Added a `pointercancel` listener that also clears `pendingPressExecute`.
**Status:** fixed

### CR-08: Child-frame hint items disappeared after the service worker restarted from idle

**Files modified:** `src/page/collector/collector.ts`, `src/entrypoints/content.ts`, `src/worker/relay.ts`, `src/entrypoints/background.ts`
**RED commit (v1):** `e72559c` — `test(01): CR-08 SW 재시작 뒤 자식 프레임 번호표 항목 소실 재현 (RED)` — added the `resetRelayForE2E` / matching `Relay.resetForE2E()` test-only hook (same pattern as the existing `disconnectAlivePorts` hook) needed to actually simulate relay memory loss in e2e, since the review noted the existing hook doesn't clear relay state.
**RED commit (v2, corrected reproduction):** `257e1d2` — `test(01): CR-08 재현을 최소 2-프레임 페이지로 다시 만든다 (RED)` — the v1 reproduction reused `danger.html`, but CR-05's fix had added 3 buttons to that page, so the top frame alone could fill a full 9-item hint chapter and the test's `labelCount >= 9` assertion no longer proved the child frame was actually included. Replaced with a dedicated minimal 2-item (1 top + 1 cross-origin child) fixture page where the assertion is unambiguous.
**Fix commit:** `e0f18f6` — `fix(01): CR-08 SW 재시작 신호를 받으면 프레임 보고를 강제로 다시 보낸다`
**Test file:** `tests/e2e/lifecycle.e2e.ts`
**Applied fix:** `collector.refresh(force?)` now accepts a `force` flag that clears `lastReportedJson` before re-collecting, bypassing the "don't resend unchanged content" dedup. `content.ts` calls `collector.refresh(true)` on `frame/refresh` receipt and calls it again when the `alive` port reconnects (`connectAlivePort(isReconnect)`) — both are legitimate signals that the relay's memory may have just been wiped by a service-worker restart. Since every frame independently reconnects its own `alive` port, both the top and child frames self-heal shortly after a restart, before the user does anything else.
**Status:** fixed

## Skipped Issues

None — all 8 in-scope findings were fixed.

## Verification (fresh, final run — all commands quoted verbatim)

Ran in the main working tree at `/home/user/project_260923` (no isolated worktree; git_rules pinned this run to the main checkout directly).

```
$ pnpm lint
> tremor-browser-helper@0.0.0 lint /home/user/project_260923
> eslint .
(exit 0, no output)
```

```
$ pnpm typecheck
> tremor-browser-helper@0.0.0 typecheck /home/user/project_260923
> wxt prepare && tsc --noEmit

WXT 0.21.4
i Generating types...
√ Finished in 372 ms
(exit 0, no errors)
```

```
$ pnpm test:unit
 Test Files  13 passed (13)
      Tests  94 passed (94)
```

```
$ CI=true pnpm exec playwright test tests/e2e/confirm.e2e.ts tests/e2e/danger.e2e.ts \
    tests/e2e/magnet.e2e.ts tests/e2e/hints.e2e.ts tests/e2e/press.e2e.ts \
    tests/e2e/dwell.e2e.ts tests/e2e/site-toggle.e2e.ts tests/e2e/helper-toggle.e2e.ts \
    tests/e2e/lifecycle.e2e.ts
Running 92 tests using 1 worker
································································································
············
  92 passed (1.9m)
```

Note: `magnet.e2e.ts` does not exist as a separate e2e file in this codebase — magnet capture/danger-priority behaviour is covered by `tests/unit/magnet.test.ts` (unit) and `tests/e2e/danger.e2e.ts` (e2e). Both are included in the runs above.

Full test suite (`pnpm test`, which also runs every other unaffected e2e file such as `frames.e2e.ts`, `drag.e2e.ts`, `input-filter.e2e.ts`, `overlay-perf.e2e.ts`, `zoom.e2e.ts`, `skeleton.e2e.ts`, `spike.e2e.ts`, `dom-audit.e2e.ts`) was **not** run in full per the scoping instruction ("Do not run the entire suite (the warnings pass will run the full gate once)") — the warnings-pass fixer should run `pnpm test` in full before considering the phase done.

## Notes for the warnings-pass fixer

- `danger.html` now has 11 top-level candidate elements (was 8) plus the cross-origin child (`btn-child-delete`) = 12 total, after CR-05 added 3 new buttons in a second column (`x=650`). Any warning-pass test relying on an exact "9 = 8+1" hint-chapter count against `danger.html` should be re-verified against the new total, or should assert on specific item identity rather than raw label count (this is exactly the trap CR-08's first reproduction attempt fell into).
- Two new e2e-only test hooks now exist on `globalThis` in the background service worker, both guarded the same way as the pre-existing `disconnectAlivePorts`: `resetRelayForE2E()` (clears `relay.ts`'s in-memory `reportsByTab`). These are flagged by IN-02 (already out of scope for this CR-only pass) as "test-only hooks ship in the production service worker" — the warnings pass should decide whether to gate all three (`frameStates`, `disconnectAlivePorts`, `resetRelayForE2E`) behind `import.meta.env.MODE !== 'production'` together.
- `pipeline.ts`'s `pointerdown` handler changed behaviour for right-click/middle-click: it now always passes them through untouched (previously it could swallow their mousedown/mouseup too). This is a side benefit of the CR-07 fix, not a new regression — but worth knowing if a warning-pass test specifically exercises context-menu behaviour.
- WR-10 in the original review calls out that `magnet.test.ts:97-103` "asserts the CR-04 defect as intended behaviour" and needs inverting — this is now done (as part of the CR-04 fix above), so WR-10's fix scope should be reduced to just its other two items (the space-hold-guard timing test and the `openDangerConfirm` fixed-sleep flakiness).

---

## Skipped Issues (warnings pass)

None — all 10 in-scope findings (WR-01..WR-10) were fixed. See the "Warnings pass (WR-01..WR-10)" section above for two documented scope reductions within otherwise-fixed findings: WR-01 (the window-blur/visibilitychange path is fixed; the harder-to-reproduce "focus into a same-tab child iframe" scenario is not independently verified) and WR-05 (child-frame framePath tagging prevents the described false-merge but does not achieve full composed-path accuracy).

## Additional fixes required to reach a clean full-gate run (not WR-01..WR-10, found while running the gate)

Running `pnpm test` in full for the first time (as instructed, exactly once after all WR fixes) surfaced pre-existing test-quality gaps that were not part of this review's WR-01..WR-10 findings, but blocked the "0 failed, 0 flaky" gate requirement. Per the required method ("the fixer adapts to current state, not historical review context") these were root-caused and fixed:

1. **WR-06 regression, 2 missed spots** (`tests/e2e/confirm.e2e.ts` CR-02 test, `tests/e2e/hints.e2e.ts` CR-06 test) — commit `02c95f1`. Both had the same "turn card off, then immediately on, no wait" pattern already fixed in `helper-toggle.e2e.ts`/`site-toggle.e2e.ts` as part of the WR-06 commit, just in different files that weren't in that commit's verification run. Same fix (350ms wait between the two clicks).
2. **`dom-audit.e2e.ts`, 7 tests** — commit `340c47d`. Latent break from CR-05 (critical pass, already committed before this pass started): `danger.html` grew from 9 to 12 hint-candidate items, so `numberForElement`'s "closest label in whichever chapter is currently open" no longer reliably found `btn-delete-solo` (it can now be on the second hint chapter). Replaced with `numberForElementAcrossChapters`, which pages through chapters (`Digit0`) until it finds a label actually near the target element. This is exactly the trap the critical-pass fixer's own handoff note (above, "Notes for the warnings-pass fixer") flagged in advance for `danger.html`-dependent tests.
3. **`hints.e2e.ts` shortcuts.html test, 1 test** — commit `340c47d` (same commit as #2). Same root cause pattern as WR-10: a fixed 50ms sleep after `KeyF`, racing `openHints()`'s two `chrome.storage` reads. Flaky only under full-suite load (passed reliably in isolation and per-file), not reproducible as a deterministic red/green pair — replaced with `expect.poll` on the label list, per the same "replace fixed sleeps with condition waits" principle WR-10 already established for a different file.

All three were verified fixed (Tier 1 re-read + the specific affected test files run green) before the mandatory single full-gate re-run below.

## Final Verification — full gate, run once after all WR-01..WR-10 fixes and the three additional fixes above

Ran in the main working tree at `/home/user/project_260923` (no isolated worktree for this pass either — `git_rules` pinned the run to the main checkout directly, same as the critical pass).

```
$ pnpm lint
> tremor-browser-helper@0.0.0 lint /home/user/project_260923
> eslint .
(exit 0, no output)
```

```
$ pnpm typecheck
> tremor-browser-helper@0.0.0 typecheck /home/user/project_260923
> wxt prepare && tsc --noEmit

WXT 0.21.4
i Generating types...
√ Finished in 519 ms
(exit 0, no errors)
```

```
$ test -z "$(grep -rnE '\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource' src/)"
CLEAN: no matches (D-31 — no network egress in src/)
```

```
$ CI=true pnpm test   # pnpm test:unit && pnpm test:e2e — the FULL suite, run exactly once, no filters
> tremor-browser-helper@0.0.0 test:unit
 Test Files  13 passed (13)
      Tests  94 passed (94)

> tremor-browser-helper@0.0.0 test:e2e
Running 182 tests using 1 worker
[182 dots, no failures]
  182 passed (4.4m)
```

**0 failed, 0 flaky** across all 182 e2e tests + 94 unit tests. (A prior run of this same full-suite command — before the three additional fixes above — surfaced 8 failures: 7 in `dom-audit.e2e.ts` and 1 in `hints.e2e.ts`, both root-caused and fixed per `systematic-debugging` as described above, then the full gate was re-run from a clean state and passed completely, satisfying the "re-run the full gate" instruction.)

WR-10's mutation-testing check (temporarily removing `confirm-guard.ts`'s `keyup` hold-reset, confirming the pre-existing test still passed against it, extending the test, confirming it then failed against the same mutation, reverting the mutation, confirming the extended test passes against real code) was performed and reverted cleanly (`git diff` on `confirm-guard.ts` is empty) before this final gate run — the full gate above is evidence the revert left no residue.

## Full commit list (both passes, in order)

Critical pass (`ff6033e`..`238e990`): `ff6033e`, `e70be54`, `d24b825`, `218da9c`, `fceff7a`, `d697430`, `0bc613f`, `cf6a7ae`, `3e9fec9`, `ff8f7ad`, `ae3cdf8`, `b2fdf4e`, `e72559c`, `257e1d2`, `e0f18f6`, `238e990`, `948d355` (interim REVIEW-FIX.md, critical pass fixer).

Warnings pass (`f247e3b`..`340c47d`): `f247e3b`, `7b07ec3`, `1542c9f`, `18a797f`, `3beb3fc`, `085c974`, `5fe99f3`, `6df94f8`, `a9020d1`, `47779c8`, `5ce13a9`, `20cf465`, `289a8cc`, `d4e7d9f`, `40c4c59`, `6458c04`, `242dbfe`, `591d37d`, `02c95f1`, `7a7e9e3`, `340c47d`.

This `01-REVIEW-FIX.md` file itself is **not** committed by either fixer past the critical pass's interim commit (`948d355`) — per instructions, the orchestrator commits the final version.
