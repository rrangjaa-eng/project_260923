import { test, expect } from './fixtures';
import type { Page, Worker } from '@playwright/test';

// D-20(SAFE-04)·D-21(SAFE-05)·D-23·D-24(STOR-01): 지금 사이트에서만 끄기와 확장이 동작하지 않는
// 페이지의 "도울 수 없음" 표시. 연습 사이트는 servePage가 등록하는 로컬 고정물이다(D-28).

// 지금 활성 탭의 확장 아이콘 제목·배지를 SW 안에서 직접 읽는다(별도로 tabId를 주고받지 않는다 —
// active 탭을 찾는 것 자체가 background.ts가 하는 일과 같은 필터라 시험도 그대로 재사용한다).
async function activeTabTitle(serviceWorker: Worker): Promise<string> {
  return serviceWorker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ active: true });
    const tabId = tabs[0]?.id;
    return tabId === undefined ? '' : chrome.action.getTitle({ tabId });
  });
}

async function activeTabBadge(serviceWorker: Worker): Promise<string> {
  return serviceWorker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ active: true });
    const tabId = tabs[0]?.id;
    return tabId === undefined ? '' : chrome.action.getBadgeText({ tabId });
  });
}

test('chrome://version 탭을 활성으로 하면 아이콘 제목이 "도울 수 없음", 배지가 "없음"이다', async ({
  context,
  serviceWorker,
}) => {
  const page = await context.newPage();
  await page.goto('chrome://version');

  await expect.poll(() => activeTabTitle(serviceWorker)).toBe('도울 수 없음');
  await expect.poll(() => activeTabBadge(serviceWorker)).toBe('없음');
  await page.close();
});

test('연습 사이트 탭은 아이콘 제목이 "손 떨림 도우미", 배지가 ""이다', async ({ context, serviceWorker, servePage }) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');

  await expect.poll(() => activeTabTitle(serviceWorker)).toBe('손 떨림 도우미');
  await expect.poll(() => activeTabBadge(serviceWorker)).toBe('');
  await page.close();
});

test('chrome://version 탭을 대상으로 연 메뉴에 "도울 수 없음" 안내가 뜨고 카드 2(이 사이트에서 끄기)는 없다', async ({
  context,
  openPopup,
}) => {
  const page = await context.newPage();
  await page.goto('chrome://version');

  const popup = await openPopup(page);
  await expect(popup.getByText('이 페이지에서는 도울 수 없어요. 다른 탭에서 쓰세요.')).toBeVisible();
  await expect(popup.getByRole('button', { name: /이 사이트에서/ })).toHaveCount(0);

  await popup.close();
  await page.close();
});

// Task 3: 지금 사이트에서만 끄기·사이트별 동기화 항목·쓰기 합치기(D-20, D-23, D-24, T-01-36~39).

async function hasHelperRoot(page: Page): Promise<boolean> {
  return page.evaluate(() => document.querySelector('tremor-helper-root') !== null);
}

async function waitForHelperReady(page: Page): Promise<void> {
  await expect.poll(() => hasHelperRoot(page)).toBe(true);
}

async function readSiteEntry(
  serviceWorker: Worker,
  origin: string,
): Promise<{ schemaVersion: number; data: { disabled: boolean; pins: unknown[] } } | undefined> {
  const key = `site:${origin}`;
  const stored = await serviceWorker.evaluate((k) => chrome.storage.sync.get(k), key);
  return stored[key] as { schemaVersion: number; data: { disabled: boolean; pins: unknown[] } } | undefined;
}

test('연습 사이트 탭에서 "이 사이트에서 끄기"를 누르면 site:http://practice.test가 꺼지고 그 탭만 사라지며 다른 사이트 탭은 그대로다', async ({
  context,
  serviceWorker,
  openPopup,
  servePage,
}) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  servePage('http://other.test/', '<!doctype html><html><body><h1>다른 사이트</h1></body></html>');

  const practicePage = await context.newPage();
  await practicePage.goto('http://practice.test/');
  await waitForHelperReady(practicePage);

  const otherPage = await context.newPage();
  await otherPage.goto('http://other.test/');
  await waitForHelperReady(otherPage);

  const popup = await openPopup(practicePage);
  await popup.getByRole('button', { name: /이 사이트에서 끄기/ }).click();

  await expect.poll(async () => (await readSiteEntry(serviceWorker, 'http://practice.test'))?.data.disabled).toBe(true);
  await expect.poll(() => hasHelperRoot(practicePage)).toBe(false);
  await expect.poll(() => hasHelperRoot(otherPage)).toBe(true);

  await popup.close();
  await practicePage.close();
  await otherPage.close();
});

test('다시 "이 사이트에서 켜기"를 누르면 도우미가 돌아온다', async ({ context, openPopup, servePage }) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');
  await waitForHelperReady(page);

  const popup = await openPopup(page);
  await popup.getByRole('button', { name: /이 사이트에서 끄기/ }).click();
  await expect.poll(() => hasHelperRoot(page)).toBe(false);

  await popup.getByRole('button', { name: /이 사이트에서 켜기/ }).click();
  await expect.poll(() => hasHelperRoot(page)).toBe(true);

  await popup.close();
  await page.close();
});

