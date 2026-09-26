import { test, expect } from './fixtures';
import type { Locator, Page, Worker } from '@playwright/test';

// D-12, D-18, CLICK-04, SAFE-01: 머무르기 클릭 — 기본은 꺼짐, 메뉴 카드("3 머무르기 클릭")로
// 켜고 끈다. 켜면 잡힌 요소 위에 커서가 dwellMs(기본 800ms)만큼 머물 때 진행 표시가 차오른
// 뒤 한 번만 눌리고, 그 전에 치우면 취소, 위험한 버튼은 제외한다. 연습 사이트는
// tests/practice-site/targets.html·danger.html(D-28).

async function patchSettings(serviceWorker: Worker, patch: Record<string, unknown>): Promise<void> {
  await serviceWorker.evaluate(async (p) => {
    const stored = await chrome.storage.sync.get('settings');
    const settings = stored.settings as { schemaVersion: number; data: Record<string, unknown> };
    await chrome.storage.sync.set({ settings: { ...settings, data: { ...settings.data, ...p } } });
  }, patch);
}

async function readDwellEnabled(serviceWorker: Worker): Promise<boolean | undefined> {
  const stored = (await serviceWorker.evaluate(() => chrome.storage.sync.get('settings'))) as {
    settings?: { data?: { dwellEnabled?: boolean } };
  };
  return stored.settings?.data?.dwellEnabled;
}

// ring.ts의 setDwellProgress가 그리는 SVG의 data-progress를 읽는다. 감춰져 있으면 null.
async function readDwellProgress(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const el = document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.dwell-progress');
    if (!el || el.getAttribute('data-visible') !== 'true') {
      return null;
    }
    const raw = el.getAttribute('data-progress');
    return raw === null ? null : Number(raw);
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

test('기본 설정에서 잡힌 버튼 위에 1.5초 머물러도 카운터는 0이다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');

  const c = center(await boxOf(page, '#btn-tiny'));
  await page.mouse.move(c.x, c.y);
  await page.waitForTimeout(1500);

  await expect(page.locator('#btn-tiny-count')).toHaveText('0');
});

test('메뉴에서 "3 머무르기 클릭 켜기" 카드를 누르면 dwellEnabled가 켜지고 카드 글자가 바뀐다', async ({
  serviceWorker,
  openPopup,
}) => {
  const popup = await openPopup();

  await popup.getByRole('button', { name: '머무르기 클릭 켜기' }).click();

  await expect.poll(() => readDwellEnabled(serviceWorker)).toBe(true);
  await expect(popup.getByRole('button', { name: '머무르기 클릭 끄기' })).toBeVisible();
});

