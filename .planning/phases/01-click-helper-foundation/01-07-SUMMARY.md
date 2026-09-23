---
phase: 01-click-helper-foundation
plan: 07
subsystem: browser-extension
tags: [mv3, content-script, service-worker, iframe, cross-origin, playwright]

# Dependency graph
requires:
  - phase: 01-click-helper-foundation
    provides: 요소 수집기(collector.ts)·번호표 오버레이·입력 파이프라인·모드 표시(Plan 01-01~01-06)
provides:
  - "frame-tree.ts: 여러 프레임 보고를 맨 위 좌표로 합성하는 순수 함수(composeTree, resolveReports)"
  - "frame-path.ts: chrome.runtime.getFrameId 없이 창 위치 경로를 스스로 계산하는 순수 함수(framePathOf)"
  - "worker/relay.ts: 프레임 사이 메시지 중계(보고 모음, 누르기 요청 라우팅, 키·모드 전달)"
  - "iframe(같은 출처·다른 출처·중첩) 안 요소가 맨 위 화면 번호표에 합쳐지고, 초점이 iframe 안에 있어도 F·숫자·모드 표시가 동작한다(ELEM-02)"
affects: [01-08, 01-09, 01-10, 01-11, 01-12, 01-13, 01-14, 01-15, 01-16]

# Actuals (#2632)
actuals:
  tokens: 19000
  tasks: 3
  commits: 9

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "프레임 창 위치 경로(index path): chrome.runtime.getFrameId가 Chrome에 없어(Firefox 전용), 각 프레임이 window.parent.frames에서 자기 순번을 스스로 계산해 보고하고 service worker가 sender.frameId와 맞춘다"
    - "relay.ts의 탭별 보고 캐시: 부모 보고의 자식 목록이 바뀌면(iframe 추가/삭제) 지워진 옛 경로로 시작하는 보고를 모두 지우고, 형제 프레임에 frame/refresh를 방송해 즉시 다시 계산해 보고하게 한다"
    - "번호표 판단은 항상 맨 위 프레임에서만: 자식 프레임은 키를 삼켜 hints/key로 전달만 하고, 열지/닫을지/누를지는 맨 위가 결정한다"
    - "document.activeElement instanceof HTMLIFrameElement로 초점이 자식 프레임에 위임됐는지 판정(교차 출처에서도 항상 가능)"

key-files:
  created:
    - src/core/frame-tree.ts
    - src/core/frame-path.ts
    - src/worker/relay.ts
    - tests/unit/frame-tree.test.ts (확장)
    - tests/unit/frame-path.test.ts
    - tests/practice-site/frames.html
    - tests/e2e/frames.e2e.ts
  modified:
    - src/page/collector/collector.ts
    - src/shared/messages.ts
    - src/entrypoints/background.ts
    - src/entrypoints/content.ts
    - src/types/chrome.d.ts
    - tests/e2e/fixtures.ts
    - tests/e2e/skeleton.e2e.ts
    - docs/superpowers/specs/2026-09-23-tremor-browser-helper-design.md

key-decisions:
  - "RESEARCH A2 정정: chrome.runtime.getFrameId는 Chrome에 없다(Firefox 전용 API였다, 오케스트레이터가 근본 원인 확인). 대신 각 프레임이 스스로 계산하는 창 위치 경로(selfPath)와 부모가 매기는 상대 순번(index)을 service worker가 실제 frameId로 맞추는 방식으로 설계를 바꿨다(window.postMessage·webNavigation·ELEM-02 축소 없이)."
  - "형제 iframe이 지워지면 남은 형제의 상대 순번이 당겨진다 — relay.ts가 지워진 자식의 옛 경로로 시작하는 보고를 지우고 모든 프레임에 frame/refresh를 방송해 자기 경로를 다시 계산·보고하게 한다."
  - "자식 프레임의 번호표 키(F·숫자·0·Esc)는 항상 맨 위로 전달만 하고 판단은 맨 위에서 한다 — 자식은 로컬 상태를 갖지 않는다."
  - "초점이 자식 프레임에 위임됐는지는 document.activeElement instanceof HTMLIFrameElement로 판정하고, 그 프레임의 최신 mode/report를 표시한다."

patterns-established:
  - "프레임 간 통신은 언제나 chrome.runtime/chrome.tabs.sendMessage만 쓴다(window.postMessage 금지, D-09) — relay.ts가 탭 단위로 모으고 라우팅한다."
  - "collector.ts의 buildFrameReport()는 창 접근 실패를 프레임별로 개별 try/catch로 삼켜, 한 iframe의 실패가 그 프레임의 다른 기능(자석·번호표)까지 멎게 하지 않는다."

