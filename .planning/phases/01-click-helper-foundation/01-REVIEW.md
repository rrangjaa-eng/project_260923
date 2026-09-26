---
phase: 01-click-helper-foundation
reviewed: 2026-09-26T07:28:34Z
depth: deep
iteration: 2
diff_base: eb0f96b
files_reviewed: 9
files_reviewed_list:
  - src/entrypoints/background.ts
  - src/entrypoints/content.ts
  - src/entrypoints/popup/main.ts
  - src/page/input/pipeline.ts
  - tests/e2e/blank-popup.e2e.ts
  - tests/e2e/doc-editor.e2e.ts
  - tests/e2e/editor-frames.e2e.ts
  - tests/e2e/frames.e2e.ts
  - tests/e2e/site-toggle.e2e.ts
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
status: issues_found
---

# Phase 1: 코드 리뷰 보고서 (수정 반복 2회차)

**리뷰 시각:** 2026-09-26T07:28:34Z
**깊이:** deep
**리뷰한 파일:** 9 (참고: `src/page/input/mode.ts`, `src/page/overlay/mode-indicator.ts`, `src/page/collector/collector.ts`, `src/types/chrome.d.ts`, `wxt.config.ts`)
**상태:** issues_found
**범위:** `git diff eb0f96b..HEAD`의 수정 커밋 9739ee3..755f43f(CR-01, WR-01~WR-08). `pnpm typecheck`·`pnpm lint`는 통과했다. e2e는 다시 돌리지 않았다. 아래 판정은 코드 사실에 근거한다. 실측이 필요한 곳은 따로 적었다.

## 1회차 항목별 판정

| 1회차 | 판정 | 근거 / 이번 항목 |
|---|---|---|
| CR-01 한글 IME F → 입력 복귀 | **새 문제로 바뀜** | 원래 증상은 CDP 재현 기준으로 막았다. 대신 쓴 수단(편집 루트 `innerHTML` 통째 복원)이 이용자의 문서·편집기를 망가뜨린다. → **CR-01** |
| WR-01 `documentWasRewritten()` 추측성 방어 | 해결됨 | 7fcabd9가 함수와 사용처를 모두 되돌렸다. `documentRewriteWatcher` 경로만 남았다(content.ts:161-177). |
| WR-02 "옛 인스턴스 조용함" 단언 | 해결됨 | 새 인스턴스의 true 뒤를 기준점으로 잡고, 그 frameId의 frame/state 0건을 본다(editor-frames.e2e.ts). frame/state는 값이 바뀔 때만 보내므로(content.ts:589-623) 정상 인스턴스가 관찰 창을 오염시키지 않는다. |
| WR-03 `topDocOrigins` 옛 문서 덮어쓰기 | 해결됨(잔여 있음) | 가드 방향이 맞다. 경쟁 창이 크게 줄었다. 남는 창과 RED 부재 → **IN-01** |
| WR-04 noopener 아이콘·메뉴 시험 | 해결됨 | 조건 대기(`expect.poll`), 양성 대조, 메뉴 안내·카드 부재를 모두 단언한다. |
| WR-05 사이트 카드 SW 거절 무시 | **부분 해결** | 사이트 카드는 거절·거부 모두 되돌린다. 도우미 카드(전역 끄기)는 거부(reject)를 처리하지 않는다. 두 카드 모두 무응답 시간 제한이 없고, 되돌릴 때 안내도 없다. → **WR-03** |
| WR-06 ping 1회 경쟁 | 해결됨(잔여 있음) | 재시도와 세대 번호가 옛 결과 덮어쓰기를 막는다. 새 누수는 없다. 재시도 창이 500ms 고정 추정이고, action API 호출 사이 섞임이 남았다. → **IN-02** |
| WR-07 `local:<전체 URL>` | **부분 해결** | 질의 문자열은 빠졌다. 경로 안 세션 ID(`;jsessionid=`)는 남는다. 그 기록은 여전히 번호 순서에 쓰이지 않는다. → **WR-04** |
| WR-08 keydown 직접 편집 | **새 문제로 바뀜** | Enter·Backspace 등은 막았다. 대신 Ctrl/Meta 조합을 **전부** 삼켜 찾기·복사·인쇄·저장·확대를 막는다(**WR-01**). 키보드 밖 편집 경로(붙여넣기·잘라내기·끌어 놓기)는 여전히 열려 있다(**WR-02**). |
| IN-01~IN-04 | 범위 밖, 변화 없음 | 지시대로 손대지 않았다. 이월 항목이며 이번 집계에서 뺐다. D-25 참고 항목도 그대로다. |

## 오케스트레이터 요청 항목 판정

