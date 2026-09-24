---
phase: 01-click-helper-foundation
plan: 13
subsystem: browser-extension
tags: [mv3, chrome-extension, playwright, zod, storage-sync, per-site-settings]

# Dependency graph
requires:
  - phase: 01-click-helper-foundation (01-12)
    provides: 대상×방법 스파이크 결과표, tests/e2e/spike.e2e.ts 인프라(fixtures.ts 기반)
provides:
  - "isUnsupportedUrl 순수 함수 — 브라우저 내부/스토어/파일 주소 판정"
  - "확장 아이콘 '도울 수 없음' 표시(제목·배지) + 응답 없음(site/ping) 판정"
  - "메뉴 카드 2 '이 사이트에서 끄기' + '도울 수 없음' 안내 문구"
  - "storage.sync site:<origin> 항목 — setSiteDisabled, 쓰기 합치기, 60초/100회 한도"
  - "content.ts 사이트별 끄기 반영(site/query, storage.onChanged)"
  - "fixtures.ts openPopup(target?) 대상 탭 지정"
affects: [01-14, popup, background, storage-writer]

# Actuals (#2632)
actuals:
  tokens: 12327
  tasks: 3
  commits: 6
plan_head_before: be9474b56a80d86263b4dbe04317a3f328957b74

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "사이트별 storage.sync 항목(site:<origin>)에 쓰기 합치기 + 전역 슬라이딩 윈도 쓰기 한도(60s/100회)를 얹은 단일 저장자 큐"
    - "응답 없음 판정(site/ping 1초 타임아웃 레이스)으로 주소 규칙만으로 못 잡는 '도울 수 없음' 페이지 탐지"
    - "팝업이 대상 탭 출처를 주장할 수 없어(확장 페이지) SW가 chrome.tabs.get(tabId)로 재확인(T-01-36)"

key-files:
  created:
    - src/core/unsupported-url.ts
    - tests/unit/unsupported-url.test.ts
    - tests/e2e/site-toggle.e2e.ts
  modified:
    - src/entrypoints/background.ts
    - src/entrypoints/content.ts
    - src/entrypoints/popup/main.ts
    - src/shared/messages.ts
    - src/types/chrome.d.ts
    - src/worker/storage-writer.ts
    - tests/e2e/fixtures.ts
    - tests/e2e/spike.e2e.ts

key-decisions:
  - "spike.e2e.ts의 test.describe.configure({ retries: 1 })는 근본 원인(showPicker() select 팝업이 Escape만으로는 안 닫힘)을 찾아 document.activeElement?.blur()로 대체 — 재시도 제거"
  - "CSP: sandbox는 content script(격리된 세계)를 막지 못한다는 사실을 실측으로 확인 — RESEARCH.md 가정을 뒤집고 테스트를 실제 동작에 맞게 수정"
  - "사이트 = 맨 위 페이지 출처(origin)로 확정 — content script가 site/query로 SW에 물어 계산(자신은 교차 출처 iframe일 때 top origin을 모름)"

patterns-established:
  - "storage-writer.ts 안에서 같은 키 쓰기를 합치는 큐(SiteWriteQueue)와 전역 syncSet() 쓰기 한도 래퍼 — 이후 계획이 새 storage.sync 키를 추가할 때 재사용"

requirements-completed: [SAFE-04, SAFE-05, STOR-01]

coverage:
  - id: D1
    description: "isUnsupportedUrl 순수 함수 — 브라우저 내부/스토어/파일/빈 주소를 '도울 수 없음'으로 판정"
    requirement: "SAFE-05"
    verification:
      - kind: unit
        ref: "tests/unit/unsupported-url.test.ts (7 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "확장 아이콘 제목·배지로 '도울 수 없음' 표시, 메뉴에 안내 문구"
    requirement: "SAFE-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/site-toggle.e2e.ts — 3 tests (Task 2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "지금 사이트에서만 끄기(사이트별 storage.sync 항목, 쓰기 합치기, 분당 한도)"
    requirement: "SAFE-04 / STOR-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/site-toggle.e2e.ts — 7 tests (Task 3)"
        status: pass
    human_judgment: false
  - id: D4
    description: "다른 PC(같은 브라우저 계정)에서 사이트별 끄기가 그대로 적용된다"
    verification: []
    human_judgment: true
    rationale: "plan의 backstop truth — 실제 다른 PC 확인이 필요해 자동 e2e로 증명 불가 (D-29). e2e는 SW가 site:<origin>을 직접 바꾸는 것으로 동기화 도착을 흉내만 냈다."

