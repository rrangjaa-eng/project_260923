---
phase: 01-click-helper-foundation
plan: 16
subsystem: ui
tags: [playwright, fontface, shadow-dom, design-system-audit, css-custom-properties, performance]

# Dependency graph
requires:
  - phase: 01-click-helper-foundation
    provides: "오버레이 shadow root(Plan 01-01)·강조 테두리(Plan 01-03)·번호표(Plan 01-06)·확인 화면(Plan 01-09)·토스트(Plan 01-14)·확대 역보정(Plan 01-15) — 모두 tokens.css 변수만 쓰는 컴포넌트, mode-indicator.ts ensureOverlayRoot()"
provides:
  - "오버레이·메뉴 IBM Plex Sans KR 서체 등록(ensureHelperFontsRegistered, wxt.config.ts web_accessible_resources)"
  - "5,000요소 연습 페이지(tests/practice-site/big.html, churn 부하 모드)와 50ms 반응 시간 자동 측정(overlay-perf.e2e.ts)"
  - "독립 DOM 감사(tests/e2e/dom-audit.e2e.ts, 별도 감사 에이전트 작성·판정) 16개 — 색·radius·그림자·서체·테두리 기하·대비·word-break·모션·확대 무관 크기"
  - "collector.ts buildOrdinalMap() — domPathOf O(n²) 제거, 대량 DOM에서도 수집이 빠름"
  - "Phase 1 전체 게이트(단위 94 + e2e 161 = 255, lint, typecheck, build) CI=true 한 번 통과, 네트워크 API grep 없음"
affects: [overlay, click-helper-ui, phase-2-user-test]

# Actuals (#2632)
actuals:
  tokens: 19906
  tasks: 3
  commits: 10
plan_head_before: b82fcbf5f4d2cfb6515a03875e79e9136a215e7f

# Tech tracking
tech-stack:
  added:
    - "@fontsource/ibm-plex-sans-kr 5.3.0 (woff2 파일만 확장 안에 복사해 씀, 패키지 자체 CSS는 팝업에서만 import)"
  patterns:
    - "Shadow DOM 안 @font-face는 적용되지 않는다 — document.fonts.add(new FontFace(...))로 문서 전체(Document)에 등록. Shadow DOM 경계와 무관해 팝업·오버레이가 같은 등록 함수를 공유한다"
    - "흰 후광(halo)은 box-shadow가 아니라 outline(바깥)·::before 테두리(안쪽)로 그린다(SYSTEM.md '그림자는 쓰지 않는다') — ring.ts가 이미 outline을 썼고, 이번에 mode-indicator·hints의 box-shadow를 outline으로 맞추고 ring.ts에 안쪽 ::before 후광을 더했다"
    - "collector.ts buildOrdinalMap(): 프레임 안 형제 순번을 domPathOf 호출마다 다시 세지 않고 한 번의 트리 순회로 Map<Element, number>에 캐시 — per-collect 상수 시간 조회로 O(n²)→O(n)"

key-files:
  created:
    - tests/practice-site/big.html
    - tests/e2e/dom-audit.e2e.ts
  modified:
    - src/page/overlay/mode-indicator.ts
    - src/page/overlay/hints.ts
    - src/page/overlay/ring.ts
    - src/page/overlay/toast.ts
    - src/page/overlay/confirm-dialog.ts
    - src/entrypoints/popup/main.ts
    - src/page/collector/collector.ts
    - src/types/chrome.d.ts
    - wxt.config.ts
    - tests/e2e/overlay-perf.e2e.ts
    - tests/e2e/confirm.e2e.ts