### 1. CR-01 수정(63d8eff)의 innerHTML 스냅숏 복원: **BLOCKER. 즉시 되돌리고 "나옴 = 선택 범위 해제" 방식으로 바꿀 것을 권고한다**

사실관계(코드):
- 스냅숏 대상은 `deepActiveElement()`이고, `isDocumentEditingRoot`를 통과한 `body` 또는 `documentElement`다(pipeline.ts:375-379, mode.ts:41-47). designMode나 contenteditable 본문이면 **body 전체**다.
- 조합이 끝날 때까지 **모든** `input`마다 `root.innerHTML = snapshot`으로 body의 자식 전체를 새로 파싱한 노드로 갈아 끼운다(pipeline.ts:392-403).
- 도우미 호스트는 `document.documentElement.append(hostElement)`로 붙는다(mode-indicator.ts:124). 그래서 루트가 **body이면 호스트는 살아남는다.** 루트가 `documentElement`이면(`<html contenteditable>`처럼 activeElement가 html인 경우. 코드가 명시적으로 허용하는 경로다) `innerHTML`에 `<head>`와 `<tremor-helper-root>`가 함께 들어간다. 이 경우 섀도 루트 없는 빈 호스트로 바뀌고, 도우미 오버레이가 조용히 사라진다. `documentRewriteWatcher`는 `document`의 childList만 보므로(content.ts:177) 이를 감지하지 못한다. 실제 사이트에서 이 경로의 빈도는 낮다고 본다(확신 중간).

피해는 CR-01 본문에 적었다. 요약하면 노드 정체성·선택 범위·되돌리기 스택·리스너·위젯·내부 iframe·폼 상태가 깨진다. 캐럿이 문서 처음으로 간다. 300ms 창 오탐으로 이용자 입력이 사라진다. 조합 확정 경로는 시험되지 않았다. 성능(큰 문서에서 input마다 직렬화·비교)은 v1 범위 밖이라 결함으로 세지 않았다.

대안 비교:

| 대안 | 조합 차단 효과 | 사이트 부작용 | 되돌림 안전성 | 판정 |
|---|---|---|---|---|
| (현행) innerHTML 복원 | 조합 뒤 DOM을 되감는다 | 매우 큼: 노드·선택·undo·리스너·위젯 파괴 | 나쁨: 되돌릴 수 없는 DOM 교체 | **기각** |
| A. Esc 때 선택 범위 저장 후 `getSelection().removeAllRanges()`. 초점은 body에 둔다 | Chrome은 선택의 편집 루트가 없으면 text input type을 none으로 보고 IME를 끈다고 알고 있다. F가 keyCode 70으로 오고 조합이 시작되지 않을 것으로 **예상한다. 확신 중간이며 실측이 필요하다** | 작음: `selectionchange` 1회, 편집기 도구 막대 상태 갱신. DOM·undo는 건드리지 않는다. focus/blur는 뜨지 않는다 | 좋음: 도우미가 죽어도 캐럿만 없다. 이용자가 누르면 복구된다 | **권고(1순위)** |
| B. Esc 때 도우미 자신의 비편집 초점 대상(섀도 호스트 안 `tabindex=-1`)으로 초점 이동, 선택 범위 저장 | 비편집 요소 초점이라 IME가 확실히 꺼진다 | 중간: 편집기에 blur/focusout이 뜬다(CKEditor 4 `blur` → 도구 막대 숨김·자동 저장 등). 01-18 probe가 blur를 기각한 이유(캐럿 소실)는 저장 범위 복원으로 풀린다. focusin 처리기(pipeline.ts:112-121)를 고쳐야 한다 | 좋음 | A가 실측에서 실패할 때의 2순위. 키가 body 리스너에 닿지 않아 WR-01·WR-02의 상당 부분도 구조적으로 해결된다 |
| C. 나옴 동안 `designMode='off'` 또는 `contentEditable='false'`, 복귀 때 원상복구 | 확실 | 큼: 속성 변이가 사이트에 보이고, 사이트가 저장할 때 직렬화될 수 있다. 편집기의 읽기 전용 상태와 어긋난다. designMode 전환은 선택·undo에 영향이 있다 | **최악**: 확장 업데이트·정리(`cleanupOldHelper`)·탭 종료 경합으로 복구가 빠지면 문서가 편집 불가로 남는다 | 기각 |
| D. `compositionstart`에서 초점 이동 | 늦음: 조합이 이미 시작됐다. Chrome은 blur 때 조합을 **확정(commit)** 하므로 'ㄹ'이 문서에 남는다 | 중간 | 보통 | 기각 |

