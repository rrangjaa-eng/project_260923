---
phase: 01-click-helper-foundation
plan: 09
subsystem: safety
tags: [confirm-dialog, state-machine, tdd, playwright, iframe, shadow-dom]

# Dependency graph
requires:
  - phase: 01-click-helper-foundation
    provides: 위험한 버튼 판별(isDanger)·자석 예외·빨간 점선 표시·번호 누름 막기(danger.ts, magnet.ts, collector.ts, ring.ts) — Plan 01-08
provides:
  - "confirm-guard.ts: createConfirmGuard({openedAt, guardMs, holdMs, keymap}) — 순수 상태 기계. 연 뒤 guardMs(1s) 무시, 진짜 Enter(repeat 없음) confirm, Esc cancel, 스페이스바 holdMs(1s) keyup 없이 누르고 있으면 tick()이 confirm. 한 번 confirm/cancel되면 이후 ignore/null"
  - "confirm-dialog.ts: openConfirm({name, onResult})/closeConfirm() — 600px 카드, --danger 테두리, 1s linear 보호 막대, 64px 버튼 둘. 확인 버튼에는 클릭 리스너 자체가 없어 포인터로 절대 확인 안 됨(T-01-25), 취소 버튼은 isTrusted+보호 시간 통과 뒤 클릭만"
  - "hints.ts: 위험 항목 번호표는 --bg 바탕+--danger 점선 테두리로 바뀌고 옆에 '! 위험' 글자(흰 후광)가 붙는다"
  - "pipeline.ts: setModal(handler) — 모달이 열려 있으면 isTrusted keydown/keyup/keypress를 모두 삼키고 keydown/keyup만 handler에 넘긴다. isTrusted false는 통과만 시키고 넘기지 않는다(T-01-24). 100ms tick으로 스페이스바 누르고 있는 시간을 자동화 도구에서도 잰다"
  - "content.ts: 번호로 고른 위험 항목은 번호표를 닫고 confirm-guard+confirm-dialog+pipeline.setModal로 확인을 받는다 — confirm이면 pressHintEntry(맨 위는 바로, 자식 프레임은 hints/press), cancel이면 닫기만"
  - "messages.ts/relay.ts: confirm/state(맨 위→SW→모든 프레임, sender.frameId===0만 인정, T-01-26)와 confirm/key(자식→SW→맨 위, 시각 없음 — 맨 위 시계로 다시 잰다)"
affects: [01-10, 01-11]

# Actuals (#2632)
actuals:
  tokens: 13900
  tasks: 3
  commits: 7

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "확인 화면 보호 상태 기계는 순수 함수로 만들고(시각은 인자), UI(confirm-dialog.ts)·입력 경로(pipeline.ts setModal)와 분리했다 — 상태 로직이 단위 시험만으로 고정된다"
    - "모달(확인 화면) 중에는 pipeline이 isTrusted 키를 통째로 가로채 단일 handler로만 보낸다 — 기존 tremor filter·hint 키 처리 경로를 완전히 우회해 확인 로직이 다른 입력 규칙과 섞이지 않는다"
    - "자동화 도구(Playwright)는 눌린 키를 계속 눌러도 native repeat keydown을 보장하지 않는다 — 스페이스바 '누르고 있기' 판정은 keydown 시각 기록 + 100ms 폴링 tick으로, 브라우저 repeat 이벤트에 의존하지 않게 구현했다"
    - "확인 화면은 항상 맨 위 프레임에서만 열리고 시간도 맨 위 시계로만 잰다 — 자식 프레임은 판단하지 않고 isTrusted 키를 그대로 중계만 한다(hints/key와 같은 패턴을 confirm/key로 반복)"

key-files:
  created:
    - src/core/confirm-guard.ts
    - tests/unit/confirm-guard.test.ts
    - src/page/overlay/confirm-dialog.ts
    - tests/e2e/confirm.e2e.ts
  modified:
    - src/page/overlay/hints.ts
    - src/page/input/pipeline.ts
    - src/entrypoints/content.ts
    - src/shared/messages.ts
    - src/worker/relay.ts
    - src/entrypoints/background.ts
    - tests/practice-site/danger.html

