---
phase: 01-click-helper-foundation
fixed_at: 2026-09-26T09:40:00Z
review_path: .planning/phases/01-click-helper-foundation/01-REVIEW.md
iteration: 3
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report (반복 3회차)

**Fixed at:** 2026-09-26T09:40:00Z
**Source review:** .planning/phases/01-click-helper-foundation/01-REVIEW.md (반복 2회차, 2026-09-26T07:28:34Z)
**Iteration:** 3
**작업 방식:** main 작업 트리(`/home/user/project_260923`, 브랜치 `claude/project-thread-ew8d9u`)에서 순차 작업(오케스트레이터 지시 — worktree 생성 없음). 검증은 이 저장소(main checkout)에서 `CI=true`로 실제 실행했다.

## 1회차(반복 1) 요약 — 앞선 라운드 결과, 참고용

| 1회차 항목 | 판정 | 커밋 |
|---|---|---|
| CR-01 (한글 IME F → 입력 복귀) | fixed(뒤에 CR-01 새 문제로 되돌림, 이번 반복에서 재수정) | `9739ee3`→`63d8eff` |
| WR-01 (documentWasRewritten 추측성 방어) | fixed | `7fcabd9` |
| WR-02 (옛 인스턴스 조용함 단언) | fixed | `804a88c` |
| WR-03 (topDocOrigins 옛 문서 덮어쓰기) | fixed: requires human verification | `ee05e56` |
| WR-04 (noopener 새 창 아이콘·메뉴 시험) | fixed | `a342019` |
| WR-05 (사이트 카드 SW 거절 무시) | fixed | `a61c308` |
| WR-06 (ping 1회 경쟁) | fixed | `16145b7` |
| WR-07 (`local:<전체 URL>`) | fixed(부분, 이번 반복에서 마무리) | `a07c2f5` |
| WR-08 (keydown 직접 편집) | fixed(부분, 이번 반복에서 Ctrl 과잉 차단·drop 등 마무리) | `755f43f` |

전체: 9/9 fixed(당시 기준). 2회차 코드 리뷰가 이 중 CR-01·WR-08 수정을 "새 문제로 바뀜"으로 재분류했고, 그 결과가 이번(3회차) 라운드의 CR-01·WR-01이다.

---

## 이번 반복(3회차) 범위

01-REVIEW.md(반복 2회차)의 critical_warning 항목: CR-01(신규), WR-01~WR-06. INFO(IN-01~IN-03)와 D-25는 오케스트레이터 지시로 범위 밖(손대지 않았다).

**Summary:**
- Findings in scope: 7 (CR-01, WR-01, WR-02, WR-03, WR-04, WR-05, WR-06)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: innerHTML 스냅숏 복원(63d8eff)을 되돌리고 "커서 숨기기"로 바꿈

**파일 수정:** `src/page/input/mode.ts`, `src/page/input/pipeline.ts`, `tests/e2e/doc-editor.e2e.ts`
**커밋:** `96717a5`(RED) → `1169810`(GREEN)
**사용자 결정 반영:** 63d8eff의 innerHTML 스냅숏 복원(`ignoredCompositionRoot`/`Snapshot`, `input` 복원 리스너, `COMPOSITION_IGNORE_WINDOW_MS` 창)을 전부 되돌렸다. 대신 `mode.ts`의 `escapeDocumentEditor()`가 나올 때 `Selection`을 저장(`cloneRange`)한 뒤 `removeAllRanges()`로 지운다(초점은 그대로, DOM·편집 속성은 건드리지 않음). `resumeDocumentEditor(opts: { restoreSelection })`으로 이름을 바꾸고: Esc를 다시 누르면(`restoreSelection: true`) 저장한 범위를 복원하고, 편집기를 눌러 돌아오면(`restoreSelection: false`, pointerdown) 브라우저가 누른 자리에 이미 캐럿을 두므로 복원하지 않는다. 다른 요소로 `focusin`도 `restoreSelection: false`.
**한글 조합 시작 복귀 신호 제거(사용자 결정):** `compositionstart` 리스너 전체를 없앴다 — 복귀 신호는 이제 (a) Esc 다시 누름, (b) 편집기 누름(trusted pointerdown 주 버튼), (c) 다른 요소로 focusin 세 가지뿐이다. `doc-editor.e2e.ts`의 "한글 조합 시작하면 입력으로 돌아간다" 시험을 이 새 결정에 맞게 다시 썼다(완화가 아니라 사용자 결정 변경).
**키 순서 조정:** Esc-다시-누름 처리를 `keyHandlers` 루프 **뒤**로 옮겼다 — 번호표가 열려 있을 때 Esc는 먼저 번호표를 닫아야 하고(기존 동작), 닫을 게 없을 때만 입력으로 복귀한다. (처음 구현은 순서가 반대라 "F로 번호표 연 뒤 Esc로 닫기" 회귀 시험이 깨졌다 — RED로 잡아 고쳤다.)