key-decisions:
  - "IBM Plex Sans KR은 fontsource 'korean'·'latin' 서브셋(4개 woff2, unicode-range 없음)만 쓴다 — 전체 CJK 통합 한자 묶음(수백 파일)은 이 도우미의 한글·숫자·라틴 문구에 필요 없다(실행자 판단)"
  - "document.fonts.check()가 이 샌드박스에서 항상 true를 돌려줘 실제 등록 확인 수단이 못 된다 — 모든 서체 시험은 Array.from(document.fonts) 멤버십으로 확인한다"
  - "확인 카드 테두리는 --danger가 아니라 --accent 3px다(SYSTEM.md 형태) — 위험 신호는 카드 테두리가 아니라 빨강 채움 확인 버튼과 글자만 맡는다(SYSTEM.md 버튼 위계). 01-15에서 잘못 굳어진 관례를 이번 감사로 고쳤다"
  - "강조 테두리(ring.ts)의 '안팎 흰 후광 2px'은 바깥은 outline, 안쪽은 ::before(position:absolute; inset:0; border:2px solid --halo)로 그린다 — inset:0은 부모(.ring)의 padding 경계(5px 테두리 안쪽)에 맞춰지므로 정확히 테두리 안쪽에 붙는다"
  - ".card:focus-visible은 border를 붙이는 대신 outline 3px --accent로 바꿨다 — border는 레이아웃이 밀리지만 outline은 밀리지 않는다(DESIGN.md §6)"
  - "확인 카드 안쪽 여백은 세로 36px(리터럴, tokens.css에 맞는 토큰 없음) × 가로 --space-7(40px), 둘 다 --overlay-scale과 함께 커진다"

patterns-established:
  - "DOM 감사(감사 에이전트 작성) → 실행자가 SYSTEM.md에 맞춰 수정 → 감사 시험 재실행(기준 불변) 흐름은 이후 phase의 UI 계획에도 그대로 재사용 가능"

requirements-completed: [ELEM-04]

coverage:
  - id: D1
    description: "오버레이·팝업 메뉴가 확장 안에 넣은 IBM Plex Sans KR로 보이고 사이트 자신의 서체는 바뀌지 않는다"
    verification:
      - kind: e2e
        ref: "tests/e2e/overlay-perf.e2e.ts (Task 1의 3개 behavior)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/dom-audit.e2e.ts#감사 3: 글자가 있는 모든 부품의 font-family가 IBM Plex Sans KR로 시작하고 실제로 올라와 있다"
        status: pass
    human_judgment: false
  - id: D2
    description: "5,000요소 연습 페이지에서 커서 이동 후 강조가 50ms 안에 따라오는 것(30번 이상 이동, p95 < 50ms) — 정상 모드와 100ms마다 100개가 바뀌는 부하 모드 모두"
    requirement: "ELEM-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/overlay-perf.e2e.ts#overlay-perf 정상 모드(측정: n=32, median 16.8ms, p95 18.9ms, max 20.3ms — 전체 게이트 실행 기준)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/overlay-perf.e2e.ts#overlay-perf 부하 모드(측정: n=32, median 4.6ms, p95 40.9ms, max 41.8ms — 전체 게이트 실행 기준)"
        status: pass
    human_judgment: false
  - id: D3
    description: "독립 감사 에이전트(모델 opus — 아래 편차 참고)가 작성·판정한 DOM 감사 16개가 SYSTEM.md·tokens.css·DESIGN.md §6과의 어긋남 없이 통과한다(색·radius·그림자 없음·서체·강조 테두리 기하·번호표 크기·메뉴 카드·확인 카드·모드 표시 자리·대비·word-break·모션·확대 무관 크기)"
    verification:
      - kind: e2e
        ref: "tests/e2e/dom-audit.e2e.ts (16 tests, 2회 연속 실행 모두 16 passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "전체 게이트(단위 → e2e, lint, typecheck, build)가 CI=true로 한 번에 통과하고, src/에 네트워크 API 호출이 없다(T-01-44, D-31)"
    requirement: "ELEM-04"
    verification:
      - kind: unit
        ref: "pnpm test:unit (vitest) — 94 passed (13 files)"
        status: pass
      - kind: e2e
        ref: "pnpm test:e2e (playwright, CI=true) — 161 passed"
        status: pass
      - kind: other
        ref: "pnpm lint (eslint) — 0 errors"
        status: pass
      - kind: other
        ref: "pnpm typecheck (tsc --noEmit) — 0 errors"
        status: pass
      - kind: other
        ref: "grep -rnE '\\bfetch\\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource' src/ — 빈 결과"
        status: pass
    human_judgment: false

