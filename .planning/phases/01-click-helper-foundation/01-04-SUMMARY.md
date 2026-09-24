---
phase: 01-click-helper-foundation
plan: 04
subsystem: click-helper
tags: [spatial-index, magnet-cursor, mutation-observer, requestAnimationFrame, shadow-dom, playwright, vitest]

# Dependency graph
requires:
  - phase: 01-click-helper-foundation (Plan 03)
    provides: "src/entrypoints/content.ts(설정 상태·pipeline 등록), src/page/overlay/mode-indicator.ts(ensureOverlayRoot 공유 shadow root), tests/e2e/fixtures.ts"
provides:
  - "src/core/grid-index.ts: createGridIndex — 격자 공간 색인(순수 함수), rectDistance export"
  - "src/core/magnet.ts: pickTarget — 잡는 범위·히스테리시스 판단(순수 함수)"
  - "src/page/collector/collector.ts: createCollector — 프레임 안 누를 수 있는 요소 수집(items/get/onChange), MutationObserver+scroll+resize를 rAF로 코얼레싱"
  - "src/page/overlay/ring.ts: showRing/hideRing — SYSTEM.md 강조 테두리(shadow root 공유)"
  - "src/entrypoints/content.ts: 프레임마다 collector+grid+magnet 배선, pointermove는 rAF 코얼레싱(타임스탬프 스로틀 아님)"
  - "tests/practice-site/targets.html: 자석 커서 연습 사이트(아주 작은 버튼·이미지 링크·onclick 이미지·role=button·숨긴 요소·늦게 나타나는 입력칸·스크롤용 긴 페이지·입력칸 20개)"
affects: [01-05, 01-06, 01-07, 01-08, 01-16]

actuals:
  tokens: 9627
  tasks: 2
  commits: 4
  plan_head_before: f03573a28be78edb3fc3fe548b2174aaf188410f

tech-stack:
  added: []
  patterns:
    - "격자 공간 색인(D-04, Pattern: createGridIndex): 사각형이 걸치는 모든 칸에 넣고, 조회는 점±반경이 걸치는 칸만 본 뒤 점-사각형 거리로 거른다 — document·window·chrome 참조 없는 순수 함수"
    - "자석 잡기 판단(D-10, Pattern: pickTarget): 잡는 범위 안 최근접 요소를 고르되(동률이면 작은 면적 우선), 현재 잡힌 요소가 있으면 switchHysteresisPx를 초과해 더 가까운 후보가 나와야만 바꾼다 — 순수 함수"
    - "rAF 코얼레싱(Pattern, collector.ts에서 확립·content.ts가 재사용): MutationObserver·scroll·resize 또는 pointermove처럼 빈번한 신호는 개별 처리하지 않고 requestAnimationFrame 하나로 모아 프레임당 최대 한 번만 계산한다. 타임스탬프 기준 '간격 안이면 버림' 방식의 스로틀은 간격 안에 여러 이벤트가 몰리면 마지막 자리를 영영 놓칠 수 있어(재현 확인, 아래 이슈 참고) 쓰지 않는다"
    - "요소 판정 두 갈래(collector.ts): 태그·속성만으로 항상 후보인 목록(NAMED_SELECTOR: button·a[href]·input·select·textarea·summary·role 값들·onclick·tabindex)과, 그 외 img·svg·div·span 중 계산된 cursor:pointer일 때만 후보인 목록(CURSOR_TAGS)을 분리 — role=button div가 cursor:pointer 없이도 잡히고, 순수 커서 스타일만 있는 img가 role 없이도 잡힌다"
    - "오버레이 shadow root 공유(D-26): ring.ts가 mode-indicator.ts의 ensureOverlayRoot()를 그대로 쓰고, 자기 <style>·<div data-part=\"ring\">을 독립적으로 추가하며 host 제거(도우미 꺼짐) 뒤에는 isConnected로 재생성 여부를 판단한다"

