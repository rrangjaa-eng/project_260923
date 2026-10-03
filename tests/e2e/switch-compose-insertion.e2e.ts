import { test, expect } from './fixtures';
import { chooseSwitch, startSwitch } from './switch-helpers';
import type { Page } from '@playwright/test';

test.beforeEach(async ({ serviceWorker }) => {
  await serviceWorker.evaluate(() => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 }, switchPhrases: ['라'] }));
});
test.afterEach(({ expectNoExternalRequests }) => { expectNoExternalRequests(); });
const fixture = `<label>문장<input id="field" value="앞뒤"></label><script>document.querySelector('input').setSelectionRange(1,1);window.events=0;document.addEventListener('input',()=>window.events++);</script>`;
async function pending(page: Page) {
  await startSwitch(page); await chooseSwitch(page, '찾기'); await chooseSwitch(page, '문장');
  await chooseSwitch(page, '한글 쓰기'); await chooseSwitch(page, 'ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ'); await chooseSwitch(page, 'ㄱ');
  await chooseSwitch(page, 'ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ'); await chooseSwitch(page, 'ㅏ');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  for (let i = 0; i < 6 && await panel.locator('[data-item-id="edit:space"]').count() === 0; i++) await chooseSwitch(page, '상위로');
  return panel;
}

test('pending Hangul protects cursor, undo and phrase insertion until explicitly completed', async ({ context, servePage }) => {
  test.setTimeout(150000); servePage('http://practice.test/pending-phrase', fixture);
  const page = await context.newPage(); await page.goto('http://practice.test/pending-phrase'); const panel = await pending(page);
  const before = await panel.locator('.switch-draft').textContent();
  await chooseSwitch(page, '수정');
  for (const label of ['앞 글자', '뒤 글자', '입력 되돌리기']) {
    await chooseSwitch(page, label); await expect(panel).toContainText('한글 조합을 마치거나 취소하세요');
    await expect(panel.locator('.switch-draft')).toHaveText(before ?? '');
  }
  await chooseSwitch(page, '상위로'); await chooseSwitch(page, '문구'); await chooseSwitch(page, '라');
  await expect(panel.locator('.switch-draft')).toHaveText(before ?? ''); await expect(page.locator('#field')).toHaveValue('앞뒤');
  expect(await page.evaluate(() => (window as Window & { events?: number }).events)).toBe(0);
  await chooseSwitch(page, '상위로'); await chooseSwitch(page, '한글 쓰기'); await chooseSwitch(page, '없음 ㄱ ㄲ ㄳ ㄴ ㄵ'); await chooseSwitch(page, '없음');
  await chooseSwitch(page, '문구'); await chooseSwitch(page, '라'); await expect(panel.locator('.switch-draft')).toHaveText('앞가라뒤');
  await chooseSwitch(page, '입력칸에 적용'); await expect(page.locator('#field')).toHaveValue('앞가라뒤');
  expect(await page.evaluate(() => (window as Window & { events?: number }).events)).toBe(1);
});

test('pending Hangul blocks a space while explicit composition cancellation permits it', async ({ context, servePage }) => {
  test.setTimeout(120000); servePage('http://practice.test/pending-space', fixture);
  const page = await context.newPage(); await page.goto('http://practice.test/pending-space'); const panel = await pending(page);
  const before = await panel.locator('.switch-draft').textContent(); await chooseSwitch(page, '띄어쓰기');
  await expect(panel).toContainText('한글 조합을 마치거나 취소하세요'); await expect(panel.locator('.switch-draft')).toHaveText(before ?? '');
  await expect(page.locator('#field')).toHaveValue('앞뒤'); expect(await page.evaluate(() => (window as Window & { events?: number }).events)).toBe(0);
  for (let i = 0; i < 2; i++) { await chooseSwitch(page, '수정'); await chooseSwitch(page, '조합 한 단계 취소'); }
  await expect(panel.locator('.switch-draft')).toHaveText('앞뒤'); await chooseSwitch(page, '띄어쓰기');
  await expect(panel.locator('.switch-draft')).toHaveText('앞 뒤'); await chooseSwitch(page, '입력칸에 적용'); await expect(page.locator('#field')).toHaveValue('앞 뒤');
  expect(await page.evaluate(() => (window as Window & { events?: number }).events)).toBe(1);
});
