import { test, expect } from './fixtures';
import { chooseSwitch, startSwitch } from './switch-helpers';
import type { Page, Worker } from '@playwright/test';

const field = `<label>문장<input id="field" value="원래 값"></label><script>document.querySelector('input').setSelectionRange(0,4,'backward');window.inputs=0;window.changes=0;document.addEventListener('input',()=>window.inputs++);document.addEventListener('change',()=>window.changes++);</script>`;
const panel = (page: Page) => page.locator('tremor-helper-root').locator('.switch-panel');
async function apply(page: Page) {
  await startSwitch(page); await chooseSwitch(page, '글쓰기'); await chooseSwitch(page, '양식 한 장 보기'); await chooseSwitch(page, '문장');
  await chooseSwitch(page, '문구'); await chooseSwitch(page, '새 값'); await chooseSwitch(page, '입력칸에 적용');
}
async function holdUndo(worker: Worker, mode: 'delivery' | 'reply') {
  await worker.evaluate(mode => {
    const send = chrome.tabs.sendMessage.bind(chrome.tabs);
    const held = { ready: false, finished: false, release: null as (() => void) | null };
    (globalThis as typeof globalThis & { undoHeld: typeof held }).undoHeld = held;
    chrome.tabs.sendMessage = async (tabId, message, options) => {
      if (typeof message === 'object' && message !== null && 'action' in message && typeof message.action === 'object' && message.action !== null && 'kind' in message.action && message.action.kind === 'undoText') {
        held.ready = true;
        if (mode === 'delivery') await new Promise<void>(resolve => { held.release = resolve; });
        try { const reply = await send(tabId, message, options); return mode === 'reply' ? { result: 'unknown' } : reply; }
        finally { held.finished = true; }
      }
      return send(tabId, message, options);
    };
  }, mode);
}
test.beforeEach(async ({ serviceWorker, servePage }) => {
  await serviceWorker.evaluate(() => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 }, switchPhrases: ['새 값'] }));
  servePage('http://practice.test/undo', field);
  servePage('http://other.test/undo', field);
  servePage('http://other.test/new-undo', '<body data-new="yes">' + field);
  servePage('http://practice.test/frame-undo', '<input id="parent" value="부모 값"><iframe id="child" style="width:400px;height:200px" src="http://other.test/undo"></iframe>');
});
test.afterEach(({ expectNoExternalRequests }) => { expectNoExternalRequests(); });

test('explicit undo previews both values, cancels, then restores only once without saving form history', async ({ context, serviceWorker }) => {
  test.setTimeout(120000); const page = await context.newPage(); await page.goto('http://practice.test/undo'); await apply(page);
  await expect(page.locator('#field')).toHaveValue('새 값'); await chooseSwitch(page, '적용한 값 되돌리기');
  await expect(panel(page).locator('.switch-draft')).toContainText('현재 입력값'); await expect(panel(page).locator('.switch-draft')).toContainText('새 값');
  await chooseSwitch(page, '다음 비교 읽기'); await expect(panel(page).locator('.switch-draft')).toContainText('원래 값');
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const metrics = await panel(page).evaluate(el => ({ right: el.getBoundingClientRect().right, bottom: el.getBoundingClientRect().bottom, choices: Array.from(el.querySelectorAll('.switch-choice')).map(choice => ({ height: choice.getBoundingClientRect().height, font: parseFloat(getComputedStyle(choice).fontSize) })) }));
    expect(metrics.right).toBeLessThanOrEqual(width); expect(metrics.bottom).toBeLessThanOrEqual(800);
    for (const choice of metrics.choices) { expect(choice.height).toBeGreaterThanOrEqual(56); expect(choice.font).toBeGreaterThanOrEqual(18); }
  }
  await chooseSwitch(page, '취소'); await expect(page.locator('#field')).toHaveValue('새 값');
  await chooseSwitch(page, '적용한 값 되돌리기'); await chooseSwitch(page, '확인 · 적용한 값 되돌리기');
  await expect(page.locator('#field')).toHaveValue('원래 값'); await expect(panel(page).locator('.switch-draft')).toHaveText('원래 값');
  expect(await page.locator('#field').evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd, el.selectionDirection])).toEqual([0, 4, 'backward']);
  await chooseSwitch(page, '적용한 값 되돌리기'); await expect(panel(page)).toContainText('방금 적용한 값이 없어요');
  expect(await page.evaluate(() => { const w = window as Window & { inputs?: number; changes?: number }; return [w.inputs, w.changes]; })).toEqual([2, 2]);
  const stored = await serviceWorker.evaluate(async () => JSON.stringify([await chrome.storage.local.get(null), await chrome.storage.session.get(null)]));
  expect(stored).not.toContain('원래 값'); expect(stored).not.toContain('undoToken');
});

