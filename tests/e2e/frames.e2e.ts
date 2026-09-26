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

// F를 누를 때마다 그 순간까지 맨 위가 알고 있는 프레임 보고 스냅샷으로 번호를 매긴다(openHints는
// 한 번 계산하고 끝, 나중에 보고가 더 와도 스스로 다시 열리지 않는다) — 그래서 고정 대기 대신
// "번호표가 기대한 개수만큼 뜰 때까지" F를 다시 눌러 본다(같은 키 재입력이므로 떨림 간격(300ms,
// D-07)보다 넉넉히 띄운다). 프레임 5개(맨 위+같은 출처 자식+다른 출처 자식+중첩 손자 2단)가 각자
// collect() → frame/report → relay → frames/reports 왕복을 마치는 시간은 프레임마다 다르다.
async function pressFUntilLabelCount(page: Page, expectedCount: number): Promise<string[]> {
  let lastTexts: string[] = [];
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(120);
    lastTexts = await labelTexts(page);
    if (lastTexts.length >= expectedCount) {
      return lastTexts;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
  }
  return lastTexts;
}

async function openFrames(page: Page): Promise<void> {
  await page.goto('http://practice.test/frames.html');
  await waitForHelperReady(page);
}

test('F를 누르면 맨 위·같은 출처 자식·다른 출처 자식·중첩 손자 프레임의 요소 모두에 번호표가 붙고 번호가 1부터 중복 없다', async ({
  context,
}) => {
  const page = await context.newPage();
  await openFrames(page);

  const texts = await pressFUntilLabelCount(page, 7);
  const numbers = texts.map(Number).sort((a, b) => a - b);
  expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7]);
});

test('iframe 안 요소의 번호표가 그 요소의 맨 위 좌표 사각형에서 배치 규칙 자리(±2px)에 있다', async ({ context }) => {
  const page = await context.newPage();
  await openFrames(page);
  await pressFUntilLabelCount(page, 7);

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
  await pressFUntilLabelCount(page, 7);

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
  await pressFUntilLabelCount(page, 7);

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

  const before = await pressFUntilLabelCount(page, 7);
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

  const after = await pressFUntilLabelCount(page, 6);
  expect(after.length).toBe(6);
});

test('페이지 스크립트가 iframe 하나를 지운 뒤 F → 그 프레임 요소의 번호표가 없다', async ({ context }) => {
  const page = await context.newPage();
  await openFrames(page);

  await page.locator('#remove-cross').click();
  await page.waitForTimeout(300);

  const texts = await pressFUntilLabelCount(page, 6);
  expect(texts.length).toBe(6);
});

// Task 3(D-03, D-09, T-01-19): 초점이 자식 프레임 안(입력칸 밖)에 있어도 F·숫자가 hints/key로
// 맨 위에 전달되어 번호표를 열고 다른 프레임 요소를 누른다. 초점이 iframe 안이면(맨 위 문서의
// activeElement가 그 iframe 자신이 됨) 맨 위 모드 표시는 그 프레임이 보낸 mode/report를 따른다.
// 번호표가 떠 있지 않을 때는 자식 프레임의 숫자를 도우미가 삼키지 않는다.

test('other.test 자식 프레임 안(입력칸 밖)에 초점이 있어도 F로 번호표가 뜨고 숫자로 다른 프레임 요소가 눌린다', async ({
  context,
}) => {
  const page = await context.newPage();
  await openFrames(page);

  await page.frameLocator('#frame-cross').locator('#btn-cross').click();
  await expect(page.frameLocator('#frame-cross').locator('#cross-count')).toHaveText('1');

  await pressFUntilLabelCount(page, 7);

  const topBox = await page.locator('#btn-top').boundingBox();
  if (!topBox) {
    throw new Error('버튼을 찾지 못했다');
  }
  const number = await numberNearPoint(page, topBox.x - 14, topBox.y - 14);
  expect(number).not.toBe('');
  await page.keyboard.press(`Digit${number}`);
  await page.waitForTimeout(300);

  await expect(page.locator('#top-count')).toHaveText('1');
});

