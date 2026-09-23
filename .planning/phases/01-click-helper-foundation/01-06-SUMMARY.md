---
phase: 01-click-helper-foundation
plan: 06
subsystem: click-helper
tags: [hints, fingerprint, keyboard, overlay, storage, chrome-storage, playwright, vitest]

# Dependency graph
requires:
  - phase: 01-click-helper-foundation (Plan 05)
    provides: "src/page/click/press.ts(synthesizePress), src/page/input/pipeline.ts(onKey/onPress 2단계 구조), src/entrypoints/content.ts(자석 커서 배선)"
provides:
  - "src/core/fingerprint.ts: matchScore·isSameElement — id·name·labelText·buttonText·aria·domPath 중 2개 이상 일치·framePath 동일이면 같은 요소(설계 6.8)"
  - "src/core/hint-order.ts: orderHints(고정→자주 누름→커서 근처, 1~9씩 장 나눔)·placeLabels(기본 −14px,−14px, 겹치면 오른쪽 위→왼쪽 아래→오른쪽 아래→안쪽 왼쪽 위)"
  - "src/page/collector/collector.ts: Item.fingerprint — id·name·연결된 label 글자·버튼 글자·aria·domPath(tag:nth-of-type 사슬, 최대 12단계), framePath는 이 계획에서 항상 []"
  - "src/page/overlay/hints.ts: showHints·hideHints·showNextCard — 번호표(28×28px)·'0 다음 번호' 카드, mode-indicator.ts와 같은 shadow root"
  - "src/entrypoints/content.ts: keymap.toggleHints(기본 F)로 번호표 켜고 끄기, 떠 있을 때만 숫자·0·Esc를 도우미가 씀, F를 누를 때 site:<origin>·presses:<origin>을 읽어 orderHints에 반영, 누를 때마다 recordPress 전송"
  - "src/shared/messages.ts + src/worker/storage-writer.ts: storage/request op 'recordPress' — sender.url origin과 요청 origin이 같을 때만(T-01-16) presses:<origin>(storage.local)에 count+1, 200개 상한(T-01-18)"
affects: [01-07, 01-08, 03-command-palette]

actuals:
  tokens: 13332
  tasks: 3
  commits: 6
  plan_head_before: f559e6d29c76b1b5f2ab6b91ab2b9dc7ab8f56cd

tech-stack:
  added: []
  patterns:
    - "요소 식별 묶음(fingerprint)은 순수 함수(fingerprint.ts·hint-order.ts)로 분리해 document/window/chrome 참조 없이 단위 시험(vitest)으로 고정하고, collector.ts가 DOM에서 값을 채워 넣는다."
    - "번호 순서는 pins(storage.sync, 쓰기 아직 없음)·presses(storage.local, 이 계획에서 쓰기 시작)를 F 키 시점에 읽기만 해서(D-24) orderHints에 넘긴다 — content script는 저장을 부탁만 하고, 실제 chrome.storage.*.set은 storage-writer.ts 한 곳에서만 한다(단일 저장자, D-24)."
    - "메시지 op을 zod discriminatedUnion으로 넓혀(SetEnabledOp | RecordPressOp) 타입별 검사를 유지하면서 background.ts가 op.kind로 분기한다. recordPress의 origin 확인은 요청 안의 origin 문자열이 아니라 background.ts가 sender.url에서 계산한 실제 origin과 대조해(storage-writer.ts recordPress 안에서) 한다 — 다른 사이트를 사칭한 기록 조작을 막는다(T-01-16)."
    - "번호표 자리 배치는 앞 번호부터 순서대로 정하고 이미 놓인 번호표와만 겹침을 확인한다(요소 자체와의 겹침은 확인하지 않음, SYSTEM.md 배치 규칙 그대로)."

key-files:
  created:
    - src/core/fingerprint.ts
    - src/core/hint-order.ts
    - tests/unit/hint-order.test.ts
    - src/page/overlay/hints.ts
  modified:
    - src/page/collector/collector.ts
    - src/entrypoints/content.ts
    - src/entrypoints/background.ts
    - src/page/overlay/mode-indicator.ts
    - src/shared/messages.ts
    - src/worker/storage-writer.ts
    - src/core/settings-schema.ts
    - src/types/chrome.d.ts
    - tests/e2e/hints.e2e.ts

