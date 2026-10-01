import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { chooseSwitch } from './switch-helpers';
async function choose(page: Page, label: string) { await chooseSwitch(page, label); await page.waitForTimeout(350); }
async function space(page: Page) { await page.keyboard.press('Space'); await page.waitForTimeout(350); }

test('Space fake handoff has one owner, consumes resume, preserves drafts and returns on cancel', async ({ context, extensionId, expectNoExternalRequests }) => {
  test.setTimeout(90000);
  const page = await context.newPage(); await page.goto(`chrome-extension://${extensionId}/handoff-practice.html`);
  await page.getByRole('textbox', { name: '페이지 역할 문장' }).fill('페이지 문장');
  await page.getByRole('textbox', { name: '연습 역할 문장' }).fill('연습 문장');
  await page.getByRole('button', { name: '일반 버튼' }).focus(); await space(page);
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await choose(page, '연습 역할로 이동'); await expect(page.locator('#owner')).toHaveText('지금 입력: 연습 역할');
  await expect(panel).toHaveAttribute('data-mode', 'paused'); await space(page);
  await expect(page.locator('#page-count')).toHaveText('0'); await expect(page.locator('#practice-count')).toHaveText('0');
  await choose(page, '연습 상태 확인'); await expect(page.locator('#practice-count')).toHaveText('1');
  await choose(page, '취소 · 페이지 역할로 복귀'); await expect(page.locator('#owner')).toHaveText('지금 입력: 페이지 역할');
  await expect(panel).toHaveAttribute('data-mode', 'paused'); await space(page);
  await expect(page.locator('#page-count')).toHaveText('0');
  await expect(page.getByRole('textbox', { name: '페이지 역할 문장' })).toHaveValue('페이지 문장');
  await expect(page.getByRole('textbox', { name: '연습 역할 문장' })).toHaveValue('연습 문장');
  await choose(page, '페이지 연습 동작'); await expect(page.locator('#page-count')).toHaveText('1');
  await choose(page, '즉시 정지 · 연습 종료'); await expect(page.locator('tremor-helper-root')).toHaveCount(0);
  await page.getByRole('textbox', { name: '일반 입력' }).focus(); await page.keyboard.type('a b');
  await expect(page.getByRole('textbox', { name: '일반 입력' })).toHaveValue('a b');
  await page.getByRole('button', { name: '일반 버튼' }).focus(); await page.keyboard.press('Space'); await expect(page.locator('#normal-count')).toHaveText('1');
  expectNoExternalRequests();
});
test('Space during delayed fake response stops; late reply cannot revive either role', async ({ context, extensionId }) => {
  test.setTimeout(60000);
  const page = await context.newPage(); await page.goto(`chrome-extension://${extensionId}/handoff-practice.html`);
  await page.getByRole('checkbox', { name: '지연 응답 연습' }).check(); await page.getByRole('button', { name: '일반 버튼' }).focus();
  await space(page); await choose(page, '연습 역할로 이동'); await space(page); await choose(page, '연습 상태 확인');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel'); await expect(panel).toHaveAttribute('data-mode', 'executing');
  await space(page); await expect(page.locator('tremor-helper-root')).toHaveCount(0);
  await page.waitForTimeout(2800); await expect(page.locator('#practice-count')).toHaveText('0'); await expect(page.locator('#page-count')).toHaveText('0');
});
test('a pending stop press still stops when the reply arrives before release', async ({ context, extensionId }) => {
  const page = await context.newPage(); await page.goto(`chrome-extension://${extensionId}/handoff-practice.html`);
  await page.getByRole('checkbox', { name: '지연 응답 연습' }).check(); await page.getByRole('button', { name: '일반 버튼' }).focus();
  await space(page); await choose(page, '연습 역할로 이동'); await space(page); await choose(page, '연습 상태 확인');
  await page.keyboard.down('Space'); await expect(page.locator('#practice-count')).toHaveText('1');
  await page.keyboard.up('Space'); await expect(page.locator('tremor-helper-root')).toHaveCount(0);
});
test('fake document/session change invalidates a delayed reply; new explicit selection still works', async ({ context, extensionId }) => {
  test.setTimeout(90000);
  const page = await context.newPage(); await page.goto(`chrome-extension://${extensionId}/handoff-practice.html`);
  await page.getByRole('checkbox', { name: '지연 응답 연습' }).check(); await page.getByRole('button', { name: '일반 버튼' }).focus();
  await space(page); await choose(page, '연습 역할로 이동'); await space(page); await choose(page, '연습 상태 확인');
  await page.getByRole('button', { name: '문서 변경 연습' }).click(); await page.getByRole('button', { name: '세션 변경 연습' }).click();
  const panel = page.locator('tremor-helper-root').locator('.switch-panel'); await expect(panel).toHaveAttribute('data-mode', 'paused');
  await page.waitForTimeout(2800); await expect(page.locator('#practice-count')).toHaveText('0');
  await page.getByRole('checkbox', { name: '지연 응답 연습' }).uncheck(); await page.getByRole('button', { name: '일반 버튼' }).focus(); await space(page);
  await choose(page, '연습 상태 확인'); await expect(page.locator('#practice-count')).toHaveText('1');
});

