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

// CR-01(01-REVIEW-FIX.md iteration 3→4, 사용자 결정): innerHTML 스냅숏 복원(63d8eff)은 노드
// 정체성·선택·되돌리기를 파괴해 원래 결함보다 해로웠다 — 되돌렸다. iteration 3의 "커서 숨기기"
// (선택 범위만 저장·해제, 초점은 편집 루트에 그대로 둠)는 트러스트된 키 이벤트마다 Chrome이 지운
// 선택을 되살려 CDP IME 조합을 막지 못했다(실측, iteration 3 REVIEW-FIX.md). iteration 4부터는
// "초점 옮기기"로 바꿨다 — Esc로 나올 때 선택 범위를 저장·해제하고, 초점 자체를 도우미 오버레이의
// 비편집 tabindex=-1 요소(mode.ts escapeDocumentEditor → mode-indicator.ts getFocusSink)로 옮긴다.
// 복귀 신호는 Esc 다시 누름·편집기 누름·다른 요소로 focusin 세 가지뿐이다(한글 조합 시작은
// iteration 3에서 이미 뺐다, 사용자 결정).
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

  // iteration 3에서는 escapeDocumentEditor()가 초점을 편집 루트에 그대로 두어, 실제 신뢰된
  // (trusted) 키 이벤트가 초점 있는 편집 가능 영역에 닿으면 Chrome이 지운 선택을 스스로 되살렸다
  // (실측). iteration 4부터는 초점 자체를 오버레이 focusSink로 옮기므로 이 되살아남 자체가
  // 일어나지 않는다(runFocusShiftCompositionScenario의 CDP 조합·확정 시험이 이를 직접 단언한다).
  // 이 시험은 조합 없이 순수 Esc→Esc-다시 흐름만 보므로, 여기서는 우리가 늘 통제하는 불변(문서·
  // 노드는 안 바뀜, 아래 Esc 다시 누르면 저장한 캐럿으로 강제 복원됨)만 단언한다.
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

// CR-01 iteration 4(초점 옮기기, 사용자 결정): iteration 3의 "커서 숨기기"(선택 해제, 초점은
// 편집 루트에 그대로 둠)는 CDP 조합 시험을 "우리가 실제로 통제하는 불변만" 단언하도록 일부러
// 완화해야 했다 — 실측(뮤테이션 확인)으로 트러스트된 키 이벤트가 초점 있는 편집 가능 영역에 닿으면
// Chrome이 지운 선택을 스스로 되살려, CDP Input.imeSetComposition·insertText가 편집 루트 시작
// 위치에 실제로 글자를 삽입할 수 있었기 때문이다(iteration 3 REVIEW-FIX.md 실측 로그). 이 시험은
// 나올 때 초점 자체를 도우미 오버레이의 비편집 tabindex=-1 요소로 옮기는 새 구현을 겨냥한다 —
// spike 실측(scratchpad/spike-ime, designMode·contenteditable 모두, 5/5): 이 요소로 초점을 옮기면
// CDP 조합·확정 시도가 편집 루트·이 요소 어디에도 글자를 넣지 못한다. 세 편집기 모양
// (#frame-design·#frame-cebody·01-17 #frame-editor) 모두에서 (a) 문서 텍스트 불변 (b) 편집 루트
// 자식 노드 동일성 (c) 모드는 도우미 유지 (d) F 도우미 키 동작(번호표) (e) Esc 다시 누름 뒤 캐럿
// 오프셋 복원을 단언한다. iteration 3의 "커서 숨기기" 코드에서는 (a)가 실패한다(RED, 실제 실행으로
// 확인 — REVIEW-FIX.md iteration 4 절 참고).
async function runFocusShiftCompositionScenario(page: Page, frameSelector: string, textSelector: string): Promise<void> {
  const text = page.frameLocator(frameSelector).locator(textSelector);
  await text.click();
  await expect.poll(() => dataMode(page)).toBe('typing');

  // 캐럿을 첫 글자 뒤(오프셋 1)에 둔다 — 세 practice 페이지 fixture 모두 #doc-text/#editor-text의
  // 첫 글자 문자열 길이가 1 이상이라 유효한 오프셋이다.
  await page.frameLocator(frameSelector).locator(textSelector).evaluate((el) => {
    const doc = el.ownerDocument;
    const sel = doc.getSelection();
    const range = doc.createRange();
    range.setStart(el.firstChild as Node, 1);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
  });
  await markNodeIdentity(page, frameSelector, textSelector);
  const before = await elementText(page, frameSelector, textSelector);

  await page.keyboard.press('Escape');
  await expect.poll(() => dataMode(page), { timeout: 2000 }).toBe('helper');

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: '가', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.insertText', { text: '가' }); // 조합 확정까지 시도한다
  await flushEvents(page);

  // (a) 문서 텍스트 불변.
  expect(await elementText(page, frameSelector, textSelector), 'CDP 조합·확정 시도로 문서가 바뀌면 안 된다').toBe(before);
  // (b) 편집 루트 자식 노드 동일성 — 스냅숏 복원 회귀 방지.
  expect(
    await nodeIdentityPreserved(page, frameSelector, textSelector),
    '편집 루트 자식 노드가 통째로 교체되면 안 된다(스냅숏 복원 회귀 방지)',
  ).toBe(true);
  // (c) 모드는 도우미로 유지.
  expect(await dataMode(page), '조합 시도가 입력 복귀 신호가 되면 안 된다').toBe('helper');

  // (d) F 도우미 키는 여전히 동작한다(번호표가 열린다).
  await page.keyboard.press('KeyF');
  await expect.poll(() => hintLabelCount(page)).toBeGreaterThan(0);
  // 번호표를 닫는다 — Esc 첫 번째는 번호표를 닫을 뿐 입력으로 돌아가지 않는다(고정 sleep 대신 조건
  // 재시도, editor-frames.e2e.ts findHintNumberFor와 같은 규칙).
  await expect
    .poll(async () => {
      await page.keyboard.press('Escape');
      return hintLabelCount(page);
    }, { timeout: 3000 })
    .toBe(0);
  await expect.poll(() => dataMode(page)).toBe('helper');

  // D-07(떨림 필터): 다음 Escape 전에 tremorIntervalMs(기본 300ms)만큼 기다린다.
  await page.waitForTimeout(350);
  // (e) Esc를 다시 누르면 저장한 캐럿 자리로 복원되며 입력으로 돌아간다.
  await page.keyboard.press('Escape');
  await expect.poll(() => dataMode(page)).toBe('typing');
  expect(await caretOffset(page, frameSelector, textSelector), '캐럿 오프셋이 나오기 전과 같아야 한다').toBe(1);
  expect(
    await nodeIdentityPreserved(page, frameSelector, textSelector),
    '복귀 뒤에도 편집 루트 자식 노드가 같아야 한다',
  ).toBe(true);
}

