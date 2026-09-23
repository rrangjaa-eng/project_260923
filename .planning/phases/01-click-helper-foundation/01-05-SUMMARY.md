---
phase: 01-click-helper-foundation
plan: 05
subsystem: click-helper
tags: [synthetic-events, pointer-events, input-pipeline, keyboard, playwright, vitest]

# Dependency graph
requires:
  - phase: 01-click-helper-foundation (Plan 04)
    provides: "src/entrypoints/content.ts(collector·grid·magnet 배선, currentTargetId), src/page/input/pipeline.ts(onKey/onPress 등록 인터페이스), tests/practice-site/targets.html"
provides:
  - "src/page/click/press.ts: synthesizePress(el) — 요소 가운데 좌표로 pointerover→pointerenter→mouseover→pointerdown→mousedown→focus→pointerup→mouseup→click 순서로 dispatch(D-13), isTrusted:false"
  - "src/page/input/pipeline.ts: keypress 삼킴 추가, PressHandler가 boolean 또는 실행 함수를 돌려줄 수 있는 2단계(pointerdown 결정→click 실행) 구조로 확장(D-17)"
  - "src/entrypoints/content.ts: inputPipeline.onPress/onKey에 실제 처리기 등록 — 잡힌 요소 밖 클릭은 대신 누르기, 안이면 원래 클릭 통과, 스페이스바는 잡힌 것 있을 때만 대신 누르기"
  - "tests/practice-site/shortcuts.html: window capture keydown + document keypress/keyup으로 스페이스바·숫자를 쓰는 연습 페이지(D-28, 설계 11장 ④)"
  - "tests/practice-site/targets.html: 대신 누르기 시험용 카운터(#btn-tiny-count)·체크박스(#chk-space)·링크(#nav-link)·바탕 클릭 카운터(#bg-click-count) 추가"
affects: [01-06, 01-07, 01-08, 01-12]

actuals:
  tokens: 7207
  tasks: 2
  commits: 4
  plan_head_before: 3c50d41be7776a362026dfb8755f787419f33f5f

tech-stack:
  added: []
  patterns:
    - "대신 누르기(D-13, press.ts): 요소 사각형 가운데(화면 밖이면 안쪽으로 클리핑)로 마우스·포인터·포커스·클릭 이벤트를 순서대로 dispatch한다. mousedown이 preventDefault되면 초점을 옮기지 않는다. 모든 이벤트는 생성자 기본값대로 isTrusted:false라 파이프라인이 되먹임으로 다시 처리하지 않는다"
    - "누름 묶음의 결정과 실행 분리(pipeline.ts PressHandler): pointerdown에서 처리기가 boolean(삼킴 여부)이나 함수(실행 신호)를 돌려줄 수 있다. 함수를 돌려주면 pointerdown~click 전체를 삼키고, 실제 대신 누르기는 click 시점(뗌이 끝난 뒤)에 그 함수를 호출해 실행한다"
    - "keydown 처리기가 키를 쓰면(true 반환) 그 code를 swallowedKeyCodes에 넣어 뒤따르는 keypress·keyup도 삼킨다(D-17) — 사이트가 keydown 대신 keypress를 쓰는 경우까지 막는다"
    - "onPress 결정 시점의 currentTargetId 신선도 보장(content.ts): pointermove의 자석 재계산이 requestAnimationFrame으로 미뤄지는 기존 구조(Plan 01-04) 때문에, 누름 좌표로 onPress 안에서 evaluateMagnet()을 동기적으로 다시 불러 실제 누른 자리와 항상 맞춘다"

key-files:
  created:
    - src/page/click/press.ts
    - tests/unit/press.test.ts
    - tests/practice-site/shortcuts.html
    - tests/practice-site/next.html
    - tests/e2e/press.e2e.ts
  modified:
    - src/page/input/pipeline.ts
    - src/entrypoints/content.ts
    - tests/practice-site/targets.html

