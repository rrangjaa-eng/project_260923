import { test, expect } from './fixtures';
import type { BrowserContext, Locator, Page, Worker } from '@playwright/test';

// 01-19 Task 1(ELEM-02, SAFE-04, SAFE-05): 주소 없는 새 창(window.open('')을 여는 쪽이 DOM이나
// document.write로 채움, 결재 팝업 등)에서도 도우미가 한 번만 돈다. 그 창의 사이트는 여는 쪽
// 출처다. 연습 페이지는 tests/practice-site/blank-popup.html(D-28).

async function hasHelperRoot(page: Page): Promise<boolean> {
  return page.evaluate(() => document.querySelector('tremor-helper-root') !== null);
}

async function hostCount(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelectorAll('tremor-helper-root').length);
}

async function indicatorText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const el = host?.shadowRoot?.querySelector('.mode-indicator');
    return el?.textContent ?? '';
  });
}

async function waitForHelperReady(page: Page): Promise<void> {
  await expect.poll(() => indicatorText(page)).toBe('도우미');
}

async function ringVisible(page: Page): Promise<boolean> {
  return page
    .locator('tremor-helper-root')
    .evaluate((host) => host.shadowRoot?.querySelector('.ring')?.getAttribute('data-visible') === 'true')
    .catch(() => false);
}

async function labelTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const labels = host?.shadowRoot?.querySelectorAll('.hint-label');
    return labels ? Array.from(labels).map((el) => el.textContent) : [];
  });
}

// editor-frames.e2e.ts와 같은 방식(고정 sleep 대신 조건 재시도) — 번호가 뜰 때까지 F를 다시 눌러
// 본다.
async function pressFUntilLabels(page: Page, minCount: number): Promise<void> {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(150);
    if ((await labelTexts(page)).length >= minCount) {
      return;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
  }
}

async function numberForLocator(page: Page, locator: Locator): Promise<string> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('요소를 찾지 못했다(boundingBox 없음)');
  }
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await page.evaluate(
      ({ x, y }) => {
        const labels = document.querySelector('tremor-helper-root')?.shadowRoot?.querySelectorAll('.hint-label');
        let best = '';
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const label of Array.from(labels ?? [])) {
          const r = label.getBoundingClientRect();
          const d = Math.hypot(r.x - (x - 14), r.y - (y - 14));
          if (d < bestDistance) {
            bestDistance = d;
            best = label.textContent;
          }
        }
        return { best, bestDistance };
      },
      { x: box.x, y: box.y },
    );
    if (result.bestDistance < 20) {
      return result.best;
    }
    const hasNext = await page.evaluate(
      () => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.hint-next-card') !== null,
    );
    if (!hasNext) {
      break;
    }
    await page.keyboard.press('Digit0');
    await page.waitForTimeout(100);
  }
  throw new Error('번호표에서 요소를 찾지 못했다(모든 장을 넘겨 봄)');
}

async function findHintNumberFor(page: Page, locator: Locator): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await pressFUntilLabels(page, 1);
    try {
      const number = await numberForLocator(page, locator);
      if (number) {
        return number;
      }
    } catch {
      // 이 스냅샷엔 없었다 — 닫고 다시 열어 본다.
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  throw new Error('번호를 찾지 못했다');
}

async function pressHintFor(page: Page, locator: Locator): Promise<void> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.focus();
  });
  const number = await findHintNumberFor(page, locator);
  await page.keyboard.press(`Digit${number}`);
}

// 여는 쪽 페이지에서 전역 함수를 부르고 그 결과로 열리는 새 창을 받는다.
async function openViaFn(page: Page, context: BrowserContext, fnName: string): Promise<Page> {
  const waiter = context.waitForEvent('page');
  await page.evaluate((name: string) => {
    const fn = (window as unknown as Record<string, (() => void) | undefined>)[name];
    fn?.();
  }, fnName);
  return waiter;
}

async function openOpenerPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto('http://practice.test/blank-popup.html');
  return page;
}

// Task 2 도우미: about:blank로 남는 새 창 탭은 url만으로 찾을 수 없다 — 새 컨텍스트가 만드는
// 기본 빈 탭도 url이 about:blank라 같이 걸린다. openerUrl을 주면 그 탭이 연 것(openerTabId)만
// 남긴다.
async function tabIdByUrl(serviceWorker: Worker, url: string, openerUrl?: string): Promise<number | undefined> {
  const tabs = await serviceWorker.evaluate(
    async ({ u, openerUrl: openerU }) => {
      const all = await chrome.tabs.query({});
      const matching = all.filter((t) => t.url === u);
      if (!openerU) {
        return matching;
      }
      const openerId = all.find((t) => t.url === openerU)?.id;
      return matching.filter((t) => (t as unknown as { openerTabId?: number }).openerTabId === openerId);
    },
    { u: url, openerUrl },
  );
  return tabs[0]?.id;
}