test('focus change during held Space consumes release and preserves the role draft', async ({ context, extensionId, expectNoExternalRequests }) => {
  const page = await context.newPage(); await page.goto(`chrome-extension://${extensionId}/handoff-practice.html`);
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await space(page);
  await expect.poll(() => panel.locator('.switch-choice[aria-current="true"]').textContent()).toBe('연습 역할로 이동');
  await page.keyboard.down('Space');
  const draft = page.getByRole('textbox', { name: '페이지 역할 문장' });
  await draft.focus(); await page.keyboard.up('Space'); await draft.fill('보존할 문장');
  await expect(panel).toHaveAttribute('data-mode', 'paused');
  await expect(page.locator('#owner')).toHaveText('지금 입력: 페이지 역할');
  await page.getByRole('button', { name: '일반 버튼' }).focus();
  await expect(page.locator('#page-count')).toHaveText('0'); await space(page);
  await expect(panel).toHaveAttribute('data-mode', 'groupScan');
  await expect(page.locator('#owner')).toHaveText('지금 입력: 페이지 역할');
  await choose(page, '연습 역할로 이동'); await space(page); await choose(page, '취소 · 페이지 역할로 복귀');
  await expect(draft).toHaveValue('보존할 문장'); expectNoExternalRequests();
});

for (const width of [360, 768, 1280]) {
  test(`handoff ${String(width)}px keeps role, prototype label and cancel visible`, async ({ context, extensionId }, testInfo) => {
    const page = await context.newPage(); await page.setViewportSize({ width, height: 800 });
    await page.goto(`chrome-extension://${extensionId}/handoff-practice.html`);
    await space(page); await choose(page, '연습 역할로 이동'); await space(page);
    const panel = page.locator('tremor-helper-root').locator('.switch-panel');
    await expect(panel.locator('h2')).toContainText('연습 역할 · 실제 파일/OS 입력 없음');
    await expect(panel.locator('.switch-status')).toBeVisible();
    await expect(panel.locator('.switch-choice').first()).toHaveText('취소 · 페이지 역할로 복귀');
    const metrics = await panel.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return { x: box.x, right: box.right, bottom: box.bottom, choices: Array.from(el.querySelectorAll('.switch-choice')).map((choice) => ({ height: choice.getBoundingClientRect().height, font: parseFloat(getComputedStyle(choice).fontSize) })) };
    });
    expect(metrics.x).toBeGreaterThanOrEqual(0); expect(metrics.right).toBeLessThanOrEqual(width); expect(metrics.bottom).toBeLessThanOrEqual(800);
    for (const choice of metrics.choices) { expect(choice.height).toBeGreaterThanOrEqual(56); expect(choice.font).toBeGreaterThanOrEqual(18); }
    await testInfo.attach('handoff-dom', { body: JSON.stringify(metrics), contentType: 'application/json' });
    await page.screenshot({ path: `docs/verification/handoff-practice-${String(width)}.png` });
  });
}