key-decisions:
  - "mode-indicator.ts에 showTransientMessage(text, ms) 추가 — plan의 files_modified 목록에는 없었지만 D-27 '번호표 비어 있음 → 모드 표시에 누를 곳이 없어요 2초' 상태 표를 구현하려면 모드 표시 자체에 잠깐 다른 글자를 보였다가 되돌리는 기능이 꼭 필요했다(Rule 3)."
  - "settings-schema.ts의 FingerprintSchema를 export로 바꿨다 — messages.ts가 recordPress 페이로드를 zod로 검사하려면 실제 스키마가 필요했고, 별도로 다시 정의하면 두 정의가 어긋날 위험이 있어 기존 정의를 그대로 재사용했다(Rule 3, files_modified 밖)."
  - "src/types/chrome.d.ts의 MessageSender에 url?: string을 추가했다 — recordPress의 origin 확인(T-01-16)이 sender.url에서 계산한 실제 origin을 신뢰 경계로 쓰기 때문에 꼭 필요했다(Rule 3, files_modified 밖)."
  - "background.ts를 수정해 storage/request의 op.kind로 분기하도록 했다 — plan 프론트매터 files_modified에는 없었지만 recordPress 메시지를 실제로 저장자에 연결하는 배선이 background.ts에서만 가능했다(Rule 3, files_modified 밖)."
  - "hints-many.html(이 계획 안 인라인 servePage 픽스처)의 버튼에 name=id도 함께 달아, e2e가 collector의 domPath 계산 방식을 몰라도 id+name 2개 일치로 isSameElement를 만족시켜 고정 번호 시험을 결정적으로 만들었다."

requirements-completed: [CLICK-03]