test('#frame-design에서 초점 옮기기로 CDP 조합·확정이 막히고 노드·모드·도우미 키·캐럿 복원이 모두 유지된다(CR-01 iteration 4)', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/doc-editor.html');
  await runFocusShiftCompositionScenario(page, '#frame-design', '#doc-text');
});

test('#frame-cebody(다른 출처, contenteditable 본문)에서도 초점 옮기기로 CDP 조합·확정이 막힌다(CR-01 iteration 4)', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/doc-editor.html');
  await runFocusShiftCompositionScenario(page, '#frame-cebody', '#doc-text');
});

test('01-17 #frame-editor(document.write + designMode)에서도 초점 옮기기로 CDP 조합·확정이 막힌다(CR-01 iteration 4)', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/editor-frames.html');
  await runFocusShiftCompositionScenario(page, '#frame-editor', '#editor-text');
});

// DOM감사-4(독립 DOM 감사): focus sink(mode-indicator.ts getFocusSink)에 aria-hidden을 쓰면
// 초점을 받는 요소를 숨기는 접근성 반패턴이 된다 — 대신 현재 상태를 말하는 접근 가능한 이름
// (모드 표시와 같은 용어 "도우미")을 주고, 보이는 포커스 링은 outline: none으로 막는다(상태는
// 이미 모드 표시가 보여 준다).
// mode.ts의 escapeDocumentEditor()는 편집 루트가 속한 프레임 자신의 document(그 프레임의
// content script 인스턴스)에서 실행된다 — 초점 대상 focus sink도 그 프레임 자신의
// tremor-helper-root 안에 있다(맨 위 페이지의 tremor-helper-root와는 다른 인스턴스). 그래서
// contentFrame()으로 그 프레임 자신의 document를 evaluate해야 한다(dom-audit 감사 스크립트
// sinkState와 같은 방식).
async function focusSinkInfo(
  page: Page,
  frameSelector: string,
): Promise<{ role: string | null; ariaLabel: string | null; ariaHidden: string | null; outlineStyle: string; tag: string } | null> {
  const handle = await page.locator(frameSelector).elementHandle();
  const frame = await handle.contentFrame();
  if (!frame) {
    throw new Error(`프레임을 찾지 못했다: ${frameSelector}`);
  }
  return frame.evaluate(() => {
    const root = document.querySelector('tremor-helper-root')?.shadowRoot;
    const active = root?.activeElement as HTMLElement | null | undefined;
    if (!active) {
      return null;
    }
    const cs = getComputedStyle(active);
    return {
      role: active.getAttribute('role'),
      ariaLabel: active.getAttribute('aria-label'),
      ariaHidden: active.getAttribute('aria-hidden'),
      outlineStyle: cs.outlineStyle,
      tag: active.tagName,
    };
  });
}

