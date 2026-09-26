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

  // hints/state:true 방송이 자식 프레임(초점이 있는 #frame-design)에 닿을 시간을 준다 — 그래야
  // 자식의 childHintsVisible이 true가 되어 Esc를 삼켜 hints/key로 보낸다(editor-frames.e2e.ts의
  // pressFUntilLabels·frames.e2e.ts 관례와 같은 이유의 짧은 대기).
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await expect.poll(() => hintLabelCount(page)).toBe(0);
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
