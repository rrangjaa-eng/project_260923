---
phase: 01-click-helper-foundation
plan: 08
subsystem: safety
tags: [magnet, danger-words, overlay, tdd, playwright]

# Dependency graph
requires:
  - phase: 01-click-helper-foundation
    provides: 자석 커서 판단(magnet.ts)·강조 테두리(ring.ts)·요소 수집기(collector.ts)·번호표(content.ts) — Plan 01-01~01-06
provides:
  - "danger.ts: isDanger(name, words) — 이름·단어 공백을 지운 뒤 포함 여부로 위험한 버튼을 판별하는 순수 함수(D-18)"
  - "magnet.ts: pickTarget의 danger 예외 — danger 후보는 범위 안 일반 후보가 없고 커서가 사각형 안(거리 0)일 때만, 히스테리시스 없이 잡힌다"
  - "collector.ts: Item.danger = isDanger(item.name, settings.dangerWords), frame/report에도 danger가 실린다. dangerWords가 바뀌면 collector.refresh()로 곧바로 다시 계산된다"
  - "ring.ts: showRing(rect, { danger }) — 위험이면 --danger 색 점선 테두리 + 바깥 오른쪽에 흰 후광(text-shadow 네 방향) '! 위험' 글자"
  - "content.ts: 번호표 숫자가 가리키는 항목이 danger면 누르지 않고 번호표를 그대로 둔다(T-01-23) — 커서를 직접 위에 두고 클릭·스페이스바로 누르는 것은 그대로 허용"
  - "tests/practice-site/danger.html: 저장 옆 삭제·따로 떨어진 삭제·결재 취소·로그아웃 링크·반려·상신·보류 각 카운터 + other.test 자식 프레임 안 삭제 버튼(Plan 01-09용)"
affects: [01-09, 01-10]

# Actuals (#2632)
actuals:
  tokens: 8700
  tasks: 2
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "위험 판별은 순수 함수(isDanger)로 이름·단어 모두 공백을 지운 뒤 포함 여부만 본다 — 목록 자체는 항상 settings.dangerWords에서 읽는다(하드코딩 없음)"
    - "자석의 danger 예외: 범위 안 일반 후보가 하나라도 있으면 항상 그것을 먼저 본다(danger가 더 가까워도) — danger 후보는 일반 후보가 전혀 없을 때만, 거리 0(커서가 사각형 안)에서만, 히스테리시스 없이 본다"
    - "배경 없는(카드가 아닌) 오버레이 글자의 흰 후광은 box-shadow 대신 text-shadow 네 방향 오프셋(±--halo-width)으로 흉내낸다"

key-files:
  created:
    - src/core/danger.ts
    - tests/unit/danger.test.ts
    - tests/practice-site/danger.html
    - tests/e2e/danger.e2e.ts
  modified:
    - src/core/magnet.ts
    - tests/unit/magnet.test.ts
    - src/page/collector/collector.ts
    - src/page/overlay/ring.ts
    - src/entrypoints/content.ts

key-decisions:
  - "danger 후보 제외 규칙: 범위 안 일반 후보가 있으면 항상 정상 후보를 먼저 본다(danger가 더 가까워도) — 정상 후보가 전혀 없을 때만 danger를(거리 0에서만, 히스테리시스 없이) 본다. Task 1 순수 함수 단위 시험으로 먼저 고정한 뒤 collector·ring·content에 배선했다."
  - "연습 사이트 요소를 화면 왼쪽 x=0에 붙이면 '왼쪽으로 Npx' 커서 이동이 음수 뷰포트 좌표가 되어 Playwright의 page.mouse.move가 페이지에 이벤트를 전혀 전달하지 않는다(재현 확인, 두 e2e 시험이 검사 없이 '통과'로 잘못 보임). tests/practice-site/danger.html의 시험용 요소를 왼쪽에 150px 여백을 두고 배치해 고쳤다(Rule 1)."

patterns-established:
  - "위험 여부는 항상 collector.ts의 Item.danger 한 곳에서 계산해 magnet(자석 예외)·ring(빨간 점선 표시)·content.ts(번호표 누름 막기) 세 곳이 그 값만 읽는다 — 판정 로직이 여러 곳에 흩어지지 않는다."

requirements-completed: [SAFE-01]

