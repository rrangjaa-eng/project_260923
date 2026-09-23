import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

// D-03·D-09·D-28·ELEM-02: iframe(중첩·다른 출처) 안 요소도 맨 위 화면의 번호표에 합쳐진다. 각
// 프레임이 자기 요소와 자식 iframe 자리를 service worker를 거쳐 맨 위에 보고하고(frame/report →
// relay → frames/reports), 맨 위가 composeTree로 좌표를 합성해 번호를 한 번만 매긴다. 누르기는
// hints/press → press/request로 해당 프레임에 돌아간다. 연습 사이트는 tests/practice-site/frames.html
// (맨 위: btn-top·remove-cross·scroll-box 안 frame-same·frame-cross(other.test)·frame-nest, frame-nest
// 안에 frame-leaf(other.test) 손자).

async function labelTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const labels = host?.shadowRoot?.querySelectorAll('.hint-label');
    return labels ? Array.from(labels).map((el) => el.textContent) : [];
  });
}

async function labelBoxes(page: Page): Promise<Array<{ x: number; y: number; width: number; height: number }>> {
  return page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const labels = host?.shadowRoot?.querySelectorAll('.hint-label');
    if (!labels) {
      return [];
    }
    return Array.from(labels).map((el) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
  });
}

async function indicatorText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const el = host?.shadowRoot?.querySelector('.mode-indicator');
    return el?.textContent ?? '';
  });
}

// content script의 storage.sync.get(설정 읽기)이 끝나 도우미가 실제로 켜진 뒤에야 F가 뜻대로
// 먹는다(hints.e2e.ts와 같은 이유) — 고정 시간 대기 대신 모드 표시로 확인해 경합을 없앤다.
async function waitForHelperReady(page: Page): Promise<void> {
  await expect.poll(() => indicatorText(page)).toBe('도우미');
}

async function numberNearPoint(page: Page, x: number, y: number): Promise<string> {
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
        const distance = Math.hypot(rect.x - x, rect.y - y);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestText = label.textContent;
        }
      }
      return closestText;
    },
    { x, y },
  );
}

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function openFrames(page: Page): Promise<void> {
  await page.goto('http://practice.test/frames.html');
  await waitForHelperReady(page);
  // 프레임 셋(맨 위 + 같은 출처 자식 + 다른 출처 자식 + 중첩 손자)이 각자 collect()하고
  // frame/report → relay → frames/reports 왕복을 마칠 시간(여러 프레임 로드 + 메시지 왕복).
  await page.waitForTimeout(500);
}

test('F를 누르면 맨 위·같은 출처 자식·다른 출처 자식·중첩 손자 프레임의 요소 모두에 번호표가 붙고 번호가 1부터 중복 없다', async ({
  context,
}) => {
  const page = await context.newPage();
  await openFrames(page);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(150);

  const texts = await labelTexts(page);
  const numbers = texts.map(Number).sort((a, b) => a - b);
  expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7]);
});

test('iframe 안 요소의 번호표가 그 요소의 맨 위 좌표 사각형에서 배치 규칙 자리(±2px)에 있다', async ({ context }) => {
  const page = await context.newPage();
  await openFrames(page);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(150);

  const box = await page.frameLocator('#frame-cross').locator('#btn-cross').boundingBox();
  if (!box) {
    throw new Error('버튼을 찾지 못했다');
  }
  const expectedX = box.x - 14;
  const expectedY = box.y - 14;

  const boxes = await labelBoxes(page);
  let nearest: { x: number; y: number } | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of boxes) {
    const distance = Math.hypot(candidate.x - expectedX, candidate.y - expectedY);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = candidate;
    }
  }

  expect(nearest).not.toBeNull();
  expect(Math.abs((nearest as { x: number; y: number }).x - expectedX)).toBeLessThanOrEqual(2);
  expect(Math.abs((nearest as { x: number; y: number }).y - expectedY)).toBeLessThanOrEqual(2);
});

test('모든 번호표 쌍이 서로 겹치지 않는다', async ({ context }) => {
  const page = await context.newPage();
  await openFrames(page);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(150);

  const boxes = await labelBoxes(page);
  expect(boxes.length).toBe(7);
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      if (!a || !b) {
        continue;
      }
      expect(boxesOverlap(a, b)).toBe(false);
    }
  }
});

test('other.test 자식의 버튼 번호를 누르면 그 버튼 카운터가 1 오른다', async ({ context }) => {
  const page = await context.newPage();
  await openFrames(page);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(150);

  const box = await page.frameLocator('#frame-cross').locator('#btn-cross').boundingBox();
  if (!box) {
    throw new Error('버튼을 찾지 못했다');
  }
  const number = await numberNearPoint(page, box.x - 14, box.y - 14);
  expect(number).not.toBe('');
  await page.keyboard.press(`Digit${number}`);
  await page.waitForTimeout(300);

  await expect(page.frameLocator('#frame-cross').locator('#cross-count')).toHaveText('1');
});

test('other.test 자식의 작은 버튼 근처로 커서를 두면 그 프레임 안에 테두리가 그려진다', async ({ context }) => {
  const page = await context.newPage();
  await openFrames(page);

  const box = await page.frameLocator('#frame-cross').locator('#btn-cross').boundingBox();
  if (!box) {
    throw new Error('버튼을 찾지 못했다');
  }
  await page.mouse.move(box.x - 20, box.y + box.height / 2);
  await page.waitForTimeout(150);

  const visible = await page
    .frameLocator('#frame-cross')
    .locator('tremor-helper-root')
    .evaluate((host) => host.shadowRoot?.querySelector('.ring')?.getAttribute('data-visible') === 'true');
  expect(visible).toBe(true);
});

test('자식 iframe을 부모 안에서 스크롤해 반쯤 가린 뒤 F → 가려진 요소에는 번호표가 없다', async ({ context }) => {
  const page = await context.newPage();
  await openFrames(page);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(150);
  const before = await labelTexts(page);
  expect(before.length).toBe(7);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  await page.evaluate(() => {
    const box = document.getElementById('scroll-box');
    if (box) {
      box.scrollTop = 250;
    }
  });
  await page.waitForTimeout(300);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(150);
  const after = await labelTexts(page);
  expect(after.length).toBe(6);
});

test('페이지 스크립트가 iframe 하나를 지운 뒤 F → 그 프레임 요소의 번호표가 없다', async ({ context }) => {
  const page = await context.newPage();
  await openFrames(page);

  await page.locator('#remove-cross').click();
  await page.waitForTimeout(300);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(150);
  const texts = await labelTexts(page);
  expect(texts.length).toBe(6);
});
