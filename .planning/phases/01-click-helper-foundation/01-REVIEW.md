---
phase: 01-click-helper-foundation
reviewed: 2026-09-26T06:30:34Z
depth: deep
files_reviewed: 29
files_reviewed_list:
  - src/core/unsupported-url.ts
  - src/entrypoints/background.ts
  - src/entrypoints/content.ts
  - src/entrypoints/popup/main.ts
  - src/page/collector/collector.ts
  - src/page/input/mode.ts
  - src/page/input/pipeline.ts
  - src/shared/messages.ts
  - src/types/chrome.d.ts
  - src/worker/relay.ts
  - src/worker/storage-writer.ts
  - wxt.config.ts
  - tests/e2e/blank-popup.e2e.ts
  - tests/e2e/confirm.e2e.ts
  - tests/e2e/doc-editor.e2e.ts
  - tests/e2e/dom-audit.e2e.ts
  - tests/e2e/dwell.e2e.ts
  - tests/e2e/editor-frames.e2e.ts
  - tests/e2e/fonts.e2e.ts
  - tests/e2e/frames.e2e.ts
  - tests/e2e/helper-toggle.e2e.ts
  - tests/e2e/hints.e2e.ts
  - tests/e2e/lifecycle.e2e.ts
  - tests/e2e/site-toggle.e2e.ts
  - tests/practice-site/blank-popup.html
  - tests/practice-site/doc-editor.html
  - tests/practice-site/dwell-frame.html
  - tests/practice-site/editor-frames.html
  - tests/unit/unsupported-url.test.ts
findings:
  critical: 1
  warning: 8
  info: 4
  total: 13
status: issues_found
---

# Phase 1: 코드 리뷰 보고서

**리뷰 시각:** 2026-09-26T06:30:34Z
**깊이:** deep
**리뷰한 파일:** 29
**상태:** issues_found

## 요약

범위는 `git diff ae3cdf8..HEAD`이다. 지난 리뷰의 CR/WR 수정분과 보완 계획 01-17(srcdoc·document.write 편집기 프레임), 01-18(자식 프레임 확인 화면 방어, IN-04 fail-closed, 문서 전체 편집기 Esc), 01-19(주소 없는 새 창, editor-frames flaky 수정)를 읽었다. background → relay → content → pipeline/mode로 호출 사슬을 따라갔고, 사이트 정체(`topDocOrigins`·`siteOriginOfTab`·`inheritedSiteOrigin`)가 메시지 경계를 넘을 때 어떤 값을 믿는지 대조했다.

사이트 정체 위조 방지 설계는 대체로 맞다. `topDocOrigins`는 Chrome이 채운 `sender.origin`으로만 채우고, `recordPress`·`setSiteDisabled`는 요청 본문 origin을 그 값과 대조한다. 요청 본문 문자열만으로 다른 사이트를 끄거나 기록을 쌓는 경로는 찾지 못했다. 문제는 세 곳이다.

- **(1)** 01-18의 문서 전체 편집기 "나옴" 상태가 한글 IME에서 깨진다. 이 제품의 실제 이용자 환경이다.
- **(2)** 55acdd0의 `documentWasRewritten()` 방어는 근거가 서로 맞지 않는 추측성 코드다. 그 경로에 실제로 들어가면 새 도우미를 넣지 못한다.
- **(3)** `topDocOrigins`의 수명 관리가 설계가 아니라 이벤트 도착 순서에 기대고 있다.

### 오케스트레이터 요청 항목 판정

**1. editor-frames flaky 수정(55acdd0) — 시험 쪽 변경은 "완화"가 아니다. content.ts 쪽 변경은 근본 수정이 아니라 추측성 코드다.**

