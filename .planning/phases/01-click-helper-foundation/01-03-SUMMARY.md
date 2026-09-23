---
phase: 01-click-helper-foundation
plan: 03
subsystem: input-pipeline
tags: [tremor-filter, window-capture, mv3-content-script, playwright, vitest, shadow-dom]

# Dependency graph
requires:
  - phase: 01-click-helper-foundation (Plan 02)
    provides: "src/entrypoints/content.ts(설정 읽기+onChanged 구독), src/page/overlay/mode-indicator.ts(도우미 모드 표시 shadow root), tests/e2e/fixtures.ts"
provides:
  - "src/core/tremor-filter.ts: createTremorFilter — 순수 함수(간격·같은 자리·자동 반복·더블클릭 억제 판단), 단위 시험 7개"
  - "src/page/input/pipeline.ts: createInputPipeline — window capture로 keydown/keyup/pointerdown/pointerup/mousedown/mouseup/click/dblclick/focusin/focusout/pointermove를 가장 먼저 받아 isTrusted만 통과시키고 떨림 필터를 적용, onKey/onPress 처리기 등록(Plan 01-05부터 사용)"
  - "src/page/input/mode.ts: isTypingTarget·currentMode·deepActiveElement — 입력칸(input 글자 타입·textarea·contenteditable) 판정"
  - "src/page/overlay/mode-indicator.ts: setMode·updateIndicatorProximity 추가 — '도우미'/'입력 중 · Esc로 도우미' 표시, data-mode·data-side, 80px 비키기"
  - "tests/practice-site/input.html: 클릭·더블클릭 카운터, input/textarea/contenteditable/checkbox 연습 사이트(D-28)"
  - "vitest.config.ts: tests/unit/**만 스캔(deferred-items.md 해결 — pnpm test:unit가 저장소 전체를 스캔하던 문제)"
affects: [01-04, 01-05, 01-06, 01-07, 01-13, 01-14]

actuals:
  tokens: 8272
  tasks: 3
  commits: 6
  plan_head_before: 57d985a

tech-stack:
  added: []
  patterns:
    - "입력 파이프라인(D-06, D-09, Pattern 1): document_start의 window capture 리스너가 isTrusted가 아닌 입력·도우미 꺼짐을 통과시키고, 그 외엔 떨림 필터(간격 안 재입력·자동 반복·같은 자리)를 거친 뒤 등록된 onKey/onPress 처리기에 넘긴다 — 이후 계획(자석·번호표·확인)은 이 파이프라인에 처리기만 등록한다"
    - "떨림 필터는 순수 함수(src/core/tremor-filter.ts) — document·window·chrome 참조 없음, 시각은 인자로 받아 실제 타이머 없이 단위 시험 가능"
    - "떨림 필터 기준은 '마지막으로 받아들인 입력'이다 — 거절된 입력은 기준 시각/좌표를 갱신하지 않는다(연속 재입력이 간격마다 한 번씩 들어갈 수 있음, PLAN.md 가정 문단에 기록됨)"
    - "pointerdown이 거절되면 pointerdown→mousedown→pointerup→mouseup→click 묶음 전체를 다음 pointerdown까지 삼킨다(부울 플래그 하나로 묶음 추적)"
    - "입력 모드(D-16)는 상태를 따로 캐시하지 않고 focusin/focusout마다 document.activeElement(열린 shadow root 포함)를 다시 읽어 계산한다 — Escape로 입력칸을 빠져나올 때도 사이트의 Esc 처리(자동완성 닫기 등)를 막지 않기 위해 이벤트 자체는 삼키지 않는다"
    - "모드 표시 비키기는 :host([data-side='right'])에서 left를 calc(100vw - 100% - var(--space-4))로 바꿔 real transition이 동작하게 한다(auto ↔ px는 transition되지 않음) — 커서가 80px 안으로 들어오는 '진입'만 반대편으로 토글하고 머무는 동안은 반복 토글하지 않는다(wasNearIndicator 엣지 감지)"
    - "vitest.config.ts: test.include를 tests/unit/**로 좁혀 .claude/skills/**(bun:test 트리)를 제외 — deferred-items.md(Plan 01-02)가 예고한 조치"