key-decisions:
  - "shortcuts.html은 keydown을 window capture 한 곳에만 등록하고(가장 공격적인 사이트 가정), document에는 keypress·keyup만 등록했다 — plan 텍스트가 나열한 'window keydown(capture)+document keydown+keypress+keyup' 넷을 문자 그대로 구현하면 도우미가 꺼진 시험에서 keydown이 window·document 두 리스너 모두에서 두 번 세어져(카운터 2) plan이 명시한 '카운터 1' 기대와 충돌한다. acceptance_criteria는 'addEventListener(\"keydown\"'과 capture true가 있다'만 요구해 이 설계로 충족한다. plan의 '가정(spec-less edge probe)' 문단이 CLICK-02·KEY-02를 unclassified로 두어 이 재량을 허용한다."
  - "onPress는 pointerdown 좌표로 evaluateMagnet()을 동기 재호출한다(Rule 1 버그 수정) — pointermove 재계산이 rAF로 미뤄지는 기존 구조에서, 이동 직후 곧바로 누르면 currentTargetId가 이전 자리 값이라 클릭 대상이 아닌 이전에 잡힌 요소가 대신 눌리는 경합을 CI=true 전체 e2e 스위트(input-filter.e2e.ts)에서 발견해 고쳤다."
  - "tests/practice-site/targets.html에 클릭 카운터·체크박스·링크·바탕 클릭 카운터를 추가했다 — 계획의 files_modified 프론트매터에는 없었지만 Task 2 behavior(30px 밖 클릭·체크박스 스페이스바·링크 이동)를 시험하려면 최소한의 고정물이 필요했다(Rule 3 성격의 필수 보강, 기존 요소의 위치·동작은 바꾸지 않았다)."

requirements-completed: [CLICK-02, KEY-02]

coverage:
  - id: D1
    description: "synthesizePress가 pointerover→pointerenter→mouseover→pointerdown→mousedown→focus→pointerup→mouseup→click 순서로 요소 가운데 좌표(화면 밖은 클리핑)에 이벤트를 보내고, mousedown이 preventDefault되면 초점을 옮기지 않으며, click은 bubbles/cancelable/composed:true, button:0, detail:1이다"
    requirement: CLICK-02
    verification:
      - kind: unit
        ref: "tests/unit/press.test.ts (6 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "12px 버튼을 30px 밖에서 잡고 클릭하면 버튼이 눌리고 바탕은 눌리지 않으며, 커서가 이미 버튼 위면 원래 클릭(isTrusted)이 그대로 간다"
    requirement: CLICK-02
    verification:
      - kind: e2e
        ref: "tests/e2e/press.e2e.ts#12×12px 버튼을 30px 밖에서 잡고 클릭하면 버튼이 눌리고 바탕은 눌리지 않는다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/press.e2e.ts#커서가 잡힌 버튼 위에 있을 때 클릭하면 버튼이 눌리고 원래 클릭(isTrusted)이 그대로 간다"
        status: pass
    human_judgment: false
  - id: D3
    description: "잡힌 상태에서 스페이스바를 누르면 버튼이 눌리고 페이지는 스크롤되지 않으며, 잡힌 것이 없을 때는 클릭이 커서 아래에 그대로 가고 스페이스바는 페이지를 스크롤한다"
    requirement: CLICK-02
    verification:
      - kind: e2e
        ref: "tests/e2e/press.e2e.ts#잡힌 상태에서 스페이스바를 누르면 버튼이 눌리고 페이지는 스크롤되지 않는다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/press.e2e.ts#잡힌 것이 없을 때는 클릭이 커서 아래 요소에 그대로 가고 스페이스바는 페이지를 스크롤한다"
        status: pass
    human_judgment: false
  - id: D4
    description: "체크박스를 잡고 스페이스바를 누르면 체크 상태가 바뀌고, 링크를 잡고(커서는 밖) 클릭하면 다음 페이지로 이동한다"
    requirement: CLICK-02
    verification:
      - kind: e2e
        ref: "tests/e2e/press.e2e.ts#체크박스를 잡고 스페이스바를 누르면 체크 상태가 바뀐다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/press.e2e.ts#링크를 잡고(커서는 밖) 클릭하면 다음 페이지로 이동한다"
        status: pass
    human_judgment: false
  - id: D5
    description: "사이트가 window capture keydown·keypress·keyup으로 스페이스바를 쓰는 shortcuts.html에서도 잡힌 버튼이 먼저 눌리고 사이트 단축키(keydown·keypress·keyup 전부)는 실행되지 않는다"
    requirement: KEY-02
    verification:
      - kind: e2e
        ref: "tests/e2e/press.e2e.ts#사이트가 window capture·keypress·keyup으로 스페이스바를 쓰는 shortcuts.html에서도 잡힌 버튼이 먼저 눌리고 사이트 단축키는 실행되지 않는다"
        status: pass
    human_judgment: false
  - id: D6
    description: "입력칸에 초점이 있으면 스페이스바가 원래대로 글자로 들어가고, 도우미를 끄면 같은 스페이스바가 사이트 단축키를 실행한다"
    requirement: KEY-02
    verification:
      - kind: e2e
        ref: "tests/e2e/press.e2e.ts#shortcuts.html의 입력칸에 초점이 있으면 스페이스바가 글자로 들어간다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/press.e2e.ts#도우미를 끄면 같은 스페이스바가 사이트 단축키를 실행한다"
        status: pass
    human_judgment: false
  - id: D7
    description: "버튼이 잡힌 상태에서 페이지가 만든 가짜(isTrusted=false) 스페이스바 keydown은 무시된다(T-01-13 스푸핑 방지)"
    verification:
      - kind: e2e
        ref: "tests/e2e/press.e2e.ts#버튼이 잡힌 상태에서 페이지가 만든 가짜(isTrusted=false) 스페이스바 keydown은 무시된다"
        status: pass
    human_judgment: false
  - id: D8
    description: "press.ts에 chrome.debugger·CDP 참조가 없다(D-13, T-01-14 권한 상승 방지)"
    verification:
      - kind: other
        ref: "grep -c chrome.debugger src/page/click/press.ts (0)"
        status: pass
    human_judgment: false
  - id: D9
    description: "CI=true 전체 e2e 스위트(45개)가 회귀 없이 통과한다(Plan 01-01~04 기능 유지)"
    verification:
      - kind: e2e
        ref: "CI=true pnpm exec playwright test (전체 45개, 5회 연속 0 failures)"
        status: pass
    human_judgment: false

