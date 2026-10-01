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