- **(a) 옛 인스턴스의 frame/state(true)는 제품에서 무해하다.** `frameStates`(background.ts:29-30, 355-365)를 읽는 곳은 시험(`globalThis.frameStates`)뿐이다. relay.ts는 frame/state를 받지도 않는다. 옛 인스턴스가 보낼 수 있는 true는 부모 인라인 스크립트의 `d.open()`보다 **먼저** 도착한 설정 읽기뿐이다. HTML 파서가 `<iframe>`과 `<script>` 사이에서 양보하면 그 사이에 IPC 태스크가 끼어들 수 있다. `d.open()` 뒤에는 MutationObserver 콜백(마이크로태스크)이 다음 IPC 태스크보다 반드시 먼저 돈다. 그래서 cleanedUp이 늦게 서는 일은 없다. `cleanupOldHelper()`는 frame/state(false)를 보내지 않으므로 순서가 뒤집혀 false가 남는 일도 없다. 남는 부작용은 하나다. 다시 넣기가 실패하면 `frameStates`에 옛 true가 그대로 남는다. 제품에는 영향이 없고 시험 오라클만 낡는다(IN-02).
- **(b) 남은 두 단언이 실제 위협은 막는다.** 옛 `onMessage` 리스너가 남는 경우와 새 인스턴스가 두 번 들어가는 경우는 누르기 횟수 1 단언이 잡는다. 두 경우 모두 press/request 한 번에 리스너 두 개가 동기로 반응해 카운터가 2가 되기 때문이다. 다만 "호스트 1개" 단언은 거의 항상 참이다. 새 인스턴스가 시작할 때 `tremor-helper-root`를 모두 지우므로(content.ts:145-147), 옛 인스턴스가 정리되지 않은 회귀는 이 단언으로 잡히지 않는다. 지운 단언이 맡던 "다시 쓰기 **이후** 옛 인스턴스가 조용하다"는 관찰은 결정적으로 되살릴 수 있다. WR-02를 보라.
- **(c)** `documentWasRewritten`을 겨냥한 실패 시험이 없다. 필요한가 이전에, 이 코드는 **남기면 안 된다**(WR-01). 남은 `waitForTimeout(1500)`은 실패를 일으키는 flaky의 씨앗은 아니다. 다만 이제 그 대기에 기대는 단언이 없어 흔적만 남은 대기이고, 부하 시 늦은 오동작을 놓치는 거짓 통과의 씨앗이다(WR-02).

**2. noopener 새 창의 아이콘·메뉴는 코드 경로상 "도울 수 없음"을 보인다. 시험이 이를 확인하지 않아 경고로 둔다(WR-04).**
경로는 이렇다. `updateActionForTab`은 `about:` 주소에서 주소 규칙을 건너뛴다(background.ts:76). 이어 `respondsToSitePing`이 보낸 `chrome.tabs.sendMessage`가 수신자 없음으로 거부되어 false가 되고, `markUnsupported`로 간다. 메뉴는 아이콘 제목 `도울 수 없음`을 보고 안내를 띄운다(popup/main.ts:334-337). 제목이 아직 설정되기 전에 메뉴를 열면 `resolveSiteOrigin`의 ping이 실패해 사이트 카드를 만들지 않는다(popup/main.ts:344-347). 이때는 "도울 수 없음" 안내도 없이 카드 1·3·4만 보인다. 거짓으로 "돕는 중"을 보이지는 않지만 상태가 애매하다.

**3. 사이트 정체 위조 방지 — 메시지 본문을 믿는 곳은 없다. 탭 이동 때 낡은 값이 다시 들어올 수 있는 경쟁이 있다(WR-03).**
`topDocOrigins.set`(background.ts:223-225)은 `sender.origin`만 쓴다. `inheritedSiteOrigin`은 불투명·비 http(s)·스토어 출처를 거절한다. `setSiteDisabled`(:251-253)와 `recordPress`(:268-270)는 본문 origin을 `siteOriginOfTab` 결과와 대조한다. 그러나 `loading` 때 지운 뒤(:104-109), 아직 살아 있는 **옛 문서**의 frameId 0 메시지가 도착하면 옛 출처가 다시 기록된다. 문서 식별자가 없어 이를 막지 못한다. 닫힌 탭은 `onRemoved`로 지운다(:115-117).

