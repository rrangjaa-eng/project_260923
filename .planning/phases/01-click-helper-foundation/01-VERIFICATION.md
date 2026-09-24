---
phase: 01-click-helper-foundation
verified: 2026-09-24T14:05:00Z
status: gaps_found
score: 80/84 must-haves verified
covered_files:
  - .planning/REQUIREMENTS.md
  - .planning/phases/01-click-helper-foundation/01-01-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-01-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-02-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-02-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-03-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-03-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-04-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-04-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-05-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-05-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-06-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-06-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-07-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-07-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-08-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-08-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-09-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-09-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-10-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-10-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-11-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-11-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-12-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-12-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-13-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-13-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-14-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-14-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-15-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-15-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-16-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-16-SUMMARY.md
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
  - wxt.config.ts
covered_digest: "v1:sha256:bd4c3efaebdd04b43fbbaaff04794d2bb0d9916a57ecb9c1f1ead9b07692e165"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "같은 출처·다른 출처·중첩 iframe 안의 요소에도 번호표가 붙고, 번호는 페이지 전체에서 한 번만 매겨져 중복이 없다 (01-07 truth 1; ELEM-02; phase goal '어느 사이트에서든(iframe 본문 포함)')"
    status: partial
    reason: "The content script is not injected into same-origin iframes whose document is about:srcdoc (srcdoc=) or about:blank filled by document.write — the pattern used by iframe-based rich editors (SmartEditor 2, CKEditor 4 classic, TinyMCE classic) that are common on Korean intranet/approval systems. wxt/manifest content script has allFrames:true but no matchAboutBlank / match_origin_as_fallback. Verifier probe on the production build (CI build, .output/chrome-mv3): a src= iframe got hint numbers and tremor filtering (2 fast clicks -> 1), while srcdoc and about:blank+document.write iframes got no hint labels at all and no filtering (2 fast clicks -> 2). The practice site only uses src= iframes, so all 182 e2e tests pass without exercising this."
    artifacts:
      - path: "src/entrypoints/content.ts"
        issue: "defineContentScript({ matches: ['<all_urls>'], allFrames: true, runAt: 'document_start' }) — no matchAboutBlank / matchOriginAsFallback, so srcdoc and about:blank frames are skipped"
      - path: "tests/practice-site/frames.html"
        issue: "Fixture only contains src= iframes (same-origin, other.test, nested); no srcdoc or about:blank/document.write iframe, so the gap is invisible to the suite"
    missing:
      - "Inject the content script into about:blank/about:srcdoc frames (WXT matchAboutBlank: true and/or matchOriginAsFallback: true) and confirm frame-path, relay (sender.url of about:blank is origin 'null' — check recordPress origin check), and mode reporting still work there"
      - "Add a srcdoc iframe and an about:blank + document.write iframe (with a button, an input and a designMode/contenteditable body) to the practice site, with e2e: hint numbers present and unique, tremor filter active, magnet ring drawn, danger confirm reachable"
  - truth: "iframe 안 입력칸에 초점이 가면 맨 위 모드 표시가 '입력 중'이 된다 (01-07 truth 5; KEY-01 '글쓰기 편집기' in iframe-based editors)"
    status: partial
    reason: "Same root cause as the gap above. Probe: focusing the input inside a src= iframe switched the top indicator to data-mode=typing; focusing the input inside srcdoc and about:blank+document.write iframes left it at data-mode=helper ('도우미') while the user types. Typing itself still works there (keys never reach the helper), but the '입력 중 / 도우미' indicator is wrong and FILT-01/02 key filtering does not apply inside those editors."
    artifacts:
      - path: "src/entrypoints/content.ts"
        issue: "No content script in the editor frame -> no mode/report -> refreshModeDisplay falls back to the top document's own mode"
    missing:
      - "Covered by the same injection fix; add an e2e asserting data-mode=typing while focus is in a srcdoc / about:blank designMode editor, and that auto-repeat is filtered there"
