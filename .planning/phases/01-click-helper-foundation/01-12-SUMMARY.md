---
phase: 01-click-helper-foundation
plan: 12
subsystem: testing
tags: [playwright, e2e, showpicker, istrusted, spike, fixtures]

# Dependency graph
requires:
  - phase: 01-click-helper-foundation
    provides: 대신 누르기(press.ts)·자석 커서·스페이스바/번호표/머무르기 누르기 경로·모드 표시(mode-indicator.ts) — Plan 01-01~01-11
provides:
  - "tests/e2e/fixtures.ts: `blockedRequests` fixture + `expectNoExternalRequests()` — practice.test·other.test·chrome-extension:// 밖 요청을 전부 route.abort()하고 기록(D-14, D-31)"
  - "src/page/click/press.ts: `synthesizePress(el)`이 select·file/date/time/color 입력이면 focus()+showPicker()를 부르고 `{ picker: 'opened'|'blocked'|'none' }`를 돌려준다(D-13)"
  - "src/entrypoints/content.ts: picker==='blocked'면 모드 표시에 '이 칸은 직접 눌러 주세요' 2초 안내"
  - "tests/practice-site/spike.html·popup-target.html: 대상 A~F(사람 입력만 버튼·새창버튼·새탭링크·선택목록·파일입력·이벤트순서기록) 스파이크 연습 페이지"
  - "tests/e2e/spike.e2e.ts: 대상 × 방법(A~F × M1~M5 + G-shortcuts) 31칸 결과표를 test-results/spike-matrix.json과 콘솔 Markdown 표로 남기는 시험 11개"
affects: ["Phase 2 회사 시스템 확인 계획 — 이 스파이크의 works/blocked 결과가 입력이 된다(아직 만드는 중인 회사 시스템이 완성된 뒤)"]

# Actuals (#2632)
actuals:
  tokens: 8333
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "네이티브 피커(select·file·date·time·color)는 마우스 이벤트 순서 대신 focus()+showPicker()로 연다 — press.ts의 needsPicker() 분기"
    - "e2e에서 사이트 밖으로 나가는 요청을 전부 막는 fixture(blockedRequests)를 모든 시험이 공유하고, expectNoExternalRequests()로 개별 시험이 스스로 확인한다"

key-files:
  created:
    - tests/practice-site/spike.html
    - tests/practice-site/popup-target.html
    - tests/e2e/spike.e2e.ts
  modified:
    - tests/e2e/fixtures.ts
    - src/page/click/press.ts
    - src/entrypoints/content.ts

key-decisions:
  - "select 시험의 판정 근거를 'ArrowDown·Enter로 값이 바뀌는지'가 아니라 'focus가 select로 옮겨졌는지 + 차단 메시지가 뜨지 않았는지'로 바꿨다 — 이 샌드박스 헤드리스 크로미움에서는 순수 real 트러스트 클릭 + ArrowDown으로도 값이 바뀌지 않아(자체 확인), 대신 누르기 구현과 무관한 시험 환경의 한계로 판단했다"
  - "showPicker()는 트리거 종류(스페이스바 키 입력·머무르기 rAF 포함)와 상관없이 이 샌드박스에서 예외 없이 항상 성공한다 — RESEARCH.md Pattern 3의 '일시적 사용자 활성화 필요' 가정과 달랐다. M5(머무르기)도 막힐 것으로 예상했으나 works로 나왔다(아래 스파이크 결과 표 참고)"
  - "네이티브 팝업(select 드롭다운)이 하나의 persistent context 안 여러 페이지에 걸쳐 드물게 간섭하는 현상을 systematic-debugging으로 확인 — page.close()·팝업 밖 클릭+Escape 명시적 닫기·filechooser 타임아웃 5000ms·`test.describe.configure({ retries: 1 })`(spike.e2e.ts 파일 범위만) 조합으로 완화했다. 20+ 반복 실행에서 재현되지 않음을 확인"

patterns-established:
  - "네이티브 브라우저 UI(피커·파일 선택창)를 다루는 e2e는 페이지를 매번 명시적으로 닫고, 필요하면 파일 범위 retries를 근거와 함께 문서화해 둔다(전역이 아니라 이 부류 시험에만)"

requirements-completed: [CLICK-02]

