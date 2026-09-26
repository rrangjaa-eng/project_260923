---
phase: 01-click-helper-foundation
plan: 17
subsystem: click-helper-ui
tags: [playwright, mv3-content-script, iframe, wxt, chrome-extension]

# Dependency graph
requires:
  - phase: 01-click-helper-foundation
    provides: "content script 뼈대(01-01), 자석·번호표·떨림 필터·입력 모드(01-03·04·06), 확인 화면(01-09), 옛 도우미 자기 정리·재주입 패턴(01-14 D-22), 프레임 합성·relay(01-07)"
provides:
  - "matchAboutBlank: true — srcdoc·about:blank(document.write 포함) iframe에도 content script가 주입된다"
  - "frame/reinject 메시지(content script → SW) + background.ts의 프레임 하나 대상 chrome.scripting.executeScript — document.open()으로 문서를 다시 쓴 프레임에서 옛 도우미가 스스로 정리되고 새 도우미가 한 번만 들어온다"
  - "content.ts cleanupOldHelper() 확장: 이름 붙인 리스너(handleRuntimeMessage·handleSettingsStorageChange·siteChangeListener) removeListener, alive 포트 disconnect, 문서 다시 쓰기 감시(MutationObserver) 해제, 늦게 끝나는 비동기 이어짐(cleanedUp 가드 7곳)이 정리 뒤 아무것도 하지 않음"
  - "tests/practice-site/editor-frames.html — srcdoc·document.write(CKEditor 4 classic 패턴)·designMode(TinyMCE classic)·contenteditable(CKEditor 4 본문)·about:blank 뒤 이동·다른 출처 안 srcdoc 여섯 iframe 연습 페이지"
  - "tests/e2e/editor-frames.e2e.ts — 16개 e2e(번호표·필터·입력 모드·자동 반복·확인 화면·이중 누르기 없음·번호 중복 없음·기록 출처)"
affects: [phase-1-verification, 01-18, 01-19]

# Actuals (#2632)
actuals:
  tokens: 12333
  tasks: 3
  commits: 6
plan_head_before: d7b8c1b151f0d957dbb28b7a790e4c354ffb2e72

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WXT matchAboutBlank: true 하나로 srcdoc·about:blank·중첩 srcdoc 프레임 주입을 모두 해결한다(matchOriginAsFallback은 켜지 않음 — data:·blob:은 범위 밖)"
    - "document.open()은 문서·Window의 이벤트 리스너를 모두 지우지만 chrome.runtime.onMessage와 이미 연 포트는 살아남는다 — 옛 인스턴스가 '주입은 됐지만 귀가 먹은' 상태로 남는다. document에 건 MutationObserver(childList: true)로 documentElement 교체를 감지해 옛 인스턴스가 스스로 완전히 정리(리스너 removeListener·포트 disconnect)한 뒤 SW에 frame/reinject를 요청하는 패턴"
    - "cleanedUp 플래그를 옛 인스턴스의 모든 늦게 끝나는 비동기 이어짐(설정·알림·site/query·번호표 기록 읽기) 맨 앞에 두면, 정리 뒤 도착하는 응답이 도우미를 다시 켜거나 메시지를 보내지 않는다 — 부모의 동기 open/write/close + 그 직후 마이크로태스크 정리가 storage.sync.get 같은 실제 IPC 왕복보다 항상 먼저 끝난다는 사실에 기댄다"
    - "innerHTML로 삽입한 <script>는 실행되지 않는다(브라우저 표준 동작) — 동적 자식 문서에 실행되는 스크립트를 넣으려면 요소를 직접 만들고 addEventListener를 걸거나(같은 문서 안), document.write()/srcdoc처럼 진짜 문서 파싱을 거쳐야 한다"

key-files:
  created:
    - tests/practice-site/editor-frames.html
    - tests/e2e/editor-frames.e2e.ts
  modified:
    - src/entrypoints/content.ts
    - src/entrypoints/background.ts
    - src/shared/messages.ts
    - src/types/chrome.d.ts

