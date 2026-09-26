import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

// Task 3(01-18, KEY-01): 문서 전체가 편집 가능한 편집기(designMode 문서, contenteditable 본문 —
// src= iframe·01-17의 document.write 편집기 모두)에서 Esc를 누르면 편집기를 깨뜨리지 않고 모드
// 표시가 도우미가 된다. 그동안 글자는 편집기에 들어가지 않고 F 같은 도우미 키가 동작한다. 편집기를
// 다시 누르면 입력 중으로 돌아가 글자가 다시 들어간다. 연습 페이지는 tests/practice-site/doc-editor
// .html(D-28), 01-17이 만든 editor-frames.html #frame-editor(document.write + designMode)도 함께
// 확인한다.

async function dataMode(page: Page): Promise<string | null> {
  return page.evaluate(() => document.querySelector('tremor-helper-root')?.getAttribute('data-mode') ?? null);
}

// body.textContent가 아니라 본문 글자 요소 하나만 읽는다 — 자식 문서의 <body> 안 <script> 원본
// 소스도 body.textContent에 그대로 섞여(브라우저 표준 동작) 임의의 글자를 포함하고 있어 잘못된
// 신호를 준다. doc-editor.html은 #doc-text, 01-17의 editor-frames.html #frame-editor는
// #editor-text를 쓴다.
async function elementText(page: Page, frameSelector: string, textSelector: string): Promise<string> {
  return page.frameLocator(frameSelector).locator(textSelector).evaluate((el) => el.textContent);
}

async function hintLabelCount(page: Page): Promise<number> {
  return page.evaluate(
    () => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelectorAll('.hint-label').length ?? 0,
  );
}

// 세 편집기 모양(src= designMode, 다른 출처 contenteditable 본문, 01-17 document.write designMode)
// 모두 같은 결과를 내야 한다 — 공통 시나리오를 도우미로 둔다.
async function runDocEditorEscScenario(page: Page, frameSelector: string, textSelector: string): Promise<void> {
  const text = page.frameLocator(frameSelector).locator(textSelector);
  await text.click();
  await expect.poll(() => dataMode(page)).toBe('typing');

  await page.keyboard.type('ab');
  await expect.poll(() => elementText(page, frameSelector, textSelector)).toContain('ab');

  await page.keyboard.press('Escape');
  await expect.poll(() => dataMode(page), { timeout: 2000 }).toBe('helper');

  const beforeX = await elementText(page, frameSelector, textSelector);
  await page.keyboard.type('x');
  await page.waitForTimeout(200);
  expect(await elementText(page, frameSelector, textSelector), '나온 상태에서는 글자가 편집기에 들어가면 안 된다').toBe(
    beforeX,
  );
  expect(beforeX).not.toContain('x');

  // 편집기를 다시 누르면 입력 중으로 돌아간다.
  await text.click();
  await expect.poll(() => dataMode(page)).toBe('typing');

  await page.keyboard.type('y');
  await expect.poll(() => elementText(page, frameSelector, textSelector)).toContain('y');
}

test('#frame-design(src=, 같은 출처, designMode) — Esc → 도우미, 편집 막힘, 다시 누르면 입력', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/doc-editor.html');
  await runDocEditorEscScenario(page, '#frame-design', '#doc-text');
});

test('#frame-cebody(다른 출처, contenteditable 본문) — Esc → 도우미, 편집 막힘, 다시 누르면 입력', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/doc-editor.html');
  await runDocEditorEscScenario(page, '#frame-cebody', '#doc-text');
});

test('01-17 #frame-editor(document.write + designMode) — Esc → 도우미, 편집 막힘, 다시 누르면 입력', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/editor-frames.html');
  await runDocEditorEscScenario(page, '#frame-editor', '#editor-text');
});

