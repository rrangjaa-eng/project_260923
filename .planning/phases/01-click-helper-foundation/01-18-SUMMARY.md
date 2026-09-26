---
phase: 01-click-helper-foundation
plan: 18
subsystem: click-helper-safety
tags: [playwright, mv3-content-script, iframe, wxt, chrome-extension, dwell, confirm-dialog, ime]

# Dependency graph
requires:
  - phase: 01-click-helper-foundation
    provides: "확인 화면 CR-01 정리 패턴(01-09/01-16), 사이트별 끄기·site/query(01-13), 입력 모드·파이프라인(01-03/01-04/01-06), 옛 도우미 cleanedUp 가드 패턴 확장(01-17)"
provides:
  - "childConfirmOpen: 맨 위 위험 확인 화면이 떠 있는 동안 자식 프레임(다른 출처 포함)의 자석·머무르기가 스크림 뒤에서 계속 진행되지 않는다(CLICK-04, SAFE-01)"
  - "사이트 설정 읽기 재시도 루프(attemptReadSiteState/handleSiteReadFailure/scheduleSiteRetry, siteState: pending|known|failed): 맨 위는 site/query 없이 자기 출처로 즉시 판단해 실패와 무관하게 적용되고, 자식은 실패가 이어지는 동안 fail-closed하며 SITE_STATE_UNREADABLE_MESSAGE 토스트를 한 번 띄운 뒤 성공하면 회복한다(SAFE-04, IN-04)"
  - "문서 전체 편집기(designMode 문서, contenteditable 본문)의 Esc 나옴·되돌아옴(mode.ts escapeDocumentEditor/resumeDocumentEditor/isDocumentEditingRoot, pipeline.ts onModeChange 옵션·beforeinput 취소·compositionstart 되돌리기): 편집기를 깨뜨리지 않고 도우미 키로 나오고 다시 누르면 입력으로 돌아간다(KEY-01)"
  - "tests/practice-site/dwell-frame.html, tests/practice-site/doc-editor.html — 전용 작은 연습 페이지(D-28)"
affects: [01-19, phase-1-verification]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 13164
  tasks: 3
  commits: 6
plan_head_before: b12febdbea5e200dd307c63b08c6c41e35396ff6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "자식 프레임 쪽 확인 화면 방어(childConfirmOpen): confirm/state {open:true} 방송을 받으면 자식도 맨 위 openDangerConfirm의 CR-01 세 가지 정리(currentTargetId=null, hideRing(), stopDwellLoopIfRunning())를 그대로 하고, evaluateMagnet 조기 반환 조건에 더해 스크림 뒤 재포착을 막는다"
    - "사이트 상태를 pending/known/failed 세 값으로 두고 실패 스트릭·지수 백오프([250,500,1000,2000,5000]ms)·인스턴스당 1회 알림으로 재시도하는 루프 — 01-17의 cleanedUp 가드 관례(비동기 이어짐 맨 앞에서 검사)를 이 재시도 루프 전체(await 뒤, 재시도 타이머 콜백, 리스너 등록)로 넓혔다"
    - "문서 전체 편집기 Esc는 blur() 대신 모듈 상태(escapedFromDocumentEditor)만 바꾼다 — blur는 캐럿을 지워 편집기가 이후 키를 받지 못하게 만든다(probe evidence). 파이프라인이 나옴 상태에서 trusted beforeinput만 취소해 편집을 막고, focus는 건드리지 않는다"
    - "포커스가 옮겨가지 않는 모드 전환(문서 전체 편집기 나옴·되돌아옴)은 focusin·focusout에 기대지 못한다 — createInputPipeline에 onModeChange 콜백을 추가해 파이프라인이 모드를 바꿀 때마다 호출자(content.ts)에 직접 알린다"

key-files:
  created:
    - tests/practice-site/dwell-frame.html
    - tests/practice-site/doc-editor.html
    - tests/e2e/doc-editor.e2e.ts
  modified:
    - src/entrypoints/content.ts
    - src/entrypoints/background.ts
    - src/page/input/mode.ts
    - src/page/input/pipeline.ts
    - tests/e2e/dwell.e2e.ts
    - tests/e2e/site-toggle.e2e.ts

