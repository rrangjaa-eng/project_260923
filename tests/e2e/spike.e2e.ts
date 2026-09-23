import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

// D-13·D-14·D-31·CLICK-02: 대신 누르기의 한계를 로컬 연습 사이트에서만 확인한다. 선택 목록·파일
// 선택은 이용자의 실제 키 입력 처리 안에서 showPicker()로 열고, 열리지 않으면 그 사실을 기록한다.
// 연습 사이트 밖으로 나가는 요청은 fixture가 모두 막고 기록한다(tests/e2e/fixtures.ts). 연습
// 사이트는 tests/practice-site/spike.html(D-28).
//
// systematic-debugging으로 확인한 시험 환경 한계(01-12-SUMMARY.md에 기록): 네이티브 select
// 팝업·파일 선택 창 같은 브라우저 자체 UI는 이 headless 확장 테스트(하나의 persistent context에
// 여러 페이지가 함께 열리는 구조)에서 드물게(수십 번 중 한 번 정도) 지연된다 — 페이지를 매번
// 닫고 팝업을 명시로 닫아도 완전히는 없어지지 않았다. 기능 자체의 결함이 아니라 자동화 인프라의
// 알려진 한계로 판단해 이 파일에서만 재시도 1회를 둔다.
test.describe.configure({ retries: 1 });

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function boxOf(page: Page, selector: string): Promise<Box> {
  const box = await page.locator(selector).boundingBox();
  if (!box) {
    throw new Error(`요소를 찾지 못했다: ${selector}`);
  }
  return box;
}

function center(box: Box): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function indicatorText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const el = host?.shadowRoot?.querySelector('.mode-indicator');
    return el?.textContent ?? '';
  });
}

// content script의 storage.sync.get(설정 읽기)이 끝나 도우미가 실제로 켜진 뒤에야 스페이스바·F가
// 뜻대로 먹는다 — hints.e2e.ts와 같은 이유로 모드 표시가 "도우미"로 뜨는 것을 직접 확인한다.
async function waitForHelperReady(page: Page): Promise<void> {
  await expect.poll(() => indicatorText(page)).toBe('도우미');
}

test('연습 사이트 밖으로 나가는 요청은 막히고 blockedRequests에 기록된다', async ({ context, servePage, blockedRequests }) => {
  servePage(
    'http://practice.test/spike-external.html',
    '<!doctype html><html><body><img src="http://example.invalid/x.png" /></body></html>',
  );
  const page = await context.newPage();
  await page.goto('http://practice.test/spike-external.html');
  await page.waitForTimeout(200);

  expect(blockedRequests).toContain('http://example.invalid/x.png');
  await page.close();
});

// 가정과 다른 실제 결과(자체 조사, systematic-debugging): 이 샌드박스 헤드리스 크로미움에서는
// showPicker()가 예외 없이 항상 성공하지만(트인거가 스페이스바든 머무르기든), 그 뒤 이어지는
// ArrowDown·Enter로도 <select> 값이 바뀌지 않는다 — 순수 real 트러스트 클릭(page.mouse.click) +
// ArrowDown으로도 마찬가지였다(별도로 확인). 즉 이 한계는 대신 누르기 구현이 아니라 헤드리스
// 네이티브 select 팝업 자동화의 알려진 한계다. 그래서 이 시험은 "선택 목록이 열렸다"를 값 변경이
// 아니라 (1) focus가 select로 옮겨졌는지 (2) picker가 막혔다는 안내가 뜨지 않았는지로 판정하고,
// ArrowDown·Enter 뒤 값이 실제로 바뀌는지는 기록만 한다(단언하지 않음, 01-12-SUMMARY.md 참고).
test('select를 잡고 스페이스바를 누르면 focus가 옮겨지고 마우스 순서 대신 focus()+showPicker()만 불린다', async ({
  context,
  expectNoExternalRequests,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/spike.html');
  await waitForHelperReady(page);

  const c = center(await boxOf(page, '#sel'));
  await page.mouse.move(c.x, c.y);
  await page.waitForTimeout(50);
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);

  await expect.poll(() => page.evaluate(() => document.activeElement?.id ?? '')).toBe('sel');
  await expect.poll(() => indicatorText(page)).not.toContain('직접 눌러 주세요');
  // 대신 누르기가 마우스 순서 대신 focus()+showPicker()만 불렀다는 근거 — click이 없다.
  await expect(page.locator('#sel-click-count')).toHaveText('0');

  // 기록만(단언하지 않음): ArrowDown·Enter가 실제로 값을 바꾸는지.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(50);
  console.log('select ArrowDown·Enter 뒤 값:', await page.locator('#sel-value').textContent());

  // showPicker()가 연 네이티브 select 팝업은 브라우저 전역에 하나만 열릴 수 있어(다음 시험의
  // 파일 선택 창을 막는 간헐 실패의 원인이었다, systematic-debugging으로 확인) 시험이 끝나기 전에
  // 반드시 닫는다 — 네이티브 팝업이라 한 가지 방법만으로는 이따금 남아, 팝업 밖 트러스트 클릭 +
  // Escape + 페이지 닫기까지 모두 한다.
  await page.mouse.click(10, 500);
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  expectNoExternalRequests();
  await page.close();
});

test('파일 입력을 잡고 스페이스바를 누르면 filechooser 이벤트가 온다', async ({ context, expectNoExternalRequests }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/spike.html');
  await waitForHelperReady(page);

  const c = center(await boxOf(page, '#file'));
  await page.mouse.move(c.x, c.y);
  await page.waitForTimeout(50);

  const chooserPromise = page.waitForEvent('filechooser', { timeout: 5000 });
  await page.keyboard.press('Space');
  const chooser = await chooserPromise;

  expect(chooser).toBeTruthy();
  // 대신 누르기가 마우스 순서 대신 focus()+showPicker()만 불렀다는 근거 — click이 없다.
  await expect(page.locator('#file-click-count')).toHaveText('0');
  expectNoExternalRequests();
  await page.close();
});
