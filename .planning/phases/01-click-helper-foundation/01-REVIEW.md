---
phase: 01-click-helper-foundation
reviewed: 2026-09-24T11:31:46Z
depth: standard
files_reviewed: 81
files_reviewed_list:
  - .github/workflows/ci.yml
  - .gitignore
  - eslint.config.js
  - package.json
  - playwright.config.ts
  - src/core/confirm-guard.ts
  - src/core/danger.ts
  - src/core/drag-two-press.ts
  - src/core/dwell-timer.ts
  - src/core/fingerprint.ts
  - src/core/frame-path.ts
  - src/core/frame-tree.ts
  - src/core/grid-index.ts
  - src/core/hint-order.ts
  - src/core/magnet.ts
  - src/core/settings-schema.ts
  - src/core/tremor-filter.ts
  - src/core/unsupported-url.ts
  - src/entrypoints/background.ts
  - src/entrypoints/content.ts
  - src/entrypoints/popup/index.html
  - src/entrypoints/popup/main.ts
  - src/page/click/drag.ts
  - src/page/click/press.ts
  - src/page/collector/collector.ts
  - src/page/input/mode.ts
  - src/page/input/pipeline.ts
  - src/page/overlay/confirm-dialog.ts
  - src/page/overlay/hints.ts
  - src/page/overlay/mode-indicator.ts
  - src/page/overlay/ring.ts
  - src/page/overlay/toast.ts
  - src/shared/messages.ts
  - src/types/chrome.d.ts
  - src/worker/relay.ts
  - src/worker/storage-writer.ts
  - tests/e2e/confirm.e2e.ts
  - tests/e2e/danger.e2e.ts
  - tests/e2e/dom-audit.e2e.ts
  - tests/e2e/drag.e2e.ts
  - tests/e2e/dwell.e2e.ts
  - tests/e2e/fixtures.ts
  - tests/e2e/frames.e2e.ts
  - tests/e2e/global-setup.ts
  - tests/e2e/helper-toggle.e2e.ts
  - tests/e2e/hints.e2e.ts
  - tests/e2e/input-filter.e2e.ts
  - tests/e2e/lifecycle.e2e.ts
  - tests/e2e/magnet.e2e.ts
  - tests/e2e/overlay-perf.e2e.ts
  - tests/e2e/press.e2e.ts
  - tests/e2e/site-toggle.e2e.ts
  - tests/e2e/skeleton.e2e.ts
  - tests/e2e/spike.e2e.ts
  - tests/e2e/zoom.e2e.ts
  - tests/practice-site/big.html
  - tests/practice-site/danger.html
  - tests/practice-site/drag.html
  - tests/practice-site/frames.html
  - tests/practice-site/input.html
  - tests/practice-site/next.html
  - tests/practice-site/popup-target.html
  - tests/practice-site/shortcuts.html
  - tests/practice-site/spike.html
  - tests/practice-site/targets.html
  - tests/unit/confirm-guard.test.ts
  - tests/unit/danger.test.ts
  - tests/unit/drag-two-press.test.ts
  - tests/unit/dwell-timer.test.ts
  - tests/unit/frame-path.test.ts
  - tests/unit/frame-tree.test.ts
  - tests/unit/grid-index.test.ts
  - tests/unit/hint-order.test.ts
  - tests/unit/magnet.test.ts
  - tests/unit/press.test.ts
  - tests/unit/settings-schema.test.ts
  - tests/unit/tremor-filter.test.ts
  - tests/unit/unsupported-url.test.ts
  - tsconfig.json
  - vitest.config.ts
  - wxt.config.ts
findings:
  critical: 8
  warning: 10
  info: 6
  total: 24
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-24T11:31:46Z
**Depth:** standard
**Files Reviewed:** 81 (the design spec was read for context only and was not reviewed)
**Status:** issues_found

## Summary

I read every file under `src/` in full and checked each one against the confirm-guard, danger, and site-toggle requirements in the design spec (§5 "확인 화면 보호", §8 "위험한 버튼" / "도우미 끄기" / "isTrusted"). I also read the configs and targeted parts of the tests.

