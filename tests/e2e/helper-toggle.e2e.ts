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

  // WR-06: 같은 카드를 다시 누르는 것 — 떨림 두 번 탭과 구분되도록 떨림 간격(기본 300ms)보다
  // 넉넉히 띄운다(다른 시험들의 같은 요소 재입력 간격 확보 관례와 같다).
  await popup.waitForTimeout(350);
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

  // WR-06: 같은 카드를 다시 누르는 것 — 떨림 두 번 탭과 구분되도록 간격을 띄운다.
  await popup.waitForTimeout(350);
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

  // WR-06: 같은 카드를 다시 누르는 것 — 떨림 두 번 탭과 구분되도록 간격을 띄운다.
  await popup.waitForTimeout(350);
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

test('WR-06: 1을 틈 없이 두 번 누르면(떨림 두 번 탭) 한 번만 토글된다', async ({ serviceWorker, openPopup }) => {
  const popup = await openPopup();
  // renderForTargetTab()의 비동기 렌더(도울 수 없음 안내·사이트 카드 삽입 등)가 카드 1의 화면
  // 자리를 밀어내는 틈에 두 번째 누름이 걸리면(재현 확인) "같은 자리"로 안 잡혀 떨림 거르기가
  // 못 걸러진다 — 두 번 빠르게 누르기 전에 팝업 레이아웃이 자리 잡을 시간을 준다.
  await popup.waitForTimeout(200);

  // 시작 상태는 기본값 켜짐(true) — 떨림 간격(기본 300ms) 안에 두 번 누른다.
  await popup.keyboard.press('Digit1');
  await popup.keyboard.press('Digit1');

  // 한 번만 등록되면 꺼짐(false). 두 번 다 등록되면 다시 켜짐(true)으로 되돌아간다.
  await expect.poll(() => readEnabled(serviceWorker)).toBe(false);
  // 간격이 지난 뒤에도(두 번째 누름이 뒤늦게 등록되지 않는지) 값이 그대로인지 확인한다.
  await popup.waitForTimeout(400);
  expect(await readEnabled(serviceWorker)).toBe(false);
});

test('WR-06: 카드를 틈 없이 두 번 클릭하면(떨림 두 번 탭) 한 번만 토글된다', async ({ serviceWorker, openPopup }) => {
  const popup = await openPopup();
  const card = popup.locator('.card').first();
  // WR-06 위 시험과 같은 이유 — 팝업 레이아웃이 자리 잡을 시간을 준다.
  await popup.waitForTimeout(200);

  await card.click();
  await card.click();

  await expect.poll(() => readEnabled(serviceWorker)).toBe(false);
  await popup.waitForTimeout(400);
  expect(await readEnabled(serviceWorker)).toBe(false);
});

test('WR-06: 키를 계속 눌러 생기는 자동 반복(keydown repeat)은 토글하지 않는다', async ({ serviceWorker, openPopup }) => {
  const popup = await openPopup();

  // 먼저 한 번 진짜로 눌러 기준 상태를 만든다(true → false).
  await popup.keyboard.press('Digit1');
  await expect.poll(() => readEnabled(serviceWorker)).toBe(false);

  // 그 뒤 자동 반복(repeat: true) keydown을 흉내 낸다 — 실제로 눌려 있는 키를 계속 붙잡고
  // 있을 때 브라우저가 보내는 것과 같은 모양이다. 토글되면 안 된다.
  await popup.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', code: 'Digit1', repeat: true, bubbles: true }));
  });
  await popup.waitForTimeout(100);
  expect(await readEnabled(serviceWorker)).toBe(false);
});

test('메뉴 카드 높이가 56px 이상이고 카드 안에 키 칩 "1"이 있다', async ({ openPopup }) => {
  const popup = await openPopup();
  const card = popup.locator('.card').first();

  await expect(card.locator('.key-chip')).toHaveText('1');
  const box = await card.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(56);
});