test('#frame-design에서 Esc로 나오면 focus sink가 aria-hidden 없이 접근 가능한 이름을 갖고 포커스 링이 보이지 않는다(DOM감사-4)', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/doc-editor.html');

  const text = page.frameLocator('#frame-design').locator('#doc-text');
  await text.click();
  await expect.poll(() => dataMode(page)).toBe('typing');

  await page.keyboard.press('Escape');
  await expect.poll(() => dataMode(page), { timeout: 2000 }).toBe('helper');

  const sink = await focusSinkInfo(page, '#frame-design');
  expect(sink, '초점이 오버레이의 focus sink로 옮겨져 있어야 한다').not.toBeNull();
  expect(sink?.ariaHidden, '초점을 받는 요소를 aria-hidden으로 숨기면 안 된다(접근성 반패턴)').toBeNull();
  // /review 사용자 결정: role="application"은 이 요소가 스크린리더 탐색 모드 밖에서 키 입력을
  // 전부 가로챈다는 뜻까지 전달해 과했다 — 이름 있는 묶음이라는 뜻의 "group"으로 바꾼다.
  expect(sink?.role).toBe('group');
  expect(sink?.ariaLabel, '모드 표시와 같은 용어를 쓴다').toBe('도우미');
  expect(sink?.outlineStyle, '상태는 모드 표시로 이미 보이니 포커스 링은 보이지 않게 막는다').toBe('none');
});

// F1·F2(/review 사용자 결정): 복귀 규칙은 하나뿐이다 — 초점이 focus sink를 떠나면(편집 루트로
// 돌아온 focusin 포함) 무조건 입력 중으로 복귀한다. 예전에는 pointerdown에서 곧바로 복귀시켜서,
// 자석·떨림 필터가 그 누름을 대신 처리하거나 거절해 초점이 실제로는 안 옮겨져도 나옴 표시가
// 먼저 풀렸다(표시=입력 중, 실제 초점=focus sink인 채 갇힘). 이제는 실제 focusin이 있을 때만
// 복귀한다.
test('F1: 나옴 상태에서 떨림 필터가 같은 자리 재누름을 거절해도 나옴 표시가 먼저 풀리지 않고, Esc가 계속 동작한다', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/doc-editor.html');

  const text = page.frameLocator('#frame-design').locator('#doc-text');
  const box = await text.boundingBox();
  if (!box) {
    throw new Error('편집기 좌표를 찾지 못했다');
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.click(x, y);
  await expect.poll(() => dataMode(page)).toBe('typing');

  await page.keyboard.press('Escape');
  await expect.poll(() => dataMode(page), { timeout: 2000 }).toBe('helper');

  // 같은 자리를 떨림 간격(기본 300ms, D-07) 안에 다시 눌러 이번 누름을 필터가 거절하게 한다
  // (input-filter.e2e.ts와 같은 기존 시험 도구 재사용) — 거절된 누름은 초점을 옮기지 못한다.
  await page.mouse.click(x, y);
  expect(await dataMode(page), '거절된 누름이 나옴 표시를 먼저 풀면 안 된다(초점은 그대로 focus sink)').toBe(
    'helper',
  );

  // D-07(떨림 필터): 같은 키(Escape)도 tremorIntervalMs(기본 300ms) 안의 재입력을 걸러낸다 —
  // 첫 Escape와 겹치지 않도록 다른 시험들과 같은 관례로 그 간격만큼 기다린다.
  await page.waitForTimeout(350);
  // 나옴 표시가 미리 풀리지 않았어야 Esc를 다시 눌러 입력으로 돌아갈 수 있다 — 미리 풀렸다면
  // (버그) escaped가 이미 false라 이 Esc는 아무 일도 하지 않는다.
  await page.keyboard.press('Escape');
  await expect.poll(() => dataMode(page), { timeout: 2000 }).toBe('typing');
});

