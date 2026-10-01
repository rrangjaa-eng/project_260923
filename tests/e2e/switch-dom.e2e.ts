import { test, expect } from './fixtures';
import { chooseSwitch, startSwitch } from './switch-helpers';

for (const width of [360, 768, 1280]) {
  test(`switch choices remain visible and labelled at ${String(width)}px`, async ({ context, serviceWorker, servePage }, testInfo) => {
    await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
    servePage('http://practice.test/switch-dom.html', Array.from({ length: 7 }, (_, i) => `<a href="#${String(i)}">항목 ${String(i)}</a>`).join('') + '<main style="height:5000px">읽기</main>');
    const page = await context.newPage();
    await page.setViewportSize({ width, height: 720 });
    await page.goto('http://practice.test/switch-dom.html');
    await startSwitch(page);
    await chooseSwitch(page, '페이지 항목');
    const panel = page.locator('tremor-helper-root').locator('.switch-panel');
    await expect(panel).toHaveAttribute('aria-label', '스페이스바 작업판');
    await expect(panel.getByRole('listitem')).toHaveCount(10);
    await expect.poll(() => panel.locator('[aria-current="true"]').textContent(), { timeout: 15000, intervals: [100] }).toBe('쉬기');
    const measured = await panel.evaluate((panel) => {
      const choice = panel.querySelector('[aria-current="true"]');
      const p = panel.getBoundingClientRect(), c = choice?.getBoundingClientRect();
      const style = choice ? getComputedStyle(choice) : null;
      return { panel: { x: p.x, y: p.y, right: p.right, bottom: p.bottom }, choice: c ? { top: c.top, bottom: c.bottom, height: c.height } : null,
        fontSize: Number.parseFloat(style?.fontSize ?? '0'), scrollY: window.scrollY,
        uniqueIds: new Set(Array.from(panel.querySelectorAll('[data-item-id]'), (el) => (el as HTMLElement).dataset.itemId)).size };
    });
    expect(measured.panel.x).toBeGreaterThanOrEqual(0);
    expect(measured.panel.right).toBeLessThanOrEqual(width);
    expect(measured.panel.bottom).toBeLessThanOrEqual(720);
    expect(measured.choice?.top).toBeGreaterThanOrEqual(measured.panel.y);
    expect(measured.choice?.bottom).toBeLessThanOrEqual(measured.panel.bottom);
    expect(measured.choice?.height).toBeGreaterThanOrEqual(48);
    expect(measured.fontSize).toBeGreaterThanOrEqual(15);
    expect(measured.uniqueIds).toBe(10);
    expect(measured.scrollY).toBe(0);
    await testInfo.attach('switch-dom-measurements', { body: JSON.stringify(measured), contentType: 'application/json' });
    await testInfo.attach('switch-panel', { body: await page.screenshot(), contentType: 'image/png' });
  });
}