key-decisions:
  - "IN-04 결정(D-06·D-20 근거): 사이트 설정 읽기가 실패하는 동안 그 프레임을 fail-closed한다(끈 사이트에서 조용히 도는 것보다 안전). 일시 실패는 재시도로 스스로 회복하고, 연속 3회부터 인스턴스당 한 번 알린다. 맨 위는 site/query 자체를 보내지 않아 이 실패 경로 밖에 있다"
  - "KEY-01 결정: '문서 전체 편집기'는 초점 대상이 자기 문서의 body나 documentElement이고 편집 가능한 경우로 정의한다. Esc는 blur 대신 나옴 표시만 하고, beforeinput 취소로 편집만 막는다(캐럿·선택은 건드리지 않음). 되돌아가는 신호는 (a) 편집기를 다시 누름(trusted pointerdown 주 버튼), (b) 한글 조합 시작(compositionstart, beforeinput 취소로 막을 수 없어), (c) 다른 요소로 focusin 세 가지"
  - "sendRecordPress는 cachedTopOrigin을 모르면 기록을 보내지 않는다 — 자기 출처로 대체하던 이전 완화(D-06 유사)는 다른 사이트인데 같은 키로 잘못 기록할 수 있어 없앴다(WR-05 정확성 우선)"
  - "CDP 조합 입력 시험(behavior 5, '가능할 때만')을 실측으로 확인해 넣었다 — 이 샌드박스의 Input.imeSetComposition은 trusted compositionstart를 만든다"
  - "0단계 정리 확인: 01-17이 만든 editor-frames.e2e.ts·content.ts에 '주소 없는 새 창에는 도우미가 없다'를 단언하는 잔여 시험·가드는 없었다(grep 확인) — 지울 것 없음, 별도 커밋 불필요"

patterns-established:
  - "확인 화면·머무르기가 여러 프레임에 걸칠 때는 맨 위뿐 아니라 관여한 모든 프레임이 자기 쪽 진행 상태를 멈춰야 한다(CR-01을 자식 쪽으로 대칭 이동)"
  - "재시도가 필요한 비동기 읽기는 pending/known/failed 3상태 + 실패 스트릭 + 지수 백오프 + 인스턴스당 1회 알림 패턴으로 통일한다"

requirements-completed: [CLICK-04, SAFE-01, KEY-01]
# SAFE-04는 01-19와 공유 선언된 ID라(#2388 공유 ID 게이트) 01-19가 끝나야 requirements.ready-ids가
# 완료로 표시한다 — 이 계획의 몫(IN-04 fail-closed·재시도·알림)은 여기서 실제로 끝났다.

coverage:
  - id: D1
    description: "맨 위 위험 확인 화면이 떠 있는 동안 자식 프레임(다른 출처 포함)의 머무르기·자석이 멈춰 확인 화면 뒤 요소가 눌리지 않고, 닫은 뒤에는 떠났다 돌아오면 평소대로 한 번 누른다"
    requirement: "CLICK-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/dwell.e2e.ts (신규 2개: 확인 화면 중 자식 머무르기 0 단언, 닫은 뒤 정상 동작)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/confirm.e2e.ts, tests/e2e/frames.e2e.ts, tests/e2e/editor-frames.e2e.ts — 54개 회귀 없음"
        status: pass
    human_judgment: false
  - id: D2
    description: "이 사이트에서 끄기는 site/query 실패와 무관하게 맨 위에 적용되고, 자식 프레임은 실패가 이어지는 동안 fail-closed하며 알리고, 성공하면 회복한다. 정리된 옛 인스턴스의 재시도 이어짐은 조용하다(호스트·토스트 중복 없음)"
    requirement: "SAFE-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/site-toggle.e2e.ts (신규 3개: 맨 위 적용, fail-closed+알림+회복, 옛 인스턴스 조용함)"
        status: pass
      - kind: other
        ref: "뮤테이션 확인(SUMMARY 본문 참고): 가드 3곳(attemptReadSiteState await 뒤, scheduleSiteRetry, handleSiteReadFailure)을 모두 빼고 돌리면 host 2개·toast 2개로 실패, 되돌리면(git diff 없음) 다시 통과"
        status: pass
      - kind: e2e
        ref: "tests/e2e/hints.e2e.ts, tests/e2e/frames.e2e.ts, tests/e2e/editor-frames.e2e.ts, tests/e2e/helper-toggle.e2e.ts, tests/e2e/lifecycle.e2e.ts — 65개 회귀 없음"
        status: pass
    human_judgment: false
  - id: D3
    description: "문서 전체가 편집 가능한 편집기(designMode 문서, contenteditable 본문 — src= iframe 둘 + 01-17 document.write 편집기)에서 Esc를 누르면 편집기를 깨뜨리지 않고 모드 표시가 도우미가 되며, 그동안 글자가 들어가지 않고 F 같은 도우미 키가 동작한다. 편집기를 다시 누르거나 한글 조합을 시작하면 입력 중으로 돌아간다"
    requirement: "KEY-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/doc-editor.e2e.ts (5개: 세 편집기 모양 공통 시나리오 3개, F 도우미 키 동작 1개, CDP 한글 조합 입력 1개)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/input-filter.e2e.ts, tests/e2e/frames.e2e.ts, tests/e2e/editor-frames.e2e.ts, tests/e2e/confirm.e2e.ts — 59개 회귀 없음(보통 입력칸 Esc 동작 그대로)"
        status: pass
    human_judgment: false
  - id: D4
    description: "이 계획이 건드린 e2e(dwell 10, site-toggle 15, doc-editor 5)와 회귀 파일이 모두 CI=true로 통과하고, lint·typecheck·build가 통과한다. 전체 게이트(CI=true pnpm test 한 번)·DOM 감사·외부 전송 grep은 01-19 마지막 작업"
    verification:
      - kind: other
        ref: "pnpm lint && pnpm typecheck && CI=true pnpm build — 통과"
        status: pass
      - kind: e2e
        ref: "CI=true pnpm exec playwright test tests/e2e/dwell.e2e.ts tests/e2e/site-toggle.e2e.ts tests/e2e/doc-editor.e2e.ts tests/e2e/hints.e2e.ts tests/e2e/helper-toggle.e2e.ts tests/e2e/lifecycle.e2e.ts — 67 passed"
        status: pass
    human_judgment: false