key-decisions:
  - "스페이스바 '1초 누르고 있기' 확인은 브라우저의 repeat keydown에 기대지 않는다 — Playwright의 keyboard.down()이 native auto-repeat를 보내지 않아 confirm-guard가 최초 keydown 시각을 기록하고, pipeline이 모달 활성 중 100ms마다 보내는 tick으로 guard.tick(t)을 폴링해 holdMs 경과를 직접 판정한다"
  - "확인 버튼에는 어떤 클릭 리스너도 달지 않는다(취소 버튼만 isTrusted+보호 시간 통과 시 클릭 처리) — '포인터로는 확인되지 않는다'는 요구를 코드 부재로 보장해 우회 경로 자체를 없앴다"
  - "다른 프레임 항목의 확인 화면 표시 이름은 collector의 name이 아니라 fingerprint(buttonText→labelText→aria→id 순)로 최선 추정한다 — frame/report 와이어에는 name이 실리지 않기 때문(대역폭 최소화, 기존 설계)"

patterns-established:
  - "확인 화면은 항상 맨 위 프레임에서 열리고, 보호·누르고 있기 시간은 항상 맨 위 시계(performance.now())로만 잰다 — 자식 프레임은 confirm/state를 받으면 자기 pipeline.setModal로 isTrusted 키를 삼켜 confirm/key로 전달만 하고 스스로 판단하지 않는다"

requirements-completed: [SAFE-02, SAFE-03]

coverage:
  - id: D1
    description: "번호표로 위험한 버튼을 고르면 빨간 테두리의 확인 화면이 '정말 누를까요? Enter = 예'와 버튼 이름, 600px 카드·64px 버튼을 보여 준다"
    requirement: "SAFE-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/confirm.e2e.ts#F → 삭제 번호(빨간 점선+! 위험) → 번호를 누르면 확인 화면이 뜨고 카드 규칙을 지킨다"
        status: pass
    human_judgment: false
  - id: D2
    description: "확인 화면이 뜬 뒤 1초 동안은 Enter·Esc·스페이스바를 포함한 모든 입력이 무시된다"
    requirement: "SAFE-03"
    verification:
      - kind: unit
        ref: "tests/unit/confirm-guard.test.ts#연 뒤 1000ms 미만의 Enter·Esc·스페이스바·다른 키는 모두 ignore다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/confirm.e2e.ts#확인 화면 1초 보호: 300ms 뒤 Enter는 무시되고 1,100ms 뒤 Enter로 확인·눌림·닫힘"
        status: pass
      - kind: e2e
        ref: "tests/e2e/confirm.e2e.ts#확인 화면 1초 보호: 300ms 뒤 Esc는 무시되고 1,100ms 뒤 Esc로 닫히고 카운터는 0이다"
        status: pass
    human_judgment: false
  - id: D3
    description: "1초 뒤 Enter를 누르거나 스페이스바를 1초 누르고 있으면 그 버튼이 눌리고, Esc를 누르면 누르지 않고 닫힌다"
    requirement: "SAFE-03"
    verification:
      - kind: unit
        ref: "tests/unit/confirm-guard.test.ts#1000ms 뒤 Enter keydown(repeat: false)은 confirm이다"
        status: pass
      - kind: unit
        ref: "tests/unit/confirm-guard.test.ts#1000ms 뒤 스페이스바 keydown 후 1000ms 동안 keyup 없이 tick하면 confirm이다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/confirm.e2e.ts#확인 화면에서 스페이스바를 1초 넘게 누르고 있으면 확인되고, 1초 전에 떼면 확인되지 않는다"
        status: pass
    human_judgment: false
  - id: D4
    description: "확인 화면이 떠 있는 동안 사이트는 키 입력을 받지 않는다(맨 위·자식 프레임 모두)"
    requirement: "SAFE-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/confirm.e2e.ts#확인 화면이 떠 있는 동안 누른 키를 사이트의 keydown 기록이 받지 않는다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/confirm.e2e.ts#초점이 iframe 안에 있을 때 확인 화면이 떠 있는 동안 그 프레임의 keydown 기록이 늘지 않는다"
        status: pass
    human_judgment: false
  - id: D5
    description: "다른 출처 iframe 안 위험한 버튼도 맨 위 화면의 확인 화면을 거쳐서만 눌린다(초점이 iframe 안에 있어도 Enter가 전달된다)"
    requirement: "SAFE-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/confirm.e2e.ts#other.test 자식 프레임 안 삭제 번호 → 맨 위 확인 화면, 1,100ms 뒤 Enter → 프레임 안 카운터 1"
        status: pass
      - kind: e2e
        ref: "tests/e2e/confirm.e2e.ts#먼저 iframe 안(입력칸 밖)에 초점을 옮긴 뒤 같은 흐름 → 300ms Enter는 무시, 1,100ms 뒤 Enter로 확인된다"
        status: pass
    human_judgment: false
  - id: D6
    description: "위험하지 않은 버튼은 번호로 고르면 확인 없이 곧바로 눌린다"
    requirement: "SAFE-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/confirm.e2e.ts#저장(위험 아님) 번호는 확인 화면 없이 곧바로 눌린다"
        status: pass
    human_judgment: false
  - id: D7
    description: "번호표로 고른 위험한 버튼은 이용자의 진짜 확인(1초 보호 뒤 진짜 Enter 또는 스페이스바 1초) 없이 누르지 않는다 — 사이트가 만든 가짜 Enter·가짜 클릭으로도 확인되지 않는다"
    requirement: "SAFE-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/confirm.e2e.ts#확인 화면이 뜬 뒤 페이지가 가짜(isTrusted=false) Enter를 보내도 확인되지 않는다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/confirm.e2e.ts#확인 화면이 뜬 뒤 페이지가 열린 shadow root의 확인 버튼을 .click()해도 확인되지 않는다"
        status: pass
      - kind: unit
        ref: "tests/unit/confirm-guard.test.ts#보호 시간 안에 눌러 계속 누르고 있는 Enter의 repeat: true keydown은 1000ms 뒤에도 ignore다"
        status: pass
    human_judgment: true
    rationale: "플랜 자체가 이 금지사항을 edge probe 'unclassified — review manually'로 표시했다(spec-less 판단 경계, 확인 화면이 만든 열린 shadow root라는 사실은 있는 그대로 두는 게 맞는지 등). 자동 시험(가짜 Enter·가짜 클릭·repeat 우회 3개)은 통과하지만, 안전 요구의 최종 판정은 verify-work의 사람 확인으로 본다(플랜 <verification> 절 명시)."