key-files:
  created:
    - src/core/tremor-filter.ts
    - tests/unit/tremor-filter.test.ts
    - src/page/input/pipeline.ts
    - src/page/input/mode.ts
    - tests/practice-site/input.html
    - tests/e2e/input-filter.e2e.ts
    - vitest.config.ts
  modified:
    - src/entrypoints/content.ts
    - src/page/overlay/mode-indicator.ts

key-decisions:
  - "Task 3의 <behavior> 목록은 모드 표시 비키기 거리를 60px로 적었지만, 같은 계획의 must_haves 최상위 truths·<action> 본문·CONTEXT.md D-26·docs/design/SYSTEM.md가 전부 80px이라 60px을 오타로 판단하고 80px로 시험·구현했다(RED·GREEN 커밋 메시지에 근거 기록)."
  - "vitest.config.ts를 이 계획(01-03)에서 새로 추가했다 — deferred-items.md(Plan 01-02)가 '실제 단위 시험을 처음 추가하는 계획이 test.include를 좁혀야 한다'고 미리 기록해 둔 항목이며, 이 계획이 처음으로 tests/unit/*.test.ts를 추가하는 계획이다. 이후 pnpm test:unit이 저장소 전체가 아니라 tests/unit/**만 본다."
  - "모드 표시 비키기는 CSS left를 'auto'로 바꾸지 않고 calc(100vw - 100% - var(--space-4))로 계산했다 — auto는 transition이 동작하지 않아 SYSTEM.md의 '옮김은 120ms'가 실제로 무의미해지기 때문. 두 값 모두 실제 길이라 transition이 정상 동작한다."
  - "pipeline.ts의 onKey/onPress 처리기는 이 계획에서 등록하는 곳이 없다(Plan 01-05부터 사용) — 등록·순회 로직만 미리 배선해 두었다."

requirements-completed: [FILT-01, FILT-02, FILT-03, KEY-01]