**A의 제약(사용자 결정 필요):** 나옴 상태에서 조합이 시작되지 않으므로 "한글을 치면 입력으로 복귀"(01-18 설계)가 사라진다. 복귀 수단은 주 버튼 누르기(pipeline.ts:262-266, 이미 있음)와, 필요하면 정한 키 하나가 된다. 설계 변경이라 §3.1과 §7("이미 정한 결정은 바꾸지 않는다")에 따라 **먼저 사용자 승인을 받는다.** A를 쓰면 나옴 상태에서 Ctrl+A가 선택을 되살려 IME를 다시 켤 수 있다. 그래서 WR-01 허용 목록에서 KeyA를 뺐다.

**검증 방법:** CDP `Input.imeSetComposition`은 IME 활성 여부와 무관하게 조합을 주입한다. 그래서 A의 핵심 가정("선택이 없으면 IME가 꺼진다")을 증명하지 못한다. 수동 UAT 항목을 둔다. Windows + MS 한국어 입력기에서 크롬·엣지·웨일로 Esc → F → 숫자를 누르고, `compositionstart`가 없는지와 keydown `keyCode !== 229`인지 확인한다. 자동 시험은 "Esc 뒤 `rangeCount === 0`", "복귀 뒤 같은 노드·같은 오프셋", "노드 정체성 유지"를 단언한다.

### 2. WR-08 수정(755f43f)의 Ctrl/Meta 전부 삼키기: **WARNING(과잉 차단). 허용 목록 방식으로 좁힐 것을 권고한다** → WR-01

문서를 망가뜨리지는 않는다. 다만 나옴 상태에서 편집기에 초점이 있는 동안 Ctrl+F/G(찾기), Ctrl+C(복사), Ctrl+P(인쇄), Ctrl+S(사이트 저장. 업무 양식에서 중요하다), Ctrl +/−/0(확대. 이 이용자에게 중요하다), Ctrl+R/F5, Ctrl+L이 **모두** 막힌다. 막히는 이유를 이용자에게 알리는 것도 없다. Ctrl+T/W/N/Tab처럼 Chrome이 예약한 조합은 페이지가 막을 수 없으므로 영향이 없다. 권장 범위와 코드는 WR-01에 있다.

### 3. WR-03(ee05e56): **코드상 수정은 맞다. 잔여 경쟁은 이론상 남고 INFO 수준이다** → IN-01

`sender.tab.url`은 Chrome이 메시지를 받을 때 채우는 **마지막으로 커밋된** 탭 주소다(`tabs` 권한 있음, wxt.config.ts:9). 이동 시작부터 커밋 전까지 옛 https 문서가 보낸 메시지는 이제 기록되지 않는다. 1회차가 지적한 주 경로(`loading`에서 지운 뒤 옛 문서가 다시 기록함)는 닫혔다. 남는 창은 두 가지다.
- (a) 옛 문서가 커밋 **직전에** 보낸 메시지를 브라우저가 커밋 **뒤에** 처리하는 경우. 이때 `tab.url`은 about:blank이고 `sender.origin`은 옛 출처다. 서로 다른 프로세스 IPC 사이에는 순서 보장이 없다.
- (b) about: → about: 이동. `tab.url`이 계속 about:이다.

새 about: 문서의 첫 frameId 0 메시지가 덮어쓰므로 창은 매우 짧다. 새 문서에 content script가 없는 경우(불투명 출처)만 값이 남는다. 이때는 이미 "도울 수 없음"이라 메뉴가 사이트 카드를 만들지 않는다. 수정자가 경쟁을 재현하지 못한 것은 정직하게 보고됐다. 가드 자체를 겨냥한 RED 시험은 없다(IN-01·IN-03).

### 4. WR-06 재시도·세대 번호 / WR-05 팝업 되돌림

- **WR-06: 새 누수나 치명적 경쟁은 없다.** `actionGenerationByTab`은 `onRemoved`에서 지운다. `Promise.race`의 타임아웃 타이머는 정리하지 않지만 1초 뒤 스스로 끝난다. 늦게 끝난 `sendMessage`의 거부도 `race`가 처리하므로 unhandled rejection은 없다. 잔여 셋은 IN-02에 적었다. (1) 500ms 재시도 창은 추정치다. 부하 때 다시 넣기 왕복이 더 걸리면 "도울 수 없음"으로 굳는다. (2) `isCurrent()`를 ping 직후 한 번만 본다. `markUnsupported`의 세 await 사이에 새 호출이 끼면 제목과 배지가 섞일 수 있다. (3) `tabs.onReplaced`는 처리하지 않는다.
- **WR-05: SW 거절(`ok !== true`)은 두 카드 모두 처리한다. 무응답과 거부는 부분적으로만 다룬다.** 사이트 카드는 거부(reject)를 되돌린다. **도우미 카드는 `.then` 하나뿐이라 거부 때 되돌리지 않고 unhandled rejection이 난다**(popup/main.ts:229-239). 두 카드 모두 응답이 오지 않고 대기만 이어질 때의 시간 제한이 없다. 되돌릴 때 안내 문구도 없어서, "끄지 못했다"는 사실이 이용자에게 전해지지 않는다. → WR-03

