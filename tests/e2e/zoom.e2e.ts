import { test, expect } from './fixtures';
import type { Page, Worker } from '@playwright/test';

// D-26, CLICK-01, CLICK-03, RESEARCH Pattern 5(A5): 브라우저 확대(chrome.tabs.setZoom)와
// 상관없이 오버레이(모드 표시·테두리·번호표·확인 화면·알림)가 화면에서 같은 크기로 보인다. SW가
// chrome.tabs.getZoom/onZoomChange로 확대 비율을 알려 주고, 오버레이는 shadow root 최상위에
// --overlay-scale(1/비율)을 두어 크기 값에만 곱한다 — 위치(요소 좌표)는 그대로 따라간다.
// 연습 사이트는 tests/practice-site/targets.html·danger.html(D-28).

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

interface IndicatorMetrics {
  fontSizePx: number;
  heightPx: number;
}

async function indicatorMetrics(page: Page): Promise<IndicatorMetrics | null> {
  return page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const el = host?.shadowRoot?.querySelector('.mode-indicator');
    if (!el) {
      return null;
    }
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return { fontSizePx: Number.parseFloat(style.fontSize), heightPx: rect.height };
  });
}

async function getTabId(serviceWorker: Worker, page: Page): Promise<number> {
  const tabs = await serviceWorker.evaluate((url) => chrome.tabs.query({ url }), page.url());
  const tabId = tabs[0]?.id;
  if (tabId === undefined) {
    throw new Error('탭을 찾지 못했다');
  }
  return tabId;
}

async function setZoom(serviceWorker: Worker, tabId: number, factor: number): Promise<void> {
  await serviceWorker.evaluate(({ id, factor: f }) => chrome.tabs.setZoom(id, f), { id: tabId, factor });
}

test('확대 2.0배에서 모드 표시 글자 크기·상자 높이가 1배율과 같은 화면 크기다', async ({ context, serviceWorker }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);

  const base = await indicatorMetrics(page);
  if (!base) {
    throw new Error('모드 표시를 찾지 못했다');
  }

  const tabId = await getTabId(serviceWorker, page);
  await setZoom(serviceWorker, tabId, 2.0);

  await expect
    .poll(async () => {
      const metrics = await indicatorMetrics(page);
      return metrics ? metrics.fontSizePx * 2 : null;
    })
    .toBeGreaterThanOrEqual(17.5);

  const zoomed = await indicatorMetrics(page);
  if (!zoomed) {
    throw new Error('모드 표시를 찾지 못했다');
  }
  expect(zoomed.fontSizePx * 2).toBeLessThanOrEqual(18.5);
  expect(Math.abs(zoomed.heightPx * 2 - base.heightPx)).toBeLessThanOrEqual(1);
});

test('확대 1.1배·0.8배에서도 모드 표시 글자 크기가 화면에서 18px로 보인다', async ({ context, serviceWorker }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);
  const tabId = await getTabId(serviceWorker, page);

  for (const factor of [1.1, 0.8]) {
    await setZoom(serviceWorker, tabId, factor);
    await expect
      .poll(async () => {
        const metrics = await indicatorMetrics(page);
        return metrics ? metrics.fontSizePx * factor : null;
      })
      .toBeGreaterThanOrEqual(17.5);
    const metrics = await indicatorMetrics(page);
    if (!metrics) {
      throw new Error('모드 표시를 찾지 못했다');
    }
    expect(metrics.fontSizePx * factor).toBeLessThanOrEqual(18.5);
  }
});

test('탭을 열어 둔 채 확대를 바꾸면 500ms 안에 모드 표시가 다시 맞춰진다', async ({ context, serviceWorker }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);
  const tabId = await getTabId(serviceWorker, page);

  await setZoom(serviceWorker, tabId, 2.0);
  await expect
    .poll(
      async () => {
        const metrics = await indicatorMetrics(page);
        const scaled = metrics ? metrics.fontSizePx * 2 : null;
        return scaled !== null && scaled >= 17.5 && scaled <= 18.5;
      },
      { timeout: 500, intervals: [20] },
    )
    .toBe(true);
});