**RED 시험(요청된 4가지 중 실측 가능한 것):**
- (a) 문서 텍스트 불변, (d) 모드는 여전히 도우미 — CDP `Input.imeSetComposition`으로 조합을 시도해도 단언.
- (b) 편집 루트 자식 노드 동일성 유지 — 나오기 전 `window.__crMark = el`로 참조를 저장하고 이후 `=== el`로 비교(스냅숏 복원 회귀 방지 — innerHTML을 다시 쓰면 반드시 깨진다).
- (c) Esc로 복귀 뒤 캐럿 오프셋이 나오기 전과 같음 — 조합 없이 순수 Esc→Esc-다시 흐름으로 결정적으로 검증(아래 실측 참고, 조합이 끼면 위치가 CDP 한계로 흔들린다).

**실측(뮤테이션 확인, 정직하게 보고) — 사람 확인 필요:**
1. **CDP 조합 한계.** `Input.imeSetComposition`은 선택이 없어도(rangeCount 0) 편집 루트 시작 위치에 조합 문자를 강제로 삽입한다(실측: `before='가나'` 상태에서 조합 후 `text='X가나'`) — 이 도구는 "선택이 없으면 IME가 조합을 시작하지 않는다"는 가정을 증명도 반증도 못 한다(REVIEW.md도 이 한계를 미리 알렸다). 그래서 CDP 조합 시험은 우리가 실제로 통제하는 불변(모드가 조합으로 튀지 않는다, 노드가 통째로 안 바뀐다)만 단언하고, "조합 자체가 시작되는지"는 단언하지 않는다.
2. **더 근본적인 실측(이번 라운드에서 새로 발견, CDP와 무관):** Chrome은 **트러스트된(real) 키 이벤트가 초점 있는 선택 없는 편집 영역에 닿으면, 우리가 지운 선택을 스스로 되살린다** — Escape 키뿐 아니라 `ArrowLeft`·`Shift` 단독 keydown으로도 재현됨(수백 ms 안, `page.keyboard.press` 뒤 `waitForTimeout`으로 관찰). `removeAllRanges()` 직후에는 `rangeCount===0`이지만, 그 뒤 어떤 실제 키든 눌리면 다시 `rangeCount===1`이 된다. 이는 우리 코드의 버그가 아니라 Chrome 자체의 "초점 있는 편집 영역은 캐럿을 유지한다" 내부 동작으로 보인다(`preventDefault()`를 걸어도 막히지 않음, 실측 확인). **의미:** "선택 해제만으로 조합을 영구히 막는다"는 가정은 이 실측 환경에서 지속되지 않는다 — 실제 한글 IME가 이 되살아난 선택을 앵커로 삼아 조합을 시작할 가능성이 남는다. 도우미가 나온 상태에서 어떤 키든(도우미 키 포함) 한 번이라도 실제로 눌리면, 그 뒤의 한글 입력 시도가 문서를 오염시킬 위험을 완전히 배제할 수 없다. **사람 확인 필요(Windows + MS 한국어 입력기, 크롬·엣지·웨일):** Esc → F(번호표) → 한글 입력을 실제로 시도해 (1) `compositionstart`가 뜨는지, (2) 뜬다면 문서가 바뀌는지 확인해 주길 권한다. 이 발견은 REVIEW.md가 예상한 "CDP 검증 한계"보다 더 근본적이라 별도로 강조해 보고한다 — 필요하면 사용자 결정을 다시 검토해야 할 수 있다(예: `selectionchange`로 되살아난 선택을 반복 해제하는 등 추가 방어, 이번 라운드에서는 사용자 결정 범위를 벗어나 적용하지 않았다).
3. Esc→Esc-다시(조합 없이) 왕복은 이 되살아남 현상과 무관하게 항상 결정적으로 통과한다 — `resumeDocumentEditor({restoreSelection:true})`가 저장해 둔 Range를 매번 강제로 다시 설정하기 때문이다(마지막에 쓴 값이 이긴다, 경합 없음).