key-files:
  created:
    - src/core/grid-index.ts
    - src/core/magnet.ts
    - tests/unit/grid-index.test.ts
    - tests/unit/magnet.test.ts
    - src/page/collector/collector.ts
    - src/page/overlay/ring.ts
    - tests/practice-site/targets.html
    - tests/e2e/magnet.e2e.ts
  modified:
    - src/entrypoints/content.ts
    - tests/e2e/skeleton.e2e.ts
    - tests/e2e/fixtures.ts

key-decisions:
  - "collector.ts의 요소 판정은 NAMED_SELECTOR(항상 후보)와 CURSOR_TAGS(cursor:pointer 필요)를 분리했다 — 하나의 selector 문자열로 img·svg·div·span까지 한꺼번에 querySelectorAll한 뒤, NAMED_SELECTOR에 이미 걸리는 요소(예: role=button div)는 cursor 검사 없이 통과시키고, 그렇지 않은 나머지만 cursor:pointer를 요구한다. 이렇게 나누지 않으면 role=button div가 cursor:pointer 없을 때 잘못 걸러졌을 것이다."
  - "ring.ts는 --ring-offset 값을 8로 하드코딩하지 않고 실제 요소의 계산된 스타일에서 읽는다 — 테두리 오프셋 산수(JS)가 토큰(docs/design/tokens.css)과 항상 같은 값을 쓰게 하기 위함."
  - "content.ts의 자석 pointermove 처리는 처음엔 pipeline.ts와 같은 '타임스탬프 간격 안이면 버림' 60Hz 스로틀로 짰으나, 히스테리시스 e2e 시험이 간헐적으로(전체 스위트 기준 약 40%) 실패해 systematic-debugging으로 원인을 추적한 결과 스로틀 간격 안에 두 pointermove가 몰리면 마지막 자리가 영영 계산되지 않고 버려지는 실제 버그였다(1000Hz 마우스나 빠른 프로그램 조작에서 재현 가능 — 사용자 시나리오상 떨림으로 인한 빠른 연속 이동에서도 발생할 수 있음). collector.ts가 이미 쓰던 requestAnimationFrame 코얼레싱으로 바꿔 마지막 커서 위치가 항상 다음 프레임에 반영되게 고쳤다(Rule 1 — 버그 수정, GREEN 커밋에 포함)."
  - "선행 조치(fix(01-01), 이 계획의 Task 커밋과 별개): tests/e2e/skeleton.e2e.ts의 재시작 보존 시험이 input-filter.e2e.ts 뒤에 이어 돌리면 간헐적으로 실패하던 문제를 systematic-debugging으로 재현·근본 원인 두 가지(1. Playwright가 service worker 대상을 알아채는 시점과 chrome.storage API 바인딩이 실제로 주입되는 시점 사이의 경쟁 — 40회 중 1회 재현, 2. 첫 설치 onInstalled의 비동기 기본값 쓰기와 시험의 직접 sentinel 쓰기 사이의 경쟁 — 40회 중 다수 재현)를 찾아 고쳤다. CI=true 전체 스위트를 50회 연속 실행해 회귀 없음을 확인했다."

requirements-completed: [ELEM-01, ELEM-03, CLICK-01]