coverage:
  - id: D1
    description: "같은 자리를 300ms 안에 두 번 클릭하면 사이트는 클릭을 한 번만 받는다(FILT-01)"
    requirement: FILT-01
    verification:
      - kind: e2e
        ref: "tests/e2e/input-filter.e2e.ts#같은 자리를 100ms 간격으로 두 번 클릭하면 사이트는 클릭을 한 번만 받는다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/input-filter.e2e.ts#같은 자리를 400ms 간격으로 두 번 클릭하면 사이트는 클릭을 두 번 받는다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/input-filter.e2e.ts#40px 떨어진 두 버튼을 100ms 간격으로 클릭하면 각 카운터가 1이다"
        status: pass
    human_judgment: false
  - id: D2
    description: "같은 키를 간격 안에 다시 누르거나 키를 오래 눌러도(자동 반복) 글자·동작은 한 번만 들어간다(FILT-02)"
    requirement: FILT-02
    verification:
      - kind: unit
        ref: "tests/unit/tremor-filter.test.ts#같은 code가 마지막으로 받아들인 시각에서 intervalMs 미만 뒤에 오면 거절하고, 정확히 intervalMs 뒤면 받아들인다"
        status: pass
      - kind: unit
        ref: "tests/unit/tremor-filter.test.ts#repeat: true인 키 입력은 거절한다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/input-filter.e2e.ts#입력칸에서 같은 글자를 100ms 간격으로 누르면 하나만 들어가고, 400ms 간격이면 새로 들어간다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/input-filter.e2e.ts#키를 오래 눌러도(자동 반복) 글자는 한 번만 들어간다"
        status: pass
    human_judgment: false
  - id: D3
    description: "의도치 않은 더블클릭(두 번째 누름이 걸러진 경우)은 클릭 한 번으로만 전달되고 dblclick은 전달되지 않는다(FILT-03)"
    requirement: FILT-03
    verification:
      - kind: unit
        ref: "tests/unit/tremor-filter.test.ts#shouldSuppressDblclick()은 바로 앞 누름이 거절됐을 때만 true다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/input-filter.e2e.ts#의도치 않은 더블클릭은 사이트에 클릭 한 번으로만 전달되고 dblclick은 전달되지 않는다"
        status: pass
    human_judgment: false
  - id: D4
    description: "입력칸·textarea·contenteditable 안에서는 숫자·스페이스바가 원래대로 글자를 입력하고, 모드 표시가 '입력 중 · Esc로 도우미'가 된다(KEY-01)"
    requirement: KEY-01
    verification:
      - kind: e2e
        ref: "tests/e2e/input-filter.e2e.ts#입력칸에 포커스하면 모드 표시가 \"입력 중\"·\"Esc로 도우미\"를 보여주고 data-mode가 typing이다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/input-filter.e2e.ts#입력칸 안에서는 숫자·스페이스바가 원래대로 글자를 입력한다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/input-filter.e2e.ts#textarea와 contenteditable에 포커스하면 data-mode가 typing이다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/input-filter.e2e.ts#checkbox에 포커스하면 data-mode가 helper다"
        status: pass
    human_judgment: false
  - id: D5
    description: "입력칸에서 Esc를 누르면 입력칸을 빠져나와 모드 표시가 '도우미'로 돌아간다(KEY-01)"
    requirement: KEY-01
    verification:
      - kind: e2e
        ref: "tests/e2e/input-filter.e2e.ts#입력칸에서 Esc를 누르면 입력칸을 빠져나와 모드 표시가 \"도우미\"로 돌아간다"
        status: pass
    human_judgment: false
  - id: D6
    description: "커서가 모드 표시에서 80px 안으로 오면 반대편 아래로 비키고, 커서가 떠나도 자리를 유지하며, 다시 다가가면 되돌아간다"
    verification:
      - kind: e2e
        ref: "tests/e2e/input-filter.e2e.ts#커서가 모드 표시 80px 안으로 오면 반대편으로 옮기고, 떠나도 자리를 유지하며, 다시 다가가면 되돌아간다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/input-filter.e2e.ts#움직임 줄이기 설정이면 모드 표시 옮김 transition 시간이 0이다"
        status: pass
    human_judgment: false
  - id: D7
    description: "도우미가 꺼져 있으면 떨림 필터도 동작하지 않는다(사이트가 모든 입력을 그대로 받는다), 설정 변경(tremorIntervalMs)이 즉시 반영된다"
    verification:
      - kind: e2e
        ref: "tests/e2e/input-filter.e2e.ts#도우미를 꺼 두면 떨림 필터도 동작하지 않아 100ms 간격 두 클릭이 모두 들어간다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/input-filter.e2e.ts#설정의 tremorIntervalMs를 100으로 바꾸면 200ms 간격 두 클릭이 즉시 반영되어 둘 다 들어간다"
        status: pass
    human_judgment: false
  - id: D8
    description: "떨림 필터 순수 함수(src/core/tremor-filter.ts)에 document·window·chrome 참조가 없다(T-01-08 spoofing 완화의 전제 — isTrusted 확인이 pipeline.ts에 있다)"
    verification:
      - kind: other
        ref: "grep -cE \"\\b(document|window|chrome)\\.\" src/core/tremor-filter.ts (0)"
        status: pass
      - kind: other
        ref: "grep -n isTrusted src/page/input/pipeline.ts (존재)"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-09-23
status: complete
---

# Phase 1 Plan 3: Tremor Filter & Input Mode Summary

