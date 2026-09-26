---
phase: 01-click-helper-foundation
plan: 11
subsystem: input
tags: [drag-and-drop, state-machine, tdd, playwright, dom-events]

# Dependency graph
requires:
  - phase: 01-click-helper-foundation
    provides: 대신 누르기(press.ts)·자석 커서·스페이스바/번호표/머무르기 누르기 경로·모드 표시(mode-indicator.ts)·updateSettings 저장 op·popup createCard 팩토리 — Plan 01-01~01-10
provides:
  - "drag-two-press.ts: createDragTwoPress() — 순수 상태 기계. press({id, draggable}) → arm/pass/drop(sourceId·targetId)/cancel. cancel()은 끌기 시작 상태만 대기로 되돌린다"
  - "drag.ts: synthesizeDrag(source, target) — 하나의 DataTransfer로 dragstart→drag→dragenter→dragover(취소되었으면)→drop→dragend를 대신 보낸다"
  - "content.ts: pressOrDrag(id, el, fingerprint, danger) — 이 프레임의 모든 누르기 경로(자석 클릭·스페이스바·번호표·머무르기)가 공유하는 진입점. dragTwoPress 꺼짐/위험한 버튼이면 그냥 누르고, 켜져 있으면 상태 기계 결과에 따라 힌트를 보이거나 synthesizeDrag를 부른다"
  - "mode-indicator.ts: setHint(text) — 모드 표시 둘째 줄에 다음 행동 안내(끌기 시작 중 '놓을 곳을 누르세요 · Esc 취소')"
  - "popup/main.ts: 카드 '4 끌어서 놓기 두 번 누르기 켜기/끄기'(Digit4·Numpad4)"
affects: ["01-13 (이 사이트에서 끄기 — 카드 자리 2, 마지막 남은 popup 자리)"]

# Actuals (#2632)
actuals:
  tokens: 7900
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "끌어서 놓기 두 번 누르기 상태 기계(arm/pass/drop/cancel)는 순수 함수(drag-two-press.ts)로 만들고, 실제 DOM 이벤트 합성(drag.ts)·프레임별 누르기 경로 통합(content.ts)과 분리했다 — dwell-timer.ts·confirm-guard.ts와 같은 패턴"
    - "이 프레임 안의 모든 누르기 경로(자석 클릭·스페이스바·번호표 숫자·머무르기)를 pressOrDrag 하나의 진입점으로 모아 dragTwoPress 여부·위험한 버튼 여부를 한 곳에서만 판단한다"

key-files:
  created:
    - src/core/drag-two-press.ts
    - tests/unit/drag-two-press.test.ts
    - src/page/click/drag.ts
    - tests/practice-site/drag.html
    - tests/e2e/drag.e2e.ts
  modified:
    - src/entrypoints/content.ts
    - src/entrypoints/popup/main.ts
    - src/page/overlay/mode-indicator.ts

key-decisions:
  - "자석 클릭 경로(onPress)는 원래 '커서가 잡힌 요소 위면 원래 클릭을 그대로 통과'하지만(D-13, 호환성), dragTwoPress가 켜져 있고 대상이 끌 수 있거나 이미 끌기 시작 중이면 이 통과를 건너뛰고 pressOrDrag로 삼킨다 — 그렇지 않으면 요소 정중앙 클릭이 그냥 사이트의 원래 클릭이 되어 버려 두 번 누르기가 전혀 동작하지 않는다"
  - "끌기 두 번째 누름(놓을 곳)도 첫 번째와 같은 자석/스페이스바/번호표 경로로 잡혀야 하므로, 연습 사이트의 #drop을 role=button+cursor:pointer로 두어 collector 후보 조건(D-04)을 만족시켰다"
  - "도우미 전체가 꺼지면(applyEnabled(false)) 끌기 시작 상태도 취소하고 힌트를 지운다 — 안 그러면 다시 켰을 때 옛 끌기 시작 상태가 남아 다음 누름이 뜬금없이 drop이 된다(dwell-timer의 rAF 정지 버그와 같은 종류의 상태 누수를 미리 막음)"

patterns-established:
  - "누르기 경로가 늘어날 때(자석·스페이스바·번호표·머무르기 넷)는 pressOrDrag처럼 공통 진입점 함수로 모아 새 기능(끌기 두 번 누르기 등)을 한 곳에서만 분기한다"

requirements-completed: [FILT-04]