test('켠 뒤 버튼을 잡고 머무르면 400ms 즈음 진행 표시가 0.3~0.7이고, 뒤이어 카운터가 1이 된다', async ({
  context,
  serviceWorker,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  await patchSettings(serviceWorker, { dwellEnabled: true });

  const c = center(await boxOf(page, '#btn-tiny'));
  await page.mouse.move(c.x, c.y);
  await page.waitForTimeout(400);

  const progress = await readDwellProgress(page);
  expect(progress).not.toBeNull();
  expect(progress as number).toBeGreaterThanOrEqual(0.3);
  expect(progress as number).toBeLessThanOrEqual(0.7);

  await expect(page.locator('#btn-tiny-count')).toHaveText('1', { timeout: 1000 });
});

test('500ms 머물고 커서를 멀리 치우면 카운터는 0이고 진행 표시가 사라진다', async ({ context, serviceWorker }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  await patchSettings(serviceWorker, { dwellEnabled: true });

  const c = center(await boxOf(page, '#btn-tiny'));
  await page.mouse.move(c.x, c.y);
  await page.waitForTimeout(500);
  await page.mouse.move(900, 500);
  await page.waitForTimeout(500);

  await expect(page.locator('#btn-tiny-count')).toHaveText('0');
  expect(await readDwellProgress(page)).toBeNull();
});

test('발사 뒤 2초 더 머물러도 카운터는 1이고, 떠났다 돌아와 다시 머물면 카운터가 2가 된다', async ({
  context,
  serviceWorker,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  await patchSettings(serviceWorker, { dwellEnabled: true });

  const c = center(await boxOf(page, '#btn-tiny'));
  await page.mouse.move(c.x, c.y);
  await expect(page.locator('#btn-tiny-count')).toHaveText('1', { timeout: 1000 });

  await page.waitForTimeout(2000);
  await expect(page.locator('#btn-tiny-count')).toHaveText('1');

  await page.mouse.move(900, 500);
  await page.waitForTimeout(100);
  await page.mouse.move(c.x, c.y);
  await expect(page.locator('#btn-tiny-count')).toHaveText('2', { timeout: 1000 });
});

test('danger.html에서 "삭제" 위에 정확히 커서를 두고 1.5초 머물러도 카운터는 0이고 진행 표시가 없다', async ({
  context,
  serviceWorker,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await patchSettings(serviceWorker, { dwellEnabled: true });

  const c = center(await boxOf(page, '#btn-delete-solo'));
  await page.mouse.move(c.x, c.y);
  await page.waitForTimeout(1500);

  await expect(page.locator('#btn-delete-solo-count')).toHaveText('0');
  expect(await readDwellProgress(page)).toBeNull();
});

test('SW에서 dwellMs를 400으로 바꾸면 600ms 안에 카운터가 1이 된다', async ({ context, serviceWorker }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  await patchSettings(serviceWorker, { dwellEnabled: true, dwellMs: 400 });

  const c = center(await boxOf(page, '#btn-tiny'));
  await page.mouse.move(c.x, c.y);

  await expect(page.locator('#btn-tiny-count')).toHaveText('1', { timeout: 600 });
});

test('reducedMotion에서도 진행 표시가 있고 채움이 linear로 진행한다', async ({ context, serviceWorker }) => {
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://practice.test/targets.html');
  await patchSettings(serviceWorker, { dwellEnabled: true });

  const c = center(await boxOf(page, '#btn-tiny'));
  await page.mouse.move(c.x, c.y);
  await page.waitForTimeout(200);
  const early = await readDwellProgress(page);
  await page.waitForTimeout(300);
  const later = await readDwellProgress(page);

  expect(early).not.toBeNull();
  expect(later).not.toBeNull();
  expect(later as number).toBeGreaterThan(early as number);
});

// Task 1(01-18, CLICK-04, SAFE-01, D-19): 맨 위 위험 확인 화면이 떠 있는 동안 자식 프레임(다른
// 출처)에서 이미 차오르던 머무르기가 계속 진행돼 확인 화면 뒤에서 저장 버튼이 눌리면 안 된다.
// 연습 페이지는 전용 작은 파일 dwell-frame.html(D-28, danger.html은 후보가 9개보다 많아 번호가
// 여러 장으로 나뉜다).

// boxOf는 selector 문자열만 받으므로 frameLocator가 돌려주는 Locator를 위해 오버로드 대신 별도
// 도우미를 둔다(page.locator 전용 boxOf는 그대로 두고, 이건 Locator를 직접 받는다).
async function boxOfLocator(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('요소를 찾지 못했다(boundingBox 없음)');
  }
  return box;
}

async function openDwellFrameScenario(page: Page, serviceWorker: Worker): Promise<{ x: number; y: number }> {
  await page.goto('http://practice.test/dwell-frame.html');
  await patchSettings(serviceWorker, { dwellEnabled: true, dwellMs: 1500 });
  return center(await boxOfLocator(page.frameLocator('#frame-child').locator('#btn-save')));
}

async function hintLabelCount(page: Page): Promise<number> {
  return page.evaluate(
    () => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelectorAll('.hint-label').length ?? 0,
  );
}

// dom-audit.e2e.ts numberForElementAcrossChapters와 같은 규칙(요소 (x−14, y−14)에서 20px 안,
// 없으면 Digit0으로 다음 장) — 이 파일 안 도우미로 둔다(plan 실행 규칙).
async function numberForElementAcrossChapters(page: Page, selector: string): Promise<string> {
  const box = await boxOf(page, selector);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await page.evaluate(
      ({ x, y }) => {
        const labels = document.querySelector('tremor-helper-root')?.shadowRoot?.querySelectorAll('.hint-label');
        let best = '';
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const label of Array.from(labels ?? [])) {
          const r = label.getBoundingClientRect();
          const d = Math.hypot(r.x - (x - 14), r.y - (y - 14));
          if (d < bestDistance) {
            bestDistance = d;
            best = label.textContent;
          }
        }
        return { best, bestDistance };
      },
      { x: box.x, y: box.y },
    );
    if (result.bestDistance < 20) {
      return result.best;
    }
    const hasNext = await page.evaluate(
      () => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.hint-next-card') !== null,
    );
    if (!hasNext) {
      break;
    }
    await page.keyboard.press('Digit0');
    await page.waitForTimeout(100);
  }
  throw new Error(`번호표에서 ${selector}를 찾지 못했다(모든 장을 넘겨 봄)`);
}