**What holds up:**
- The message layer is sound. Content scripts never accept `window.postMessage`. The background checks `sender.id`. Every message passes a zod check. The relay uses `sender.frameId`, not the frameId the frame reports about itself.
- The keyboard side of the confirm guard is sound. Only `isTrusted` keys reach the guard, and a page cannot confirm the dialog with synthetic events.
- There is no network egress (D-31). The only non-extension-page URLs are the SVG namespace string and the extension's own `chrome-extension://` fonts.

**Where the defects are:**
- **The confirm modal controls only the keyboard.** Pointer and dwell input still press page elements behind the scrim. Turning the helper off while the dialog is open leaves an invisible modal armed, and the next Enter presses the danger button.
- **Turning the helper off for a site does not turn off the input pipeline.**
- **The magnet sends a direct click on a danger button to a normal neighbour.** A unit test asserts this behaviour.
- **Danger detection misses the most common legacy-intranet button patterns:** `<input type=button value=삭제>` and `<a><img alt=삭제></a>`.
- **The overlay breaks after an off/on cycle.** Hint labels and the confirm dialog lose their styles.
- **A stale "press later" callback can cause a phantom click.** It is left behind by a right-click, middle-click, or cancelled touch.
- **Child-frame hints silently disappear** after the service worker restarts from idle.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Confirm modal does not block pointer or dwell input; clicking the scrim or the "취소" button can press a page element behind it

**File:** `src/page/input/pipeline.ts:168-223`, `src/entrypoints/content.ts:199-243`, `src/entrypoints/content.ts:502-527`
**Issue:** `setModal()` only changes the keydown, keypress and keyup handlers. The `pointerdown` and `click` handlers never check `modalHandler`. While the danger confirm is open in the top frame, a trusted click anywhere still goes through the steps below. The page's collected items are not hidden by the scrim, because the grid and collector know nothing about the overlay.
1. The click runs `onPress`.
2. `onPress` calls `evaluateMagnet({x, y})` against the page items still in the grid.
3. If a page element lies within 48 px but not under the pointer, `pointInRect` is false. The helper then swallows the whole gesture with `preventDefault` + `stopImmediatePropagation` at window capture, and calls `synthesizePress()` on that page element.

This has two effects:
- A tremor click during the confirm, which is exactly the case §5 protects against, presses a hidden page button.
- A real click on the dialog's "취소" button often never reaches `cancelButton`'s listener. The window-capture `click` handler stops propagation first and presses the neighbouring page element instead.

The dwell loop (`syncDwellLoop`/`dwellTick`) also keeps running during the modal. A non-danger target under the scrim is clicked after `dwellMs`. The ring also stays visible.

**Fix:** Treat pointer input as modal too, and pause the magnet and dwell while the confirm is open:
```ts
// pipeline.ts pointerdown handler, before the filter
if (modalHandler) {
  pressSwallowed = false;          // let the event reach the shadow-DOM dialog
  pendingPressExecute = null;
  return;                          // do not run pressHandlers while modal
}
```
```ts
// content.ts
function openDangerConfirm(...) { ...; currentTargetId = null; hideRing(); stopDwellLoopIfRunning(); ... }
function evaluateMagnet(cursor) { if (!currentEnabled || activeConfirmKeyHandler) { return; } ... }
```
Add an e2e test that clicks `[data-part="confirm-button-cancel"]` with `page.mouse.click` while a page button sits within 48 px of that point. Assert that the dialog closes and the page counter stays 0.

### CR-02: Turning the helper off while the confirm is open leaves an invisible, armed modal; the next Enter presses the danger button

**File:** `src/entrypoints/content.ts:447-474`, `src/entrypoints/content.ts:651-680`, `src/page/input/pipeline.ts:64-66`
**Issue:**
- `applyEnabled(false)` calls `hideModeIndicator()`, which destroys the overlay host. The dialog disappears from view.
- Nothing calls `finish('cancel')`. `inputPipeline.setModal` stays set, `activeConfirmKeyHandler` stays set, the 100 ms tick interval keeps running, and child frames get no `confirm/state {open:false}`.
- For "이 사이트에서 끄기", `settings.data.enabled` stays `true`, so the pipeline's `isHelperEnabled()` stays true (see CR-03).

The result, on a site the user has just switched off:
1. Every trusted key is still swallowed, in the top frame and in all child frames.
2. The guard is already past its 1 s protection window.
3. The next Enter the user types, for example in a text field, is treated as `confirm`, and `pressHintEntry` presses the danger button. No dialog is visible at that point.

