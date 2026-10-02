import { test, expect } from './fixtures';
import { chooseSwitch, startSwitch } from './switch-helpers';
test.beforeEach(async ({ serviceWorker }) => {
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
});
test('a Space-selected back request stays cancelled after focus-loss rest', async ({ context, serviceWorker, servePage }) => {
  test.setTimeout(80000);
  servePage('http://practice.test/nav-first.html', '<title>첫 페이지</title><p>첫 페이지</p>');
  servePage('http://practice.test/nav-second.html', '<title>둘째 페이지</title><p>둘째 페이지</p>');
  const page = await context.newPage(); await page.goto('http://practice.test/nav-first.html'); await page.goto('http://practice.test/nav-second.html'); await startSwitch(page); await chooseSwitch(page, '읽기·이동');
  await serviceWorker.evaluate(() => {
    const query = chrome.tabs.query.bind(chrome.tabs);
    const state = globalThis as typeof globalThis & { navWaiting?: boolean; releaseNav?: () => void };
    chrome.tabs.query = async info => {
      if (Object.keys(info).length === 0 && !state.navWaiting) { state.navWaiting = true; await new Promise<void>(resolve => { state.releaseNav = resolve; }); }
      return query(info);
    };
  });
  await chooseSwitch(page, '뒤로'); await expect.poll(() => serviceWorker.evaluate(() => (globalThis as typeof globalThis & { navWaiting?: boolean }).navWaiting)).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('tremor-helper-root').locator('.switch-panel')).toHaveAttribute('data-mode', 'paused');
  await serviceWorker.evaluate(() => { (globalThis as typeof globalThis & { releaseNav?: () => void }).releaseNav?.(); });
  await page.waitForTimeout(500); await expect(page).toHaveURL('http://practice.test/nav-second.html');
});
test('closing the source tab while another tab ping is delayed cannot activate that target', async ({ context, serviceWorker, servePage }) => {
  test.setTimeout(100000);
  servePage('http://practice.test/nav-target.html', '<title>이동 대상</title><p>이동 대상</p>');
  servePage('http://practice.test/nav-stay.html', '<title>남을 탭</title><p>남을 탭</p>');
  servePage('http://practice.test/nav-source.html', '<title>출발 탭</title><p>출발 탭</p>');
  const target = await context.newPage(); await target.goto('http://practice.test/nav-target.html');
  const stay = await context.newPage(); await stay.goto('http://practice.test/nav-stay.html');
  const source = await context.newPage(); await source.goto('http://practice.test/nav-source.html'); await source.bringToFront(); await startSwitch(source); await chooseSwitch(source, '읽기·이동'); await chooseSwitch(source, '열린 탭');
  await serviceWorker.evaluate(() => {
    const send = chrome.tabs.sendMessage.bind(chrome.tabs);
    const state = globalThis as typeof globalThis & { navWaiting?: boolean; releaseNav?: () => void; navActivations?: number };
    state.navActivations = 0;
    const update = chrome.tabs.update.bind(chrome.tabs);
    chrome.tabs.update = async (tabId, changes) => { if (changes.active) state.navActivations = (state.navActivations ?? 0) + 1; return update(tabId, changes); };
    chrome.tabs.sendMessage = async (tabId, message, options) => {
      if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'site/ping') { state.navWaiting = true; await new Promise<void>(resolve => { state.releaseNav = resolve; }); }
      return send(tabId, message, options);
    };
  });
  await chooseSwitch(source, '이동 대상'); await expect.poll(() => serviceWorker.evaluate(() => (globalThis as typeof globalThis & { navWaiting?: boolean }).navWaiting)).toBe(true);
  await source.close(); await stay.bringToFront();
  await serviceWorker.evaluate(() => { (globalThis as typeof globalThis & { releaseNav?: () => void }).releaseNav?.(); });
  await stay.waitForTimeout(500);
  expect(await serviceWorker.evaluate(() => (globalThis as typeof globalThis & { navActivations?: number }).navActivations)).toBe(0);
});
test('fresh Space stops a pending back request and release never resumes or replays it', async ({ context, serviceWorker, servePage }) => {
  test.setTimeout(80000);
  servePage('http://practice.test/nav-first.html', '<title>첫 페이지</title><p>첫 페이지</p>');
  servePage('http://practice.test/nav-second.html', '<title>둘째 페이지</title><p>둘째 페이지</p>');
  const page = await context.newPage(); await page.goto('http://practice.test/nav-first.html'); await page.goto('http://practice.test/nav-second.html'); await startSwitch(page); await chooseSwitch(page, '읽기·이동');
  await serviceWorker.evaluate(() => {
    const query = chrome.tabs.query.bind(chrome.tabs);
    const state = globalThis as typeof globalThis & { navWaiting?: boolean; releaseNav?: () => void };
    chrome.tabs.query = async info => {
      if (Object.keys(info).length === 0 && !state.navWaiting) { state.navWaiting = true; await new Promise<void>(resolve => { state.releaseNav = resolve; }); }
      return query(info);
    };
  });
  await chooseSwitch(page, '뒤로'); await expect.poll(() => serviceWorker.evaluate(() => (globalThis as typeof globalThis & { navWaiting?: boolean }).navWaiting)).toBe(true);
  await page.keyboard.down('Space');
  await page.keyboard.up('Space');
  await expect(page.locator('tremor-helper-root').locator('.switch-panel')).toHaveAttribute('data-mode', 'paused');
  await serviceWorker.evaluate(() => { (globalThis as typeof globalThis & { releaseNav?: () => void }).releaseNav?.(); });
  await page.waitForTimeout(500); await expect(page).toHaveURL('http://practice.test/nav-second.html');
  await expect(page.locator('tremor-helper-root').locator('.switch-panel')).toHaveAttribute('data-mode','paused');
  await page.keyboard.press('Space');await page.waitForTimeout(125);
  await expect(page).toHaveURL('http://practice.test/nav-second.html');
  await expect(page.locator('tremor-helper-root').locator('.switch-panel')).toHaveAttribute('data-mode','itemScan');
});