for (const boundary of ['value', 'node', 'reattached', 'sensitive']) {
  test(`undo confirmation rejects changed ${boundary} without restoring or firing events`, async ({ context }) => {
    test.setTimeout(90000); const page = await context.newPage(); await page.goto('http://practice.test/undo'); await apply(page); await chooseSwitch(page, '적용한 값 되돌리기');
    await page.locator('#field').evaluate((el: HTMLInputElement, boundary) => {
      if (boundary === 'value') el.value = '사이트 값';
      if (boundary === 'node') { const replacement = el.cloneNode(true) as HTMLInputElement; replacement.value = el.value; el.replaceWith(replacement); }
      if (boundary === 'reattached') { el.remove(); document.body.append(el); }
      if (boundary === 'sensitive') el.autocomplete = 'one-time-code';
    }, boundary);
    await chooseSwitch(page, '확인 · 적용한 값 되돌리기'); await expect(page.locator('#field')).toHaveValue(boundary === 'value' ? '사이트 값' : '새 값');
    await expect(panel(page)).toContainText('다시 확인');
    expect(await page.evaluate(() => { const w = window as Window & { inputs?: number; changes?: number }; return [w.inputs, w.changes]; })).toEqual([1, 1]);
  });
}

test('cross-origin field undo restores only the selected child and preserves its parent', async ({ context }) => {
  test.setTimeout(90000); const page = await context.newPage(); await page.goto('http://practice.test/frame-undo'); await expect(page.frameLocator('#child').locator('#field')).toBeVisible(); await apply(page);
  await chooseSwitch(page, '적용한 값 되돌리기'); await chooseSwitch(page, '확인 · 적용한 값 되돌리기');
  await expect(page.frameLocator('#child').locator('#field')).toHaveValue('원래 값'); await expect(page.locator('#parent')).toHaveValue('부모 값');
  expect(await page.frameLocator('#child').locator('body').evaluate(() => { const w = window as Window & { inputs?: number; changes?: number }; return [w.inputs, w.changes]; })).toEqual([2, 2]);
});

for (const boundary of ['pause', 'frame-navigation', 'frame-replacement']) {
  test(`pending cross-origin undo is not delivered after ${boundary}`, async ({ context, serviceWorker }) => {
    test.setTimeout(90000); const page = await context.newPage(); await page.goto('http://practice.test/frame-undo'); await expect(page.frameLocator('#child').locator('#field')).toBeVisible(); await apply(page);
    await chooseSwitch(page, '적용한 값 되돌리기'); await holdUndo(serviceWorker, 'delivery'); await chooseSwitch(page, '확인 · 적용한 값 되돌리기');
    await expect.poll(() => serviceWorker.evaluate(() => (globalThis as typeof globalThis & { undoHeld: { ready: boolean } }).undoHeld.ready)).toBe(true);
    if (boundary === 'pause') await page.keyboard.press('Space');
    else { await page.locator('#child').evaluate((el: HTMLIFrameElement, boundary) => { if(boundary==='frame-navigation')el.src='http://other.test/new-undo';else{const next=el.cloneNode(false) as HTMLIFrameElement;next.src='http://other.test/new-undo';el.replaceWith(next);} },boundary); await expect(page.frameLocator('#child').locator('body')).toHaveAttribute('data-new', 'yes'); }
    await expect(panel(page)).toHaveAttribute('data-mode', 'paused');
    await serviceWorker.evaluate(() => (globalThis as typeof globalThis & { undoHeld: { release: (() => void) | null } }).undoHeld.release?.());
    await expect.poll(() => serviceWorker.evaluate(() => (globalThis as typeof globalThis & { undoHeld: { finished: boolean } }).undoHeld.finished)).toBe(true);
    await expect(page.frameLocator('#child').locator('#field')).toHaveValue(boundary === 'pause' ? '새 값' : '원래 값');
    expect(await page.frameLocator('#child').locator('body').evaluate(() => { const w = window as Window & { inputs?: number; changes?: number }; return [w.inputs, w.changes]; })).toEqual(boundary === 'pause' ? [1, 1] : [0, 0]);
  });
}

test('lost undo acknowledgement pauses and never repeats the successful mutation', async ({ context, serviceWorker }) => {
  test.setTimeout(90000); const page = await context.newPage(); await page.goto('http://practice.test/undo'); await apply(page);
  await chooseSwitch(page, '적용한 값 되돌리기'); await holdUndo(serviceWorker, 'reply'); await chooseSwitch(page, '확인 · 적용한 값 되돌리기');
  await expect(panel(page)).toHaveAttribute('data-mode', 'paused'); await expect(page.locator('#field')).toHaveValue('원래 값');
  await page.keyboard.press('Space'); await page.waitForTimeout(125); await chooseSwitch(page, '적용한 값 되돌리기');
  await expect(panel(page)).not.toHaveAttribute('data-mode', 'confirming');
  expect(await page.evaluate(() => { const w = window as Window & { inputs?: number; changes?: number }; return [w.inputs, w.changes]; })).toEqual([2, 2]);
});
