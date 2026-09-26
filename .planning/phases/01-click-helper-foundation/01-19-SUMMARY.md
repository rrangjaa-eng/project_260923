---
phase: 01-click-helper-foundation
plan: 19
subsystem: click-helper-safety
tags: [playwright, mv3-content-script, iframe, wxt, chrome-extension, popup, service-worker, systematic-debugging]

# Dependency graph
requires:
  - phase: 01-click-helper-foundation
    provides: "matchAboutBlank·frame/reinject·cleanupOldHelper() 확장(01-17), 사이트 상태 재시도 루프·cachedTopOrigin(01-18), 아이콘 도울 수 없음 판정(01-13)"
provides:
  - "inheritedSiteOrigin(url, documentOrigin): about: 문서가 물려받은 http(s) 출처만 사이트로 인정하는 순수 함수(unsupported-url.ts)"
  - "주소 없는 새 창(window.open('')을 여는 쪽이 DOM이나 document.write로 채움)에서 도우미가 한 번만 돌고, 그 창의 사이트는 여는 쪽 출처다 — 여는 쪽 사이트를 끄면 새 창도 꺼진다(content.ts 맨 위 about: 가드, cachedTopOrigin, readPinsAndPresses)"
  - "background.ts siteOriginOfTab(tabId, tabUrl) + 탭별 맨 위 문서 출처 Map(topDocOrigins, frameId 0 sender.origin으로만 채움) — 새 창 탭의 아이콘·메뉴·기록·자식 iframe이 모두 이 값을 쓴다"
  - "popup/main.ts resolveSiteOrigin: about: 탭은 site/ping 응답의 origin으로 사이트 카드를 만든다(최종 대조는 SW)"
  - "noopener 실측: window.open(noopener)·rel=noopener 링크 모두 Chrome이 content script를 주입하지 않는다(구분 장치 없이 자연히 도울 수 없음)"
  - "content.ts applyEnabled()의 document.documentElement 직접 확인 — MutationObserver 알림 지연 경쟁의 한 변형을 원천 차단"
  - "Phase 1 전체 게이트(CI=true pnpm test, 단위 101 + e2e 216) 한 번에 0 failed·0 flaky"
affects: [phase-1-verification, post-build-review]

# Actuals (#2632)
actuals:
  tokens: 11600
  tasks: 3
  commits: 5
plan_head_before: 37463578a7f5c8474cfc6ab250af96aefe3266a9

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "about: 문서의 사이트 정체는 항상 Chrome·문서 자신이 준 값(content script의 window.origin, background의 sender.origin)으로만 정한다 — 메시지 본문·페이지가 준 문자열은 비교 대조용으로만 쓰고 최종 판단에 직접 신뢰하지 않는다(T-01-59)"
    - "MutationObserver 같은 비동기 알림에 의존하는 정리 신호(cleanedUp)는 실제 IPC 왕복과 순서가 뒤바뀔 수 있다 — 이어짐의 관문(applyEnabled)에서 document.documentElement 같은 동기 진실값을 직접 다시 확인하면 알림 지연과 무관하게 정확해진다"
    - "시험이 재현 불가능한 경쟁으로 산발 실패하면, 먼저 그 경쟁이 제품 결함인지 시험 자체의 계측 방법(제품이 실제로 소비하지 않는 누적 카운트 등) 결함인지 구분한다 — 후자면 제품이 실제로 쓰는 결정적 신호(호스트 수, 최종 상태)로 시험을 바꾼다"

key-files:
  created:
    - tests/practice-site/blank-popup.html
    - tests/e2e/blank-popup.e2e.ts
  modified:
    - src/core/unsupported-url.ts
    - src/entrypoints/content.ts
    - src/entrypoints/background.ts
    - src/entrypoints/popup/main.ts
    - src/types/chrome.d.ts
    - tests/unit/unsupported-url.test.ts
    - tests/e2e/editor-frames.e2e.ts