async function tabTitle(serviceWorker: Worker, tabId: number): Promise<string> {
  return serviceWorker.evaluate((id) => chrome.action.getTitle({ tabId: id }), tabId);
}

async function tabBadge(serviceWorker: Worker, tabId: number): Promise<string> {
  return serviceWorker.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), tabId);
}

async function readSiteEntry(
  serviceWorker: Worker,
  origin: string,
): Promise<{ schemaVersion: number; data: { disabled: boolean; pins: unknown[] } } | undefined> {
  const key = `site:${origin}`;
  const stored = await serviceWorker.evaluate((k) => chrome.storage.sync.get(k), key);
  return stored[key] as { schemaVersion: number; data: { disabled: boolean; pins: unknown[] } } | undefined;
}

async function localStorageKeys(serviceWorker: Worker): Promise<string[]> {
  return serviceWorker.evaluate(async () => Object.keys(await chrome.storage.local.get(null)));
}

async function readFrameStatesByFrameId(serviceWorker: Worker, tabId: number): Promise<Record<number, boolean>> {
  return serviceWorker.evaluate((id) => {
    const store = (globalThis as unknown as { frameStates?: Record<number, Record<number, boolean>> }).frameStates;
    return store?.[id] ?? {};
  }, tabId);
}

// popup window 참조를 여는 쪽 페이지의 전역에 담아 둔다 — Task 2의 addSrcdocFrame(win) 호출은
// 별도의 page.evaluate에서 그 참조가 필요하다(Window 핸들은 evaluate 경계를 못 건넌다).
async function openDomPopupKeepingRef(page: Page, context: BrowserContext): Promise<Page> {
  const waiter = context.waitForEvent('page');
  await page.evaluate(() => {
    (window as unknown as { __popupRef?: Window | null }).__popupRef = (
      window as unknown as { openDomPopup: () => Window | null }
    ).openDomPopup();
  });
  return waiter;
}

async function addChildFrameToPopup(page: Page): Promise<void> {
  await page.evaluate(() => {
    const win = (window as unknown as { __popupRef?: Window | null }).__popupRef;
    const fn = (window as unknown as { addSrcdocFrame?: (w: Window) => void }).addSrcdocFrame;
    if (win && fn) {
      fn(win);
    }
  });
}