**떨림 필터 순수 함수(간격·같은 자리·자동 반복·더블클릭 억제)와 window capture 입력 파이프라인(isTrusted만 통과, document_start), 입력칸/도우미 모드 판정과 "입력 중" 모드 표시 비키기까지 CI=true Playwright e2e 15개 + Vitest 단위 시험 7개로 증명**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-09-23T15:38:30Z (첫 커밋 기준)
- **Completed:** 2026-09-23T15:49:08Z (마지막 GREEN 커밋 기준)
- **Tasks:** 3 (각 tdd="true", RED→GREEN 두 커밋씩)
- **Files modified:** 9 (7 created, 2 modified)

## Accomplishments

- `src/core/tremor-filter.ts`: `createTremorFilter()` — 순수 함수로 키(같은 code·간격·자동 반복 거절)와 누름(같은 자리·간격 거절)을 판단한다. 기준은 "마지막으로 받아들인 입력"이라 거절된 입력은 기준을 갱신하지 않는다. `shouldSuppressDblclick()`은 바로 앞 누름이 거절됐을 때만 true. 단위 시험 7개(GREEN)
- `src/page/input/pipeline.ts`: `createInputPipeline({getSettings, signal})` — `document_start`의 window capture로 keydown/keyup/pointerdown/pointerup/mousedown/mouseup/click/dblclick/focusin/focusout/pointermove를 가장 먼저 받는다. `isTrusted`가 아니거나 도우미가 꺼져 있으면 통과. 떨림 필터로 거절된 키는 keyup까지, 거절된 누름은 pointerdown→mousedown→pointerup→mouseup→click 묶음을 다음 pointerdown까지 삼킨다. `onKey`/`onPress`로 처리기를 등록할 수 있다(Plan 01-05부터 사용, 이번 계획은 처리기 없이 통과)
- `src/page/input/mode.ts`: `isTypingTarget()`(input 글자 타입·textarea·contenteditable 판정, checkbox·radio·button 등은 제외), `currentMode()`, `deepActiveElement()`(열린 shadow root 안 포커스까지 따라감)
- `src/page/overlay/mode-indicator.ts`: `setMode()`·`updateIndicatorProximity()` 추가 — "도우미"(남색 채움)/"입력 중 · Esc로 도우미"(흰 바탕 + 남색 `--border-strong` 테두리) 표시, 호스트에 `data-mode`·`data-side`, 커서가 80px 안이면 반대편으로 옮기고 떠나도 자리 유지, `transition: left var(--motion-appear)`로 reduced-motion에서 0ms
- `src/entrypoints/content.ts`: `document_start`에서 곧바로 `createInputPipeline` 등록(설정 오기 전엔 `defaultSettings()`), 설정 도착·변경 시 `currentSettings` 갱신
- `tests/practice-site/input.html`: 클릭·더블클릭 카운터 버튼 2개(40px 간격), `input`·`textarea`·`contenteditable`·`checkbox`(D-28)
- `tests/e2e/input-filter.e2e.ts`: behavior 15개(Task 2 8개 + Task 3 7개) — `CI=true pnpm exec playwright test tests/e2e/input-filter.e2e.ts` 15 passed
- `vitest.config.ts`: `test.include`를 `tests/unit/**`로 좁혀 `pnpm test:unit`이 저장소 전체(`.claude/skills/**`)를 스캔하던 문제를 해결(Plan 01-02 deferred-items.md 예고 조치)

## Task Commits

3개 Task 모두 RED→GREEN 두 커밋씩, 총 6개:

1. **Task 1 RED: 떨림 필터 판단 규칙 실패 시험 7개** - `13c4a70` (test)
2. **Task 1 GREEN: 떨림 필터 순수 함수 createTremorFilter** - `782b367` (feat)
3. **Task 2 RED: 입력 파이프라인 떨림 필터 실패 e2e 8개** - `0ed5005` (test)
4. **Task 2 GREEN: 입력 파이프라인 — isTrusted만, 떨림 필터를 가장 먼저 적용** - `2298e67` (feat)
5. **Task 3 RED: 입력 모드·Esc 빠져나오기·모드 표시 비키기 실패 e2e 7개** - `ef0d33e` (test)
6. **Task 3 GREEN: 입력 모드 판정·Esc로 빠져나오기·모드 표시 "입력 중"과 커서 비키기** - `187e0ad` (feat)