duration: 46min
completed: 2026-09-24
status: complete
---

# Phase 1 Plan 13: 지금 사이트에서만 끄기 + 도울 수 없음 표시 Summary

**사이트별 storage.sync 항목(site:&lt;origin&gt;)에 쓰기 합치기·분당 한도를 더한 "이 사이트에서만 끄기" 기능과, 주소 규칙+응답 없음 판정을 결합한 확장 아이콘 "도울 수 없음" 표시**

## Performance

- **Duration:** 46 min (커밋 타임스탬프 기준, be9474b~d208f23)
- **Tasks:** 3 (+ 예비 수정 1건)
- **Files modified:** 10 (예비 수정 포함 시 spike.e2e.ts 추가)
- **Commits:** 6 (plan 커밋) + 예비 수정 1건 = 7

## Accomplishments
- `isUnsupportedUrl` 순수 함수로 브라우저 내부 스킴·확장 스토어·file:·잘못된 주소를 판정(단위 시험 7개)
- 확장 아이콘이 "도울 수 없음" 페이지에서 제목·배지·배지색(tokens.css `--muted`)을 바꾸고, 응답 없음(1초 site/ping 타임아웃) 판정으로 주소 규칙이 못 잡는 페이지도 잡는다
- 메뉴에 "이 사이트에서 끄기" 카드(키 2)와 사이트 상태 한 줄이 추가되고, 도울 수 없는 탭을 대상으로 열면 안내 문구만 보인다
- `storage-writer.ts`에 `setSiteDisabled`가 추가되어 사이트별 항목의 `disabled`만 바꾸고 `pins`는 보존하며, 같은 키 쓰기 합치기 + 전역 60초/100회 쓰기 한도로 150회 연타에도 오류 없이 마지막 상태로 수렴
- (예비) `spike.e2e.ts`의 `test.describe.configure({ retries: 1 })`를 근본 원인 수정으로 제거

## Task Commits

Each task was committed atomically:

0. **예비: spike.e2e.ts 재시도 제거(근본 원인 수정)** - `be9474b` (fix)
1. **Task 1: "도울 수 없음" 주소 판정 (순수 함수)**
   - RED: `88003c2` (test)
   - GREEN: `3f34ecf` (feat)
2. **Task 2: 확장 아이콘 "도울 수 없음"과 메뉴 안내, 시험용 대상 탭 지정**
   - RED: `9b4fb90` (test)
   - GREEN: `f468b6e` (feat)
3. **Task 3: 지금 사이트에서만 끄기·사이트별 동기화 항목·쓰기 합치기**
   - RED: `714314b` (test)
   - GREEN: `d208f23` (feat)

_Note: 모든 실행 단계는 RED 커밋(실패 확인 후) → GREEN 커밋(최소 구현) 순서로 진행했다._

## Files Created/Modified
- `src/core/unsupported-url.ts` - `isUnsupportedUrl(url)` 순수 함수(스킴·스토어 호스트·file: 판정)
- `tests/unit/unsupported-url.test.ts` - 판정 규칙 7개 단위 시험
- `src/entrypoints/background.ts` - 탭 활성/갱신 시 주소 판정 + `site/ping` 응답 없음 판정 → 아이콘 제목·배지, `setSiteDisabled`/`site/query` 메시지 처리
- `src/entrypoints/content.ts` - `siteDisabled` 상태, `syncEnabled()`로 전역·사이트별 끄기 합성, `site/ping` 응답, 시작 시 `site/query`로 맨 위 출처 확인 후 `site:<origin>` 구독
- `src/entrypoints/popup/main.ts` - 대상 탭 결정(`resolveTargetTabId`), "도울 수 없음" 안내, "이 사이트에서 끄기" 카드 + 상태 한 줄
- `src/shared/messages.ts` - `setSiteDisabled` op, `site/ping`, `site/query` 메시지 스키마
- `src/types/chrome.d.ts` - `chrome.tabs.get`, `onActivated`, `chrome.action.*`, `sender.tab.url` 타입 추가
- `src/worker/storage-writer.ts` - `setSiteDisabled`(쓰기 합치기 큐) + 모든 `storage.sync.set`을 감싸는 `syncSet`(60초/100회 한도)
- `tests/e2e/fixtures.ts` - `openPopup(target?)` 대상 탭 지정, `servePage`에 응답 머리글 옵션 추가
- `tests/e2e/site-toggle.e2e.ts` - 새 e2e 10개(Task 2 3개 + Task 3 7개)
- `tests/e2e/spike.e2e.ts` - (예비 수정) 재시도 설정 제거, select 팝업을 `blur()`로 결정적으로 닫기, 파일선택 대기시간 확대