coverage:
  - id: D1
    description: "위험한 버튼(삭제·취소·반려·로그아웃·결재 취소, 공백 무시)은 자석 커서가 끌어당기지 않고 커서가 정확히 위에 있을 때만 잡힌다"
    requirement: "SAFE-01"
    verification:
      - kind: unit
        ref: "tests/unit/danger.test.ts#기본 목록에 있는 위험 단어가 든 이름은 true다"
        status: pass
      - kind: unit
        ref: "tests/unit/danger.test.ts#공백을 무시하고 판별한다"
        status: pass
      - kind: unit
        ref: "tests/unit/magnet.test.ts#danger 후보는 커서가 그 사각형 안(거리 0)일 때만 잡힌다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/danger.e2e.ts#범위 안에 다른 요소 없이 삭제에서 20px 밖이면 아무것도 잡히지 않는다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/danger.e2e.ts#저장 옆 20px 밖(범위 안에 저장도 있음)에서는 저장이 잡힌다"
        status: pass
    human_judgment: false
  - id: D2
    description: "잡힌 위험한 버튼은 빨간 점선 테두리와 '! 위험' 글자로 표시되고, 커서가 밖으로 나가면 곧바로(히스테리시스 없이) 놓인다"
    requirement: "SAFE-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/danger.e2e.ts#커서가 삭제 위에 정확히 있으면 잡히고 빨간 점선 테두리에 \"! 위험\" 글자가 보인다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/danger.e2e.ts#잡힌 삭제에서 커서를 5px 밖으로 옮기면 테두리가 없어진다"
        status: pass
      - kind: unit
        ref: "tests/unit/magnet.test.ts#잡힌 위험 후보는 커서가 사각형 밖으로 나가면 히스테리시스 없이 놓인다"
        status: pass
    human_judgment: false
  - id: D3
    description: "결재·상신 버튼은 위험한 버튼이 아니다(일반 요소처럼 자석에 끌려온다)"
    requirement: "SAFE-01"
    verification:
      - kind: unit
        ref: "tests/unit/danger.test.ts#위험 단어가 들지 않은 이름은 false다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/danger.e2e.ts#상신은 30px 밖에서 일반 요소처럼 잡힌다"
        status: pass
    human_judgment: false
  - id: D4
    description: "위험 단어 목록은 settings.dangerWords에서 오고, 바꾸면 곧바로(다음 pointermove에) 반영된다"
    requirement: "SAFE-01"
    verification:
      - kind: unit
        ref: "tests/unit/danger.test.ts#목록을 바꾸면 그 목록만 따른다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/danger.e2e.ts#SW에서 dangerWords에 '보류'를 더하면 보류 버튼이 20px 밖에서 끌려오지 않는다"
        status: pass
    human_judgment: false
  - id: D5
    description: "번호표 숫자로는 위험한 버튼이 곧바로 눌리지 않는다(T-01-23) — 커서를 직접 겨눈 클릭·스페이스바 누름은 그대로 된다(확인 화면은 Plan 01-09)"
    requirement: "SAFE-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/danger.e2e.ts#번호표를 켜고 삭제의 번호를 눌러도 삭제 카운터가 0이다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/danger.e2e.ts#커서가 삭제 위에 정확히 있을 때 스페이스바를 누르면 삭제 카운터가 1이 된다"
        status: pass
    human_judgment: false

duration: 24min
completed: 2026-09-23
status: complete
---

# Phase 1 Plan 8: 위험한 버튼 판별·자석 예외·빨간 점선 표시·번호 누름 막기 Summary

**isDanger 순수 함수(공백 무시 포함 판별)로 삭제·취소·반려·로그아웃·결재 취소 버튼을 자석 예외(거리 0에서만, 히스테리시스 없이) 처리하고, 잡히면 --danger 점선 테두리 + "! 위험" 글자로 표시하며, 번호표 숫자로는 누르지 않는다(T-01-23).**

## Performance

- **Duration:** 약 24분(직전 계획 완료~마지막 GREEN 커밋 기준)
- **Started:** 2026-09-23T20:24:24Z
- **Completed:** 2026-09-23T20:47:55Z
- **Tasks:** 2
- **Files modified:** 9 (신규 4 + 수정 5)