**Plan metadata:** (이 커밋 직후 별도 `docs(01-03): ...` 커밋으로 기록)

## Files Created/Modified

- `src/core/tremor-filter.ts` - 떨림 필터 순수 함수
- `tests/unit/tremor-filter.test.ts` - 단위 시험 7개
- `vitest.config.ts` - 단위 시험 스캔 범위 한정(신규)
- `src/page/input/pipeline.ts` - 입력 파이프라인
- `src/page/input/mode.ts` - 입력칸 판정·현재 모드
- `src/page/overlay/mode-indicator.ts` - 모드 표시에 setMode·비키기 추가
- `src/entrypoints/content.ts` - 파이프라인 등록, 설정 상태 보관
- `tests/practice-site/input.html` - 입력 연습 사이트(신규)
- `tests/e2e/input-filter.e2e.ts` - e2e 15개

## Decisions Made

frontmatter `key-decisions` 참고. 요약: Task 3 behavior 목록의 60px은 계획 자체 모순(다른 곳은 전부 80px)이라 80px로 시험·구현, vitest.config.ts는 이 계획이 처음으로 단위 시험을 추가해 신설, 모드 표시 비키기는 `left: auto`가 아니라 `calc(100vw - 100% - var(--space-4))`로 계산해 실제 transition이 동작하게 함, onKey/onPress는 배선만 하고 등록은 Plan 01-05로 미룸.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] vitest.config.ts 신설**
- **Found during:** Task 1 RED(첫 단위 시험 파일 추가 시점)
- **Issue:** 저장소에 `vitest.config.ts`가 없어 `pnpm exec vitest run`이 기본 파일 탐색으로 저장소 전체(`.claude/skills/**`의 `bun:test` 트리 포함)를 스캔한다. Plan 01-02의 deferred-items.md가 "실제 단위 시험을 처음 추가하는 계획이 test.include를 좁혀야 한다"고 이미 기록해 둔 항목이며, 이 계획이 그 첫 계획이다.
- **Fix:** `vitest.config.ts`를 추가해 `test.include`를 `tests/unit/**/*.test.ts`로, `exclude`에 `.claude/**`·`node_modules/**`·`.output/**`·`tests/e2e/**`를 넣었다.
- **Files modified:** vitest.config.ts
- **Verification:** `pnpm test:unit` 실행 시 `tests/unit/tremor-filter.test.ts` 7 passed만 보고(저장소 전체 스캔 없음)
- **Committed in:** 13c4a70 (Task 1 RED)

**2. [Rule 4-adjacent, 계획 내부 모순 해석] 모드 표시 비키기 거리 60px→80px**
- **Found during:** Task 3 RED 작성
- **Issue:** Task 3의 `<behavior>` 목록 문구는 "60px 안으로"라고 적었지만, 같은 계획의 must_haves 최상위 truths("80px 안으로"), `<action>` 본문("80px 안에 들어오면"), `.planning/phases/01-click-helper-foundation/01-CONTEXT.md` D-26, `docs/design/SYSTEM.md`("모드 표시" 절)가 모두 일관되게 80px을 말한다. 사용자 결정이 필요한 새로운 트레이드오프가 아니라 같은 계획 안의 단순 오타로 판단했다.
- **Fix:** e2e 시험과 `PROXIMITY_PX` 상수 모두 80px로 작성·구현했다.
- **Files modified:** tests/e2e/input-filter.e2e.ts, src/page/overlay/mode-indicator.ts
- **Verification:** RED·GREEN 커밋 메시지에 근거를 남겼고, 관련 e2e가 80px 기준으로 통과
- **Committed in:** ef0d33e (RED), 187e0ad (GREEN)

