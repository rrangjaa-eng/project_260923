import { test, expect } from './fixtures';
import { chooseSwitch, startSwitch } from './switch-helpers';

test('child navigation invalidates the input target while preserving its unfinished draft', async ({ context, serviceWorker, servePage }, testInfo) => {
  test.setTimeout(45000);
  servePage('http://practice.test/input-navigation.html', '<iframe src="http://other.test/input-old.html"></iframe>');
  servePage('http://other.test/input-old.html', '<input type="search" aria-label="검색어">');
  servePage('http://other.test/input-new.html', '<input type="search" aria-label="검색어" value="새 사이트 값">');
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 }, switchPhrases: ['안녕'] }));
  await serviceWorker.evaluate(() => {
    const trace: unknown[] = [];
    (globalThis as unknown as { switchNavigationTrace: unknown[] }).switchNavigationTrace = trace;
    chrome.tabs.onUpdated.addListener((_id, change) => { if (change.status) trace.push({ status: change.status }); });
    chrome.runtime.onMessage.addListener((raw: unknown, sender) => {
      if (typeof raw === 'object' && raw !== null && 'type' in raw && raw.type === 'switch/report') trace.push({ frameId: sender.frameId, path: 'path' in raw ? raw.path : null, generation: 'documentGeneration' in raw ? raw.documentGeneration : null });
      return undefined;
    });
  });
  const page = await context.newPage();
  await page.goto('http://practice.test/input-navigation.html');
  await expect(page.frameLocator('iframe').getByRole('searchbox')).toBeVisible();
  await startSwitch(page);
  await chooseSwitch(page, '찾기');
  await chooseSwitch(page, '검색어');
  await chooseSwitch(page, '문구');
  await chooseSwitch(page, '안녕');
  await page.frameLocator('iframe').getByRole('searchbox').evaluate(() => { location.href = '/input-new.html'; });
  await expect(page.frameLocator('iframe').getByRole('searchbox')).toHaveValue('새 사이트 값');
  await page.waitForTimeout(300);
  await testInfo.attach('switch-navigation-trace', { body: JSON.stringify(await serviceWorker.evaluate(() => (globalThis as unknown as { switchNavigationTrace: unknown[] }).switchNavigationTrace)), contentType: 'application/json' });
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await expect(panel).toHaveAttribute('data-mode', 'paused');
  await page.keyboard.press('Space');
  await page.waitForTimeout(125);
  await expect(panel).toHaveAttribute('data-mode', 'groupScan');
  await chooseSwitch(page, '찾기');
  await chooseSwitch(page, '검색어');
  await expect(panel.locator('.switch-draft')).toHaveText('안녕');
  await expect(page.frameLocator('iframe').getByRole('searchbox')).toHaveValue('새 사이트 값');
});

test('an unknown old request cannot borrow the authorization of a new action', async ({ context, serviceWorker, servePage }) => {
  test.setTimeout(45000);
  servePage('http://practice.test/old-authorization.html', '<a href="#first" onclick="document.querySelector(\'#first\').textContent=\'1\'">첫 항목</a><a href="#second" onclick="document.querySelector(\'#second\').textContent=\'1\'">둘째 항목</a><output id="first">0</output><output id="second">0</output>');
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
  const page = await context.newPage();
  await page.goto('http://practice.test/old-authorization.html');
  await startSwitch(page);
  await chooseSwitch(page, '페이지 항목');
  await serviceWorker.evaluate(() => {
    const send = chrome.tabs.sendMessage.bind(chrome.tabs);
    const held = { authorization: null as unknown, releases: [] as Array<() => void> };
    (globalThis as unknown as { heldSwitchRequests: typeof held }).heldSwitchRequests = held;
    chrome.tabs.sendMessage = async (tabId, message, options) => {
      if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'switch/execute') {
        if (held.authorization === null && 'action' in message && typeof message.action === 'object' && message.action !== null && 'authorization' in message.action) held.authorization = message.action.authorization;
        await new Promise<void>((resolve) => held.releases.push(resolve));
      }
      return send(tabId, message, options);
    };
  });
  await chooseSwitch(page, '첫 항목');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await expect(panel).toHaveAttribute('data-mode', 'recovering', { timeout: 5000 });
  await page.keyboard.press('Space');
  await page.waitForTimeout(125);
  await chooseSwitch(page, '둘째 항목');
  await expect(panel).toHaveAttribute('data-mode', 'executing');
  const result = await serviceWorker.evaluate(async (url) => {
    const held = (globalThis as unknown as { heldSwitchRequests: { authorization: unknown; releases: Array<() => void> } }).heldSwitchRequests;
    const tabId = (await chrome.tabs.query({ url }))[0]?.id;
    if (tabId === undefined) throw new Error('missing test tab');
    const result: unknown = await chrome.tabs.sendMessage(tabId, { type: 'switch/action-check', authorization: held.authorization }, { frameId: 0 });
    held.releases.forEach((release) => { release(); });
    return result;
  }, page.url());
  expect(result).toEqual({ result: 'refused' });
  await expect(page.locator('#first')).toHaveText('0');
  await expect(page.locator('#second')).toHaveText('1');
});

