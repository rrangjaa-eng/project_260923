import { test, expect } from './fixtures';
import type { Page, Worker } from '@playwright/test';

// D-18, D-26, SAFE-01, T-01-23: 위험한 버튼(이름에 dangerWords가 들어간 요소)은 자석 커서가
// 끌어당기지 않고 커서가 정확히 위(거리 0)에 있을 때만 잡힌다. 잡히면 빨간 점선 테두리 + "! 위험"
// 글자로 보인다. 번호표 숫자로는 위험한 버튼을 바로 누르지 않는다(확인 화면은 Plan 01-09). 연습
// 사이트는 tests/practice-site/danger.html(D-28) — 각 줄은 90px씩 떨어져 있고, 시험은 항상
// 커서를 가로로만 옮겨 다른 줄의 요소가 잡는 범위(기본 48px)에 걸리지 않게 한다.

const RING_OFFSET_PX = 8;
const RING_TOLERANCE_PX = 2;

async function patchSettings(serviceWorker: Worker, patch: Record<string, unknown>): Promise<void> {
  await serviceWorker.evaluate(async (p) => {
    const stored = await chrome.storage.sync.get('settings');
    const settings = stored.settings as { schemaVersion: number; data: Record<string, unknown> };
    await chrome.storage.sync.set({ settings: { ...settings, data: { ...settings.data, ...p } } });
  }, patch);
}

async function indicatorText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const el = host?.shadowRoot?.querySelector('.mode-indicator');
    return el?.textContent ?? '';
  });
}

// content script의 storage.sync.get(설정 읽기)이 끝나 도우미가 실제로 켜진 뒤에야 자석·번호표가
// 뜻대로 먹는다 — 고정 시간 대기 대신 모드 표시가 "도우미"로 뜨는 것을 직접 확인해 경합을 없앤다.
async function waitForHelperReady(page: Page): Promise<void> {
  await expect.poll(() => indicatorText(page)).toBe('도우미');
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

interface RingState {
  visible: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
  borderStyle: string;
  borderColorMatchesDanger: boolean;
}

async function readRing(page: Page): Promise<RingState | null> {
  return page.evaluate(() => {
    const shadow = document.querySelector('tremor-helper-root')?.shadowRoot;
    const el = shadow?.querySelector('[data-part="ring"]');
    if (!shadow || !el) {
      return null;
    }
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);

    // --danger 토큰의 실제 계산 값을 얻어(하드코딩 없이) 테두리 색과 비교한다.
    const probe = document.createElement('div');
    probe.style.color = 'var(--danger)';
    shadow.append(probe);
    const dangerColor = getComputedStyle(probe).color;
    probe.remove();

    return {
      visible: el.getAttribute('data-visible') === 'true',
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      borderStyle: style.borderTopStyle,
      borderColorMatchesDanger: style.borderTopColor === dangerColor,
    };
  });
}

interface ExpectedRing {
  left: number;
  top: number;
  width: number;
  height: number;
}

function expectedRingFor(box: Box): ExpectedRing {
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

interface DangerLabelState {
  visible: boolean;
  text: string | null;
}

async function readDangerLabel(page: Page): Promise<DangerLabelState | null> {
  return page.evaluate(() => {
    const shadow = document.querySelector('tremor-helper-root')?.shadowRoot;
    const el = shadow?.querySelector('.ring-danger-label');
    if (!el) {
      return null;
    }
    return { visible: el.getAttribute('data-visible') === 'true', text: el.textContent };
  });
}

async function labelTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const labels = host?.shadowRoot?.querySelectorAll('.hint-label');
    return labels ? Array.from(labels).map((el) => el.textContent) : [];
  });
}

// 요소의 기본 배치 자리(왼쪽 위 바깥 −14px,−14px)에 가장 가까운 번호표를 찾는다(hints.e2e.ts와
// 같은 방식) — 겹침 대안 자리로 옮겨도 이 페이지의 줄 간격(90px)이 충분히 넓어 항상 더 가깝다.
async function numberForElement(page: Page, elementId: string): Promise<string> {
  const box = await boxOf(page, `#${elementId}`);
  return page.evaluate(
    ({ x, y }) => {
      const host = document.querySelector('tremor-helper-root');
      const labels = host?.shadowRoot?.querySelectorAll('.hint-label');
      if (!labels) {
        return '';
      }
      let closestText = '';
      let closestDistance = Number.POSITIVE_INFINITY;
      for (const label of Array.from(labels)) {
        const rect = label.getBoundingClientRect();
        const distance = Math.hypot(rect.x - (x - 14), rect.y - (y - 14));
        if (distance < closestDistance) {
          closestDistance = distance;
          closestText = label.textContent;
        }
      }
      return closestText;
    },
    { x: box.x, y: box.y },
  );
}

test('저장 옆 20px 밖(범위 안에 저장도 있음)에서는 저장이 잡힌다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  const saveBox = await boxOf(page, '#btn-save');
  const deleteBox = await boxOf(page, '#btn-delete-paired');
  const y = deleteBox.y + deleteBox.height / 2;

  // 삭제 왼쪽 모서리에서 20px 밖(저장 쪽) — 저장까지도 20px(48px 범위 안).
  await page.mouse.move(deleteBox.x - 20, y);

  await expect.poll(() => ringMatches(page, expectedRingFor(saveBox))).toBe(true);
});