coverage:
  - id: D1
    description: "요소 식별 일치 점수(2개 이상 일치·framePath 동일이면 같은 요소)와 번호 순서(고정→자주 누름→커서 근처, 1~9씩 장 나눔), 번호표 자리 배치(기본 −14px,−14px, 겹치면 오른쪽 위→왼쪽 아래→오른쪽 아래→안쪽 왼쪽 위) 규칙이 순수 함수로 고정되었다"
    requirement: CLICK-03
    verification:
      - kind: unit
        ref: "tests/unit/hint-order.test.ts (9 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "keymap.toggleHints(기본 F)로 보이는 요소에 1부터 중복 없이 28×28px 이상 번호표가 붙고, F 또는 Esc로 다시 누르면 사라진다"
    requirement: CLICK-03
    verification:
      - kind: e2e
        ref: "tests/e2e/hints.e2e.ts#F를 누르면 번호표가 보이는 요소에 붙고 번호는 1부터 중복 없이, 각 번호표 상자가 28×28px 이상이다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/hints.e2e.ts#번호표가 떠 있을 때 F 또는 Esc를 누르면 번호표가 사라진다"
        status: pass
    human_judgment: false
  - id: D3
    description: "번호표가 떠 있을 때 숫자 키를 누르면 그 번호의 요소가 눌리고 번호표가 사라진다"
    requirement: CLICK-03
    verification:
      - kind: e2e
        ref: "tests/e2e/hints.e2e.ts#번호표가 떠 있을 때 숫자 키를 누르면 그 번호의 요소가 눌리고 번호표가 사라진다"
        status: pass
    human_judgment: false
  - id: D4
    description: "번호표 상자끼리 서로 겹치지 않는다(모든 쌍의 사각형 교차 없음)"
    requirement: CLICK-03
    verification:
      - kind: e2e
        ref: "tests/e2e/hints.e2e.ts#번호표 상자끼리 서로 겹치지 않는다"
        status: pass
    human_judgment: false
  - id: D5
    description: "누를 곳이 없으면 모드 표시에 '누를 곳이 없어요'가 2초 보이고 사라진다"
    requirement: CLICK-03
    verification:
      - kind: e2e
        ref: "tests/e2e/hints.e2e.ts#요소가 하나도 없는 페이지에서 F를 누르면 모드 표시에 \"누를 곳이 없어요\"가 보이고 2초 뒤 사라진다"
        status: pass
    human_judgment: false
  - id: D6
    description: "9개 넘으면 '0 다음 번호' 카드가 보이고, 0을 누르면 다음 9개 번호표를 본다"
    requirement: CLICK-03
    verification:
      - kind: e2e
        ref: "tests/e2e/hints.e2e.ts#요소가 9개 넘는 페이지에서 F → \"0 다음 번호\" 카드가 보이고, 0 → 다음 9개 번호표"
        status: pass
    human_judgment: false
  - id: D7
    description: "번호표가 떠 있을 때만 숫자를 도우미가 쓰고(사이트 단축키보다 먼저), 번호표가 없으면 숫자는 사이트로 그대로 가며, 입력칸에 초점이 있으면 F는 글자로 들어간다"
    requirement: CLICK-03
    verification:
      - kind: e2e
        ref: "tests/e2e/hints.e2e.ts#shortcuts.html에서 번호표가 떠 있을 때 1은 사이트 단축키 카운터를 올리지 않고, 번호표가 없을 때 1은 올린다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/hints.e2e.ts#입력칸에 초점이 있으면 F는 글자로 들어간다(번호표 안 뜸)"
        status: pass
    human_judgment: false
  - id: D8
    description: "번호표로 같은 요소를 3번 누른 뒤 새로 고쳐도(storage.local 영속) 고정 번호 없이 그 요소가 1번이 된다"
    requirement: CLICK-03
    verification:
      - kind: e2e
        ref: "tests/e2e/hints.e2e.ts#번호표로 같은 요소를 3번 누른 뒤 새로 고치고 F → 그 요소가 1번(고정 번호 없음)"
        status: pass
    human_judgment: false
  - id: D9
    description: "SW가 site:<origin>(storage.sync)에 쓴 고정 번호를 F에서 읽어 그 요소가 그 번호 자리를 차지한다"
    requirement: CLICK-03
    verification:
      - kind: e2e
        ref: "tests/e2e/hints.e2e.ts#SW가 site:<origin>에 고정 번호를 쓰면 F에서 그 요소가 그 번호가 된다"
        status: pass
    human_judgment: false
  - id: D10
    description: "누르기 뒤 storage.local의 presses:<origin>이 { schemaVersion: 1, data: { counts: [...] } } 형식이고 그 요소의 count가 는다"
    requirement: CLICK-03
    verification:
      - kind: e2e
        ref: "tests/e2e/hints.e2e.ts#누르기 뒤 storage.local의 presses가 형식대로 저장되고 그 요소의 count가 는다"
        status: pass
    human_judgment: false
  - id: D11
    description: "번호표뿐 아니라 자석 커서(클릭·스페이스바)로 누른 요소도 같은 누른 횟수 기록에 들어간다"
    requirement: CLICK-03
    verification:
      - kind: e2e
        ref: "tests/e2e/hints.e2e.ts#자석 커서로 누른 요소도 누른 횟수에 들어간다"
        status: pass
    human_judgment: false

duration: 36min
completed: 2026-09-23
status: complete
---

# Phase 1 Plan 6: 번호표 — 요소 식별·번호 순서·번호표 자리 Summary

**단축키(기본 F)로 보이는 요소에 1~9 번호표를 붙이고 숫자 키로 누르며, 순서는 고정 번호(storage.sync) → 이 사이트에서 자주 누른 요소(storage.local, 이 계획에서 기록 시작) → 커서 근처 순이다. 요소 식별은 설계 6.8 방식(id·name·라벨·버튼 글자·aria·domPath 중 2개 이상 일치)의 순수 함수로 단위 시험 고정.**

## Performance

- **Duration:** ~36 min
- **Started:** 2026-09-23T18:21:52Z
- **Completed:** 2026-09-23T18:56:36Z
- **Tasks:** 3 (각 tdd="true", RED→GREEN 두 커밋씩)
- **Files modified:** 13 (4 created, 9 modified)

## Accomplishments