coverage:
  - id: D1
    description: "로컬 연습 사이트에서 대상 여섯(사람 입력만 버튼·새창버튼·새탭링크·선택목록·파일입력·이벤트순서기록) × 방법 다섯(원래 클릭·자석 클릭·스페이스바·번호표·머무르기) 결과가 표로 기록된다"
    requirement: "CLICK-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/spike.e2e.ts#대상 A(사람 입력만 받는 버튼): 다섯 방법 결과"
        status: pass
      - kind: e2e
        ref: "tests/e2e/spike.e2e.ts#대상 B(window.open 버튼): 다섯 방법 결과"
        status: pass
      - kind: e2e
        ref: "tests/e2e/spike.e2e.ts#대상 C(target=_blank 링크): 다섯 방법 결과"
        status: pass
      - kind: e2e
        ref: "tests/e2e/spike.e2e.ts#대상 D(선택 목록): 다섯 방법 결과"
        status: pass
      - kind: e2e
        ref: "tests/e2e/spike.e2e.ts#대상 E(파일 선택): 다섯 방법 결과"
        status: pass
      - kind: e2e
        ref: "tests/e2e/spike.e2e.ts#대상 F(이벤트 순서 기록): 다섯 방법 결과"
        status: pass
      - kind: e2e
        ref: "tests/e2e/spike.e2e.ts#결과표가 31칸 모두 찼고 M1은 모든 대상에서 works이며 파일·콘솔로 낸다"
        status: pass
    human_judgment: false
  - id: D2
    description: "스페이스바를 자체 단축키로 쓰는 shortcuts.html에서 도우미 키가 먼저 동작하는지 결과가 같은 표에 기록된다"
    requirement: "CLICK-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/spike.e2e.ts#shortcuts.html에서 잡힌 버튼 + 스페이스바 결과(도우미 먼저/사이트 먼저)"
        status: pass
    human_judgment: false
  - id: D3
    description: "선택 목록·파일 선택은 이용자의 실제 키 입력 처리 안에서 열리고, 열리지 않으면 그 사실이 기록된다"
    requirement: "CLICK-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/spike.e2e.ts#select를 잡고 스페이스바를 누르면 focus가 옮겨지고 마우스 순서 대신 focus()+showPicker()만 불린다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/spike.e2e.ts#파일 입력을 잡고 스페이스바를 누르면 filechooser 이벤트가 온다"
        status: pass
    human_judgment: false
  - id: D4
    description: "시험은 연습 사이트(practice.test·other.test) 밖으로 나가는 요청이 하나도 없다"
    requirement: "CLICK-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/spike.e2e.ts#연습 사이트 밖으로 나가는 요청은 막히고 blockedRequests에 기록된다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/fixtures.ts#expectNoExternalRequests (spike.e2e.ts 11개 시험 전부에서 호출)"
        status: pass
    human_judgment: false

duration: 68min
completed: 2026-09-23
status: complete
---

# Phase 1 Plan 12: 대신 누르기의 한계를 로컬 연습 사이트에서만 확인 Summary

**로컬 연습 사이트에서 대상 6종 × 방법 5종(+ shortcuts.html 1칸) = 31칸 스파이크 결과표를 완성 — 사람 입력만 받는 버튼만 대신 누르기를 올바르게 걸러내고, window.open·새탭·선택목록·파일선택은 다섯 방법 모두 통과했다.**

## Performance

- **Duration:** 68min
- **Started:** 2026-09-23T22:30:22Z
- **Completed:** 2026-09-23T23:38:45Z
- **Tasks:** 2
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- 연습 사이트 밖으로 나가는 요청을 전부 막고 기록하는 `blockedRequests` fixture를 모든 e2e 시험이 공유하도록 만들었다(105→113개 전체 시험, 3회 연속 회귀 없음 확인)
- `synthesizePress()`가 select·file·date·time·color 입력에서는 마우스 순서 대신 `focus()+showPicker()`를 부르도록 만들고, 막히면 "이 칸은 직접 눌러 주세요" 안내를 띄운다
- 대상 6종(사람 입력만 버튼·새창버튼·새탭링크·선택목록·파일입력·이벤트순서기록) × 방법 5종(원래 클릭·자석 클릭·스페이스바·번호표·머무르기) + shortcuts.html 1칸 = 31칸 스파이크 결과표를 자동 생성해 `test-results/spike-matrix.json`과 콘솔 Markdown 표로 남겼다
- RESEARCH.md의 두 가정을 실측으로 갱신했다: showPicker()는 트리거와 무관하게 이 샌드박스에서 항상 성공하고, 반대로 select의 ArrowDown·Enter 키보드 탐색은 진짜 클릭으로도 이 헤드리스 환경에서 동작하지 않는다(둘 다 아래 표·결정 참고)