key-decisions:
  - "matchOriginAsFallback은 켜지 않는다 — data:·blob: 프레임 확장은 이번 gap 범위 밖(계획 명시)"
  - "문서 다시 쓰기 감시는 맨 위·자식 프레임을 가리지 않는다 — document.documentElement가 바뀌는 모든 경우에 '새 도우미 하나'로 대응"
  - "cleanupOldHelper()는 currentEnabled=false·currentTargetId=null을 applyEnabled()를 거치지 않고 직접 설정한다(부작용 메시지 없이 예약된 rAF를 무력화)"
  - "[User decision, 실행 중]: 맨 위 about:blank 새 창(window.open('')이 이용자가 채우는 패턴, 예: 결재 팝업)에는 도우미가 반드시 들어가야 한다는 결정이 나왔다 — PLAN.md가 원래 요구한 '맨 위 about: 문서 가드'(window.top===window && location.protocol==='about:'이면 시작하지 않음)와 그 부재 시험은 만들지도 커밋하지도 않았다. matchAboutBlank:true만으로 이미 그 새 창에도 주입되므로(Chrome의 opener 기반 판정) 이 계획에서 추가 코드는 필요 없었다. 전체 지원(사이트 설정 출처 키, 아이콘 표시, 그 창이 document.write로 다시 쓰일 때의 재주입, 시험)은 01-18/01-19로 넘긴다"
  - "[Rule 1 - 시험 fixture 버그] renderNav()가 innerHTML로 마크업을 넣어 클릭 리스너가 전혀 안 걸렸다 — 요소를 직접 만들고 addEventListener로 수정(제품 코드 아님)"
  - "[Rule 1 - 시험 fixture 버그] 정적 <h1>이 모든 child= 문서에도 나타나 작은 iframe 컨테이너 안 손자 프레임을 잘랐다 — 제목을 renderTop() 안으로만 옮겨 수정(제품 코드 아님)"
  - "[Rule 3 - 블로킹] chrome.storage.local.get가 key로 null도 받게 타입을 넓혔다(진짜 chrome API 동작) — 기록 출처 시험이 전체 키를 훑어야 했다"

patterns-established:
  - "동적으로 붙인 자식 iframe 안 스크립트가 실행돼야 하면 innerHTML이 아니라 요소 생성+addEventListener 또는 진짜 문서 파싱(document.write·srcdoc)을 쓴다"

requirements-completed: [FILT-01, FILT-02]
# ELEM-02·KEY-01은 01-18(KEY-01)·01-19(ELEM-02)가 함께 선언한 공유 ID라 그 계획들도 끝나야
# requirements.ready-ids가 완료로 표시한다(#2388 공유 ID 게이트) — 이 계획의 몫(srcdoc·
# document.write iframe 주입·이중 누르기 없음)은 여기서 실제로 끝났다.