## Accomplishments
- `danger.ts`(순수): 이름과 단어 모두 공백을 지운 뒤 포함 여부로 위험한 버튼을 판별한다. 기본 목록은 `settings-schema.ts`의 `['삭제','취소','반려','로그아웃','결재 취소']`와 정확히 일치함을 단위 시험으로 고정했다.
- `magnet.ts`: danger 후보 예외 — 범위 안에 일반 후보가 하나라도 있으면 항상 그것을 먼저 잡고(danger가 더 가까워도), danger 후보는 일반 후보가 전혀 없을 때만·커서가 사각형 안(거리 0)일 때만·히스테리시스 없이 잡힌다.
- `collector.ts`·`ring.ts`·`content.ts` 배선: `Item.danger`가 `frame/report`에도 실리고, dangerWords가 바뀌면 `collector.refresh()`로 곧바로 다시 계산된다. 잡힌 위험 버튼은 `--danger` 점선 테두리와 흰 후광을 두른 "! 위험" 글자로 보인다.
- 번호표 숫자가 가리키는 항목이 위험하면 누르지 않고 번호표를 그대로 둔다(T-01-23 완화) — 커서를 직접 그 버튼 위에 두고 클릭하거나 스페이스바를 누르는 것(이용자가 직접 겨눈 누름)은 그대로 허용한다(확인 화면은 Plan 01-09).
- `tests/practice-site/danger.html`: 저장 옆 삭제(40px 간격)·따로 떨어진 삭제·결재 취소·로그아웃 링크·반려·상신·보류 각 카운터, `other.test` 자식 프레임 안 위험한 버튼(Plan 01-09 확인 화면 시험용, 이 계획은 만들기만 함).

## Task Commits

Each task followed RED → GREEN (TDD):

1. **Task 1: 위험한 버튼 판별과 자석 예외(순수 함수)**
   - `e8c58fa` test(01-08): 위험한 버튼 판별·자석 예외 실패 단위 시험(RED)
   - `848d4c8` feat(01-08): 위험한 버튼 판별(isDanger)과 자석 위험 예외(GREEN)
2. **Task 2: 수집기 위험 표시·빨간 점선 테두리·숫자로 바로 누르지 않기**
   - `c127671` test(01-08): 위험한 버튼 표시·번호 누름 막기 실패 e2e 9개(RED)
   - `8746a2b` feat(01-08): 위험한 버튼 표시(빨간 점선+! 위험)와 번호 누름 막기(GREEN)

**Plan metadata:** (이 커밋 직후 기록)

## Files Created/Modified
- `src/core/danger.ts` - `isDanger(name, words)`: 공백 무시 포함 판별, 순수 함수(document·window·chrome 참조 없음)
- `tests/unit/danger.test.ts` - danger behavior 6개(기본 목록·공백 무시·무해한 이름·빈 값·목록 교체·기본 목록 정확성)
- `src/core/magnet.ts` - `Candidate.danger?: boolean`, `pickTarget`에 danger 예외(정상 우선 → danger는 거리 0에서만·히스테리시스 없이)
- `tests/unit/magnet.test.ts` - danger 예외 behavior 3개 추가(기존 7개는 그대로 유지)
- `src/page/collector/collector.ts` - `createCollector({ getDangerWords })`, `Item.danger`, `buildFrameReport`가 danger를 함께 보고
- `src/page/overlay/ring.ts` - `showRing(rect, { danger })`: `--danger` 점선 테두리 + "! 위험" 글자(text-shadow 네 방향 흰 후광)
- `src/entrypoints/content.ts` - 설정 로드/변경 시 `collector.refresh()`, `showRing`에 danger 전달, 번호표 숫자가 danger 항목이면 누르지 않고 번호표 유지
- `tests/practice-site/danger.html` - 연습 사이트(D-28): 저장/삭제 쌍·따로 떨어진 삭제·결재 취소·로그아웃·반려·상신·보류·다른 출처 iframe 안 삭제 버튼
- `tests/e2e/danger.e2e.ts` - e2e 9개(behavior 1~9, `CI=true` 프로덕션 빌드로 검증)

