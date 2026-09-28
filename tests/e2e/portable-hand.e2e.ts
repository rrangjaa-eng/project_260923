import { test, expect } from './fixtures';

test('USB 실행기가 없으면 팝업이 연결 방법을 알려 준다', async ({ openPopup }) => {
  const popup = await openPopup();
  await expect(popup.getByText('휴대형 손: 연결 안 됨 · USB의 시작하기를 실행하세요')).toBeVisible();
  await expect(popup.getByRole('button', { name: '긴급 정지 — 눌린 마우스 버튼 놓기' })).toBeHidden();
  await popup.screenshot({ path: 'test-results/portable-hand-popup.png' });
});

test('canvas 위에서 Alt+Shift+Space를 누르면 USB 시작 안내가 보인다', async ({ context, servePage }) => {
  servePage(
    'http://practice.test/canvas.html',
    '<!doctype html><html><body><canvas id="surface" width="400" height="240" style="width:400px;height:240px;background:#ddd"></canvas></body></html>',
  );
  const page = await context.newPage();
  await page.goto('http://practice.test/canvas.html');
  const box = await page.locator('#surface').boundingBox();
  if (!box) throw new Error('canvas box missing');

  await page.mouse.move(box.x + 100, box.y + 80);
  await page.keyboard.press('Alt+Shift+Space');

  await expect
    .poll(() =>
      page.evaluate(
        () => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.toast')?.textContent ?? null,
      ),
    )
    .toBe('USB의 시작하기를 먼저 실행해 주세요');
});