test('SW가 미리 pins를 넣어 둔 상태에서 끄고 켜도 pins가 그대로다', async ({ context, serviceWorker, openPopup, servePage }) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');
  await waitForHelperReady(page);

  const pins = [{ number: 1, fingerprint: { domPath: 'body>button', framePath: [] } }];
  await serviceWorker.evaluate(async (p) => {
    await chrome.storage.sync.set({
      'site:http://practice.test': { schemaVersion: 1, data: { disabled: false, pins: p } },
    });
  }, pins);

  const popup = await openPopup(page);
  await popup.getByRole('button', { name: /이 사이트에서 끄기/ }).click();
  await expect.poll(() => hasHelperRoot(page)).toBe(false);
  await popup.getByRole('button', { name: /이 사이트에서 켜기/ }).click();
  await expect.poll(() => hasHelperRoot(page)).toBe(true);

  const entry = await readSiteEntry(serviceWorker, 'http://practice.test');
  expect(entry?.data.pins).toEqual(pins);

  await popup.close();
  await page.close();
});

test('practice.test 안의 other.test iframe도 practice.test를 끄면 도우미가 꺼진다(사이트 = 맨 위 페이지 출처)', async ({
  context,
  openPopup,
  serveFramedPracticePage,
}) => {
  serveFramedPracticePage();
  const page = await context.newPage();
  await page.goto('http://practice.test/');
  await waitForHelperReady(page);

  const childFrame = page.frame({ url: 'http://other.test/frame-other.html' });
  if (!childFrame) {
    throw new Error('other.test 자식 프레임을 찾지 못했다');
  }
  await expect.poll(() => childFrame.evaluate(() => document.querySelector('tremor-helper-root') !== null)).toBe(true);

  const popup = await openPopup(page);
  await popup.getByRole('button', { name: /이 사이트에서 끄기/ }).click();

  await expect.poll(() => hasHelperRoot(page)).toBe(false);
  await expect.poll(() => childFrame.evaluate(() => document.querySelector('tremor-helper-root') !== null)).toBe(false);

  await popup.close();
  await page.close();
});

test('SW가 site:http://practice.test를 직접 바꾸면(다른 PC 동기화 흉내) 1초 안에 따른다', async ({
  context,
  serviceWorker,
  servePage,
}) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');
  await waitForHelperReady(page);

  await serviceWorker.evaluate(async () => {
    await chrome.storage.sync.set({
      'site:http://practice.test': { schemaVersion: 1, data: { disabled: true, pins: [] } },
    });
  });

  await expect.poll(() => hasHelperRoot(page)).toBe(false);
  await page.close();
});

test('Content-Security-Policy: sandbox 머리글로 제공한 연습 페이지를 활성으로 하면 1초 뒤 아이콘이 "도울 수 없음"이다', async ({
  context,
  serviceWorker,
  servePage,
}) => {
  servePage(
    'http://practice.test/sandboxed.html',
    '<!doctype html><html><body><h1>격리된 페이지</h1></body></html>',
    { 'Content-Security-Policy': 'sandbox' },
  );
  const page = await context.newPage();
  await page.goto('http://practice.test/sandboxed.html');

  await expect.poll(() => activeTabTitle(serviceWorker)).toBe('도울 수 없음');
  await expect.poll(() => activeTabBadge(serviceWorker)).toBe('없음');
  await page.close();
});

test('메뉴에서 150번 빠르게 끄고 켜기를 번갈아 보낸 뒤 최종 disabled가 마지막 요청과 같고 오류가 없다', async ({
  context,
  serviceWorker,
  openPopup,
  servePage,
}) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');
  await waitForHelperReady(page);

  const tabs = await serviceWorker.evaluate(() => chrome.tabs.query({ url: 'http://practice.test/*' }));
  const tabId = tabs[0]?.id;
  if (tabId === undefined) {
    throw new Error('practice.test 탭을 찾지 못했다');
  }

  const popup = await openPopup(page);
  const results = await popup.evaluate(async (id) => {
    const origin = 'http://practice.test';
    const promises = Array.from({ length: 150 }, (_, i) =>
      chrome.runtime.sendMessage({
        type: 'storage/request',
        op: { kind: 'setSiteDisabled', origin, disabled: i % 2 === 0, tabId: id },
      }),
    );
    return Promise.all(promises);
  }, tabId);

  expect(results.every((r) => (r as { ok?: boolean }).ok === true)).toBe(true);

  const entry = await readSiteEntry(serviceWorker, 'http://practice.test');
  // 149번째(마지막, index 149, 짝수 아님) 요청의 disabled 값과 최종 상태가 같아야 한다.
  expect(entry?.data.disabled).toBe(false);

  await popup.close();
  await page.close();
});