test('확대 전에 연 탭과 확대 뒤에 연 탭(같은 출처) 모두 모드 표시 크기가 맞다', async ({ context, serviceWorker }) => {
  const pageBefore = await context.newPage();
  await pageBefore.goto('http://practice.test/targets.html');
  await waitForHelperReady(pageBefore);

  const tabId = await getTabId(serviceWorker, pageBefore);
  await setZoom(serviceWorker, tabId, 1.1);

  await expect
    .poll(async () => {
      const metrics = await indicatorMetrics(pageBefore);
      return metrics ? metrics.fontSizePx * 1.1 : null;
    })
    .toBeGreaterThanOrEqual(17.5);
  const beforeMetrics = await indicatorMetrics(pageBefore);
  if (!beforeMetrics) {
    throw new Error('모드 표시를 찾지 못했다');
  }
  expect(beforeMetrics.fontSizePx * 1.1).toBeLessThanOrEqual(18.5);

  // 크롬은 출처별 확대를 기억한다(RESEARCH.md Pattern 5) — 확대 뒤에 새로 연 같은 출처 탭도
  // 이미 1.1배로 열린다.
  const pageAfter = await context.newPage();
  await pageAfter.goto('http://practice.test/targets.html');
  await waitForHelperReady(pageAfter);
  await expect
    .poll(async () => {
      const metrics = await indicatorMetrics(pageAfter);
      return metrics ? metrics.fontSizePx * 1.1 : null;
    })
    .toBeGreaterThanOrEqual(17.5);
  const afterMetrics = await indicatorMetrics(pageAfter);
  if (!afterMetrics) {
    throw new Error('모드 표시를 찾지 못했다');
  }
  expect(afterMetrics.fontSizePx * 1.1).toBeLessThanOrEqual(18.5);
});

// Task 2: 테두리·번호표·확인 화면·알림에 배율 적용(위치는 요소를 따라감).

interface RingBox {
  left: number;
  top: number;
  width: number;
  height: number;
  borderTopWidth: number;
}

async function readRingBox(page: Page): Promise<RingBox | null> {
  return page.evaluate(() => {
    const el = document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('[data-part="ring"]');
    if (!el || el.getAttribute('data-visible') !== 'true') {
      return null;
    }
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, borderTopWidth: Number.parseFloat(style.borderTopWidth) };
  });
}

test('200%에서 잡힌 요소의 테두리 두께·바깥 간격이 화면 크기로 유지되고 테두리 상자가 요소를 감싼다', async ({
  context,
  serviceWorker,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);

  const box = await page.locator('#btn-tiny').boundingBox();
  if (!box) {
    throw new Error('버튼을 찾지 못했다');
  }
  await page.mouse.move(box.x - 30, box.y + box.height / 2);
  await expect.poll(() => readRingBox(page)).not.toBeNull();

  const tabId = await getTabId(serviceWorker, page);
  await setZoom(serviceWorker, tabId, 2.0);

  // 테두리 두께는 CSS calc()가 --overlay-scale이 바뀌는 즉시 스스로 다시 그린다 — 이 값이
  // 기대 범위에 들어왔다는 것은 zoom/changed 메시지가 이미 도착해 --overlay-scale이 반영됐다는
  // 뜻이다(경합 없는 신호). fix(01-15 known gap, 01-16): 위치(transform)도 이제 zoom/changed
  // 자체가 다시 계산해 두므로(추가 pointermove 불필요, 아래 새 시험이 이를 직접 확인한다), 여기
  // 남겨 둔 재확인용 pointermove는 순수 자석 재계산 경로로도 같은 결과가 나오는지 겸사겸사 본다.
  await expect
    .poll(async () => {
      const ring = await readRingBox(page);
      const scaled = ring ? ring.borderTopWidth * 2 : null;
      return scaled !== null && scaled >= 4.5 && scaled <= 5.5;
    })
    .toBe(true);
  await page.mouse.move(box.x - 31, box.y + box.height / 2);
  await page.mouse.move(box.x - 30, box.y + box.height / 2);
  await page.waitForTimeout(50);

  const ring = await readRingBox(page);
  if (!ring) {
    throw new Error('테두리를 찾지 못했다');
  }
  const offsetLeft = (box.x - ring.left) * 2;
  const offsetTop = (box.y - ring.top) * 2;
  expect(offsetLeft).toBeGreaterThanOrEqual(7);
  expect(offsetLeft).toBeLessThanOrEqual(9);
  expect(offsetTop).toBeGreaterThanOrEqual(7);
  expect(offsetTop).toBeLessThanOrEqual(9);

  expect(ring.left).toBeLessThanOrEqual(box.x + 0.5);
  expect(ring.top).toBeLessThanOrEqual(box.y + 0.5);
  expect(ring.left + ring.width).toBeGreaterThanOrEqual(box.x + box.width - 0.5);
  expect(ring.top + ring.height).toBeGreaterThanOrEqual(box.y + box.height - 0.5);
});