human_verification:
  - test: "Load the extension on the user's own PC (unpacked build or private link) in the Chrome/Edge/Whale profile they actually use"
    expected: "Mode indicator '도우미' appears bottom-left on a normal site; the icon menu opens with number cards 1-4; the helper can be turned off from the icon"
    why_human: "Installation, permission prompt and real profile behaviour cannot be exercised by the sandboxed Playwright Chromium"
  - test: "Real-hand feel on the practice site: approach small buttons roughly, jitter over two adjacent elements, then click directly on the neighbour (e.g. an input right under a captured button)"
    expected: "The captured element does not flicker under tremor; the user judges whether a precise click on a neighbour within 24px being redirected to the captured element (by-design hysteresis, magnet.e2e '10px 더 가까우면 A를 유지') is acceptable or needs tuning in Phase 2"
    why_human: "Capture margin 48px / hysteresis 24px / tremor 300ms / dwell 800ms defaults are feel parameters; Phase 2 (TEST-02) tunes them"
  - test: "Sign into the same browser account on a second PC, turn the helper off globally and for one site on PC 1"
    expected: "Within normal sync latency PC 2 follows both settings (01-02 and 01-13 backstop truths, STOR-01)"
    why_human: "Backstop truth — tests only simulate a remote write with serviceWorker storage.sync.set; real cross-device chrome.storage.sync cannot run in CI"
  - test: "Prohibition review (01-09, SAFE-02, judgment tier): a numbered danger button is never pressed without the user's confirmation (1s guard, then real Enter or 1s Space hold); page-made Enter/click never confirms"
    expected: "Holds. LLM-judge (non-authoritative) verdict: holds — confirm-guard ignores isTrusted=false, confirm button has no click listener, pointer cancel only; live danger is re-checked at press time (WR-02) in frame 0 and in child frames (press/refused); covered by confirm.e2e 310/329/390/420/471/577"
    why_human: "unverified-prohibition — human review recommended (judgment-tier prohibition, no fail-first negative-test gate wired)"
  - test: "Prohibition review (01-12, CLICK-02, judgment tier): no testing on the real company system in Phase 1"
    expected: "Holds. LLM-judge verdict: holds — fixtures route only practice.test/other.test and abort + record everything else (blockedRequests); spike results recorded only for the local practice site"
    why_human: "unverified-prohibition — human review recommended"
  - test: "Prohibition review (01-16, ELEM-04, judgment tier): the helper sends no page content, press history or settings to any external address"
    expected: "Holds. LLM-judge verdict: holds — no fetch/XHR/WebSocket/sendBeacon in src/, only the SVG namespace string; fonts served from the extension with use_dynamic_url; overlay-perf e2e asserts blockedRequests == []"
    why_human: "unverified-prohibition — human review recommended"
  - test: "Decision on corrupted/newer-version settings (STOR-02 vs SAFE-04): with settings that fail migration, press '1 도우미 끄기'"
    expected: "Current behaviour: the global off is refused ('원래 설정을 지키려고 저장하지 않았어요.') and only '2 이 사이트에서 끄기' still works. Decide whether 'turn off' should be allowed to override preservation (e.g. write only a local off flag) — the core value is '방해되면 즉시 끌 수 있다'"
    why_human: "Intentional D-25 design trade-off, not a code defect; needs product decision"
---

# Phase 1: 클릭 도우미 기반 Verification Report

**Phase Goal:** 이용자가 어느 사이트에서든(iframe 본문 포함) 원하는 요소를 마우스를 대충 가져가거나 숫자 키 하나로 누를 수 있고, 떨림으로 인한 잘못 누름과 위험한 버튼 오조작이 막히며, 방해되면 즉시 끌 수 있다
**Verified:** 2026-09-24T14:05:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## MVP-mode note

ROADMAP marks this phase `**Mode:** mvp`, but the goal is not in user-story form (`gsd query user-story.validate` returned `valid: false`). Per the MVP rules the verifier should refuse and ask for `/gsd mvp-phase 1`. The orchestrator explicitly asked for verification against Success Criteria 1-5, so standard goal-backward verification was done. A derived user-flow table follows. **Reformatting the goal is a follow-up for the developer.**

## User Flow Coverage (derived)