test('#frame-design에서 Esc로 나온 뒤 F를 누르면 번호표가 뜨고(도우미 키 동작), 본문 글자는 바뀌지 않는다', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/doc-editor.html');

  const text = page.frameLocator('#frame-design').locator('#doc-text');
  await text.click();
  await expect.poll(() => dataMode(page)).toBe('typing');

  await page.keyboard.press('Escape');
  await expect.poll(() => dataMode(page), { timeout: 2000 }).toBe('helper');

  const before = await elementText(page, '#frame-design', '#doc-text');
  await page.keyboard.press('KeyF');
  await expect.poll(() => hintLabelCount(page)).toBeGreaterThan(0);
  const afterF = await elementText(page, '#frame-design', '#doc-text');
  expect(afterF, 'F는 편집기 글자로 들어가면 안 된다(번호표가 열려야 한다)').toBe(before);

  // hints/state:true 방송이 자식 프레임(초점이 있는 #frame-design)에 닿아야 자식의
  // childHintsVisible이 true가 되어 Esc를 삼켜 hints/key로 보낸다 — 고정 sleep 대신, 안 닫히면
  // 다시 눌러 보는 조건 재시도(editor-frames.e2e.ts findHintNumberFor와 같은 규칙).
  await expect
    .poll(
      async () => {
        await page.keyboard.press('Escape');
        return hintLabelCount(page);
      },
      { timeout: 3000 },
    )
    .toBe(0);
});

// CR-01(01-REVIEW.md 2회차, 사용자 결정): innerHTML 스냅숏 복원(63d8eff)은 노드 정체성·선택·
// 되돌리기를 파괴해 원래 결함보다 해로웠다 — 되돌리고 "커서 숨기기" 방식으로 바꿨다. Esc로 나올
// 때 선택 범위를 저장·해제하고(초점은 그대로, DOM은 건드리지 않음), 복귀 신호에서 한글 조합
// 시작을 뺐다(선택이 없으면 IME가 조합을 시작하지 않을 것으로 예상 — 실측 필요, 아래 별도 표시).
// 복귀 신호는 이제 Esc 다시 누름·편집기 누름·다른 요소로 focusin 세 가지뿐이다.
async function markNodeIdentity(page: Page, frameSelector: string, textSelector: string): Promise<void> {
  await page.frameLocator(frameSelector).locator(textSelector).evaluate((el) => {
    (window as unknown as { __crMark?: Node }).__crMark = el;
  });
}
async function nodeIdentityPreserved(page: Page, frameSelector: string, textSelector: string): Promise<boolean> {
  return page
    .frameLocator(frameSelector)
    .locator(textSelector)
    .evaluate((el) => (window as unknown as { __crMark?: Node }).__crMark === el);
}
async function caretOffset(page: Page, frameSelector: string, textSelector: string): Promise<number> {
  return page
    .frameLocator(frameSelector)
    .locator(textSelector)
    .evaluate((el) => {
      const sel = el.ownerDocument.getSelection();
      if (!sel || sel.rangeCount === 0) return -1;
      return sel.getRangeAt(0).startOffset;
    });
}
// 고정 waitForTimeout 대신 rAF 두 번으로 브라우저가 保류 중인 이벤트(조합 시도 등)를 처리할
// 시간을 준다 — 조건이 없는 "아무 일도 안 일어남" 단언에 필요한 최소한의 플러시.
async function flushEvents(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      }),
  );
}