duration: 26min
completed: 2026-09-23
status: complete
---

# Phase 1 Plan 5: 잡힌 요소 대신 누르기 Summary

**synthesizePress(포인터·마우스·포커스·클릭 순서)로 잡힌 요소를 커서 위치와 무관하게 클릭·스페이스바로 누르고, 파이프라인이 keypress·keyup까지 삼켜 window-capture·keypress·keyup을 쓰는 사이트 단축키보다 도우미 키가 항상 먼저 받도록 만들었다. Vitest 6개 + Playwright e2e 10개로 증명, 부수적으로 자석 재계산 지연 경합 버그를 CI 전체 스위트에서 발견해 수정.**

## Performance

- **Duration:** ~26 min
- **Started:** 2026-09-23T17:46:23Z
- **Completed:** 2026-09-23T18:12:05Z
- **Tasks:** 2 (각 tdd="true", RED→GREEN 두 커밋씩)
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments

- `src/page/click/press.ts`: `synthesizePress(el)` — 요소 가운데 좌표(화면 밖은 안쪽으로 클리핑)로 pointerover→pointerenter→mouseover→pointerdown→mousedown→focus({preventScroll:true})→pointerup→mouseup→click을 순서대로 dispatch. mousedown이 preventDefault되면 초점을 옮기지 않는다. click은 bubbles/cancelable/composed:true, button:0, detail:1
- `src/page/input/pipeline.ts`: keypress 리스너 추가(swallowedKeyCodes 기반 삼킴), keydown 처리기가 키를 쓰면 code를 swallowedKeyCodes에 등록. PressHandler가 `boolean | (() => void)`을 돌려줄 수 있게 확장 — pointerdown에서 함수를 돌려주면 그 누름 묶음을 삼키고 click 시점에 그 함수를 실행(누름·뗌이 끝난 뒤 누르기)
- `src/entrypoints/content.ts`: `inputPipeline.onPress`/`onKey`에 실제 처리기 등록 — 커서가 잡힌 요소 밖이면 click에서 synthesizePress, 안이면 원래 클릭 통과. 스페이스바(`keymap.press`)는 잡힌 것이 있을 때만 synthesizePress 후 삼키고, 없으면 통과(스크롤 등 원래 동작 유지)
- `tests/practice-site/shortcuts.html`: window capture keydown + document keypress/keyup으로 스페이스바·숫자(Digit1~9)를 자체 단축키로 쓰는 연습 페이지(D-28, 설계 11장 ④)
- `tests/practice-site/targets.html`: 대신 누르기 시험용 클릭 카운터(#btn-tiny-count, isTrusted 기록 포함)·체크박스(#chk-space)·링크(#nav-link)·바탕 클릭 카운터(#bg-click-count) 추가
- `tests/e2e/press.e2e.ts`: behavior 10개 — `CI=true pnpm exec playwright test tests/e2e/press.e2e.ts` 10 passed
- (Rule 1 버그 수정) `content.ts`의 onPress가 pointerdown 좌표로 evaluateMagnet()을 동기 재호출하도록 고쳐, 이동 직후 곧바로 누를 때 이전에 잡힌 요소가 대신 눌리는 경합을 해소

## Task Commits

각 Task RED→GREEN 두 커밋씩, 총 4개:

1. **Task 1 RED: 대신 누르기 이벤트 순서·좌표·초점·click 속성 실패 시험** - `12ba305` (test)
2. **Task 1 GREEN: synthesizePress 구현** - `e548fb7` (feat)
3. **Task 2 RED: 잡힌 요소 클릭·스페이스바 누르기, 사이트 단축키 우선순위 실패 시험** - `5f2c496` (test)
4. **Task 2 GREEN: 파이프라인·content.ts 배선 + 자석 재계산 경합 버그 수정** - `19ace10` (feat)

**Plan metadata:** (이 커밋 직후 별도 `docs(01-05): ...` 커밋으로 기록)

## Files Created/Modified

- `src/page/click/press.ts` - 대신 누르기(순서·좌표·초점·click 속성)
- `tests/unit/press.test.ts` - 단위 시험 6개
- `src/page/input/pipeline.ts` - keypress 삼킴, 누름 묶음 결정/실행 분리
- `src/entrypoints/content.ts` - onPress/onKey 처리기 배선, 자석 재계산 경합 수정
- `tests/practice-site/shortcuts.html` - 사이트 단축키 연습 사이트(신규)
- `tests/practice-site/next.html` - 링크 이동 목적지 고정물(신규)
- `tests/practice-site/targets.html` - 클릭 카운터·체크박스·링크·바탕 클릭 카운터 추가
- `tests/e2e/press.e2e.ts` - e2e 10개

## Decisions Made

frontmatter `key-decisions` 참고. 요약: shortcuts.html은 keydown을 window capture 한 곳에만 등록해 "도우미 꺼짐 시 카운터 1" 기대와 이중 계수 충돌을 피함, onPress는 pointerdown 좌표로 자석을 동기 재계산해 이동 직후 클릭의 경합을 없앰, targets.html에 최소 시험 고정물을 추가.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 버그] onPress의 currentTargetId가 이동 직후 클릭에서 이전 자리 값일 수 있었음**
- **Found during:** Task 2 GREEN 검증 — CI=true 전체 e2e 스위트(45개) 실행 중 `input-filter.e2e.ts`의 "40px 떨어진 두 버튼을 100ms 간격으로 클릭하면 각 카운터가 1이다" 시험이 `#count-a`가 기대값 '1' 대신 '2'로 실패
- **Issue:** `content.ts`의 자석 재계산(`evaluateMagnet`)은 `pointermove`마다 `requestAnimationFrame`으로 미뤄진다(Plan 01-04 기존 구조). B를 클릭하면 pointermove가 발생하지만, 같은 프레임 안에서 곧바로 `pointerdown`이 도착하면 `currentTargetId`가 아직 이전(A)일 수 있다. `onPress`가 이 오래된 `currentTargetId`를 그대로 읽어 커서가 B(A의 사각형 밖)에 있다고 판단해 "밖에서 잡음" 경로로 A를 대신 눌렀다 — B의 실제 클릭은 삼켜지고 A가 대신 눌려 `count-a`가 두 번(원래 클릭 1회 + 대신 누르기 1회) 올랐다
- **Fix:** `onPress` 처리기 맨 앞에서 실제 누름 좌표(`x, y`)로 `evaluateMagnet({x, y})`를 동기 호출해 `currentTargetId`를 그 자리 기준으로 즉시 다시 계산한 뒤 판단하도록 고쳤다. `evaluateMagnet`은 기존에 pointermove 경로에서도 쓰이던 함수라 새 로직을 추가하지 않고 재사용했다
- **Files modified:** src/entrypoints/content.ts
- **Verification:** `CI=true pnpm exec playwright test`(전체 45개)를 5회 연속 실행해 0 failures 확인(수정 전에는 이 시험이 재현 실패)
- **Committed in:** 19ace10 (Task 2 GREEN 커밋에 포함 — 구현 자체의 일부로 다뤄짐)