duration: (이어진 세션, 정확한 벽시계 시간 미기록 — Task 1·2·독립 감사 작성은 이전 세션, Task 3 수정·전체 게이트·SUMMARY는 이 세션)
completed: 2026-09-24
status: complete
---

# Phase 1 Plan 16: 서체·5,000요소 반응 시간·독립 DOM 감사로 Phase 1 닫기 Summary

**오버레이·메뉴에 확장 안 IBM Plex Sans KR 서체를 등록하고, 5,000요소 연습 페이지에서 강조 반응 시간 p95 18.9ms(정상)·40.9ms(100ms마다 100개 바뀌는 부하)로 50ms 기준을 통과시킨 뒤, 별도 감사 에이전트가 작성·판정한 독립 DOM 감사 16개(색·그림자·서체·테두리 기하·대비·모션·확대 무관 크기)에서 잡힌 8개 어긋남(그림자 후광→outline, 강조 테두리 안쪽 흰 후광 누락, 메뉴 초점 표시 레이아웃 밀림, 확인 카드 테두리 색·여백, 한글 word-break)을 모두 SYSTEM.md에 맞춰 고쳐 Phase 1 전체 게이트(단위 94 + e2e 161, lint, typecheck, build, CI=true)를 한 번에 통과시켰다.**

## Performance

- **Tasks:** 3/3 완료
- **Files modified:** 17 (신규 2 — `tests/practice-site/big.html`, `tests/e2e/dom-audit.e2e.ts`; 수정 15, woff2 폰트 파일 4개 포함)
- **Commits:** 10 (RED/GREEN × 2 TDD 작업 + 감사 시험 1 + 감사 수정 5)

## Accomplishments

- **Task 1(TDD) — 서체:** `wxt.config.ts`에 fontsource `korean`·`latin` 서브셋 woff2 4개를 `fonts/`로 넣고 `web_accessible_resources`로 열었다. `mode-indicator.ts`의 `ensureHelperFontsRegistered()`가 `chrome.runtime.getURL` + `FontFace` + `document.fonts.add`로 오버레이·팝업 양쪽 문서에 서체를 등록한다(Shadow DOM 안 `@font-face`가 적용되지 않는다는 알려진 함정을 피함). 사이트 자신의 서체·`blockedRequests`는 그대로다.
- **Task 2(TDD) — 5,000요소 50ms:** `tests/practice-site/big.html`(5,000개 누를 수 있는 요소, `?churn=1` 100ms마다 100개 변경 부하 모드)과 `overlay-perf.e2e.ts`의 p95 측정을 추가했다. 첫 측정에서 기준을 넘겨 `collector.ts`의 `domPathOf` O(n²)를 `buildOrdinalMap()`(한 번의 트리 순회로 형제 순번 캐시)으로 고치고 `collect()`의 AND 조건 순서를 재배치해(값싼 뷰포트 검사 우선) 정상 모드 p95 16.8~18.9ms, 부하 모드 p95 36.7~49.1ms(실행마다 변동, 항상 50ms 아래)로 통과시켰다.
- **Task 3 — 독립 DOM 감사 → 수정 → 전체 게이트:**
  1. 싼 게이트(lint·typecheck·CI=true build) 통과 확인.
  2. **별도 감사 에이전트**(model: opus — 아래 편차 참고)가 `docs/design/SYSTEM.md`·`tokens.css`·`DESIGN.md §6`만 기준으로 `tests/e2e/dom-audit.e2e.ts` 16개를 작성하고 실측 판정, 5개 어긋남을 찾아 돌려줬다(색·radius는 이미 통과, 그림자·안쪽 후광·초점 표시·확인 카드 테두리·여백·word-break가 어긋남).
  3. 어긋남 8개(아래 표) 전부를 SYSTEM.md에 맞춰 고쳤다 — SYSTEM.md를 벗어나야 하는 항목은 없었다(DECISIONS.md 수정·승인 요청 불필요). 감사 시험은 실행자가 기준을 바꾸지 않고 그대로 재실행해 16/16(2회 연속) 통과를 확인했다.
  4. 전체 게이트: `CI=true pnpm test`(단위 94 + e2e 161 = 255, 0 failed) · `pnpm lint`(0 errors) · `pnpm typecheck`(0 errors) · 네트워크 API grep(`fetch`·`XMLHttpRequest`·`WebSocket`·`sendBeacon`·`EventSource`) `src/`에서 빈 결과.