**4. `window.opener` 등 noopener 구분 장치 — 없다(준수).** `src/`에서 `opener`는 content.ts:133 주석 한 곳뿐이다.

## Critical Issues

### CR-01: 문서 전체 편집기 "나옴" 상태에서 한글 IME가 켜져 있으면 F가 'ㄹ'로 들어가고 입력 모드로 돌아간다. 번호표는 뜨지만 숫자는 문서에 입력된다

**파일:** `src/page/input/pipeline.ts:128-178, 331-346`, `src/page/input/mode.ts:51-69`
**문제:** 01-18은 문서 전체 편집기(designMode·contenteditable 본문)에서 Esc를 누르면 `blur()` 대신 `escapedFromDocumentEditor` 표시만 켠다. 그래서 **초점은 계속 편집 가능한 본문에 남는다.** 이 상태에서 한글 입력기가 켜진 채 F를 누르면 다음 순서로 진행된다.
1. keydown(code `KeyF`, key `Process`, keyCode 229)이 들어온다. 도우미 키 처리기가 번호표를 열고 `preventDefault()`한다.
2. 그러나 IME가 이미 받은 키는 keydown 취소로 되돌릴 수 없다. Chrome/Windows의 알려진 동작이다.
3. `compositionstart`가 뜬다. 339-345행이 `resumeDocumentEditor()`를 불러 입력 모드로 되돌리고, 'ㄹ'이 문서에 조합된다.
4. 이어 숫자를 누르면 `currentMode() === 'typing'`이라 164-167행에서 도우미 키 처리기를 건너뛴다. 자식 프레임 쪽도 같은 파이프라인이라 hints/key를 보내지 않는다. 번호표는 떠 있는데 숫자가 편집 중인 문서에 들어간다.

한국어 문서를 쓰는 이용자는 한글 입력기를 켜 둔 채인 경우가 보통이다. KEY-01의 기본 흐름(Esc → F → 번호)이 주 이용자 환경에서 문서 내용을 오염시킨다. doc-editor.e2e.ts는 `page.keyboard`(IME 없음)와 CDP `imeSetComposition`(F 없이 조합만)만 쓴다. 그래서 이 조합은 시험되지 않는다. 확인 화면이 떠 있는 동안에는 `modalHandler`가 먼저 가로채므로 위험 버튼 확인 흐름은 해당하지 않는다.
**재현(실측 필요):** Windows Chrome에서 한글 입력기를 켠다. `doc-editor.html` `#frame-design` 본문을 클릭하고, Esc → F → 숫자를 누른다. 본문 글자와 `data-mode`를 확인한다.
**수정:** "나옴" 상태에서는 편집 가능한 초점을 실제로 놓아야 IME가 조합을 시작하지 않는다. 캐럿을 지우지 않고 초점만 옮기는 방법을 쓴다. 예: 나올 때 선택 범위를 저장하고 `window.getSelection().removeAllRanges()`를 부른다. 그러면 문서 초점이 편집 불가 상태가 된다. 다시 누르면 저장한 범위를 복원한다. 또는 나옴 상태에서 도우미 키로 쓴 keydown의 `isComposing`/`keyCode === 229`를 보고 이어지는 `compositionstart`를 입력 복귀 신호로 쓰지 않는다. 이 경우 `compositionend` 전까지 `beforeinput`(insertCompositionText 포함)과 조합 결과를 취소한다. 어느 쪽이든 실제 한글 IME로 RED 시험(수동 UAT 항목 가능)을 먼저 만든다.
```ts
// pipeline.ts compositionstart: 도우미 키 직후의 조합은 입력 복귀 신호가 아니다
let lastHelperKeyAt = -Infinity;
// keyHandlers가 true를 돌려준 곳에서: lastHelperKeyAt = event.timeStamp;
if (isEscapedFromDocumentEditor()) {
  if (event.timeStamp - lastHelperKeyAt < 50) { /* 조합을 막고 나옴 유지 */ return; }
  resumeDocumentEditor(); ...
}
```