requirements-completed: [ELEM-02]

coverage:
  - id: D1
    description: "같은 출처·다른 출처·중첩 iframe 안 요소가 맨 위 화면 번호표에 한 번만(중복 없이) 번호가 매겨진다"
    requirement: "ELEM-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/frames.e2e.ts#F를 누르면 맨 위·같은 출처 자식·다른 출처 자식·중첩 손자 프레임의 요소 모두에 번호표가 붙고 번호가 1부터 중복 없다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/frames.e2e.ts#모든 번호표 쌍이 서로 겹치지 않는다"
        status: pass
    human_judgment: false
  - id: D2
    description: "iframe 안 요소의 번호표가 그 요소의 맨 위 좌표 자리(±2px)에 그려지고, 잘린 요소는 제외된다"
    requirement: "ELEM-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/frames.e2e.ts#iframe 안 요소의 번호표가 그 요소의 맨 위 좌표 사각형에서 배치 규칙 자리(±2px)에 있다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/frames.e2e.ts#자식 iframe을 부모 안에서 스크롤해 반쯤 가린 뒤 F → 가려진 요소에는 번호표가 없다"
        status: pass
    human_judgment: false
  - id: D3
    description: "다른 출처 iframe 안 요소의 번호를 누르면 그 요소가 눌리고(초점이 iframe 안에 있어도), iframe 안 자석 커서 테두리가 그 프레임 안에서 바로 그려진다"
    requirement: "ELEM-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/frames.e2e.ts#other.test 자식의 버튼 번호를 누르면 그 버튼 카운터가 1 오른다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/frames.e2e.ts#other.test 자식 프레임 안(입력칸 밖)에 초점이 있어도 F로 번호표가 뜨고 숫자로 다른 프레임 요소가 눌린다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/frames.e2e.ts#other.test 자식의 작은 버튼 근처로 커서를 두면 그 프레임 안에 테두리가 그려진다"
        status: pass
    human_judgment: false
  - id: D4
    description: "iframe 안 입력칸에 초점이 가면 맨 위 모드 표시가 typing이 되고, Esc로 helper로 돌아간다. 번호표가 안 떠 있을 때 자식 프레임의 숫자는 그 프레임 페이지로 그대로 간다"
    requirement: "ELEM-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/frames.e2e.ts#중첩 손자 프레임의 입력칸에 초점이 가면 맨 위 모드 표시가 typing이 되고, Esc를 누르면 helper로 돌아간다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/frames.e2e.ts#번호표가 떠 있지 않을 때 자식 프레임에서 누른 숫자는 그 프레임 페이지로 그대로 간다"
        status: pass
    human_judgment: false
  - id: D5
    description: "페이지 스크립트가 iframe을 지우거나 스크롤로 가려도(형제 순번이 당겨져도) 번호표가 올바르게 갱신된다"
    requirement: "ELEM-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/frames.e2e.ts#페이지 스크립트가 iframe 하나를 지운 뒤 F → 그 프레임 요소의 번호표가 없다"
        status: pass
    human_judgment: false

duration: 75min
completed: 2026-09-23
status: complete
---

# Phase 1 Plan 7: iframe 프레임 트리 합성·중계·키·모드 전달 Summary

**Chrome에 없는 `chrome.runtime.getFrameId` 대신 프레임 스스로 계산하는 창 위치 경로(selfPath)로 같은 출처·다른 출처·중첩 iframe 요소를 맨 위 번호표에 합치고, 초점이 iframe 안에 있어도 번호표 키·입력 모드가 맨 위로 전달된다.**

## Performance

- **Duration:** 약 75분(첫 RED 커밋~마지막 GREEN 커밋 기준, 이전 세션에서 이어짐)
- **Started:** 2026-09-23T19:06:57Z
- **Completed:** 2026-09-23T20:21:41Z
- **Tasks:** 3
- **Files modified:** 15 (신규 7 + 수정 8)

