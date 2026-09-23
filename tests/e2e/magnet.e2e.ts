import { test, expect } from './fixtures';
import type { Page, Worker } from '@playwright/test';

// D-04·D-10·D-26·D-27·CLICK-01: 커서에서 가장 가까운 요소를 넓은 범위·히스테리시스로 잡아 굵은
// 테두리로 강조한다. 연습 사이트는 tests/practice-site/targets.html(D-28).

const RING_OFFSET_PX = 8;
const RING_TOLERANCE_PX = 2;

async function patchSettings(serviceWorker: Worker, patch: Record<string, unknown>): Promise<void> {
  await serviceWorker.evaluate(async (p) => {
    const stored = await chrome.storage.sync.get('settings');
    const settings = stored.settings as { schemaVersion: number; data: Record<string, unknown> };
    await chrome.storage.sync.set({ settings: { ...settings, data: { ...settings.data, ...p } } });
  }, patch);
}

interface RingState {
  visible: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
  borderTopWidth: string;
}

async function readRing(page: Page): Promise<RingState | null> {
  return page.evaluate(() => {
    const el = document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('[data-part="ring"]');
    if (!el) {
      return null;
    }
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      visible: el.getAttribute('data-visible') === 'true',
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      borderTopWidth: style.borderTopWidth,
    };
  });
}

interface ExpectedRing {
  left: number;
  top: number;
  width: number;
  height: number;
}

function expectedRingFor(box: { x: number; y: number; width: number; height: number }): ExpectedRing {
  return {
    left: box.x - RING_OFFSET_PX,
    top: box.y - RING_OFFSET_PX,
    width: box.width + RING_OFFSET_PX * 2,
    height: box.height + RING_OFFSET_PX * 2,
  };
}

function closeTo(a: number, b: number, tolerance = RING_TOLERANCE_PX): boolean {
  return Math.abs(a - b) <= tolerance;
}

async function ringMatches(page: Page, expected: ExpectedRing): Promise<boolean> {
  const ring = await readRing(page);
  if (!ring || !ring.visible) {
    return false;
  }
  return (
    closeTo(ring.left, expected.left) &&
    closeTo(ring.top, expected.top) &&
    closeTo(ring.width, expected.width) &&
    closeTo(ring.height, expected.height)
  );
}

async function ringHidden(page: Page): Promise<boolean> {
  const ring = await readRing(page);
  return ring === null || !ring.visible;
}

test('12×12px 버튼에서 30px 떨어진 곳에 커서를 두면 테두리가 8px 바깥에 5px 두께로 보인다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');

  const box = await page.locator('#btn-tiny').boundingBox();
  if (!box) {
    throw new Error('버튼을 찾지 못했다');
  }
  // 버튼 왼쪽에서 30px 떨어진 곳(세로는 버튼 안 높이라 dy=0) — 거리 30px.
  await page.mouse.move(box.x - 30, box.y + box.height / 2);

  const expected = expectedRingFor(box);
  await expect.poll(() => ringMatches(page, expected)).toBe(true);

  const ring = await readRing(page);
  expect(ring?.borderTopWidth).toBe('5px');
});

test('모든 요소에서 100px 넘게 떨어진 곳에서는 테두리가 없다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');

  await page.mouse.move(900, 500);
  await page.waitForTimeout(50);

  expect(await ringHidden(page)).toBe(true);
});

test('버튼 A를 잡은 뒤 B가 10px 더 가까우면 A를 유지하고, 40px 더 가까우면 B로 바뀐다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');

  const boxA = await page.locator('#btn-a').boundingBox();
  const boxB = await page.locator('#btn-b').boundingBox();
  if (!boxA || !boxB) {
    throw new Error('버튼을 찾지 못했다');
  }
  const y = boxA.y + boxA.height / 2;

  // A 안쪽 — A를 잡는다.
  await page.mouse.move(boxA.x + boxA.width / 2, y);
  await expect.poll(() => ringMatches(page, expectedRingFor(boxA))).toBe(true);

  // A까지 29px, B까지 19px(B가 10px 더 가까움, 히스테리시스 24px 미만) — A 유지.
  await page.mouse.move(boxA.x + boxA.width + 29, y);
  await expect.poll(() => ringMatches(page, expectedRingFor(boxA))).toBe(true);

  // A까지 44px, B까지 4px(B가 40px 더 가까움, 히스테리시스 24px 초과) — B로 바뀜.
  await page.mouse.move(boxA.x + boxA.width + 44, y);
  await expect.poll(() => ringMatches(page, expectedRingFor(boxB))).toBe(true);
});