| Step | Expected | Evidence | Status |
|------|----------|----------|--------|
| Open a site | '도우미' indicator bottom-left, top frame only | helper-toggle.e2e:6, dom-audit 8 | ✓ |
| Roughly approach an element | Nearest element captured in a 48px range, thick ring, stable under jitter | magnet.ts pickTarget + hysteresis; magnet.e2e 84/112 | ✓ |
| Click / Space | Captured element pressed, page not scrolled | press.e2e 17/55/128 | ✓ |
| F then a digit (incl. iframes) | Unique numbers across frames, pressed by digit | frames.e2e 103/161/234 | ✓ for src= iframes; ✗ srcdoc/about:blank iframes (gap) |
| Danger button | Not attracted, no dwell, number → red confirm, 1s guard, Enter / 1s Space | danger.e2e, dwell.e2e 134, confirm.e2e | ✓ |
| Turn off | Icon menu: global and this-site off; syncs | helper-toggle/site-toggle e2e | ✓ (real multi-PC is a human item) |
| Outcome | "어느 사이트에서든(iframe 본문 포함)" | Practice site ✓; iframe-editor pattern ✗ | ✗ partial |

## Goal Achievement

### Evidence run by the verifier (not taken from SUMMARY)

- `pnpm test:unit`: 13 files, **94/94 passed**
- `pnpm lint`: exit 0 · `pnpm typecheck`: exit 0
- `CI=true pnpm test:e2e` (production build, run once, full): **182/182 passed (4.5m)**, 0 flaky, no `retries` configured
- overlay-perf in this run: normal p95 **18.7ms** (32 samples), churn p95 **39.2ms** (32 samples) — both under 50ms
- `test-results/spike-matrix.json` regenerated (31 cells), matching the table recorded in 01-12-SUMMARY
- `verify.artifacts`: 50/50 artifacts pass across the 16 plans · `verify.key-links`: 39/39 wired
- Scratch probe on the production build (`scratchpad/probe-srcdoc.mjs`, no repo change): src= iframe → filter active (2 fast clicks → 1), typing mode shown, numbered. srcdoc and about:blank+document.write iframes → no filter (2 → 2), mode stays `helper` while typing, **no hint labels**

### Roadmap Success Criteria

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| SC1 | On the local practice site (tiny buttons, image links, late fields, nested iframe form): rough approach + click/Space, or F + digit, presses; jitter doesn't change capture; numbers don't collide across frames | ✓ VERIFIED | magnet.e2e (12×12 button at 30px, hysteresis 10/40px, image link/onclick img/role=button, late input, scroll), press.e2e, hints.e2e, frames.e2e 103/114/142 (unique, non-overlapping across same-origin, other.test and nested frames) |
| SC2 | Repeated key/spot, auto-repeat and unintended dblclick count once; dwell only after the ring fills; fields/editors type normally with a large '입력 중 / 도우미' indicator | ✓ VERIFIED (practice scope) | input-filter.e2e 41-130, dwell.e2e 78/98, input-filter 179-225, frames.e2e 257. Exception for iframe-based editors is in the gap |
| SC3 | Danger buttons: not attracted, no dwell, number → red confirm, input ignored 1s, Enter or 1s Space only | ✓ VERIFIED | magnet.ts danger-at-zero rule, dwell-timer danger → no fire, confirm-guard.ts; danger.e2e 178-333, dwell.e2e 134, confirm.e2e 184-618 (incl. fake Enter, shadow .click(), cross-origin frame, blur during hold) |
| SC4 | 5,000-element page: highlight follows within 50ms, measured automatically; spike (design 11 ①·④) recorded on the local practice site | ✓ VERIFIED | overlay-perf.e2e 145/158 (p95 18.7 / 39.2ms, this run); spike.e2e 11 tests + 01-12-SUMMARY table. The company-system part is out of scope (Phase 2) |
| SC5 | Global or this-site off from the icon; syncs across PCs; '도울 수 없음' on browser settings and web store | ✓ VERIFIED (simulated sync) | helper-toggle.e2e, site-toggle.e2e 25-344, unsupported-url.ts + ping fallback; real multi-PC sync → human item |

### Plan must-have truths (79)

