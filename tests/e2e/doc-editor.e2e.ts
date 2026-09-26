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

// behavior 5(가능할 때만): CDP 조합 입력(가)이 이 샌드박스에서 trusted compositionstart를 만드는지
// 실측으로 확인했다(SUMMARY 참고) — 만든다. 표시와 실제 입력이 어긋나지 않게 입력으로 돌아간다.
test('#frame-design에서 Esc로 나온 뒤 CDP 조합 입력을 보내면 입력 중으로 돌아가고 본문에 들어간다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/doc-editor.html');

  const text = page.frameLocator('#frame-design').locator('#doc-text');
  await text.click();
  await expect.poll(() => dataMode(page)).toBe('typing');

  await page.keyboard.press('Escape');
  await expect.poll(() => dataMode(page), { timeout: 2000 }).toBe('helper');

  const before = await elementText(page, '#frame-design', '#doc-text');

  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: '가', selectionStart: 1, selectionEnd: 1 });
  await expect.poll(() => dataMode(page)).toBe('typing');

  await cdp.send('Input.insertText', { text: '가' });
  await expect.poll(async () => (await elementText(page, '#frame-design', '#doc-text')).length).toBe(before.length + 1);
});

// CR-01(01-REVIEW.md): 한글 IME가 켜진 채 도우미 키(F)를 누르면 Chrome은 keydown을 keyCode
// 229(Process)로 보낸다 — event.code는 물리 키(KeyF) 그대로라 도우미 키 처리기는 F로 인식해
// 번호표를 연다. IME가 이미 받은 키는 keydown 취소로 되돌릴 수 없어(Chrome/Windows 알려진
// 동작), 곧바로 compositionstart가 뜬다 — 이건 사용자가 다시 입력하려는 의도적 신호가 아니라
// F 키 자체가 조합으로 잘못 들어간 것이다. 입력 복귀 신호로 보면 안 된다(번호표가 열린 채
// 문서가 오염되면 안 된다).
test('#frame-design에서 나온 상태로 F(번호표 열기)를 누른 직후 바로 뜨는 조합 시작은 입력 복귀 신호가 아니다(CR-01)', async ({
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

  await expect.poll(() => dataMode(page)).toBe('helper');
  expect(
    await elementText(page, '#frame-design', '#doc-text'),
    '번호표를 연 F가 조합으로 문서에 들어가면 안 된다',
  ).toBe(before);
});