**검증:** `doc-editor.e2e.ts`(9개, RED 2개 확인 후 GREEN 9/9) + `input-filter.e2e.ts`·`frames.e2e.ts`·`editor-frames.e2e.ts`·`confirm.e2e.ts`(60개) 회귀 없음.

### WR-01: Ctrl/Meta 과잉 차단을 허용 목록으로 좁힘

**파일 수정:** `src/page/input/pipeline.ts`, `tests/e2e/doc-editor.e2e.ts`
**커밋:** `8ee36b4`(RED) → `b3c21ff`(GREEN)
**적용한 수정:** REVIEW.md 권고 코드를 그대로 적용 — `MODIFIER_ONLY_KEYCODES`(수정자 단독)는 판단 대상에서 뺀다(keydown이 그대로 통과, keyup도 삼키지 않는다). Ctrl/Meta 조합은 `PASS_CTRL_CODES`(KeyC·Insert·KeyF·KeyG·F3·KeyP·KeyS·Equal·Minus·Digit0·NumpadAdd·NumpadSubtract·Numpad0·F5, Alt 없을 때만)만 통과, 나머지는 막는다. Ctrl 없는 조합은 `EDITING_KEYCODES`(Enter 등) + `Shift+Insert`(붙여넣기)만 막는다. 삼킨 키는 `swallowedKeyCodes.add()`로 keyup까지 일관되게 삼킨다(이전에는 이 분기가 keyup을 안 삼켰다).
**시험 fixture 교훈:** 처음 `Ctrl+F`를 "통과해야 함" 예시로 썼다가 실패했다 — 조사해 보니 `KeyF`는 도우미 자신의 `keymap.toggleHints` 기본값이라, `keyHandlers` 루프가 **Ctrl 여부와 무관하게** 먼저 소비해 버렸다(WR-01과 무관한 기존 동작). `Ctrl+C`(복사)로 바꿔 재현·검증했다.
**검증:** `doc-editor.e2e.ts`(9개) + `input-filter.e2e.ts`·`frames.e2e.ts`·`editor-frames.e2e.ts`·`confirm.e2e.ts`(60개) 회귀 없음.

### WR-02: paste/cut/drop/dragover가 편집기로 직접 새는 경로를 막음