duration: 약 45분 이상(정확한 시작 시각 미기록 — 첫 RED 커밋~마지막 GREEN 커밋 04:09~04:54 UTC 기준, 읽기·설계 시간 포함하면 더 김)
completed: 2026-09-26
status: complete
---

# Phase 1 Plan 18: 확인 화면 자식 프레임 방어·IN-04 fail-closed·문서 전체 편집기 Esc Summary

**맨 위 위험 확인 화면이 떠 있는 동안 자식 프레임(다른 출처 포함)의 머무르기·자석을 멈추는 `childConfirmOpen`, `site/query` 실패에도 맨 위는 무관하게 적용되고 자식은 재시도·fail-closed·알림·회복하는 사이트 상태 루프, designMode·contenteditable 문서 전체 편집기에서 Esc가 편집기를 깨뜨리지 않고 도우미 키로 돌아가는 `escapeDocumentEditor`/`resumeDocumentEditor`를 넣었다.**

## Performance

- **Duration:** 약 45분 이상(정확한 벽시계 미기록 — 커밋 타임스탬프 04:09~04:54 UTC 기준)
- **Tasks:** 3/3 완료
- **Files modified:** 9 (신규 3 — `tests/practice-site/dwell-frame.html`, `tests/practice-site/doc-editor.html`, `tests/e2e/doc-editor.e2e.ts`; 수정 6)
- **Commits:** 6(RED→GREEN 세 쌍)

## Accomplishments