// fix(01-15 known gap, 01-16): 01-15-SUMMARY.md "Issues Encountered"가 알아 둘 점으로만 남겼던
// 문제 — 확대가 바뀐 직후 추가 포인터 이동이 없으면 테두리 위치(--ring-offset 오프셋)가 옛
// 배율 그대로 남는다. 아래 시험은 zoom/changed 뒤 pointermove를 단 한 번도 주지 않는다(위 시험과
// 달리) — 그래야 자석 재계산이 "확대 자체"로 일어나는지, 포인터 이동으로 일어나는지 구분된다.
test('테두리가 다음 포인터 이동 없이도 zoom/changed 직후 화면 크기 바깥 간격으로 다시 자리를 잡는다', async ({
  context,
  serviceWorker,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);

  const box = await page.locator('#btn-tiny').boundingBox();
  if (!box) {
    throw new Error('버튼을 찾지 못했다');
  }
  await page.mouse.move(box.x - 30, box.y + box.height / 2);
  await expect.poll(() => readRingBox(page)).not.toBeNull();

  const tabId = await getTabId(serviceWorker, page);
  await setZoom(serviceWorker, tabId, 2.0);

  // 포인터 이동 없이, zoom/changed 신호만으로 --ring-offset 기반 위치(왼쪽·위)가 새 배율의
  // 바깥 간격(8px 목표)으로 다시 맞춰져야 한다.
  await expect
    .poll(
      async () => {
        const ring = await readRingBox(page);
        if (!ring) {
          return null;
        }
        const offsetLeft = (box.x - ring.left) * 2;
        const offsetTop = (box.y - ring.top) * 2;
        return offsetLeft >= 7 && offsetLeft <= 9 && offsetTop >= 7 && offsetTop <= 9;
      },
      { timeout: 800, intervals: [20] },
    )
    .toBe(true);
});

interface LabelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function readLabelBoxes(page: Page): Promise<LabelBox[]> {
  return page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const labels = host?.shadowRoot?.querySelectorAll('.hint-label');
    if (!labels) {
      return [];
    }
    return Array.from(labels).map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
  });
}

function boxesOverlap(a: LabelBox, b: LabelBox): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

const DENSE_BUTTONS_HTML = `<!doctype html><html><body style="margin:0">
<script>
  function makeBtn(id, x) {
    var b = document.createElement('button');
    b.id = id;
    b.textContent = id;
    b.style.position = 'absolute';
    b.style.left = x + 'px';
    b.style.top = '200px';
    b.style.width = '30px';
    b.style.height = '30px';
    document.body.appendChild(b);
  }
  for (var i = 0; i < 5; i += 1) { makeBtn('d-' + i, 300 + i * 40); }
</script>
</body></html>`;