## Warnings

### WR-01: `documentWasRewritten()` 방어(55acdd0)는 근거가 모순된 추측성 코드다. 그 경로에 들어가면 frame/reinject 없이 정리되어 그 프레임의 도우미가 사라진다

**파일:** `src/entrypoints/content.ts:161-170, 598-604, 1212-1216`
**문제:**
1. **근거가 서로 다르다.** 커밋 메시지는 원인을 "옛 인스턴스의 설정 읽기가 `document.open()` **이전에** 끝남"이라고 적었다. 이 경우 `documentWasRewritten()`은 false라 이 방어와 무관하다. 코드 주석(164-165행)은 "설정 읽기가 MutationObserver 콜백보다 먼저 끝남"이라고 적었다. 이는 이벤트 루프상 일어날 수 없다. MO 콜백은 변이를 일으킨 스크립트가 끝난 직후의 마이크로태스크 체크포인트에서 돌고, storage IPC 응답은 그 뒤의 별도 태스크다.
2. **효과를 보인 근거가 없다.** 같은 커밋에서 시험 단언을 바꿨으므로 "수정 후 25회 무실패"는 이 코드의 효과가 아니다. 뮤테이션 확인도 `removeListener`에 대해서만 했다. 이 방어를 겨냥한 RED 시험도 없다(CLAUDE.md §5 TDD·"추측 수정 금지" 위반).
3. **들어가면 해롭다.** 이 경로는 `cleanupOldHelper()`만 부르고 frame/reinject를 보내지 않는다. `cleanupOldHelper()`는 1213행에서 `documentRewriteWatcher.disconnect()`를 부른다. MutationObserver의 `disconnect()`는 쌓여 있던 레코드를 버리므로 대기 중이던 MO 콜백(180-185행, reinject를 보내는 유일한 곳)이 영영 불리지 않는다. 결과적으로 다시 쓴 편집기 프레임에는 도우미가 하나도 없다. 조용히 도울 수 없게 되고, 아이콘이나 메뉴에는 드러나지 않는다.

**수정:** 되돌리는 것이 맞다. 남겨야 할 근거가 생기면 두 경로가 같은 처리기를 쓰게 하고, 그 경로를 결정적으로 재현하는 시험을 먼저 만든다.
```ts
function handleDocumentRewrite(): void {
  if (cleanedUp) return;
  cleanupOldHelper();
  if (isExtensionContextValid()) {
    void chrome.runtime.sendMessage({ type: 'frame/reinject' }).catch(() => {});
  }
}
// MO 콜백과 applyEnabled 양쪽에서 handleDocumentRewrite()를 부른다
```

### WR-02: editor-frames "옛 인스턴스는 조용하다" 시험 — 호스트 수 단언은 거의 항상 참이고, 1500ms 고정 대기는 흔적만 남았다. "다시 쓰기 이후 조용함"을 결정적으로 보는 단언이 사라졌다