### 5. TDD 증거·시험 완화·고정 대기

- **RED 커밋:** 따로 있는 것은 CR-01(9739ee3)뿐이다. WR-05~WR-08은 시험과 수정이 한 커밋이다. RED는 수정 보고서의 뮤테이션 확인 서술로만 남아 있다. WR-03은 RED가 없다(자인함). WR-05의 도우미 카드 변경(`ok !== true` 확대)과 사이트 카드의 reject 경로는 시험이 없다. → IN-03
- **시험 완화:** 없다. 테스트 diff에서 지운 줄은 WR-01 관련 주석과, 번호만 바뀐 주석뿐이다. 단언은 모두 추가만 됐다.
- **새 고정 대기:** 4곳이다. WR-07 시험(frames.e2e.ts:424, 431, 433)은 300ms 뒤 `entries.length === 1`을 고정 단언해 부하 때 거짓 실패를 낸다. WR-08 시험(doc-editor.e2e.ts:199)은 200ms 뒤 부재를 단언한다. keydown이 동기라 거짓 통과 위험은 낮다. → WR-06
- **CR-01 RED 시험의 질:** 300ms 창과 시험 속 `expect.poll` 대기가 결합돼 부하 때 거짓 실패를 낸다. 반대로 조합 확정·노드 정체성·캐럿 위치를 보지 않아 CR-01(신규)을 놓치고 거짓 통과한다. → WR-05

## Critical Issues

### CR-01: CR-01 수정의 `innerHTML` 스냅숏 복원이 조합 동안 편집 루트(body) 전체를 다시 파싱해 편집기 노드·선택·되돌리기·위젯을 파괴하고, 캐럿을 문서 처음으로 보내고, 이용자의 정상 입력을 지운다

**파일:** `src/page/input/pipeline.ts:68-80, 191, 371-411` (관련: `src/page/input/mode.ts:41-47`, `src/page/overlay/mode-indicator.ts:124`)
**문제:**
1. **노드 정체성 파괴(확실).** `root.innerHTML = snapshot`(399행)은 body의 모든 자손을 떼고 새 노드를 만든다. 텍스트가 같아도 전혀 다른 객체다. 다음이 모두 끊긴다.
   - 편집기가 쥔 요소 참조: CKEditor 4 위젯의 `wrapper`·`element`, SmartEditor 2의 저장 범위·북마크
   - 자손 노드에 붙은 이벤트 리스너
   - 내부 `<iframe>`·`<video>` 상태(다시 로드된다), 폼 컨트롤의 현재 값·체크 상태(속성이 아니면 사라진다), 사용자 정의 요소 인스턴스

   되돌리기 스택도 끊긴다. Chrome 기본 undo 단계와 편집기 자체 undo 모두 떼어진 노드를 가리키게 되어, 이후 Ctrl+Z가 헛돌거나 엉뚱하게 동작한다. 사이트 입장에서는 스크립트가 문서를 통째로 바꾼 것이다. 편집기의 MutationObserver와 변경 감지가 "문서가 바뀜"으로 보고, 더럽힘 표시나 자동 저장이 실행될 수 있다. "이용자의 문서·사이트를 망가뜨리지 않는 것"을 정면으로 어긴다.