// 결정적(비-CDP) 시험 — Esc가 선택을 저장·해제하고, Esc를 다시 누르면 정확히 그 자리로 복원한다.
// mode.ts의 escapeDocumentEditor/resumeDocumentEditor만 실제로 검증한다(조합 없음).
test('#frame-design에서 Esc로 나오면 선택 범위가 지워지고, Esc를 다시 누르면 저장한 캐럿 자리로 복원된다(CR-01)', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/doc-editor.html');

  const text = page.frameLocator('#frame-design').locator('#doc-text');
  await text.click();
  await expect.poll(() => dataMode(page)).toBe('typing');

  // 캐럿을 "가나" 사이(오프셋 1)에 둔다.
  await page.frameLocator('#frame-design').locator('#doc-text').evaluate((el) => {
    const doc = el.ownerDocument;
    const sel = doc.getSelection();
    const range = doc.createRange();
    range.setStart(el.firstChild as Node, 1);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
  });
  await markNodeIdentity(page, '#frame-design', '#doc-text');
  const before = await elementText(page, '#frame-design', '#doc-text');

  await page.keyboard.press('Escape');
  await expect.poll(() => dataMode(page), { timeout: 2000 }).toBe('helper');

  // 실측(뮤테이션 확인 로그): escapeDocumentEditor() 안에서 sel.removeAllRanges() 직후에는
  // rangeCount가 0이지만, 실제 신뢰된(trusted) 키 이벤트가 초점 있는 편집 가능 영역에 닿으면
  // Chrome이 짧은 시간 안에(수백 ms) 선택을 스스로 되살린다(Escape뿐 아니라 ArrowLeft·Shift
  // 단독으로도 재현됨 — 이 시험 파일 작성 중 뮤테이션으로 확인, 우리 코드와 무관한 Chrome 내부
  // 동작). 그래서 "Esc 뒤 rangeCount===0"을 지속 상태로 단언하면 타이밍에 따라 flaky하고, 실제로
  // 거짓이다 — 여기서는 단언하지 않는다(REVIEW-FIX.md에 사람 확인 항목으로 남긴다). 대신 우리가
  // 실제로 통제하는 불변(문서·노드는 안 바뀜, 아래 Esc 다시 누르면 저장한 캐럿으로 강제 복원됨)만
  // 단언한다.
  expect(await elementText(page, '#frame-design', '#doc-text'), 'Esc만으로 문서가 바뀌면 안 된다').toBe(before);
  expect(
    await nodeIdentityPreserved(page, '#frame-design', '#doc-text'),
    '편집 루트 자식 노드가 통째로 교체되면 안 된다(스냅숏 복원 회귀 방지)',
  ).toBe(true);

  // D-07(떨림 필터): 같은 키(Escape)는 tremorIntervalMs(기본 300ms) 안의 재입력을 걸러낸다 —
  // 다른 시험(drag.e2e.ts 등)과 같은 관례로 그 간격만큼 기다린 뒤 다시 누른다.
  await page.waitForTimeout(350);
  // Esc를 다시 누르면 저장한 캐럿 자리로 복원되며 입력으로 돌아간다.
  await page.keyboard.press('Escape');
  await expect.poll(() => dataMode(page)).toBe('typing');
  expect(await caretOffset(page, '#frame-design', '#doc-text'), '캐럿 오프셋이 나오기 전과 같아야 한다').toBe(1);
  expect(
    await nodeIdentityPreserved(page, '#frame-design', '#doc-text'),
    '복귀 뒤에도 편집 루트 자식 노드가 같아야 한다',
  ).toBe(true);
});