coverage:
  - id: D1
    description: "srcdoc·document.write(CKEditor 4 classic 패턴) 편집기 iframe에도 content script가 주입돼 번호표·떨림 필터·입력 모드가 동작한다"
    requirement: "ELEM-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/editor-frames.e2e.ts (Task 1·2, 12개 behavior)"
        status: pass
      - kind: other
        ref: "빌드 manifest content_scripts[0].match_about_blank:true 1개, match_origin_as_fallback 0개(grep)"
        status: pass
    human_judgment: false
  - id: D2
    description: "document.open()으로 문서를 다시 쓴 프레임(맨 위·자식 모두)에서 옛 도우미가 스스로 정리되고 새 도우미가 한 번만 들어와, 번호·확인 누르기가 정확히 한 번만 눌린다"
    requirement: "ELEM-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/editor-frames.e2e.ts#맨 위 문서를 document.open/write/close로 다시 쓰면..., #document.write로 채운 프레임이 막 생겨도 옛 인스턴스는 조용하다(자식 프레임)"
        status: pass
      - kind: other
        ref: "뮤테이션 확인(SUMMARY 본문 참고): b2 가드 7곳을 모두 뺀 상태로 옛 인스턴스 조용함 시험을 돌리면 frame/state(true)가 1이 아니라 3으로 실패, 되돌린 뒤(git diff 없음) 다시 통과"
        status: pass
    human_judgment: false
  - id: D3
    description: "편집기 iframe 안에서도 100ms 두 번 클릭·자동 반복은 한 번으로 걸러지고, 입력칸·designMode·contenteditable 본문에 초점이 가면 '입력 중' 표시로 바뀐다"
    requirement: "FILT-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/editor-frames.e2e.ts (FILT-01/02, KEY-01 표시된 6개 behavior)"
        status: pass
    human_judgment: false
  - id: D4
    description: "about:blank 뒤 이동한 프레임, 다른 출처 안 srcdoc 손자 프레임도 번호·필터가 동작하고, 한 장 안에서 번호가 겹치지 않으며, 편집기 iframe 안 누른 기록은 맨 위 사이트 출처 키에만 쌓인다(presses:null 없음)"
    requirement: "ELEM-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/editor-frames.e2e.ts (Task 3, 4개 behavior)"
        status: pass
    human_judgment: false
  - id: D5
    description: "회귀 없음 — frames·lifecycle·confirm·input-filter·site-toggle·helper-toggle e2e(92개) 모두 통과, typecheck·lint 통과"
    verification:
      - kind: e2e
        ref: "CI=true pnpm exec playwright test tests/e2e/editor-frames.e2e.ts tests/e2e/frames.e2e.ts tests/e2e/lifecycle.e2e.ts tests/e2e/confirm.e2e.ts tests/e2e/input-filter.e2e.ts tests/e2e/site-toggle.e2e.ts tests/e2e/helper-toggle.e2e.ts — 92 passed"
        status: pass
      - kind: other
        ref: "pnpm typecheck, pnpm lint"
        status: pass
    human_judgment: false

duration: 약 40분(정확한 벽시계 미기록 — 커밋 타임스탬프 03:17~03:49 UTC 기준, 디버깅 조사 시간 포함)
completed: 2026-09-26
status: complete
---

# Phase 1 Plan 17: srcdoc·document.write 편집기 iframe 도우미 주입·이중 누르기 없음 Summary

**WXT `matchAboutBlank: true` 하나로 srcdoc·about:blank(CKEditor 4/TinyMCE classic 패턴) 편집기 iframe에 도우미를 주입하고, `document.open()`으로 문서가 다시 쓰인 프레임에서 옛 도우미가 리스너·포트·문서 감시를 스스로 완전히 정리한 뒤 `frame/reinject`로 새 도우미 하나만 들어오게 해 이중 누르기를 없앴다(01-VERIFICATION BLOCKER, 01-07 truth 1·5 해소).**

## Performance

- **Duration:** 약 40분(디버깅 조사 포함, 벽시계 정확한 기록 없음)
- **Tasks:** 3/3 완료
- **Files modified:** 6 (신규 2 — `tests/practice-site/editor-frames.html`, `tests/e2e/editor-frames.e2e.ts`; 수정 4)
- **Commits:** 6(`plan_head_before` 이후 범위, 아래 "Task Commits" 목록에 실제 실행자 커밋 5개 + 오케스트레이터 개입 커밋 1개 구분)

## Accomplishments

