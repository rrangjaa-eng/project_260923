import { test, expect } from './fixtures';
import { chooseSwitch, startSwitch } from './switch-helpers';

test('pending Hangul cannot apply, search or save a partial phrase; completion permits each explicit action', async ({ context, serviceWorker, servePage, expectNoExternalRequests }) => {
  test.setTimeout(180000);
  await serviceWorker.evaluate(() => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 }, switchPhrases: ['남길 문구'] }));
  servePage('http://practice.test/compose-commit', `<form method="get" action="/results"><label>문장<input id="field" type="search" name="q" value="앞뒤"></label></form><script>
  document.querySelector('input').setSelectionRange(1,1);window.events=0;window.queries=[];
  document.addEventListener('input',()=>window.events++);
  document.querySelector('form').addEventListener('submit',event=>{event.preventDefault();window.queries.push(new FormData(event.target).get('q'));});
  </script>`);
  const page = await context.newPage(); await page.goto('http://practice.test/compose-commit');
  await startSwitch(page); await chooseSwitch(page, '찾기'); await chooseSwitch(page, '문장');
  await chooseSwitch(page, '영문·숫자 쓰기'); await chooseSwitch(page, 'a b c d e f'); await chooseSwitch(page, 'a');
  await chooseSwitch(page, '한글 쓰기'); await chooseSwitch(page, 'ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ'); await chooseSwitch(page, 'ㄱ');
  await chooseSwitch(page, 'ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ'); await chooseSwitch(page, 'ㅏ');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  for (let i = 0; i < 6 && await panel.locator('[data-item-id="apply"]').count() === 0; i++) await chooseSwitch(page, '상위로');
  const before = await panel.locator('.switch-draft').textContent();
  for (const label of ['입력칸에 적용', '검색', '문구 저장']) {
    if (label === '문구 저장') await chooseSwitch(page, '문구');
    await chooseSwitch(page, label); await expect(panel).toContainText('한글 조합을 마치거나 취소하세요');
    expect(await panel.locator('.switch-draft').textContent()).toBe(before);
    await expect(page.locator('#field')).toHaveValue('앞뒤');
    expect(await page.evaluate(() => ({ events: (window as Window & { events?: number }).events, queries: (window as Window & { queries?: string[] }).queries }))).toEqual({ events: 0, queries: [] });
    expect(await serviceWorker.evaluate(async () => (await chrome.storage.local.get('switchPhrases')).switchPhrases)).toEqual(['남길 문구']);
  }
  await chooseSwitch(page, '상위로'); await chooseSwitch(page, '한글 쓰기'); await chooseSwitch(page, '없음 ㄱ ㄲ ㄳ ㄴ ㄵ'); await chooseSwitch(page, '없음');
  await expect(panel.locator('.switch-draft')).toHaveText('앞a가뒤');
  await chooseSwitch(page, '입력칸에 적용'); await expect(page.locator('#field')).toHaveValue('앞a가뒤');
  expect(await page.evaluate(() => (window as Window & { events?: number }).events)).toBe(1);
  await chooseSwitch(page, '문구'); await chooseSwitch(page, '문구 저장');
  await expect.poll(() => serviceWorker.evaluate(async () => (await chrome.storage.local.get('switchPhrases')).switchPhrases)).toEqual(['남길 문구', '앞a가뒤']);
  await chooseSwitch(page, '상위로'); await chooseSwitch(page, '검색');
  await expect.poll(() => page.evaluate(() => (window as Window & { queries?: string[] }).queries)).toEqual(['앞a가뒤']);
  expectNoExternalRequests();
});
