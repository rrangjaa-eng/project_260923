import { test, expect } from './fixtures';

// WR-09: web_accessible_resources의 fonts/*.woff2는 use_dynamic_url 없이 고정 확장 ID로 열려
// 있었다. 어떤 사이트든 chrome-extension://<고정 ID>/fonts/...를 가져올 수 있으면(설치 여부만
// 확인해도) 방문자가 손 떨림 도움 확장을 쓴다는 것을(건강 상태를) 알아낼 수 있다 — 도우미가
// 꺼져 있어도, 오버레이가 아직 하나도 없어도 마찬가지다(오버레이와 무관하게 항상 열려 있었다).

test('WR-09: 확장 글꼴 파일을 고정 확장 ID 경로로는 가져올 수 없다(use_dynamic_url)', async ({
  context,
  extensionId,
  servePage,
}) => {
  servePage('http://practice.test/', '<!doctype html><html><body></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');

  const outcome = await page.evaluate(async (id) => {
    try {
      const res = await fetch(`chrome-extension://${id}/fonts/ibm-plex-sans-kr-latin-400-normal.woff2`);
      return { status: res.status };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }, extensionId);

  expect(
    outcome.status,
    '고정 확장 ID 경로로 글꼴을 가져올 수 있으면 어느 사이트든 이 확장(따라서 손 떨림 도움)을 쓰는지 알아낼 수 있다',
  ).not.toBe(200);

  await page.close();
});