With the global toggle the modal goes dormant and then re-arms invisibly when the helper is switched back on.

**Fix:** Cancel any open confirm whenever the helper turns off:
```ts
function applyEnabled(enabled: boolean): void {
  ...
  if (!enabled) {
    if (activeConfirmKeyHandler) {
      inputPipeline.setModal(null);
      activeConfirmKeyHandler = null;
      closeConfirm();
      void chrome.runtime.sendMessage({ type: 'confirm/state', open: false });
    }
    ...
  }
}
```
Do the same in `cleanupOldHelper()`.

### CR-03: "이 사이트에서 끄기" does not disable the input pipeline (tremor filter, Esc-blur, press and dblclick swallowing keep running)

**File:** `src/page/input/pipeline.ts:64-66`, `src/entrypoints/content.ts:125`, `src/entrypoints/content.ts:477-484`
**Issue:** `createInputPipeline` decides whether it is active with `getSettings().data.enabled`, which is the global flag only. `siteDisabled` lives only in `content.ts` and is folded into `currentEnabled`, which the pipeline never sees. On a site-disabled site the pipeline still does all of the following:
- rejects every auto-repeat keydown with `preventDefault`/`stopImmediatePropagation`, so holding Backspace or the arrow keys does nothing;
- swallows the same key pressed again within 300 ms, including double letters typed in text fields;
- swallows re-clicks at the same spot within 300 ms, and suppresses `dblclick`;
- blurs the focused input on Escape.

The spec (§8 "도우미 끄기") requires that when the helper gets in the way, the user can switch it off *and keep working*. The site-toggle e2e tests only check that the mode indicator disappears.
**Fix:** Pass the combined state into the pipeline:
```ts
const inputPipeline = createInputPipeline({
  getSettings: () => currentSettings,
  isEnabled: () => currentEnabled === true,   // global && !siteDisabled
  signal: pipelineController.signal,
});
// pipeline.ts
function isHelperEnabled(): boolean { return opts.isEnabled(); }
```
Add an e2e test: switch the site off, then assert that a key held with `repeat` and a quick double key both reach the page.

### CR-04: A precise click on a danger button is redirected to a normal neighbour button

**File:** `src/core/magnet.ts:63-75`, `src/entrypoints/content.ts:510-526`, `tests/unit/magnet.test.ts:97-103`
**Issue:** `pickTarget` returns any normal candidate within `captureMarginPx` (48 px) before it considers a danger candidate at distance 0. Then `onPress`:
1. sees that the pointer is not inside the captured normal item's rect;
2. swallows the user's trusted click on the danger button;
3. calls `synthesizePress()` on the neighbour.

In `danger.html`, "저장" (150–210) and "삭제" (250–310) are 40 px apart. Clicking anywhere in x 250–258 of "삭제" presses "저장". With typical toolbar gaps of 4–8 px, almost the whole danger button redirects. In an approval UI with "결재 | 결재 취소" side by side, clicking "결재 취소" submits "결재". The spec says the magnet must not *pull toward* danger buttons, and that a danger button *is* captured when the cursor is exactly on it (§8). This code instead makes the cursor-on-danger case press something else. The unit test at `magnet.test.ts:97-103` asserts this behaviour.
**Fix:** A pointer inside a danger rect must never produce another target:
```ts
const dangerAtZero = withDistance.filter(({ candidate, distance }) => candidate.danger === true && distance === 0);
if (dangerAtZero.length > 0) {
  return pickBest(dangerAtZero, currentId, 0);   // check before normalInRange
}
```
In `onPress`, also pass the click through (`return false`) whenever `(x, y)` lies inside *any* collected item's rect other than the captured one. Invert the unit test.

### CR-05: Danger detection misses `<input type="button" value="삭제">`, `<a><img alt="삭제"></a>` and `aria-labelledby` names; hints press them without confirm and dwell clicks them

**File:** `src/page/collector/collector.ts:104-138`, `src/page/collector/collector.ts:459`
**Issue:** `computeName()` is the only input to `isDanger()`. The gaps:
- It reads `value` only for `type === 'submit'`. For `<input type="button" value="삭제">` or `type="reset"`, `textContent` is empty, so the name is `''` and `danger` is false.
- It reads `alt` and `title` only from the element itself. `<a href="javascript:del()"><img src="btn_del.gif" alt="삭제"></a>` gets the name `''`.
- It ignores `aria-labelledby`. `ariaOf()` handles it for fingerprints, but `computeName()` does not.

