---
phase: 01-click-helper-foundation
plan: 10
subsystem: input
tags: [dwell-click, state-machine, tdd, playwright, svg, zod, chrome-storage]

# Dependency graph
requires:
  - phase: 01-click-helper-foundation
    provides: 자석 커서·강조 테두리(ring.ts)·대신 누르기(press.ts)·설정 스키마(dwellEnabled/dwellMs)·popup 도우미 켜기/끄기 카드 — Plan 01-01~01-08
provides:
  - "dwell-timer.ts: createDwellTimer({ dwellMs }) — 순수 상태 기계. update({ targetId, danger, t }) → { progress, fire }. 같은 대상에 계속 머물러도 재발사하지 않고, null(떠남)을 거쳐 같은 대상으로 돌아오면 재무장. danger는 늘 progress 0"
  - "ring.ts: setDwellProgress(p) — 강조 테두리와 같은 박스 위에 겹치는 SVG(stroke-dasharray/dashoffset, data-progress), 매 update의 값으로 직접 그려 reducedMotion에서도 남는다"
  - "content.ts: dwellEnabled·잡힌 요소가 있는 동안만 rAF 루프로 timer.update → setDwellProgress, fire면 synthesizePress+recordPress. 잡힘이 풀리면 타이머에도 null을 알려 재무장(dwellTimer 상태 동기화)"
  - "messages.ts/storage-writer.ts/background.ts: storage/request op 'updateSettings'(patch: dwellEnabled?/dragTwoPress?, zod strict) — settings를 읽어 patch만 합친 뒤 SettingsV1로 재검사하고 쓴다"
  - "popup/main.ts: 카드 '3 머무르기 클릭 켜기/끄기'(Digit3·Numpad3), 카드 생성 로직을 createCard로 재사용 가능하게 뺌"
affects: ["01-11 (끌어서 놓기 두 번 누르기 — 같은 updateSettings op·popup 카드 자리 4 사용)", "01-13 (이 사이트에서 끄기 — 카드 자리 2)"]

# Actuals (#2632)
actuals:
  tokens: 8700
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "머무르기 진행·발사·재발사 막기 로직은 순수 함수(dwell-timer.ts)로 만들고 rAF 루프·SVG 렌더링(content.ts·ring.ts)과 분리했다 — 상태 로직이 단위 시험만으로 고정된다(confirm-guard.ts와 같은 패턴)"
    - "진행 표시(SVG stroke-dasharray/dashoffset)는 CSS transition 없이 매 프레임 값으로 직접 그린다 — prefers-reduced-motion에서도 시간 정보(SYSTEM.md)가 남는다"
    - "rAF 루프를 멈출 때도 타이머에는 반드시 targetId: null update를 한 번 먹여야 한다 — 그렇지 않으면 타이머 내부의 트래킹 상태가 옛 대상에 남아 같은 대상으로 돌아왔을 때 재무장되지 않는다(발견·수정, Rule 1)"
    - "popup 카드가 여러 개가 되면서 카드 생성 로직을 createCard(config) 팩토리로 추출 — 클릭·숫자 키·렌더를 한 곳에서 처리"

key-files:
  created:
    - src/core/dwell-timer.ts
    - tests/unit/dwell-timer.test.ts
    - tests/e2e/dwell.e2e.ts
  modified:
    - src/page/overlay/ring.ts
    - src/entrypoints/content.ts
    - src/entrypoints/popup/main.ts
    - src/shared/messages.ts
    - src/worker/storage-writer.ts
    - src/entrypoints/background.ts
    - tests/e2e/helper-toggle.e2e.ts