2. **캐럿이 문서 처음으로 간다(높은 확신).** 선택 범위가 들어 있던 노드가 제거되면 경계점이 부모(body)의 오프셋 0 근처로 붙는다. 수정은 선택을 저장·복원하지 않는다. 이후 01-18 설계대로 한글을 쳐서 입력으로 돌아가면 글자가 **원래 캐럿이 아니라 문서 첫머리에** 들어간다. 이것도 문서 오염이다.
3. **IME 상태 불일치(실측 필요).** 조합 중 조합 텍스트 노드가 사라지면 Chrome의 조합 범위도 무너진다. 이후 `compositionupdate`나 확정(commit)이 어디에 글자를 넣을지는 Chrome 내부 동작에 달렸다. 확정의 `input`이 `compositionend`보다 **먼저** 오면 복원되고, 나중에 오면 'ㄹ'이 (문서 처음에) 남는다. Chrome은 대체로 input → compositionend 순서로 알고 있으나 **확신이 없다.** 시험(doc-editor.e2e.ts:163)은 `imeSetComposition`만 보내고 조합을 확정하지 않는다. 이 경로는 전혀 검증되지 않았다.
4. **300ms 창 오탐으로 이용자의 입력이 사라진다(확실).** 무시 조건은 "마지막 도우미 키 소비 뒤 300ms 안의 `compositionstart`"뿐이다(372행). 도우미 키가 조합을 일으키지 않는 키인 경우가 있다. 스페이스·숫자이거나, IME가 영문 상태인 F가 그렇다. 그런 키를 누른 뒤 300ms 안에 이용자가 한글을 치기 시작하면, 그 조합은 입력 복귀가 아니라 무시·복원 대상이 된다. 확정될 때까지 친 글자가 조용히 지워지고 모드는 계속 "도우미"다. 떨림 이용자는 의도치 않은 빠른 연속 입력이 흔하다.
5. **`input` 리스너에 `isTrusted`와 `isHelperEnabled()` 확인이 없다(392-403행).** 무시 중에 메뉴로 도우미를 꺼도 `compositionend`까지 복원이 계속된다. 사이트가 합성한 `input`에도 반응한다.
6. **루트가 `documentElement`인 경로(확신 중간, 빈도 낮음).** `isDocumentEditingRoot`는 html 요소도 허용한다. 이 경우 스냅숏에 `<head>`와 도우미 호스트(`documentElement`에 붙음)가 포함된다. 복원하면 섀도 루트 없는 빈 `<tremor-helper-root>`로 바뀌고 오버레이가 조용히 사라진다.

**수정:**
1. 63d8eff의 스냅숏·`input` 복원·`compositionend` 해제(76-80행, 373-380행, 390-411행)를 **즉시 되돌린다.** 이 복원은 원래 CR-01보다 해롭다.
2. 사용자 승인을 받은 뒤 "나옴 = 선택 범위 해제"로 바꾼다(위 판정 1의 대안 A). 초점은 그대로 둔다.
```ts
// mode.ts
let savedRanges: Range[] = [];
export function escapeDocumentEditor(doc: Document): void {
  escapedFromDocumentEditor = true;
  const sel = doc.getSelection();
  savedRanges = [];
  if (sel) {
    for (let i = 0; i < sel.rangeCount; i += 1) savedRanges.push(sel.getRangeAt(i).cloneRange()); // Range는 DOM 변화를 따라간다
    sel.removeAllRanges(); // 선택의 편집 루트가 없으면 IME가 조합을 시작하지 않는다(실측 필요)
  }
}
export function resumeDocumentEditor(opts: { restoreSelection: boolean }): void {
  escapedFromDocumentEditor = false;
  const ranges = savedRanges;
  savedRanges = [];
  if (!opts.restoreSelection) return; // 포인터 복귀는 클릭이 캐럿을 새로 놓는다
  const sel = document.getSelection();
  const alive = ranges.filter((r) => r.startContainer.isConnected && r.endContainer.isConnected);
  if (sel && alive.length > 0) {
    sel.removeAllRanges();
    alive.forEach((r) => sel.addRange(r));
  }
}
```
3. 기존 `compositionstart` → 복귀 경로(01-18)는 대안 A가 실패하는 브라우저를 위한 안전망으로 남긴다. 그 경우 표시와 실제 입력이 최소한 일치한다. 300ms 시간 창은 없앤다. 꼭 남겨야 한다면, 도우미가 소비한 keydown이 `event.isComposing || event.keyCode === 229`였고 바로 다음 태스크의 `compositionstart`일 때로만 좁힌다.
4. RED 시험을 먼저 만든다. (a) `#doc-text` 노드에 표식을 달고 Esc → F(229) → 조합 → 확정(`Input.insertText` 또는 `imeCommitText`) 뒤 **같은 노드**인지 본다. (b) 캐럿 오프셋이 보존되는지 본다. (c) Esc 뒤 `getSelection().rangeCount === 0`인지 본다. 실제 IME 동작은 수동 UAT 항목으로 둔다(판정 1의 검증 방법).

## Warnings

### WR-01: WR-08 수정이 나옴 상태에서 Ctrl/Meta 조합을 전부 삼켜 찾기·복사·인쇄·저장·확대까지 막는다. 떨어진 Ctrl keydown도 삼켜 keydown/keyup 짝이 깨진다

