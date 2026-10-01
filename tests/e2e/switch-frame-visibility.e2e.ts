import { test, expect } from './fixtures';
import { chooseSwitch, startSwitch } from './switch-helpers';

for (const change of ['hidden', 'inert', 'clipped', 'partially-clipped'] as const) {
  test(`a child confirmation cannot execute after its parent becomes ${change}`, async ({ context, serviceWorker, servePage }) => {
    await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
    servePage('http://practice.test/frame-visibility.html', '<div id="container"><iframe src="http://other.test/child-visibility.html"></iframe></div>');
    servePage('http://other.test/child-visibility.html', '<button style="margin-top:50px" onclick="document.querySelector(\'output\').textContent=\'1\'">삭제</button><output>0</output>');
    const page = await context.newPage();
    await page.goto('http://practice.test/frame-visibility.html');
    await expect(page.frameLocator('iframe').locator('button')).toBeVisible();
    await startSwitch(page);
    await chooseSwitch(page, '페이지 항목');
    await chooseSwitch(page, '삭제');
    await page.locator('#container').evaluate((el, change) => {
      if (change === 'clipped') el.setAttribute('style', 'width:0;height:0;overflow:hidden');
      else if (change === 'partially-clipped') el.setAttribute('style', 'height:20px;overflow:hidden');
      else el.setAttribute(change, '');
    }, change);
    const panel = page.locator('tremor-helper-root').locator('.switch-panel');
    await expect(panel).toHaveAttribute('data-mode', 'paused');
    await page.keyboard.press('Space');
    await expect(panel).toHaveAttribute('data-mode', 'groupScan');
    await chooseSwitch(page, '페이지 항목');
    await expect(panel.getByText('삭제', { exact: true })).toHaveCount(0);
    await expect(page.frameLocator('iframe').locator('output')).toHaveText('0');
  });
}