test('200%·80%에서 번호표 너비가 화면 크기로 유지되고 번호표끼리 겹치지 않는다', async ({ context, serviceWorker, servePage }) => {
  servePage('http://practice.test/zoom-hints.html', DENSE_BUTTONS_HTML);

  for (const factor of [2.0, 0.8]) {
    const page = await context.newPage();
    await page.goto('http://practice.test/zoom-hints.html');
    await waitForHelperReady(page);
    await page.waitForTimeout(100);

    const tabId = await getTabId(serviceWorker, page);
    await setZoom(serviceWorker, tabId, factor);
    await page.waitForTimeout(150);

    await page.keyboard.press('KeyF');
    await page.waitForTimeout(50);

    const boxes = await readLabelBoxes(page);
    expect(boxes.length).toBeGreaterThan(1);
    for (const box of boxes) {
      expect(box.width * factor).toBeGreaterThanOrEqual(27);
      expect(box.width * factor).toBeLessThanOrEqual(29);
    }
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
  }
});

// fix(01-15 known gap, 01-16): 번호표 크기(width, calc())는 확대가 바뀌면 스스로 다시 그리지만,
// 자리(placeLabels가 openChapter 호출 시점에만 계산하는 -14px×배율 오프셋)는 테두리와 같은
// 이유로 다시 열지 않으면 옛 배율 그대로 남는다 — 열려 있는 번호표가 있는 채로 확대가 바뀌면
// 추가 입력 없이도 다시 자리를 잡아야 한다.
test('번호표가 열려 있으면 다음 포인터 이동 없이도 zoom/changed 직후 화면 크기 자리로 다시 잡는다', async ({
  context,
  serviceWorker,
  servePage,
}) => {
  servePage('http://practice.test/zoom-hints-resync.html', DENSE_BUTTONS_HTML);
  const page = await context.newPage();
  await page.goto('http://practice.test/zoom-hints-resync.html');
  await waitForHelperReady(page);
  await page.waitForTimeout(100);

  const targetBoxOrNull = await page.locator('#d-0').boundingBox();
  if (!targetBoxOrNull) {
    throw new Error('버튼을 찾지 못했다');
  }
  const targetBox = targetBoxOrNull;

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(50);

  async function offsetFromTarget(): Promise<{ x: number; y: number } | null> {
    const boxes = await readLabelBoxes(page);
    let closest: LabelBox | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const box of boxes) {
      const distance = Math.hypot(box.x - targetBox.x, box.y - targetBox.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = box;
      }
    }
    return closest ? { x: targetBox.x - closest.x, y: targetBox.y - closest.y } : null;
  }

  const before = await offsetFromTarget();
  if (!before) {
    throw new Error('번호표를 찾지 못했다');
  }
  expect(before.x).toBeGreaterThanOrEqual(13);
  expect(before.x).toBeLessThanOrEqual(15);

  const tabId = await getTabId(serviceWorker, page);
  await setZoom(serviceWorker, tabId, 2.0);

  // 포인터 이동도, F 다시 누르기도 없이 zoom/changed 신호만으로 자리(오프셋)가 새 배율(7px CSS
  // = 화면에서 14px)로 다시 맞춰져야 한다.
  await expect
    .poll(
      async () => {
        const offset = await offsetFromTarget();
        if (!offset) {
          return null;
        }
        return offset.x * 2 >= 13 && offset.x * 2 <= 15 && offset.y * 2 >= 13 && offset.y * 2 <= 15;
      },
      { timeout: 800, intervals: [20] },
    )
    .toBe(true);
});

interface DialogMetrics {
  visible: boolean;
  widthPx: number;
  confirmButtonHeightPx: number;
  cancelButtonHeightPx: number;
}