## Accomplishments
- `frame-tree.ts`(순수): 여러 프레임의 보고를 맨 위 좌표로 합성(오프셋·잘림·framePath), `resolveReports`로 selfPath+상대 순번을 실제 frameId로 맞춘다.
- `frame-path.ts`(순수): `chrome.runtime.getFrameId` 없이 각 프레임이 `window.parent.frames`를 거슬러 올라가며 자기 창 위치 경로를 스스로 계산한다.
- `collector.ts`·`relay.ts`·`background.ts`·`content.ts`: 프레임 보고(`frame/report`) → 중계(탭별 모음, `frames/reports`) → 맨 위 번호 매기기(`composeTree`) → 해당 프레임 누르기(`hints/press`→`press/request`) 전체 왕복.
- 같은 출처·다른 출처(`other.test`)·중첩(2단) iframe 안 요소 모두 맨 위 화면에서 번호가 한 번만(중복 없이) 매겨지고, 초점이 어느 프레임에 있어도 F·숫자·Esc가 동작하며, 맨 위 모드 표시가 초점 있는 프레임의 입력 모드(`typing`/`helper`)를 따른다.
- 형제 iframe이 지워져 남은 형제의 순번이 당겨지는 경우까지 `relay.ts`의 옛 경로 정리 + `frame/refresh` 방송으로 올바르게 갱신된다.

## Task Commits

Each task was committed atomically (일부는 실행 중 발견한 근본 설계 정정으로 계획보다 커밋이 늘었다):

1. **Task 1: 프레임 트리 합성(순수 함수)**
   - `16c7126` test(01-07): 프레임 트리 합성 실패 단위 시험 8개(RED)
   - `aab2d53` feat(01-07): frame-tree.ts — 프레임 트리를 맨 위 좌표로 합성(GREEN)
2. **Task 2: 프레임 보고·중계·맨 위 번호 매기기·해당 프레임에서 누르기** (오케스트레이터 지시로 `chrome.runtime.getFrameId` → 경로 방식으로 설계 정정, 순수 함수를 먼저 RED/GREEN으로 고정한 뒤 이어감)
   - `5a20e05` test(01-07): 프레임 보고·중계·번호 매기기·해당 프레임 누르기 실패 e2e 7개(RED)
   - `96940f3` test(01-07): 창 위치 경로·resolveReports 실패 단위 시험(RED, getFrameId 대체)
   - `b69f6a2` feat(01-07): framePathOf·resolveReports 순수 함수 GREEN
   - `f78f14c` feat(01-07): 프레임 보고·중계·맨 위 번호 매기기·해당 프레임 누르기 GREEN
3. **Task 3: iframe 안 키 입력과 입력 모드를 맨 위로 전달**
   - `2f44b8e` test(01-07): iframe 안 키·모드 전달 실패 e2e 3개(RED)
   - `d7baa02` docs(01-07): getFrameId 정정 — Chrome엔 없다, 대신 경로 방식(설계 문서, 오케스트레이터 지시)
   - `5ecbbb7` feat(01-07): iframe 안 키·모드를 맨 위로 전달 GREEN

**Plan metadata:** (이 커밋 직후 기록)

_Note: RESEARCH A2가 실제로는 틀렸음이 Task 2 실행 중 드러나 순수 함수(frame-path.ts) RED/GREEN을 먼저 끼워 넣었다._

## Files Created/Modified
- `src/core/frame-tree.ts` - `composeTree`(맨 위 좌표 합성) + `resolveReports`(selfPath↔frameId 맞춤), 순수 함수
- `src/core/frame-path.ts` - `framePathOf`: 창 위치 경로를 스스로 계산(순수 함수, `chrome.runtime.getFrameId` 대체)
- `src/worker/relay.ts` - 탭별 프레임 보고 모음·중계, 누르기/키/모드 라우팅, 지워진 iframe 경로 정리·`frame/refresh` 방송
- `src/page/collector/collector.ts` - `buildFrameReport()`: 자기 요소 + 자식 iframe 상대 순번·오프셋·clip·pathKey 보고(창 접근 실패는 개별 삼킴)
- `src/shared/messages.ts` - `frame/report`, `frames/reports`, `hints/press`, `press/request`, `hints/state`, `frame/refresh`, `hints/key`, `mode/report`
- `src/entrypoints/background.ts` - relay로 프레임 메시지 라우팅
- `src/entrypoints/content.ts` - 맨 위: `composeTree`로 번호 매기기, `handleTopHintKey`, `refreshModeDisplay`. 자식: 번호표 키 삼켜 전달, 초점 변화 때 `mode/report`
- `src/types/chrome.d.ts` - `chrome.tabs.sendMessage`(옵션 포함)·`onRemoved`·`onUpdated` 타입 보강
- `tests/practice-site/frames.html` - 연습 사이트: 맨 위(같은 출처·다른 출처·중첩 자식)+`?child=` 분기
- `tests/e2e/frames.e2e.ts` - e2e 10개(Task 2 behavior 7 + Task 3 behavior 3)
- `tests/e2e/fixtures.ts`, `tests/e2e/skeleton.e2e.ts` - `EXTENSION_PATH`를 `global-setup.ts`의 CI 분기와 맞춤(버그 수정, 계획과 무관)
- `docs/superpowers/specs/2026-09-23-tremor-browser-helper-design.md` - `chrome.runtime.getFrameId` 서술을 경로 방식으로 정정