key-decisions:
  - "noopener 실측(Task 1 RED, 프로덕션 빌드·CI=true, 저장소 밖 scratch로 확인 후 삭제): window.open('', '_blank', 'noopener')와 rel=noopener 링크 둘 다 self.origin은 여는 쪽 http(s) 출처를 물려받지만(불투명 아님), Chrome이 그 새 창에는 content script를 전혀 주입하지 않는다 — match_about_blank는 opener·parent 문서로만 출처를 판정하는데 noopener가 그 연결 자체를 끊는다(Chrome 자체 동작). 결과: 두 경우 모두 도우미 없음 — window.opener 등으로 noopener를 구분하는 장치는 만들지 않았다(코드에 없음, CLAUDE.md §3.2 추측성 장치 금지)"
  - "새 창의 사이트 정체는 Chrome이 준 값(frameId 0 sender.origin, tab.url)으로만 정한다(T-01-59) — background.ts의 siteOriginOfTab이 유일한 판정 지점이고, site/query·recordPress·setSiteDisabled가 모두 이것을 쓴다. 메시지 본문의 origin 필드는 대조용으로만 쓴다(기존 recordPress 패턴 그대로)"
  - "updateActionForTab: about: 탭은 isUnsupportedUrl을 건너뛰고 site/ping 응답 여부로만 판정한다 — content script는 Task 1의 맨 위 가드 때문에 물려받은 http(s) 출처가 있을 때만 시작하므로, ping 성공이 곧 '도울 수 있음'이다"
  - "editor-frames.e2e.ts flaky 근본 원인(systematic-debugging, CPU 부하 재현으로 확정): 제품 결함이 아니라 시험의 경쟁 조건이었다 — 옛 인스턴스의 설정 읽기(IPC 왕복)가 여는 쪽 document.open()보다 먼저 끝나면 그 인스턴스는 그 순간 실제로 유효했으므로 자기 상태를 정확히 보고한다. 시험의 누적 메시지 개수 단언을 제품이 실제로 쓰는 결정적 신호(호스트 수 1개, 누른 횟수 1번)로 바꿨다. content.ts에는 방어를 하나 더했다(documentWasRewritten() 동기 확인) — 알림 지연 쪽 경쟁 변형은 원천 차단"

patterns-established:
  - "about: 문서 사이트 판정은 항상 Chrome·문서 자신이 준 동기/신뢰 가능한 값에서만 유도한다(inheritedSiteOrigin, siteOriginOfTab)"
  - "비동기 정리 신호는 동기 진실값으로 이중 확인한다(cleanedUp + document.documentElement 직접 비교)"

requirements-completed: [ELEM-02, SAFE-04, SAFE-05]