**파일:** `src/page/input/pipeline.ts:34-36, 203-209`
**문제:** 조건은 `EDITING_KEYCODES.has(code) || ctrlKey || metaKey`다.
- Ctrl+F/G, Ctrl+C, Ctrl+P, Ctrl+S, Ctrl +/−/0, Ctrl+R 같은 편집이 아닌 조합이 모두 `preventDefault`와 `stopImmediatePropagation`으로 사라진다. 특히 확대와 사이트 저장이 막힌다. 표시("도우미" 모드)만으로는 이유를 알 수 없다.
- Control 키만 누른 keydown(`ControlLeft`, ctrlKey true)도 삼킨다. `swallowedKeyCodes`에 넣지 않으므로 keyup은 사이트에 그대로 간다. keydown 없는 keyup이 되어, 수정 키 상태를 추적하는 사이트 스크립트를 혼란시킨다. Enter·Backspace도 keydown만 삼키고 keyup은 흘린다. CKEditor 4는 keyup에서 undo 스냅숏 등을 처리하는데, 이 동작과 어긋난다.

**수정:** 편집 가능성이 있는 조합은 기본적으로 막는다(안전). 편집을 일으키지 않는 브라우저·사이트 명령만 허용 목록으로 통과시킨다. 삼킨 키는 keyup까지 일관되게 삼킨다.
```ts
const MODIFIER_ONLY = new Set(['ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight']);
// 편집을 일으키지 않는 조합만 통과: 복사·찾기·인쇄·저장·확대·새로고침.
// KeyA(전체 선택)는 대안 A(선택 해제)와 충돌하므로 뺀다.
// KeyL·KeyE·KeyJ·KeyR은 일부 편집기가 링크·정렬에 쓰므로 넣을지는 사용자 결정 사항이다.
const PASS_CTRL_CODES = new Set(['KeyC', 'Insert', 'KeyF', 'KeyG', 'F3', 'KeyP', 'KeyS', 'Equal', 'Minus', 'Digit0', 'NumpadAdd', 'NumpadSubtract', 'Numpad0', 'F5']);
if (isEscapedFromDocumentEditor() && isDocumentEditingRoot(deepActiveElement()) && !MODIFIER_ONLY.has(event.code)) {
  const mod = event.ctrlKey || event.metaKey;
  const block = mod
    ? !(PASS_CTRL_CODES.has(event.code) && !event.altKey)
    : EDITING_KEYCODES.has(event.code) || (event.shiftKey && event.code === 'Insert'); // Shift+Insert = 붙여넣기
  if (block) {
    swallowedKeyCodes.add(event.code); // keypress·keyup도 함께 삼킨다
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
}
```
시험: 나옴 상태에서 Ctrl+B는 막히고(fixture가 keydown으로 `<b>` 삽입), Ctrl+F·Ctrl+=는 사이트 keydown 리스너에 도달하는지 단언한다.

### WR-02: 나옴 상태의 편집 차단이 키보드 밖 경로(오른쪽 메뉴 붙여넣기·잘라내기, Shift+Insert, 끌어 놓기)를 막지 않아 편집기가 직접 문서를 고칠 수 있다

**파일:** `src/page/input/pipeline.ts:198-209, 413-426, 262`
**문제:** WR-08의 목표는 "나옴 상태에서 문서가 조용히 바뀌지 않음"이다. 그런데 차단 수단은 keydown과 `beforeinput` 취소뿐이다. 다음 경로가 남는다.
- CKEditor 4 clipboard 플러그인 같은 편집기는 `paste`·`drop` 이벤트에서 기본 동작을 취소하고 자신의 API(execCommand 또는 DOM 조작)로 넣는다. 이 경로는 `beforeinput`을 거치지 않는다. 동작은 1회차 WR-08과 같은 근거이며, CKEditor 4 실제 동작은 실측이 필요하다.
- 오른쪽 클릭은 `button === 0` 조건 때문에 나옴 상태를 풀지 않는다(262행). 그래서 "도우미" 표시인 채로 메뉴의 붙여넣기가 실행된다.
- Shift+Insert는 ctrlKey가 없고 `EDITING_KEYCODES`에도 없어 그대로 통과한다.

**수정:** 나옴 상태이고 초점이 문서 편집 루트이면 `paste`·`cut`·`drop`·`dragover`를 window capture에서 `preventDefault()`와 `stopImmediatePropagation()`으로 막는다. `isTrusted`이고 `isHelperEnabled()`일 때만 막는다. Shift+Insert는 WR-01 코드에 포함했다. 시험 fixture: `paste` 리스너에서 `preventDefault` 후 `<p>`를 넣는 편집기로 RED를 만든다.

### WR-03: 도우미 카드(전역 끄기)는 SW 응답 거부를 처리하지 않고, 두 카드 모두 무응답 시간 제한과 실패 안내가 없다. 이용자는 "껐다"고 믿지만 켜져 있을 수 있다

