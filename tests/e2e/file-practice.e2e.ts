import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { chooseSwitch } from './switch-helpers';

async function choosePractice(page: Page, label: string) { await chooseSwitch(page, label); await page.waitForTimeout(350); }

test('practice file: Space group/item selection, protected confirmation, return and immediate stop', async ({ context, extensionId, expectNoExternalRequests }) => {
  test.setTimeout(90000);
  const page = await context.newPage(); await page.goto(`chrome-extension://${extensionId}/file-practice.html`);
  await expect(page.getByRole('heading', { name: '파일 선택 연습 · 실제 파일/OS 입력 없음' })).toBeVisible();
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await page.keyboard.press('Space'); await expect(panel).toHaveAttribute('data-mode', 'groupScan'); await page.waitForTimeout(350);
  await choosePractice(page, '연습 파일 선택'); await choosePractice(page, '연습문서.txt');
  await expect(panel).toHaveAttribute('data-mode', 'confirming');
  await expect(panel.locator('.switch-draft')).toContainText('연습 폴더 / 연습문서.txt');
  await expect(panel.locator('.switch-draft')).toContainText('이 사이트는 파일을 즉시 보낼 수 있어요');
  await expect(panel.locator('.switch-choice').first()).toHaveText('취소 · 원래 화면으로');
  await expect(page.locator('output')).toHaveText('선택 없음');
  await choosePractice(page, '확인 · 이 파일 선택');
  await expect(page.locator('output')).toHaveText('연습문서.txt');
  await expect(panel).toHaveAttribute('data-mode', 'ready');
  await page.waitForTimeout(350); await page.keyboard.press('Space'); await expect(panel).toHaveAttribute('data-mode', 'groupScan'); await page.waitForTimeout(350);
  await choosePractice(page, '조절·쉬기'); await choosePractice(page, '즉시 정지 · 연습 종료');
  await expect(page.locator('tremor-helper-root')).toHaveCount(0);
  await page.getByRole('textbox', { name: '일반 입력' }).focus(); await page.keyboard.type('a b');
  await expect(page.getByRole('textbox', { name: '일반 입력' })).toHaveValue('a b');
  await page.getByRole('button', { name: '일반 버튼' }).focus(); await page.keyboard.press('Space');
  await expect(page.locator('#normal-count')).toHaveText('1');
  expectNoExternalRequests();
});

test('practice pause discards selection; resume Space only resumes and cancel preserves draft', async ({ context, extensionId }) => {
  test.setTimeout(90000);
  const page = await context.newPage(); await page.goto(`chrome-extension://${extensionId}/file-practice.html`);
  await page.getByRole('textbox', { name: '보존할 연습 문장' }).fill('내 문장');
  await page.keyboard.press('Tab'); await page.keyboard.press('Space'); await page.waitForTimeout(350);
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await choosePractice(page, '연습 파일 선택'); await choosePractice(page, '연습문서.txt'); await choosePractice(page, '쉬기');
  await expect(panel).toHaveAttribute('data-mode', 'paused');
  await page.waitForTimeout(350); await page.keyboard.press('Space'); await expect(panel).toHaveAttribute('data-mode', 'itemScan');
  await expect(panel.locator('.switch-draft')).not.toContainText('연습문서.txt');
  await expect(page.locator('output')).toHaveText('선택 없음');
  await choosePractice(page, '연습문서.txt'); await choosePractice(page, '취소 · 원래 화면으로');
  await expect(page.getByRole('textbox', { name: '보존할 연습 문장' })).toHaveValue('내 문장');
  await expect(page.locator('output')).toHaveText('선택 없음');
  await expect(panel).toHaveAttribute('data-mode', 'ready');
});