test('F2: 나옴 상태에서 사이트 스크립트가 편집 루트에 직접 .focus()하면 입력 중으로 복귀한다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/doc-editor.html');

  const text = page.frameLocator('#frame-design').locator('#doc-text');
  await text.click();
  await expect.poll(() => dataMode(page)).toBe('typing');

  await page.keyboard.press('Escape');
  await expect.poll(() => dataMode(page), { timeout: 2000 }).toBe('helper');

  // 편집기 누름·Esc 다시 누름이 아니라, 사이트 스크립트가 직접 편집 루트에 초점을 준다(예:
  // editor.focus()) — 이것도 복귀 신호로 봐야 한다(예전에는 이 경우를 focusin 처리기가 일부러
  // 뺐다).
  await page.frameLocator('#frame-design').locator('#doc-text').evaluate((el) => {
    el.ownerDocument.body.focus();
  });

  await expect.poll(() => dataMode(page), { timeout: 2000 }).toBe('typing');
});

// 사용자 결정(/review): 나옴 상태에서 Tab을 삼키면 focus sink를 벗어날 길이 없다 — pipeline.ts의
// EDITING_KEYCODES에서 Tab을 뺐다(Shift+Tab 포함, 둘 다 물리 키 code는 'Tab'이다). focus sink는
// 도우미 호스트가 documentElement 맨 끝에 붙어(D-26) 문서 순서상 항상 맨 뒤다 — Tab(앞으로)은 갈
// 다음 대상이 없어 브라우저가 초점을 비운다(실측, Chromium이 이 경우 focusin 자체를 안 쏜다.
// "삼키지 않았다"는 sink에 갇히지 않았음으로 본다). Shift+Tab(뒤로)은 sink 바로 앞(문서 순서)의
// 실제 탭 대상으로 넘어가며 실제 focusin이 뜬다 — 그 요소에 맞는 모드가 되는지까지 확인한다.
test('나옴 상태에서 Tab·Shift+Tab을 삼키지 않고 초점이 focus sink를 벗어난다(Tab 통과)', async ({ context, servePage }) => {
  servePage(
    'http://practice.test/tab-pass-editor.html',
    '<!doctype html><body style="margin:0" contenteditable="true" id="doc-text">ab<input id="next-input" /></body>',
  );

  const page = await context.newPage();
  await page.goto('http://practice.test/tab-pass-editor.html');

  const text = page.locator('#doc-text');
  await text.click();
  await expect.poll(() => dataMode(page)).toBe('typing');

  await page.keyboard.press('Escape');
  await expect.poll(() => dataMode(page), { timeout: 2000 }).toBe('helper');

  await page.keyboard.press('Tab');
  await expect
    .poll(
      () => page.evaluate(() => document.querySelector('tremor-helper-root')?.shadowRoot?.activeElement !== null),
      'Tab이 삼켜지면 초점이 focus sink에 그대로 남는다',
    )
    .toBe(false);

  // D-07(떨림 필터): Tab·Shift+Tab은 물리 키 code가 같은 'Tab'이라 재입력 간격을 걸러낸다 — 다른
  // 시험들과 같은 관례로 그 간격만큼 기다린다.
  await page.waitForTimeout(350);

  await page.keyboard.press('Shift+Tab');
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.id ?? null), 'Shift+Tab이 삼켜지면 초점이 옮겨가지 않는다')
    .toBe('next-input');
  await expect.poll(() => dataMode(page)).toBe('typing');
});