// CDP 조합 시험 — 실측 한계가 있다(REVIEW.md 판정 1 "검증 방법" 참고). Chrome DevTools Protocol의
// Input.imeSetComposition은 실제 OS IME와 달리 선택(Selection)이 비어 있어도 편집 루트 시작
// 위치에 조합 문자를 강제로 삽입하는 것을 이 샌드박스에서 실측으로 확인했다(rangeCount 0인 상태로
// imeSetComposition을 보내면 rangeCount가 1로 바뀌고 문서 맨 앞에 글자가 들어간다) — 그래서
// "선택이 없으면 IME가 조합을 시작하지 않는다"는 가정을 CDP로는 증명도 반증도 완전히 할 수 없다.
// 이 시험은 우리가 실제로 통제하는 불변(모드가 조합으로 입력 상태로 튀지 않는다, 편집 루트 노드
// 자체가 통째로 교체되지 않는다)만 자동으로 단언한다. "선택 해제가 실제 IME 조합 자체를 막는지"는
// Windows + MS 한국어 입력기로 사람이 확인해야 한다(REVIEW-FIX.md에 별도 항목으로 남긴다).
test('#frame-design에서 Esc로 나온 뒤 조합을 시도해도 입력 복귀 신호가 되지 않고 편집 루트 노드가 교체되지 않는다(CR-01, CDP 한계 있음)', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/doc-editor.html');

  const text = page.frameLocator('#frame-design').locator('#doc-text');
  await text.click();
  await expect.poll(() => dataMode(page)).toBe('typing');

  await page.keyboard.press('Escape');
  await expect.poll(() => dataMode(page), { timeout: 2000 }).toBe('helper');
  await markNodeIdentity(page, '#frame-design', '#doc-text');

  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: '가', selectionStart: 1, selectionEnd: 1 });
  await flushEvents(page);

  expect(await dataMode(page), '선택이 없으면 조합 시도가 입력 복귀 신호가 되면 안 된다').toBe('helper');
  expect(
    await nodeIdentityPreserved(page, '#frame-design', '#doc-text'),
    '편집 루트 자식 노드가 통째로 교체되면 안 된다(스냅숏 복원 회귀 방지) — CDP가 문서에 강제로 글자를 넣더라도 노드 자체는 그대로여야 한다',
  ).toBe(true);
});

// CR-01(01-REVIEW.md): 한글 IME가 켜진 채 도우미 키(F)를 누르면 Chrome은 keydown을 keyCode
// 229(Process)로 보낸다 — event.code는 물리 키(KeyF) 그대로라 도우미 키 처리기는 F로 인식해
// 번호표를 연다. 뒤따르는 조합 시도가 입력 복귀 신호가 되면 안 된다(번호표가 열린 채로 남아야
// 한다). 문서 오염 자체의 CDP 한계는 위 시험과 같다.
test('#frame-design에서 나온 상태로 F(번호표 열기)를 누른 직후 조합을 시도해도 입력 복귀 신호가 아니다(CR-01)', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/doc-editor.html');

  const text = page.frameLocator('#frame-design').locator('#doc-text');
  await text.click();
  await expect.poll(() => dataMode(page)).toBe('typing');

  await page.keyboard.press('Escape');
  await expect.poll(() => dataMode(page), { timeout: 2000 }).toBe('helper');

  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    windowsVirtualKeyCode: 229,
    nativeVirtualKeyCode: 229,
    code: 'KeyF',
    key: 'Process',
  });
  await expect.poll(() => hintLabelCount(page)).toBeGreaterThan(0);

  await cdp.send('Input.imeSetComposition', { text: 'ㄹ', selectionStart: 1, selectionEnd: 1 });
  await flushEvents(page);

  expect(await dataMode(page), '번호표를 연 F 뒤 조합 시도가 입력 복귀 신호가 되면 안 된다').toBe('helper');
  expect(await hintLabelCount(page), '조합 시도로 번호표가 닫히면 안 된다').toBeGreaterThan(0);
});

// WR-08(01-REVIEW.md): "나옴" 상태의 편집 차단은 beforeinput 취소뿐이다 — CKEditor 4·SmartEditor 2
// 같은 사내 편집기는 Enter·Backspace·Tab 같은 키를 keydown 처리기에서 직접 DOM을 고쳐 처리한다.
// 이 경우 keydown.preventDefault()가 브라우저 기본 동작(그 자체가 beforeinput을 일으키는 원인)을
// 막아 beforeinput이 아예 뜨지 않는다 — 편집기 keydown 처리기를 흉내 낸 fixture로 재현한다.
test('나옴 상태에서 편집기가 keydown으로 직접 처리하는 Enter는 문서를 바꾸면 안 된다(WR-08)', async ({ context, servePage }) => {
  servePage(
    'http://practice.test/wr08-keydown-editor.html',
    '<!doctype html><body style="margin:0" contenteditable="true" id="doc-text">ab' +
      '<script>' +
      "document.addEventListener('keydown',function(e){" +
      "if(e.code==='Enter'){e.preventDefault();var p=document.createElement('p');p.id='injected-p';document.body.appendChild(p);}" +
      '},true);' +
      '</script>' +
      '</body>',
  );

  const page = await context.newPage();
  await page.goto('http://practice.test/wr08-keydown-editor.html');

  const text = page.locator('#doc-text');
  await text.click();
  await expect.poll(() => dataMode(page)).toBe('typing');

  await page.keyboard.press('Escape');
  await expect.poll(() => dataMode(page), { timeout: 2000 }).toBe('helper');

  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);

  const injectedCount = await page.locator('#injected-p').count();
  expect(injectedCount, '나옴 상태에서 편집기의 keydown 직접 처리로 문서가 바뀌면 안 된다').toBe(0);
});