test('window.open(\'\')으로 열고 DOM으로 채운 새 창에서 도우미가 한 번만 돈다', async ({ context }) => {
  const page = await openOpenerPage(context);
  const popup = await openViaFn(page, context, 'openDomPopup');

  await waitForHelperReady(popup);
  expect(await hostCount(popup)).toBe(1);

  const box = await popup.locator('#popup-btn').boundingBox();
  if (!box) {
    throw new Error('#popup-btn을 찾지 못했다');
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await popup.mouse.click(x, y);
  await popup.waitForTimeout(100);
  await popup.mouse.click(x, y);
  await expect(popup.locator('#popup-count')).toHaveText('1');

  await pressHintFor(popup, popup.locator('#popup-btn'));
  await expect(popup.locator('#popup-count')).toHaveText('2');

  await popup.close();
  await page.close();
});

test('window.open(\'\') 뒤 document.write로 채운 새 창에서도 도우미가 한 번만 돈다(옛 도우미 다시 넣기 포함)', async ({
  context,
}) => {
  const page = await openOpenerPage(context);
  const popup = await openViaFn(page, context, 'openWritePopup');

  await waitForHelperReady(popup);
  expect(await hostCount(popup)).toBe(1);

  // 커서를 대면 테두리가 보인다(새 도우미가 실제로 이 프레임에서 살아 있다는 근거) — 5초 안.
  const box = await popup.locator('#popup-btn').boundingBox();
  if (!box) {
    throw new Error('#popup-btn을 찾지 못했다');
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await popup.mouse.move(x, y);
  await expect.poll(() => ringVisible(popup), { timeout: 5000 }).toBe(true);

  await popup.mouse.click(x, y);
  await popup.waitForTimeout(100);
  await popup.mouse.click(x, y);
  await expect(popup.locator('#popup-count')).toHaveText('1');

  await pressHintFor(popup, popup.locator('#popup-btn'));
  await expect(popup.locator('#popup-count')).toHaveText('2');

  await popup.close();
  await page.close();
});

test('DOM 새 창이 열린 채 SW가 site:http://practice.test를 끄면 새 창의 호스트가 사라지고, 다시 켜면 돌아온다(여는 쪽 사이트를 따름)', async ({
  context,
  serviceWorker,
}) => {
  const page = await openOpenerPage(context);
  const popup = await openViaFn(page, context, 'openDomPopup');
  await waitForHelperReady(popup);

  const box = await popup.locator('#popup-btn').boundingBox();
  if (!box) {
    throw new Error('#popup-btn을 찾지 못했다');
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await popup.mouse.click(x, y);
  await popup.waitForTimeout(100);
  await popup.mouse.click(x, y);
  await expect(popup.locator('#popup-count')).toHaveText('1');

  await serviceWorker.evaluate(async () => {
    await chrome.storage.sync.set({
      'site:http://practice.test': { schemaVersion: 1, data: { disabled: true, pins: [] } },
    });
  });
  await expect.poll(() => hasHelperRoot(popup)).toBe(false);

  // 도우미가 꺼졌으니 100ms 두 번 클릭이 필터 없이 그대로 둘 다 간다(1 → 3).
  await popup.mouse.click(x, y);
  await popup.waitForTimeout(100);
  await popup.mouse.click(x, y);
  await expect(popup.locator('#popup-count')).toHaveText('3');

  await serviceWorker.evaluate(async () => {
    await chrome.storage.sync.set({
      'site:http://practice.test': { schemaVersion: 1, data: { disabled: false, pins: [] } },
    });
  });
  await expect.poll(() => hostCount(popup)).toBe(1);

  await popup.close();
  await page.close();
});

// noopener 실측(01-19 Task 1 RED, 프로덕션 빌드로 확인): window.open('', '_blank', 'noopener')와
// rel=noopener 링크 둘 다 self.origin은 여는 쪽 http(s) 출처를 물려받지만(불투명 아님), Chrome이
// 그 새 창에는 content script를 전혀 주입하지 않는다(match_about_blank는 opener·parent 문서로만
// 출처를 판정하는데 noopener가 그 연결 자체를 끊는다 — Chrome 자체 동작, 코드로 구분 장치를 두지
// 않는다). 그 결과 두 경우 모두 tremor-helper-root가 생기지 않는다 — "도울 수 없음" 쪽과 같은
// 결과다.
test('noopener로 연 새 창(window.open과 링크 둘 다)에는 Chrome이 content script를 주입하지 않아 도우미가 없다(실측)', async ({
  context,
}) => {
  const page = await openOpenerPage(context);

  const popup1 = await openViaFn(page, context, 'openNoopenerPopup');
  await popup1.waitForTimeout(1000);
  expect(await hasHelperRoot(popup1)).toBe(false);
  await popup1.close();

  const waiter2 = context.waitForEvent('page');
  await page.locator('#noopener-link').click();
  const popup2 = await waiter2;
  await popup2.waitForTimeout(1000);
  expect(await hasHelperRoot(popup2)).toBe(false);
  await popup2.close();

  await page.close();
});

// 01-19 Task 2(SAFE-04, SAFE-05): 주소 없는 새 창 탭의 아이콘·메뉴·누른 기록·자식 iframe이 여는
// 쪽 사이트(Chrome이 준 sender.origin)를 쓴다.

test('window.open(\'\') DOM 새 창 탭의 아이콘 제목이 "손 떨림 도우미"이고, chrome://version 탭은 그대로 "도울 수 없음"이다', async ({
  context,
  serviceWorker,
}) => {
  const page = await openOpenerPage(context);
  const popup = await openViaFn(page, context, 'openDomPopup');
  await waitForHelperReady(popup);

  const popupTabId = await tabIdByUrl(serviceWorker, 'about:blank', 'http://practice.test/blank-popup.html');
  if (popupTabId === undefined) {
    throw new Error('새 창 탭을 찾지 못했다');
  }
  await expect.poll(() => tabTitle(serviceWorker, popupTabId), { timeout: 5000 }).toBe('손 떨림 도우미');
  await expect.poll(() => tabBadge(serviceWorker, popupTabId)).toBe('');

  const versionPage = await context.newPage();
  await versionPage.goto('chrome://version');
  const versionTabId = await tabIdByUrl(serviceWorker, 'chrome://version/');
  if (versionTabId === undefined) {
    throw new Error('chrome://version 탭을 찾지 못했다');
  }
  await expect.poll(() => tabTitle(serviceWorker, versionTabId)).toBe('도울 수 없음');
  await expect.poll(() => tabBadge(serviceWorker, versionTabId)).toBe('없음');

  await versionPage.close();
  await popup.close();
  await page.close();
});

test('새 창 탭을 대상으로 연 메뉴에 "도울 수 없음" 안내가 없고 "이 사이트에서 끄기"가 있다 — 누르면 여는 쪽 사이트가 꺼지고 새 창·여는 쪽 모두 호스트가 사라진다', async ({
  context,
  serviceWorker,
  extensionId,
}) => {
  const page = await openOpenerPage(context);
  await waitForHelperReady(page);
  const popup = await openViaFn(page, context, 'openDomPopup');
  await waitForHelperReady(popup);

  // fixtures.ts의 openPopup(target)은 target.url()로 탭을 찾는데, 이 새 창은 url이
  // about:blank라 컨텍스트의 기본 빈 탭과 구분이 안 된다 — openerTabId로 가려낸 tabIdByUrl로
  // 직접 tabId를 구해 메뉴를 연다.
  const popupTabId = await tabIdByUrl(serviceWorker, 'about:blank', 'http://practice.test/blank-popup.html');
  if (popupTabId === undefined) {
    throw new Error('새 창 탭을 찾지 못했다');
  }
  const menu = await context.newPage();
  await menu.goto(`chrome-extension://${extensionId}/popup.html?tabId=${String(popupTabId)}`);
  await expect(menu.getByText('이 페이지에서는 도울 수 없어요. 다른 탭에서 쓰세요.')).toHaveCount(0);
  await expect(menu.getByRole('button', { name: /이 사이트에서 끄기/ })).toBeVisible();

  await menu.getByRole('button', { name: /이 사이트에서 끄기/ }).click();

  await expect.poll(async () => (await readSiteEntry(serviceWorker, 'http://practice.test'))?.data.disabled).toBe(true);
  await expect.poll(() => hasHelperRoot(popup)).toBe(false);
  await expect.poll(() => hasHelperRoot(page)).toBe(false);

  await menu.close();
  await popup.close();
  await page.close();
});

test('새 창 안에서 번호로 누른 기록은 여는 쪽 사이트 출처 키에만 쌓이고 presses:null·about: 키는 없다', async ({
  context,
  serviceWorker,
}) => {
  const page = await openOpenerPage(context);
  const popup = await openViaFn(page, context, 'openDomPopup');
  await waitForHelperReady(popup);

  await pressHintFor(popup, popup.locator('#popup-btn'));

  await expect
    .poll(async () => (await localStorageKeys(serviceWorker)).some((k) => k === 'presses:http://practice.test'))
    .toBe(true);
  const keys = await localStorageKeys(serviceWorker);
  expect(keys.some((k) => k === 'presses:null' || k.startsWith('presses:about:'))).toBe(false);

  await popup.close();
  await page.close();
});

test('새 창에 addSrcdocFrame으로 넣은 자식 iframe도 여는 쪽 사이트를 끄면 도우미가 꺼진다(site/query가 여는 쪽 출처로 답)', async ({
  context,
  serviceWorker,
}) => {
  const page = await openOpenerPage(context);
  const popup = await openDomPopupKeepingRef(page, context);
  await waitForHelperReady(popup);

  await addChildFrameToPopup(page);

  const popupTabId = await tabIdByUrl(serviceWorker, 'about:blank', 'http://practice.test/blank-popup.html');
  if (popupTabId === undefined) {
    throw new Error('새 창 탭을 찾지 못했다');
  }

  await expect
    .poll(
      async () => {
        const states = await readFrameStatesByFrameId(serviceWorker, popupTabId);
        const nonTop = Object.entries(states).filter(([frameId]) => frameId !== '0');
        return nonTop.length >= 1 && nonTop.every(([, enabled]) => enabled);
      },
      { timeout: 5000 },
    )
    .toBe(true);

  await serviceWorker.evaluate(async () => {
    await chrome.storage.sync.set({
      'site:http://practice.test': { schemaVersion: 1, data: { disabled: true, pins: [] } },
    });
  });

  await expect
    .poll(
      async () => {
        const states = await readFrameStatesByFrameId(serviceWorker, popupTabId);
        const nonTop = Object.entries(states).filter(([frameId]) => frameId !== '0');
        return nonTop.length >= 1 && nonTop.every(([, enabled]) => !enabled);
      },
      { timeout: 5000 },
    )
    .toBe(true);

  await popup.close();
  await page.close();
});