- **Task 1(tracer) — srcdoc 프레임 주입:** `content.ts`의 `defineContentScript`에 `matchAboutBlank: true`를 더해 srcdoc·about:blank·중첩 srcdoc 프레임에 content script가 들어가게 했다. 빌드 manifest의 `match_about_blank`가 정확히 1개 켜졌고, srcdoc 편집기 프레임의 번호표·100ms 두 번 클릭 필터·입력 모드 표시가 모두 동작한다.
- **Task 2 — 문서 다시 쓰기(document.write)에서 옛 도우미 정리·재주입:** `document.open()`이 문서·Window의 이벤트 리스너를 모두 지워(probe 실측) 옛 인스턴스가 "주입은 됐지만 귀가 먹은" 상태가 되는 문제를, `document`에 건 `MutationObserver(childList: true)`로 감지해 `cleanupOldHelper()`를 완전하게 확장(이름 붙인 onMessage·storage.onChanged 리스너 제거, alive 포트 disconnect, 문서 감시 해제, 열린 확인 화면 정리)하고 `frame/reinject` 메시지로 그 프레임 하나에만 새 content script를 넣게 했다. 늦게 끝나는 비동기 이어짐(설정·알림·site/query·번호표 기록 읽기) 7곳에 `cleanedUp` 가드를 둬 정리 뒤 도착하는 응답이 도우미를 되살리지 않게 했다. **뮤테이션 확인**: 이 가드 7곳을 모두 뺀 상태로 "옛 인스턴스 조용함" 시험을 돌리면 `frame/state(true)`가 1이 아니라 **3**으로 실패했고, 되돌린 뒤(`git diff` 없음) 다시 통과함을 확인했다.
- **Task 3 — 나머지 편집기 프레임 모양·경계:** about:blank 뒤 이동한 프레임, 다른 출처(other.test) 안 srcdoc 손자 프레임, 번호 중복 없음(장마다), 기록 출처(`presses:http://practice.test`만, `presses:null` 없음) 4개 behavior를 추가했다. 이 넷은 Task 1·2의 변경만으로 이미 통과할 코드였지만(계획 예상대로), 실제 첫 실행에서는 **이 계획이 만든 시험 fixture 자체의 버그 2건**(아래 편차 참고)이 나와 `systematic-debugging`으로 원인을 찾아 고쳤다. 제품 코드(`content.ts` 등)는 이 Task에서 바꾸지 않았다.

## Task Commits

Each task was committed atomically:

1. **Task 1(tracer): srcdoc 편집기 프레임 하나 — 주입부터 번호 누르기·떨림 필터·입력 모드까지 끝까지** — `92ca2f5`(test, RED) → `bf4f67c`(feat, GREEN)
2. **Task 2: document.write로 다시 쓴 문서에서 옛 도우미는 물러나고 새 도우미가 한 번만 들어온다** — `da2e06f`(test, RED) → `24e9f44`(fix, GREEN)
3. **Task 3: 나머지 편집기 프레임 모양과 경계** — `fc587cf`(test — behavior 추가 + 시험 fixture 버그 2건 수정, 제품 코드 변경 없어 RED/GREEN 분리 없음)

**오케스트레이터 개입(실행자 커밋 아님):** `1734afe` — 계획 분할(01-18/01-19) 문서 커밋, Task 1·2 사이에 orchestrator가 직접 커밋했다. 이 계획의 실행에는 영향 없음.

_Note: TDD 작업은 RED→GREEN 두 커밋. Task 3는 제품 코드 변경이 없어(계획이 예상한 "특성 시험" 경로) 커밋 하나로 처리했다._

## Files Created/Modified

- `tests/practice-site/editor-frames.html` (신규) - srcdoc·document.write·designMode·contenteditable·about:blank 뒤 이동·다른 출처 안 srcdoc 여섯 iframe 연습 페이지
- `tests/e2e/editor-frames.e2e.ts` (신규) - 16개 e2e + 시험 도우미(`numberForLocator`, `findHintNumberFor`, `pressHintFor`, `waitForFrameHelperAlive`, `setupFrameStateRecorder` 등)
- `src/entrypoints/content.ts` - `matchAboutBlank: true`, 문서 다시 쓰기 감시(`documentRewriteWatcher`), 이름 붙인 리스너(`handleRuntimeMessage`·`handleSettingsStorageChange`·`siteChangeListener`), `alivePort` 추적, `cleanupOldHelper()` 확장, `cleanedUp` 가드 7곳
- `src/entrypoints/background.ts` - `frame/reinject` 메시지 처리(그 프레임 하나에만 `chrome.scripting.executeScript`)
- `src/shared/messages.ts` - `FrameReinjectMessage`(필드 없음) 추가
- `src/types/chrome.d.ts` - `executeScript` target에 `frameIds?`, `storage.onChanged`에 `removeListener`, `storage.get`가 `key: string | null`도 받게 확장

## Decisions Made

