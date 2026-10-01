import { test, expect } from './fixtures';
import { chooseSwitch, startSwitch } from './switch-helpers';

test.beforeEach(async ({ serviceWorker }) => {
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
});

test('a snapshot link whose meaning changes cannot execute the old choice', async ({ context, servePage }) => {
  servePage('http://practice.test/changed.html', '<a href="#read" onclick="document.querySelector(\'output\').textContent=\'1\'">읽기</a><output>0</output>');
  const page = await context.newPage();
  await page.goto('http://practice.test/changed.html');
  await startSwitch(page);
  await chooseSwitch(page, '페이지 항목');
  await page.locator('a').evaluate((el) => { el.textContent = '삭제'; });
  await chooseSwitch(page, '읽기');
  await expect(page.locator('output')).toHaveText('0');
  await expect(page.locator('tremor-helper-root').locator('.switch-status')).toContainText('바뀌');
});

test('confirmation expires without consent and resuming cannot resurrect it', async ({ context, servePage }) => {
  servePage('http://practice.test/confirm-switch.html', '<button onclick="document.querySelector(\'output\').textContent=\'1\'">삭제</button><output>0</output>');
  const page = await context.newPage();
  await page.goto('http://practice.test/confirm-switch.html');
  await startSwitch(page);
  await chooseSwitch(page, '페이지 항목');
  await chooseSwitch(page, '삭제');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await expect(panel).toHaveAttribute('data-mode', 'confirming');
  await expect(panel).toHaveAttribute('data-mode', 'paused', { timeout: 15000 });
  await page.keyboard.press('Space');
  await expect(panel).toHaveAttribute('data-mode', 'groupScan');
  await expect(page.locator('output')).toHaveText('0');
});

test('mode changes cancel an open confirmation and require a new selection after resume', async ({ context, serviceWorker, servePage }) => {
  servePage('http://practice.test/mode-confirm.html', '<button onclick="document.querySelector(\'output\').textContent=\'1\'">삭제</button><output>0</output>');
  const page = await context.newPage();
  await page.goto('http://practice.test/mode-confirm.html');
  await startSwitch(page);
  await chooseSwitch(page, '페이지 항목');
  await chooseSwitch(page, '삭제');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await expect(panel).toHaveAttribute('data-mode', 'confirming');
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'pointer', intervalMs: 800, protectionMs: 100 } }));
  await expect(panel).toHaveCount(0);
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
  await expect(panel).toHaveAttribute('data-mode', 'paused');
  await page.keyboard.press('Space');
  await expect(panel).toHaveAttribute('data-mode', 'groupScan');
  await expect(page.locator('output')).toHaveText('0');
});

test('entry input and an early press cannot confirm, and a new release executes exactly once', async ({ context, servePage }) => {
  servePage('http://practice.test/guard-switch.html', '<button onclick="document.querySelector(\'output\').textContent=String(Number(document.querySelector(\'output\').textContent)+1)">삭제</button><output>0</output>');
  const page = await context.newPage();
  await page.goto('http://practice.test/guard-switch.html');
  await startSwitch(page);
  await chooseSwitch(page, '페이지 항목');
  await chooseSwitch(page, '삭제');
  await page.keyboard.press('Space');
  await expect(page.locator('output')).toHaveText('0');
  const current = page.locator('tremor-helper-root').locator('.switch-choice[aria-current="true"]');
  await expect.poll(() => current.textContent(), { timeout: 15000, intervals: [100] }).toBe('삭제');
  await page.keyboard.down('Space');
  await page.waitForTimeout(1000);
  await expect(page.locator('output')).toHaveText('0');
  await page.keyboard.up('Space');
  await expect(page.locator('output')).toHaveText('1');
  await page.keyboard.up('Space');
  await expect(page.locator('output')).toHaveText('1');
});