## Task Commits

Each task was committed atomically:

1. **Task 1: 외부 요청 차단 fixture와 선택 목록·파일 선택 열기 경로** - `78c2022` (test, RED) → `4a98a08` (feat, GREEN)
2. **Task 2: 대신 누르기 한계 스파이크 — 대상 × 방법 결과표** - `317c6eb` (test, RED) → `a7f4041` (feat, GREEN)

**Plan metadata:** _(다음 커밋에서 기록)_

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified

- `tests/e2e/fixtures.ts` - `context.route` 처리기를 practice.test·other.test(기존)·chrome-extension://·about:·data:(허용)·그 밖 전부(`route.abort()`+`blockedRequests` 기록)로 재구성. `expectNoExternalRequests()` export
- `src/page/click/press.ts` - `needsPicker()`·`PickerResult` 타입 추가. `synthesizePress()`가 피커 대상이면 `focus()+showPicker()` 경로로 분기
- `src/entrypoints/content.ts` - `pressOrDrag()` 두 호출부 모두 `picker==='blocked'`면 "이 칸은 직접 눌러 주세요" 2초 안내
- `tests/practice-site/spike.html` - 대상 A~F(사람 입력만 버튼·새창버튼·새탭링크·선택목록·파일입력·이벤트순서기록) 스파이크 페이지
- `tests/practice-site/popup-target.html` - B·C가 여는 대상(열림 판정용 빈 페이지)
- `tests/e2e/spike.e2e.ts` - 대상 × 방법 스파이크 결과표 시험 11개

## 스파이크 결과 (설계 11장 ①·④·⑤, 로컬 연습 사이트만)

| 대상 | M1 원래 클릭 | M2 자석 클릭 | M3 스페이스바 | M4 번호표 | M5 머무르기 |
| --- | --- | --- | --- | --- | --- |
| A-사람입력만 | works | **blocked** | **blocked** | **blocked** | **blocked** |
| B-새창열기(window.open) | works | works | works | works | works |
| C-새탭링크(target=_blank) | works | works | works | works | works |
| D-선택목록(select) | works | works | works | works | works |
| E-파일선택(file input) | works | works | works | works | works |
| F-이벤트순서기록 | works | works | works | works | works |

+ G-사이트단축키(shortcuts.html, 스페이스바만): works — 도우미 키가 사이트 keydown보다 먼저 받는다.

전체 31칸 원본: `test-results/spike-matrix.json`(gitignore 대상 — 시험 산출물, 커밋하지 않음. 재생성: `CI=true pnpm exec playwright test tests/e2e/spike.e2e.ts`).

### 대상별 근거

- **A(사람 입력만)**: 처리기가 `event.isTrusted`를 확인. M1(real click)만 카운터가 오르고, M2~M5(모두 대신 누르기의 synthetic 이벤트, `isTrusted:false`)는 카운터가 그대로였다 — 대신 누르기가 만드는 입력은 올바르게 "진짜 아님"으로 구분된다.
- **B·C(새 창·새 탭)**: `context.waitForEvent('page', {timeout:1500})`로 다섯 방법 모두 `popup-target.html`이 열렸다. synthetic 클릭이 만든 `window.open()`/`target=_blank` 네비게이션도 이 시험 환경(Playwright `launchPersistentContext`)에서는 팝업 차단 없이 통과했다.
- **D(선택목록)**: focus()+showPicker() 경로 — activeElement가 select로 옮겨지고 차단 메시지가 뜨지 않음으로 판정(아래 결정 참고, ArrowDown·Enter 값 변경은 단언하지 않음).
- **E(파일선택)**: `filechooser` 이벤트 발생으로 판정. 다섯 방법 모두 발생.
- **F(이벤트순서기록)**: 모든 방법에서 `click`까지 도달했다(work). 다만 M1만 전체 체인이 `trusted:true`이고, M2~M5는 `pointerdown→mousedown→(focus)→pointerup→mouseup→click` 체인이 전부 `trusted:false`로 기록됨 — 매크로 탐지(F처럼 순서·isTrusted를 기록하는 사이트라면)의 근거 자료.