프론트매터 `key-decisions` 참고. 요약:
- `matchOriginAsFallback`은 켜지 않음(data:·blob:은 범위 밖)
- 문서 다시 쓰기 감시는 맨 위·자식 프레임을 가리지 않음
- **[User decision, 실행 중] 맨 위 about:blank 새 창(예: 결재 팝업)에는 도우미가 들어가야 한다** — PLAN.md가 원래 요구한 가드(맨 위 about: 문서에서 시작하지 않음)와 그 부재를 확인하는 시험은 만들지도 커밋하지도 않았다. `matchAboutBlank:true`만으로 이미 그 창에도 주입되므로 추가 코드가 필요 없었다. 전체 지원(사이트 설정 출처 키, 아이콘 "도울 수 없음" 표시, 그 창이 document.write로 다시 쓰일 때의 재주입, 전용 시험)은 **01-18/01-19에서 다룬다** — 이 계획에서는 가드를 빼는 것 이상을 하지 않았다

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 시험 fixture 버그] `renderNav()`가 innerHTML로 마크업을 넣어 클릭 리스너가 전혀 안 걸렸다**
- **Found during:** Task 3 (about:blank 뒤 이동 프레임 번호·필터 behavior)
- **Issue:** `document.body.innerHTML = counterMarkup('nav')`로 넣은 `<script>`는 브라우저가 실행하지 않는다(표준 XSS 방지 동작) — `#btn-nav`는 화면에 있고 번호표도 정확히 받았지만, 눌러도 카운터가 절대 오르지 않았다. `chrome.scripting.executeScript`로 그 프레임 안에서 직접 `.click()`을 호출해도 카운터가 안 오르는 것으로 재현·확인했다.
- **Fix:** 요소를 `document.createElement`로 직접 만들고 `addEventListener('click', ...)`로 진짜 리스너를 걸었다(frames.html의 `makeCounterButton`과 같은 패턴).
- **Files modified:** `tests/practice-site/editor-frames.html`
- **Verification:** 직접 `.click()` 호출 후 카운터가 0→1로 오름을 확인, 이후 `tests/e2e/editor-frames.e2e.ts` 전체 16개 통과.
- **Committed in:** fc587cf

**2. [Rule 1 - 시험 fixture 버그] 정적 `<h1>`이 모든 child= 문서에도 나타나 손자 프레임을 잘랐다**
- **Found during:** Task 3 (다른 출처 안 srcdoc 손자 프레임 behavior)
- **Issue:** `<h1>`을 `<body>` 바로 안 정적 마크업으로 뒀더니, `?child=host` 문서에도 그대로 나타나 `#frame-nested`(높이 120px)를 `#frame-host` 컨테이너(높이 140px) 안에서 h1 높이만큼(약 129px) 아래로 밀어, `clip.h`가 11px로 잘렸다(SW의 `frame/report` 로그로 실측 확인: `clip: {x:1,y:129,w:280,h:11}`). 잘린 항목은 번호표 배치에서 빠졌다.
- **Fix:** `<h1>` 생성을 `renderTop()` 함수 안으로 옮겨 맨 위 화면에서만 만들게 했다.
- **Files modified:** `tests/practice-site/editor-frames.html`
- **Verification:** 수정 뒤 SW 로그에서 `clip: {x:1,y:1,w:280,h:120}`(전체 보임)로 실측 확인, `#btn-nested`가 번호표를 정상적으로 받고 눌림.
- **Committed in:** fc587cf

**3. [Rule 3 - 블로킹] `chrome.storage.local.get`가 `key`로 `null`도 받게 타입을 넓힘**
- **Found during:** Task 3 (기록 출처 시험)
- **Issue:** 기록 출처 시험이 `chrome.storage.local.get(null)`로 저장된 모든 키를 훑어 `presses:null`이 없는지 확인해야 하는데, `chrome.d.ts`의 `StorageArea.get`이 `key: string`만 받아 타입체크가 막혔다.
- **Fix:** 실제 chrome API가 지원하는 대로 `key: string | null`로 넓혔다(최소 ambient 선언 관례, `@types/chrome` 미승인).
- **Files modified:** `src/types/chrome.d.ts`
- **Verification:** `pnpm typecheck` 0 errors.
- **Committed in:** fc587cf