### 감사에서 잡힌 8개 어긋남과 수정

| # | 부품 | 실측(수정 전) | 기준(SYSTEM.md) | 수정 | 커밋 |
|---|---|---|---|---|---|
| 1 | `.mode-indicator` | `box-shadow` 흰 후광 | 그림자 없음, outline 2px 흰 후광 | box-shadow → outline | f2194cf |
| 2 | `.hint-label` | `box-shadow` 흰 후광 | 〃 | 〃 | f2194cf |
| 3 | `.hint-next-card` | `box-shadow` 흰 후광 | 〃 | 〃 | f2194cf |
| 4 | `.ring`(강조 테두리) | 바깥 outline만 | 남색 5px + **안팎** 흰 후광 2px | `::before`로 안쪽 흰 후광 추가 | e9f3f08 |
| 5 | `.card:focus-visible`(팝업) | 3px accent **border**(레이아웃 밀림) | 3px accent **outline** | border → outline | cbd0aff |
| 6 | `[data-part=confirm-dialog]` 테두리 | `--danger` | `--accent` 3px(위험은 버튼·글자로만 신호) | danger → accent, `confirm.e2e.ts` 단언도 수정 | 44f8427 |
| 7 | 확인 카드 padding | 32px 균일 | 36px 40px | `calc(36px * scale) calc(var(--space-7) * scale)` | 44f8427 |
| 8 | 한글 부품(토스트·모드 표시·위험 태그·다음 번호·확인 화면·팝업) | `word-break: normal` | `word-break: keep-all` | 각 컴포넌트 루트에 추가(상속) | f2194cf, e9f3f08, cbd0aff, 44f8427, efa67c4 |

## Task Commits

Each task was committed atomically:

1. **Task 1: 오버레이·메뉴 IBM Plex Sans KR 서체** (TDD) — `0d5652a`(test, RED) → `e9b9b21`(feat, GREEN)
2. **Task 2: 5,000요소 페이지 50ms 측정** (TDD) — `a91c285`(test, RED) → `d4529b4`(feat, GREEN — collector.ts O(n²) 제거)
3. **Task 3: 독립 DOM 감사 → 수정 → 전체 게이트**
   - `83a267d`(test — 감사 에이전트가 작성한 `dom-audit.e2e.ts`)
   - `f2194cf`(fix — 그림자 후광→outline, mode-indicator·hints의 word-break)
   - `e9f3f08`(fix — 강조 테두리 안쪽 흰 후광, ring-danger-label word-break)
   - `cbd0aff`(fix — 메뉴 카드 focus-visible outline, popup word-break)
   - `44f8427`(fix — 확인 카드 테두리·여백, confirm.e2e.ts 단언 수정)
   - `efa67c4`(fix — 토스트 word-break)

**Plan metadata:** (이 커밋 자체)

_Note: TDD 작업은 RED→GREEN 두 커밋, Task 3는 감사 시험 1개 + 어긋남별 수정 커밋 5개._

## Files Created/Modified