coverage:
  - id: D1
    description: "window.open('')을 여는 쪽이 DOM이나 document.write로 채운 주소 없는 새 창에서 도우미가 한 번만 돈다(호스트 1개, 두 번 클릭 필터, 번호 누르기 정확히 한 번) — 사이트는 여는 쪽 출처라 사이트별 끄기를 따른다"
    requirement: "ELEM-02"
    verification:
      - kind: unit
        ref: "tests/unit/unsupported-url.test.ts#inheritedSiteOrigin (7개)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/blank-popup.e2e.ts (Task 1, 4개: DOM 새 창·document.write 새 창·사이트 끄기 따름·noopener 실측)"
        status: pass
    human_judgment: false
  - id: D2
    description: "주소 없는 새 창 탭의 아이콘·메뉴가 '도울 수 없음'을 보이지 않고, 메뉴의 '이 사이트에서 끄기'가 여는 쪽 사이트를 끈다. 누른 기록과 새 창 안 iframe도 여는 쪽 출처를 쓴다"
    requirement: "SAFE-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/blank-popup.e2e.ts (Task 2, 4개: 아이콘 제목·배지, 메뉴 카드, 기록 출처, 자식 iframe)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/site-toggle.e2e.ts, tests/e2e/helper-toggle.e2e.ts, tests/e2e/frames.e2e.ts, tests/e2e/hints.e2e.ts — 54개 회귀 없음(chrome://version 도울 수 없음 유지 포함)"
        status: pass
    human_judgment: false
  - id: D3
    description: "noopener로 연 새 창은 실측한 대로 다룬다(구분 장치 없이 inheritedSiteOrigin/Chrome 주입 여부만으로 자연히 처리) — 불투명 출처·브라우저가 연 빈 탭은 그대로 도울 수 없음이다"
    requirement: "SAFE-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/blank-popup.e2e.ts#noopener로 연 새 창(window.open과 링크 둘 다)에는 Chrome이 content script를 주입하지 않아 도우미가 없다(실측)"
        status: pass
      - kind: other
        ref: "grep으로 src/에 window.opener 참조 없음 확인"
        status: pass
    human_judgment: false
  - id: D4
    description: "editor-frames.e2e.ts '옛 인스턴스는 조용하다' 산발 실패의 근본 원인을 확정하고 고쳤다 — 재시도·시간 늘리기·skip 없이 CPU 부하 재현으로 검증"
    verification:
      - kind: other
        ref: "CPU 부하(4코어) + --repeat-each=25(단일 시험) + --repeat-each=6(전체 파일 96/96) 연속 무실패, 뮤테이션 확인(removeListener 제거 시 새 단언이 실패로 잡음)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Phase 1 전체 게이트가 CI=true 한 번에 통과했다(단위 101, e2e 216, 0 failed·0 flaky) — DOM 감사 16/16(기준 불변), 외부 전송·창 사이 메시지 grep 빈 결과"
    verification:
      - kind: other
        ref: "pnpm lint && pnpm typecheck && CI=true pnpm build — manifest match_about_blank:true 1개"
        status: pass
      - kind: e2e
        ref: "CI=true pnpm exec playwright test tests/e2e/dom-audit.e2e.ts — 16 passed, 파일 변경 없음(git log cf9aaed..HEAD 빈 결과)"
        status: pass
      - kind: other
        ref: "CI=true pnpm test — 단위 101 passed, e2e 216 passed, 1회 실행, 0 failed·0 flaky"
        status: pass
      - kind: other
        ref: "grep -rnE 'fetch\\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource' src/ 및 grep -rnE '\\.postMessage\\(' src/ — 둘 다 빈 결과"
        status: pass
    human_judgment: false

duration: 약 65분(첫 RED 커밋 05:12~마지막 fix 커밋 06:08 UTC 기준, SUMMARY 작성 포함하면 더 김)
completed: 2026-09-26
status: complete
---

# Phase 1 Plan 19: 주소 없는 새 창 지원 + editor-frames flaky 근본 수정 + Phase 1 전체 게이트 Summary

**window.open('')을 여는 쪽이 DOM이나 document.write로 채우는 주소 없는 새 창(결재 팝업 패턴)에서 도우미가 한 번만 돌고 여는 쪽 사이트를 그대로 따르게 했다(inheritedSiteOrigin·siteOriginOfTab, Chrome이 준 sender.origin만 신뢰), noopener는 실측한 대로 자연히 처리되며, editor-frames.e2e.ts의 산발 실패를 systematic-debugging으로 근본 원인(시험의 경쟁 조건)까지 확정해 고치고, Phase 1 전체 게이트(단위 101 + e2e 216)가 CI=true 한 번에 0 failed·0 flaky로 통과했다.**

## Performance

- **Duration:** 약 65분(RED 커밋 05:12 UTC ~ 마지막 fix 커밋 06:08 UTC 기준, 조사·SUMMARY 작성 포함하면 더 김)
- **Tasks:** 3/3 완료
- **Files modified:** 9 (신규 2 — `tests/practice-site/blank-popup.html`, `tests/e2e/blank-popup.e2e.ts`; 수정 7)
- **Commits:** 5(Task 1 RED→GREEN, Task 2 RED→GREEN, flaky 근본 원인 수정)

## Accomplishments