coverage:
  - id: D1
    description: "격자 공간 색인이 같은 칸·칸 경계를 넘는 반경·반경 밖·빈 색인을 올바르게 처리하고, 5,000개 무작위 사각형에서 100개 점의 결과가 전수 검사와 같다(ELEM-01 기반)"
    requirement: ELEM-01
    verification:
      - kind: unit
        ref: "tests/unit/grid-index.test.ts (5 tests, incl. 5,000-rect brute-force comparison)"
        status: pass
    human_judgment: false
  - id: D2
    description: "자석 잡기 판단이 요소 안 거리 0, 잡는 범위 안/밖, 히스테리시스 유지/전환, 범위 이탈 시 놓기, 동률 시 작은 요소 우선을 모두 만족한다(CLICK-01)"
    requirement: CLICK-01
    verification:
      - kind: unit
        ref: "tests/unit/magnet.test.ts (7 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "커서가 아주 작은 버튼 근처(48px 안)로 대충 가면 버튼이 8px 바깥 5px 남색 테두리로 크게 강조된다"
    requirement: CLICK-01
    verification:
      - kind: e2e
        ref: "tests/e2e/magnet.e2e.ts#12×12px 버튼에서 30px 떨어진 곳에 커서를 두면 테두리가 8px 바깥에 5px 두께로 보인다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/magnet.e2e.ts#모든 요소에서 100px 넘게 떨어진 곳에서는 테두리가 없다"
        status: pass
    human_judgment: false
  - id: D4
    description: "잡힌 요소는 24px 미만 차이로는 바뀌지 않고, 24px 초과 더 가까운 후보가 나오면 바뀐다(히스테리시스)"
    requirement: CLICK-01
    verification:
      - kind: e2e
        ref: "tests/e2e/magnet.e2e.ts#버튼 A를 잡은 뒤 B가 10px 더 가까우면 A를 유지하고, 40px 더 가까우면 B로 바뀐다"
        status: pass
    human_judgment: false
  - id: D5
    description: "버튼·이미지 링크·onclick 이미지·role=button 요소가 잡히고, 숨긴 요소(display:none·visibility:hidden)는 잡히지 않는다(ELEM-01)"
    requirement: ELEM-01
    verification:
      - kind: e2e
        ref: "tests/e2e/magnet.e2e.ts#이미지 링크·onclick 이미지·role=button div가 각각 잡힌다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/magnet.e2e.ts#display:none·visibility:hidden 버튼 근처에서는 잡히지 않는다"
        status: pass
    human_judgment: false
  - id: D6
    description: "늦게 나타난 요소도 곧 잡히고, 스크롤하면 테두리가 요소의 새 위치를 따라가며, 요소가 사라지면 테두리도 없어진다(ELEM-03)"
    requirement: ELEM-03
    verification:
      - kind: e2e
        ref: "tests/e2e/magnet.e2e.ts#1초 뒤에 나타나는 입력칸 근처에 커서를 두면 나타난 뒤 곧 잡힌다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/magnet.e2e.ts#요소를 잡은 채 300px 스크롤하면 테두리가 새 위치를 따라간다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/magnet.e2e.ts#잡힌 요소를 페이지 스크립트가 지우면 곧 테두리가 없어진다"
        status: pass
    human_judgment: false
  - id: D7
    description: "도우미 전체 끄기 상태에서는 테두리가 나타나지 않는다"
    verification:
      - kind: e2e
        ref: "tests/e2e/magnet.e2e.ts#도우미 전체 끄기 상태에서는 테두리가 나타나지 않는다"
        status: pass
    human_judgment: false
  - id: D8
    description: "src/core/grid-index.ts·src/core/magnet.ts에 document·window·chrome 참조가 없다(순수 함수)"
    verification:
      - kind: other
        ref: "grep -cE \"\\b(document|window|chrome)\\.\" src/core/grid-index.ts src/core/magnet.ts (둘 다 0)"
        status: pass
    human_judgment: false
  - id: D9
    description: "skeleton.e2e.ts 재시작 보존 시험의 간헐적 실패(입력 순서 의존)가 근본 원인 두 가지 모두 해소됐다"
    verification:
      - kind: e2e
        ref: "CI=true pnpm exec playwright test (전체 35개, 20회 연속 0 failures)"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-09-23
status: complete
---

# Phase 1 Plan 4: 자석 커서 잡기 Summary

**격자 공간 색인(createGridIndex)과 히스테리시스 잡기 판단(pickTarget)을 순수 함수로 구현하고, 요소 수집기(MutationObserver+rAF 코얼레싱)와 강조 테두리(shadow DOM)로 배선해 CI=true Playwright e2e 9개 + Vitest 단위 시험 13개로 증명. 부수적으로 skeleton.e2e.ts의 간헐적 실패 두 가지 근본 원인도 해소.**

## Performance

- **Duration:** ~40 min (fix(01-01) 첫 커밋부터 GREEN 커밋까지)
- **Started:** 2026-09-23T16:58:58Z
- **Completed:** 2026-09-23T17:39:04Z
- **Tasks:** 2 (각 tdd="true", RED→GREEN 두 커밋씩) + 선행 fix 1개
- **Files modified:** 12 (9 created, 3 modified)

## Accomplishments