- **Task 1(tracer) — 자식 프레임 머무르기 vs 맨 위 확인 화면:** planner probe가 실측한 결함(맨 위 확인 화면이 뜬 채로 자식 프레임의 머무르기가 계속 차올라 다른 요소가 눌림)을 `tests/practice-site/dwell-frame.html` + `tests/e2e/dwell.e2e.ts` 신규 2개로 먼저 재현(RED)한 뒤, `content.ts`에 자식 프레임 전용 `childConfirmOpen` 불리언을 추가해 확인 화면이 열리면 맨 위 `openDangerConfirm`의 CR-01 정리(`currentTargetId=null`, `hideRing()`, `stopDwellLoopIfRunning()`)를 자식도 그대로 하고 `evaluateMagnet` 조기 반환에도 반영했다(GREEN). 0단계 확인 결과: 01-17이 남긴 "주소 없는 새 창에는 도우미가 없다" 관련 잔여 시험·가드는 없었다(지울 것 없음).
- **Task 2 — IN-04(site/query 실패 시 fail-open):** `background.ts`에 e2e 전용 훅 `failSiteQueryForE2E(count)`를 추가하고, `content.ts`의 사이트 상태 읽기를 `pending`/`known`/`failed` 3상태 재시도 루프(`attemptReadSiteState`/`handleSiteReadFailure`/`scheduleSiteRetry`)로 다시 짰다. 맨 위는 `main()` 시작부에서 곧바로 `cachedTopOrigin`을 채워 `site/query` 자체를 보내지 않으므로 이 실패 경로와 무관하게 사이트 끄기가 적용된다. 자식은 연속 실패가 이어지는 동안 fail-closed하고, 연속 3회째 `SITE_STATE_UNREADABLE_MESSAGE`(`'사이트 설정을 다시 읽는 동안 여기서는 도우미를 껐어요.'`) 토스트를 인스턴스당 한 번 띄우며, `[250, 500, 1000, 2000, 5000]`ms 간격으로 계속 재시도해 성공하면 회복한다. **뮤테이션 확인**: 이 재시도 루프의 `cleanedUp` 가드 3곳(자식 site/query await 뒤, `scheduleSiteRetry`, `handleSiteReadFailure`)을 모두 빼고 "옛 인스턴스 조용함" 시험을 돌리면 host 2개·toast 2개로 실패했고, 되돌린 뒤(`git diff` 없음) 다시 통과함을 확인했다.
- **Task 3 — 문서 전체 편집기 Esc(KEY-01):** designMode 문서·contenteditable 본문에서 Esc가 도우미 키로 돌아가지 못하던 결함(probe evidence: `blur()`가 캐럿을 지워 편집기가 키를 받지 못하게 만든다)을 `tests/practice-site/doc-editor.html` + `tests/e2e/doc-editor.e2e.ts` 신규 5개로 재현(RED)한 뒤, `mode.ts`에 `isDocumentEditingRoot`·`escapeDocumentEditor`/`resumeDocumentEditor`/`isEscapedFromDocumentEditor`를, `pipeline.ts`에 `onModeChange` 옵션과 `beforeinput` 취소·`compositionstart`/주 버튼 `pointerdown`/`focusin` 되돌리기를 추가했다(GREEN). 세 편집기 모양(`#frame-design` src=, `#frame-cebody` 다른 출처 contenteditable, 01-17 `#frame-editor` document.write+designMode) 모두 같은 결과를 낸다. CDP 조합 입력(behavior 5, "가능할 때만")도 이 샌드박스에서 trusted `compositionstart`를 만드는 것을 실측 확인해 시험에 넣었다.

## Task Commits

Each task was committed atomically (TDD RED→GREEN):

1. **Task 1(tracer): 자식 프레임 머무르기 → 맨 위 확인 화면 → 뒤에서는 안 눌림** — `d6df3cd`(test, RED) → `c6c657e`(fix, GREEN)
2. **Task 2: IN-04 — 사이트 설정 재시도·fail-closed·알림** — `d04e3f7`(test, RED) → `be9438e`(fix, GREEN)
3. **Task 3: 문서 전체 편집기 Esc — 도우미로, 다시 누르면 입력** — `8b9f4c1`(test, RED) → `6591cc2`(fix, GREEN)

_Note: TDD 작업은 RED→GREEN 두 커밋. Task 2·3의 GREEN 커밋에는 테스트 자체의 flake 수정(고정 sleep → 조건 재시도)도 함께 포함했다(제품 코드 아님, 별도 커밋으로 나누지 않음 — 같은 GREEN 확인 사이클 안)._

## Files Created/Modified

- `tests/practice-site/dwell-frame.html` (신규) - 맨 위 위험 버튼(`#btn-delete`) + 다른 출처 자식 프레임의 일반 버튼(`#btn-save`) 전용 작은 연습 페이지
- `tests/practice-site/doc-editor.html` (신규) - `#frame-design`(src=, designMode), `#frame-cebody`(src=, 다른 출처 contenteditable 본문)
- `tests/e2e/doc-editor.e2e.ts` (신규) - 5개 e2e(세 편집기 모양 공통 시나리오, F 도우미 키, CDP 조합 입력)
- `src/entrypoints/content.ts` - `childConfirmOpen`(자식 프레임 확인 화면 방어), 사이트 상태 재시도 루프(`attemptReadSiteState` 등), `SITE_STATE_UNREADABLE_MESSAGE`, 맨 위 `cachedTopOrigin` 즉시 채움, `sendRecordPress` cachedTopOrigin 없으면 보내지 않음, `createInputPipeline`에 `onModeChange` 연결
- `src/entrypoints/background.ts` - e2e 전용 `failSiteQueryForE2E(count)` 훅, `site/query` 분기 앞 실패 흉내
- `src/page/input/mode.ts` - `isDocumentEditingRoot`, `escapeDocumentEditor`/`resumeDocumentEditor`/`isEscapedFromDocumentEditor`, 이를 반영한 `currentMode()`
- `src/page/input/pipeline.ts` - `createInputPipeline`의 `onModeChange` 옵션, Esc 분기(문서 전체 편집기는 blur 대신 나옴 표시), `beforeinput`·`compositionstart` 리스너, pointerdown 되돌리기, focusin 되돌리기
- `tests/e2e/dwell.e2e.ts` - 신규 2개(확인 화면 중 자식 머무르기, 닫은 뒤 정상 동작)
- `tests/e2e/site-toggle.e2e.ts` - 신규 3개(맨 위 적용, fail-closed+알림+회복, 옛 인스턴스 조용함)