- **Task 1(tracer) — 주소 없는 새 창 사이트 판정:** `inheritedSiteOrigin(url, documentOrigin)`(순수 함수, unsupported-url.ts)을 더해 about: 문서가 http(s) 출처를 물려받았을 때만(스토어 제외) 그 출처를 사이트로 인정한다. `content.ts` `main()` 맨 앞에 about: 가드를 넣어 불투명 출처는 시작하지 않게 했고, `cachedTopOrigin`·`readPinsAndPresses`가 about: 문서에서 `window.location.origin`("null" 문자열) 대신 물려받은 출처를 쓰게 했다. **noopener 실측**(RED 단계, 프로덕션 빌드로 먼저 측정): `window.open('', '_blank', 'noopener')`와 `rel=noopener` 링크 모두 `self.origin`은 여는 쪽 http(s) 출처를 물려받지만(불투명 아님), Chrome이 그 새 창에는 content script를 전혀 주입하지 않는다(`match_about_blank`는 opener·parent 문서로만 출처를 판정하는데 noopener가 그 연결을 끊는다 — Chrome 자체 동작). 결과: 두 경우 모두 도우미가 없고, 이는 코드 변경 없이(구분 장치 없이) 자연히 일어난다.
- **Task 2 — 새 창 탭 아이콘·메뉴·기록·자식 iframe:** `chrome.d.ts`의 `MessageSender`에 `origin?: string`을 더했다. `background.ts`에 탭별 맨 위 문서 출처 `Map`(`topDocOrigins`, frameId 0 메시지의 `sender.origin`으로만 채움, `tabs.onRemoved`·`onUpdated(loading)`에서 지움)과 `siteOriginOfTab(tabId, tabUrl)`을 더해 `site/query`·`recordPress`의 `tabOrigin`·`setSiteDisabled`의 T-01-36 대조가 모두 이것을 쓰게 했다. `updateActionForTab`은 about: 탭이면 `isUnsupportedUrl` 대신 ping 응답만으로 판정한다(Task 1 가드가 이미 걸러 준다). `content.ts`의 `site/ping` 응답에 `origin: cachedTopOrigin`을 더해 메뉴 표시용으로 쓰고(최종 대조는 SW), `popup/main.ts`의 `renderForTargetTab`이 about: 탭이면 `site/ping` 응답의 `origin`으로 사이트 카드를 만든다.
- **Task 3 — flaky 근본 원인 수정 + 전체 게이트:** 오케스트레이터 인계 제약(editor-frames flaky)을 `systematic-debugging`으로 조사했다. CPU 부하(4코어 100% 점유) + `--repeat-each`로 재현에 성공했고(조사용 임시 계측 스크립트로 콘솔 타임라인을 찍어 확인, 저장소에 커밋하지 않고 조사 후 삭제), **근본 원인은 제품 결함이 아니라 시험의 경쟁 조건**임을 확정했다: `document.write`로 막 채워진 자식 iframe의 옛 인스턴스가 자기 설정을 읽는 `chrome.storage.sync.get()` IPC 왕복이, 여는 쪽 스크립트의 `document.open()`(동기 동작이지만 CPU 부하로 실행 자체가 지연될 수 있음)보다 먼저 끝나면, 그 순간 그 인스턴스는 실제로 아직 유효한 옛 문서의 인스턴스라 자기 상태(`enabled:true`)를 정확히 보고한다 — 버그가 아니라 정리되기 직전까지 정상 동작했다는 뜻이다. 시험은 SW가 받은 `frame/state(enabled:true)` 메시지의 누적 개수가 정확히 1이어야 한다고 단언했는데, 이 개수는 제품이 실제로 쓰지 않는(background.ts의 `frameStates`는 마지막 값만 남긴다) 시험 전용 계측이라 우연한 타이밍에 의존했다. `content.ts`에 방어를 하나 더했다(`applyEnabled()`가 `cleanedUp`뿐 아니라 `document.documentElement` 자체를 동기로 다시 확인 — 알림 지연 쪽 경쟁 변형을 원천 차단). `editor-frames.e2e.ts`의 단언을 누적 메시지 개수 대신 제품이 실제로 쓰는 결정적 신호(자식 프레임 안 호스트 정확히 1개, 번호 누르기 정확히 1번)로 바꿨다. **뮤테이션 확인**: `cleanupOldHelper()`의 `removeListener` 한 줄을 빼고 돌리면 새 단언이 카운터 2로 실패했고, 되돌리면(`git diff` 없음) 다시 통과함을 확인했다. **재현·검증**: 수정 전 CPU 부하 하에서 8~16회 중 3~5회 실패, 수정 후 같은 부하에서 단일 시험 25회 연속 + 전체 파일(16개) 6회 반복(96/96) 무실패. 이어서 싼 게이트(lint·typecheck·build, manifest `match_about_blank` 1개) → DOM 감사(16/16, 기준 파일 `git log cf9aaed..HEAD` 빈 결과로 불변 확인) → 전체 게이트 `CI=true pnpm test`(단위 101 + e2e 216) 한 번 실행 0 failed·0 flaky → 외부 전송·창 사이 메시지 grep 빈 결과, `window.opener` 참조 없음(코드 읽기) 순서로 마쳤다.