key-decisions:
  - "rAF 루프를 멈출 때(잡힘 풀림·도우미 꺼짐) dwellTimer.update({ targetId: null, ... })를 한 번 명시적으로 호출한다 — 루프 정지만으로는 타이머 내부 상태가 갱신되지 않아 재발사가 영영 막히는 버그가 있었다(재현·수정, Rule 1)"
  - "updateSettings의 patch는 dwellEnabled·dragTwoPress만 허용하는 zod strict 객체로 제한했다(T-01-28) — dwellMs 같은 값은 이 op로 바꾸지 않는다(수치 설정은 Plan 범위 밖, 시험은 기존 관례대로 SW에서 storage.sync.set 직접)"
  - "popup 카드가 2개가 되며 helper-toggle.e2e.ts의 모호했던 .card 선택자를 .first()로 좁혔다(Rule 1, 내 변경이 직접 일으킨 모호성)"

patterns-established:
  - "설정 변경은 일반화된 storage/request op 'updateSettings'로 — 이후 계획(01-11 dragTwoPress 등)도 patch에 키만 추가해 재사용한다"

requirements-completed: [CLICK-04, SAFE-01]

coverage:
  - id: D1
    description: "머무르기 클릭은 기본으로 꺼져 있고, 확장 아이콘 메뉴의 카드('3 머무르기 클릭 켜기/끄기')로 켜고 끈다"
    requirement: "CLICK-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/dwell.e2e.ts#기본 설정에서 잡힌 버튼 위에 1.5초 머물러도 카운터는 0이다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/dwell.e2e.ts#메뉴에서 \"3 머무르기 클릭 켜기\" 카드를 누르면 dwellEnabled가 켜지고 카드 글자가 바뀐다"
        status: pass
    human_judgment: false
  - id: D2
    description: "켜 두면 잡힌 요소 위에 커서가 설정 시간(기본 0.8초) 머물 때 테두리 둘레에 진행 표시가 차오른 뒤 눌린다 — dwellMs가 바뀌면 새 시간을 따르고, 움직임 줄이기에서도 진행 표시는 남는다"
    requirement: "CLICK-04"
    verification:
      - kind: unit
        ref: "tests/unit/dwell-timer.test.ts#새 대상이 잡히면 진행 0에서 시작하고, (t - 시작) / dwellMs로 오른다"
        status: pass
      - kind: unit
        ref: "tests/unit/dwell-timer.test.ts#진행이 1에 닿는 첫 update에서만 fire: true다"
        status: pass
      - kind: unit
        ref: "tests/unit/dwell-timer.test.ts#dwellMs를 바꾼 새 타이머는 새 시간으로 발사한다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/dwell.e2e.ts#켠 뒤 버튼을 잡고 머무르면 400ms 즈음 진행 표시가 0.3~0.7이고, 뒤이어 카운터가 1이 된다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/dwell.e2e.ts#SW에서 dwellMs를 400으로 바꾸면 600ms 안에 카운터가 1이 된다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/dwell.e2e.ts#reducedMotion에서도 진행 표시가 있고 채움이 linear로 진행한다"
        status: pass
    human_judgment: false
  - id: D3
    description: "그 전에 커서를 치우면(잡힘이 풀리거나 바뀌면) 취소되고 진행 표시가 사라진다"
    requirement: "CLICK-04"
    verification:
      - kind: unit
        ref: "tests/unit/dwell-timer.test.ts#1에 닿기 전에 대상이 null이나 다른 대상으로 바뀌면 진행이 0으로 돌아간다(취소)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/dwell.e2e.ts#500ms 머물고 커서를 멀리 치우면 카운터는 0이고 진행 표시가 사라진다"
        status: pass
    human_judgment: false
  - id: D4
    description: "한 번 누른 요소는 커서가 떠났다 돌아오기 전에는 다시 누르지 않는다 — 떠났다 돌아오면 다시 무장되어 한 번 더 눌린다"
    requirement: "CLICK-04"
    verification:
      - kind: unit
        ref: "tests/unit/dwell-timer.test.ts#발사한 대상에 계속 머물러도 다시 fire하지 않는다"
        status: pass
      - kind: unit
        ref: "tests/unit/dwell-timer.test.ts#대상이 null이 되었다가(떠남) 같은 대상으로 돌아오면 처음부터 다시 진행해 한 번 더 발사할 수 있다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/dwell.e2e.ts#발사 뒤 2초 더 머물러도 카운터는 1이고, 떠났다 돌아와 다시 머물면 카운터가 2가 된다"
        status: pass
    human_judgment: false
  - id: D5
    description: "위험한 버튼에서는 머무르기 클릭이 동작하지 않는다(진행도 발사도 없음)"
    requirement: "SAFE-01"
    verification:
      - kind: unit
        ref: "tests/unit/dwell-timer.test.ts#danger: true 대상은 진행이 늘 0이고 발사하지 않는다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/dwell.e2e.ts#danger.html에서 \"삭제\" 위에 정확히 커서를 두고 1.5초 머물러도 카운터는 0이고 진행 표시가 없다"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-09-23