## Decisions Made

프론트매터 `key-decisions` 참고. 요약:
- IN-04: 읽기 실패가 이어지는 동안 fail-closed, 성공 시 회복, 연속 3회부터 인스턴스당 1회 알림. 맨 위는 이 실패 경로 밖(자기 출처로 즉시 판단)
- KEY-01: "문서 전체 편집기" = 초점 대상이 자기 문서의 body/documentElement이고 편집 가능. Esc는 blur 대신 나옴 표시, beforeinput 취소로 편집만 막음. 되돌아가는 신호 셋: 다시 누름·한글 조합 시작·다른 요소로 focusin
- `sendRecordPress`의 자기 출처 대체 완화 제거(WR-05 정확성 우선)
- CDP 조합 입력 시험은 실측 확인 후 포함(샌드박스가 trusted compositionstart를 만든다)
- 0단계: 01-17의 "주소 없는 새 창 도우미 없음" 잔여물 없음 확인, 지울 것 없음

## Deviations from Plan

None - 계획대로 실행했다. Task 2·3 GREEN 커밋에 포함된 테스트 자체의 안정화(고정 sleep → 조건 재시도)는 새 제품 코드 결함이 아니라 새로 만든 테스트 헬퍼의 타이밍 여유 조정이라 별도 편차로 분류하지 않았다.

## Issues Encountered

- 연습 페이지 fixture 버그(자체 발견·즉시 수정, 제품 코드 아님): `dwell-frame.html` 초안에서 카운터 span id를 `makeButton`의 `id + '-count'` 규칙(예: `btn-save-count`)으로 생성했으나, 계획과 시험이 요구하는 id는 `#save-count`/`#delete-count`였다 — `makeButton`에 별도 `countId` 매개변수를 추가해 고쳤다(RED 커밋 이전, 커밋 이력에 남지 않음).
- e2e 실행 중 `tests/e2e/editor-frames.e2e.ts`의 "document.write로 채운 프레임이 막 생겨도 옛 인스턴스는 조용하다" 시험이 큰 배치 실행에서 산발적으로 1회씩 실패하는 것을 Task 1·2·3 각각의 회귀 확인 중 세 번 관측했다. `systematic-debugging`으로 확인: (a) 이 계획의 변경(`content.ts` diff)을 stash로 뺀 상태에서도 같은 배치가 통과·실패를 오갔고, (b) 해당 시험만 단독 반복 실행(3~5회)하면 항상 통과했다 — 이 계획의 변경과 무관한 기존 타이밍 민감 flake로 결론짓고 더 조사하지 않았다(제품 코드 변경 없음).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 01-19가 남은 gap(ELEM-02 관련 나머지, 맨 위 about: 새 창 전체 지원 — 사이트 설정 출처 키, 아이콘 표시, 재주입, 전용 시험)과 전체 게이트(`CI=true pnpm test` 한 번, DOM 감사 재실행, 외부 전송 grep)를 이어받는다.
- SAFE-04 요구사항은 01-19와 공유 선언된 ID라 01-19가 끝나야 `requirements.ready-ids`가 완료로 표시한다 — 이 계획의 몫(IN-04)은 실제로 끝났다.
- `editor-frames.e2e.ts` 회귀 시험 개수(01-19 마지막 게이트가 참고할 수치): **16개**(`grep -c "^test(" tests/e2e/editor-frames.e2e.ts`로 확인).

---
*Phase: 01-click-helper-foundation*
*Completed: 2026-09-26*

## Self-Check: PASSED

- 생성 파일 확인: `tests/practice-site/dwell-frame.html`, `tests/practice-site/doc-editor.html`, `tests/e2e/doc-editor.e2e.ts` — 모두 디스크에 존재.
- 커밋 6개 모두 `git log --oneline --all`에서 확인: `d6df3cd`, `c6c657e`, `d04e3f7`, `be9438e`, `8b9f4c1`, `6591cc2`.
- `commits: 6` — `git rev-list --count b12febdbea5e200dd307c63b08c6c41e35396ff6..HEAD`로 측정, `plan_head_before`와 일치.