## Task Commits

Each task was committed atomically (TDD RED→GREEN):

1. **Task 1(tracer): 주소 없는 새 창 사이트 판정 — noopener 실측 → inheritedSiteOrigin** — `e5f63b3`(test, RED) → `431a840`(feat, GREEN)
2. **Task 2: 새 창 탭 아이콘·메뉴·기록·자식 iframe — Chrome sender.origin만 신뢰** — `50fcae4`(test, RED) → `d3495fc`(feat, GREEN)
3. **Task 3: editor-frames flaky 근본 원인 수정 + 전체 게이트** — `55acdd0`(fix, systematic-debugging 근거 포함)

_Note: TDD 작업은 RED→GREEN 두 커밋. Task 3는 검증 전용 작업이었으나 인계받은 flaky 제약을 고치는 과정에서 fix 커밋 하나가 나왔다(계획이 예상한 경로)._

## Files Created/Modified

- `tests/practice-site/blank-popup.html` (신규) - `openDomPopup()`·`openWritePopup()`·`openNoopenerPopup()`·`addSrcdocFrame(win)`·`#noopener-link` 연습 페이지
- `tests/e2e/blank-popup.e2e.ts` (신규) - 8개 e2e(Task 1의 4 + Task 2의 4)
- `src/core/unsupported-url.ts` - `inheritedSiteOrigin(url, documentOrigin)`
- `src/entrypoints/content.ts` - 맨 위 about: 가드, `cachedTopOrigin`·`readPinsAndPresses`의 about: 처리, `site/ping` 응답에 `origin`, `documentWasRewritten()` 동기 확인(applyEnabled)
- `src/entrypoints/background.ts` - `topDocOrigins`(Map), `siteOriginOfTab`, `updateActionForTab`의 about: 분기, `site/query`·`recordPress`·`setSiteDisabled`가 `siteOriginOfTab` 사용, `tabs.onRemoved`/`onUpdated(loading)` 정리
- `src/entrypoints/popup/main.ts` - `resolveSiteOrigin(tabUrl, tabId)`
- `src/types/chrome.d.ts` - `MessageSender.origin?: string`
- `tests/unit/unsupported-url.test.ts` - `inheritedSiteOrigin` 단위 7개
- `tests/e2e/editor-frames.e2e.ts` - "옛 인스턴스는 조용하다" 시험의 단언을 결정적 신호로 교체

## Decisions Made