async function isConfirmVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('[data-part="confirm-dialog"]');
    return el?.getAttribute('data-visible') === 'true';
  });
}

// #btn-delete 번호를 눌러 맨 위 확인 화면을 연다 — 이미 F로 번호표가 뜬 뒤에 부른다.
async function openTopDangerConfirm(page: Page): Promise<void> {
  const number = await numberForElementAcrossChapters(page, '#btn-delete');
  await page.keyboard.press(`Digit${number}`);
  await expect.poll(() => isConfirmVisible(page)).toBe(true);
}

test('맨 위 위험 확인 화면이 떠 있는 동안 자식 프레임(다른 출처)의 머무르기는 계속 차오르지 않는다(재현)', async ({
  context,
  serviceWorker,
}) => {
  const page = await context.newPage();
  const saveCenter = await openDwellFrameScenario(page, serviceWorker);

  await page.mouse.move(saveCenter.x, saveCenter.y);
  const arrivedAt = Date.now();
  await page.waitForTimeout(200);

  await page.keyboard.press('KeyF');
  await expect.poll(() => hintLabelCount(page)).toBeGreaterThan(0);
  await openTopDangerConfirm(page);
  const confirmOpenedAt = Date.now();

  const untilArrival2600 = arrivedAt + 2600 - Date.now();
  if (untilArrival2600 > 0) {
    await page.waitForTimeout(untilArrival2600);
  }
  expect(await isConfirmVisible(page)).toBe(true);
  await expect(page.frameLocator('#frame-child').locator('#save-count')).toHaveText('0');

  const untilConfirm1100 = confirmOpenedAt + 1100 - Date.now();
  if (untilConfirm1100 > 0) {
    await page.waitForTimeout(untilConfirm1100);
  }
  await page.keyboard.press('Escape');
  await expect.poll(() => isConfirmVisible(page)).toBe(false);

  await expect(page.frameLocator('#frame-child').locator('#save-count')).toHaveText('0');
  await expect(page.locator('#delete-count')).toHaveText('0');
});

test('확인 화면을 닫은 뒤 커서를 치웠다가 다시 머물면 머무르기는 평소대로 한 번 누른다', async ({
  context,
  serviceWorker,
}) => {
  const page = await context.newPage();
  const saveCenter = await openDwellFrameScenario(page, serviceWorker);

  await page.mouse.move(saveCenter.x, saveCenter.y);
  await page.waitForTimeout(200);

  await page.keyboard.press('KeyF');
  await expect.poll(() => hintLabelCount(page)).toBeGreaterThan(0);
  await openTopDangerConfirm(page);

  await page.waitForTimeout(1100);
  await page.keyboard.press('Escape');
  await expect.poll(() => isConfirmVisible(page)).toBe(false);

  await page.mouse.move(saveCenter.x - 200, saveCenter.y);
  await page.waitForTimeout(100);
  await page.mouse.move(saveCenter.x, saveCenter.y);

  await expect(page.frameLocator('#frame-child').locator('#save-count')).toHaveText('1', { timeout: 3000 });
});