**파일:** `src/entrypoints/popup/main.ts:226-240, 294-312`
**문제:**
- `helperCard`는 `sendMessage(...).then(onFulfilled)`뿐이다. SW가 요청 도중 종료되는 등으로 포트가 닫히면 promise가 거부된다. 이때 되돌리지 않고, unhandled rejection이 나며, 카드는 "도우미 켜기"(=꺼짐)로 남는다. 이 카드는 가장 중요한 안전 스위치다.
- 두 카드 모두 응답이 계속 오지 않으면 낙관적 렌더가 무기한 남는다.
- 되돌릴 때 문구가 없다. 떨림 이용자는 글자가 잠깐 바뀌었다 돌아온 것을 놓치기 쉽다. §7("문구는 오류에만 한 줄로, 무엇을 하면 되는지")에도 어긋난다.

**수정:**
```ts
function sendWithRevert(message: Message, revert: () => void, onFail: (reason?: string) => void): void {
  let settled = false;
  const timer = setTimeout(() => { if (!settled) { settled = true; revert(); onFail('timeout'); } }, 3000);
  chrome.runtime.sendMessage(message).then(
    (response) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      const r = response as { ok?: boolean; reason?: string } | undefined;
      if (r?.ok !== true) { revert(); onFail(r?.reason); }
    },
    () => { if (settled) return; settled = true; clearTimeout(timer); revert(); onFail('rejected'); },
  );
}
// 사이트 카드 실패 안내 예: "이 사이트를 끄지 못했어요. 1을 눌러 도우미를 끄세요."
```
시험: 도우미 카드의 거부 경로(SW 쪽 훅으로 응답 없이 포트를 닫음)와 사이트 카드의 안내 문구를 추가한다.

### WR-04: WR-07 수정 뒤에도 자식 프레임 직접 누르기 기록은 경로 속 세션 ID(`;jsessionid=` 등)를 저장하고, 여전히 번호 순서에 쓰이지 않는 기록만 쌓는다

**파일:** `src/entrypoints/content.ts:193-195, 316, 700, 715`
**문제:** `location.pathname`에는 Java 서블릿의 URL 재작성 세션 ID(`/app/page.do;jsessionid=ABC…`)와 경로형 문서 번호·토큰이 그대로 들어간다. 사내 업무 시스템(전자정부 프레임워크·Spring 등)에서 흔한 형태다. 1회차가 지적한 근본 문제도 그대로 남았다. `local:` framePath는 번호표 항목의 framePath와 절대 일치하지 않는다(`isSameElement`는 framePath 완전 일치를 요구한다). 그래서 이 기록은 D-11 순서에 쓰이지 않고 200개 상한만 채운다. 쓰이지 않는 데이터에 경로 정보가 계속 쌓이는 셈이다.
**수정:** 1회차 권고의 두 번째 안을 적용한다. 맨 위가 정확한 framePath를 알려 주기 전까지는 자식 프레임의 직접 누르기를 **기록하지 않는다**(framePath를 모르면 `recordPress`를 보내지 않음). 최소 수정으로 남긴다면 `location.origin`만 쓴다. 이 경우 한 출처의 여러 프레임은 구분되지 않지만 어차피 쓰이지 않는다.
```ts
const localPressFramePath: string[] | null = isTopFrame ? [] : null; // null이면 기록 생략
```
시험: `;jsessionid=secret` 경로의 자식 프레임에서 직접 누른 뒤 저장소에 그 문자열이 없는지(또는 기록 0건인지) 단언한다.

### WR-05: CR-01 RED 시험이 300ms 창에 결합돼 부하 때 거짓 실패하고, 조합 확정·노드 정체성·캐럿 위치를 보지 않아 CR-01(신규)을 놓친다

**파일:** `tests/e2e/doc-editor.e2e.ts:138-170`
**문제:**
- keydown(229)과 `imeSetComposition` 사이에 `expect.poll(hintLabelCount)`(161행)가 있다. 부하 때 번호표가 300ms 넘게 걸리면 `compositionstart`가 창 밖으로 나가 입력 복귀가 되고 시험이 실패한다. 실제 IME에서는 두 이벤트가 같은 순간에 오는데, 시험은 인위적 간격을 넣는다.
- 단언은 `textContent`가 같은지뿐이다. 그래서 노드가 통째로 교체되고(CR-01 신규), 캐럿이 문서 처음으로 가고, 조합 확정 뒤 글자가 남아도 통과한다.

**수정:** keydown과 조합을 연속으로 보내고, 번호표 확인은 뒤로 옮긴다. `Input.insertText`로 확정까지 보낸다. 노드 표식 정체성과 캐럿 오프셋을 단언한다. CR-01을 대안 A로 고치면 이 시험은 "Esc 뒤 rangeCount 0", "복귀 뒤 같은 노드·같은 오프셋"으로 바꾼다.