**4. [Rule 1 - 시험 도우미 강화] `pressHintFor`/`numberForLocator`가 방금 나타난 프레임의 보고 지연을 못 버텼다**
- **Found during:** Task 3 (about:blank 뒤 이동·다른 출처 안 srcdoc 프레임 behavior 최초 실행)
- **Issue:** `F`를 누른 순간의 스냅샷(`composeCurrentItems()`)에 방금 나타난 프레임의 보고가 아직 안 왔으면, 그 프레임 항목은 그 번호표 세션 안에서 영영 찾을 수 없었다(장을 계속 넘겨도 스냅샷 자체에 없으므로).
- **Fix:** 번호를 못 찾으면 닫았다 다시 열어(`F` 재입력) 새 스냅샷으로 다시 찾는 재시도 루프(`findHintNumberFor`)로 강화했다. 기존 통과 시험(Task 1·2)에 영향 없음을 재확인했다.
- **Files modified:** `tests/e2e/editor-frames.e2e.ts`
- **Verification:** 전체 16개 e2e 통과.
- **Committed in:** fc587cf

---

**Total deviations:** 4 (시험 fixture 버그 2건, 블로킹 타입 확장 1건, 시험 도우미 강화 1건)
**Impact on plan:** 넷 다 이 계획이 새로 만든 시험 코드 안에서만 일어났다 — **제품 코드(`content.ts`·`background.ts`·`messages.ts`)는 Task 1·2에서 계획대로만 바뀌었고 Task 3에서는 전혀 바뀌지 않았다.** 범위 확장(scope creep) 없음.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Known Gaps

- **KEY-01(이용자 결정으로 01-18에서 처리 예정)**: 문서 전체가 편집 가능한 iframe 편집기(designMode, contenteditable 본문)에서 Esc를 누르면 캐럿은 사라지지만 초점이 편집 가능한 본문에 남아 있어 모드 표시가 "입력 중"에 머물고 숫자도 글자로 들어가지 않는다(planner probe 실측, 현재 빌드에서도 재확인 가능). 이 계획의 Esc 시험은 입력칸(`#input-srcdoc`, `#input-write`)만 단언했고, 편집기 본문의 Esc 동작은 이번 범위 밖이다 — **01-18에서 새 작업으로 처리 예정**이며, 이번 계획에서는 고치지 않는다.
- **맨 위 about: 새 창 전체 지원(01-18/01-19로 이관)**: 사이트 설정 출처 키(불투명 `null` 출처 처리), 아이콘 "도울 수 없음" 표시와의 일치, 그 창이 `document.write`로 다시 쓰일 때의 재주입, 전용 e2e는 이 계획 범위 밖이다(위 User decision 참고).

## Next Phase Readiness

- 01-VERIFICATION의 BLOCKER(srcdoc·document.write 편집기 iframe 번호표·필터·입력 모드 미동작, 이중 누르기 가능성)가 해소됐다 — `01-07 truth 1·5`가 이제 이 계획의 e2e로 통과한다.
- 01-18(KEY-01 관련 나머지 작업, Esc-in-editor 새 작업 포함)·01-19(ELEM-02 관련 나머지 작업, 맨 위 about: 새 창 전체 지원)가 이 계획이 만든 `matchAboutBlank`·`frame/reinject`·`cleanupOldHelper()` 확장 위에서 이어갈 수 있다.
- 전체 게이트(`CI=true pnpm test` 한 번)는 계획대로 01-18 마지막 작업에서 돈다 — 이 계획에서는 돌리지 않았다.

---
*Phase: 01-click-helper-foundation*
*Completed: 2026-09-26*

## Self-Check: PASSED

- All created/modified files verified present on disk (`tests/practice-site/editor-frames.html`, `tests/e2e/editor-frames.e2e.ts`, `src/entrypoints/content.ts`, `src/entrypoints/background.ts`, `src/shared/messages.ts`, `src/types/chrome.d.ts`, this SUMMARY).
- All 6 commit hashes verified in `git log --oneline --all` (`92ca2f5`, `bf4f67c`, `da2e06f`, `24e9f44`, `fc587cf`, plus orchestrator's `1734afe`).
- `commits: 6` measured via `git rev-list --count d7b8c1b151f0d957dbb28b7a790e4c354ffb2e72..HEAD` (matches `plan_head_before`).