## Decisions Made
- **RESEARCH A2 정정(오케스트레이터 확인):** `chrome.runtime.getFrameId`는 Firefox 전용 API로 Chrome에는 없다(`systematic-debugging`으로 서비스 워커의 `chrome.runtime` 키 목록에 없음과 `TypeError: ... is not a function`을 재현·확인). 대신 각 프레임이 `window.parent.frames`를 거슬러 올라가며 스스로 창 위치 경로(`selfPath`)를 계산해 보고하고, 부모는 자기 iframe의 상대 순번(`index`, `window.frames[i] === iframeEl.contentWindow`)만 보고한다. service worker(`relay.ts`)가 이 둘을 모아 `resolveReports`로 실제 frameId를 맞춘다. `window.name`(사이트의 named frame을 깨뜨림)·`webNavigation` 권한 추가·ELEM-02 축소는 모두 기각했다.
- **형제 순번 당김 문제:** iframe이 지워지면 남은 형제의 상대 순번이 당겨져(예: 순번 1이 지워지면 순번 2였던 형제가 새 순번 1이 됨) 그 형제의 예전 `selfPath`가 낡는다. `relay.ts`가 지워진 자식의 옛 경로(부모 경로+옛 순번)로 시작하는 모든 보고를 즉시 지우고, 탭의 모든 프레임에 `frame/refresh`를 방송해 스스로 다시 계산·보고하게 했다. (지우지 않으면 옛 경로와 새 경로 문자열이 같아져 살아있는 형제가 죽은 가지로 잘못 연결됨 — `systematic-debugging`으로 standalone 스크립트 재현 확인.)
- **번호표 키 판단의 단일 출처:** 자식 프레임은 F·숫자·0·Esc를 삼켜 `hints/key`로 전달만 하고, 번호표를 열지/닫을지/어느 항목을 누를지는 언제나 맨 위 프레임이 정한다(맨 위만 모든 프레임의 보고를 갖고 있으므로).
- **초점 위임 판정:** `document.activeElement instanceof HTMLIFrameElement`(교차 출처에서도 항상 가능한 검사)로 초점이 자식 프레임에 위임됐는지 판단하고, 그 경우 가장 최근 `mode/report`를 모드 표시에 쓴다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 4→오케스트레이터 결정] `chrome.runtime.getFrameId` 없음 — 경로 방식으로 설계 변경**
- **Found during:** Task 2
- **Issue:** 계획이 지정한 `chrome.runtime.getFrameId(iframeEl)`가 Chrome에 존재하지 않는다(Firefox 전용 API, RESEARCH A2가 틀렸다).
- **Fix:** 각 프레임이 스스로 계산하는 창 위치 경로(`selfPath`, `framePathOf`)와 부모의 상대 순번(`index`)을 `relay.ts`가 실제 frameId로 맞추는(`resolveReports`) 방식으로 설계를 바꿨다. 오케스트레이터가 직접 지시한 구조(옵션 1 `window.name`·옵션 2 `webNavigation`·옵션 3 ELEM-02 축소는 모두 기각).
- **Files modified:** `src/core/frame-path.ts`(신규), `src/core/frame-tree.ts`(`resolveReports` 추가), `src/page/collector/collector.ts`, `src/worker/relay.ts`, `src/shared/messages.ts`
- **Commit:** `96940f3`, `b69f6a2`, `f78f14c`

**2. [Rule 1 - Bug] 형제 iframe 순번 당김으로 인한 경로 충돌**
- **Found during:** Task 2 검증(e2e "iframe 하나를 지운 뒤" 시험이 standalone 재현 스크립트로 5번 중 최대 5번 실패)
- **Issue:** `relay.ts`가 지워진 iframe의 옛 `selfPath` 보고를 탭 보고에서 지우지 않아, 뒤에 남은 형제가 순번이 당겨져 그 옛 경로를 새로 차지하면 `resolveReports`의 경로→frameId 맵에서 죽은 보고가 나중에 덮어써 살아있는 가지가 죽은 가지로 잘못 연결됐다.
- **Fix:** `relay.ts`가 부모의 자식 목록에서 사라진 `pathKey`의 옛 경로(부모 경로+옛 순번)로 시작하는 모든 보고를 함께 지우도록 고쳤다.
- **Files modified:** `src/worker/relay.ts`
- **Verification:** standalone 재현 스크립트로 5회 연속 통과 확인, `frames.e2e.ts` 해당 시험 5회 연속(Playwright) 통과 확인
- **Committed in:** `5ecbbb7`