### 회사 시스템 확인 목록에 넣을 항목 (회사 시스템 완성 뒤)

- **A류(isTrusted만 받는 입력)가 있는지 확인** — 회사 시스템에 "사람만 누를 수 있는" 보안 목적의 버튼/입력(예: 결재 최종 확인 버튼이 트러스트만 받도록 구현되어 있다면)이 있으면 대신 누르기가 거기서는 동작하지 않는다. 이 경우 이용자에게 "이 버튼은 직접 눌러 주세요" 같은 안내가 필요하다(현재 select·file 경로와 같은 패턴 재사용 가능).
- **B·C류(새 창/새 탭을 여는 버튼·링크)가 이 시험 환경과 다르게 동작하는지 확인** — 실제 크롬(확장 없이 일반 사용, 회사 배포 정책의 팝업 차단 설정 등)에서도 synthetic 클릭으로 새 창이 열리는지는 별도 확인이 필요하다. 이 스파이크는 Playwright `launchPersistentContext` 환경 결과이며, 회사 배포판 크롬·엣지·웨일의 팝업 차단 정책이 다를 수 있다.
- **D류(select 등 네이티브 피커)가 있는 화면에서 실제로 값을 바꾸는 조작(화살표 키 등)까지 필요한 워크플로가 있는지 확인** — 이 스파이크는 "피커가 열리는지"까지만 확인했고(그것으로 충분한 사례가 많음), 열린 뒤 키보드로 값을 바꾸는 것까지 필요한 화면이 있다면 별도 확인이 필요하다(아래 결정 참고).

### `contentSettings` 새 권한 필요 여부

**필요 없음.** 31칸 중 `blocked`로 나온 4칸(A의 M2~M5)은 모두 사이트가 `isTrusted`를 스스로 확인해서 막는 것이지, 브라우저 권한 부족으로 막힌 것이 아니다 — `contentSettings`는 페이지의 자체 JS 로직에는 영향을 주지 않으므로 이 권한을 추가해도 A는 열리지 않는다. B·C(새 창·새 탭)도 이미 다섯 방법 모두 `works`라 추가 권한이 필요 없었다. D-13에 따른 멈춤·승인 요청은 발생하지 않았다.

## Decisions Made

- **select 판정 기준 변경**: 원래 계획은 "ArrowDown·Enter로 값이 바뀌고 change가 기록됨"을 근거로 삼으려 했으나, 이 샌드박스 헤드리스 크로미움에서는 (a) 확장의 showPicker() 경로든 (b) 순수 real 트러스트 클릭 + ArrowDown이든 값이 바뀌지 않는 것을 systematic-debugging으로 확인했다. 대신 누르기 구현의 결함이 아니라 헤드리스 네이티브 select 팝업 자동화의 환경 한계로 판단해, 판정 기준을 "focus 이동 + 차단 메시지 없음"으로 바꿨다. ArrowDown·Enter 결과는 `console.log`로만 남긴다(실제 값: 항상 "apple", 즉 안 바뀜).
- **showPicker() 트리거 무관 항상 성공**: RESEARCH.md Pattern 3의 "일시적 사용자 활성화 필요" 가정과 달리, 스페이스바 키 입력이든 머무르기(dwell) rAF 콜백이든 예외 없이 성공했다. M5(머무르기)가 막힐 것이라는 계획의 `<가정>` 예상은 틀렸다 — 실제로는 D 대상 M5도 `works`다.
- **네이티브 팝업 간섭 완화**: 하나의 persistent context에 여러 페이지가 열리는 구조에서 select 드롭다운·파일 선택창 같은 브라우저 자체 UI가 드물게(수십 회 중 1회) 지연되는 현상을 systematic-debugging으로 원인 확정(자동화 인프라의 알려진 한계, 기능 결함 아님). `page.close()`(모든 spike 시험 공통, 이 파일에서 새로 도입한 패턴) + select 시험의 팝업 밖 클릭·Escape 명시적 닫기 + filechooser 타임아웃 5000ms + `test.describe.configure({ retries: 1 })`(spike.e2e.ts 파일 범위만) 조합으로 완화, 20회 이상 반복 실행에서 재현되지 않음을 확인했다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] select 시험의 RED가 구현 전 코드로도 통과하던 문제**
- **Found during:** Task 1
- **Issue:** 옛 `synthesizePress`가 이미 모든 요소에 대해 `focus()`를 부르고 있었고, 스페이스바 keydown이 만든 페이지 전역의 일시적 활성화가 이어져 select·file 네이티브 UI가 새 구현 없이도 열렸다 — RED가 가짜로 통과함
- **Fix:** `spike.html`에 `#sel-click-count`·`#file-click-count` 카운터를 추가하고, "마우스 순서를 더는 보내지 않는다(카운터가 0으로 남는다)"는 진짜 차이를 시험이 확인하도록 바꿨다
- **Files modified:** tests/practice-site/spike.html, tests/e2e/spike.e2e.ts
- **Committed in:** 78c2022(RED)·4a98a08(GREEN)