| Plan | Truths | Status | Notes / evidence |
| --- | --- | --- | --- |
| 01-01 skeleton/settings | 4 | ✓ 4/4 | package.json pins the approved deps; skeleton.e2e 34/40/61; lint + typecheck pass |
| 01-02 menu off → all frames | 4 | ✓ 3 + ⚠ 1 backstop | helper-toggle.e2e 20/47/70/82/94/142. Real other-PC truth is `verification: backstop` → insufficient_spec → human |
| 01-03 tremor filter & input mode | 7 | ✓ 7/7 | tremor-filter.ts + pipeline.ts; input-filter.e2e (incl. indicator move at 80px, helper-off passthrough) |
| 01-04 collector/grid/magnet/ring | 5 | ✓ 5/5 | magnet.e2e 84-226 |
| 01-05 press & site shortcuts | 5 | ✓ 5/5 | press.e2e 17-210 (incl. CR-07 phantom press, fake Space ignored) |
| 01-06 hints | 6 | ✓ 6/6 | hints.e2e 145-587 (order pins → presses → near, placement, "누를 곳이 없어요", "0 다음 번호", digits pass through when closed) |
| 01-07 iframes | 6 | ✗ 4/6 | T1 and T5 fail for srcdoc / about:blank iframes (see gaps). T2, T3, T4, T6 ✓ via frames.e2e |
| 01-08 danger | 5 | ✓ 5/5 | danger.e2e; CR-04 (precise click on danger stays on danger) unit-tested in magnet.test.ts; CR-05 name patterns |
| 01-09 confirm | 6 | ✓ 6/6 | confirm.e2e; prohibition → human review (judgment tier) |
| 01-10 dwell | 5 | ✓ 5/5 | dwell.e2e 55-161 |
| 01-11 two-press drag | 4 | ✓ 4/4 | drag.e2e 51-145 |
| 01-12 spike | 4 | ✓ 4/4 | spike.e2e (31 cells, select showPicker, filechooser, no external requests); prohibition → human review |
| 01-13 site off / 도울 수 없음 | 6 | ✓ 5 + ⚠ 1 backstop | site-toggle.e2e (other tabs unaffected, pins kept, iframe follows top origin, 150 fast toggles, WR-07 rejection, simulated sync); real other-PC → human |
| 01-14 migration / old helper cleanup | 5 | ✓ 5/5 | lifecycle.e2e 47-353 (original preserved, toast + warning card, defaults used, 8KB item limit, single host after reinjection, SW-restart survival) |
| 01-15 zoom-independent overlay | 3 | ✓ 3/3 | zoom.e2e 53-506, dom-audit 12 |
| 01-16 font/perf/audit/gate | 4 | ✓ 4/4 | overlay-perf.e2e, dom-audit.e2e 16 tests (criteria unchanged by the later fix commit 340c47d, which only changed chapter navigation), full gate re-run here. The independence of the audit author is a process claim that code cannot show |

**Score:** 80/84 truths verified (5 roadmap SCs + 79 plan truths). 2 FAILED (partial, one root cause). 2 backstop truths need human evidence (insufficient_spec). 0 present-but-behavior-unverified: every behaviour-dependent truth (confirm guard timing, dwell cancel/re-fire, CR-02 off-while-open, CR-07 stale press, WR-01 blur) has a named passing e2e in this run.

### Required Artifacts

`gsd verify.artifacts` passed all 50 declared artifacts (exists, substantive, required exports/contains). Key ones were also read in full or in part: `content.ts`, `pipeline.ts`, `magnet.ts`, `dwell-timer.ts`, `confirm-guard.ts`, `confirm-dialog.ts`, `danger.ts`, `collector.ts`, `relay.ts`, `background.ts`, `storage-writer.ts`, `popup/main.ts`, `unsupported-url.ts`. No stubs found.

### Key Link Verification

`gsd verify.key-links` found all 39 declared links wired. Links checked by hand:

| From | To | Via | Status |
| --- | --- | --- | --- |
| content.ts | confirm-dialog.ts | number → `composed.danger` → `openDangerConfirm`; guard result `confirm` → `pressHintEntry(itemId, true)` | WIRED |
| pipeline.ts | confirm-guard (via modal handler) | `setModal` swallows every isTrusted key, 100ms ticks, blur/visibilitychange → keyup | WIRED |
| relay.ts | content.ts | `hints/press` only from frameId 0; `press/request` → child re-checks live danger → `press/refused` → top opens confirm | WIRED |
| content.ts | pipeline.ts | `isEnabled: () => currentEnabled ?? true` (global AND site off, CR-03) | WIRED |
| storage-writer.ts | settings-schema.ts | `readAndValidateSettings` → `migrate()`; failure → no write + notice | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
| --- | --- | --- | --- | --- |
| hints order | pins, presses | `chrome.storage.sync site:<origin>`, `chrome.storage.local presses:<origin>` written by storage-writer `recordPress` | Yes (hints.e2e 436/462/492/516) | ✓ FLOWING |
| helper on/off | settings.enabled + site disabled | storage.sync + onChanged | Yes | ✓ FLOWING |
| danger flag | `isDanger(name, settings.dangerWords)` | live settings | Yes (danger.e2e 270) | ✓ FLOWING |
| overlay scale | tab zoom | `tabs.getZoom` / `onZoomChange` → `zoom/changed` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Unit suite | `pnpm test:unit` | 94/94 | ✓ PASS |
| Lint / types | `pnpm lint`, `pnpm typecheck` | exit 0 / exit 0 | ✓ PASS |
| Full e2e, production build | `CI=true pnpm test:e2e` (once) | 182 passed | ✓ PASS |
| 50ms highlight | overlay-perf in the same run | p95 18.7ms / 39.2ms | ✓ PASS |
| srcdoc/about:blank iframes | scratch probe on `.output/chrome-mv3` | no hints, no filter, wrong mode | ✗ FAIL (gap) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` exist and no plan declares one. Step 7c is not applicable.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| --- | --- | --- | --- |
| ELEM-01 | 01-04 | ✓ SATISFIED | collector NAMED_SELECTOR + cursor:pointer img/svg/div/span; magnet.e2e 136/150. Images with only addEventListener and no pointer cursor can't be seen (documented assumption) |
| ELEM-02 | 01-07 | ✗ PARTIAL | src= iframes (same-origin, other.test, nested) ✓. srcdoc / about:blank iframes ✗ (gap) |
| ELEM-03 | 01-04 | ✓ SATISFIED | MutationObserver/scroll/resize → rAF collect; magnet.e2e 164/185/210; WR-03 hints follow scroll |
| ELEM-04 | 01-16 | ✓ SATISFIED | p95 18.7 / 39.2ms this run |
| FILT-01 | 01-03 | ✓ SATISFIED | input-filter.e2e 41/58/75/102 (not inside srcdoc/about:blank frames — gap) |
| FILT-02 | 01-03 | ✓ SATISFIED | input-filter.e2e 117 |
| FILT-03 | 01-03 | ✓ SATISFIED | input-filter.e2e 92 |
| FILT-04 | 01-11 | ✓ SATISFIED | drag.e2e |
| CLICK-01 | 01-04, 01-15 | ✓ SATISFIED | magnet.e2e 84/112, zoom.e2e 182 |
| CLICK-02 | 01-05, 01-12 | ✓ SATISFIED | press.e2e; spike: isTrusted-only buttons are blocked for synthetic presses (recorded limitation; direct click on the element passes through) |
| CLICK-03 | 01-06, 01-15 | ✓ SATISFIED | hints.e2e |
| CLICK-04 | 01-10 | ✓ SATISFIED | dwell.e2e |
| KEY-01 | 01-03 | ✓ SATISFIED (except iframe-based editors, gap) | input-filter.e2e 179-225, frames.e2e 257 |
| KEY-02 | 01-05 | ✓ SATISFIED | press.e2e 128, hints.e2e 401, spike G |
| SAFE-01 | 01-08, 01-10 | ✓ SATISFIED | danger.e2e, dwell.e2e 134 |
| SAFE-02 | 01-09 | ✓ SATISFIED | confirm.e2e 184/471/577 (auto-sequence part is CLICK-05, Phase 3) |
| SAFE-03 | 01-09 | ✓ SATISFIED | confirm.e2e 211/231/250/285 |
| SAFE-04 | 01-02, 01-13 | ✓ SATISFIED | helper-toggle / site-toggle e2e (command-palette part is Phase 3) |
| SAFE-05 | 01-13 | ✓ SATISFIED | site-toggle.e2e 25/47; unsupported-url.test.ts |
| STOR-01 | 01-02, 01-13 | ✓ SATISFIED (simulated) + ? NEEDS HUMAN (real second PC) | storage.sync + onChanged; helper-toggle 142, site-toggle 242 |
| STOR-02 | 01-01, 01-14 | ✓ SATISFIED | lifecycle.e2e 47/76/125/159/215/254 |

All 21 phase requirement IDs appear in at least one plan's `requirements` field. REQUIREMENTS.md maps no other IDs to Phase 1, so there are no orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| src/** | — | TBD/FIXME/XXX, TODO/HACK/placeholder | none found | — |
| src/entrypoints/content.ts | 115-119 | content script config lacks about:blank/srcdoc matching | 🛑 Blocker (gap) | Goal "iframe 본문 포함" not met for iframe editors |
| src/worker/storage-writer.ts | 204-219 | global off refused while settings fail migration (D-25) | ⚠️ Warning | "즉시 끌 수 있다" degraded to site-only off in that state; human decision |
| src/entrypoints/content.ts | 231-259 | dwell rAF loop in a child frame keeps running while the top confirm scrim is open (only the top frame's `evaluateMagnet` checks `activeConfirmKeyHandler`) | ℹ️ Info | Narrow window: a non-danger child element that hasn't dwell-fired yet could fire behind the scrim. Danger never dwell-fires. Reasoning only, no repro |

### Open Info findings from 01-REVIEW (IN-01..IN-06): do they undermine a must-have?

| ID | Judgement |
| --- | --- |
| IN-01 `tabs` permission redundant | No. Only affects the install warning text (Phase 2 DIST-01 should revisit it) |
| IN-02 test hooks in production SW | No. `frameStates`, `disconnectAlivePorts` and `resetRelayForE2E` are reachable only in the SW global, not by pages. `frameStates` grows per tab, a minor leak |
| IN-03 `pointerenter` bubbles | No must-have affected. It may open hover menus on ancestor containers on real sites (Phase 2 feel) |
| IN-04 fire-and-forget rejections | Not for tested flows. Residual risk: if `site/query` fails or returns no `topOrigin`, `siteDisabled` stays `false`, so "this site off" fails open (the helper stays on). It does not break the verified SAFE-04 behaviour, but it is fail-open on a user-safety toggle. Recommend `.catch` + retry when closing the gap |
| IN-05 absolute 50ms threshold on shared CI | No. The measurement exists and passed here with margin (18.7 / 39.2ms). Churn p95 is near 40ms, so watch for CI flakes |
| IN-06 `file://` marked 도울 수 없음 | No. SC5 only needs settings/web store pages. Global off stays available in the menu on those pages |