**파일:** `tests/e2e/editor-frames.e2e.ts:414-427`
**문제:** 새 인스턴스는 시작할 때 문서의 모든 `tremor-helper-root`를 지운다(content.ts:145-147). 그래서 `hostCount === 1`은 옛 인스턴스의 정리 여부와 무관하게 참이다. 새 인스턴스가 생긴 **뒤에** 옛 인스턴스가 호스트를 새로 만드는 경우만 잡는다. `waitForTimeout(1500)` 뒤의 두 단언은 이 대기에 기대지 않는다. 대기의 본래 목적(옛 인스턴스가 늦게 오동작할 틈을 주고 관찰)은 관찰 수단과 함께 사라졌다. 부하 시 1500ms 뒤에 오는 옛 인스턴스의 활동은 어떤 단언도 보지 못한다.
**수정:** 지운 누적 개수 대신, 경쟁이 없는 관찰 창을 쓴다. `waitForFrameHelperAlive`가 통과한 시점에는 새 인스턴스가 이미 true를 보냈다. 그 시점부터 그 frameId의 frame/state가 **0건**인지 본다. 기록기는 `setupFrameStateRecorder`를 그대로 쓴다. 이렇게 하면 원래 의도("다시 쓰기 뒤 옛 인스턴스가 켜지지 않는다")를 경쟁 없이 되살린다. 1500ms는 그 관찰 창 길이로만 남기거나 `expect.poll`로 바꾼다.
```ts
await setupFrameStateRecorder(serviceWorker);
// ... page.goto, waitForFrameHelperAlive ...
const childFrameId = /* frameStates에서 frameId !== 0인 키 */;
const baseline = await frameStateRecordCount(serviceWorker, childFrameId);
await page.waitForTimeout(1500);
expect(await frameStateRecordCount(serviceWorker, childFrameId) - baseline).toBe(0);
```

### WR-03: `topDocOrigins`는 탭 이동 중 옛 문서가 보낸 메시지로 낡은 출처가 다시 기록될 수 있다. 문서 식별 없이 "마지막 frameId 0 메시지"가 이긴다

**파일:** `src/entrypoints/background.ts:36, 104-109, 223-225`
**문제:** `tabs.onUpdated`의 `status: 'loading'`은 이동이 **시작될 때** 온다. 새 문서가 커밋되기 전까지 옛 문서는 살아 있고, collector의 rAF 보고, frame/state, hints/state 같은 frameId 0 메시지를 계속 보낼 수 있다. 이 메시지가 `loading` 처리 뒤에 도착하면 `topDocOrigins`에 옛 출처가 다시 들어간다.

탭이 `about:blank`로 커밋되면 `siteOriginOfTab`은 그 옛 출처를 새 문서의 사이트로 답한다. 예를 들어 https://a.com 탭을 다른 창(b.com, opener)이 `about:blank`로 이동시키면, 새 문서는 b.com 출처를 물려받는다. 그 새 문서의 맨 위 첫 메시지가 덮어쓰기 전까지, 자식 프레임의 site/query는 a.com을 받는다. 그래서 a.com의 사이트 끄기 상태를 읽고, `recordPress`는 a.com 키에 기록된다. 불투명 출처 about:blank(주소창 입력 등, content script 없음)로 가면 덮어쓸 메시지가 없어 낡은 값이 탭이 닫힐 때까지 남는다. 지금은 메뉴가 사이트 카드를 안 만들어 소비되지 않을 뿐이다.

01-19 금지사항("그 창 문서 **자신의** 출처로만")을 설계가 아니라 이벤트 도착 순서가 지키고 있다. 같은 문서 안 이동(해시·pushState)도 `loading`을 일으키면 값이 지워진다. 그러면 다음 frameId 0 메시지 전까지 메뉴 사이트 끄기가 `origin-mismatch`로 조용히 거절된다(WR-05와 겹친다).
**수정:** 옛 https 문서의 메시지는 about: 탭 해석에 쓰지 않는다. Chrome이 채운 `sender.tab.url`(메시지 처리 시점의 커밋된 탭 주소)이 `about:`일 때만 기록한다. 그러면 이동 시작 뒤에도 탭 주소가 아직 옛 https인 동안의 메시지는 무시된다. document.write 새 창은 탭 주소가 about:blank로 남으므로(probe) 그대로 동작한다. 가능하면 `sender.documentId`를 함께 저장해 about: → about: 이동도 구분한다.
```ts
if (sender.frameId === 0 && sender.tab?.id !== undefined && sender.origin && sender.tab.url?.startsWith('about:')) {
  topDocOrigins.set(sender.tab.id, sender.origin);
}
```

### WR-04: noopener 새 창의 아이콘·메뉴가 "도울 수 없음"인지 시험하지 않는다. 있는 시험도 고정 1초 뒤 "없음"만 단언해 부하 시 거짓 통과한다

