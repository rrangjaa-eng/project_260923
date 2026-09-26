---
phase: 01-click-helper-foundation
fixed_at: 2026-09-26T07:17:21Z
review_path: .planning/phases/01-click-helper-foundation/01-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-09-26T07:17:21Z
**Source review:** .planning/phases/01-click-helper-foundation/01-REVIEW.md
**Iteration:** 1

**Scope:** CR-01, WR-01..WR-08(critical_warning). IN-01..IN-04와 참고 항목 D-25는 지시대로 범위 밖 — 손대지 않았다.

**검증 실행 위치:** 격리된 git worktree(`.claude/worktrees/rf-01-18975-1790404442`, 브랜치 `gsd-reviewfix/01-18975`), 메인 체크아웃과 같은 pnpm 저장소를 `pnpm install --frozen-lockfile`로 연결해 사용. `PLAYWRIGHT_BROWSERS_PATH`가 환경 공용이라 브라우저 재설치 없이 CI=true 프로덕션 빌드로 모든 e2e를 실제 실행했다. 변경 종료 후 이 브랜치를 `claude/project-thread-ew8d9u`로 fast-forward 병합하고 worktree를 정리한다.

**Summary:**
- Findings in scope: 9
- Fixed: 9 (그중 1건, WR-03은 "fixed: requires human verification" — 아래 참고)
- Skipped: 0

## Fixed Issues

### CR-01: 문서 전체 편집기 "나옴" 상태에서 한글 IME가 켜져 있으면 F가 'ㄹ'로 들어가고 입력 모드로 돌아간다

**파일 수정:** `src/page/input/pipeline.ts`, `tests/e2e/doc-editor.e2e.ts`
**커밋:** `9739ee3`(RED) → `63d8eff`(GREEN)
**재현:** CDP `Input.dispatchKeyEvent`(keyCode 229 "Process", code "KeyF")로 도우미 키(F)가 IME에
가로채진 keydown을 실측 재현한 뒤 `Input.imeSetComposition`으로 뒤따르는 compositionstart를
재현했다 — 실제 재현됨(RED: dataMode가 'helper'→'typing'으로 바뀌고 조합 문자가 문서에 들어감).
**적용한 수정:** 도우미 키가 소비한 keydown의 `event.timeStamp`를 기록해 두고(`lastHelperKeyConsumedAt`),
그 뒤 300ms 안에 뜨는 compositionstart는 입력 복귀 신호로 보지 않는다(모드는 계속 'helper'). 다만
beforeinput의 `insertCompositionText`는 Chrome에서 취소 불가라(기존 주석에도 명시) 조합 자체는
막지 못한다 — 무시하기로 한 조합이 진행되는 동안(compositionend까지) 'input' 이벤트마다 편집기
내용을 조합 시작 전 상태(innerHTML 스냅숏)로 되돌려 문서가 바뀐 채로 남지 않게 했다.
**검증:** 뮤테이션 확인(가드 비활성화 시 RED 재현 확인) + `doc-editor.e2e.ts`(6개) +
`input-filter.e2e.ts`·`frames.e2e.ts`·`confirm.e2e.ts`·`editor-frames.e2e.ts`(65개) 회귀 없음.

### WR-01: `documentWasRewritten()` 방어는 근거가 모순된 추측성 코드다

**파일 수정:** `src/entrypoints/content.ts`
**커밋:** `7fcabd9`
**적용한 수정:** 55acdd0이 추가한 `documentWasRewritten()` 함수와 `applyEnabled()`의 그 사용을
그대로 되돌렸다(리뷰 권고안대로). `startDocumentElement`·`documentRewriteWatcher`(01-17부터 있던
원래 메커니즘)는 그대로 뒀다.
**검증:** `editor-frames.e2e.ts` 16개 × 3회 반복(48/48) 무실패.

### WR-02: editor-frames "옛 인스턴스는 조용하다" 시험의 hostCount===1 단언은 거의 항상 참이다

**파일 수정:** `tests/e2e/editor-frames.e2e.ts`
**커밋:** `804a88c`
**적용한 수정:** `setupFrameStateRecorder`를 복원하고, `waitForFrameHelperAlive` 통과 시점(새
인스턴스가 이미 true를 보낸 뒤) 이후 그 자식 frameId의 `frame/state(true)`가 1500ms 관찰 창 동안
0건인지로 원래 의도("다시 쓰기 뒤 옛 인스턴스가 켜지지 않는다")를 경쟁 없이 되살렸다. 기존
hostCount·누르기 정확히 1회 단언은 그대로 유지(시험 개수 16개 불변).
**검증:** 뮤테이션 확인(cleanupOldHelper의 removeListener 비활성화 시 회귀 잡음 확인) + 16개 × 3회
반복(48/48) 무실패.