---

**Total deviations:** 1 (Rule 1 버그 수정)
**Impact on plan:** 이 계획이 새로 배선한 onPress 경로에서만 드러난 경합으로, 범위를 벗어나지 않는다. 회귀 없음을 전체 스위트 5회 연속 실행으로 확인했다.

## Issues Encountered

- Task 2 구현(pipeline.ts·content.ts) 코드를 먼저 작성했다가 TDD 순서(RED 먼저)를 스스로 어겼음을 알아차렸다. `git diff`로 변경분을 저장해 두고 `git checkout --`로 구현 전 상태로 되돌린 뒤, `shortcuts.html`·`next.html`·`targets.html` 추가·`press.e2e.ts`를 먼저 작성해 CI=true로 실제 RED(10개 중 5개 실패, 5개는 처리기가 없어도 원래 브라우저 동작이 같아 공허하게 통과 — Plan 01-04와 같은 패턴)를 확인한 뒤 저장해 둔 구현을 다시 적용해 RED→GREEN 순서를 정정했다. 시험 코드 자체는 구현을 보고 나서 고치지 않았다.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-06(번호표)이 이어받을 것: 번호 매기기도 이 계획의 `synthesizePress`를 재사용해 숫자 키로 요소를 누를 수 있다.
- `<select>`·파일 입력·새 창이 대신 누르기로 열리는지는 이 계획 범위가 아니다(Plan 01-12 스파이크에서 확인 예정, press.ts 주석에 명시).
- 위험한 버튼 예외(자석이 끌어당기지 않음·머무르기 비활성·번호표 재확인)는 이 계획에 넣지 않았다(Plan 01-08 예정).
- iframe 안 대신 누르기는 각 프레임이 독립적으로 계산하므로 구조상 이미 준비돼 있으나, 프레임 간 좌표 특유의 문제는 Plan 01-07에서 다룬다.
- 블로커 없음.

