import { test, expect } from './fixtures';

// D-20(SAFE-04)·D-23(STOR-01): 팝업 "도우미 끄기(전체)" → 단일 저장자 → storage.sync → 모든 프레임 →
// 맨 위 프레임 모드 표시, 한 경로(tracer). 연습 사이트는 servePage가 등록하는 로컬 고정물이다(D-28).

test('연습 사이트에 가면 맨 위 프레임에 모드 표시("도우미")가 뜬다', async ({ context, servePage }) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');

  await expect
    .poll(() =>
      page.evaluate(
        () => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.mode-indicator')?.textContent ?? null,
      ),
    )
    .toBe('도우미');
});

test('팝업에서 "도우미 끄기"를 누르면 storage.sync가 바뀌고 모드 표시가 1초 안에 사라진다', async ({
  context,
  serviceWorker,
  openPopup,
  servePage,
}) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');

  await expect.poll(() => page.evaluate(() => document.querySelector('tremor-helper-root') !== null)).toBe(true);

  const popup = await openPopup();
  await popup.getByRole('button', { name: '도우미 끄기' }).click();

  await expect
    .poll(async () => {
      const stored = (await serviceWorker.evaluate(() => chrome.storage.sync.get('settings'))) as {
        settings?: { data?: { enabled?: boolean } };
      };
      return stored.settings?.data?.enabled;
    })
    .toBe(false);

  await expect.poll(() => page.evaluate(() => document.querySelector('tremor-helper-root') !== null)).toBe(false);
});

test('다시 "도우미 켜기"를 누르면 모드 표시가 1초 안에 돌아온다', async ({ context, openPopup, servePage }) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');

  const popup = await openPopup();
  await popup.getByRole('button', { name: '도우미 끄기' }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector('tremor-helper-root') !== null)).toBe(false);

  await popup.getByRole('button', { name: '도우미 켜기' }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector('tremor-helper-root') !== null)).toBe(true);
});

async function readEnabled(serviceWorker: import('@playwright/test').Worker): Promise<boolean | undefined> {
  const stored = (await serviceWorker.evaluate(() => chrome.storage.sync.get('settings'))) as {
    settings?: { data?: { enabled?: boolean } };
  };
  return stored.settings?.data?.enabled;
}

test('팝업에 포커스가 있을 때 숫자 1(Digit1·Numpad1)을 누르면 카드를 누른 것과 같다', async ({ serviceWorker, openPopup }) => {
  const popup = await openPopup();

  await popup.keyboard.press('Digit1');
  await expect.poll(() => readEnabled(serviceWorker)).toBe(false);

  await popup.keyboard.press('Numpad1');
  await expect.poll(() => readEnabled(serviceWorker)).toBe(true);
});

test('카드를 빠르게 5번 누르면 storage.sync의 최종 상태가 마지막 누름과 같다', async ({ serviceWorker, openPopup }) => {
  const popup = await openPopup();
  const card = popup.locator('.card').first();

  for (let i = 0; i < 5; i += 1) {
    await card.click();
  }

  // 켜짐(기본) → 끄기 → 켜기 → 끄기 → 켜기 → 끄기: 다섯 번째(마지막) 누름의 결과는 꺼짐이다.
  await expect.poll(() => readEnabled(serviceWorker)).toBe(false);
});

test('같은 출처·다른 출처 iframe 모두 도우미 켜짐/꺼짐을 SW에 보고한다', async ({
  context,
  serviceWorker,
  openPopup,
  serveFramedPracticePage,
}) => {
  // serveFramedPracticePage(fixtures.ts): practice.test 위에 같은 출처 iframe과
  // 다른 출처(other.test) iframe을 함께 등록한다.
  serveFramedPracticePage();
  const page = await context.newPage();
  await page.goto('http://practice.test/');

  const readFrameStates = async (): Promise<boolean[]> => {
    const tabs = await serviceWorker.evaluate(() => chrome.tabs.query({ url: 'http://practice.test/*' }));
    const tabId = tabs[0]?.id;
    if (tabId === undefined) {
      return [];
    }
    return serviceWorker.evaluate((id) => {
      const store = (globalThis as unknown as { frameStates?: Record<number, Record<number, boolean>> }).frameStates;
      const tabFrames = store?.[id] ?? {};
      return Object.values(tabFrames);
    }, tabId);
  };

  await expect.poll(async () => {
    const states = await readFrameStates();
    return states.length >= 3 && states.every((v) => v);
  }).toBe(true);

  const popup = await openPopup();
  await popup.locator('.card').first().click();

  await expect.poll(async () => {
    const states = await readFrameStates();
    return states.length >= 3 && states.every((v) => !v);
  }).toBe(true);

  await popup.locator('.card').first().click();

  await expect.poll(async () => {
    const states = await readFrameStates();
    return states.length >= 3 && states.every((v) => v);
  }).toBe(true);
});

test('SW에서 storage.sync.set으로 값을 바꾸면(다른 PC 동기화 흉내) 모드 표시가 1초 안에 따른다', async ({
  context,
  serviceWorker,
  servePage,
}) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');

  await expect.poll(() => page.evaluate(() => document.querySelector('tremor-helper-root') !== null)).toBe(true);

  await serviceWorker.evaluate(async () => {
    const stored = await chrome.storage.sync.get('settings');
    const settings = stored.settings as { schemaVersion: number; data: Record<string, unknown> };
    await chrome.storage.sync.set({ settings: { ...settings, data: { ...settings.data, enabled: false } } });
  });

  await expect.poll(() => page.evaluate(() => document.querySelector('tremor-helper-root') !== null)).toBe(false);
});

test('메뉴 카드 높이가 56px 이상이고 카드 안에 키 칩 "1"이 있다', async ({ openPopup }) => {
  const popup = await openPopup();
  const card = popup.locator('.card').first();

  await expect(card.locator('.key-chip')).toHaveText('1');
  const box = await card.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(56);
});