## Decisions Made
- **danger 후보 우선순위:** 범위 안 일반 후보가 있으면 항상 그것을 먼저 잡는다(danger가 더 가까워도) — danger는 일반 후보가 전혀 없을 때만, 거리 0(커서가 정확히 사각형 안)에서만, 히스테리시스 없이 본다. Task 1의 순수 함수 단위 시험으로 이 규칙을 먼저 고정한 뒤 collector·ring·content에 배선해, 배선 단계에서 로직이 흔들리지 않게 했다.
- **오버레이 글자의 흰 후광 구현:** 기존 번호표·모드 표시는 배경 박스가 있어 `box-shadow`로 후광을 흉내냈지만, "! 위험" 글자는 배경 없는 순수 텍스트라 같은 방식을 쓸 수 없다 — `text-shadow`를 상하좌우 네 방향으로 `--halo-width`만큼 오프셋해 흰 후광을 흉내냈다(새 색·서체 없이 tokens.css 변수만 사용, D-26 유지).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 연습 사이트 요소를 화면 왼쪽 끝(x=0)에 두면 왼쪽으로 옮기는 시험이 무효가 된다**
- **Found during:** Task 2 RED 확인(`CI=true pnpm exec playwright test`)
- **Issue:** `danger.html` 초안이 삭제·결재 취소·로그아웃·반려·상신·보류 요소를 모두 `left:0px`에 두었다. 시험이 "요소 왼쪽으로 N px" 위치로 커서를 옮길 때 뷰포트 좌표가 음수(`box.x - N < 0`)가 되는데, Playwright의 `page.mouse.move`가 이 경우 크로미움에 이벤트를 전혀 전달하지 않는다(재현: 여러 디버그 스크립트로 ring 요소 자체가 한 번도 생성되지 않음을 확인) — 그 결과 "잡히면 안 된다" 시험이 실제로는 검사 없이 우연히 통과하고, "잡혀야 한다"(상신 30px) 시험은 타임아웃으로 실패했다.
- **Fix:** `tests/practice-site/danger.html`의 시험용 요소를 왼쪽에 150px 여백을 두고 다시 배치했다(저장 x=150, 삭제(paired) x=250 등, 간격은 그대로 유지).
- **Files modified:** `tests/practice-site/danger.html`
- **Verification:** 수정 뒤 9개 e2e 모두 의도한 이유로 통과(직접 hover 디버그로 각 요소가 실제 커서 이동에 반응함을 확인)
- **Committed in:** `c127671`(RED 커밋에 이미 수정된 상태로 포함 — 구현 코드가 아닌 시험 인프라 버그라 RED 단계에서 바로 고쳤다)

---

**Total deviations:** 1 auto-fixed (버그 수정, 시험 인프라)
**Impact on plan:** 구현 코드나 범위에는 영향 없음 — 연습 사이트 좌표 배치만 고쳤다.

## Issues Encountered
- 초기 e2e 실행에서 5개 시험이 실패했는데, 그중 "결재 취소·로그아웃·반려 안 잡힘"·"삭제 5px 밖 안 잡힘" 2개는 사실 위 좌표 버그로 "우연히" 통과하고 있었고, "상신 30px 잡힘"은 같은 버그로 실패하고 있었다 — `systematic-debugging`(직접 hover 디버그, viewport·박스 좌표 확인)으로 마우스 이벤트가 음수 좌표에서 페이지에 닿지 않음을 재현·확인한 뒤 연습 사이트 배치를 고쳤다. 고친 뒤 재실행하니 6개는 의도한 이유로 실패(RED), 3개는 이 계획으로 바뀌지 않는 대조군으로 정상 통과함을 확인했다.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SAFE-01의 자석·표시·번호 누름 막기 부분이 완성됐다. 머무르기(dwell) 클릭의 위험 버튼 예외는 머무르기 자체가 생기는 Plan 01-10에서 확인한다.
- `tests/practice-site/danger.html`의 `?child=1` 자식 프레임(다른 출처 안 위험한 버튼)은 이 계획에서 만들기만 하고 시험하지 않았다 — Plan 01-09(확인 화면)가 번호로 위험한 버튼을 골랐을 때의 확인 절차를 여기서 시험할 수 있다.
- 사이트별 위험 단어 목록 편집 화면(SAFE-06)은 Phase 3.
- 블로커 없음.

---
*Phase: 01-click-helper-foundation*
*Completed: 2026-09-23*

## Self-Check: PASSED

All files listed in Files Created/Modified verified present on disk. All 4 commit hashes (e8c58fa, 848d4c8, c127671, 8746a2b) verified present in git history.
