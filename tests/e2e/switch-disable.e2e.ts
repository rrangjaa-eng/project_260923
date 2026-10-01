import { test, expect } from './fixtures';
import { chooseSwitch, startSwitch } from './switch-helpers';

for (const scope of ['global', 'site'] as const) {
  test(`${scope} disable stops automatic scroll and resumes only after a new Space release`, async ({ context, serviceWorker, servePage }) => {
    await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
    servePage('http://practice.test/disable.html', '<main style="height:10000px">읽기</main>');
    const page = await context.newPage();
    await page.goto('http://practice.test/disable.html');
    await startSwitch(page);
    await chooseSwitch(page, '읽기·이동');
    await chooseSwitch(page, '자동 스크롤');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const setEnabled = async (enabled: boolean) => {
      await serviceWorker.evaluate(async ({ scope, enabled }) => {
        if (scope === 'site') await chrome.storage.sync.set({ 'site:http://practice.test': { schemaVersion: 1, data: { disabled: !enabled, pins: [] } } });
        else {
          const { settings } = await chrome.storage.sync.get('settings') as { settings: { data: Record<string, unknown> } };
          await chrome.storage.sync.set({ settings: { ...settings, data: { ...settings.data, enabled } } });
        }
      }, { scope, enabled });
    };
    await setEnabled(false);
    await expect(page.locator('tremor-helper-root')).toHaveCount(0);
    const stopped = await page.evaluate(() => window.scrollY);
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.scrollY)).toBe(stopped);
    await setEnabled(true);
    const panel = page.locator('tremor-helper-root').locator('.switch-panel');
    await expect(panel).toHaveAttribute('data-mode', 'paused');
    await page.keyboard.down('Space');
    await expect(panel).toHaveAttribute('data-mode', 'paused');
    await page.keyboard.up('Space');
    await expect(panel).toHaveAttribute('data-mode', 'groupScan');
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.scrollY)).toBe(stopped);
  });
}