for (const boundary of ['parent frame validation', 'final authorization reply'] as const) {
test(`pausing during ${boundary} cancels a click before it is delivered`, async ({ context, serviceWorker, servePage }) => {
  servePage('http://practice.test/validation-pending.html', '<iframe src="http://other.test/validation-child.html"></iframe>');
  servePage('http://other.test/validation-child.html', '<a href="#read" onclick="document.querySelector(\'output\').textContent=\'1\'">읽기</a><output>0</output>');
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
  const page = await context.newPage();
  await page.goto('http://practice.test/validation-pending.html');
  await expect(page.frameLocator('iframe').locator('a')).toBeVisible();
  await startSwitch(page);
  await chooseSwitch(page, '페이지 항목');
  await serviceWorker.evaluate((boundary) => {
    const send = chrome.tabs.sendMessage.bind(chrome.tabs);
    let checks = 0;
    chrome.tabs.sendMessage = async (tabId, message, options) => {
      if (boundary === 'parent frame validation' && typeof message === 'object' && message !== null && 'type' in message && message.type === 'switch/frame-check') await new Promise((resolve) => setTimeout(resolve, 1000));
      const result = await send(tabId, message, options);
      if (boundary === 'final authorization reply' && typeof message === 'object' && message !== null && 'type' in message && message.type === 'switch/action-check' && ++checks === 2) await new Promise((resolve) => setTimeout(resolve, 1000));
      return result;
    };
  }, boundary);
  await chooseSwitch(page, '읽기');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(1500);
  await expect(page.frameLocator('iframe').locator('output')).toHaveText('0');
});
}

test('a delayed apply reply after a pause cannot continue into search', async ({ context, serviceWorker, servePage }) => {
  test.setTimeout(60000);
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 }, switchPhrases: ['안녕'] }));
  servePage('http://practice.test/pending.html', '<form action="/switch-results.html" method="get"><input type="search" name="q" aria-label="검색어"></form>');
  const page = await context.newPage();
  await page.goto('http://practice.test/pending.html');
  await startSwitch(page);
  await chooseSwitch(page, '찾기');
  await chooseSwitch(page, '검색어');
  await chooseSwitch(page, '문구');
  await chooseSwitch(page, '안녕');
  await serviceWorker.evaluate(() => {
    const send = chrome.tabs.sendMessage.bind(chrome.tabs);
    chrome.tabs.sendMessage = async (tabId, message, options) => {
      const result = await send(tabId, message, options);
      if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'switch/execute'
          && 'action' in message && typeof message.action === 'object' && message.action !== null && 'kind' in message.action && message.action.kind === 'applyText') {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      return result;
    };
  });
  await chooseSwitch(page, '검색');
  await expect(page.getByRole('searchbox')).toHaveValue('안녕');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('tremor-helper-root').locator('.switch-panel')).toHaveAttribute('data-mode', 'paused');
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL('http://practice.test/pending.html');
  await expect(page.locator('tremor-helper-root').locator('.switch-draft')).toHaveText('안녕');
});