These are the dominant button patterns in the legacy PHP intranet and 결재 systems this product targets. For every such button:
- the hint number presses it immediately, with no confirm;
- dwell click fires on it (the `dwellTimer` danger exemption never applies);
- the magnet attracts it from 48 px away.
**Fix:**
```ts
if (el instanceof HTMLInputElement && ['submit', 'button', 'reset'].includes(el.type)) {
  const value = normalizeText(el.value); if (value) return value;
}
const labelledBy = ariaOf(el); if (labelledBy) return labelledBy;          // before textContent
// fall back to descendant img alt / title
const imgAlt = normalizeText(el.querySelector('img[alt]')?.getAttribute('alt')); if (imgAlt) return imgAlt;
```
Add practice-site buttons for these patterns, plus danger e2e cases.

### CR-06: Hint labels and the confirm dialog lose their styles after any helper off→on cycle; hint numbers render at the wrong positions

**File:** `src/page/overlay/hints.ts:12,22-25,109`, `src/page/overlay/confirm-dialog.ts:31,38-41,138`, `src/page/overlay/mode-indicator.ts:184-199`
**Issue:**
- `hints.ts` and `confirm-dialog.ts` each keep a module-level `styleInjected = true` flag after they inject their `<style>` into the shadow root.
- `destroyOverlayRoot()` runs on every global or site disable, and removes the host and its shadow root. It does not reset those flags.
- `ring.ts` and `toast.ts` re-inject correctly (they check `isConnected`), but hints and confirm do not.

After the user has opened hints once and then toggled the helper off and on, the new shadow root has no `.hints` or `.hint-label` rules. The labels become normal-flow block `div`s with `transform: translate(x, y)` applied *relative to their stacked flow position*. Label *k* is therefore drawn about *k* line-heights below the element it belongs to. The user presses the number shown next to element A and presses element B. The confirm dialog likewise renders as unstyled text at the top-left, with no scrim. No test re-opens hints after a toggle.
**Fix:** Tie the flag to the root instead of the module:
```ts
const styledRoots = new WeakSet<ShadowRoot>();
function ensureStyle(root: ShadowRoot): void {
  if (styledRoots.has(root)) return;
  ...; root.append(style); styledRoots.add(root);
}
```
Apply this to both files, and add an e2e test that toggles the helper off and on and then checks label positions.

### CR-07: A stale `pendingPressExecute` causes a phantom press of an old element on a later unrelated click

**File:** `src/page/input/pipeline.ts:168-193`, `src/page/input/pipeline.ts:210-223`
**Issue:**
- `pendingPressExecute` is set on an intercepted `pointerdown` and cleared only when a trusted `click` arrives.
- The `pointerdown` handler does not check `event.button`/`isPrimary`, and never resets `pendingPressExecute` at the start of a gesture.
- Some intercepted gestures never produce a `click`: a right-click or middle-click (those produce `auxclick`), a touch or pen gesture that ends in `pointercancel`, or a release outside the window. Each of these leaves the closure behind.

The next trusted left click anywhere then runs `execute()`. That includes a pass-through click on empty space, where `onPress` returns false, and a click the tremor filter rejected. The old element is pressed without the user aiming at it. Right-clicking near a link to open the context menu and then clicking elsewhere reproduces it. The intercept also swallows right and middle `mousedown`/`mouseup`, which breaks sites' own context-menu logic.
**Fix:**
```ts
(event) => {
  if (!event.isTrusted || !isHelperEnabled()) return;
  pendingPressExecute = null;                      // new gesture: forget old one
  if (event.button !== 0 || !event.isPrimary) { pressSwallowed = false; return; }
  ...
}
```
Also clear `pendingPressExecute` on `pointercancel`.

### CR-08: After the service worker restarts from idle, child-frame hint items disappear until those frames' DOM changes