- `src/core/fingerprint.ts`: `matchScore`·`isSameElement` — framePath가 다르면 0점, id·name·labelText·buttonText·aria·domPath 중 값이 둘 다 있고 같은 것의 개수가 점수, 2 이상이면 같은 요소
- `src/core/hint-order.ts`: `orderHints` — 고정 번호 자리를 먼저 채우고(화면에 없으면 다음 순위가 채움), 나머지는 누른 횟수 많은 순→커서 가까운 순으로 1~9씩 장을 나눔. `placeLabels` — 기본 자리(요소 왼쪽 위 바깥 −14px,−14px), 겹치면 오른쪽 위→왼쪽 아래→오른쪽 아래→안쪽 왼쪽 위
- `src/page/collector/collector.ts`: `Item.fingerprint` 추가 — id·name 속성·연결된 label 글자·버튼 글자(button/role=button/submit·button·reset input)·aria-label 또는 aria-labelledby 참조 글자·문서 안 위치 경로(tag:nth-of-type 사슬, 최대 12단계). framePath는 이 계획에서 항상 `[]`(Plan 01-07이 채움)
- `src/page/overlay/hints.ts`(신규): `showHints`·`hideHints`·`showNextCard` — 번호표는 `--label-size`(28px) 정사각형·`--accent` 채움·흰 후광, "0 다음 번호" 카드는 SYSTEM.md 번호 카드 형태로 화면 오른쪽 아래
- `src/entrypoints/content.ts`: `keymap.toggleHints`(기본 F)로 번호표를 켜고 끄며(항상 사이트 단축키보다 먼저 받음), 떠 있을 때만 숫자·0(다음 장)·Esc를 도우미가 쓴다. F를 누르면 `site:<origin>`(sync)의 pins와 `presses:<origin>`(local)을 읽어 `orderHints`에 반영. 번호표·자석 커서(클릭·스페이스바)로 누를 때마다 `recordPress` 전송
- `src/shared/messages.ts` + `src/worker/storage-writer.ts`: `recordPress` op — 요청 origin이 `sender.url`의 실제 origin과 같을 때만(T-01-16) `presses:<origin>`을 읽어 `isSameElement`로 같은 항목을 찾아 count+1(없으면 추가), 200개 상한(T-01-18), 검사 실패면 원본 보존(D-25)
- `tests/unit/hint-order.test.ts`(9개) + `tests/e2e/hints.e2e.ts`(12개, Task 2에서 8개·Task 3에서 4개 추가) — `pnpm exec vitest run tests/unit/hint-order.test.ts` 9 passed, `CI=true pnpm exec playwright test tests/e2e/hints.e2e.ts` 12 passed, 전체 e2e 스위트(57개) 3회 연속 0 failures

## Task Commits

각 Task RED→GREEN 두 커밋씩, 총 6개:

1. **Task 1 RED: 요소 식별 일치 점수·번호 순서·번호표 자리 실패 시험 9개** - `ac4eb84` (test)
2. **Task 1 GREEN: fingerprint.ts·hint-order.ts 구현** - `02937a4` (feat)
3. **Task 2 RED: 번호표 켜기·숫자로 누르기·빈 상태·다음 장 실패 e2e 8개** - `d80163f` (test)
4. **Task 2 GREEN: hints.ts·collector.ts·content.ts 구현** - `88d4b09` (feat)
5. **Task 3 RED: 누른 횟수 기록·고정 번호 반영 실패 e2e 4개** - `99f2e00` (test)
6. **Task 3 GREEN: recordPress·messages.ts·storage-writer.ts·background.ts 구현** - `d7ff659` (feat)

**Plan metadata:** (이 커밋 직후 별도 `docs(01-06): ...` 커밋으로 기록)

## Files Created/Modified

- `src/core/fingerprint.ts` - 요소 식별 일치 점수(신규)
- `src/core/hint-order.ts` - 번호 순서·번호표 자리 배치(신규)
- `tests/unit/hint-order.test.ts` - 단위 시험 9개(신규)
- `src/page/overlay/hints.ts` - 번호표·다음 번호 카드 오버레이(신규)
- `src/page/collector/collector.ts` - Item.fingerprint 계산 추가
- `src/entrypoints/content.ts` - 번호표 켜기/숫자 누르기/recordPress 배선
- `src/entrypoints/background.ts` - storage/request op.kind 분기, recordPress 라우팅
- `src/page/overlay/mode-indicator.ts` - showTransientMessage 추가
- `src/shared/messages.ts` - recordPress op 추가
- `src/worker/storage-writer.ts` - recordPress 저장 로직
- `src/core/settings-schema.ts` - FingerprintSchema export
- `src/types/chrome.d.ts` - MessageSender.url? 추가
- `tests/e2e/hints.e2e.ts` - e2e 12개(신규)

