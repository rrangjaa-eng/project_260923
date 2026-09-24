import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

// Phase 1을 닫는 계획(01-16): 오버레이·메뉴 서체(D-26, RESEARCH Pattern 5 A4)와 5,000요소
// 반응 시간(D-05, RESEARCH Pitfall 6)을 자동 시험으로 잰다. 연습 사이트는 tests/practice-site/
// targets.html·big.html(D-28).

async function waitForHelperReady(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const host = document.querySelector('tremor-helper-root');
        const el = host?.shadowRoot?.querySelector('.mode-indicator');
        return el?.textContent ?? '';
      }),
    )
    .toBe('도우미');
}

function firstFontFamily(computed: string): string {
  const first = computed.split(',')[0] ?? '';
  return first.trim().replace(/^"|"$/g, '');
}

// document.fonts.check()는 spec상 요청한 family에 매칭되는 FontFace가 FontFaceSet에 하나도
// 없으면(등록조차 안 됐으면) 그 family를 그냥 건너뛰고 true를 돌려준다(가짜 서체 이름으로도
// true — 실측으로 확인, INVALID_RED 함정). 그래서 실제 등록 여부는 document.fonts를 순회해
// family·weight·status(loaded)가 맞는 FontFace가 실제로 있는지로 확인한다.
async function hasLoadedFace(page: Page, weight: number): Promise<boolean> {
  return page.evaluate(
    (w) =>
      Array.from(document.fonts).some((face) => {
        const family = face.family.replace(/^"|"$/g, '');
        return family === 'IBM Plex Sans KR' && face.weight.includes(String(w)) && face.status === 'loaded';
      }),
    weight,
  );
}

// Task 1: 오버레이·메뉴 IBM Plex Sans KR 서체 (확장 안 파일).

test('오버레이 모드 표시가 확장 안 IBM Plex Sans KR(굵게)로 보인다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);

  await expect.poll(() => hasLoadedFace(page, 700)).toBe(true);

  const fontFamily = await page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const el = host?.shadowRoot?.querySelector('.mode-indicator');
    return el ? getComputedStyle(el).fontFamily : '';
  });
  expect(firstFontFamily(fontFamily)).toBe('IBM Plex Sans KR');
});

test('확장 아이콘 메뉴 카드 글자도 확장 안 IBM Plex Sans KR로 보인다', async ({ context, openPopup }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  const popup = await openPopup(page);

  await expect.poll(() => hasLoadedFace(popup, 400)).toBe(true);

  const fontFamily = await popup.evaluate(() => {
    const host = document.getElementById('app');
    const card = host?.shadowRoot?.querySelector('.card');
    return card ? getComputedStyle(card).fontFamily : '';
  });
  expect(firstFontFamily(fontFamily)).toBe('IBM Plex Sans KR');
});

test('연습 페이지 자신의 서체는 그대로고 서체 파일은 확장 밖으로 나가지 않는다', async ({ context, blockedRequests }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  const before = await page.evaluate(() => getComputedStyle(document.body).fontFamily);

  await waitForHelperReady(page);
  await expect.poll(() => hasLoadedFace(page, 700)).toBe(true);

  const after = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(after).toBe(before);
  expect(blockedRequests).toEqual([]);
});

// Task 2: 5,000요소 연습 페이지에서 강조 반응 시간 50ms 측정(D-05, RESEARCH Pitfall 6).

declare global {
  interface Window {
    __reactionSamples: number[];
    __lastPointerMoveTs: number | null;
    __ringObserverAttached: boolean;
  }
}

interface ReactionStats {
  count: number;
  median: number;
  p95: number;
  max: number;
}

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[index] ?? Number.NaN;
}

// 30곳 이상을 차례로 겨눈다(각 이동 뒤 120ms 대기, 계획 behavior). 첫 이동은 프라이밍용(강조
// 테두리가 아직 없으면 attachRingObserver의 rAF 폴링이 옵서버를 붙이기 전일 수 있다) — 표본에
// 넣지 않는다.
async function measureReactionTimes(page: Page, elementIds: string[]): Promise<ReactionStats> {
  const primeId = elementIds[0];
  if (primeId === undefined) {
    throw new Error('측정할 요소가 없다');
  }
  const primeBox = await page.locator(`#${primeId}`).boundingBox();
  if (!primeBox) {
    throw new Error(`요소를 찾지 못했다: ${primeId}`);
  }
  await page.mouse.move(primeBox.x + primeBox.width / 2, primeBox.y + primeBox.height / 2);
  await expect.poll(() => page.evaluate(() => window.__ringObserverAttached)).toBe(true);
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    window.__reactionSamples = [];
    window.__lastPointerMoveTs = null;
  });

  for (const id of elementIds) {
    const box = await page.locator(`#${id}`).boundingBox();
    if (!box) {
      throw new Error(`요소를 찾지 못했다: ${id}`);
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(120);
  }

  const samples = await page.evaluate(() => window.__reactionSamples);
  const sorted = [...samples].sort((a, b) => a - b);
  return { count: sorted.length, median: percentile(sorted, 0.5), p95: percentile(sorted, 0.95), max: sorted[sorted.length - 1] ?? Number.NaN };
}

// 첫 화면(스크롤 없이 보이는) 안에서 30곳 이상을 대각선으로 흩어 고른다 — COLS=25이므로 14씩
// 건너뛰면 행·열이 고르게 섞인다.
const TARGET_IDS = Array.from({ length: 32 }, (_, i) => `el-${(i * 14).toString()}`);

test('5,000요소 페이지에서 강조가 50ms 안에 따라온다(정상)', async ({ context }, testInfo) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/big.html');
  await waitForHelperReady(page);

  const stats = await measureReactionTimes(page, TARGET_IDS);
  console.log('overlay-perf 정상 모드:', stats);
  await testInfo.attach('overlay-perf-normal', { body: JSON.stringify(stats, null, 2), contentType: 'application/json' });

  expect(stats.count).toBeGreaterThanOrEqual(30);
  expect(stats.p95).toBeLessThan(50);
});

test('5,000요소 페이지에서 강조가 50ms 안에 따라온다(화면 변화 부하)', async ({ context }, testInfo) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/big.html?churn=1');
  await waitForHelperReady(page);

  const stats = await measureReactionTimes(page, TARGET_IDS);
  console.log('overlay-perf 부하 모드:', stats);
  await testInfo.attach('overlay-perf-churn', { body: JSON.stringify(stats, null, 2), contentType: 'application/json' });

  expect(stats.count).toBeGreaterThanOrEqual(30);
  expect(stats.p95).toBeLessThan(50);
});
