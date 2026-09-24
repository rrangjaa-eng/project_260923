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
    expect(metrics!.fontSizePx * factor).toBeLessThanOrEqual(18.5);
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
  expect(beforeMetrics!.fontSizePx * 1.1).toBeLessThanOrEqual(18.5);

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
  expect(afterMetrics!.fontSizePx * 1.1).toBeLessThanOrEqual(18.5);
});
