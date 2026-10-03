import { test, expect } from './fixtures';
import { chooseSwitch, startSwitch } from './switch-helpers';
import type { Page } from '@playwright/test';

test.beforeEach(async ({ serviceWorker }) => {
  await serviceWorker.evaluate(() => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
});
test.afterEach(({ expectNoExternalRequests }) => { expectNoExternalRequests(); });

async function character(page: Page, group: string, value: string) {
  await chooseSwitch(page, '영문·숫자 쓰기');
  await chooseSwitch(page, group);
  await chooseSwitch(page, value);
}
const counters = `<script>window.counts={input:0,change:0,submit:0};for(const kind of Object.keys(window.counts))document.addEventListener(kind,event=>{window.counts[kind]++;if(kind==='submit')event.preventDefault();});</script>`;

test('general Space characters replace a selection, undo, and apply exactly once', async ({ context, servePage }) => {
  test.setTimeout(120000);
  servePage('http://practice.test/characters', `<label>시험 문장<input id="field" value="가👍🏽나"></label><script>document.querySelector('input').setSelectionRange(1,5);</script>${counters}`);
  const page = await context.newPage(); await page.goto('http://practice.test/characters');
  await startSwitch(page); await chooseSwitch(page, '찾기'); await chooseSwitch(page, '시험 문장');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await chooseSwitch(page, '영문·숫자 쓰기');
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const dimensions = await panel.evaluate(node => ({ right: node.getBoundingClientRect().right, bottom: node.getBoundingClientRect().bottom, choices: Array.from(node.querySelectorAll('.switch-choice')).map(choice => ({ height: choice.getBoundingClientRect().height, font: parseFloat(getComputedStyle(choice).fontSize) })) }));
    expect(dimensions.right).toBeLessThanOrEqual(width); expect(dimensions.bottom).toBeLessThanOrEqual(800);
    for (const choice of dimensions.choices) { expect(choice.height).toBeGreaterThanOrEqual(56); expect(choice.font).toBeGreaterThanOrEqual(18); }
  }
  await chooseSwitch(page, 'a b c d e f'); await chooseSwitch(page, 'a');
  await expect(panel.locator('.switch-draft')).toHaveText('가a나'); await expect(page.locator('#field')).toHaveValue('가👍🏽나');
  await chooseSwitch(page, '수정'); await chooseSwitch(page, '입력 되돌리기'); await expect(panel.locator('.switch-draft')).toHaveText('가👍🏽나');
  await chooseSwitch(page, '상위로'); await character(page, 'W X Y Z 0 1', '1');
  await expect(page.locator('#field')).toHaveValue('가👍🏽나');
  expect(await page.evaluate(() => (window as Window & { counts?: { input: number; change: number; submit: number } }).counts)).toEqual({ input: 0, change: 0, submit: 0 });
  await chooseSwitch(page, '입력칸에 적용'); await expect(page.locator('#field')).toHaveValue('가1나');
  expect(await page.evaluate(() => (window as Window & { counts?: { input: number; change: number; submit: number } }).counts)).toEqual({ input: 1, change: 1, submit: 0 });
});

test('unfinished Hangul survives blocked ASCII and resumes before the next character', async ({ context, servePage }) => {
  test.setTimeout(120000);
  servePage('http://practice.test/character-compose', `<label>시험 문장<input id="field"></label>${counters}`);
  const page = await context.newPage(); await page.goto('http://practice.test/character-compose');
  await startSwitch(page); await chooseSwitch(page, '찾기'); await chooseSwitch(page, '시험 문장');
  await chooseSwitch(page, '한글 쓰기'); await chooseSwitch(page, 'ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ'); await chooseSwitch(page, 'ㄱ');
  await chooseSwitch(page, 'ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ'); await chooseSwitch(page, 'ㅏ');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  for (let i = 0; i < 6 && await panel.locator('[data-item-id="ascii"]').count() === 0; i++) await chooseSwitch(page, '상위로');
  await chooseSwitch(page, '영문·숫자 쓰기'); await expect(panel).toContainText('한글 조합을 마치거나 취소하세요');
  await expect(page.locator('#field')).toHaveValue('');
  await chooseSwitch(page, '한글 쓰기'); await chooseSwitch(page, '없음 ㄱ ㄲ ㄳ ㄴ ㄵ'); await chooseSwitch(page, '없음');
  await character(page, 'a b c d e f', 'a'); await expect(panel.locator('.switch-draft')).toHaveText('가a');
  await expect(page.locator('#field')).toHaveValue(''); await chooseSwitch(page, '입력칸에 적용'); await expect(page.locator('#field')).toHaveValue('가a');
  expect(await page.evaluate(() => (window as Window & { counts?: { input: number; change: number; submit: number } }).counts)).toEqual({ input: 1, change: 1, submit: 0 });
});

test('email and tel form fields retain character drafts and apply only the selected field', async ({ context, servePage }) => {
  test.setTimeout(120000);
  servePage('http://practice.test/character-form', `<form><label>이메일<input id="mail" type="email"></label><label>전화<input id="tel" type="tel"></label><button>제출</button></form>${counters}`);
  const page = await context.newPage(); await page.goto('http://practice.test/character-form');
  await startSwitch(page); await chooseSwitch(page, '글쓰기'); await chooseSwitch(page, '양식 한 장 보기'); await chooseSwitch(page, '이메일');
  await character(page, 'a b c d e f', 'a'); await character(page, '# @ ~', '@');
  await chooseSwitch(page, '다음 칸'); await character(page, 'W X Y Z 0 1', '1'); await chooseSwitch(page, '이전 칸');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel'); await expect(panel.locator('.switch-draft')).toHaveText('a@');
  await expect(page.locator('#mail')).toHaveValue(''); await expect(page.locator('#tel')).toHaveValue('');
  await chooseSwitch(page, '다음 칸'); await expect(panel.locator('.switch-draft')).toHaveText('1');
  await chooseSwitch(page, '입력칸에 적용'); await expect(page.locator('#tel')).toHaveValue('1'); await expect(page.locator('#mail')).toHaveValue('');
  expect(await page.evaluate(() => (window as Window & { counts?: { input: number; change: number; submit: number } }).counts)).toEqual({ input: 1, change: 1, submit: 0 });
});

test('a field becoming sensitive cannot receive the character draft or expose its replacement value', async ({ context, serviceWorker, servePage }) => {
  test.setTimeout(80000);
  servePage('http://practice.test/character-sensitive', `<label>시험 문장<input id="field"></label>${counters}`);
  const page = await context.newPage(); await page.goto('http://practice.test/character-sensitive');
  await startSwitch(page); await chooseSwitch(page, '찾기'); await chooseSwitch(page, '시험 문장'); await character(page, 'a b c d e f', 'a');
  await page.locator('#field').evaluate((node: HTMLInputElement) => { node.type = 'password'; node.value = 'private-fixture-value'; });
  await chooseSwitch(page, '입력칸에 적용'); await expect(page.locator('#field')).toHaveValue('private-fixture-value');
  expect(await page.evaluate(() => (window as Window & { counts?: { input: number; change: number; submit: number } }).counts)).toEqual({ input: 0, change: 0, submit: 0 });
  await expect(page.locator('tremor-helper-root').locator('.switch-panel')).not.toContainText('private-fixture-value');
  const stored = await serviceWorker.evaluate(async () => JSON.stringify({ local: await chrome.storage.local.get(null), session: await chrome.storage.session.get(null) }));
  expect(stored).not.toContain('private-fixture-value');
});