**2. [Rule 1 - Bug] select 값 변경 판정 기준이 이 환경에서 성립하지 않음**
- **Found during:** Task 1
- **Issue:** ArrowDown·Enter 뒤 값이 바뀌는지로 판정하려 했으나 이 헤드리스 환경의 네이티브 select 팝업 자동화 한계로 순수 real 클릭으로도 재현됨(대신 누르기와 무관)
- **Fix:** 판정 기준을 focus 이동 + 차단 메시지 없음으로 변경(위 "Decisions Made" 참고), ArrowDown·Enter 결과는 기록만
- **Files modified:** tests/e2e/spike.e2e.ts
- **Committed in:** 4a98a08

**3. [Rule 3 - Blocking] 네이티브 팝업 간섭으로 인한 간헐 실패**
- **Found during:** Task 1(파일 선택 시험이 select 시험 뒤 실행될 때 간헐 실패)
- **Issue:** 하나의 persistent context에 여러 페이지가 열리면 브라우저 자체 네이티브 UI(select 드롭다운·파일 선택창)가 드물게 지연됨
- **Fix:** page.close()·명시적 팝업 닫기·타임아웃 확대·파일 범위 retries:1(위 "Decisions Made" 참고)
- **Files modified:** tests/e2e/spike.e2e.ts
- **Committed in:** 4a98a08, 317c6eb, a7f4041

**4. [Rule 1 - Bug] lint 오류(no-unnecessary-condition)**
- **Found during:** Task 2 GREEN 뒤 `pnpm lint`
- **Issue:** `label.textContent ?? ''`가 이 코드베이스의 타입 설정에서는 불필요한 조건으로 지적됨
- **Fix:** hints.e2e.ts의 기존 동일 패턴(`?? ''` 없이 그대로 대입)을 그대로 따름
- **Files modified:** tests/e2e/spike.e2e.ts
- **Verification:** `pnpm typecheck && pnpm lint` 통과
- **Committed in:** a7f4041

---

**Total deviations:** 4 auto-fixed (2 bug/시험 정확성, 1 blocking/환경 완화, 1 lint)
**Impact on plan:** 모두 시험의 정확성·안정성을 위해 필요했다. 스코프 확장 없음 — 계획의 두 작업·산출물 범위를 벗어나지 않았다.

## Issues Encountered

None beyond the deviations above — 모두 위에서 다뤘다.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 성공 기준 4(스파이크 부분)를 충족했다: 대신 누르기의 한계가 로컬 연습 사이트에서 대상×방법 표로 기록됨
- 회사 시스템 확인은 계획대로 미룬다 — 회사 시스템이 완성된 뒤(2026-09-23 사용자 결정) 위 "회사 시스템 확인 목록"의 세 항목(A류 트러스트 전용 입력, B·C류 팝업 차단 정책, D류 피커 값 변경 필요 여부)을 확인한다
- `contentSettings` 등 새 권한 요청은 발생하지 않았다 — D-13 그대로 유지
- 남은 계획: 01-13(이 사이트에서 끄기, popup 마지막 카드 자리)

---
*Phase: 01-click-helper-foundation*
*Completed: 2026-09-23*

## Self-Check: PASSED

All created/modified files found on disk: `tests/practice-site/spike.html`, `tests/practice-site/popup-target.html`, `tests/e2e/spike.e2e.ts`, `tests/e2e/fixtures.ts`, `src/page/click/press.ts`, `src/entrypoints/content.ts`, `.planning/phases/01-click-helper-foundation/01-12-SUMMARY.md`. All task commits found in `git log`: `78c2022`, `4a98a08`, `317c6eb`, `a7f4041`.
