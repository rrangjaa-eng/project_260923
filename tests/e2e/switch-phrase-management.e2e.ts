import { test, expect } from './fixtures';
import { chooseSwitch, startSwitch } from './switch-helpers';
import type { SettingsV1 } from '../../src/core/settings-schema';
test.beforeEach(async ({ serviceWorker }) => {
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 }, switchPhrases: ['기존 문구', '남길 문구'] }));
});
test('Space-only explicit replacement previews both texts, cancel preserves draft and confirm writes once', async ({ context, serviceWorker, servePage, expectNoExternalRequests }) => {
  test.setTimeout(120000);
  servePage('http://practice.test/manage-phrase.html', '<input aria-label="문장" value="새 문구"><form onsubmit="window.submits=(window.submits||0)+1;return false"><button>제출</button></form>');
  const page = await context.newPage(); await page.goto('http://practice.test/manage-phrase.html'); await startSwitch(page); await chooseSwitch(page, '글쓰기'); await chooseSwitch(page, '입력칸 선택'); await chooseSwitch(page, '문장');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await chooseSwitch(page, '문구'); await chooseSwitch(page, '문구 관리'); await chooseSwitch(page, '기존 문구'); await chooseSwitch(page, '현재 문장으로 바꾸기');
  await expect(panel.locator('.switch-draft')).toContainText('기존 문구'); await chooseSwitch(page, '다음 미리보기'); await expect(panel.locator('.switch-draft')).toContainText('새 문구');
  expect(await panel.locator('.switch-draft').evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const metrics = await panel.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return { x: box.x, right: box.right, bottom: box.bottom, choices: Array.from(el.querySelectorAll('.switch-choice')).map((choice) => ({ height: choice.getBoundingClientRect().height, font: parseFloat(getComputedStyle(choice).fontSize) })) };
    });
    expect(metrics.x).toBeGreaterThanOrEqual(0); expect(metrics.right).toBeLessThanOrEqual(width); expect(metrics.bottom).toBeLessThanOrEqual(800);
    for (const choice of metrics.choices) { expect(choice.height).toBeGreaterThanOrEqual(56); expect(choice.font).toBeGreaterThanOrEqual(18); }
    await expect(panel.locator('h2')).toBeVisible(); await expect(panel.locator('.switch-choice[data-item-id="phrase-cancel"]')).toBeVisible();
    await page.screenshot({ path: `docs/verification/phrase-confirm-${String(width)}.png` });
  }
  await chooseSwitch(page, '취소'); await expect(panel.locator('.switch-draft')).toHaveText('새 문구');
  expect(await serviceWorker.evaluate(async () => (await chrome.storage.local.get('switchPhrases')).switchPhrases)).toEqual(['기존 문구', '남길 문구']);
  await chooseSwitch(page, '현재 문장으로 바꾸기'); await chooseSwitch(page, '확인 · 저장 문구 바꾸기');
  await expect.poll(() => serviceWorker.evaluate(async () => (await chrome.storage.local.get('switchPhrases')).switchPhrases)).toEqual(['새 문구', '남길 문구']);
  await expect(page.getByRole('textbox', { name: '문장' })).toHaveValue('새 문구');
  expect(await page.evaluate(() => (window as Window & { submits?: number }).submits ?? 0)).toBe(0); expectNoExternalRequests();
});
test('changed phrase snapshot refuses deletion and never retries or applies the draft', async ({ context, serviceWorker, servePage }) => {
  test.setTimeout(90000);
  servePage('http://practice.test/conflict-phrase.html', '<input aria-label="문장" value="작성 문장">');
  const page = await context.newPage(); await page.goto('http://practice.test/conflict-phrase.html'); await startSwitch(page); await chooseSwitch(page, '글쓰기'); await chooseSwitch(page, '입력칸 선택'); await chooseSwitch(page, '문장');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await chooseSwitch(page, '문구'); await chooseSwitch(page, '문구 관리'); await chooseSwitch(page, '기존 문구'); await chooseSwitch(page, '저장 문구 삭제');
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchPhrases: ['다른 문구', '남길 문구'] }));
  await chooseSwitch(page, '확인 · 저장 문구 삭제');
  await expect(panel.locator('.switch-status')).toContainText('저장하지 않았어요');
  expect(await serviceWorker.evaluate(async () => (await chrome.storage.local.get('switchPhrases')).switchPhrases)).toEqual(['다른 문구', '남길 문구']);
  await expect(panel.locator('.switch-draft')).toHaveText('작성 문장'); await expect(page.getByRole('textbox')).toHaveValue('작성 문장');
});
test('rest discards phrase approval and normal explicit deletion still works', async ({ context, serviceWorker, servePage }) => {
  test.setTimeout(120000);
  servePage('http://practice.test/rest-phrase.html', '<input aria-label="문장" value="보존할 문장">');
  const page = await context.newPage(); await page.goto('http://practice.test/rest-phrase.html'); await startSwitch(page); await chooseSwitch(page, '글쓰기'); await chooseSwitch(page, '입력칸 선택'); await chooseSwitch(page, '문장');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await chooseSwitch(page, '문구'); await chooseSwitch(page, '문구 관리'); await chooseSwitch(page, '기존 문구'); await chooseSwitch(page, '저장 문구 삭제');
  await chooseSwitch(page, '쉬기'); await page.keyboard.press('Space'); await page.waitForTimeout(125);
  await expect(panel.locator('.switch-choice[data-item-id="phrase-commit"]')).toHaveCount(0);
  expect(await serviceWorker.evaluate(async () => (await chrome.storage.local.get('switchPhrases')).switchPhrases)).toEqual(['기존 문구', '남길 문구']);
  await chooseSwitch(page, '글쓰기'); await chooseSwitch(page, '문구'); await chooseSwitch(page, '문구 관리'); await chooseSwitch(page, '기존 문구'); await chooseSwitch(page, '저장 문구 삭제'); await chooseSwitch(page, '확인 · 저장 문구 삭제');
  await expect.poll(() => serviceWorker.evaluate(async () => (await chrome.storage.local.get('switchPhrases')).switchPhrases)).toEqual(['남길 문구']);
  await expect(panel.locator('.switch-draft')).toHaveText('보존할 문장');
});
for (const boundary of ['rest', 'off'] as const) {
  test(`late final phrase approval after ${boundary} cannot delete or revive the panel`, async ({ context, serviceWorker, servePage }) => {
    test.setTimeout(90000);
    servePage('http://practice.test/late-phrase.html', '<input aria-label="문장" value="보존할 문장">');
    const page = await context.newPage(); await page.goto('http://practice.test/late-phrase.html'); await startSwitch(page); await chooseSwitch(page, '글쓰기'); await chooseSwitch(page, '입력칸 선택'); await chooseSwitch(page, '문장');
    await chooseSwitch(page, '문구'); await chooseSwitch(page, '문구 관리'); await chooseSwitch(page, '기존 문구'); await chooseSwitch(page, '저장 문구 삭제');
    await serviceWorker.evaluate(() => {
      const send = chrome.tabs.sendMessage.bind(chrome.tabs); let checks = 0;
      const held = globalThis as typeof globalThis & { heldPhraseReply?: boolean; releasePhraseReply?: () => void };
      chrome.tabs.sendMessage = async (tabId, message, options) => {
        const result = await send(tabId, message, options);
        if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'switch/action-check' && ++checks === 2) {
          held.heldPhraseReply = true; await new Promise<void>((resolve) => { held.releasePhraseReply = resolve; });
        }
        return result;
      };
    });
    await chooseSwitch(page, '확인 · 저장 문구 삭제');
    await expect.poll(() => serviceWorker.evaluate(() => (globalThis as typeof globalThis & { heldPhraseReply?: boolean }).heldPhraseReply)).toBe(true);
    const panel = page.locator('tremor-helper-root').locator('.switch-panel');
    if (boundary === 'rest') { await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await expect(panel).toHaveAttribute('data-mode', 'paused'); }
    else {
      await serviceWorker.evaluate(async () => { const { settings } = await chrome.storage.sync.get('settings') as { settings: SettingsV1 }; await chrome.storage.sync.set({ settings: { ...settings, data: { ...settings.data, enabled: false } } }); });
      await expect(panel).toHaveCount(0);
    }
    await serviceWorker.evaluate(() => { (globalThis as typeof globalThis & { releasePhraseReply?: () => void }).releasePhraseReply?.(); });
    await page.waitForTimeout(500);
    expect(await serviceWorker.evaluate(async () => (await chrome.storage.local.get('switchPhrases')).switchPhrases)).toEqual(['기존 문구', '남길 문구']);
    await expect(page.getByRole('textbox')).toHaveValue('보존할 문장');
    if (boundary === 'rest') await expect(panel).toHaveAttribute('data-mode', 'paused'); else await expect(panel).toHaveCount(0);
  });
}
test('long Korean and emoji previews are fully readable with Space page choices before replacement', async ({ context, serviceWorker, servePage }) => {
  test.setTimeout(120000);
  const old = '긴'.repeat(48), replacement = '새'.repeat(24) + '\n👨‍👩‍👧‍👦👍🏽';
  await serviceWorker.evaluate(async (old) => chrome.storage.local.set({ switchPhrases: [old] }), old);
  servePage('http://practice.test/long-phrase.html', '<textarea aria-label="문장"></textarea>');
  const page = await context.newPage(); await page.setViewportSize({ width: 360, height: 800 }); await page.goto('http://practice.test/long-phrase.html');
  await page.getByRole('textbox').fill(replacement); await page.locator('body').click({ position: { x: 5, y: 750 } });
  await startSwitch(page); await chooseSwitch(page, '글쓰기'); await chooseSwitch(page, '입력칸 선택'); await chooseSwitch(page, '문장');
  await chooseSwitch(page, '문구'); await chooseSwitch(page, '문구 관리'); await chooseSwitch(page, old); await chooseSwitch(page, '현재 문장으로 바꾸기');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel'); const previews: string[] = [];
  for (let pageNumber = 0; pageNumber < 4; pageNumber++) {
    previews.push(await panel.locator('.switch-draft').innerText());
    expect(await panel.locator('.switch-draft').evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
    await expect(panel.locator('.switch-choice').first()).toHaveText('취소');
    if (pageNumber < 3) await chooseSwitch(page, '다음 미리보기');
  }
  expect(previews.join('\n')).toContain('↵👨‍👩‍👧‍👦👍🏽');
  expect(await serviceWorker.evaluate(async () => (await chrome.storage.local.get('switchPhrases')).switchPhrases)).toEqual([old]);
  await chooseSwitch(page, '확인 · 저장 문구 바꾸기');
  await expect.poll(() => serviceWorker.evaluate(async () => (await chrome.storage.local.get('switchPhrases')).switchPhrases)).toEqual([replacement]);
});