## Decisions Made
- "지금 사이트"는 맨 위 페이지의 origin으로 확정 — content script가 교차 출처 iframe일 수 있어 스스로는 top origin을 모르므로 `site/query`로 SW에 물어 `sender.tab.url`에서 계산한다.
- "도울 수 없음" 판정은 주소 규칙(순수 함수) + 응답 없음(1초 `site/ping` 타임아웃) 두 신호의 OR로 확정 — 하나만으로는 CSP 등으로 막힌 페이지를 못 잡는다는 RESEARCH.md의 가정을 실측 후 그대로 유지(단, sandbox CSP는 이 경로를 트리거하지 않음을 실측으로 확인 — 아래 편차 참고).
- 사이트별 동기화 항목 검사 실패 시 기본값은 "켜짐"(disabled: false)으로 동작하고 원본은 쓰지 않는다(D-25, T-01-38) — 저장소가 손상돼도 도우미가 조용히 꺼지는 사고를 막는다.

## Deviations from Plan

### Auto-fixed Issues

**1. [예비 작업 — 사용자 지시에 따른 근본 원인 수정] spike.e2e.ts의 `test.describe.configure({ retries: 1 })` 제거**
- **Found during:** 실행 전 예비 단계(Task 1 이전, `systematic-debugging` 스킬 사용)
- **Issue:** Plan 01-12에서 페이지 간 네이티브 팝업(브라우저 select 드롭다운) 간섭으로 보이는 간헐적 실패를 재시도 1회로 덮어 두고 있었다. 재시도는 허용되지 않는다.
- **조사:** (1) 각 Playwright 테스트가 같은 브라우저 프로세스를 공유하는지 의심해 `pgrep -f "chrome|chromium"`을 0.5초 간격으로 표본 수집 — `context` fixture(worker 스코프 미지정)가 테스트마다 새 Chromium 프로세스를 띄운다는 것을 확인해 "프로세스 공유" 가설을 기각. (2) D 테스트(선택 목록)의 M4 단계에서 `Escape` 키만으로 `showPicker()`로 띄운 네이티브 `<select>` 팝업이 닫히지 않는 경우가 100% 재현됨을 확인.
- **Fix:** 선택 팝업을 닫는 두 지점을 `page.mouse.click + waitForTimeout + Escape + waitForTimeout`에서 `document.activeElement?.blur()` + `waitForTimeout(300)`으로 교체(결정적으로 포커스를 옮겨 네이티브 팝업을 닫음). 아울러 plan 01-12 SUMMARY가 지목했던 E 테스트(파일선택)의 filechooser 대기시간을 5000ms → 15000ms로 늘렸다(관측된 유일한 다른 실패 지점).
- **검증:** `CI=true pnpm exec playwright test tests/e2e/spike.e2e.ts` 재시도 없이 20회 연속 실행 — 모두 통과(간헐 실패 재현 안 됨), 이후 실행한 전체 e2e 스위트(123개)에서도 재현 없음.
- **Files modified:** tests/e2e/spike.e2e.ts
- **Commit:** `be9474b`

