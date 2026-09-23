import { test, expect } from './fixtures';
import type { Worker } from '@playwright/test';

// D-06·D-07·D-09·FILT-01~03: 입력 파이프라인이 떨림 재입력·자동 반복·의도치 않은 더블클릭을
// 한 번으로 줄인다. 연습 사이트는 tests/practice-site/input.html(D-28), 입력은 모두
// page.mouse/page.keyboard로 브라우저가 isTrusted로 표시하는 진짜 입력이다.

async function patchSettings(serviceWorker: Worker, patch: Record<string, unknown>): Promise<void> {
  await serviceWorker.evaluate(async (p) => {
    const stored = await chrome.storage.sync.get('settings');
    const settings = stored.settings as { schemaVersion: number; data: Record<string, unknown> };
    await chrome.storage.sync.set({ settings: { ...settings, data: { ...settings.data, ...p } } });
  }, patch);
}

test('같은 자리를 100ms 간격으로 두 번 클릭하면 사이트는 클릭을 한 번만 받는다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/input.html');
  const box = await page.locator('#btn-a').boundingBox();
  if (!box) {
    throw new Error('버튼 위치를 찾지 못했다');
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.click(x, y);
  await page.waitForTimeout(100);
  await page.mouse.click(x, y);

  await expect(page.locator('#count-a')).toHaveText('1');
});

test('같은 자리를 400ms 간격으로 두 번 클릭하면 사이트는 클릭을 두 번 받는다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/input.html');
  const box = await page.locator('#btn-a').boundingBox();
  if (!box) {
    throw new Error('버튼 위치를 찾지 못했다');
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.click(x, y);
  await page.waitForTimeout(400);
  await page.mouse.click(x, y);

  await expect(page.locator('#count-a')).toHaveText('2');
});

test('40px 떨어진 두 버튼을 100ms 간격으로 클릭하면 각 카운터가 1이다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/input.html');
  const boxA = await page.locator('#btn-a').boundingBox();
  const boxB = await page.locator('#btn-b').boundingBox();
  if (!boxA || !boxB) {
    throw new Error('버튼 위치를 찾지 못했다');
  }

  await page.mouse.click(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2);
  await page.waitForTimeout(100);
  await page.mouse.click(boxB.x + boxB.width / 2, boxB.y + boxB.height / 2);

  await expect(page.locator('#count-a')).toHaveText('1');
  await expect(page.locator('#count-b')).toHaveText('1');
});

test('의도치 않은 더블클릭은 사이트에 클릭 한 번으로만 전달되고 dblclick은 전달되지 않는다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/input.html');

  await page.locator('#btn-a').dblclick();

  await expect(page.locator('#count-a')).toHaveText('1');
  await expect(page.locator('#dbl-a')).toHaveText('0');
});

test('입력칸에서 같은 글자를 100ms 간격으로 누르면 하나만 들어가고, 400ms 간격이면 새로 들어간다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/input.html');
  await page.locator('#name').click();

  await page.keyboard.press('a');
  await page.waitForTimeout(100);
  await page.keyboard.press('a');
  await expect(page.locator('#name')).toHaveValue('a');

  await page.waitForTimeout(400);
  await page.keyboard.press('a');
  await expect(page.locator('#name')).toHaveValue('aa');
});

test('키를 오래 눌러도(자동 반복) 글자는 한 번만 들어간다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/input.html');
  await page.locator('#name').click();

  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.down('b');
  }
  await page.keyboard.up('b');

  await expect(page.locator('#name')).toHaveValue('b');
});

test('설정의 tremorIntervalMs를 100으로 바꾸면 200ms 간격 두 클릭이 즉시 반영되어 둘 다 들어간다', async ({
  context,
  serviceWorker,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/input.html');

  await patchSettings(serviceWorker, { tremorIntervalMs: 100 });
  // content script가 storage.onChanged를 받을 시간을 준다(즉시 반영 확인).
  await page.waitForTimeout(200);

  const box = await page.locator('#btn-a').boundingBox();
  if (!box) {
    throw new Error('버튼 위치를 찾지 못했다');
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.click(x, y);
  await page.waitForTimeout(200);
  await page.mouse.click(x, y);

  await expect(page.locator('#count-a')).toHaveText('2');
});

test('도우미를 꺼 두면 떨림 필터도 동작하지 않아 100ms 간격 두 클릭이 모두 들어간다', async ({ context, serviceWorker }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/input.html');

  await patchSettings(serviceWorker, { enabled: false });
  await page.waitForTimeout(200);

  const box = await page.locator('#btn-a').boundingBox();
  if (!box) {
    throw new Error('버튼 위치를 찾지 못했다');
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.click(x, y);
  await page.waitForTimeout(100);
  await page.mouse.click(x, y);

  await expect(page.locator('#count-a')).toHaveText('2');
});