---

**Total deviations:** 2 (Rule 2 - 단위 시험 스캔 범위 인프라 추가, 계획 내부 문구 모순의 해석 판단)
**Impact on plan:** vitest.config.ts는 다음 계획부터 `pnpm test:unit`을 정상적으로 만드는 인프라 추가로 범위를 벗어나지 않는다. 80px 판단은 같은 계획의 다수 근거(3곳)를 따른 것으로, 임의로 다른 값을 고른 것이 아니다.

## Issues Encountered

- `tests/e2e/skeleton.e2e.ts`(Plan 01-01)의 "이미 settings 값이 있으면 설치 처리가 덮어쓰지 않는다" 시험이 `input-filter.e2e.ts` 뒤에 이어 돌리면 간헐적으로 `Cannot read properties of undefined (reading 'sync')`로 실패했다(단독 실행 시 3 passed, 전체 스위트를 다시 돌리면 26 passed로 통과). 재시작(같은 user-data-dir로 close+relaunch)의 타이밍에 의존하는 기존 취약점으로 보이며 이 계획의 파일과 무관해 고치지 않았다.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-04 이후가 이어받을 것: `pipeline.onKey`/`onPress`에 실제 처리기 등록(자석 커서·번호표는 Plan 01-05~), `mode.ts`의 `isTypingTarget`/`currentMode`를 다른 오버레이 판정에 재사용 가능.
- iframe 안 입력칸·커서의 모드 반영은 Plan 01-07에서 다룬다(이 계획은 맨 위 프레임만).
- `pnpm test:unit`이 이제 정상 동작하므로 이후 계획은 단위 시험을 추가하기만 하면 된다.
- `tests/e2e/skeleton.e2e.ts` 재시작 시험의 간헐적 실패(위 Issues Encountered)는 이 계획 범위 밖이라 남겨 둔다.
- 블로커 없음.

## Self-Check: PASSED

- 모든 생성/수정 파일 확인(`[ -f ]`): `src/core/tremor-filter.ts`, `tests/unit/tremor-filter.test.ts`, `vitest.config.ts`, `src/page/input/pipeline.ts`, `src/page/input/mode.ts`, `src/page/overlay/mode-indicator.ts`, `src/entrypoints/content.ts`, `tests/practice-site/input.html`, `tests/e2e/input-filter.e2e.ts` — 전부 존재.
- 6개 커밋(`13c4a70` test, `782b367` feat, `0ed5005` test, `2298e67` feat, `ef0d33e` test, `187e0ad` feat) `git log --oneline`에서 확인.
- 이 세션에서 plan-level `<verification>` 3개를 새로 재실행: `pnpm exec vitest run tests/unit/tremor-filter.test.ts`(7 passed), `CI=true pnpm exec playwright test tests/e2e/input-filter.e2e.ts`(15 passed), `pnpm typecheck && pnpm lint`(둘 다 exit 0).
- acceptance_criteria 재확인: Task 1(`document|window|chrome.` grep 0, `createTremorFilter` export 존재, 7 passed) · Task 2(`isTrusted`·`capture: true`·`stopImmediatePropagation` 존재, `contenteditable` 존재, 8 passed) · Task 3(`isContentEditable`·`HTMLTextAreaElement` 존재, "입력 중"/"Esc로 도우미" 존재, hex 리터럴 0개, `--motion-appear` 사용, 15 passed) — 모두 통과.
- 전체 e2e 스위트(`tests/e2e/skeleton.e2e.ts`, `helper-toggle.e2e.ts`, `input-filter.e2e.ts`)를 함께 재실행해 26 passed 확인(회귀 없음 — skeleton.e2e.ts의 간헐적 실패는 위 Issues Encountered에 기록).

---
*Phase: 01-click-helper-foundation*
*Completed: 2026-09-23*