// WR-01(01-REVIEW.md): WR-08 수정이 나옴 상태에서 Ctrl/Meta 조합을 전부 삼켜 찾기·복사·인쇄·
// 저장·확대까지 막았다 — 편집 가능성이 있는 조합(서식 단축키 등)만 막고, 편집을 일으키지 않는
// 브라우저·사이트 명령(찾기·확대 등)은 허용 목록으로 통과시킨다.
// KeyF는 도우미 자신의 keymap.toggleHints(D-11 기본값)라 Ctrl 여부와 무관하게 번호표 열기
// 처리기가 먼저 소비한다(이 앱의 기존 동작, WR-01과 무관) — 그래서 "편집이 아닌 통과" 예시로는
// 도우미 keymap과 안 겹치는 Ctrl+C(복사)·Ctrl+=(확대)를 쓴다.
test('나옴 상태에서 Ctrl+B(서식) 편집은 막히고, Ctrl+C(복사)·Ctrl+=(확대)는 사이트에 그대로 전달된다(WR-01)', async ({
  context,
  servePage,
}) => {
  servePage(
    'http://practice.test/wr01-ctrl-editor.html',
    '<!doctype html><body style="margin:0" contenteditable="true" id="doc-text">ab' +
      '<script>' +
      "window.__wr01Codes=[];" +
      "document.addEventListener('keydown',function(e){" +
      "window.__wr01Codes.push(e.code);" +
      "if(e.ctrlKey&&e.code==='KeyB'){e.preventDefault();var b=document.createElement('b');b.id='injected-b';document.body.appendChild(b);}" +
      '},true);' +
      '</script>' +
      '</body>',
  );

  const page = await context.newPage();
  await page.goto('http://practice.test/wr01-ctrl-editor.html');

  const text = page.locator('#doc-text');
  await text.click();
  await expect.poll(() => dataMode(page)).toBe('typing');

  await page.keyboard.press('Escape');
  await expect.poll(() => dataMode(page), { timeout: 2000 }).toBe('helper');

  // Ctrl+B(서식, 편집 위험) — 편집기 keydown 처리기에 닿으면 안 된다.
  await page.keyboard.press('Control+B');
  expect(await page.locator('#injected-b').count(), '나옴 상태에서 Ctrl+B가 편집기에 닿으면 안 된다').toBe(0);

  // D-07(떨림 필터): 다음 조합 전에 tremorIntervalMs(기본 300ms)만큼 기다린다(다른 시험과 같은
  // 관례).
  await page.waitForTimeout(350);

  // Ctrl+C(복사, 편집 아님) — 사이트 keydown 리스너에 그대로 도달해야 한다.
  await page.keyboard.press('Control+C');
  expect(
    await page.evaluate(() => (window as unknown as { __wr01Codes: string[] }).__wr01Codes),
    'Ctrl+C는 사이트에 전달돼야 한다',
  ).toContain('KeyC');

  await page.waitForTimeout(350);

  // Ctrl+=(확대, 편집 아님) — 사이트 keydown 리스너에 그대로 도달해야 한다.
  await page.keyboard.press('Control+Equal');
  expect(
    await page.evaluate(() => (window as unknown as { __wr01Codes: string[] }).__wr01Codes),
    'Ctrl+=는 사이트에 전달돼야 한다',
  ).toContain('Equal');
});