for (const navigates of [false, true]) {
test(`a lost click reply ${navigates ? 'after fragment navigation' : 'without navigation'} is shown as unknown and is never automatically replayed`, async ({ context, serviceWorker, servePage }) => {
  // 탐색 유무를 나눠 응답 유실 뒤의 복구 상태와 결과불명 안내를 각각 검사한다.
  servePage('http://practice.test/lost-reply.html', `<a href="#read" onclick="${navigates ? '' : 'event.preventDefault();'}document.querySelector('output').textContent=String(Number(document.querySelector('output').textContent)+1)">읽기</a><output>0</output>`);
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
  const page = await context.newPage();
  await page.goto('http://practice.test/lost-reply.html');
  await startSwitch(page);
  await chooseSwitch(page, '페이지 항목');
  await serviceWorker.evaluate(() => {
    const send = chrome.tabs.sendMessage.bind(chrome.tabs);
    chrome.tabs.sendMessage = async (tabId, message, options) => {
      const result = await send(tabId, message, options);
      if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'switch/execute'
          && 'action' in message && typeof message.action === 'object' && message.action !== null && 'kind' in message.action && message.action.kind === 'press') throw new Error('lost reply after execution');
      return result;
    };
  });
  await chooseSwitch(page, '읽기');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await expect(panel).toHaveAttribute('data-mode', navigates ? 'paused' : 'recovering');
  await expect(panel.locator('.switch-status')).toContainText('결과');
  await page.waitForTimeout(500);
  await expect(page.locator('output')).toHaveText('1');
  await page.keyboard.press('Space');
  await expect(panel).toHaveAttribute('data-mode', navigates ? 'groupScan' : 'itemScan');
  await expect(page.locator('output')).toHaveText('1');
});
}

test('replacing a child document cancels its old confirmation before any click', async ({ context, serviceWorker, servePage }) => {
  servePage('http://practice.test/frame-switch.html', '<iframe title="본문" src="http://other.test/old-switch.html"></iframe>');
  servePage('http://other.test/old-switch.html', '<button onclick="document.querySelector(\'output\').textContent=\'1\'">삭제</button><output>0</output>');
  servePage('http://other.test/new-switch.html', '<button onclick="document.querySelector(\'output\').textContent=\'1\'">새 삭제</button><output>0</output>');
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
  const page = await context.newPage();
  await page.goto('http://practice.test/frame-switch.html');
  await expect(page.frameLocator('iframe').getByRole('button')).toBeVisible();
  await startSwitch(page);
  await chooseSwitch(page, '페이지 항목');
  await chooseSwitch(page, '삭제');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await expect(panel).toHaveAttribute('data-mode', 'confirming');
  await page.locator('iframe').evaluate((el) => { (el as HTMLIFrameElement).src = 'http://other.test/new-switch.html'; });
  await expect(page.frameLocator('iframe').getByRole('button')).toHaveText('새 삭제');
  await expect(panel).toHaveAttribute('data-mode', 'paused');
  await page.keyboard.press('Space');
  await expect(panel).toHaveAttribute('data-mode', 'groupScan');
  await expect(page.frameLocator('iframe').locator('output')).toHaveText('0');
});

test('a worker port reconnect cancels confirmation, keeps the draft and never replays a click', async ({ context, serviceWorker, servePage }) => {
  test.setTimeout(60000);
  servePage('http://practice.test/reconnect.html', '<input type="search" aria-label="검색어"><button onclick="document.querySelector(\'output\').textContent=\'1\'">삭제</button><output>0</output>');
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 }, switchPhrases: ['안녕'] }));
  const page = await context.newPage();
  await page.goto('http://practice.test/reconnect.html');
  await startSwitch(page);
  await chooseSwitch(page, '찾기');
  await chooseSwitch(page, '검색어');
  await chooseSwitch(page, '문구');
  await chooseSwitch(page, '안녕');
  await chooseSwitch(page, '상위로');
  await chooseSwitch(page, '페이지 항목');
  await chooseSwitch(page, '삭제');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await expect(panel).toHaveAttribute('data-mode', 'confirming');
  await serviceWorker.evaluate(() => { (globalThis as unknown as { disconnectAlivePorts: () => void }).disconnectAlivePorts(); });
  await expect(panel).toHaveAttribute('data-mode', 'paused');
  await expect(panel.locator('.switch-draft')).toHaveText('안녕');
  await page.keyboard.press('Space');
  await expect(panel).toHaveAttribute('data-mode', 'groupScan');
  await expect(page.locator('output')).toHaveText('0');
});