test('범위 안에 다른 요소 없이 삭제에서 20px 밖이면 아무것도 잡히지 않는다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  const box = await boxOf(page, '#btn-delete-solo');
  const y = box.y + box.height / 2;

  await page.mouse.move(box.x - 20, y);
  await page.waitForTimeout(50);

  expect(await ringHidden(page)).toBe(true);
});

test('커서가 삭제 위에 정확히 있으면 잡히고 빨간 점선 테두리에 "! 위험" 글자가 보인다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  const box = await boxOf(page, '#btn-delete-solo');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  await expect.poll(() => ringMatches(page, expectedRingFor(box))).toBe(true);
  const ring = await readRing(page);
  expect(ring?.borderStyle).toBe('dashed');
  expect(ring?.borderColorMatchesDanger).toBe(true);

  const label = await readDangerLabel(page);
  expect(label?.visible).toBe(true);
  expect(label?.text).toBe('! 위험');
});

test('잡힌 삭제에서 커서를 5px 밖으로 옮기면 테두리가 없어진다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  const box = await boxOf(page, '#btn-delete-solo');
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await expect.poll(() => ringMatches(page, expectedRingFor(box))).toBe(true);

  await page.mouse.move(box.x - 5, y);
  await page.waitForTimeout(50);

  expect(await ringHidden(page)).toBe(true);
});

test('결재 취소·로그아웃 링크·반려도 20px 밖에서 끌려오지 않는다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  for (const selector of ['#btn-cancel-approval', '#link-logout', '#btn-reject']) {
    const box = await boxOf(page, selector);
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x - 20, y);
    await page.waitForTimeout(50);
    expect(await ringHidden(page), `${selector}가 잡히면 안 된다`).toBe(true);
  }
});

test('상신은 30px 밖에서 일반 요소처럼 잡힌다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  const box = await boxOf(page, '#btn-submit');
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x - 30, y);

  await expect.poll(() => ringMatches(page, expectedRingFor(box))).toBe(true);
  const ring = await readRing(page);
  expect(ring?.borderStyle).toBe('solid');
  expect(ring?.borderColorMatchesDanger).toBe(false);
});

test("SW에서 dangerWords에 '보류'를 더하면 보류 버튼이 20px 밖에서 끌려오지 않는다", async ({
  context,
  serviceWorker,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  const box = await boxOf(page, '#btn-hold');
  const y = box.y + box.height / 2;

  // 목록을 바꾸기 전에는 일반 요소로 잡힌다.
  await page.mouse.move(box.x - 20, y);
  await expect.poll(() => ringMatches(page, expectedRingFor(box))).toBe(true);

  await patchSettings(serviceWorker, { dangerWords: ['삭제', '취소', '반려', '로그아웃', '결재 취소', '보류'] });

  // 목록이 바뀐 뒤 다시 같은 자리로 움직여야(재계산은 pointermove가 부른다) 새 판정이 반영된다.
  await page.mouse.move(box.x - 21, y);
  await page.mouse.move(box.x - 20, y);
  await expect.poll(() => ringHidden(page)).toBe(true);
});

test('번호표를 켜고 삭제의 번호를 눌러도 삭제 카운터가 0이다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(50);
  expect((await labelTexts(page)).length).toBeGreaterThan(0);

  const number = await numberForElement(page, 'btn-delete-solo');
  expect(number).not.toBe('');

  await page.keyboard.press(`Digit${number}`);
  await page.waitForTimeout(100);

  await expect(page.locator('#btn-delete-solo-count')).toHaveText('0');
});

test('CR-05: <input type=button value=삭제>, <a><img alt=삭제>, aria-labelledby 버튼도 위험으로 잡힌다', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  for (const selector of ['#btn-delete-input', '#link-delete-img', '#btn-delete-labelledby']) {
    const box = await boxOf(page, selector);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    await expect.poll(() => ringMatches(page, expectedRingFor(box))).toBe(true);
    const ring = await readRing(page);
    expect(ring?.borderStyle, `${selector}는 점선 테두리여야 한다`).toBe('dashed');
    expect(ring?.borderColorMatchesDanger, `${selector}는 danger 색이어야 한다`).toBe(true);

    const label = await readDangerLabel(page);
    expect(label?.visible, `${selector}는 "! 위험" 글자가 보여야 한다`).toBe(true);
    expect(label?.text).toBe('! 위험');
  }
});

test('커서가 삭제 위에 정확히 있을 때 스페이스바를 누르면 삭제 카운터가 1이 된다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  const box = await boxOf(page, '#btn-delete-solo');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => ringMatches(page, expectedRingFor(box))).toBe(true);

  await page.keyboard.press('Space');
  await page.waitForTimeout(50);

  await expect(page.locator('#btn-delete-solo-count')).toHaveText('1');
});
