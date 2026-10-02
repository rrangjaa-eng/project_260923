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

for (const tag of ['input', 'textarea']) {
  test(`captured ${tag} selection survives pause and explicit return, then a phrase replaces it`, async ({ context, serviceWorker, servePage }) => {
    test.setTimeout(90000);
    servePage('http://practice.test/selection.html', tag === 'input' ? '<input aria-label="문장" value="가👍🏽나">' : '<textarea aria-label="문장">가👍🏽나</textarea>');
    await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchPhrases: ['라'], switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
    const page = await context.newPage();
    await page.goto('http://practice.test/selection.html');
    const field = page.getByRole('textbox');
    await field.evaluate((el) => { (el as HTMLInputElement).setSelectionRange(1, 5, 'backward'); });
    await startSwitch(page);
    await chooseSwitch(page, '찾기');
    await chooseSwitch(page, '문장');
    const panel = page.locator('tremor-helper-root').locator('.switch-panel');
    await chooseSwitch(page, '쉬기');
    await page.keyboard.press('Space');
    await expect(panel).toHaveAttribute('data-mode', 'composing');
    await chooseSwitch(page, '원래 입력칸으로');
    await expect(field).toBeFocused();
    await expect.poll(() => field.evaluate((el) => { const input = el as HTMLInputElement; return [input.selectionStart, input.selectionEnd, input.selectionDirection]; })).toEqual([1, 5, 'backward']);
    await expect(field).toHaveValue('가👍🏽나');
    await chooseSwitch(page, '문구');
    await chooseSwitch(page, '라');
    await expect(panel.locator('.switch-draft')).toHaveText('가라나');
    await chooseSwitch(page, '입력칸에 적용');
    await expect(field).toHaveValue('가라나');
    await expect.poll(() => field.evaluate((el) => [(el as HTMLInputElement).selectionStart, (el as HTMLInputElement).selectionEnd])).toEqual([2, 2]);
    await expect(field).toBeFocused();
  });
}

test('explicit return refuses an externally changed input and preserves the draft', async ({ context, serviceWorker, servePage }) => {
  servePage('http://practice.test/return-conflict.html', '<input aria-label="문장" value="가나">');
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
  const page = await context.newPage();
  await page.goto('http://practice.test/return-conflict.html');
  await startSwitch(page);
  await chooseSwitch(page, '찾기');
  await chooseSwitch(page, '문장');
  const field = page.getByRole('textbox');
  await field.evaluate((el) => { (el as HTMLInputElement).value = '사이트 변경'; });
  await chooseSwitch(page, '원래 입력칸으로');
  await expect(field).toHaveValue('사이트 변경');
  await expect(field).not.toBeFocused();
  await expect(page.locator('tremor-helper-root').locator('.switch-draft')).toHaveText('가나');
  await expect(page.locator('tremor-helper-root').locator('.switch-status')).toContainText('보존');
});

test('explicit return restores a child frame selection without applying the preserved draft', async ({ context, serviceWorker, servePage }) => {
  servePage('http://practice.test/return-parent.html', '<iframe src="http://other.test/return-child.html" title="본문"></iframe>');
  servePage('http://other.test/return-child.html', '<textarea aria-label="문장">가나다</textarea>');
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
  const page = await context.newPage();
  await page.goto('http://practice.test/return-parent.html');
  const field = page.frameLocator('iframe').getByRole('textbox');
  await field.evaluate((el) => { (el as HTMLTextAreaElement).setSelectionRange(1, 2, 'forward'); });
  await startSwitch(page);
  await chooseSwitch(page, '찾기');
  await chooseSwitch(page, '문장');
  await chooseSwitch(page, '원래 입력칸으로');
  await expect(field).toBeFocused();
  await expect.poll(() => field.evaluate((el) => [(el as HTMLTextAreaElement).selectionStart, (el as HTMLTextAreaElement).selectionEnd])).toEqual([1, 2]);
  await expect(field).toHaveValue('가나다');
  await expect(page.locator('tremor-helper-root').locator('.switch-draft')).toHaveText('가나다');
});