**파일:** `tests/e2e/blank-popup.e2e.ts:309-327`
**문제:** 요청 항목 2의 코드 경로는 맞다(위 판정). 그러나 SAFE-05("도울 수 없음 표시가 실제와 같음")의 noopener 쪽 근거가 되는 시험은 `tremor-helper-root` 부재만 본다. 아이콘 제목·배지와 메뉴 안내는 보지 않는다. 또 `waitForTimeout(1000)` 뒤의 부재 단언이라, 부하로 주입이 1초보다 늦어지면 실제 동작과 무관하게 통과한다. 양성 대조(같은 시간 안에 일반 새 창에는 도우미가 들어옴)도 없다. 이 시험 하나가 "Chrome은 noopener에 주입하지 않는다"는 실측의 유일한 근거다.
**수정:** 두 noopener 탭 각각에 대해 `expect.poll(() => tabTitle(sw, id)).toBe('도울 수 없음')`과 배지 `없음`을 단언한다. `popup.html?tabId=`로 메뉴를 열어 안내 문구가 보이고 사이트 카드가 없는지도 확인한다. 부재 단언 앞에는 같은 여는 쪽에서 `openDomPopup`으로 도우미가 뜨는 것을 먼저 확인해 양성 대조로 삼는다.

### WR-05: 메뉴의 "이 사이트에서 끄기" 카드가 SW 거절(`origin-mismatch`·`write-failed` 등)을 무시해 실제로는 켜져 있는데 꺼짐으로 보인다

**파일:** `src/entrypoints/popup/main.ts:287-301`
**문제:** `createSiteCard`의 `onToggle`은 `render(next)` 뒤 응답을 보지 않는다. 01-19로 about: 탭은 `topDocOrigins`에 기대게 됐다. 그래서 SW 재시작 직후, WR-03의 이동 경쟁, 같은 문서 안 이동 뒤에는 `siteOriginOfTab`이 undefined가 되어 `origin-mismatch`로 거절되는 경우가 늘었다. `storage.onChanged`도 오지 않으니 카드는 "이 사이트에서 켜기"(=꺼짐)로 남는다. "즉시 끌 수 있음"이 핵심 안전 요구인데, 이용자는 껐다고 믿지만 도우미는 계속 돈다. `helperCard`도 `preserved-original` 외의 `{ ok: false }`(item-too-large, 경계 catch)는 되돌리지 않는다.
**수정:**
```ts
onToggle: (next, render, revert) => {
  render(next);
  void chrome.runtime.sendMessage(message).then((response) => {
    if ((response as { ok?: boolean } | undefined)?.ok !== true) {
      revert();
    }
  }, () => { revert(); });
},
```
`helperCard`도 `ok !== true`면 `revert()`하도록 맞춘다.

### WR-06: 쓰기 새 창(document.write)과 맨 위 다시 쓰기 탭의 아이콘은 ping 한 번에 기대 다시 넣기와 경쟁한다. 이를 시험하지 않는다

**파일:** `src/entrypoints/background.ts:55-89`, `tests/e2e/blank-popup.e2e.ts:332-358`
**문제:** `document.open()`으로 문서를 다시 쓰면 옛 인스턴스는 `onMessage` 리스너를 떼고, 새 인스턴스는 frame/reinject → `executeScript` 왕복 뒤에야 site/ping에 답한다. 그 사이에 `onUpdated`(complete)나 `onActivated`로 `updateActionForTab`이 돌면 수신자 없음으로 곧바로 실패한다. 그러면 탭이 "도울 수 없음"으로 표시되고, 다음 활성화나 이동 전까지 그대로 남는다. ping에는 재시도가 없고, 겹친 두 호출은 순서 보장 없이 마지막에 끝난 쪽이 이긴다. 제목과 배지가 서로 다른 호출 값으로 섞일 수도 있다. 아이콘 제목 시험은 DOM 새 창(`openDomPopup`)만 보고, 쓰기 새 창(`openWritePopup`)과 editor-frames의 맨 위 다시 쓰기는 보지 않는다.
**수정:** ping 실패 시 짧은 간격(예: 250ms × 3)으로 다시 확인한다. 탭별 세대 번호로 늦게 끝난 옛 호출의 결과를 버린다. 새 인스턴스가 시작할 때 맨 위에서 SW에 "준비됨"을 알려 `updateActionForTab`을 다시 부르게 하는 방법도 있다. `openWritePopup` 탭에 대해 `expect.poll(tabTitle).toBe('손 떨림 도우미')`를 추가한다.

