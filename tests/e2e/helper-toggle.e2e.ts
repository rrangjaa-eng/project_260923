import { test, expect } from './fixtures';

// D-20(SAFE-04)·D-23(STOR-01): 팝업 "도우미 끄기(전체)" → 단일 저장자 → storage.sync → 모든 프레임 →
// 맨 위 프레임 모드 표시, 한 경로(tracer). 연습 사이트는 servePage가 등록하는 로컬 고정물이다(D-28).

test('연습 사이트에 가면 맨 위 프레임에 모드 표시("도우미")가 뜬다', async ({ context, servePage }) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');

  await expect
    .poll(() =>
      page.evaluate(
        () => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.mode-indicator')?.textContent ?? null,
      ),
    )
    .toBe('도우미');
});

test('팝업에서 "도우미 끄기"를 누르면 storage.sync가 바뀌고 모드 표시가 1초 안에 사라진다', async ({
  context,
  serviceWorker,
  openPopup,
  servePage,
}) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');

  await expect.poll(() => page.evaluate(() => document.querySelector('tremor-helper-root') !== null)).toBe(true);

  const popup = await openPopup();
  await popup.getByRole('button', { name: '도우미 끄기' }).click();

  await expect
    .poll(async () => {
      const stored = (await serviceWorker.evaluate(() => chrome.storage.sync.get('settings'))) as {
        settings?: { data?: { enabled?: boolean } };
      };
      return stored.settings?.data?.enabled;
    })
    .toBe(false);

  await expect.poll(() => page.evaluate(() => document.querySelector('tremor-helper-root') !== null)).toBe(false);
});

test('다시 "도우미 켜기"를 누르면 모드 표시가 1초 안에 돌아온다', async ({ context, openPopup, servePage }) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');

  const popup = await openPopup();
  await popup.getByRole('button', { name: '도우미 끄기' }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector('tremor-helper-root') !== null)).toBe(false);

  await popup.getByRole('button', { name: '도우미 켜기' }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector('tremor-helper-root') !== null)).toBe(true);
});