## Decisions Made

frontmatter `key-decisions` 참고. 요약: files_modified 목록 밖의 4개 최소 보강(mode-indicator.ts의 showTransientMessage, settings-schema.ts의 FingerprintSchema export, chrome.d.ts의 MessageSender.url?, background.ts의 op.kind 분기)은 모두 plan의 must_haves·D-11/D-24/T-01-16이 명시로 요구하는 기능을 구현하는 데 꼭 필요했다(Rule 3).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] mode-indicator.ts에 showTransientMessage 추가**
- **Found during:** Task 2 구현
- **Issue:** D-27 "번호표 비어 있음 → 모드 표시에 '누를 곳이 없어요' 2초"를 구현하려면 모드 표시(mode-indicator.ts)에 잠깐 다른 글자를 보였다가 되돌리는 기능이 필요했는데, 계획의 files_modified에는 이 파일이 없었다
- **Fix:** `showTransientMessage(text, ms)`를 추가 — 표시 중인 모드 글자를 ms 동안 text로 바꿨다가 원래 모드 글자로 되돌린다
- **Files modified:** src/page/overlay/mode-indicator.ts
- **Verification:** `tests/e2e/hints.e2e.ts`의 빈 페이지 시험(2초 뒤 사라짐 확인)
- **Committed in:** 88d4b09 (Task 2 GREEN 커밋)

**2. [Rule 3 - Blocking] settings-schema.ts의 FingerprintSchema export**
- **Found during:** Task 3 구현
- **Issue:** `messages.ts`가 `recordPress` 페이로드를 zod로 검사하려면 실제 Fingerprint zod 스키마가 필요했다. 별도로 다시 정의하면 두 정의가 어긋날 위험이 있었다
- **Fix:** 기존 `FingerprintSchema`(원래 module-private) 선언에 `export`만 추가해 재사용
- **Files modified:** src/core/settings-schema.ts
- **Verification:** `pnpm typecheck && pnpm lint` 통과, e2e 고정 번호·자주 누른 기록 시험 통과
- **Committed in:** d7ff659 (Task 3 GREEN 커밋)

**3. [Rule 3 - Blocking] chrome.d.ts의 MessageSender.url? 추가**
- **Found during:** Task 3 구현
- **Issue:** T-01-16(다른 사이트 기록 조작 방지)을 지키려면 `sender.url`에서 계산한 실제 origin이 필요한데, 최소 ambient 선언에는 이 필드가 없었다
- **Fix:** `MessageSender` 인터페이스에 `url?: string` 추가
- **Files modified:** src/types/chrome.d.ts
- **Verification:** `pnpm typecheck` 통과, "SW가 site:<origin>에 고정 번호를 쓰면" 등 e2e 통과
- **Committed in:** d7ff659 (Task 3 GREEN 커밋)

**4. [Rule 3 - Blocking] background.ts의 op.kind 분기 추가**
- **Found during:** Task 3 구현
- **Issue:** `recordPress` 메시지를 실제 저장자(storage-writer.ts)에 연결하는 배선은 background.ts에서만 가능한데, 계획 프론트매터 files_modified에는 이 파일이 없었다
- **Fix:** `storage/request`의 `op.kind`로 분기해 `setEnabled`/`recordPress`를 각각 처리하도록 수정
- **Files modified:** src/entrypoints/background.ts
- **Verification:** e2e "누르기 뒤 storage.local의 presses가 형식대로 저장되고..." 통과
- **Committed in:** d7ff659 (Task 3 GREEN 커밋)

---

**Total deviations:** 4 auto-fixed (전부 Rule 3 - 계획 files_modified 목록 밖이었지만 명시된 요구사항 구현에 꼭 필요)
**Impact on plan:** 전부 D-11·D-24·D-27·T-01-16이 요구하는 최소 보강이며 범위를 벗어나지 않는다. 새 색·서체·의존성·권한은 추가하지 않았다.

