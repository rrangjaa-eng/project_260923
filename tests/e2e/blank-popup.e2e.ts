import { test, expect } from './fixtures';
import type { BrowserContext, Locator, Page } from '@playwright/test';

// 01-19 Task 1(ELEM-02, SAFE-04, SAFE-05): 주소 없는 새 창(window.open('')을 여는 쪽이 DOM이나
// document.write로 채움, 결재 팝업 등)에서도 도우미가 한 번만 돈다. 그 창의 사이트는 여는 쪽
// 출처다. 연습 페이지는 tests/practice-site/blank-popup.html(D-28).

async function hasHelperRoot(page: Page): Promise<boolean> {
  return page.evaluate(() => document.querySelector('tremor-helper-root') !== null);
}

async function hostCount(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelectorAll('tremor-helper-root').length);
}

async function indicatorText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const el = host?.shadowRoot?.querySelector('.mode-indicator');
    return el?.textContent ?? '';
  });
}

async function waitForHelperReady(page: Page): Promise<void> {
  await expect.poll(() => indicatorText(page)).toBe('도우미');
}

async function ringVisible(page: Page): Promise<boolean> {
  return page
    .locator('tremor-helper-root')
    .evaluate((host) => host.shadowRoot?.querySelector('.ring')?.getAttribute('data-visible') === 'true')
    .catch(() => false);
}

async function labelTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const labels = host?.shadowRoot?.querySelectorAll('.hint-label');
    return labels ? Array.from(labels).map((el) => el.textContent) : [];
  });
}

// editor-frames.e2e.ts와 같은 방식(고정 sleep 대신 조건 재시도) — 번호가 뜰 때까지 F를 다시 눌러
// 본다.
async function pressFUntilLabels(page: Page, minCount: number): Promise<void> {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(150);
    if ((await labelTexts(page)).length >= minCount) {
      return;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
  }
}

async function numberForLocator(page: Page, locator: Locator): Promise<string> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('요소를 찾지 못했다(boundingBox 없음)');
  }
  for (let attempt = 0; attempt < 6; attempt += 1) {
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
  throw new Error('번호표에서 요소를 찾지 못했다(모든 장을 넘겨 봄)');
}

async function findHintNumberFor(page: Page, locator: Locator): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await pressFUntilLabels(page, 1);
    try {
      const number = await numberForLocator(page, locator);
      if (number) {
        return number;
      }
    } catch {
      // 이 스냅샷엔 없었다 — 닫고 다시 열어 본다.
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  throw new Error('번호를 찾지 못했다');
}

async function pressHintFor(page: Page, locator: Locator): Promise<void> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.focus();
  });
  const number = await findHintNumberFor(page, locator);
  await page.keyboard.press(`Digit${number}`);
}

// 여는 쪽 페이지에서 전역 함수를 부르고 그 결과로 열리는 새 창을 받는다.
async function openViaFn(page: Page, context: BrowserContext, fnName: string): Promise<Page> {
  const waiter = context.waitForEvent('page');
  await page.evaluate((name: string) => {
    const fn = (window as unknown as Record<string, (() => void) | undefined>)[name];
    fn?.();
  }, fnName);
  return waiter;
}

async function openOpenerPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto('http://practice.test/blank-popup.html');
  return page;
}