// WR-02(01-REVIEW.md): 나옴 상태의 편집 차단은 keydown·beforeinput뿐이었다 — 끌어서 놓기(drop)
// 처럼 키보드를 거치지 않는 경로는 편집기가 직접 문서를 고칠 수 있었다. 오른쪽 클릭 메뉴
// 붙여넣기·잘라내기는 헤드리스 Playwright로 신뢰된(trusted) 이벤트를 재현할 수 없어(브라우저
// 네이티브 컨텍스트 메뉴는 자동화 대상이 아니다) 이 시험 대상에서 뺐다 — REVIEW-FIX.md에 사람
// 확인 항목으로 남긴다. 키보드 경로(Ctrl+V·Shift+Insert)는 WR-01의 Ctrl 차단·EDITING_KEYCODES가
// 이미 막는다(키다운 자체가 삼켜져 붙여넣기 명령이 시작되지 않는다).
//
// 실측(뮤테이션 확인): 실제 마우스 드래그(page.dragAndDrop/locator.dragTo)로는 이 시험을 결정적
// 으로 만들 수 없었다 — 같은 프레임 안에서 끄는 시작점을 누르면 그 pointerdown이 "편집기 누름"
// (mode.ts 편집기 재진입 규칙)으로 해석돼 놓기 전에 이미 입력 모드로 돌아간다. 다른 프레임에서
// 끌어오면 끄는 동안 선택(Selection)이 없어(CR-01 "커서 숨기기") 브라우저 기본 삽입이 애초에
// 안 일어나 우리 방어와 무관하게 항상 통과해 버린다. 그래서 CDP `Input.dispatchDragEvent`로
// dragenter·dragover·drop을 직접 보내(포인터다운을 거치지 않는다) 편집기가 자기 drop 처리기로
// 직접 DOM을 고치는 사내 편집기 흉내 fixture로 재현한다(WR-08과 같은 관례) — 우리 코드가 이
// 이벤트를 window capture에서 멈추면 편집기의 drop 처리기 자체가 불려도 안 된다.
test('나옴 상태에서 편집기가 drop으로 직접 처리하는 붙여넣기는 문서를 바꾸면 안 된다(WR-02)', async ({
  context,
  servePage,
}) => {
  servePage(
    'http://practice.test/wr02-drop-editor.html',
    '<!doctype html><body style="margin:0" contenteditable="true" id="doc-text">ab' +
      '<script>' +
      "document.addEventListener('dragover',function(e){e.preventDefault();},true);" +
      "document.addEventListener('drop',function(e){" +
      'e.preventDefault();' +
      "var p=document.createElement('p');p.id='injected-p';document.body.appendChild(p);" +
      '},true);' +
      '</script>' +
      '</body>',
  );

  const page = await context.newPage();
  await page.goto('http://practice.test/wr02-drop-editor.html');

  const text = page.locator('#doc-text');
  await text.click();
  await expect.poll(() => dataMode(page)).toBe('typing');

  await page.keyboard.press('Escape');
  await expect.poll(() => dataMode(page), { timeout: 2000 }).toBe('helper');

  const box = await text.boundingBox();
  if (!box) {
    throw new Error('WR-02 시험 fixture의 좌표를 읽지 못했다');
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const dragData = { items: [{ mimeType: 'text/plain', data: 'ZZZ' }], dragOperationsMask: 1 };
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchDragEvent', { type: 'dragEnter', x, y, data: dragData });
  await cdp.send('Input.dispatchDragEvent', { type: 'dragOver', x, y, data: dragData });
  await cdp.send('Input.dispatchDragEvent', { type: 'drop', x, y, data: dragData });
  await flushEvents(page);

  expect(await page.locator('#injected-p').count(), '나옴 상태에서 편집기의 drop 직접 처리로 문서가 바뀌면 안 된다').toBe(0);
});