**2. [Rule 1류 — 잘못된 가정 정정, plan 명시 계약(spec-less edge probe)에 따른 수정] CSP: sandbox 시험을 "도울 수 없음"이 아닌 "여전히 도울 수 있음"으로 정정**
- **Found during:** Task 3 GREEN 검증
- **Issue:** RESEARCH.md는 `Content-Security-Policy: sandbox` 최상위 문서에는 content script가 들어가지 않는다고 가정했다. 실제로 `Content-Security-Policy: sandbox` 머리글이 실린 페이지를 서빙해 확인한 결과, content script는 여전히 주입되고 `site/ping`에 정상 응답했다(격리된 세계는 페이지 CSP의 영향을 받지 않는 것이 크롬 확장의 실제 구조).
- **Fix:** plan이 이 결과를 명시적으로 예상해 둔 계약("들어간다면 실행자는 그 시험을 '도울 수 있음' 확인으로 바꾸고 응답 없음 판정의 다른 재현 방법을 SUMMARY에 편차로 적는다")에 따라, 해당 테스트를 실제 동작(여전히 도움) 확인으로 다시 쓰고, 응답 없음 판정의 "보내기 실패" 분기(닫힌 탭에 `chrome.tabs.sendMessage`가 거절되는 경우)를 같은 테스트 안에서 함께 검증했다. "1초 안에 답이 없음"(타임아웃) 분기는 이 시험 환경에서 결정적으로 재현할 방법을 찾지 못했다 — 일반 http/https 페이지는 `document_start`에 의해 `onUpdated`의 'complete'보다 항상 먼저 content script가 붙기 때문이다. 코드 경로(1초 타임아웃) 자체는 background.ts에 구현되어 있으나 이 e2e로는 타임아웃 분기 자체를 트리거하지 못했다.
- **Files modified:** tests/e2e/site-toggle.e2e.ts
- **Verification:** `CI=true pnpm exec playwright test tests/e2e/site-toggle.e2e.ts` — 10 passed
- **Committed in:** `714314b` (RED), `d208f23` (GREEN)

---

**Total deviations:** 1 예비 근본 원인 수정 + 1 가정 정정(plan이 명시적으로 예상한 분기)
**Impact on plan:** 둘 다 실측 근거로 결정, 범위 확장 없음. 응답 없음 판정의 타임아웃 분기는 코드상 존재하나 이 계획의 e2e로는 직접 재현되지 않은 채 남아 있음(아래 Known Gaps 참고).

## Known Gaps

- **응답 없음(1초 타임아웃) 분기 미재현:** `background.ts`의 `respondsToSitePing`이 `Promise.race`로 구현한 1초 타임아웃 분기는 이번 e2e 스위트가 직접 트리거하지 못했다(코드는 존재, 실제 동작은 "보내기 실패" 분기로만 간접 검증됨). 이후 계획에서 이 분기를 결정적으로 재현하는 시험(예: content script를 의도적으로 응답하지 않게 만드는 시험 픽스처)이 필요하면 추가할 것.

## Issues Encountered
- Task 3 진행 중 GREEN 구현을 RED 시험보다 먼저 작성해 버린 TDD 순서 위반을 스스로 발견했다. `git diff`로 구현을 패치 파일에 저장 → `git checkout --`로 해당 파일들을 되돌림 → RED 시험을 올바르게 작성하고 실제 실패를 확인 → RED 커밋 → 저장해 둔 패치를 `git apply`로 복원 → GREEN 확인 → GREEN 커밋 순서로 바로잡았다.
- iframe 사이트별 끄기 시험에서 처음에 자식 프레임 DOM에 `tremor-helper-root`가 있는지 확인하려 했으나(항상 없음 — 오버레이는 맨 위 프레임에만 생김), `helper-toggle.e2e.ts`의 기존 패턴(`globalThis.frameStates`)을 따라 시험을 다시 작성해 해결했다.
- `frames.e2e.ts`의 한 시험이 전체 스위트 실행 중 한 번 우연히 실패했으나, 단독 5회 반복(50/50 통과) 및 전체 스위트 2회 재실행(116/116, 116/116)으로 이 계획의 변경과 무관한 기존 간헐 결함임을 확인하고 범위 밖으로 남겨 두었다(수정하지 않음, SCOPE BOUNDARY).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `site:<origin>` 저장 패턴과 쓰기 합치기/한도 래퍼(`syncSet`)가 갖춰져 이후 계획이 사이트별 설정을 추가할 때 재사용 가능
- 다른 PC 적용(D-29)은 자동 e2e로 증명할 수 없는 backstop truth로 남아 있다 — 사람 확인 필요(coverage D4)
- 응답 없음 판정의 타임아웃 분기(위 Known Gaps)는 코드는 있으나 e2e로 직접 재현되지 않음 — 후속 계획에서 다룰 수 있음

## Self-Check: PASSED

All files created/modified verified present on disk. All 7 task/prelim commit hashes (`be9474b`, `88003c2`, `3f34ecf`, `9b4fb90`, `f468b6e`, `714314b`, `d208f23`) verified present in `git log`.

---
*Phase: 01-click-helper-foundation*
*Completed: 2026-09-24*