status: complete
---

# Phase 1 Plan 10: 머무르기 클릭(진행 표시·재발사 막기·위험 버튼 예외) Summary

**순수 상태 기계(createDwellTimer)로 머무름 진행·한 번만 발사·떠났다 돌아오면 재무장을 판정하고, 강조 테두리와 겹치는 SVG 진행 표시(ring.ts setDwellProgress)와 메뉴 카드("3 머무르기 클릭")로 켜고 끄며, 위험한 버튼은 진행·발사 모두 제외된다.**

## Performance

- **Duration:** 약 22분(직전 계획 완료~마지막 GREEN 커밋 기준)
- **Started:** 2026-09-23T21:23:13Z
- **Completed:** 2026-09-23T21:45:32Z
- **Tasks:** 2
- **Files modified:** 10 (신규 3 + 수정 7)

## Accomplishments
- `dwell-timer.ts`(순수 함수, document·window·chrome 참조 없음): `createDwellTimer({ dwellMs })` → `update({ targetId, danger, t })`가 진행을 0→1로 올리고, 1에 닿는 첫 update에서만 `fire: true`. 같은 대상에 계속 머물러도 재발사하지 않지만 null(떠남)을 거쳐 같은 대상으로 돌아오면 다시 무장된다. danger 대상은 늘 진행 0. 단위 시험 7개로 규칙을 고정했다.
- `ring.ts`: `setDwellProgress(p)` — 강조 테두리(ringElement)와 같은 박스 위에 겹치는 SVG `<rect>`를 `stroke-dasharray`/`stroke-dashoffset`(두께 `--border-strong`, 색 `--accent`)로 매 호출 값 그대로 그린다. CSS transition을 쓰지 않아 `prefers-reduced-motion: reduce`에서도 진행이 그대로 보인다(SYSTEM.md "모션" — 시간 정보는 남긴다).
- `content.ts`: `dwellEnabled`이고 잡힌 요소가 있는 동안만 rAF 루프(`dwellTick`)를 돌려 `dwellTimer.update`를 부르고 결과를 `setDwellProgress`에, `fire`면 `synthesizePress`+`recordPress`. 잡힘이 풀리거나 도우미가 꺼지면 루프를 멈추되, 멈추기 전 타이머에 `targetId: null` update를 한 번 먹여 내부 상태를 재무장시킨다(아래 Deviations 참고).
- `messages.ts`/`storage-writer.ts`/`background.ts`: `storage/request`에 `updateSettings` op(`patch: { dwellEnabled?, dragTwoPress? }`, zod strict) 추가 — writer가 저장된 settings를 읽어 검사한 뒤 patch만 합쳐 `SettingsV1`로 재검사하고 통과할 때만 쓴다(D-24, D-25, T-01-28).
- `popup/main.ts`: 카드 "3 머무르기 클릭 켜기"/"끄기"(키 `Digit3`·`Numpad3`)를 추가하고, 카드 생성 로직을 `createCard(config)` 팩토리로 뽑아 기존 "1 도우미 끄기" 카드와 함께 재사용한다.

## Task Commits

Each task followed RED → GREEN (TDD):

1. **Task 1: 머무르기 상태 기계(순수 함수)**
   - `90f6d3c` test(01-10): 머무르기 상태 기계 실패 단위 시험 7개(RED)
   - `1629275` feat(01-10): 머무르기 상태 기계(createDwellTimer) GREEN
