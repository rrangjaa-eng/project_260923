import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

// D-13·D-14·D-31·CLICK-02: 대신 누르기의 한계를 로컬 연습 사이트에서만 확인한다. 선택 목록·파일
// 선택은 이용자의 실제 키 입력 처리 안에서 showPicker()로 열고, 열리지 않으면 그 사실을 기록한다.
// 연습 사이트 밖으로 나가는 요청은 fixture가 모두 막고 기록한다(tests/e2e/fixtures.ts). 연습
// 사이트는 tests/practice-site/spike.html(D-28).

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

async function indicatorText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const el = host?.shadowRoot?.querySelector('.mode-indicator');
    return el?.textContent ?? '';
  });
}

// content script의 storage.sync.get(설정 읽기)이 끝나 도우미가 실제로 켜진 뒤에야 스페이스바·F가
// 뜻대로 먹는다 — hints.e2e.ts와 같은 이유로 모드 표시가 "도우미"로 뜨는 것을 직접 확인한다.
async function waitForHelperReady(page: Page): Promise<void> {
  await expect.poll(() => indicatorText(page)).toBe('도우미');
}

test('연습 사이트 밖으로 나가는 요청은 막히고 blockedRequests에 기록된다', async ({ context, servePage, blockedRequests }) => {
  servePage(
    'http://practice.test/spike-external.html',
    '<!doctype html><html><body><img src="http://example.invalid/x.png" /></body></html>',
  );
  const page = await context.newPage();
  await page.goto('http://practice.test/spike-external.html');
  await page.waitForTimeout(200);

  expect(blockedRequests).toContain('http://example.invalid/x.png');
});

test('select를 잡고 스페이스바를 누른 뒤 ArrowDown·Enter로 선택 값이 바뀌고 change가 기록된다', async ({
  context,
  expectNoExternalRequests,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/spike.html');
  await waitForHelperReady(page);

  const c = center(await boxOf(page, '#sel'));
  await page.mouse.move(c.x, c.y);
  await page.waitForTimeout(50);
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(50);

  await expect(page.locator('#sel-value')).toHaveText('banana');
  await expect(page.locator('#sel-change-count')).toHaveText('1');
  // 대신 누르기가 마우스 순서 대신 focus()+showPicker()만 불렀다는 근거 — click이 없다.
  await expect(page.locator('#sel-click-count')).toHaveText('0');
  expectNoExternalRequests();
});

test('파일 입력을 잡고 스페이스바를 누르면 filechooser 이벤트가 온다', async ({ context, expectNoExternalRequests }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/spike.html');
  await waitForHelperReady(page);

  const c = center(await boxOf(page, '#file'));
  await page.mouse.move(c.x, c.y);
  await page.waitForTimeout(50);

  const chooserPromise = page.waitForEvent('filechooser', { timeout: 1500 });
  await page.keyboard.press('Space');
  const chooser = await chooserPromise;

  expect(chooser).toBeTruthy();
  // 대신 누르기가 마우스 순서 대신 focus()+showPicker()만 불렀다는 근거 — click이 없다.
  await expect(page.locator('#file-click-count')).toHaveText('0');
  expectNoExternalRequests();
});