- `tests/practice-site/big.html` (신규) - 5,000요소 연습 페이지, `?churn=1` 부하 모드
- `tests/e2e/dom-audit.e2e.ts` (신규) - 독립 DOM 감사 16개(감사 에이전트 작성)
- `tests/e2e/overlay-perf.e2e.ts` - 서체 확인 3개 + 반응 시간 측정 2개(정상·부하)
- `src/page/overlay/mode-indicator.ts` - 서체 등록(`ensureHelperFontsRegistered`), 모드 표시 box-shadow→outline, word-break
- `src/page/overlay/hints.ts` - 번호표·다음 카드 box-shadow→outline, word-break
- `src/page/overlay/ring.ts` - 강조 테두리 안쪽 흰 후광(`::before`), 위험 태그 word-break
- `src/page/overlay/toast.ts` - word-break
- `src/page/overlay/confirm-dialog.ts` - 테두리 색(danger→accent), padding(32px→36px 40px), word-break
- `src/entrypoints/popup/main.ts` - `.card:focus-visible` border→outline, 서체 등록 호출, word-break
- `src/page/collector/collector.ts` - `buildOrdinalMap()`(O(n²) 제거), `collect()` 조건 순서 재배치
- `src/types/chrome.d.ts` - `chrome.runtime.getURL` 타입 추가
- `wxt.config.ts` - `web_accessible_resources`(`fonts/*.woff2`)
- `tests/e2e/confirm.e2e.ts` - 확인 카드 테두리 단언을 danger→accent로 수정(01-15 편차 정정)
- `public/fonts/*.woff2` (신규 4개) - IBM Plex Sans KR korean/latin 400/700

## Decisions Made

프론트매터 `key-decisions` 참고. 요약:
- 서체는 fontsource korean·latin 서브셋 4개 파일만(전체 CJK 불필요)
- `document.fonts.check()`가 이 샌드박스에서 신뢰 불가 — 시험은 `Array.from(document.fonts)` 멤버십으로 확인
- 확인 카드 테두리는 accent(위험 신호는 버튼·글자만), 안쪽 여백 36px 40px(36px는 토큰 없어 리터럴)
- 강조 테두리 안쪽 흰 후광은 `::before` + `inset:0`(부모 padding 경계 = 테두리 안쪽)
- 메뉴 카드 초점 표시는 border 대신 outline(레이아웃 안 밀림)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `collector.ts` `domPathOf` O(n²) → `buildOrdinalMap()` 캐시**
- **Found during:** Task 2 (5,000요소 반응 시간 측정)
- **Issue:** `domPathOf`가 매 수집마다 형제 순번을 다시 세어 5,000요소에서 수집 1회에 약 3.9초 걸렸다(50ms 기준 크게 초과).
- **Fix:** `collect()` 진입 시 한 번의 트리 순회로 `Map<Element, number>`(형제 순번)를 만들어 캐시, `domPathOf`는 그 맵을 조회만 한다.
- **Files modified:** `src/page/collector/collector.ts`
- **Verification:** `overlay-perf.e2e.ts` 정상 모드 p95 16.8~18.9ms(50ms 기준 통과), 전체 게이트 e2e 161개 통과(danger·frames·input-filter·magnet 등 collector를 실제로 쓰는 시험 포함).
- **Committed in:** d4529b4

**2. [Rule 1 - Bug] `collect()`의 AND 조건 순서 재배치**
- **Found during:** Task 2 (같은 성능 조사)
- **Issue:** 비용이 비싼 `el.matches`·조상 `getComputedStyle` 검사가 값싼 뷰포트 검사보다 먼저 돌아 불필요한 계산이 많았다.
- **Fix:** 뷰포트 검사를 먼저 돌도록 조건 순서만 바꿨다(동작 변화 없음, 순수 성능).
- **Files modified:** `src/page/collector/collector.ts`
- **Verification:** 위와 동일(같은 커밋).
- **Committed in:** d4529b4

**3. [Rule 3 - Blocking] `src/types/chrome.d.ts`에 `chrome.runtime.getURL` 추가**
- **Found during:** Task 1 (서체 등록 구현)
- **Issue:** `@types/chrome`가 승인 목록에 없어 이 파일이 유일한 타입 출처인데(01-01부터의 관행), `chrome.runtime.getURL`이 선언돼 있지 않아 타입체크가 막혔다.
- **Fix:** 최소 ambient 타입 1개 추가.
- **Files modified:** `src/types/chrome.d.ts`
- **Verification:** `pnpm typecheck` 0 errors.
- **Committed in:** e9b9b21