- `src/core/grid-index.ts`: `createGridIndex(cellPx=128)` — 사각형이 걸치는 모든 칸에 넣고, `nearby(point, radius)`는 점±반경이 걸치는 칸만 본 뒤 `rectDistance`로 걸러 중복 없이 돌려준다. 5,000개 무작위 사각형·100개 점 전수 검사 비교로 정확성 확인
- `src/core/magnet.ts`: `pickTarget()` — 잡는 범위(captureMarginPx) 안 최근접 요소를 고르되 동률이면 작은 면적 우선, 현재 잡힌 요소가 있으면 switchHysteresisPx 초과해 더 가까운 후보만 바꾼다
- `src/page/collector/collector.ts`: `createCollector()` — 프레임 안 누를 수 있는 요소(버튼·링크·입력칸·역할·onclick·tabindex·cursor:pointer 이미지/도형/div/span)를 모아 위치·이름·종류로 만든다. 숨김·비활성·화면 밖은 제외. MutationObserver+scroll+resize를 requestAnimationFrame 하나로 모아 재수집
- `src/page/overlay/ring.ts`: `showRing()`/`hideRing()` — mode-indicator.ts와 같은 shadow root에 8px 바깥 5px 남색 테두리 + 흰 후광, 80ms 이동 애니메이션(움직임 줄이기면 즉시)
- `src/entrypoints/content.ts`: 프레임마다 collector·grid·magnet을 배선. pointermove는 requestAnimationFrame 코얼레싱(마지막 커서 위치를 절대 놓치지 않음). 화면 변화 시 잡힌 요소를 따라가거나 놓고, 도우미 꺼짐 시 테두리를 지운다
- `tests/practice-site/targets.html`: 자석 커서 연습 사이트(D-28) — 아주 작은 버튼, 히스테리시스용 A·B, 이미지 링크, onclick 이미지, role=button div, 숨긴 버튼 둘, 지울 수 있는 버튼, 스크롤용 버튼(3배 높이 페이지), 늦게 나타나는 입력칸, 입력칸 20개
- `tests/e2e/magnet.e2e.ts`: behavior 9개 — `CI=true pnpm exec playwright test tests/e2e/magnet.e2e.ts` 9 passed
- (선행) `tests/e2e/skeleton.e2e.ts`, `tests/e2e/fixtures.ts`: 재시작 보존 시험의 간헐적 실패 근본 원인 두 가지 수정

## Task Commits

각 Task RED→GREEN 두 커밋씩, 선행 fix 포함 총 5개:

0. **선행: skeleton.e2e.ts 간헐적 실패 근본 원인 수정** - `f03573a` (fix, phase 01-01 scope)
1. **Task 1 RED: 격자 공간 색인·자석 잡기 판단 실패 시험 11개** - `3862080` (test)
2. **Task 1 GREEN: createGridIndex·pickTarget** - `af79258` (feat)
3. **Task 2 RED: 자석 커서 강조 테두리 실패 e2e 9개** - `eb08ccc` (test)
4. **Task 2 GREEN: 요소 수집기·강조 테두리·화면 변화 추적** - `c446850` (feat)

**Plan metadata:** (이 커밋 직후 별도 `docs(01-04): ...` 커밋으로 기록)

## Files Created/Modified

- `src/core/grid-index.ts` - 격자 공간 색인(순수 함수)
- `src/core/magnet.ts` - 자석 잡기 판단(순수 함수)
- `tests/unit/grid-index.test.ts` - 단위 시험 6개
- `tests/unit/magnet.test.ts` - 단위 시험 7개
- `src/page/collector/collector.ts` - 요소 수집기
- `src/page/overlay/ring.ts` - 강조 테두리 오버레이
- `src/entrypoints/content.ts` - collector·grid·magnet 배선
- `tests/practice-site/targets.html` - 자석 커서 연습 사이트(신규)
- `tests/e2e/magnet.e2e.ts` - e2e 9개
- `tests/e2e/skeleton.e2e.ts` - (선행 fix) service worker API 바인딩 대기, sentinel 쓰기 전 기본값 대기
- `tests/e2e/fixtures.ts` - (선행 fix) serviceWorker 픽스처에 같은 API 바인딩 대기 추가