test('중첩 손자 프레임의 입력칸에 초점이 가면 맨 위 모드 표시가 typing이 되고, Esc를 누르면 helper로 돌아간다', async ({
  context,
}) => {
  const page = await context.newPage();
  await openFrames(page);

  const leafInput = page.frameLocator('#frame-nest').frameLocator('#frame-leaf').locator('#input-leaf');
  await leafInput.click();

  await expect
    .poll(() => page.evaluate(() => document.querySelector('tremor-helper-root')?.getAttribute('data-mode')))
    .toBe('typing');

  await page.keyboard.press('Escape');

  await expect
    .poll(() => page.evaluate(() => document.querySelector('tremor-helper-root')?.getAttribute('data-mode')))
    .toBe('helper');
});

test('번호표가 떠 있지 않을 때 자식 프레임에서 누른 숫자는 그 프레임 페이지로 그대로 간다', async ({ context }) => {
  const page = await context.newPage();
  await openFrames(page);

  const frame = page.frames().find((candidate) => candidate.url().includes('child=same'));
  if (!frame) {
    throw new Error('frame-same을 찾지 못했다');
  }
  await frame.locator('#btn-same').click();
  await frame.evaluate(() => {
    (window as unknown as { __digitSeen?: boolean }).__digitSeen = false;
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Digit1') {
        (window as unknown as { __digitSeen?: boolean }).__digitSeen = true;
      }
    });
  });

  await page.keyboard.press('Digit1');
  await page.waitForTimeout(150);

  const seen = await frame.evaluate(() => (window as unknown as { __digitSeen?: boolean }).__digitSeen);
  expect(seen).toBe(true);

  const texts = await labelTexts(page);
  expect(texts.length).toBe(0);
});

async function pressesEntries(
  serviceWorker: import('@playwright/test').Worker,
  origin: string,
): Promise<Array<{ fingerprint: { framePath: string[] }; count: number }>> {
  const key = `presses:${origin}`;
  return serviceWorker.evaluate(async (storageKey) => {
    const result = await chrome.storage.local.get(storageKey);
    const stored = result[storageKey] as
      | { data?: { counts?: Array<{ fingerprint: { framePath: string[] }; count: number }> } }
      | undefined;
    return stored?.data?.counts ?? [];
  }, key);
}

test('WR-05: 다른 출처 자식 프레임에서 자석으로 직접 누른 기록도 자식 자신이 아니라 맨 위 페이지 출처에 쌓인다', async ({
  context,
  serviceWorker,
}) => {
  const page = await context.newPage();
  await openFrames(page);

  const box = await page.frameLocator('#frame-cross').locator('#btn-cross').boundingBox();
  if (!box) {
    throw new Error('frame-cross 안 버튼을 찾지 못했다');
  }
  // 요소 밖(잡는 범위 안)을 눌러 자석이 대신 누르기를 거치게 한다(hints.e2e.ts WR-04와 같은 이유).
  const x = box.x - 10;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.waitForTimeout(50);
  await page.mouse.click(x, y);
  await page.waitForTimeout(300);

  const topEntries = await pressesEntries(serviceWorker, 'http://practice.test');
  expect(topEntries.length, '다른 출처(other.test) 자식의 기록도 사이트 = 맨 위 페이지 출처(D-20)에 쌓여야 한다').toBeGreaterThan(
    0,
  );
});