**File:** `src/worker/relay.ts:285-304,340-347`, `src/page/collector/collector.ts:400-412`, `src/entrypoints/content.ts:261-263,275-280`
**Issue:**
- The relay keeps `reportsByTab` only in memory. An MV3 service worker stops after about 30 s without events, and the idle `alive` port does not keep it alive, as `lifecycle.e2e.ts:266` itself assumes.
- Each frame's `reportFrame()` skips sending if the report JSON has not changed, so frames with static content never report again.
- `frame/refresh` calls `collector.refresh()`, which goes through the same skip, so it does not force a report either.

Once the worker restarts, the first frame that reports again replaces the top frame's whole `latestReportEntries` list. That frame is usually the top frame itself, and a plain page scroll is enough to trigger it. The top frame then holds a list containing only that frame. Every static child frame's items then vanish from hints, and the D-03 cross-frame feature breaks after ordinary idle use. `disconnectAlivePorts` in the e2e tests does not clear relay state, so the tests cannot catch this.
**Fix:** On `frame/refresh`, and after the `alive` port reconnects, reset the skip so the frame reports again:
```ts
refresh(force = false): void { if (force) lastReportedJson = ''; collect(); }
// content.ts: frame/refresh → collector.refresh(true); connectAlivePort onDisconnect (valid) → collector.refresh(true)
```
Alternatively, persist `reportsByTab` in `chrome.storage.session`.

## Warnings

### WR-01: Space-hold confirm fires if the keyup is lost (window blur or focus moving into a frame without a content script)

**File:** `src/core/confirm-guard.ts:175-206`, `src/page/input/pipeline.ts:269-280`
**Issue:** The hold is cleared only by a `keyup` of `keymap.press` delivered to the guard. If focus leaves between keydown and keyup, `holdStartedAt` stays set and `tick()` confirms 1 s after the keydown, even for a brief tremor tap. Focus can leave through alt-tab or a click in another window. It can also move into an `about:blank` or `srcdoc` iframe, where the content script does not run because `matchAboutBlank` is off, so keys are neither swallowed nor forwarded. A page can move focus itself with a timer.
**Fix:** Reset the hold on `blur`, `visibilitychange` and `focusout` from the top window. Also treat a `tick` that arrives while `document.hasFocus()` is false as a release:
```ts
window.addEventListener('blur', () => modalHandler?.({ type: 'keyup', code: settings.keymap.press, repeat: false, t: performance.now() }), { signal });
```

### WR-02: The hint danger flag is a snapshot; a number press never re-checks the live element

**File:** `src/entrypoints/content.ts:611-631`, `src/entrypoints/content.ts:266-273`, `src/entrypoints/content.ts:733-749`
**Issue:** `composed?.danger` comes from `composedItemsCache`, which is built once in `openHints()`. If the element's text changes to a danger word while hints are open, `pressHintEntry` presses it with no confirm. This happens when a SPA re-renders "편집" into "삭제", or when a list shifts. `pressOrDrag` receives the live `item.danger` but uses it only to skip drag handling. The child-frame `press/request` handler also presses without checking danger.
**Fix:** In `pressHintEntry` (frame 0) and in the `press/request` handler, re-read `item.danger` from `collector.items()`. If it is now true and the confirm was not already shown, open the confirm (top frame) or refuse and report back (child frame) instead of pressing.

### WR-03: Hint labels are not moved or closed on scroll or layout change

**File:** `src/entrypoints/content.ts:385-401`, `src/entrypoints/content.ts:561-591`
**Issue:** `openChapter` places the labels from rects captured at `openHints()` time. `collector.onChange` (scroll, resize, mutation) rebuilds the grid but never touches visible hints. After a wheel scroll the label "3" sits next to a different element than the one number 3 presses.
**Fix:** In `collector.onChange`, when `hintsActive` is true, either `closeHints()` or rebuild `composedItemsCache` and call `openChapter(hintChapterIndex)`.

### WR-04: Press history never matches links, images or divs, and freezes once 200 entries exist

**File:** `src/core/fingerprint.ts:226-228`, `src/page/collector/collector.ts:176-185,230-239`, `src/worker/storage-writer.ts:518-527`
**Issue:**
- `isSameElement` needs 2 matching fields. For an `<a>` link, an image or a pointer `div` with no id, name or aria, the only field set is `domPath` (`buttonText` is only for buttons). The score is 1 at most, so each press appends a new `{count: 1}` entry, and the history never accumulates for links.
- The 200-entry cap sorts by count and keeps the first 200. A new entry (count 1) is always last among ties, so once the list is full every new element is dropped immediately.