**4. [Rule 2 - 독립 감사 어긋남 수정] 8개 — 위 "감사에서 잡힌 8개 어긋남과 수정" 표**
- **Found during:** Task 3 step 2 (독립 DOM 감사, 별도 에이전트 판정)
- **Issue:** 그림자 후광(box-shadow 사용)·강조 테두리 안쪽 흰 후광 누락·메뉴 초점 레이아웃 밀림·확인 카드 테두리 색(danger)·확인 카드 여백(32px 균일)·한글 word-break 누락.
- **Fix:** 각 파일을 SYSTEM.md에 맞춰 수정(표 참고). 감사 시험 기준은 바꾸지 않았다.
- **Files modified:** `src/page/overlay/mode-indicator.ts`, `hints.ts`, `ring.ts`, `toast.ts`, `confirm-dialog.ts`, `src/entrypoints/popup/main.ts`, `tests/e2e/confirm.e2e.ts`(단언만)
- **Verification:** `CI=true pnpm exec playwright test tests/e2e/dom-audit.e2e.ts` 16 passed × 2회 연속.
- **Committed in:** f2194cf, e9f3f08, cbd0aff, 44f8427, efa67c4

---

**Orchestrator deviation (계획 밖 결정, 실행자가 아닌 오케스트레이터):** 계획은 감사 에이전트를 `model: "sonnet"`으로 지정했으나, 저장소 CLAUDE.md("점검·계획·기획·판단·검토는 Opus 5로 한다")에 따라 오케스트레이터가 `model: opus`로 감사 에이전트를 띄웠다. 감사 판정 자체(어긋남 5개 발견, 실측 근거)에는 영향 없음 — 감사 시험(`dom-audit.e2e.ts`)이 실제 브라우저 실측이라 어느 모델이 작성했든 판정은 같은 코드로 재현 가능하다.

**Total deviations:** 4 그룹(Rule 1 버그 2개, Rule 3 블로킹 1개, 독립 감사 어긋남 8개) + 오케스트레이터 결정 1개(모델 선택)
**Impact on plan:** 모두 계획이 명시적으로 예상·허용한 범위(Rule 1/2/3, "SYSTEM.md 안에서 고친다") 안에서 처리됐다. 범위 확장(scope creep) 없음 — SYSTEM.md·DECISIONS.md 수정도 없었다.

## Issues Encountered

None beyond the deviations above.

## Known Stubs

없음.

## Known Gaps

없음 — must_haves truths 4개 전부 자동 시험으로 확인됐다(위 coverage D1~D4).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 1(클릭 도우미 기반)의 16개 계획이 모두 끝났다.** 다음은 CLAUDE.md Post-build 넷(`/review` → `/qa` → `/cso` → `/ship`)이다 — 이 phase는 외부 입력·권한(확장 권한, iframe, storage)을 다루므로 `/cso`는 선택이 아니다. 아직 실행되지 않았다.
- `/gsd-verify-work`로 Phase 1 전체 UAT(외부 전송 금지 판단 검토 포함, T-01-44)를 진행할 수 있다.
- 이 계획이 만든 감사 패턴(별도 에이전트 작성·판정 + 실행자 수정)은 이후 phase의 UI 계획에서도 재사용 가능.

---
*Phase: 01-click-helper-foundation*
*Completed: 2026-09-24*

## Self-Check: PASSED

- All 14 referenced created/modified files verified present on disk (`tests/practice-site/big.html`, `tests/e2e/dom-audit.e2e.ts`, `src/page/overlay/mode-indicator.ts`, `src/page/overlay/hints.ts`, `src/page/overlay/ring.ts`, `src/page/overlay/toast.ts`, `src/page/overlay/confirm-dialog.ts`, `src/entrypoints/popup/main.ts`, `src/page/collector/collector.ts`, `src/types/chrome.d.ts`, `wxt.config.ts`, `tests/e2e/confirm.e2e.ts`, `tests/e2e/overlay-perf.e2e.ts`, this SUMMARY).
- All 10 plan commit hashes verified in `git log --oneline --all` (`0d5652a`, `e9b9b21`, `a91c285`, `d4529b4`, `83a267d`, `f2194cf`, `e9f3f08`, `cbd0aff`, `44f8427`, `efa67c4`).