test('WR-05: 같은 출처 자식 프레임과 맨 위가 똑같은 틀(글자·자리)을 써도 기록이 서로 섞이지 않는다', async ({
  context,
  servePage,
  serviceWorker,
}) => {
  servePage(
    'http://practice.test/wr05-child.html',
    '<!doctype html><html><body style="margin:0">' +
      '<button style="position:absolute;left:20px;top:20px;width:40px;height:40px">같음</button>' +
      '</body></html>',
  );
  servePage(
    'http://practice.test/wr05-top.html',
    '<!doctype html><html><body style="margin:0">' +
      '<button style="position:absolute;left:300px;top:300px;width:40px;height:40px">같음</button>' +
      '<iframe id="frame-same-tmpl" src="/wr05-child.html" style="position:absolute;left:0;top:0;width:200px;height:200px;border:0"></iframe>' +
      '</body></html>',
  );

  const page = await context.newPage();
  await page.goto('http://practice.test/wr05-top.html');
  await expect
    .poll(() => page.evaluate(() => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.mode-indicator')?.textContent))
    .toBe('도우미');
  await page.waitForTimeout(200);

  const childBox = await page.frameLocator('#frame-same-tmpl').locator('button').boundingBox();
  if (!childBox) {
    throw new Error('자식 프레임 안 버튼을 찾지 못했다');
  }
  await page.mouse.move(childBox.x - 10, childBox.y + childBox.height / 2);
  await page.waitForTimeout(50);
  await page.mouse.click(childBox.x - 10, childBox.y + childBox.height / 2);
  await page.waitForTimeout(300);

  const topBox = await page.locator('body > button').boundingBox();
  if (!topBox) {
    throw new Error('맨 위 버튼을 찾지 못했다');
  }
  await page.mouse.move(topBox.x - 10, topBox.y + topBox.height / 2);
  await page.waitForTimeout(50);
  await page.mouse.click(topBox.x - 10, topBox.y + topBox.height / 2);
  await page.waitForTimeout(300);

  const entries = await pressesEntries(serviceWorker, 'http://practice.test');
  expect(
    entries.length,
    '같은 글자·자리 구조를 공유해도(도메인 공통 템플릿) 자식과 맨 위 요소는 서로 다른 기록이어야 한다',
  ).toBe(2);
  for (const entry of entries) {
    expect(entry.count, '서로 다른 요소의 기록이 하나로 합쳐지면 안 된다').toBe(1);
  }
});

// WR-04(01-REVIEW.md 2회차): WR-07이 쿼리 문자열은 뺐지만, 경로 안 세션 ID(예: 서블릿 URL
// 재작성 `;jsessionid=…`, 전자정부 프레임워크·Spring 등에서 흔하다)는 origin+pathname 좁히기로도
// 그대로 남는다. 이 근사 framePath는 D-11 번호 순서에 쓰이지 않는(hints 경로만 정확히 쓰인다)
// 죽은 데이터라 — 자식 프레임의 자석·머무르기·스페이스바 직접 누르기는 이제 기록을 전혀 보내지
// 않는다(누르기 자체는 그대로 한다).
test('WR-04: 자식 프레임 안에서 자석으로 직접 누른 것은 경로 안 세션 ID를 저장소에 남기지 않는다(기록 자체를 보내지 않는다)', async ({
  context,
  servePage,
  serviceWorker,
}) => {
  servePage(
    'http://practice.test/wr04-child.html;jsessionid=secret123',
    '<!doctype html><html><body style="margin:0">' +
      '<button style="position:absolute;left:20px;top:20px;width:40px;height:40px">child</button>' +
      '</body></html>',
  );
  servePage(
    'http://practice.test/wr04-top.html',
    '<!doctype html><html><body style="margin:0">' +
      '<iframe id="frame-wr04" src="/wr04-child.html;jsessionid=secret123" style="position:absolute;left:0;top:0;width:200px;height:200px;border:0"></iframe>' +
      '</body></html>',
  );

  const page = await context.newPage();
  await page.goto('http://practice.test/wr04-top.html');
  await expect
    .poll(() => page.evaluate(() => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.mode-indicator')?.textContent))
    .toBe('도우미');
  await page.waitForTimeout(200);

  const childBox = await page.frameLocator('#frame-wr04').locator('button').boundingBox();
  if (!childBox) {
    throw new Error('자식 프레임 안 버튼을 찾지 못했다');
  }
  await page.mouse.move(childBox.x - 10, childBox.y + childBox.height / 2);
  await page.waitForTimeout(50);
  await page.mouse.click(childBox.x - 10, childBox.y + childBox.height / 2);
  await page.waitForTimeout(300);

  const entries = await pressesEntries(serviceWorker, 'http://practice.test');
  expect(entries.length, 'framePath를 모르는 자식 프레임 직접 누르기는 기록을 보내지 않아야 한다').toBe(0);
});
