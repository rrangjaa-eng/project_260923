import { test, expect } from './fixtures';
import { chooseSwitch, startSwitch } from './switch-helpers';

test('mouse mode choice explains that the Space task panel ends before the explicit selection', async ({ context, serviceWorker, servePage }) => {
  servePage('http://practice.test/switch-mode.html', '<button onclick="document.querySelector(\'output\').textContent=\'1\'">실행</button><output>0</output>');
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
  const page = await context.newPage();
  await page.goto('http://practice.test/switch-mode.html');
  await startSwitch(page);
  await chooseSwitch(page, '조절·쉬기');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await expect(panel.locator('[data-item-id="pointer"]')).toContainText('스페이스바 작업판 종료');
  await expect.poll(() => serviceWorker.evaluate(async () => { const stored = await chrome.storage.local.get('switchSettings') as { switchSettings: { mode: string } }; return stored.switchSettings.mode; })).toBe('switch');
  await chooseSwitch(page, '마우스 조작으로 전환 · 스페이스바 작업판 종료');
  await expect.poll(() => serviceWorker.evaluate(async () => { const stored = await chrome.storage.local.get('switchSettings') as { switchSettings: { mode: string } }; return stored.switchSettings.mode; })).toBe('pointer');
  await expect(panel).toHaveCount(0);
  await expect(page.locator('output')).toHaveText('0');
});