## Issues Encountered

- e2e 시험 안정화: 같은 키(KeyF·Digit1)를 연달아 두 번 누르는 시험은 떨림 필터(D-07, 기본 300ms)에 걸려 두 번째 입력이 무시됐다 — 시험의 대기 시간을 300ms보다 넉넉히 띄워 해결(제품 코드 변경 아님, 실제 떨림 필터 동작이 맞음)
- e2e 시험 안정화: `page.goto()` 직후 곧바로 F를 누르면 도우미 활성화(`storage.sync.get`)나 collector의 첫 수집(MutationObserver, 특히 인라인 `<script>`로 요소를 만드는 픽스처 페이지)이 아직 끝나지 않아 간헐 실패가 재현됐다 — 고정 시간 대기 대신 모드 표시가 "도우미"로 뜨는 것을 직접 기다리는 `waitForHelperReady` 헬퍼로 경합을 없앴다(전체 스위트 3회 연속 재실행으로 회귀 없음 확인)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-07(여러 프레임 번호 매기기)이 이어받을 것: `Item.fingerprint.framePath`는 이 계획에서 항상 `[]`이고, `hints.ts`·`orderHints`는 한 프레임 안에서만 동작한다. 맨 위 프레임이 여러 프레임의 요소 목록을 모아 번호를 매기는 구조(D-03)는 이 계획 범위 밖.
- Plan 01-08(위험한 버튼 예외)이 이어받을 것: 번호표로 위험한 버튼을 고르면 한 번 더 확인하는 화면은 이 계획에 없다(D-18).
- Phase 3(명령판 "번호 고정")이 이어받을 것: `site:<origin>`(sync)의 `pins`를 만드는 화면은 없다 — 이 계획은 이미 저장된 고정 번호를 F에서 읽어 순서에 반영하는 데까지만 구현했다.
- `<select>`·파일 입력·새 창이 번호표로 열리는지는 Plan 01-12 스파이크 범위(press.ts 기존 주석에 명시, 이 계획도 같은 `synthesizePress`를 재사용).
- 블로커 없음.

## Self-Check: PASSED

- 모든 생성/수정 파일 확인(`[ -f ]`): `src/core/fingerprint.ts`, `src/core/hint-order.ts`, `tests/unit/hint-order.test.ts`, `src/page/overlay/hints.ts`, `src/page/collector/collector.ts`, `src/entrypoints/content.ts`, `src/entrypoints/background.ts`, `src/page/overlay/mode-indicator.ts`, `src/shared/messages.ts`, `src/worker/storage-writer.ts`, `src/core/settings-schema.ts`, `src/types/chrome.d.ts`, `tests/e2e/hints.e2e.ts` — 전부 존재.
- 6개 커밋(`ac4eb84` test, `02937a4` feat, `d80163f` test, `88d4b09` feat, `99f2e00` test, `d7ff659` feat) `git log --oneline`에서 확인.
- 이 세션에서 plan-level `<verification>` 전부 새로 재실행: `pnpm exec vitest run tests/unit/hint-order.test.ts`(9 passed), `CI=true pnpm exec playwright test tests/e2e/hints.e2e.ts`(12 passed), `pnpm typecheck && pnpm lint`(둘 다 exit 0), 단일 저장자 grep(`grep -rn "storage\.\(sync\|local\)\.set" src/ | grep -v "src/worker/storage-writer.ts"`) 빈 결과.
- acceptance_criteria 재확인: Task 1(document·window·chrome 참조 없음, export 3개 존재, vitest 9 passed) · Task 2(`--label-size`·hex 없음, `keymap.toggleHints`·"누를 곳이 없어요" 존재, e2e 8 passed) · Task 3(`recordPress` 존재, 단일 저장자 grep 충족, origin 확인 존재, e2e 12 passed) — 모두 통과.
- 전체 e2e 스위트(57개)를 CI=true로 3회 연속 재실행해 0 failures 확인(회귀 없음).

---
*Phase: 01-click-helper-foundation*
*Completed: 2026-09-23*
