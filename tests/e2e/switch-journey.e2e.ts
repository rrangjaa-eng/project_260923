import { test, expect } from './fixtures';
import { chooseSwitch, composeSwitchSyllable, startSwitch } from './switch-helpers';

test('space only Korean writing, middle edit, search, reading, back and another tab', async ({ context, serviceWorker, servePage, expectNoExternalRequests }) => {
  test.setTimeout(300000);
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
  servePage('http://practice.test/other-reading.html', '<title>다른 읽기 탭</title><h1>다른 탭 본문</h1>');
  const other = await context.newPage();
  await other.goto('http://practice.test/other-reading.html');
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => { errors.push(error.message); });
  await page.goto('http://practice.test/switch-search.html');
  await page.bringToFront();
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');

  await test.step('create a new Korean sentence with Space selections', async () => {
    await startSwitch(page);
    await chooseSwitch(page, '찾기');
    await chooseSwitch(page, '검색어');
    for (const [initial, medial, final] of [['ㅇ', 'ㅏ', 'ㄴ'], ['ㄴ', 'ㅕ', 'ㅇ'], ['ㅎ', 'ㅏ', '없음'], ['ㅅ', 'ㅔ', '없음'], ['ㅇ', 'ㅛ', '없음']] as const) {
      await composeSwitchSyllable(page, initial, medial, final);
    }
    await expect(panel.locator('.switch-draft')).toHaveText('안녕하세요');
    await expect(page.getByRole('searchbox')).toHaveValue('');
  });

  await test.step('edit a middle syllable and apply the draft', async () => {
    await chooseSwitch(page, '수정');
    for (let i = 0; i < 3; i++) await chooseSwitch(page, '앞 글자');
    await chooseSwitch(page, '앞 글자 삭제');
    await expect(panel.locator('.switch-draft')).toHaveText('안하세요');
    await chooseSwitch(page, '상위로');
    await composeSwitchSyllable(page, 'ㄴ', 'ㅕ', 'ㅇ');
    await expect(panel.locator('.switch-draft')).toHaveText('안녕하세요');
    await chooseSwitch(page, '입력칸에 적용');
    await expect(page.getByRole('searchbox')).toHaveValue('안녕하세요');
    await chooseSwitch(page, '검색');
    await expect(page).toHaveURL('http://practice.test/switch-results.html?q=%EC%95%88%EB%85%95%ED%95%98%EC%84%B8%EC%9A%94');
    await expect(page.locator('#query')).toHaveText('안녕하세요');
  });

  await test.step('read, scroll and stop without another action', async () => {
    await startSwitch(page);
    await chooseSwitch(page, '페이지 항목');
    await chooseSwitch(page, '한글 결과 읽기');
    await expect(page).toHaveURL('http://practice.test/switch-article.html');
    await expect(page.locator('article')).toContainText('안녕하세요');
    await startSwitch(page);
    await chooseSwitch(page, '읽기·이동');
    await chooseSwitch(page, '한 화면 아래');
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
    await chooseSwitch(page, '자동 스크롤');
    await expect(panel).toHaveAttribute('data-mode', 'scrolling');
    const start = await page.evaluate(() => scrollY);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(start);
    await page.keyboard.press('Space');
    await expect(panel).toHaveAttribute('data-mode', 'itemScan');
    const stopped = await page.evaluate(() => scrollY);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => scrollY)).toBe(stopped);
  });

  await test.step('go back and select another open tab', async () => {
    await chooseSwitch(page, '뒤로');
    await expect(page).toHaveURL(/\/switch-results.html\?q=/);
    await startSwitch(page);
    await chooseSwitch(page, '읽기·이동');
    await chooseSwitch(page, '열린 탭');
    await chooseSwitch(page, '다른 읽기 탭');
    const active = await serviceWorker.evaluate(async () => (await chrome.tabs.query({ active: true }))[0]?.url);
    expect(active).toBe('http://practice.test/other-reading.html');
    await expect(other.locator('tremor-helper-root').locator('.switch-panel')).toHaveAttribute('data-mode', 'paused');
    await other.keyboard.press('Space');
    await expect(other.locator('tremor-helper-root').locator('.switch-panel')).toHaveAttribute('data-mode', 'groupScan');
  });
  expect(errors).toEqual([]);
  expectNoExternalRequests();
});