**파일 수정:** `src/page/input/pipeline.ts`, `tests/e2e/doc-editor.e2e.ts`
**커밋:** `5bf89b9`(RED, 마우스 드래그 버전) → `4833ac3`(RED 교정, CDP 버전) → `f287eff`(GREEN)
**적용한 수정:** `isEscapedFromDocumentEditor() && isDocumentEditingRoot(deepActiveElement())`이면 `paste`·`cut`·`drop`·`dragover`를 window capture에서 `preventDefault()`+`stopImmediatePropagation()`으로 막는다(`isTrusted` + `isHelperEnabled()`일 때만).
**시험 설계 교훈(뮤테이션 확인, 두 번 갈아엎음):**
1. 처음엔 `page.dragAndDrop`(마우스 드래그)으로 같은 프레임 안에서 끌기를 시도했다 — 그런데 끄는 시작점(pointerdown)이 편집 루트 **안**이라 그 자체가 "편집기 누름"(CR-01 복귀 신호)으로 해석돼, 놓기 전에 이미 입력 모드로 돌아가 버려 아무것도 증명하지 못했다(수정 있어도 없어도 통과).
2. 그래서 다른 프레임에서 끌어오도록 바꿨는데(cross-frame `dragTo`), 이번엔 "선택이 없으면 브라우저가 애초에 아무것도 안 넣는다"는 사실이 드러나(CR-01 실측 참고) 수정과 무관하게 항상 통과해 버렸다(false negative, 뮤테이션 확인으로 잡음).
3. 최종적으로 CDP `Input.dispatchDragEvent`(dragEnter→dragOver→drop을 pointerdown 없이 직접 보냄)로 편집기 자신의 `drop` 처리기가 직접 DOM을 고치는 사내 편집기 흉내 fixture(WR-08과 같은 관례)를 재현했다 — 뮤테이션 확인: 수정 빼면 `#injected-p`가 생기고(RED), 수정 넣으면 `dragenter`만 사이트에 닿고 `dragover`·`drop`은 우리 코드가 먼저 멈춘다(GREEN, page 리스너 로그로 확인).
**범위 밖(사람 확인 필요로 남김):** 오른쪽 클릭 메뉴 붙여넣기·잘라내기는 헤드리스 Playwright로 신뢰된(trusted) 이벤트를 재현할 수 없다(브라우저 네이티브 컨텍스트 메뉴 자동화 불가) — 코드는 `isTrusted` 검사로 이 경로도 막게 되어 있으나(paste/cut 리스너가 이미 있음) 자동 시험으로 확인하지 못했다. 키보드 경로(Ctrl+V·Shift+Insert)는 WR-01의 Ctrl 차단·EDITING_KEYCODES가 keydown 자체를 막아 이미 닫혀 있다.
**검증:** `doc-editor.e2e.ts`(10개) + `input-filter.e2e.ts`·`frames.e2e.ts`·`editor-frames.e2e.ts`·`confirm.e2e.ts`(60개) 회귀 없음.

### WR-03: 도우미·사이트 카드 무응답 시간 제한·거부 되돌리기·실패 안내

**파일 수정:** `src/entrypoints/popup/main.ts`, `src/entrypoints/background.ts`(e2e 전용 훅), `tests/e2e/helper-toggle.e2e.ts`, `tests/e2e/site-toggle.e2e.ts`
**커밋:** `aa5091d`(RED, 도우미 카드) → `23712e0`(RED, 사이트 카드) → `dd54704`(GREEN)
**적용한 수정:** REVIEW.md 권고 코드대로 `sendWithRevert(message, revert, onFail)` 공통 도우미를 만들었다 — 3초 시간 제한(무응답 → 되돌리고 `onFail('timeout')`), 응답 `ok!==true`(되돌리고 이유별 안내), 거부(reject, `.then`의 두 번째 인자로 처리 → 되돌리고 `onFail('rejected')`). 도우미 카드는 `preserved-original`이면 기존 문구, 그 외 실패는 새 문구(`도우미 상태를 바꾸지 못했어요. 다시 눌러 보세요.`). 사이트 카드는 실패 시 REVIEW.md 예시 문구(`이 사이트를 끄지 못했어요. 1을 눌러 도우미를 끄세요.`).
**RED 재현:** `background.ts`에 e2e 전용 훅 `holdStorageResponseForE2E(count)`를 추가해(기존 `disconnectAlivePorts` 등과 같은 관례) SW가 `sendResponse`를 아예 안 부르게 흉내 냈다 — 수정 전에는 두 카드 모두 낙관적 문구가 무기한 남았다(RED).
**검증:** `helper-toggle.e2e.ts`(11개)·`site-toggle.e2e.ts`(17개)·`lifecycle.e2e.ts`(11개) 전체 통과(회귀 없음, 기존 preserved-original 시험에 새 안내 문구 단언을 더했다).