coverage:
  - id: D1
    description: "확장 아이콘 메뉴에서 '끌어서 놓기 두 번 누르기'를 켜면, 끌 수 있는 요소를 한 번 누르고 놓을 곳을 한 번 누르면 끌어서 놓기가 된다"
    requirement: "FILT-04"
    verification:
      - kind: unit
        ref: "tests/unit/drag-two-press.test.ts#대기 상태에서 끌 수 있는 대상을 누르면 arm이다"
        status: pass
      - kind: unit
        ref: "tests/unit/drag-two-press.test.ts#끌기 시작 상태에서 다른 대상을 누르면 drop(source·target)과 함께 대기로 돌아간다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/drag.e2e.ts#켠 뒤 A를 잡고 클릭하면 힌트가 뜨고, 이어서 놓을 곳을 누르면 A가 옮겨진다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/drag.e2e.ts#스페이스바로도 같은 두 번 누르기가 된다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/drag.e2e.ts#메뉴에서 \"4 끌어서 놓기 두 번 누르기 켜기\" 카드를 누르면 dragTwoPress가 켜지고 카드 글자가 바뀐다"
        status: pass
    human_judgment: false
  - id: D2
    description: "끌기 시작 뒤에는 모드 표시가 '놓을 곳을 누르세요 · Esc 취소'를 보여 준다"
    requirement: "FILT-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/drag.e2e.ts#켠 뒤 A를 잡고 클릭하면 힌트가 뜨고, 이어서 놓을 곳을 누르면 A가 옮겨진다"
        status: pass
    human_judgment: false
  - id: D3
    description: "끌기 시작 뒤 Esc를 누르거나 같은 요소를 다시 누르면 끌기가 취소된다"
    requirement: "FILT-04"
    verification:
      - kind: unit
        ref: "tests/unit/drag-two-press.test.ts#끌기 시작 상태에서 같은 대상을 다시 누르면 cancel이다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/drag.e2e.ts#A로 끌기 시작 뒤 Esc를 누르면 취소되어 놓을 곳을 눌러도 A가 옮겨지지 않는다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/drag.e2e.ts#A로 끌기 시작 뒤 A를 다시 누르면 취소된다"
        status: pass
    human_judgment: false
  - id: D4
    description: "기능이 꺼져 있으면 끌 수 있는 요소를 눌러도 보통 클릭이다"
    requirement: "FILT-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/drag.e2e.ts#기본 설정에서 A를 잡고 클릭하면 보통 클릭이고 놓을 곳은 그대로다"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-23
status: complete
---

# Phase 1 Plan 11: 끌어서 놓기 두 번 누르기(상태 기계·힌트·연습 사이트) Summary

**순수 상태 기계(createDragTwoPress)로 끌기 시작→놓을 곳 누르기를 판정하고, 하나의 DataTransfer로 실제 HTML 끌기 이벤트 순서(dragstart→dragover→drop→dragend)를 합성하며(synthesizeDrag), 이 프레임의 모든 누르기 경로(자석·스페이스바·번호표·머무르기)를 pressOrDrag 하나로 모아 위험한 버튼은 제외한다.**

## Performance

- **Duration:** 약 25분(직전 계획 완료~마지막 GREEN 커밋 기준)
- **Started:** 2026-09-23T21:48:22Z
- **Completed:** 2026-09-23T22:13:21Z
- **Tasks:** 2
- **Files modified:** 8 (신규 5 + 수정 3)