// 오케스트레이터 후속 지적(CR-01 구멍 재발 가능성): 위 "Tab 통과" 시험이 확인한 실측(정방향 Tab은
// focus sink가 문서 순서상 맨 뒤라 갈 다음 대상이 없어 브라우저가 focusin 없이 조용히 초점을
// 비운다)에는 빈틈이 있다 — focusin이 안 뜨면 escaped 표시가 안 풀려 그대로 "도우미"로 남는데,
// designMode·contenteditable 문서에서는 이때 실제 document.activeElement가 편집 루트(body)가
// 되어 문서 전체가 다시 편집 가능한 상태다. (a) 모드 표시가 실제 초점(입력 중)과 일치해야 하고,
// (b) 안전망으로 그 상태에서 CDP 조합·삽입 시도로 문서가 바뀌었다면 표시는 반드시 "입력 중"이어야
// 한다(표시=도우미인데 조합이 문서를 바꾸면 CR-01이 애초에 막으려던 결함의 재발이다).
async function runForwardTabGapScenario(page: Page, frameSelector: string, textSelector: string): Promise<void> {
  const text = page.frameLocator(frameSelector).locator(textSelector);
  await text.click();
  await expect.poll(() => dataMode(page)).toBe('typing');

  await page.keyboard.press('Escape');
  await expect.poll(() => dataMode(page), { timeout: 2000 }).toBe('helper');

  await page.keyboard.press('Tab');

  // (a) 모드 표시가 실제 초점(편집 루트, 입력 중)과 일치해야 한다.
  await expect
    .poll(() => dataMode(page), { timeout: 2000 })
    .toBe('typing');

  // (b) 안전망: 그 상태에서 CDP 조합·삽입을 시도한다 — 문서가 바뀌었다면 표시는 "입력 중"이어야
  // 한다(위 (a)가 이미 확인했지만, 표시와 실제가 어긋난 채 편집만 조용히 들어가는 경우를 한 번 더
  // 막는다).
  const before = await elementText(page, frameSelector, textSelector);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: '가', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.insertText', { text: '가' });
  await flushEvents(page);

  const after = await elementText(page, frameSelector, textSelector);
  const modeAfter = await dataMode(page);
  if (after !== before) {
    expect(modeAfter, '문서가 바뀌었다면 표시는 입력 중이어야 한다(표시=도우미인데 편집되면 안 된다)').toBe(
      'typing',
    );
  }
}

test('#frame-design(designMode)에서 나옴 → 정방향 Tab → 모드 표시가 실제 초점(입력 중)과 일치한다(CR-01 재발 방지)', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/doc-editor.html');
  await runForwardTabGapScenario(page, '#frame-design', '#doc-text');
});

test('#frame-cebody(contenteditable 본문)에서도 나옴 → 정방향 Tab → 모드 표시가 실제 초점(입력 중)과 일치한다(CR-01 재발 방지)', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/doc-editor.html');
  await runForwardTabGapScenario(page, '#frame-cebody', '#doc-text');
});

// 사용자 결정(/review): 도우미를 끄면 나옴 상태도 함께 풀린다 — 안 그러면 꺼진 동안 편집기를
// 직접 눌러 입력을 재개해도(파이프라인이 관여하지 않아 가능하다) escaped 표시가 남아, 다시 켰을
// 때 beforeinput이 계속 막혀 실제로 입력 중인 편집기에 글자가 들어가지 않는다.
test('나옴 상태에서 도우미를 끄면 나옴 표시가 풀려, 꺼진 동안 재개한 입력을 다시 켠 뒤에도 그대로 받는다', async ({
  context,
  openPopup,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/doc-editor.html');

  const text = page.frameLocator('#frame-design').locator('#doc-text');
  await text.click();
  await expect.poll(() => dataMode(page)).toBe('typing');

  await page.keyboard.press('Escape');
  await expect.poll(() => dataMode(page), { timeout: 2000 }).toBe('helper');

  const popup = await openPopup(page);
  await popup.getByRole('button', { name: '도우미 끄기' }).click();
  await popup.close();

  // 꺼진 동안은 파이프라인이 관여하지 않아 편집기를 직접 눌러 입력을 재개할 수 있다 — 이 시점의
  // 실제 초점은 편집 루트다.
  await text.click();

  const popup2 = await openPopup(page);
  await popup2.getByRole('button', { name: '도우미 켜기' }).click();
  await popup2.close();

  // 다시 켠 뒤에도 이미 편집 루트에 있는 실제 초점 그대로 글자가 들어가야 한다 — 나옴 표시가
  // 꺼짐 동안 풀리지 않으면 escaped 표시가 남아, beforeinput이 계속 막혀 글자가 들어가지 않는다.
  await page.keyboard.type('z');
  await expect.poll(() => elementText(page, '#frame-design', '#doc-text')).toContain('z');
});

// CR-01(01-REVIEW.md): 한글 IME가 켜진 채 도우미 키(F)를 누르면 Chrome은 keydown을 keyCode
// 229(Process)로 보낸다 — event.code는 물리 키(KeyF) 그대로라 도우미 키 처리기는 F로 인식해
// 번호표를 연다. 뒤따르는 조합 시도가 입력 복귀 신호가 되면 안 된다(번호표가 열린 채로 남아야
// 한다). 위 runFocusShiftCompositionScenario와 달리 이 시험은 229/Process 키코드 모양 자체를
// 겨냥한다.
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

  // WR-06(01-REVIEW.md): keydown 처리는 동기라 keyboard.press가 돌아온 시점에 이미 끝나 있다 —
  // 고정 대기가 필요 없다.
  await page.keyboard.press('Enter');

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
