import { test, expect } from './fixtures';
import type { Worker } from '@playwright/test';

// D-10·D-13·D-17·CLICK-02·KEY-02: 잡힌 요소는 클릭·스페이스바로 커서 위치와 상관없이 눌리고,
// 잡힌 것이 없으면 원래대로다. 사이트가 window capture·keypress·keyup으로 스페이스바·숫자를
// 자체 단축키로 써도 도우미 모드에서는 도우미 키가 먼저다. 연습 사이트는
// tests/practice-site/targets.html·shortcuts.html(D-28).

async function patchSettings(serviceWorker: Worker, patch: Record<string, unknown>): Promise<void> {
  await serviceWorker.evaluate(async (p) => {
    const stored = await chrome.storage.sync.get('settings');
    const settings = stored.settings as { schemaVersion: number; data: Record<string, unknown> };
    await chrome.storage.sync.set({ settings: { ...settings, data: { ...settings.data, ...p } } });
  }, patch);
}

test('12×12px 버튼을 30px 밖에서 잡고 클릭하면 버튼이 눌리고 바탕은 눌리지 않는다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');

  const box = await page.locator('#btn-tiny').boundingBox();
  if (!box) {
    throw new Error('버튼을 찾지 못했다');
  }
  const x = box.x - 30;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.waitForTimeout(50);
  await page.mouse.click(x, y);

  await expect(page.locator('#btn-tiny-count')).toHaveText('1');
  await expect(page.locator('#bg-click-count')).toHaveText('0');
});

test('커서가 잡힌 버튼 위에 있을 때 클릭하면 버튼이 눌리고 원래 클릭(isTrusted)이 그대로 간다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');

  const box = await page.locator('#btn-tiny').boundingBox();
  if (!box) {
    throw new Error('버튼을 찾지 못했다');
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.waitForTimeout(50);
  await page.mouse.click(x, y);

  await expect(page.locator('#btn-tiny-count')).toHaveText('1');
  await expect(page.locator('#btn-tiny-count')).toHaveAttribute('data-last-trusted', 'true');
});

test('잡힌 상태에서 스페이스바를 누르면 버튼이 눌리고 페이지는 스크롤되지 않는다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');

  const box = await page.locator('#btn-tiny').boundingBox();
  if (!box) {
    throw new Error('버튼을 찾지 못했다');
  }
  await page.mouse.move(box.x - 30, box.y + box.height / 2);
  await page.waitForTimeout(50);

  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('Space');
  await page.waitForTimeout(50);
  const scrollAfter = await page.evaluate(() => window.scrollY);

  await expect(page.locator('#btn-tiny-count')).toHaveText('1');
  expect(scrollAfter).toBe(scrollBefore);
});

test('잡힌 것이 없을 때는 클릭이 커서 아래 요소에 그대로 가고 스페이스바는 페이지를 스크롤한다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');

  // 어떤 요소의 잡는 범위(48px)에도 들지 않는 빈 자리.
  await page.mouse.move(1200, 600);
  await page.waitForTimeout(50);
  await page.mouse.click(1200, 600);
  await expect(page.locator('#bg-click-count')).toHaveText('1');

  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('Space');
  await page.waitForTimeout(50);
  const scrollAfter = await page.evaluate(() => window.scrollY);
  expect(scrollAfter).toBeGreaterThan(scrollBefore);
});

test('체크박스를 잡고 스페이스바를 누르면 체크 상태가 바뀐다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');

  const box = await page.locator('#chk-space').boundingBox();
  if (!box) {
    throw new Error('체크박스를 찾지 못했다');
  }
  await expect(page.locator('#chk-space')).not.toBeChecked();

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(50);
  await page.keyboard.press('Space');

  await expect(page.locator('#chk-space')).toBeChecked();
});

test('링크를 잡고(커서는 밖) 클릭하면 다음 페이지로 이동한다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');

  const box = await page.locator('#nav-link').boundingBox();
  if (!box) {
    throw new Error('링크를 찾지 못했다');
  }
  const x = box.x - 20;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.waitForTimeout(50);
  await page.mouse.click(x, y);

  await expect(page).toHaveURL(/\/next\.html$/);
  await expect(page.locator('#next-heading')).toBeVisible();
});

test('사이트가 window capture·keypress·keyup으로 스페이스바를 쓰는 shortcuts.html에서도 잡힌 버튼이 먼저 눌리고 사이트 단축키는 실행되지 않는다', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/shortcuts.html');

  const box = await page.locator('#target').boundingBox();
  if (!box) {
    throw new Error('버튼을 찾지 못했다');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(50);
  await page.keyboard.press('Space');
  await page.waitForTimeout(50);

  await expect(page.locator('#target-count')).toHaveText('1');
  await expect(page.locator('#site-keydown')).toHaveText('0');
  await expect(page.locator('#site-keypress')).toHaveText('0');
  await expect(page.locator('#site-keyup')).toHaveText('0');
});

test('shortcuts.html의 입력칸에 초점이 있으면 스페이스바가 글자로 들어간다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/shortcuts.html');

  await page.locator('#text-input').click();
  await page.keyboard.press('Space');

  await expect(page.locator('#text-input')).toHaveValue(' ');
});

test('도우미를 끄면 같은 스페이스바가 사이트 단축키를 실행한다', async ({ context, serviceWorker }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/shortcuts.html');

  await patchSettings(serviceWorker, { enabled: false });
  await page.waitForTimeout(200);

  const box = await page.locator('#target').boundingBox();
  if (!box) {
    throw new Error('버튼을 찾지 못했다');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(50);
  await page.keyboard.press('Space');

  await expect(page.locator('#site-keydown')).toHaveText('1');
  await expect(page.locator('#target-count')).toHaveText('0');
});

test('CR-07: 오른쪽 클릭으로 남은 대신 누르기 예약이 나중의 상관없는 왼쪽 클릭에서 다시 실행되지 않는다', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');

  const box = await page.locator('#btn-tiny').boundingBox();
  if (!box) {
    throw new Error('버튼을 찾지 못했다');
  }
  const x = box.x - 30;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.waitForTimeout(50);
  // 오른쪽 클릭 — pointerdown은 자석이 btn-tiny를 잡아 가로채지만, 오른쪽 버튼은 click 대신
  // auxclick을 내므로 대신 누르기 예약(pendingPressExecute)이 실행되지 않은 채 남는다.
  await page.mouse.click(x, y, { button: 'right' });
  await page.waitForTimeout(50);

  // 상관없는 빈 자리(어떤 요소의 잡는 범위에도 안 듦)를 왼쪽 클릭 — 새 묶음이다.
  await page.mouse.move(1200, 600);
  await page.waitForTimeout(50);
  await page.mouse.click(1200, 600);
  await page.waitForTimeout(50);

  await expect(page.locator('#bg-click-count')).toHaveText('1');
  await expect(page.locator('#btn-tiny-count'), '오른쪽 클릭이 남긴 예약이 되살아나 대신 눌리면 안 된다').toHaveText(
    '0',
  );
});

test('버튼이 잡힌 상태에서 페이지가 만든 가짜(isTrusted=false) 스페이스바 keydown은 무시된다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');

  const box = await page.locator('#btn-tiny').boundingBox();
  if (!box) {
    throw new Error('버튼을 찾지 못했다');
  }
  await page.mouse.move(box.x - 30, box.y + box.height / 2);
  await page.waitForTimeout(50);

  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(50);

  await expect(page.locator('#btn-tiny-count')).toHaveText('0');
});