**3. [Rule 3 - Blocking] `tests/e2e/fixtures.ts`·`skeleton.e2e.ts`의 `EXTENSION_PATH`가 빌드 폴더와 어긋남**
- **Found during:** Task 2 검증(실제 Playwright 실행이 standalone 디버그 스크립트와 다른 결과를 보임 — `systematic-debugging`으로 근본 원인 추적)
- **Issue:** `global-setup.ts`는 `CI=true`가 아니면 `wxt build --mode development`(`.output/chrome-mv3-dev`)를 짓는데, `fixtures.ts`·`skeleton.e2e.ts`는 항상 `.output/chrome-mv3`(프로덕션 이름)를 올렸다 — 로컬(비CI) 실행이 오래된/없는 프로덕션 빌드를 올려 새 코드가 전혀 반영되지 않았다(계획과 무관한 기존 버그, 이 계획의 검증을 막아 Rule 3 적용).
- **Fix:** 두 파일의 `EXTENSION_PATH`를 `global-setup.ts`와 같은 `CI` 분기로 맞췄다.
- **Files modified:** `tests/e2e/fixtures.ts`, `tests/e2e/skeleton.e2e.ts`
- **Committed in:** `f78f14c`

**4. [Rule 1 - Bug] 연습 사이트 fixture 레이아웃 — `frame-nest` 높이 부족으로 `input-leaf`가 잘림**
- **Found during:** Task 2 검증
- **Issue:** `frame-nest`가 150px 높이로는 자기 버튼과 손자 `frame-leaf`(150px) 전체를 함께 보여줄 수 없어 `visibleAncestorClip`이 `input-leaf`를 정상적으로(그러나 의도와 다르게) 잘랐다.
- **Fix:** `frame-nest` 높이를 150px→300px로 늘렸다.
- **Files modified:** `tests/practice-site/frames.html`
- **Committed in:** `f78f14c`

---

**Total deviations:** 4 (설계 정정 1건 — 오케스트레이터 직접 지시, 버그 수정 2건, 계획 밖 블로킹 이슈 1건)
**Impact on plan:** `chrome.runtime.getFrameId` 정정은 계획의 핵심 메커니즘 자체를 바꿨지만 승인된 대안(경로 방식)으로 대체했을 뿐 ELEM-02 범위는 그대로다. 나머지는 모두 이 계획의 검증(e2e)을 완성하는 데 필요했던 버그 수정이며 범위 확장은 없다.

## Issues Encountered
- 실제 `pnpm exec playwright test` 실행이 standalone Node+Playwright 디버그 스크립트와 다른(더 나쁜) 결과를 보여 한동안 원인을 특정하지 못했다 — 최종적으로 `fixtures.ts`의 `EXTENSION_PATH`가 `global-setup.ts`의 빌드 결과물 폴더와 어긋나 있었음을 확인(위 Rule 3 항목). `page.on('console')`이 content script(격리된 world)의 로그를 잡지 못하는 문제는 근본 원인이 아니었으므로(빌드 폴더 문제가 해결되자 자연히 우회됨) 더 파고들지 않았다.
- 형제 iframe 순번 당김 버그는 이론적 추론(경로 충돌 가설)을 standalone 재현 스크립트로 실측 확인한 뒤 수정했다(`systematic-debugging`).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- iframe(같은 출처·다른 출처·중첩) 지원이 완성되어 ELEM-02가 충족됐다. 이후 계획(01-08~)은 이 프레임 트리 합성·중계 메커니즘 위에서 명령판·확인 화면 등을 이어갈 수 있다.
- `docs/superpowers/specs/2026-09-23-tremor-browser-helper-design.md`의 `chrome.runtime.getFrameId` 서술을 정정했으므로, 이후 계획을 세울 때 그 설계 문서를 다시 읽어도 틀린 API를 참조하지 않는다.
- 계획의 acceptance grep(`chrome.runtime.getFrameId`가 collector.ts에 있어야 한다) 문구는 이 설계 정정으로 문자 그대로는 더 이상 참일 수 없다 — 대신 `src/core/frame-path.ts`에 `framePathOf`가, `src/core/frame-tree.ts`에 `resolveReports`가 있다.
- 블로커 없음.

---
*Phase: 01-click-helper-foundation*
*Completed: 2026-09-23*

## Self-Check: PASSED

All files listed in Files Created/Modified verified present on disk. All 9 commit hashes (16c7126, aab2d53, 5a20e05, 96940f3, b69f6a2, f78f14c, 2f44b8e, d7baa02, 5ecbbb7) verified present in git history.
