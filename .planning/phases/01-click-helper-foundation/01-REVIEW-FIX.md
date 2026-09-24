---
phase: 01-click-helper-foundation
fixed_at: 2026-09-24T12:15:28Z
review_path: .planning/phases/01-click-helper-foundation/01-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report (Critical findings, iteration 1)

**Fixed at:** 2026-09-24T12:15:28Z
**Source review:** .planning/phases/01-click-helper-foundation/01-REVIEW.md
**Iteration:** 1
**Scope:** CR-01 .. CR-08 (Critical) only. WR-*/IN-* are explicitly out of scope for this pass — a second fixer handles warnings.

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