for (const width of [360, 768, 1280]) {
  test(`practice ${String(width)}px: visible status, cancel first, target and Space release`, async ({ context, extensionId }, testInfo) => {
    const page = await context.newPage(); await page.setViewportSize({ width, height: 800 });
    await page.goto(`chrome-extension://${extensionId}/file-practice.html`);
    const panel = page.locator('tremor-helper-root').locator('.switch-panel');
    await page.keyboard.down('Space'); await page.keyboard.down('Space'); await page.waitForTimeout(400);
    await expect(panel).toHaveAttribute('data-mode', 'ready'); await page.keyboard.up('Space'); await page.waitForTimeout(350);
    await choosePractice(page, '연습 파일 선택'); await choosePractice(page, '연습문서.txt');
    const metrics = await panel.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const choices = Array.from(el.querySelectorAll('.switch-choice')).map((choice) => ({ height: choice.getBoundingClientRect().height, font: getComputedStyle(choice).fontSize }));
      return { x: box.x, right: box.right, bottom: box.bottom, choices, status: el.querySelector('.switch-status')?.textContent };
    });
    expect(metrics.x).toBeGreaterThanOrEqual(0); expect(metrics.right).toBeLessThanOrEqual(width); expect(metrics.bottom).toBeLessThanOrEqual(800);
    for (const choice of metrics.choices) { expect(choice.height).toBeGreaterThanOrEqual(56); expect(parseFloat(choice.font)).toBeGreaterThanOrEqual(18); }
    await expect(panel.locator('h2')).toContainText('실제 파일/OS 입력 없음');
    await expect(panel.locator('.switch-status')).toBeVisible();
    await expect(panel.locator('.switch-choice').first()).toHaveText('취소 · 원래 화면으로');
    await testInfo.attach('practice-dom', { body: JSON.stringify(metrics), contentType: 'application/json' });
    await page.screenshot({ path: `docs/verification/file-practice-${String(width)}.png` });
    await choosePractice(page, '취소 · 원래 화면으로'); await expect(page.locator('output')).toHaveText('선택 없음');
    await expect(panel).toHaveAttribute('data-mode', 'ready');
  });
}

test('moving focus during held confirmation discards the press and approval', async ({ context, extensionId }) => {
  const page = await context.newPage(); await page.goto(`chrome-extension://${extensionId}/file-practice.html`);
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await page.keyboard.press('Space'); await page.waitForTimeout(350);
  await choosePractice(page, '연습 파일 선택'); await choosePractice(page, '연습문서.txt');
  await expect.poll(async () => panel.locator('.switch-choice[aria-current="true"]').textContent(), { timeout: 20000 }).toBe('확인 · 이 파일 선택');
  await page.keyboard.down('Space');
  await page.getByRole('textbox', { name: '일반 입력' }).focus(); await page.keyboard.up('Space');
  await expect(panel).toHaveAttribute('data-mode', 'paused');
  await page.getByRole('button', { name: '일반 버튼' }).focus(); await page.keyboard.up('Space');
  await expect(page.locator('output')).toHaveText('선택 없음');
  await page.keyboard.press('Space'); await expect(panel).toHaveAttribute('data-mode', 'itemScan'); await page.waitForTimeout(350);
  await expect(panel.locator('.switch-draft')).toHaveCount(0);
  await choosePractice(page, '연습문서.txt'); await choosePractice(page, '확인 · 이 파일 선택');
  await expect(page.locator('output')).toHaveText('연습문서.txt');
});

test('expired file request after rest returns to a fresh start without applying', async ({ context, extensionId }) => {
  const page = await context.newPage(); await page.clock.install();
  await page.goto(`chrome-extension://${extensionId}/file-practice.html`);
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await page.keyboard.press('Space'); await page.waitForTimeout(350);
  await choosePractice(page, '연습 파일 선택'); await choosePractice(page, '연습문서.txt'); await choosePractice(page, '쉬기');
  await page.clock.fastForward(61000);
  await page.keyboard.press('Space'); await page.waitForTimeout(350); await choosePractice(page, '연습문서.txt');
  await expect(panel).toHaveAttribute('data-mode', 'ready'); await expect(page.locator('output')).toHaveText('선택 없음');
  await page.waitForTimeout(350); await page.keyboard.press('Space'); await page.waitForTimeout(350);
  await choosePractice(page, '조절·쉬기'); await choosePractice(page, '즉시 정지 · 연습 종료');
  await expect(page.locator('tremor-helper-root')).toHaveCount(0);
});