## Accomplishments
- `drag-two-press.ts`(순수 함수, document·window·chrome 참조 없음): `createDragTwoPress()` → `press({id, draggable})`가 대기 상태에서 끌 수 있는 대상은 `arm`, 못 끄는 대상은 `pass`, 끌기 시작 상태에서 다른 대상은 `drop`(sourceId·targetId)과 함께 대기로, 같은 대상은 `cancel`을 돌려준다. `cancel()`(Esc)은 끌기 시작 상태만 대기로 되돌린다. 단위 시험 5개로 규칙을 고정했다.
- `drag.ts`: `synthesizeDrag(source, target)` — 하나의 `DataTransfer`로 source에 `dragstart`→`drag`, target에 `dragenter`→`dragover`(사이트가 preventDefault로 받아들이면)→`drop`, source에 `dragend`를 차례로 보낸다. 좌표는 각 요소 가운데, 모두 `bubbles/cancelable/composed: true`. 사이트 자신의 dragstart(dataTransfer.setData)·dragover(preventDefault)·drop 처리기가 그대로 받는다(T-01-31, 도우미는 dataTransfer에 아무 데이터도 넣지 않는다).
- `content.ts`: `pressOrDrag(id, el, fingerprint, danger)`를 새 진입점으로 두고, 자석 클릭(onPress)·스페이스바(onKey)·번호표 로컬 누름(pressHintEntry)·번호표 원격 누름(press/request)·머무르기 발사(dwellTick) 다섯 곳 모두가 이 함수를 거치게 했다. `dragTwoPress`가 꺼져 있거나 위험한 버튼이면 그냥 누르고(T-01-32), 켜져 있으면 상태 기계 결과에 따라 `setHint`로 안내하거나 `synthesizeDrag`를 부른다. 자석 클릭 경로는 커서가 요소 위(원래는 원래 클릭 통과)라도 dragTwoPress 대상이면 삼키도록 조건을 추가했다. Esc(keymap.cancel)는 끌기 시작 상태일 때만 도우미가 삼켜 취소한다. 도우미 전체 꺼짐(applyEnabled(false))에서도 끌기 시작 상태를 취소한다.
- `mode-indicator.ts`: `setHint(text: string | null)` — 모드 표시를 두 줄 레이아웃(`__row`/`__drag-hint`)으로 바꿔 끌기 시작 중에는 둘째 줄에 "놓을 곳을 누르세요 · Esc 취소"(`--text-label`)를 보여 준다. 힌트가 없으면 기존과 같은 한 줄("도우미"/"입력 중 · Esc로 도우미") 렌더링을 유지한다.
- `popup/main.ts`: 카드 "4 끌어서 놓기 두 번 누르기 켜기"/"끄기"(키 `Digit4`·`Numpad4`)를 `createCard` 팩토리로 추가했다.
- `tests/practice-site/drag.html`: 끌 수 있는 항목 A·B·C(각 클릭 카운터)와 놓을 곳 `#drop`(role=button, D-28).

## Task Commits

Each task followed RED → GREEN (TDD):

1. **Task 1: 두 번 누르기 끌기 상태 기계(순수 함수)**
   - `86a5da3` test(01-11): 끌어서 놓기 두 번 누르기 상태 기계 실패 단위 시험 5개(RED)
   - `18d4840` feat(01-11): 끌어서 놓기 두 번 누르기 상태 기계(createDragTwoPress) GREEN
2. **Task 2: 대신 끌어서 놓기·메뉴 카드·모드 표시 안내**
   - `d90a05f` test(01-11): 끌어서 놓기 두 번 누르기 실패 e2e 6개(RED)
   - `9d0e7e9` feat(01-11): 끌어서 놓기 두 번 누르기·메뉴 카드·모드 표시 안내 GREEN

**Plan metadata:** (이 커밋 직후 기록)

_Note: TDD 작업이라 RED → GREEN 커밋이 각 Task마다 있다._

## Files Created/Modified
- `src/core/drag-two-press.ts` - `createDragTwoPress`: 순수 상태 기계, `press`/`cancel`/`armed`
- `tests/unit/drag-two-press.test.ts` - behavior 5개(arm, pass, drop, cancel(재누름), cancel()(Esc))
- `src/page/click/drag.ts` - `synthesizeDrag`: DataTransfer 하나로 HTML 끌기 이벤트 순서 합성
- `tests/practice-site/drag.html` - 끌 수 있는 A·B·C, 놓을 곳 `#drop`
- `tests/e2e/drag.e2e.ts` - e2e 6개(`CI=true` 프로덕션 빌드로 검증)
- `src/entrypoints/content.ts` - `pressOrDrag`/`isDraggableElement`, 다섯 누르기 경로 통합, Esc 취소, applyEnabled(false) 정리
- `src/entrypoints/popup/main.ts` - "4 끌어서 놓기 두 번 누르기" 카드
- `src/page/overlay/mode-indicator.ts` - `setHint`, 두 줄 레이아웃(`__row`/`__drag-hint`)