async function readDialogMetrics(page: Page): Promise<DialogMetrics | null> {
  return page.evaluate(() => {
    const shadow = document.querySelector('tremor-helper-root')?.shadowRoot;
    const dialog = shadow?.querySelector('[data-part="confirm-dialog"]');
    if (!shadow || !dialog) {
      return null;
    }
    const rect = dialog.getBoundingClientRect();
    const confirmBtn = shadow.querySelector('[data-part="confirm-button-confirm"]');
    const cancelBtn = shadow.querySelector('[data-part="confirm-button-cancel"]');
    return {
      visible: dialog.getAttribute('data-visible') === 'true',
      widthPx: rect.width,
      confirmButtonHeightPx: confirmBtn ? confirmBtn.getBoundingClientRect().height : 0,
      cancelButtonHeightPx: cancelBtn ? cancelBtn.getBoundingClientRect().height : 0,
    };
  });
}

async function numberForElement(page: Page, elementId: string): Promise<string> {
  const box = await page.locator(`#${elementId}`).boundingBox();
  if (!box) {
    throw new Error(`요소를 찾지 못했다: ${elementId}`);
  }
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

test('200%에서 확인 카드 너비·버튼 높이가 화면 크기로 유지된다', async ({ context, serviceWorker }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  const tabId = await getTabId(serviceWorker, page);
  await setZoom(serviceWorker, tabId, 2.0);
  await page.waitForTimeout(150);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(50);
  const number = await numberForElement(page, 'btn-delete-solo');
  await page.keyboard.press(`Digit${number}`);
  await page.waitForTimeout(100);

  const dialog = await readDialogMetrics(page);
  if (!dialog) {
    throw new Error('확인 화면을 찾지 못했다');
  }
  expect(dialog.visible).toBe(true);
  expect(Math.abs(dialog.widthPx * 2 - 600)).toBeLessThanOrEqual(1);
  expect(dialog.confirmButtonHeightPx * 2).toBeGreaterThanOrEqual(64);
  expect(dialog.cancelButtonHeightPx * 2).toBeGreaterThanOrEqual(64);
});

const MIGRATION_FAILED_TOAST_TEXT = '설정을 읽지 못해 기본 설정으로 동작해요. 원래 설정은 그대로 두었어요.';

// lifecycle.e2e.ts와 같은 시험 준비 방식(제품 코드 아님) — notice:migration-failed를 미리 넣어
// 두면 content.ts가 페이지를 열 때 토스트를 띄운다.
async function seedMigrationFailure(serviceWorker: Worker): Promise<void> {
  await expect.poll(() => serviceWorker.evaluate(async () => (await chrome.storage.sync.get('settings')).settings)).toBeDefined();
  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.set({
      'notice:migration-failed': { schemaVersion: 1, data: { key: 'settings', reason: 'newer-version', at: Date.now() } },
    });
  });
}

test('200%에서 알림(토스트) 글자 크기가 화면 크기로 유지된다', async ({ context, serviceWorker, servePage }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);

  const tabId = await getTabId(serviceWorker, page);
  await setZoom(serviceWorker, tabId, 2.0);
  await page.waitForTimeout(150);

  await seedMigrationFailure(serviceWorker);
  servePage('http://practice.test/toast-zoom.html', '<!doctype html><html><body></body></html>');
  await page.goto('http://practice.test/toast-zoom.html');

  async function toastMetrics(): Promise<{ text: string; fontSizePx: number } | null> {
    return page.evaluate(() => {
      const el = document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.toast');
      if (!el) {
        return null;
      }
      return { text: el.textContent, fontSizePx: Number.parseFloat(getComputedStyle(el).fontSize) };
    });
  }

  await expect.poll(async () => (await toastMetrics())?.text ?? null).toBe(MIGRATION_FAILED_TOAST_TEXT);
  const metrics = await toastMetrics();
  if (!metrics) {
    throw new Error('토스트를 찾지 못했다');
  }
  expect(metrics.fontSizePx * 2).toBeGreaterThanOrEqual(17.5);
  expect(metrics.fontSizePx * 2).toBeLessThanOrEqual(18.5);
});