duration: 31min
completed: 2026-09-23
status: complete
---

# Phase 1 Plan 9: 위험한 버튼 확인 화면(1초 보호, Enter·스페이스바 확인, Esc 취소, iframe 포함) Summary

**순수 상태 기계(createConfirmGuard)로 1초 보호·Enter/스페이스바 1초/Esc를 판정하고, 600px 빨간 카드 확인 화면(confirm-dialog.ts)과 pipeline.setModal로 모달 중 모든 isTrusted 키를 가로채, 가짜 Enter·가짜 클릭으로는 절대 확인되지 않으며 다른 출처 iframe 안 위험 버튼도 confirm/state·confirm/key 중계로 같은 확인을 거친다.**

## Performance

- **Duration:** 약 31분(직전 계획 완료~마지막 GREEN 커밋 기준)
- **Started:** 2026-09-23T20:50:03Z
- **Completed:** 2026-09-23T21:21:00Z
- **Tasks:** 3
- **Files modified:** 11 (신규 4 + 수정 7)

## Accomplishments
- `confirm-guard.ts`(순수 함수, document·window·chrome 참조 없음): 연 뒤 1000ms(guardMs)는 모든 입력을 ignore, 그 뒤 진짜 Enter(repeat 없음)는 confirm, Esc는 cancel, 스페이스바는 1000ms(holdMs) keyup 없이 눌려 있어야 tick()이 confirm — 보호 시간 안에 시작한 누름은 이후 repeat 이벤트만 이어지므로 별도 추적 없이 계속 눌러도 확인되지 않는다. 단위 시험 8개로 규칙을 고정했다.
- `confirm-dialog.ts`: SYSTEM.md "확인 화면" 템플릿대로 600px 카드 + `--danger` 테두리, "정말 누를까요? Enter = 예" 제목, "누를 버튼: {name}" 한 줄, 1s linear 보호 막대(`--confirm-guard`, 움직임 줄이기에서도 유지) + "1초 뒤에 누를 수 있어요"→"지금 누를 수 있어요", 64px 버튼 둘(1차 위험 채움, 2차 남색 테두리). 확인 버튼에는 클릭 리스너 자체가 없어 포인터로 절대 확인되지 않고(T-01-25), 취소 버튼은 isTrusted + 보호 시간 통과 뒤 클릭만 받는다.
- `pipeline.ts`: `setModal(handler)` — 모달이 열려 있으면 isTrusted keydown·keyup·keypress를 모두 삼키고(사이트로 안 감) keydown·keyup만 handler에, isTrusted false는 그대로 통과시켜 handler에 넘기지 않는다(T-01-24, 가짜 입력 무효화). 100ms마다 'tick' 이벤트를 추가로 보내 자동화 도구가 native repeat keydown을 보내지 않아도 guard.tick()으로 스페이스바 누르고 있는 시간을 잰다.
- `hints.ts`: 위험 항목 번호표는 `--bg` 바탕 + `--danger` 점선 테두리로 바뀌고 옆에 "! 위험" 글자(흰 후광, ring.ts와 같은 text-shadow 방식)가 붙는다.
- `content.ts`: 번호가 가리키는 항목이 danger면 번호표를 닫고 confirm-guard + confirm-dialog + pipeline.setModal로 확인을 받는다 — confirm이면 `pressHintEntry`(맨 위는 바로 누르고, 자식 프레임은 기존 hints/press 경로 재사용), cancel이면 닫기만.
- `messages.ts`/`relay.ts`/`content.ts`(Task 3): `confirm/state`(맨 위→SW→모든 프레임, `sender.frameId===0`만 인정)와 `confirm/key`(자식→SW→맨 위, 시각 없음)로 다른 출처 iframe 안 위험 버튼도 같은 확인 화면을 거치고, 초점이 그 프레임 안에 있어도 확인 키가 전달된다 — 보호·누르고 있기 시간은 항상 맨 위 시계(`performance.now()`)로만 잰다.

