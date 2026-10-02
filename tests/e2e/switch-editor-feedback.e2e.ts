import { test, expect } from './fixtures';
import { chooseSwitch, startSwitch } from './switch-helpers';

test('the remembered selection and subsequent insertion position are visible in the draft', async ({ context, serviceWorker, servePage }) => {
  servePage('http://practice.test/editor-feedback.html', '<input aria-label="문장" value="가👍🏽나">');
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchPhrases: ['라'], switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
  const page = await context.newPage();
  await page.goto('http://practice.test/editor-feedback.html');
  const field = page.getByRole('textbox');
  await field.evaluate((el) => { (el as HTMLInputElement).setSelectionRange(1, 5, 'backward'); });
  await startSwitch(page);
  await chooseSwitch(page, '찾기');
  await chooseSwitch(page, '문장');
  const draft = page.locator('tremor-helper-root').locator('.switch-draft');
  await expect(draft.locator('.switch-selection')).toHaveText('👍🏽');
  await expect(draft.locator('.switch-caret')).toBeVisible();
  await expect(draft).toHaveText('가👍🏽나');
  await chooseSwitch(page, '문구');
  await chooseSwitch(page, '라');
  await expect(draft).toHaveText('가라나');
  await expect(draft.locator('.switch-selection')).toHaveCount(0);
  await expect(draft.locator('.switch-caret')).toBeVisible();
  await expect.poll(() => draft.locator('.switch-caret').evaluate((el) => el.previousSibling?.textContent)).toBe('가라');
  await expect(field).toHaveValue('가👍🏽나');
});

test('the insertion position stays visible in a long draft without scrolling the page', async ({ context, serviceWorker, servePage }, testInfo) => {
  const value = '가나다\n'.repeat(70);
  servePage('http://practice.test/long-draft.html', `<textarea aria-label="문장">${value}</textarea><main style="height:5000px">본문</main>`);
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
  const page = await context.newPage();
  await page.setViewportSize({ width: 360, height: 720 });
  await page.goto('http://practice.test/long-draft.html');
  await page.getByRole('textbox').evaluate((el) => { const field = el as HTMLTextAreaElement; field.setSelectionRange(field.value.length, field.value.length); });
  await startSwitch(page);
  await chooseSwitch(page, '찾기');
  await chooseSwitch(page, '문장');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await expect(panel.locator('.switch-status')).toHaveText('스페이스바로 선택');
  await expect(panel.locator('.switch-status')).toBeVisible();
  const draft = panel.locator('.switch-draft');
  await expect(draft.locator('.switch-caret')).toBeVisible();
  const measured = await draft.evaluate((el) => {
    const bounds = el.getBoundingClientRect(), caret = el.querySelector('.switch-caret')?.getBoundingClientRect();
    const panel = el.closest('.switch-panel'); const status = panel?.querySelector('.switch-status'); const statusBounds = status?.getBoundingClientRect();
    return { statusText: status?.textContent, statusTop: statusBounds?.top, statusBottom: statusBounds?.bottom, statusColor: status ? getComputedStyle(status).color : null, draftTop: bounds.top, draftBottom: bounds.bottom, caretTop: caret?.top, caretBottom: caret?.bottom, scrollY: window.scrollY };
  });
  expect(measured.statusBottom).toBeLessThanOrEqual(measured.draftTop);
  expect(measured.statusTop).toBeGreaterThanOrEqual(0);
  expect(measured.caretTop).toBeGreaterThanOrEqual(measured.draftTop);
  expect(measured.caretBottom).toBeLessThanOrEqual(measured.draftBottom);
  expect(measured.scrollY).toBe(0);
  await testInfo.attach('draft-caret-measurements', { body: JSON.stringify(measured), contentType: 'application/json' });
  await testInfo.attach('draft-caret', { body: await page.screenshot(), contentType: 'image/png' });
});