### WR-07: 자식 프레임의 자석·머무르기·스페이스바 기록은 `local:<전체 URL>` framePath로 저장되어 번호 순서에 영영 쓰이지 않는다. URL 전체(질의 문자열 포함)가 저장소에 남는다

**파일:** `src/entrypoints/content.ts:197-204, 325, 716, 731`
**문제:** `hint-order.ts:62`는 `isSameElement(p.fingerprint, item.fingerprint)`로 기록을 찾는다. 이 함수는 framePath가 완전히 같아야 점수를 준다(`fingerprint.ts:13`). 번호표 항목의 framePath는 composeTree가 만든 경로이고, `local:${location.href}`와는 절대 같지 않다. 그래서 자식 프레임 안에서 자석·머무르기·스페이스바로 누른 기록은 D-11(자주 누른 순서)에 전혀 반영되지 않는다. 그런 기록은 200개 상한만 채운다. 또 `location.href`에 세션 토큰이나 캐시 무효화 질의가 붙으면 매번 새 항목이 된다. 사내 업무 시스템 주소의 질의 문자열(문서 번호·토큰 등)이 `chrome.storage.local`에 그대로 쌓이는 것도 문제다.
**수정:** 최소한 `location.origin + location.pathname`만 쓴다. 근본적으로는 맨 위가 composeTree로 아는 정확한 경로를 자식에 방송한다(frames/reports 수신 뒤 hints/state처럼 `frame/path` 방송). 그러면 자식이 직접 누른 경우에도 번호표 경로와 같은 framePath로 기록된다. 그 전까지 `local:` 기록은 보내지 않는 편이 낫다(쓰이지 않는 데이터).

### WR-08: "나옴" 상태에서 편집기가 keydown으로 직접 처리하는 편집(Enter·Backspace·Tab·Ctrl+B 등)은 막히지 않는다

**파일:** `src/page/input/pipeline.ts:128-178, 349-362`
**문제:** 나옴 상태의 편집 차단은 `beforeinput`의 `preventDefault()`뿐이다(355-358행). CKEditor 4·SmartEditor 2 같은 사내 편집기는 Enter(문단 나누기), Backspace·Delete(블록 병합), Tab, 서식 단축키를 **keydown 처리기에서 직접 DOM을 고쳐** 처리한다. 이 경우 `beforeinput`이 아예 뜨지 않는다. 파이프라인 keydown은 도우미 키가 아니면 통과시킨다(169-178행). 그래서 모드 표시가 "도우미"인 채로 문서가 바뀐다. 01-18 SUMMARY가 약속한 "모드 표시가 도우미인데 글자가 조용히 들어가는 일이 없게"와 어긋난다. doc-editor.e2e.ts는 designMode 기본 편집(`beforeinput`이 뜨는 경로)만 시험한다.
**수정:** 나옴 상태이고 `isDocumentEditingRoot(deepActiveElement())`이면, 도우미 키 처리기가 쓰지 않은 keydown도 편집 키(Enter·Backspace·Delete·Tab, Ctrl/Meta 조합)이면 `preventDefault()`와 `stopImmediatePropagation()`으로 삼킨다. 편집기 keydown 처리기를 흉내 낸 fixture(keydown에서 Enter를 가로채 `<p>`를 넣음)로 RED 시험을 먼저 만든다.