### WR-04: framePath를 모르는 자식 프레임 직접 누르기는 기록을 보내지 않음

**파일 수정:** `src/entrypoints/content.ts`, `tests/e2e/frames.e2e.ts`
**커밋:** `4d0b77c`(RED) → `f6c241c`(GREEN)
**적용한 수정:** REVIEW.md 권고 두 번째 안(최소 수정 origin만 쓰는 안 대신, 근본 해결) — `localPressFramePath`를 `string[] | null`로 바꿔 자식 프레임은 `null`(모른다)로 둔다. `pressOrDrag`의 `fingerprint` 인자를 `Fingerprint | null`로 바꾸고, `null`이면 `sendRecordPress`를 부르지 않는다(누르기 자체는 그대로 한다 — 기록만 생략). `localFingerprint(item)` 헬퍼로 세 호출부(머무르기·자석 대신 누르기·스페이스바)를 통일했다.
**재현:** 경로 안 세션 ID(`;jsessionid=secret123`)가 있는 자식 프레임에서 자석으로 직접 눌러, 저장소에 기록이 전혀 없는지(`entries.length===0`) 확인 — RED 재현.
**기존 시험과의 충돌·정리:** 이 수정으로 "자식 프레임 직접 누르기도 기록된다"를 전제한 기존 WR-05(1회차) 시험 2개가 필연적으로 깨졌다(자식이 아예 기록을 안 보내니까) — 새 동작에 맞게 다시 썼다: (1) 다른 출처 자식 직접 누르기는 기록이 아예 없어야 한다로, (2) 같은 틀을 공유하는 자식+맨 위 시험은 "맨 위 자신의 기록 하나만 남고 중복·합산되지 않는다"로 바꿨다. 완화가 아니라 REVIEW.md가 명시적으로 권고한 동작 변경의 필연적 결과다.
**검증:** `frames.e2e.ts`(13개) + `hints.e2e.ts`·`blank-popup.e2e.ts`·`editor-frames.e2e.ts`(43개) 회귀 없음.

### WR-05: CR-01 RED 시험 완화 — 이미 해결됨(별도 수정 불필요)

**상태:** 별도 코드 변경 없음 — CR-01을 "커서 숨기기"로 다시 만들면서 `doc-editor.e2e.ts`의 옛 CR-01 시험(300ms 창 + `expect.poll` 결합, `textContent`만 비교)을 통째로 새로 썼다(위 CR-01 항목 참고). 새 시험은 300ms 시간 창에 기대지 않고, 노드 정체성(`__crMark` 참조 비교)·모드 불변·(별도 시험으로) 캐럿 오프셋을 단언한다. WR-05가 지목한 두 문제(부하 시 거짓 실패, 조합 확정·노드 정체성 미검증) 모두 CR-01 재작성으로 해소됐다.
**검증:** CR-01 항목의 검증과 동일(`doc-editor.e2e.ts` 3회 반복 무실패).

### WR-06: 저장소 개수 고정 대기 → 조건 대기, 불필요한 고정 대기 제거

