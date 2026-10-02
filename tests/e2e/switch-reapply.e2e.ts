import { test, expect } from './fixtures';
import { chooseSwitch, startSwitch } from './switch-helpers';
test.beforeEach(async ({ serviceWorker }) => {
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
});
const html = `<form onsubmit="window.submits++;return false"><label>문장<input id="field" value="처음"></label><button>제출</button></form><script>document.querySelector('input').setSelectionRange(2,2);window.inputs=0;window.changes=0;window.submits=0;document.addEventListener('input',()=>window.inputs++);document.addEventListener('change',()=>window.changes++);</script>`;
test('Space compares a changed value, cancels without writing, then explicitly reapplies once', async ({ context, servePage, serviceWorker, expectNoExternalRequests }) => {
  test.setTimeout(150000); servePage('http://practice.test/reapply.html', html);
  const page = await context.newPage(); await page.goto('http://practice.test/reapply.html'); await startSwitch(page);
  await chooseSwitch(page, '글쓰기'); await chooseSwitch(page, '양식 한 장 보기'); await chooseSwitch(page, '문장'); await chooseSwitch(page, '띄어쓰기');
  await page.locator('#field').evaluate((el: HTMLInputElement) => { el.value = '사이트 변경'; });
  await chooseSwitch(page, '입력칸에 적용'); await expect(page.locator('#field')).toHaveValue('사이트 변경');
  await chooseSwitch(page, '현재 값과 비교');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await expect(panel).toHaveAttribute('data-mode', 'confirming'); await expect(panel.locator('.switch-draft')).toContainText('사이트 변경');
  await page.waitForTimeout(1100); await chooseSwitch(page, '취소'); await expect(page.locator('#field')).toHaveValue('사이트 변경');
  await expect(panel.locator('.switch-draft')).toHaveText('처음 ');
  await chooseSwitch(page, '현재 값과 비교'); await chooseSwitch(page, '다음 비교 읽기'); await expect(panel.locator('.switch-draft')).toContainText('처음 ');
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const metrics = await panel.evaluate(el => ({ right: el.getBoundingClientRect().right, bottom: el.getBoundingClientRect().bottom, previewFits: (el.querySelector('.switch-draft')?.scrollHeight ?? 0) <= (el.querySelector('.switch-draft')?.clientHeight ?? 0), choices: Array.from(el.querySelectorAll('.switch-choice')).map(choice => ({ height: choice.getBoundingClientRect().height, font: parseFloat(getComputedStyle(choice).fontSize) })) }));
    expect(metrics.right).toBeLessThanOrEqual(width); expect(metrics.bottom).toBeLessThanOrEqual(800); expect(metrics.previewFits).toBe(true);
    for (const choice of metrics.choices) { expect(choice.height).toBeGreaterThanOrEqual(56); expect(choice.font).toBeGreaterThanOrEqual(18); }
  }
  await chooseSwitch(page, '확인 · 입력칸에 적용'); await expect(page.locator('#field')).toHaveValue('처음 ');
  expect(await page.evaluate(() => { const w = window as Window & { inputs?: number; changes?: number; submits?: number }; return [w.inputs, w.changes, w.submits]; })).toEqual([1, 1, 0]);
  const stored = await serviceWorker.evaluate(async () => JSON.stringify({ local: await chrome.storage.local.get(null), session: await chrome.storage.session.get(null) }));
  expect(stored).not.toContain('사이트 변경'); expectNoExternalRequests();
});
test('Space confirmation refuses a second page change and rest cancels the comparison', async ({ context, servePage }) => {
  test.setTimeout(120000); servePage('http://practice.test/reapply-stale.html', html);
  const page = await context.newPage(); await page.goto('http://practice.test/reapply-stale.html'); await startSwitch(page);
  await chooseSwitch(page, '글쓰기'); await chooseSwitch(page, '양식 한 장 보기'); await chooseSwitch(page, '문장'); await chooseSwitch(page, '띄어쓰기');
  await chooseSwitch(page, '현재 값과 비교'); await page.locator('#field').evaluate((el: HTMLInputElement) => { el.value = '더 최신 값'; });
  await chooseSwitch(page, '확인 · 입력칸에 적용'); await expect(page.locator('#field')).toHaveValue('더 최신 값');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel'); await expect(panel.locator('.switch-draft')).toHaveText('처음 ');
  await chooseSwitch(page, '현재 값과 비교'); await chooseSwitch(page, '쉬기'); await page.keyboard.press('Space'); await page.waitForTimeout(125);
  await expect(panel.locator('[data-item-id="reapply-commit"]')).toHaveCount(0); await expect(page.locator('#field')).toHaveValue('더 최신 값');
  expect(await page.evaluate(() => (window as Window & { inputs?: number }).inputs)).toBe(0);
});