## Info

### IN-01: `setSiteDisabled`는 본문 `tabId`를 믿고, 보낸 쪽이 메뉴(확장 페이지)인지 확인하지 않는다

**파일:** `src/entrypoints/background.ts:241-259`
**문제:** origin은 대상 탭의 실제 출처와 대조하므로 사이트 정체는 위조되지 않는다. 다만 아무 content script(다른 탭)도 `tabId`를 바꿔 다른 탭 사이트를 끄고 켤 수 있다. 페이지는 runtime 메시지를 보낼 수 없어 지금 위협은 렌더러 침해 수준뿐이다.
**수정:** `if (sender.tab !== undefined) { sendResponse({ ok: false, reason: 'origin-mismatch' }); return true; }`처럼 확장 페이지에서 온 요청만 받는다.

### IN-02: `frameStates`는 탭이 닫히거나 이동해도 지우지 않고, 옛 인스턴스 정리도 false를 보고하지 않는다. 시험 오라클이 낡을 수 있다

**파일:** `src/entrypoints/background.ts:29-30, 355-365`, `src/entrypoints/content.ts:1173-1249`
**문제:** 다시 넣기가 실패하면 그 frameId에는 옛 true가 남는다. 사라진 프레임의 항목도 남는다. `blank-popup.e2e.ts:437-445`나 `site-toggle.e2e.ts`의 "every enabled" 폴링이 낡은 true로 통과할 수 있다. 제품 기능에는 영향이 없다.
**수정:** `tabs.onRemoved`/`loading`에서 `delete frameStates[tabId]`를 한다. 시험은 frameId 집합과 함께 판정한다.

### IN-03: `inheritedSiteOrigin`은 출처만 받아 경로 접두어가 있는 스토어 규칙(`chrome.google.com/webstore`, `microsoftedge.microsoft.com/addons`)을 적용할 수 없다

**파일:** `src/core/unsupported-url.ts:62-68`
**문제:** `isUnsupportedUrl(documentOrigin)`의 pathname은 항상 `/`라서 두 규칙은 절대 걸리지 않는다. Chrome이 그 스토어에서 연 about: 창에 주입하지 않으면 실제 피해는 없다. 다만 단위 시험이 "스토어 출처는 null"을 이 두 호스트로 확인하지 않는다.
**수정:** 두 호스트는 about: 상속 판정에서 호스트 단위로 거절하거나, 한계를 주석과 단위 시험으로 남긴다.

### IN-04: 시험 전용 훅이 프로덕션 SW 전역에 노출된다

**파일:** `src/entrypoints/background.ts:30, 142-164`
**문제:** `frameStates`·`disconnectAlivePorts`·`resetRelayForE2E`·`failSiteQueryForE2E`는 프로덕션 빌드에도 들어간다. 페이지는 닿지 못하지만 SW 개발자 도구에서 `failSiteQueryForE2E(1e9)` 한 줄로 모든 자식 프레임을 끌 수 있고, 제품 코드에 시험 분기가 섞여 있다.
**수정:** `import.meta.env.MODE !== 'production'` 같은 빌드 조건으로 감싸거나, e2e 전용 빌드 플래그로만 등록한다. 기존 관례라 이번 범위 밖이면 백로그로 남긴다.

### 참고(새 결함 아님)

D-25 결정(7d6b593: 설정이 깨져도 "도우미 끄기"는 항상 된다)은 아직 구현되지 않았다. 지금은 `storage-writer.ts:363-366`이 `preserved-original`로 거절하고 메뉴가 되돌린다. "즉시 끌 수 있음" 안전 요구의 알려진 공백이다. 사용자 결정대로 머지 직후 `/gsd-quick`으로 처리할 항목이며, ship 판단 때 함께 본다.

---

_리뷰 시각: 2026-09-26T06:30:34Z_
_리뷰어: Claude (gsd-code-reviewer)_
_깊이: deep_