## Decisions Made

frontmatter `key-decisions` 참고. 요약: collector.ts는 "항상 후보"와 "cursor:pointer 필요" 목록을 분리해 role=button div가 잘못 걸러지지 않게 함, ring.ts는 오프셋 값을 하드코딩하지 않고 계산된 스타일에서 읽음, content.ts의 자석 pointermove는 타임스탬프 스로틀 대신 rAF 코얼레싱으로 바꿔 실제 버그(마지막 커서 위치가 간헐적으로 영영 버려짐)를 고침, 선행 조치로 skeleton.e2e.ts의 두 가지 근본 원인을 고침.

## Deviations from Plan

### Auto-fixed Issues

**1. [사용자 지시에 따른 선행 조치] skeleton.e2e.ts 재시작 보존 시험 간헐적 실패 수정**
- **Found during:** Task 1 착수 전(objective의 명시적 선행 지시)
- **Issue:** `tests/e2e/skeleton.e2e.ts`의 "이미 settings 값이 있으면 설치 처리가 덮어쓰지 않는다" 시험이 `input-filter.e2e.ts` 뒤에 이어 돌리면 `Cannot read properties of undefined (reading 'sync')`로 간헐적으로 실패했다. systematic-debugging으로 재현한 결과 두 가지 독립된 경쟁 상태였다: (1) `launchExtension()`/`serviceWorker` 픽스처가 Playwright의 service worker 대상 발견과 `chrome.storage` API 바인딩 주입 사이의 짧은 틈을 놓침(40회 중 1회 재현), (2) fresh userDataDir의 첫 launchExtension() 자체가 최초 설치라 background의 `onInstalled → ensureDefaultSettings()`(비동기 get→set)가 이미 돌고 있어, 시험의 직접 sentinel 쓰기와 경쟁해 기본값이 sentinel을 덮어씀(더 자주 재현).
- **Fix:** `launchExtension()`과 `fixtures.ts`의 `serviceWorker` 픽스처에 `chrome.storage`가 실제로 바인딩될 때까지 기다리는 `expect.poll`을 추가했고, sentinel 시험은 기본값이 먼저 나타나길 기다린 뒤에 덮어쓰도록 고쳤다.
- **Files modified:** tests/e2e/skeleton.e2e.ts, tests/e2e/fixtures.ts
- **Verification:** CI=true 전체 e2e 스위트를 50회 연속 실행해 0 failures(수정 전에는 40회 중 여러 차례 재현)
- **Committed in:** f03573a (fix, Task 1 이전 별도 커밋)

**2. [Rule 1 - 버그] content.ts 자석 pointermove 스로틀이 마지막 커서 위치를 영영 놓칠 수 있었음**
- **Found during:** Task 2 GREEN 검증(히스테리시스 e2e가 전체 스위트 기준 약 40% 간헐적으로 실패)
- **Issue:** `event.timeStamp - lastMagnetMoveAt < interval`이면 무조건 버리는 60Hz 타임스탬프 스로틀은, 간격 안에 두 번째 pointermove가 들어오고 그 뒤로 추가 이동이 없으면 그 마지막 위치가 절대 계산되지 않는다. systematic-debugging으로 디버그 로그를 넣어 재현한 결과, Playwright의 연속 `mouse.move()` 호출이 정확히 이 조건에 걸려 세 번째 이동이 조용히 버려짐을 확인했다(1000Hz 마우스나 떨림으로 인한 빠른 연속 이동에서도 실사용자에게 재현될 수 있는 실제 결함).
- **Fix:** 타임스탬프 스로틀을 collector.ts가 이미 쓰던 requestAnimationFrame 코얼레싱으로 교체 — 매 pointermove마다 마지막 위치만 저장하고, 다음 애니메이션 프레임에 그 위치로 한 번만 계산한다. 위치를 영영 잃지 않는다.
- **Files modified:** src/entrypoints/content.ts
- **Verification:** 히스테리시스 e2e를 20회 연속 단독 실행 0 failures, 전체 e2e 스위트(35개) 20회 연속 CI=true 0 failures
- **Committed in:** c446850 (Task 2 GREEN 커밋에 포함 — 구현 자체의 일부로 다뤄짐)

