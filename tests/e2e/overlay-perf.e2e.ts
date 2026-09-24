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