Together these make "자주 누른 요소" ordering (D-11) ineffective for links, and permanently frozen after about 200 presses.
**Fix:** Include link text or `href` path in the fingerprint for anchors, or accept a `domPath` + text match as a match. Evict by least-recently-used (store `lastAt`), or never evict the entry that was just inserted.

### WR-05: Press history for child frames is keyed and path-tagged inconsistently

**File:** `src/entrypoints/content.ts:98-103,172,181`, `src/entrypoints/content.ts:595-607`
**Issue:**
- A magnet, space or dwell press inside a child frame records `item.fingerprint` with `framePath: []`, under the *child's* origin.
- A hint press records it with the composed `framePath`.
- `openHints()` reads presses only for the top frame's origin.

As a result, cross-origin child presses never affect ordering. Same-origin child magnet presses are stored with `framePath: []`, and can match and boost an unrelated *top-frame* element that shares `domPath` and text, which is common with shared templates.
**Fix:** Always record child presses with the composed `framePath` and the top-page origin (the site = top origin, D-20). Update the writer's origin check to accept `sender.tab.url`'s origin for this key.

### WR-06: The popup has no tremor filtering; a double tap or held key toggles the helper back and forth

**File:** `src/entrypoints/popup/main.ts:183-188`
**Issue:** The popup's `keydown` listener toggles on every event matching `digitCodes`. It checks neither `event.repeat` nor a minimum interval. For the target user, a tremor double-press or a slightly held "1" turns the helper off and immediately back on (or on/off). The same applies to "2" (site toggle). The popup is the only place where these are controlled.
**Fix:** Ignore `event.repeat`, and reuse `createTremorFilter` with the stored `tremorIntervalMs` for both keydown and click.

### WR-07: Storage writer can deadlock the site queue and never answer after a storage rejection

**File:** `src/worker/storage-writer.ts:353-365,420-433`, `src/entrypoints/background.ts:174-199`
**Issue:**
- If `chrome.storage.sync.set` rejects, `runSiteWriteQueue` throws out of `await enqueue(...)`. `state.writing` then stays `true` forever and its waiters are never resolved, so every later `setSiteDisabled` for that origin hangs until the service worker restarts. The rejection is also unhandled, because it is started with `void`.
- `setEnabled` and `updateSettings` call `.then(sendResponse)` with no rejection path, so the popup never gets an answer.

Rejection is realistic because `syncSet` checks only the 8 KB per-item limit. It does not check the total sync quota (about 100 KB) or `MAX_ITEMS` (512). One `site:<origin>` key is written per site ever toggled.
**Fix:** Wrap the loop body in `try/finally { state.writing = false }`, catch the error and resolve waiters with `{ ok: false, reason: 'write-failed' }`, and add `.catch(() => sendResponse({ ok: false }))` to each handler.

### WR-08: A missing `settings` key is treated as corruption (the helper can no longer be turned off), and the failure notice is never cleared

**File:** `src/worker/storage-writer.ts:369-385`, `src/core/settings-schema.ts:20-22`, `src/entrypoints/content.ts:791-798`
**Issue:**
- `migrate(undefined)` returns `no-version`, so if `settings` is missing from sync, `readAndValidateSettings` writes a "migration failed" notice. The key can go missing through a sync data reset, or when `onInstalled` did not complete.
- `setEnabled`/`updateSettings` then return `preserved-original` forever. Nothing re-creates the defaults outside `onInstalled`, so the global "도우미 끄기" permanently stops working.
- `notice:migration-failed` is never removed anywhere in `src/`. After a single failure, every page load shows the toast and the popup shows the warning card indefinitely, even after valid settings are written.
**Fix:** In `readAndValidateSettings`, treat `raw === undefined` as "write defaults". Remove `MIGRATION_NOTICE_KEY` after any successful validated write, or store the failing `raw` hash and clear the notice when the value changes.

### WR-09: Extension fonts are web-accessible to every origin without `use_dynamic_url`, so sites can detect the assistive extension

