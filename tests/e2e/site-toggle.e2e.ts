import { test, expect } from './fixtures';
import type { Worker } from '@playwright/test';

// D-20(SAFE-04)·D-21(SAFE-05)·D-23·D-24(STOR-01): 지금 사이트에서만 끄기와 확장이 동작하지 않는
// 페이지의 "도울 수 없음" 표시. 연습 사이트는 servePage가 등록하는 로컬 고정물이다(D-28).

// 지금 활성 탭의 확장 아이콘 제목·배지를 SW 안에서 직접 읽는다(별도로 tabId를 주고받지 않는다 —
// active 탭을 찾는 것 자체가 background.ts가 하는 일과 같은 필터라 시험도 그대로 재사용한다).
async function activeTabTitle(serviceWorker: Worker): Promise<string> {
  return serviceWorker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ active: true });
    const tabId = tabs[0]?.id;
    return tabId === undefined ? '' : chrome.action.getTitle({ tabId });
  });
}

async function activeTabBadge(serviceWorker: Worker): Promise<string> {
  return serviceWorker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ active: true });
    const tabId = tabs[0]?.id;
    return tabId === undefined ? '' : chrome.action.getBadgeText({ tabId });
  });
}

test('chrome://version 탭을 활성으로 하면 아이콘 제목이 "도울 수 없음", 배지가 "없음"이다', async ({
  context,
  serviceWorker,
}) => {
  const page = await context.newPage();
  await page.goto('chrome://version');

  await expect.poll(() => activeTabTitle(serviceWorker)).toBe('도울 수 없음');
  await expect.poll(() => activeTabBadge(serviceWorker)).toBe('없음');
  await page.close();
});

test('연습 사이트 탭은 아이콘 제목이 "손 떨림 도우미", 배지가 ""이다', async ({ context, serviceWorker, servePage }) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');

  await expect.poll(() => activeTabTitle(serviceWorker)).toBe('손 떨림 도우미');
  await expect.poll(() => activeTabBadge(serviceWorker)).toBe('');
  await page.close();
});

test('chrome://version 탭을 대상으로 연 메뉴에 "도울 수 없음" 안내가 뜨고 카드 2(이 사이트에서 끄기)는 없다', async ({
  context,
  openPopup,
}) => {
  const page = await context.newPage();
  await page.goto('chrome://version');

  const popup = await openPopup(page);
  await expect(popup.getByText('이 페이지에서는 도울 수 없어요. 다른 탭에서 쓰세요.')).toBeVisible();
  await expect(popup.getByRole('button', { name: /이 사이트에서/ })).toHaveCount(0);

  await popup.close();
  await page.close();
});