## Self-Check: PASSED

- 모든 생성/수정 파일 확인(`[ -f ]`): `src/page/click/press.ts`, `tests/unit/press.test.ts`, `src/page/input/pipeline.ts`, `src/entrypoints/content.ts`, `tests/practice-site/shortcuts.html`, `tests/practice-site/next.html`, `tests/practice-site/targets.html`, `tests/e2e/press.e2e.ts` — 전부 존재.
- 4개 커밋(`12ba305` test, `e548fb7` feat, `5f2c496` test, `19ace10` feat) `git log --oneline`에서 확인.
- 이 세션에서 plan-level `<verification>` 전부 새로 재실행: `pnpm exec vitest run tests/unit/press.test.ts`(6 passed), `CI=true pnpm exec playwright test tests/e2e/press.e2e.ts`(10 passed), `pnpm typecheck && pnpm lint`(둘 다 exit 0).
- acceptance_criteria 재확인: Task 1(`synthesizePress` export 존재, `chrome.debugger` grep 0, vitest 6 passed ≥ 5) · Task 2(`keypress` 처리 존재, `synthesizePress`·`keymap.press` 사용 존재, shortcuts.html에 `addEventListener('keydown'`과 capture `true` 존재, e2e 10 passed) — 모두 통과.
- 전체 e2e 스위트(45개)를 CI=true로 5회 연속 재실행해 0 failures 확인(회귀 없음, Rule 1 수정 이후 안정).

---
*Phase: 01-click-helper-foundation*
*Completed: 2026-09-23*