### Human Verification Required

These are also in the frontmatter. They block only after the gaps close: once the gaps are fixed, the phase status becomes `human_needed` because of them.

1. **Install on the user's PC.** Load the build in the user's real browser profile. Expected: the indicator appears, the menu works, and the helper can be turned off. Why human: installation and permissions happen outside the sandbox.
2. **Real-hand feel.** Test capture margin, hysteresis, tremor interval and dwell time. Also judge the by-design case where a precise click on a neighbour within 24px goes to the captured element. Why human: these are feel parameters, tuned in Phase 2.
3. **Real multi-PC sync.** Two backstop truths (01-02, 01-13) and STOR-01. Why human: CI can only simulate a remote `storage.sync.set`.
4. **Three judgment-tier prohibitions** (01-09 danger confirm, 01-12 no company-system testing, 01-16 no external requests). The LLM-judge verdict is "holds" for all three, but it is non-authoritative. Human review is recommended.
5. **Product decision.** When settings are corrupt or newer, should "도우미 끄기" be allowed to bypass original-preservation?

### Gaps Summary

There is one root cause. The content script never runs inside same-origin iframes whose document is `about:srcdoc` or an `about:blank` filled by `document.write`. That is the standard shape of iframe-based rich editors, and those editors are common on the intranet and approval sites the user will face. Inside such frames:

- elements get no hint numbers and no magnet
- the tremor filter (repeat keys, auto-repeat, double clicks) does not run
- the corner indicator keeps saying "도우미" while the user types

The local practice site uses only `src=` iframes, so all 182 e2e tests pass and never see it. The verifier reproduced it on the production build with a scratch probe. No later phase covers it. The likely fix is small: WXT `matchAboutBlank` / `matchOriginAsFallback`, plus practice fixtures and e2e for both frame kinds. Check the `about:blank` sender origin (`"null"`) in `recordPress`/`site/query` handling.

Everything else holds on the evidence: SC1-SC5 on the practice site, all 18 review-fix findings (each has a named e2e or unit test that passed in this run), the 50ms budget, the spike record and the off switches.

---

_Verified: 2026-09-24T14:05:00Z_
_Verifier: Claude (gsd-verifier)_
