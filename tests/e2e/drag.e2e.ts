import { test, expect } from './fixtures';
import type { Page, Worker } from '@playwright/test';

// D-08, FILT-04: 끌어서 놓기 두 번 누르기 — 기본은 꺼짐(보통 클릭), 메뉴 카드("4 끌어서 놓기 두
// 번 누르기")로 켜고 끈다. 켜면 draggable="true" 요소를 누를 때 끌기 시작(모드 표시에 "놓을
// 곳을 누르세요 · Esc 취소"), 다음 누름이 놓을 곳(HTML 끌기 이벤트로 대신 끌어서 놓는다). Esc나
// 같은 대상 다시 누르기로 취소한다. 연습 사이트는 tests/practice-site/drag.html(D-28).

async function patchSettings(serviceWorker: Worker, patch: Record<string, unknown>): Promise<void> {
  await serviceWorker.evaluate(async (p) => {
    const stored = await chrome.storage.sync.get('settings');
    const settings = stored.settings as { schemaVersion: number; data: Record<string, unknown> };
    await chrome.storage.sync.set({ settings: { ...settings, data: { ...settings.data, ...p } } });
  }, patch);
}

async function readDragTwoPress(serviceWorker: Worker): Promise<boolean | undefined> {
  const stored = (await serviceWorker.evaluate(() => chrome.storage.sync.get('settings'))) as {
    settings?: { data?: { dragTwoPress?: boolean } };
  };
  return stored.settings?.data?.dragTwoPress;
}

async function indicatorText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const el = host?.shadowRoot?.querySelector('.mode-indicator');
    return el?.textContent ?? '';
  });
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function boxOf(page: Page, selector: string): Promise<Box> {
  const box = await page.locator(selector).boundingBox();
  if (!box) {
    throw new Error(`요소를 찾지 못했다: ${selector}`);
  }
  return box;
}

function center(box: Box): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('기본 설정에서 A를 잡고 클릭하면 보통 클릭이고 놓을 곳은 그대로다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/drag.html');

  const a = center(await boxOf(page, '#item-a'));
  await page.mouse.move(a.x, a.y);
  await page.waitForTimeout(50);
  await page.mouse.click(a.x, a.y);

  await expect(page.locator('#item-a-count')).toHaveText('1');
  await expect(page.locator('#drop #item-a')).toHaveCount(0);
});

test('메뉴에서 "4 끌어서 놓기 두 번 누르기 켜기" 카드를 누르면 dragTwoPress가 켜지고 카드 글자가 바뀐다', async ({
  serviceWorker,
  openPopup,
}) => {
  const popup = await openPopup();

  await popup.getByRole('button', { name: '끌어서 놓기 두 번 누르기 켜기' }).click();

  await expect.poll(() => readDragTwoPress(serviceWorker)).toBe(true);
  await expect(popup.getByRole('button', { name: '끌어서 놓기 두 번 누르기 끄기' })).toBeVisible();
});

test('켠 뒤 A를 잡고 클릭하면 힌트가 뜨고, 이어서 놓을 곳을 누르면 A가 옮겨진다', async ({ context, serviceWorker }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/drag.html');
  await patchSettings(serviceWorker, { dragTwoPress: true });

  const a = center(await boxOf(page, '#item-a'));
  await page.mouse.move(a.x, a.y);
  await page.waitForTimeout(50);
  await page.mouse.click(a.x, a.y);

  await expect.poll(() => indicatorText(page)).toContain('놓을 곳을 누르세요');
  await expect.poll(() => indicatorText(page)).toContain('Esc 취소');
  // 끌기 시작 자체는 클릭이 아니다 — 누름이 삼켜져 A의 클릭 카운터는 늘지 않는다.
  await expect(page.locator('#item-a-count')).toHaveText('0');

  const drop = center(await boxOf(page, '#drop'));
  await page.mouse.move(drop.x, drop.y);
  await page.waitForTimeout(50);
  await page.mouse.click(drop.x, drop.y);

  await expect(page.locator('#drop #item-a')).toHaveCount(1);
  await expect(page.locator('#item-a-count')).toHaveText('0');
});

test('스페이스바로도 같은 두 번 누르기가 된다', async ({ context, serviceWorker }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/drag.html');
  await patchSettings(serviceWorker, { dragTwoPress: true });

  const a = center(await boxOf(page, '#item-a'));
  await page.mouse.move(a.x, a.y);
  await page.waitForTimeout(50);
  await page.keyboard.press('Space');

  await expect.poll(() => indicatorText(page)).toContain('놓을 곳을 누르세요');
  // D-07(떨림 필터): 같은 키(Space)는 tremorIntervalMs(기본 300ms) 안의 재입력을 무시한다 —
  // 두 번째 누름이 다른 대상을 향해도 키 자체는 같으므로 간격을 넘겨야 한다.
  await page.waitForTimeout(400);

  const drop = center(await boxOf(page, '#drop'));
  await page.mouse.move(drop.x, drop.y);
  await page.waitForTimeout(50);
  await page.keyboard.press('Space');

  await expect(page.locator('#drop #item-a')).toHaveCount(1);
});

test('A로 끌기 시작 뒤 Esc를 누르면 취소되어 놓을 곳을 눌러도 A가 옮겨지지 않는다', async ({ context, serviceWorker }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/drag.html');
  await patchSettings(serviceWorker, { dragTwoPress: true });

  const a = center(await boxOf(page, '#item-a'));
  await page.mouse.move(a.x, a.y);
  await page.waitForTimeout(50);
  await page.mouse.click(a.x, a.y);
  await expect.poll(() => indicatorText(page)).toContain('놓을 곳을 누르세요');

  await page.keyboard.press('Escape');
  await expect.poll(() => indicatorText(page)).toBe('도우미');

  const drop = center(await boxOf(page, '#drop'));
  await page.mouse.move(drop.x, drop.y);
  await page.waitForTimeout(50);
  await page.mouse.click(drop.x, drop.y);

  await expect(page.locator('#drop #item-a')).toHaveCount(0);
});

test('A로 끌기 시작 뒤 A를 다시 누르면 취소된다', async ({ context, serviceWorker }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/drag.html');
  await patchSettings(serviceWorker, { dragTwoPress: true });

  const a = center(await boxOf(page, '#item-a'));
  await page.mouse.move(a.x, a.y);
  await page.waitForTimeout(50);
  await page.mouse.click(a.x, a.y);
  await expect.poll(() => indicatorText(page)).toContain('놓을 곳을 누르세요');
  // D-07(떨림 필터): 같은 자리 재클릭은 tremorIntervalMs(기본 300ms) 안에서는 떨림으로 걸러진다
  // — "같은 대상을 다시 누르면 취소"는 걸러지지 않을 만큼 간격을 두고 눌러야 도달한다.
  await page.waitForTimeout(400);

  await page.mouse.click(a.x, a.y);
  await expect.poll(() => indicatorText(page)).toBe('도우미');

  const drop = center(await boxOf(page, '#drop'));
  await page.mouse.move(drop.x, drop.y);
  await page.waitForTimeout(50);
  await page.mouse.click(drop.x, drop.y);

  await expect(page.locator('#drop #item-a')).toHaveCount(0);
  await expect(page.locator('#item-a-count')).toHaveText('0');
});