**파일 수정:** `tests/e2e/frames.e2e.ts`, `tests/e2e/doc-editor.e2e.ts`
**커밋:** `932b0b4`
**적용한 수정:**
- `frames.e2e.ts`의 WR-04 관련 시험("같은 틀" 시험) 마지막 단언 — `waitForTimeout(300)` 뒤 `entries.length===1`을 고정 확인하던 것을 `expect.poll(async () => (await pressesEntries(...)).length).toBe(1)`로 바꿨다(WR-04로 기대값이 1로 바뀐 것과 별개로, 대기 방식 자체를 조건부로 교정).
- `doc-editor.e2e.ts`의 WR-08 시험 — `keyboard.press('Enter')` 뒤 `waitForTimeout(200)`을 지웠다(keydown 처리가 동기라 불필요, REVIEW.md 권고대로).
- **WR-04의 "기록 0건(부재)" 단언은 고정 대기를 유지했다** — 이유: WR-06이 지목한 flaky 방향(느린 쓰기 때문에 "있어야 할 기록"이 제때 안 나타나 거짓 실패)은 "있음"을 기다리는 폴링에만 해당한다. "없어야 한다"를 확인할 때는 반대로 충분히 기다려야 늦게 도착하는 오탐(늦은 쓰기)을 놓치지 않는다 — 고정 대기가 이 방향에서는 더 안전하다(CR-01·WR-02와 같은 "부재 증명" 특유의 비대칭, 위 CR-01 실측 참고).
**검증:** `frames.e2e.ts`(13개) + `doc-editor.e2e.ts`(10개) = 23개, 3회 반복 무실패(플레이크 없음 확인).

## Skipped Issues

없음 — 범위 안 7건(CR-01, WR-01~WR-06) 모두 fixed.

## 사람 확인이 남은 항목(자동 시험으로 끝까지 증명하지 못함)

1. **CR-01 — 가장 중요.** "편집 루트에 선택이 없으면 한글 IME가 조합을 시작하지 않는다"는 가정이 실측(Chrome이 트러스트된 키 이벤트마다 선택을 스스로 되살리는 현상, 위 CR-01 항목 3번 참고)으로 흔들렸다. **Windows + MS 한국어 입력기(크롬·엣지·웨일)에서 문서 전체 편집기 Esc → F(번호표) → 한글 입력을 실제로 시도해, compositionstart가 뜨는지와 문서가 바뀌는지 확인해 주길 권한다.** 뜬다면 이 결정(옵션 A)을 다시 검토해야 할 수 있다.
2. **WR-02.** 오른쪽 클릭 컨텍스트 메뉴의 붙여넣기·잘라내기는 헤드리스 Playwright로 신뢰된 이벤트를 재현할 수 없어 자동 시험 대상에서 뺐다. 코드(`isTrusted` 검사를 통과하는 실제 메뉴 붙여넣기)는 이론상 막히지만 실측 확인은 못 했다.

## 커밋 목록(이번 반복, 시간 순)

1. `96717a5` test(RED): CR-01 재현
2. `1169810` fix: CR-01 innerHTML 스냅숏 복원 되돌리고 커서 숨기기로 교체
3. `8ee36b4` test(RED): WR-01 재현
4. `b3c21ff` fix: WR-01 Ctrl/Meta 허용 목록
5. `5bf89b9` test(RED): WR-02 재현(마우스 드래그, 이후 교정)
6. `4833ac3` test(RED 교정): WR-02 CDP dispatchDragEvent로 재작성
7. `f287eff` fix: WR-02 paste/cut/drop/dragover 차단
8. `aa5091d` test(RED): WR-03 도우미 카드 무응답
9. `23712e0` test(RED): WR-03 사이트 카드 무응답·안내 부재
10. `dd54704` fix: WR-03 시간 제한·거부 되돌리기·안내
11. `4d0b77c` test(RED): WR-04 jsessionid 잔존 재현
12. `f6c241c` fix: WR-04 framePath 모르면 기록 생략
13. `932b0b4` test: WR-06 고정 대기 → 조건 대기

## 마지막 확인(오케스트레이터 지시대로)

- `pnpm lint`·`pnpm typecheck`: 매 수정 전 깨끗함 확인(마지막에도 재확인, 통과).
- `tests/e2e/editor-frames.e2e.ts`: 16개 그대로, 3회 반복 무실패.
- `tests/e2e/dom-audit.e2e.ts`: 기준 변경 없음, 16개 통과(1회 확인).
- 확인 카드 테두리(남색)·`any`·새 의존성·요청 밖 리팩터: 손대지 않았다.

---

_Fixed: 2026-09-26T09:40:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_