## Task Commits

Each task followed RED → GREEN (TDD):

1. **Task 1: 확인 화면 보호 상태 기계(순수 함수)**
   - `27dcb5d` test(01-09): 확인 화면 보호 상태 기계 실패 단위 시험 8개(RED)
   - `fd918a0` feat(01-09): 확인 화면 보호 상태 기계(createConfirmGuard) GREEN
2. **Task 2: 확인 화면 오버레이와 맨 위 프레임 위험 버튼 확인 흐름**
   - `e11eadc` test(01-09): 확인 화면 오버레이·위험 번호표 확인 흐름 실패 e2e 9개(RED)
   - `4802ade` feat(01-09): 확인 화면 오버레이와 위험 번호표 확인 흐름 GREEN
3. **Task 3: iframe 안 위험 버튼 확인과 초점이 iframe에 있을 때의 확인 키 전달**
   - `2f5723b` test(01-09): iframe 위험 버튼 확인·초점 위임 시 확인 키 전달 실패 e2e 3개(RED)
   - `1b1f661` feat(01-09): iframe 위험 버튼 확인과 초점 위임 시 확인 키 전달 GREEN

**Plan metadata:** (이 커밋 직후 기록)

_Note: TDD 작업이라 RED → GREEN 커밋이 각 Task마다 있다._

## Files Created/Modified
- `src/core/confirm-guard.ts` - `createConfirmGuard`: 순수 상태 기계(guardMs/holdMs/keymap), `handle`/`tick`
- `tests/unit/confirm-guard.test.ts` - behavior 8개(보호 시간, Enter 확인, Esc 취소, 스페이스바 1초, repeat 우회 방지, 키 배치 바꾸기)
- `src/page/overlay/confirm-dialog.ts` - `openConfirm`/`closeConfirm`: 600px 카드, 보호 막대, 버튼 둘(확인은 클릭 불가)
- `src/page/overlay/hints.ts` - 위험 항목 번호표 danger 스타일 + "! 위험" 태그
- `src/page/input/pipeline.ts` - `setModal(handler)`: 모달 중 isTrusted 키 전량 가로채기 + 100ms tick
- `src/entrypoints/content.ts` - `openDangerConfirm`/`displayNameFor`, `confirm/state`·`confirm/key` 송수신
- `src/shared/messages.ts` - `confirm/state`, `confirm/key` 메시지 스키마
- `src/worker/relay.ts` - `confirm/state`(frameId 0만 인정, 전체 방송) · `confirm/key`(맨 위로만) 중계
- `src/entrypoints/background.ts` - Message 유니언 확장에 따른 relay 라우팅 목록 갱신(타입 오류 수정)
- `tests/practice-site/danger.html` - site-keydown 카운터(맨 위·자식 각각), child-focus-target(입력칸 아닌 초점 이동용)
- `tests/e2e/confirm.e2e.ts` - e2e 12개(Task 2 아홉 + Task 3 셋, `CI=true` 프로덕션 빌드로 검증)

