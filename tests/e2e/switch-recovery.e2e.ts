import { test, expect } from './fixtures';
import { chooseSwitch, startSwitch } from './switch-helpers';

test.beforeEach(async ({ serviceWorker }) => {
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
});

test('pause and resume preserve a partial Korean syllable and the resume press only resumes', async ({ context, servePage }) => {
  test.setTimeout(60000);
  servePage('http://practice.test/partial.html', '<input type="search" aria-label="검색어">');
  const page = await context.newPage();
  await page.goto('http://practice.test/partial.html');
  await startSwitch(page);
  await chooseSwitch(page, '찾기');
  await chooseSwitch(page, '검색어');
  await chooseSwitch(page, '한글 쓰기');
  await chooseSwitch(page, 'ㅁ ㅂ ㅃ ㅅ ㅆ ㅇ');
  await chooseSwitch(page, 'ㅇ');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await expect(panel.locator('.switch-draft')).toHaveText('[ㅇ]');
  await chooseSwitch(page, '쉬기');
  await expect(panel).toHaveAttribute('data-mode', 'paused');
  await page.keyboard.press('Space');
  await page.waitForTimeout(125);
  await expect(panel).toHaveAttribute('data-mode', 'composing');
  await expect(panel.locator('.switch-draft')).toHaveText('[ㅇ]');
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await chooseSwitch(page, 'ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ');
  await chooseSwitch(page, 'ㅏ');
  await chooseSwitch(page, '없음 ㄱ ㄲ ㄳ ㄴ ㄵ');
  await chooseSwitch(page, '없음');
  await expect(panel.locator('.switch-draft')).toHaveText('아');
});

test('external field updates are not overwritten and the preserved draft can be reselected', async ({ context, serviceWorker, servePage }) => {
  servePage('http://practice.test/conflict.html', '<input type="search" aria-label="검색어">');
  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.set({ switchPhrases: ['안녕'] });
  });
  const page = await context.newPage();
  await page.goto('http://practice.test/conflict.html');
  await startSwitch(page);
  await chooseSwitch(page, '찾기');
  await chooseSwitch(page, '검색어');
  await chooseSwitch(page, '문구');
  await chooseSwitch(page, '안녕');
  await page.getByRole('searchbox').evaluate((el) => { (el as HTMLInputElement).value = '사이트 변경'; });
  await chooseSwitch(page, '입력칸에 적용');
  await expect(page.getByRole('searchbox')).toHaveValue('사이트 변경');
  await expect(page.locator('tremor-helper-root').locator('.switch-draft')).toHaveText('안녕');
  await expect(page.locator('tremor-helper-root').locator('.switch-status')).toContainText('보존');
});

test('deleted page targets keep their snapshot position and cannot execute', async ({ context, servePage }) => {
  servePage('http://practice.test/deleted.html', '<a id="old" href="#old">이전 링크</a><a href="#next">다음 링크</a>');
  const page = await context.newPage();
  await page.goto('http://practice.test/deleted.html');
  await startSwitch(page);
  await chooseSwitch(page, '페이지 항목');
  await page.locator('#old').evaluate((el) => { el.remove(); });
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await expect(panel.locator('.switch-choice[data-item-id="target:0"]')).toHaveAttribute('aria-disabled', 'true');
  await chooseSwitch(page, '이전 링크');
  await expect(page).toHaveURL('http://practice.test/deleted.html');
  await expect(panel.locator('.switch-choice[data-item-id="target:1"]')).toHaveText('다음 링크');
});

test('a selected whitespace command and saved phrase are inserted without leaking physical Space into the field', async ({ context, serviceWorker, servePage }) => {
  test.setTimeout(60000);
  servePage('http://practice.test/phrases.html', '<input type="search" aria-label="검색어" value="가">');
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchPhrases: ['나'] }));
  const page = await context.newPage();
  await page.goto('http://practice.test/phrases.html');
  await startSwitch(page);
  await chooseSwitch(page, '찾기');
  await chooseSwitch(page, '검색어');
  await chooseSwitch(page, '띄어쓰기');
  await chooseSwitch(page, '문구');
  await chooseSwitch(page, '나');
  await expect(page.getByRole('searchbox')).toHaveValue('가');
  await chooseSwitch(page, '입력칸에 적용');
  await expect(page.getByRole('searchbox')).toHaveValue('가 나');
  await chooseSwitch(page, '문구');
  await chooseSwitch(page, '문구 저장');
  await expect.poll(() => serviceWorker.evaluate(async () => (await chrome.storage.local.get('switchPhrases')).switchPhrases)).toEqual(['나', '가 나']);
});