### WR-03: `topDocOrigins`는 탭 이동 중 옛 문서 메시지로 낡은 출처가 다시 기록될 수 있다

**파일 수정:** `src/entrypoints/background.ts`, `tests/e2e/blank-popup.e2e.ts`
**커밋:** `ee05e56`
**상태: fixed — requires human verification**(정확한 경쟁 타이밍을 자동 시험으로 강제하지 못함,
근거는 아래)
**적용한 수정:** 리뷰 권고 코드를 그대로 적용 — `topDocOrigins.set`은 `sender.tab.url`이
`about:`로 시작할 때만 기록한다(Chrome이 메시지 처리 시점에 채운, 커밋된 탭 주소). 이동이 막
시작된(loading) 뒤에도 탭 주소가 아직 옛 https인 동안 온 메시지는 이제 무시된다.
**검증의 한계(정직하게 보고):** 오프너가 실제 https 탭을 `about:blank`로 이동시키는 흐름의 최종
상태(오프너 자신의 출처를 따름)를 확인하는 새 e2e를 추가했고 통과한다. 그러나 리뷰가 지목한 정확한
경쟁 창(SW가 tabs.onUpdated 'loading'을 처리한 직후, 아직 살아 있는 옛 문서의 지연된 frameId 0
메시지가 도착하는 순서)은 Playwright로 강제 재현하지 못했다 — 뮤테이션 테스트(가드 되돌리기,
5회 반복)로도 이 신규 테스트가 그 특정 회귀를 잡지 못함을 확인했다(테스트는 정상 경로 회귀
안전망일 뿐, 경쟁 자체의 RED/GREEN 증거는 아니다). 수정 자체는 리뷰의 코드까지 정확히 일치하고
위험이 낮다(about: 탭에서만 쓰이는 값을 좁히는 것뿐, 기존 about:blank 새 창 흐름 전체 회귀 없음
확인). 사람 검토 시 이 경계 조건(탭 이동 경쟁)을 실제 브라우저에서 재현·확인해 주길 권한다.
**검증:** `blank-popup.e2e.ts`(10개) + `site-toggle.e2e.ts`(15개) 회귀 없음.

### WR-04: noopener 새 창의 아이콘·메뉴 판정이 고정 1초 뒤 부재 단언뿐이다

**파일 수정:** `tests/e2e/blank-popup.e2e.ts`
**커밋:** `a342019`
**적용한 수정:** 코드 경로는 이미 올바르다(리뷰 판정과 동일) — 시험만 강화했다.
`expect.poll(tabTitle).toBe('도울 수 없음')`·배지 `'없음'`을 두 noopener 경로(window.open,
링크) 모두에 추가하고, `popup.html?tabId=`로 메뉴를 열어 안내 문구가 보이고 사이트 카드가 없는지
확인했다. 부재 단언 앞에 같은 여는 쪽에서 `openDomPopup`으로 도우미가 뜨는 것을 먼저 확인해 양성
대조로 삼았다.
**검증:** 새 시험이 (수정 전 코드에서도) 통과함을 확인 — 코드가 이미 올바름을 실측으로 뒷받침.
`blank-popup.e2e.ts`(10개) 전체 회귀 없음.

### WR-05: "이 사이트에서 끄기" 카드가 SW 거절을 무시해 실제로는 켜져 있는데 꺼짐으로 보인다

**파일 수정:** `src/entrypoints/popup/main.ts`, `tests/e2e/site-toggle.e2e.ts`
**커밋:** `a61c308`
**재현:** `chrome.storage.sync`에 검사 실패하는 `site:` 항목을 미리 넣어(storage-writer.ts
`invalid-site` 경로) SW가 실제로 거절하게 한 뒤 카드를 눌러 RED 확인(문구가 "끄기"로 되돌아가지
않음).
**적용한 수정:** `createSiteCard`의 `onToggle`이 `sendMessage` 응답의 `ok !== true`(또는 거부)면
`revert()`한다(리뷰 권고 코드 그대로). `helperCard`도 `preserved-original`뿐 아니라 `ok !== true`
전체에서 되돌리도록 넓혔다(item-too-large 등).
**검증:** 뮤테이션 확인(되돌리기 로직 제거 시 RED 재현) + `site-toggle.e2e.ts`(16개) +
`helper-toggle.e2e.ts`(11개) 회귀 없음.

### WR-06: document.write 새 창·맨 위 다시 쓰기 탭의 아이콘이 ping 한 번에 다시 넣기와 경쟁한다