2. **Task 2: 머무르기 진행 표시·누르기·메뉴 카드로 켜고 끄기**
   - `ff8b490` test(01-10): 머무르기 진행 표시·누르기·메뉴 카드 켜고 끄기 실패 e2e 6개(RED)
   - `1ceadbe` feat(01-10): 머무르기 진행 표시·누르기·메뉴 카드 켜고 끄기 GREEN

**Plan metadata:** (이 커밋 직후 기록)

_Note: TDD 작업이라 RED → GREEN 커밋이 각 Task마다 있다._

## Files Created/Modified
- `src/core/dwell-timer.ts` - `createDwellTimer`: 순수 상태 기계, `update`
- `tests/unit/dwell-timer.test.ts` - behavior 7개(진행 상승, 첫 fire, 재발사 막기, 재무장, 취소, danger 예외, dwellMs 변경)
- `src/page/overlay/ring.ts` - `setDwellProgress(p)`: SVG 진행 표시(`data-progress`)
- `src/entrypoints/content.ts` - `dwellTick`/`syncDwellLoop`/`stopDwellLoopIfRunning`: rAF 루프, 타이머 재생성(dwellMs 변경 시)
- `src/entrypoints/popup/main.ts` - `createCard` 팩토리, "3 머무르기 클릭" 카드
- `src/shared/messages.ts` - `updateSettings` op(`UpdateSettingsPatch` 타입 export)
- `src/worker/storage-writer.ts` - `updateSettings(patch)`: 읽기→합치기→재검사→쓰기
- `src/entrypoints/background.ts` - `updateSettings` 라우팅
- `tests/e2e/dwell.e2e.ts` - e2e 8개(`CI=true` 프로덕션 빌드로 검증)
- `tests/e2e/helper-toggle.e2e.ts` - 카드가 2개가 되어 모호해진 `.card` 선택자를 `.first()`로 좁힘

## Decisions Made
- **rAF 루프 정지 시 타이머에 null update를 명시적으로 먹인다:** 처음 구현에서는 루프만 멈추고 타이머에는 아무것도 알리지 않아, 같은 요소를 떠났다 돌아왔을 때 내부 `trackedTargetId`가 옛 값 그대로 남아 재무장되지 않는 버그가 있었다(e2e "발사 뒤 2초... 떠났다 돌아와 다시 머물면 2"가 재현). `stopDwellLoopIfRunning`이 루프를 멈추기 전 `dwellTimer.update({ targetId: null, danger: false, t })`를 한 번 호출하도록 고쳤다.
- **updateSettings의 patch는 zod strict로 dwellEnabled·dragTwoPress만 허용:** dwellMs 같은 수치 설정은 이 계획 범위 밖(카드로 켜고 끄는 값만) — 시험은 기존 관례(danger.e2e.ts 등)대로 SW에서 `chrome.storage.sync.set`을 직접 써서 "다른 PC 동기화" 시나리오로 다룬다.
- **popup 카드 생성 로직을 createCard로 추출:** 카드가 2개가 되며 클릭·숫자 키·렌더 로직의 중복을 없앴다(카드가 늘어날 01-11·01-13에서도 재사용).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] rAF 루프 정지 시 타이머 상태가 갱신되지 않아 재발사가 막히는 버그**
- **Found during:** Task 2 GREEN 검증(`CI=true` e2e "발사 뒤 2초... 떠났다 돌아와 다시 머물면 2"가 1000ms 안에 통과하지 못함)
- **Issue:** `stopDwellLoopIfRunning`이 `dwellLoopActive`만 끄고 `dwellTimer`에는 아무것도 알리지 않아, 커서가 떠났다 같은 요소로 돌아와도 타이머 내부 `trackedTargetId`가 그대로라 "새 대상"으로 인식되지 않고 `fired` 플래그가 계속 남아 있었다.
- **Fix:** 루프를 멈추기 전 `dwellTimer.update({ targetId: null, danger: false, t: performance.now() })`를 한 번 호출해 타이머가 "잡힘이 풀렸다"를 알게 했다.
- **Files modified:** `src/entrypoints/content.ts`
- **Verification:** `CI=true pnpm exec playwright test tests/e2e/dwell.e2e.ts` 8 passed(전체 e2e 96개 3회 연속 통과)
- **Committed in:** `1ceadbe` (Task 2 GREEN 커밋)

