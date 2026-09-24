import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

// TEST-01(2단계 중간 사용자 시험): docs/trial/trial.html은 이용자가 파일을 두 번 눌러 여는 시험 페이지다.
// 작은 버튼 10개 누르기·양식 하나 채우기의 걸린 시간·잘못 누름·헛누름을 스스로 세어 결과 표에 남긴다.
// 여기서는 도우미(확장)를 켠 채로 열어, 도우미가 대신 누른 것도 페이지가 똑같이 세는지 확인한다.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRIAL_HTML = fs.readFileSync(path.resolve(__dirname, '../../docs/trial/trial.html'), 'utf8');
const TRIAL_URL = 'http://practice.test/trial.html';

async function openTrial(page: Page, servePage: (routePath: string, html: string) => void): Promise<void> {
  servePage(TRIAL_URL, TRIAL_HTML);
  await page.goto(TRIAL_URL);
}

// "도우미 없이" 과제와 페이지 자체 동작 시험은 실제 시험처럼 팝업 1번 카드로 도우미를 끄고 한다.
async function turnHelperOff(page: Page, openPopup: () => Promise<Page>): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.querySelector('tremor-helper-root') !== null)).toBe(true);
  const popup = await openPopup();
  await popup.getByRole('button', { name: '도우미 끄기' }).click();
  await popup.close();
  await expect.poll(() => page.evaluate(() => document.querySelector('tremor-helper-root') !== null)).toBe(false);
}

async function clickCenter(page: Page, selector: string): Promise<void> {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) {
    throw new Error(`보이지 않는 요소: ${selector}`);
  }
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function resultRows(page: Page): Promise<string[][]> {
  return page.locator('#results tbody tr').evaluateAll((rows) =>
    rows.map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent.trim())),
  );
}

test('작은 버튼 과제: 목표 10개를 누르면 시간·잘못 누름·헛누름이 결과 표에 남는다', async ({ page, servePage, openPopup }) => {
  await openTrial(page, servePage);
  await turnHelperOff(page, openPopup);
  await page.locator('#method-none').click();
  await page.locator('#task1-start').click();

  await expect(page.locator('#task1-area .small-btn')).toHaveCount(20);
  await expect(page.locator('#task1-progress')).toHaveText('0 / 10');

  // 차례가 아닌 버튼 하나, 버튼 아닌 빈 곳 하나를 누른다.
  await clickCenter(page, '#task1-area .small-btn:not([data-target])');
  const area = await page.locator('#task1-area').boundingBox();
  if (!area) {
    throw new Error('과제 영역이 보이지 않는다');
  }
  await page.mouse.click(area.x + 4, area.y + 4);

  for (let i = 0; i < 10; i += 1) {
    await clickCenter(page, '#task1-area .small-btn[data-target]');
  }

  const rows = await resultRows(page);
  expect(rows).toHaveLength(1);
  const [taskName, method, round, seconds, wrong, miss] = rows[0] ?? [];
  expect(taskName).toBe('작은 버튼 10개');
  expect(method).toBe('도우미 없이');
  expect(round).toBe('1');
  expect(Number(seconds)).toBeGreaterThan(0);
  expect(wrong).toBe('1');
  expect(miss).toBe('1');
});

test('작은 버튼 과제: 자석 커서로 잡고 스페이스바로 누른 것도 센다', async ({ page, servePage }) => {
  await openTrial(page, servePage);
  await page.locator('#method-magnet').click();
  await page.locator('#task1-start').click();

  for (let i = 0; i < 10; i += 1) {
    const box = await page.locator('#task1-area .small-btn[data-target]').boundingBox();
    if (!box) {
      throw new Error('목표 버튼이 보이지 않는다');
    }
    // 앞 버튼을 놓도록 먼저 모든 버튼에서 멀리 뺀 뒤, 버튼 가운데가 아니라 조금 비껴 가져간다
    // — 잡는 범위 안이면 도우미가 잡는다.
    await page.mouse.move(box.x - 200, box.y);
    await page.mouse.move(box.x + box.width / 2 + 3, box.y + box.height / 2 + 3);
    await expect(page.locator('#task1-progress')).toHaveText(`${String(i)} / 10`);
    await page.waitForTimeout(350); // 떨림 간격(300ms)보다 길게 쉬고 누른다
    await page.keyboard.press('Space');
  }

  const rows = await resultRows(page);
  expect(rows[0]?.[1]).toBe('자석 커서');
  expect(rows[0]?.[4]).toBe('0');
});

test('양식 과제: 칸을 다 채워 보내면 결과가 남고, 빈 칸이 있으면 이유를 보여 준다', async ({ page, servePage, openPopup }) => {
  await openTrial(page, servePage);
  await turnHelperOff(page, openPopup);
  await page.locator('#method-hints').click();
  await page.locator('#task2-start').click();

  await page.locator('#f-send').click();
  await expect(page.locator('#task2-error')).toContainText('빈 칸이 있어요');
  expect(await resultRows(page)).toHaveLength(0);

  await page.locator('#f-name').fill('홍길동');
  await page.locator('#f-phone').fill('010-0000-0000');
  await page.locator('#f-date').fill('2026-09-24');
  await page.locator('#f-dept').selectOption({ label: '영업팀' });
  await page.locator('#f-agree').check();
  await page.locator('#f-send').click();

  const rows = await resultRows(page);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.[0]).toBe('양식 채우기');
  expect(rows[0]?.[1]).toBe('번호표');
});

test('결과는 페이지를 새로 열어도 남고, 지우기는 두 번 눌러야 지워진다', async ({ page, servePage, openPopup }) => {
  await openTrial(page, servePage);
  await turnHelperOff(page, openPopup);
  await page.locator('#method-none').click();
  await page.locator('#task1-start').click();
  for (let i = 0; i < 10; i += 1) {
    await clickCenter(page, '#task1-area .small-btn[data-target]');
  }
  expect(await resultRows(page)).toHaveLength(1);

  await page.reload();
  expect(await resultRows(page)).toHaveLength(1);

  await page.locator('#results-clear').click();
  expect(await resultRows(page)).toHaveLength(1);
  await expect(page.locator('#results-clear')).toContainText('한 번 더');
  await page.locator('#results-clear').click();
  expect(await resultRows(page)).toHaveLength(0);
});

test('이용자가 누르는 페이지 버튼은 높이 56px 이상이다', async ({ page, servePage, openPopup }) => {
  await openTrial(page, servePage);
  await turnHelperOff(page, openPopup);
  const heights = await page
    .locator('button:not(.small-btn)')
    .evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) {
    expect(height).toBeGreaterThanOrEqual(56);
  }
});