## Decisions Made
- **자석 클릭의 '요소 위 통과' 예외를 dragTwoPress 대상에는 적용하지 않는다:** D-13이 정한 "커서가 잡힌 요소 위면 원래 클릭 그대로"는 호환성을 위한 규칙인데, 끌 수 있는 요소이거나 이미 끌기 시작 중이면 이 통과를 그대로 두면 두 번 누르기가 전혀 작동하지 않는다(정중앙 클릭이 그냥 사이트 클릭이 됨). `needsDragIntercept` 조건으로 이 경우만 예외 처리했다.
- **연습 사이트 `#drop`을 `role="button"`(+ `cursor: pointer`)으로 만든다:** 두 번째 누름(놓을 곳)도 자석/스페이스바/번호표 등 기존 누르기 경로로 잡혀야 하는데, collector는 `div`를 `cursor: pointer`가 계산되어야만 후보로 본다(D-04) — 실제 사이트의 드롭 존은 흔히 role/버튼류 요소이므로 이 방식이 현실적이다.
- **도우미 전체 꺼짐에서 끌기 시작 상태도 정리한다:** 테두리·번호표·머무르기 진행을 지우는 기존 패턴에 `dragTwoPress.cancel()`/`setHint(null)`을 추가했다(dwell-timer의 상태 누수 버그, Plan 01-10에서 겪은 것과 같은 종류의 문제를 사전에 막음).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 스페이스바·같은 자리 재클릭 두 번 누르기 e2e가 떨림 필터에 걸려 실패**
- **Found during:** Task 2 GREEN 첫 실행(`CI=true` e2e "스페이스바로도 같은 두 번 누르기가 된다"·"A로 끌기 시작 뒤 A를 다시 누르면 취소된다" 실패 — 두 번째 누름이 `pressOrDrag`까지 전혀 도달하지 못함)
- **Issue:** 두 시험 모두 첫 누름과 둘째 누름 사이 간격이 tremorIntervalMs(기본 300ms)보다 짧았다. 떨림 필터(D-07)가 "같은 키(Space)" 또는 "같은 자리 클릭"의 짧은 간격 재입력을 의도적으로 걸러내는데(내가 만든 버그가 아니라 기존 필터의 정상 동작), 시험이 이를 고려하지 않고 즉시 두 번째 입력을 보냈다.
- **Fix:** 두 시험에 tremorIntervalMs를 넘기는 대기(`waitForTimeout(400)`, `tests/e2e/input-filter.e2e.ts`의 기존 400ms 관례를 따름)를 첫 누름과 둘째 누름 사이에 추가했다.
- **Files modified:** `tests/e2e/drag.e2e.ts`
- **Verification:** `CI=true pnpm exec playwright test tests/e2e/drag.e2e.ts` 6 passed(전체 e2e 102개 3회 연속 통과)
- **Committed in:** `9d0e7e9` (Task 2 GREEN 커밋, 테스트 파일이므로 구현과 같은 커밋)

**2. [Rule 1 - Bug] 연습 사이트 `#drop`이 collector 후보 조건을 만족하지 못해 두 번째 누름을 잡지 못함**
- **Found during:** Task 2 GREEN 첫 실행(힌트는 뜨지만 놓을 곳을 눌러도 `pressOrDrag`가 전혀 호출되지 않음)
- **Issue:** `#drop`이 평범한 `div`였는데, collector는 NAMED_SELECTOR에 걸리지 않는 `div`는 계산된 `cursor: pointer`가 있어야만 후보로 본다(D-04). `#drop`에 그런 스타일이 없어 자석이 전혀 잡지 못했다.
- **Fix:** `#drop`에 `role="button" tabindex="0"`(NAMED_SELECTOR 매치)과 `cursor: pointer`(`.item` 클래스)를 추가했다.
- **Files modified:** `tests/practice-site/drag.html`
- **Verification:** `CI=true pnpm exec playwright test tests/e2e/drag.e2e.ts` 6 passed
- **Committed in:** `9d0e7e9` (Task 2 GREEN 커밋)

---

**Total deviations:** 2 auto-fixed (모두 Rule 1, 시험 자체의 결함 — 구현 동작은 계획·설계(D-04, D-07) 그대로)
**Impact on plan:** 계획 범위·최종 동작에 영향 없음. 두 결함 모두 시험이 기존 떨림 필터·collector 규칙을 고려하지 않아 생겼고, 실제 구현은 처음부터 규칙대로 동작했다.

## Issues Encountered
None — 위 Deviations 항목 2개를 제외하면 TDD 사이클(RED 확인 → GREEN)이 각 Task에서 의도한 이유로 통과했다. 전체 e2e 스위트(102개)를 연속 3회 돌려 간헐 실패가 없음을 확인했다(learned_after_01_04·01_05 lessons 반영).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FILT-04(끌어서 놓기 두 번 누르기)가 완성됐다.
- popup 메뉴 카드 자리: 1 도우미 끄기 · 3 머무르기 클릭 · 4 끌어서 놓기 두 번 누르기 — 2(이 사이트에서 끄기, Plan 01-13)만 남았다.
- 블로커 없음.

---
*Phase: 01-click-helper-foundation*
*Completed: 2026-09-23*

## Self-Check: PASSED

All 8 files listed in Files Created/Modified verified present on disk (plus this SUMMARY.md). All 4 task commit hashes (86a5da3, 18d4840, d90a05f, 9d0e7e9) verified present in git history.
