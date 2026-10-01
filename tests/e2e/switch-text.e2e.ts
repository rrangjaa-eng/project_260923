import { test, expect } from './fixtures';
import { chooseSwitch, composeSwitchSyllable, startSwitch } from './switch-helpers';

test('completed syllable returns to the editor and one parent selection returns to groups', async ({ context, serviceWorker, servePage }) => {
  test.setTimeout(60000);
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
  servePage('http://practice.test/text.html', '<input type="search" aria-label="검색어">');
  const page = await context.newPage();
  await page.goto('http://practice.test/text.html');
  await startSwitch(page);
  await chooseSwitch(page, '찾기');
  await chooseSwitch(page, '검색어');
  await composeSwitchSyllable(page, 'ㄱ', 'ㅏ');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await expect(panel.locator('.switch-draft')).toHaveText('가');
  await chooseSwitch(page, '상위로');
  await expect(panel).toHaveAttribute('data-mode', 'groupScan');
  await expect(panel.locator('.switch-choice')).toHaveText(['찾기', '페이지 항목', '읽기·이동', '글쓰기', '조절·쉬기']);
});