## Decisions Made
- **스페이스바 '누르고 있기' 판정은 native repeat에 기대지 않는다:** Playwright의 `keyboard.down()`이 실제 키보드처럼 OS auto-repeat keydown을 보내지 않아, confirm-guard가 최초 keydown 시각만 기록하고 pipeline이 모달 활성 중 100ms마다 보내는 tick으로 `guard.tick(t)`을 폴링해 `holdMs` 경과를 직접 판정하도록 설계했다. 이 방식은 자동화 환경과 실제 손 떨림 이용자의 느린/불규칙한 누르고 있기 모두에서 동일하게 동작한다.
- **확인 버튼에는 클릭 리스너를 아예 달지 않는다:** "확인은 포인터로 되지 않는다"는 요구(T-01-25)를 조건문이 아니라 코드 부재로 보장했다 — 우회 경로 자체가 존재하지 않는다. 취소 버튼만 `isTrusted` + 보호 시간 통과 확인 뒤 클릭을 받는다(안전한 방향).
- **다른 프레임 항목의 확인 화면 이름:** `frame/report` 와이어 스키마에는 `name`이 실리지 않아(대역폭 최소화, 기존 설계) `fingerprint.buttonText → labelText → aria → id` 순으로 최선 추정한다. 맨 위 자신의 항목은 `collector.items()`의 실제 `name`을 그대로 쓴다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Message 유니언 확장으로 깨진 background.ts의 narrowing 오류 수정**
- **Found during:** Task 3 (`pnpm typecheck`)
- **Issue:** `messages.ts`에 `confirm/state`·`confirm/key`를 추가하자 `background.ts`의 마지막 분기(소거법으로 `frame/state`만 남는다고 가정하던 코드)가 두 새 타입도 포함하게 되어 `message.enabled` 접근이 타입 오류가 됐다.
- **Fix:** `confirm/state`·`confirm/key`를 relay로 넘기는 기존 타입 목록(`frame/report`·`hints/press`·`hints/state`·`hints/key`·`mode/report`)에 추가했다 — relay.ts가 이미 이 두 메시지를 처리하므로 동작은 그대로다.
- **Files modified:** `src/entrypoints/background.ts`
- **Verification:** `pnpm typecheck` 통과
- **Committed in:** `1b1f661` (Task 3 GREEN 커밋)

---

**Total deviations:** 1 auto-fixed (Rule 3, 타입 오류)
**Impact on plan:** 계획 범위·동작에 영향 없음 — 새 메시지 타입 추가로 자연히 발생한 타입 좁히기 수정.

## Issues Encountered
None — TDD 사이클(RED 확인 → GREEN)이 각 Task에서 첫 시도에 의도한 이유로 통과했다. 전체 e2e 스위트(88개)를 연속 3회 돌려 간헐 실패가 없음을 확인했다(learned_after_01_04·01_05 lessons 반영).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SAFE-02·SAFE-03(위험 버튼 확인 화면)이 맨 위 프레임·다른 출처 iframe 모두에서 완성됐다.
- 금지사항("확인 없이 위험 버튼 누르기 금지")은 자동 시험(가짜 Enter·가짜 클릭·repeat 우회)으로 뒷받침하되, 계획 자체가 spec-less 경계로 표시해 verify-work의 사람 판정을 남겨 두었다(D7 참고).
- 명령판(3번 카드 "틀 실행" 등 제출 확인 화면)은 Phase 4 범위 — 이번 계획은 위험 버튼 확인만 다룬다.
- 블로커 없음.

---
*Phase: 01-click-helper-foundation*
*Completed: 2026-09-23*

## Self-Check: PASSED

All 11 files listed in Files Created/Modified verified present on disk (plus this SUMMARY.md). All 6 task commit hashes (27dcb5d, fd918a0, e11eadc, 4802ade, 2f5723b, 1b1f661) verified present in git history.