---

**Total deviations:** 2 (1 선행 조치 지시 이행, 1 Rule 1 버그 수정)
**Impact on plan:** 둘 다 이 계획 또는 직전 계획의 e2e 안정성에 필요한 수정으로, 범위를 벗어나지 않는다.

## Issues Encountered

- 실행 중 TDD 순서를 스스로 어겨(Task 2의 collector.ts·ring.ts·content.ts 구현을 targets.html·magnet.e2e.ts보다 먼저 작성) 발견했다. 구현 파일을 임시로 빼고(collector.ts·ring.ts 이동, content.ts를 이전 커밋 상태로 되돌림) CI=true로 실제 RED(9개 중 6개가 "테두리가 나타나야 한다" 쪽에서 실패, 나머지 3개는 "테두리가 없어야 한다" 쪽이라 기능 없이도 공허하게 통과)를 확인한 뒤 구현을 복원해 RED→GREEN 순서를 정정했다. 시험 코드 자체는 구현을 보고 나서 고치지 않았다(먼저 설계해 둔 그대로 RED 확인에 썼다).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-05(누르기)가 이어받을 것: `pipeline.onPress`/`onKey`에 실제 처리기 등록, 잡힌 요소(`currentTargetId`)를 클릭·스페이스바로 누르기.
- `collector.get(id)`는 이번 계획에서 배선만 하고 아직 쓰이지 않는다(Plan 01-05부터 요소를 실제로 누를 때 사용).
- 위험한 버튼 예외는 magnet.ts에 이번 계획에서 넣지 않았다(Plan 01-08 예정, 코드에 주석으로 남김).
- 5,000요소 반응 시간(50ms) 측정은 Plan 01-16으로 미룬다(가정 문단에 명시된 대로).
- iframe 안 자석 커서는 각 프레임이 독립적으로 계산하므로(D-02) 구조상 이미 준비돼 있으나, iframe 좌표 특유의 문제는 Plan 01-07에서 다룬다.
- 블로커 없음.

## Self-Check: PASSED

- 모든 생성/수정 파일 확인(`[ -f ]`): `src/core/grid-index.ts`, `src/core/magnet.ts`, `tests/unit/grid-index.test.ts`, `tests/unit/magnet.test.ts`, `src/page/collector/collector.ts`, `src/page/overlay/ring.ts`, `src/entrypoints/content.ts`, `tests/practice-site/targets.html`, `tests/e2e/magnet.e2e.ts`, `tests/e2e/skeleton.e2e.ts`, `tests/e2e/fixtures.ts` — 전부 존재.
- 5개 커밋(`f03573a` fix, `3862080` test, `af79258` feat, `eb08ccc` test, `c446850` feat) `git log --oneline`에서 확인.
- 이 세션에서 plan-level `<verification>` 전부 새로 재실행: `pnpm exec vitest run tests/unit/grid-index.test.ts tests/unit/magnet.test.ts`(13 passed), `CI=true pnpm exec playwright test tests/e2e/magnet.e2e.ts`(9 passed), `pnpm typecheck && pnpm lint`(둘 다 exit 0), `pnpm test:unit`(전체 20 passed).
- acceptance_criteria 재확인: Task 1(`document|window|chrome.` grep 0, `createGridIndex`·`pickTarget` export 존재, 13 passed ≥ 10) · Task 2(`MutationObserver`·`requestAnimationFrame` 존재, `--ring-width`·`--ring-offset`·`--motion-ring` 존재·hex 리터럴/`box-shadow` 0개, `setTimeout` 존재, 9 passed) — 모두 통과.
- 전체 e2e 스위트(`helper-toggle.e2e.ts`, `input-filter.e2e.ts`, `magnet.e2e.ts`, `skeleton.e2e.ts`, 35개)를 CI=true로 20회 연속 재실행해 0 failures 확인(회귀 없음, 이전 간헐적 실패 두 건 모두 해소).

---
*Phase: 01-click-helper-foundation*
*Completed: 2026-09-23*