**2. [Rule 1 - Bug] 새 e2e의 patchSettings 호출 순서(goto 전)가 초기 settings 쓰기와 경합**
- **Found during:** Task 2 GREEN 첫 실행(`Cannot read properties of undefined (reading 'data')`)
- **Issue:** 새 컨텍스트마다 `onInstalled`가 비동기로 기본 설정을 쓰는데, 내 e2e 일부가 `page.goto` 전에 `patchSettings`를 불러 그 쓰기가 끝나기 전에 읽어 실패했다. 기존 관례(magnet.e2e.ts·press.e2e.ts 등)는 항상 `goto` 뒤에 `patchSettings`를 부른다.
- **Fix:** 해당 5개 테스트의 `patchSettings` 호출을 `page.goto` 뒤로 옮겼다(단언 내용은 그대로).
- **Files modified:** `tests/e2e/dwell.e2e.ts`
- **Verification:** `CI=true pnpm exec playwright test tests/e2e/dwell.e2e.ts` 8 passed
- **Committed in:** `1ceadbe` (Task 2 GREEN 커밋, 테스트 파일이므로 구현과 같은 커밋)

**3. [Rule 1 - Bug] 카드가 2개가 되며 helper-toggle.e2e.ts의 `.card` 선택자가 모호해짐**
- **Found during:** 전체 e2e 회귀 확인 전 코드 리뷰(카드 2개 추가 직후)
- **Issue:** `popup.locator('.card')`가 이제 카드 2개에 매치되어 `.click()`·`.boundingBox()` 호출이 Playwright strict mode 위반을 낼 상황이었다(카드 1은 항상 "도우미 끄기/켜기" 카드를 가리키려는 의도).
- **Fix:** 4곳의 `.card` 사용을 `.card.first()`로 좁혔다.
- **Files modified:** `tests/e2e/helper-toggle.e2e.ts`
- **Verification:** `CI=true pnpm exec playwright test tests/e2e/helper-toggle.e2e.ts`(전체 e2e 96개 통과에 포함)
- **Committed in:** `1ceadbe` (Task 2 GREEN 커밋)

---

**Total deviations:** 3 auto-fixed (모두 Rule 1, 버그)
**Impact on plan:** 계획 범위·동작에 영향 없음 — 구현·시험 자체의 결함을 고친 것으로 최종 동작은 계획 그대로다.

## Issues Encountered
None — 위 Deviations 항목 3개를 제외하면 TDD 사이클(RED 확인 → GREEN)이 각 Task에서 의도한 이유로 통과했다. 전체 e2e 스위트(96개)를 연속 3회 돌려 간헐 실패가 없음을 확인했다(learned_after_01_04·01_05 lessons 반영).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CLICK-04(머무르기 클릭)·SAFE-01의 머무르기 예외가 완성됐다.
- popup 메뉴 카드 자리: 1 도우미 끄기 · 3 머무르기 클릭 — 2(이 사이트에서 끄기, Plan 01-13)·4(끌어서 놓기 두 번 누르기, Plan 01-11)는 아직 비어 있다. `createCard` 팩토리와 `updateSettings` op를 그대로 재사용할 수 있다.
- 블로커 없음.

---
*Phase: 01-click-helper-foundation*
*Completed: 2026-09-23*

## Self-Check: PASSED

All 10 files listed in Files Created/Modified verified present on disk (plus this SUMMARY.md). All 4 task commit hashes (90f6d3c, 1629275, ff8b490, 1ceadbe) verified present in git history.