test('이미지 링크·onclick 이미지·role=button div가 각각 잡힌다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');

  for (const selector of ['#img-link', '#img-onclick', '#role-btn']) {
    const box = await page.locator(selector).boundingBox();
    if (!box) {
      throw new Error(`${selector} 요소를 찾지 못했다`);
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => ringMatches(page, expectedRingFor(box)), `${selector}가 잡혀야 한다`).toBe(true);
  }
});

test('display:none·visibility:hidden 버튼 근처에서는 잡히지 않는다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');

  // 두 버튼 모두 left:50~190px, top:150~190px 대역 — 그 근처를 지나도 잡히지 않아야 한다.
  await page.mouse.move(70, 170);
  await page.waitForTimeout(50);
  expect(await ringHidden(page)).toBe(true);

  await page.mouse.move(170, 170);
  await page.waitForTimeout(50);
  expect(await ringHidden(page)).toBe(true);
});

test('1초 뒤에 나타나는 입력칸 근처에 커서를 두면 나타난 뒤 곧 잡힌다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');

  const container = await page.locator('#late-container').boundingBox();
  if (!container) {
    throw new Error('late-container를 찾지 못했다');
  }
  // 아직 #late가 없을 때 그 자리 위에 커서를 미리 둔다.
  await page.mouse.move(container.x + container.width / 2, container.y + container.height / 2);
  expect(await ringHidden(page)).toBe(true);

  await page.waitForTimeout(1000);

  const box = await page.locator('#late').boundingBox();
  if (!box) {
    throw new Error('#late가 나타나지 않았다');
  }
  await expect.poll(() => ringMatches(page, expectedRingFor(box)), { timeout: 500, intervals: [20] }).toBe(true);
});

test('요소를 잡은 채 300px 스크롤하면 테두리가 새 위치를 따라간다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');

  await page.mouse.wheel(0, 1600);
  await page.waitForTimeout(50);

  const boxBeforeScroll = await page.locator('#btn-scroll').boundingBox();
  if (!boxBeforeScroll) {
    throw new Error('버튼을 찾지 못했다');
  }
  await page.mouse.move(boxBeforeScroll.x + boxBeforeScroll.width / 2, boxBeforeScroll.y + boxBeforeScroll.height / 2);
  await expect.poll(() => ringMatches(page, expectedRingFor(boxBeforeScroll))).toBe(true);

  await page.mouse.wheel(0, 300);

  const boxAfterScroll = await page.locator('#btn-scroll').boundingBox();
  if (!boxAfterScroll) {
    throw new Error('스크롤 뒤 버튼을 찾지 못했다');
  }
  await expect
    .poll(() => ringMatches(page, expectedRingFor(boxAfterScroll)), { timeout: 500, intervals: [20] })
    .toBe(true);
});

test('잡힌 요소를 페이지 스크립트가 지우면 곧 테두리가 없어진다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');

  const box = await page.locator('#btn-removable').boundingBox();
  if (!box) {
    throw new Error('버튼을 찾지 못했다');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => ringMatches(page, expectedRingFor(box))).toBe(true);

  await page.evaluate(() => document.getElementById('btn-removable')?.remove());

  await expect.poll(() => ringHidden(page), { timeout: 500, intervals: [20] }).toBe(true);
});

test('도우미 전체 끄기 상태에서는 테두리가 나타나지 않는다', async ({ context, serviceWorker }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');

  await patchSettings(serviceWorker, { enabled: false });
  await page.waitForTimeout(200);

  const box = await page.locator('#btn-tiny').boundingBox();
  if (!box) {
    throw new Error('버튼을 찾지 못했다');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(100);

  const hasOverlayHost = await page.evaluate(() => document.querySelector('tremor-helper-root') !== null);
  expect(hasOverlayHost).toBe(false);
});