프론트매터 `key-decisions` 참고. 요약:
- noopener는 실측대로(Chrome이 주입하지 않음) — 구분 장치 없음
- 새 창 사이트 정체는 Chrome이 준 값(sender.origin, tab.url)으로만 — `siteOriginOfTab`이 유일한 판정 지점
- about: 탭 아이콘 판정은 ping 응답 여부만(Task 1 가드가 이미 걸러 줌)
- editor-frames flaky는 제품 결함이 아니라 시험의 경쟁 조건 — 결정적 신호로 시험을 바꾸고, content.ts에는 방어를 하나 더함(알림 지연 변형 차단)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 버그] blank-popup.e2e.ts의 새 창 탭 식별이 컨텍스트 기본 빈 탭과 섞임**
- **Found during:** Task 2 (아이콘 제목·메뉴 시험 RED→GREEN 확인 중)
- **Issue:** `about:blank`로 남는 새 창 탭을 `chrome.tabs.query({url:'about:blank'})`나 fixtures.ts의 `openPopup(target)`(`target.url()`로 탭 찾기)로 식별하면, `launchPersistentContext`가 만드는 컨텍스트 기본 빈 탭도 같은 url이라 잘못된 탭을 대상으로 잡았다(디버그 스크립트로 실측 확인).
- **Fix:** `openerTabId`로 "이 여는 쪽 탭이 연 것"만 가려내는 `tabIdByUrl(serviceWorker, url, openerUrl)`을 만들어 모든 새 창 탭 조회에 썼다.
- **Files modified:** `tests/e2e/blank-popup.e2e.ts`
- **Verification:** 8개 e2e 모두 통과.
- **Committed in:** d3495fc(GREEN 커밋에 포함)

**2. [Rule 1 - 근본 원인 수정, 인계 제약] editor-frames.e2e.ts "옛 인스턴스는 조용하다" 산발 실패**
- **Found during:** Task 3 (인계 BLOCKING CONSTRAINT, 최종 게이트 전 조사 지시)
- **Issue:** 위 "Accomplishments" Task 3 항목 참고 — 시험의 경쟁 조건(제품 결함 아님).
- **Fix:** content.ts에 `documentWasRewritten()` 동기 확인 추가(방어), editor-frames.e2e.ts의 단언을 결정적 신호로 교체.
- **Files modified:** `src/entrypoints/content.ts`, `tests/e2e/editor-frames.e2e.ts`
- **Verification:** CPU 부하 하 25회 연속 + 전체 파일 6회(96/96) 무실패, 뮤테이션 확인(removeListener 제거 시 실패로 잡음).
- **Committed in:** 55acdd0

---

**Total deviations:** 2 auto-fixed (1 시험 버그, 1 근본 원인 수정 — 인계받은 blocking constraint)
**Impact on plan:** 둘 다 시험 코드 안에서 발견·수정됐다(2번은 content.ts에 방어 하나 추가 포함). 제품 코드의 핵심 로직(사이트 판정)은 계획대로만 바뀌었다. 범위 확장 없음.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None beyond the plan's `<threat_model>`(T-01-59, T-01-60, T-01-58) — 모두 계획대로 완화됐다(Task 1·2·3 Accomplishments 참고).

## Next Phase Readiness

- Phase 1의 마지막 gap closure 계획이 끝났다. `01-VERIFICATION.md`의 남은 gaps(ELEM-02 나머지, 맨 위 about: 새 창 전체 지원)가 이 계획으로 닫혔다.
- 사람 확인 항목(이 계획이 다루지 않음): `01-VERIFICATION.md`의 human_verification 목록, D-25(깨진 설정일 때 전역 끄기 거부) 결정 대기, 한글 IME 실제 조합(CDP 조합 입력으로 대신함, 01-18에서 실측 확인).
- 다음 단계: `/gsd-verify-work` 재검증 → 통과하면 로드맵 완료 표시 → CLAUDE.md Post-build 넷을 건너뛰지 않는다: `/review` → `/qa` → `/cso`(필수 — 이 gap이 모든 프레임·about: 새 창 주입, 확장 메시지, 저장, 사이트 정체 판정을 건드렸다) → `/ship`.

---
*Phase: 01-click-helper-foundation*
*Completed: 2026-09-26*

## Self-Check: PASSED

- 생성 파일 확인: `tests/practice-site/blank-popup.html`, `tests/e2e/blank-popup.e2e.ts` — 모두 디스크에 존재.
- 커밋 5개 모두 `git log --oneline --all`에서 확인: `e5f63b3`, `431a840`, `50fcae4`, `d3495fc`, `55acdd0`.
- `commits: 5` — `git rev-list --count 37463578a7f5c8474cfc6ab250af96aefe3266a9..HEAD`로 측정(`plan_head_before`와 일치, 이 SUMMARY 커밋 전 기준).