**File:** `wxt.config.ts:13`
**Issue:** `web_accessible_resources: [{ resources: ['fonts/*.woff2'], matches: ['<all_urls>'] }]` lets any page fetch `chrome-extension://<fixed-id>/fonts/ibm-plex-sans-kr-latin-400-normal.woff2`. It can use that to learn that the visitor runs a tremor-assistance extension, which discloses a health condition. This works even when the helper is off and no overlay host exists.
**Fix:** Add `use_dynamic_url: true` to the entry, so the URL is per-session and cannot be enumerated. Also consider narrowing `matches`.

### WR-10: Several e2e checks cannot fail for the bug they name, or depend on fixed sleeps around async work

**File:** `tests/e2e/confirm.e2e.ts:260-271`, `tests/e2e/confirm.e2e.ts:104-110`, `tests/unit/magnet.test.ts:97-103`
**Issue:**
- The case "1초 전에 떼면 확인되지 않는다" presses Space for 200 ms and asserts `count === '0'` about 300 ms after the keydown. A broken keyup reset would only confirm at 1000 ms. The test then waits 1100 ms and presses Escape without checking the counter again, so it passes even when the release is ignored.
- `openDangerConfirm` sleeps 50 ms after `KeyF` before reading labels, but `openHints()` awaits two storage reads. If labels are not rendered yet, `numberForElement` returns `''`, so the test fails or is flaky rather than waiting deterministically.
- `magnet.test.ts:97-103` asserts the CR-04 defect as intended behaviour.
**Fix:** After releasing Space, wait 1200 ms and then assert the counter is still `0` and the dialog is still visible. Replace the fixed sleeps with `expect.poll` on the label count. Invert the magnet test.

## Info

### IN-01: The `tabs` permission is redundant with the `<all_urls>` host permission

**File:** `wxt.config.ts:9`
**Issue:** `<all_urls>` already exposes `tab.url` and `tab.title`. `tabs` only adds the install warning "Read your browsing history".
**Fix:** Drop `'tabs'` and verify that `chrome.tabs.get(...).url` still works under the host permission.

### IN-02: Test-only hooks ship in the production service worker

**File:** `src/entrypoints/background.ts:29-30,104-109`
**Issue:** `globalThis.frameStates` and `globalThis.disconnectAlivePorts` are present in production builds. `frameStates` is never pruned when tabs close.
**Fix:** Guard both with `import.meta.env.MODE !== 'production'` (or an e2e flag), and delete the tab's entry in `tabs.onRemoved`.

### IN-03: `synthesizePress` dispatches `pointerenter` with `bubbles: true`

**File:** `src/page/click/press.ts:333`
**Issue:** `pointerenter` does not bubble in real input. Dispatching it with `bubbles: true` fires every ancestor's `pointerenter` listener, which can trigger hover menus on containers.
**Fix:** Pass `{ bubbles: false }` for `pointerenter`.

### IN-04: Unhandled promise rejections from fire-and-forget messaging

**File:** `src/worker/relay.ts:342,346,356,366,372,377,387,393`, `src/entrypoints/background.ts:71`, `src/entrypoints/content.ts:838`
**Issue:** `void chrome.tabs.sendMessage(...)` rejects when the target frame is gone, and `chrome.tabs.get` in `onActivated` rejects for a closed tab. If `site/query` rejects in `content.ts`, `siteDisabled` is never loaded, so the helper runs on a site the user switched off.
**Fix:** Add `.catch(() => {})` to the relay and background calls. In `content.ts`, retry `site/query` once, or read the site key using `location.origin` of the top frame (`window.top === window`).

### IN-05: The overlay performance e2e uses wall-clock p95 < 50 ms on shared CI runners

**File:** `tests/e2e/overlay-perf.e2e.ts:155,168`
**Issue:** Absolute timing thresholds on `ubuntu-latest` shared runners are a flake source unrelated to code changes.
**Fix:** Keep the absolute check as a local or nightly job, or compare against a baseline measured in the same run.

### IN-06: `file://` pages are marked "도울 수 없음" although the content script runs there when file access is allowed

**File:** `src/core/unsupported-url.ts:261-263`, `src/entrypoints/content.ts:108`
**Issue:** `<all_urls>` covers `file://`. When the user allows file access, the helper is active, but the badge and popup say it cannot help and hide the site toggle.
**Fix:** Either exclude `file://*` in the content script's `exclude_matches`, or treat `file:` as supported when `chrome.extension.isAllowedFileSchemeAccess()` is true.

---

_Reviewed: 2026-09-24T11:31:46Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