### WR-06: 수정 시험에 새 고정 대기가 들어갔다. WR-07 시험은 300ms 뒤 저장소 개수를 고정 단언해 부하 때 거짓 실패한다

**파일:** `tests/e2e/frames.e2e.ts:424, 431, 433-436`, `tests/e2e/doc-editor.e2e.ts:199`
**문제:**
- WR-07 시험은 `waitForTimeout(200)`, `(50)`, `(300)` 뒤 `entries.length === 1`을 단언한다. 기록 쓰기는 content → SW → storage 왕복이라 300ms를 넘을 수 있다. 같은 파일의 기존 시험(386행)과 같은 패턴을 복제한 것이다.
- WR-08 시험은 200ms 뒤 부재를 단언한다. keydown 처리가 동기라 거짓 통과 위험은 낮지만, 대기 자체가 불필요하다.

**수정:** WR-07은 `await expect.poll(async () => (await pressesEntries(sw, origin)).length).toBe(1)` 뒤에 framePath를 단언한다. 200ms와 50ms 대기는 모드 표시 폴링이나 테두리 표시 폴링으로 바꾼다. WR-08의 200ms 대기는 지운다(`keyboard.press`가 돌아온 시점에 동기 처리기는 이미 끝났다).

## Info

### IN-01: WR-03 잔여: 커밋 직전 옛 문서 메시지와 about: → about: 이동은 여전히 구분하지 않는다. 가드를 겨냥한 RED 시험이 없다

**파일:** `src/entrypoints/background.ts:246-248`, `tests/e2e/blank-popup.e2e.ts`(WR-03 시험)
**문제:** 판정 3의 (a)와 (b)다. 새 시험은 정상 경로 회귀 안전망일 뿐이다. 가드를 되돌려도 통과한다(수정자 확인).
**수정:** 새 권한 없이 쓸 수 있는 `sender.documentLifecycle === 'active'`(Chrome 106+) 조건을 더해 `pending_deletion` 문서를 거른다. 가능하면 `sender.documentId`를 함께 저장한다. `src/types/chrome.d.ts`의 `MessageSender`에 두 필드를 추가한다. 조건을 `shouldRecordTopDocOrigin(sender)` 순수 함수로 빼면 Vitest로 RED/GREEN을 결정적으로 만들 수 있다.

### IN-02: WR-06 잔여: 재시도 창(250ms × 2)은 추정치이고, 세대 확인이 action API 호출 사이에서 다시 이뤄지지 않는다

**파일:** `src/entrypoints/background.ts:58-112, 129-132`
**문제:**
- 다시 넣기 왕복이 약 0.5초(실패가 즉시 오는 경우)를 넘으면 여전히 "도울 수 없음"으로 굳는다. 이때 메뉴는 사이트 카드를 숨긴다. 전역 끄기 카드는 남는다.
- `isCurrent()`는 ping 직후 한 번만 본다. `markUnsupported`의 `setTitle` → `setBadgeText` → `setBadgeBackgroundColor` 사이에 새 호출이 끝나면 제목과 배지가 섞일 수 있다.
- `tabs.onReplaced`(프리렌더 교체)로 바뀐 옛 tabId 항목은 지우지 않는다(작은 누수).

**수정:** 새 인스턴스가 맨 위에서 시작을 마치면 SW에 `frame/ready`를 보내고, SW가 `updateActionForTab`을 다시 부르게 한다(시간 추정 제거). 각 action API 호출 직전에 `isCurrent()`를 다시 확인한다. `onReplaced`에서 옛 id를 지운다.

### IN-03: TDD 증거가 고르지 않다. 따로 된 RED 커밋은 CR-01뿐이고, WR-05의 도우미 카드 변경과 사이트 카드 reject 경로는 시험이 없다

**파일:** 커밋 a61c308, 755f43f, a07c2f5, 16145b7, ee05e56 / `tests/e2e/site-toggle.e2e.ts:570-594`
**문제:** WR-05~WR-08은 시험과 수정을 한 커밋에 넣었다. RED는 보고서 서술로만 남았다. WR-05 시험의 `hasHelperRoot(page)` 폴링(591행)은 누르기 전에도 참이라 아무것도 증명하지 않는다. 시험 완화는 없었다.
**수정:** 다음 수정부터는 RED 커밋을 분리한다(CLAUDE.md §5). WR-05 시험에 도우미 카드 거절·거부 경로를 추가한다. 591행은 "사이트 항목이 여전히 깨진 원본 그대로"(쓰기 안 됨)를 단언하도록 바꾼다.

---

_리뷰 시각: 2026-09-26T07:28:34Z_
_리뷰어: Claude (gsd-code-reviewer)_
_깊이: deep_
_반복: 2_