test('window.open(\'\')으로 열고 DOM으로 채운 새 창에서 도우미가 한 번만 돈다', async ({ context }) => {
  const page = await openOpenerPage(context);
  const popup = await openViaFn(page, context, 'openDomPopup');

  await waitForHelperReady(popup);
  expect(await hostCount(popup)).toBe(1);

  const box = await popup.locator('#popup-btn').boundingBox();
  if (!box) {
    throw new Error('#popup-btn을 찾지 못했다');
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await popup.mouse.click(x, y);
  await popup.waitForTimeout(100);
  await popup.mouse.click(x, y);
  await expect(popup.locator('#popup-count')).toHaveText('1');

  await pressHintFor(popup, popup.locator('#popup-btn'));
  await expect(popup.locator('#popup-count')).toHaveText('2');

  await popup.close();
  await page.close();
});

test('window.open(\'\') 뒤 document.write로 채운 새 창에서도 도우미가 한 번만 돈다(옛 도우미 다시 넣기 포함)', async ({
  context,
}) => {
  const page = await openOpenerPage(context);
  const popup = await openViaFn(page, context, 'openWritePopup');

  await waitForHelperReady(popup);
  expect(await hostCount(popup)).toBe(1);

  // 커서를 대면 테두리가 보인다(새 도우미가 실제로 이 프레임에서 살아 있다는 근거) — 5초 안.
  const box = await popup.locator('#popup-btn').boundingBox();
  if (!box) {
    throw new Error('#popup-btn을 찾지 못했다');
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await popup.mouse.move(x, y);
  await expect.poll(() => ringVisible(popup), { timeout: 5000 }).toBe(true);

  await popup.mouse.click(x, y);
  await popup.waitForTimeout(100);
  await popup.mouse.click(x, y);
  await expect(popup.locator('#popup-count')).toHaveText('1');

  await pressHintFor(popup, popup.locator('#popup-btn'));
  await expect(popup.locator('#popup-count')).toHaveText('2');

  await popup.close();
  await page.close();
});

test('DOM 새 창이 열린 채 SW가 site:http://practice.test를 끄면 새 창의 호스트가 사라지고, 다시 켜면 돌아온다(여는 쪽 사이트를 따름)', async ({
  context,
  serviceWorker,
}) => {
  const page = await openOpenerPage(context);
  const popup = await openViaFn(page, context, 'openDomPopup');
  await waitForHelperReady(popup);

  const box = await popup.locator('#popup-btn').boundingBox();
  if (!box) {
    throw new Error('#popup-btn을 찾지 못했다');
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await popup.mouse.click(x, y);
  await popup.waitForTimeout(100);
  await popup.mouse.click(x, y);
  await expect(popup.locator('#popup-count')).toHaveText('1');

  await serviceWorker.evaluate(async () => {
    await chrome.storage.sync.set({
      'site:http://practice.test': { schemaVersion: 1, data: { disabled: true, pins: [] } },
    });
  });
  await expect.poll(() => hasHelperRoot(popup)).toBe(false);

  // 도우미가 꺼졌으니 100ms 두 번 클릭이 필터 없이 그대로 둘 다 간다(1 → 3).
  await popup.mouse.click(x, y);
  await popup.waitForTimeout(100);
  await popup.mouse.click(x, y);
  await expect(popup.locator('#popup-count')).toHaveText('3');

  await serviceWorker.evaluate(async () => {
    await chrome.storage.sync.set({
      'site:http://practice.test': { schemaVersion: 1, data: { disabled: false, pins: [] } },
    });
  });
  await expect.poll(() => hostCount(popup)).toBe(1);

  await popup.close();
  await page.close();
});

// noopener 실측(01-19 Task 1 RED, 프로덕션 빌드로 확인): window.open('', '_blank', 'noopener')와
// rel=noopener 링크 둘 다 self.origin은 여는 쪽 http(s) 출처를 물려받지만(불투명 아님), Chrome이
// 그 새 창에는 content script를 전혀 주입하지 않는다(match_about_blank는 opener·parent 문서로만
// 출처를 판정하는데 noopener가 그 연결 자체를 끊는다 — Chrome 자체 동작, 코드로 구분 장치를 두지
// 않는다). 그 결과 두 경우 모두 tremor-helper-root가 생기지 않는다 — "도울 수 없음" 쪽과 같은
// 결과다.
test('noopener로 연 새 창(window.open과 링크 둘 다)에는 Chrome이 content script를 주입하지 않아 도우미가 없다(실측)', async ({
  context,
}) => {
  const page = await openOpenerPage(context);

  const popup1 = await openViaFn(page, context, 'openNoopenerPopup');
  await popup1.waitForTimeout(1000);
  expect(await hasHelperRoot(popup1)).toBe(false);
  await popup1.close();

  const waiter2 = context.waitForEvent('page');
  await page.locator('#noopener-link').click();
  const popup2 = await waiter2;
  await popup2.waitForTimeout(1000);
  expect(await hasHelperRoot(popup2)).toBe(false);
  await popup2.close();

  await page.close();
});