**파일 수정:** `src/entrypoints/background.ts`, `tests/e2e/blank-popup.e2e.ts`, `tests/e2e/editor-frames.e2e.ts`
**커밋:** `16145b7`
**재현:** `openWritePopup` 탭에 `expect.poll(tabTitle).toBe('손 떨림 도우미')`를 추가 — 수정 전
8회 반복 8/8 실패(재현 안정적).
**적용한 수정:** `respondsToSitePing`이 실패하면 250ms 간격으로 최대 2회 더 확인한다(리뷰 권고
250ms×3). 탭별 세대 번호(`actionGenerationByTab`)로 겹친 `updateActionForTab` 호출 중 늦게 끝난
옛 호출의 결과가 새 결과를 덮어쓰지 않게 했다. `editor-frames.e2e.ts`의 맨 위 다시 쓰기 시험에도
같은 제목 확인을 더했다.
**검증:** 뮤테이션 확인(재시도 delays를 빈 배열로 — 5회 반복 5/5 재현) + `blank-popup.e2e.ts`(10개
× 8회 반복 포함) + `editor-frames.e2e.ts`(16개 × 4회) + `site-toggle.e2e.ts`(15개) 회귀 없음.

### WR-07: 자식 프레임 직접 누르기 framePath가 `local:<전체 URL>`이라 질의 문자열까지 저장된다

**파일 수정:** `src/entrypoints/content.ts`, `tests/e2e/frames.e2e.ts`
**커밋:** `a07c2f5`
**재현:** 질의 문자열(`?token=secret123`)이 있는 자식 프레임 주소에서 자석으로 직접 눌러 저장된
framePath에 그 문자열이 남는지 확인 — RED 재현(포함됨).
**적용한 수정:** `localPressFramePath`를 `local:${location.href}` 대신
`local:${location.origin}${location.pathname}`으로 좁혔다(리뷰 권고 최소 수정안).
**검증:** `frames.e2e.ts`(13개) + `hints.e2e.ts`(15개) + `blank-popup.e2e.ts`(10개) 회귀 없음.

### WR-08: "나옴" 상태에서 편집기가 keydown으로 직접 처리하는 편집(Enter 등)이 막히지 않는다

**파일 수정:** `src/page/input/pipeline.ts`, `tests/e2e/doc-editor.e2e.ts`
**커밋:** `755f43f`
**재현:** CKEditor류 편집기를 흉내 낸 fixture(keydown에서 Enter를 가로채 `preventDefault` 후
직접 `<p>`를 추가) — beforeinput이 아예 뜨지 않아 RED 재현(문서가 바뀜).
**적용한 수정:** 도우미 키 처리기가 쓰지 않은 keydown이라도, "나옴" 상태 + 문서 전체 편집기에
초점이 있으면 편집 키(Enter·NumpadEnter·Backspace·Delete·Tab, Ctrl/Meta 조합)를
`preventDefault()` + `stopImmediatePropagation()`으로 삼킨다 — 더 안쪽 target(편집기 자신의
keydown 처리기)에 이벤트가 닿지 못하게 한다.
**검증:** 뮤테이션 확인(가드 비활성화 시 RED 재현) + `doc-editor.e2e.ts`(7개) +
`editor-frames.e2e.ts`·`frames.e2e.ts`·`input-filter.e2e.ts`·`confirm.e2e.ts`·`dwell.e2e.ts`(70개)
회귀 없음.

## Skipped Issues

없음 — 범위 안 9건 모두 fixed(WR-03은 위에 적은 대로 "requires human verification" 단서 포함).

## 범위 밖(지시대로 손대지 않음)

- IN-01..IN-04, 참고 항목 D-25(로컬 꺼짐 표시) — 오케스트레이터 지시로 이번 라운드 범위 밖.

## 커밋 목록

1. `9739ee3` test(RED): CR-01 재현
2. `63d8eff` fix: CR-01 도우미 키 조합 무시 + 조합 결과 되돌리기
3. `7fcabd9` fix: WR-01 documentWasRewritten() 되돌림
4. `804a88c` fix: WR-02 옛 인스턴스 조용함 단언 복원
5. `ee05e56` fix: WR-03 topDocOrigins about: 탭 주소 검사
6. `a342019` fix: WR-04 noopener 아이콘·메뉴 시험 강화
7. `a61c308` fix: WR-05 사이트 카드 SW 거절 되돌리기
8. `16145b7` fix: WR-06 site/ping 재시도 + 세대 번호
9. `a07c2f5` fix: WR-07 framePath 질의 문자열 제거
10. `755f43f` fix: WR-08 keydown 직접 편집 삼키기

---

_Fixed: 2026-09-26T07:17:21Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
