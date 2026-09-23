import fs from 'node:fs';
import { test, expect } from './fixtures';
import type { Page, Worker } from '@playwright/test';

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

async function patchSettings(serviceWorker: Worker, patch: Record<string, unknown>): Promise<void> {
  await serviceWorker.evaluate(async (p) => {
    const stored = await chrome.storage.sync.get('settings');
    const settings = stored.settings as { schemaVersion: number; data: Record<string, unknown> };
    await chrome.storage.sync.set({ settings: { ...settings, data: { ...settings.data, ...p } } });
  }, patch);
}

// Task 2: 대상 × 방법 스파이크(설계 11장 ①·④·⑤). 다섯 방법 — M1 원래 클릭(요소 위), M2 자석
// 클릭(요소 밖 30px), M3 스페이스바, M4 번호표 숫자, M5 머무르기.
type Method = 'M1' | 'M2' | 'M3' | 'M4' | 'M5';
const METHODS: readonly Method[] = ['M1', 'M2', 'M3', 'M4', 'M5'];
type Outcome = 'works' | 'blocked';
interface MatrixCell {
  target: string;
  method: string;
  outcome: Outcome;
  evidence: string;
}
// 파일 전체가 공유하는 결과표(D-28) — Playwright workers:1(같은 워커, 같은 모듈 인스턴스)이라
// 시험 사이에 값이 남는다. serial 모드로 순서를 보장한다(아래 describe).
const matrixResults: MatrixCell[] = [];

// hints.e2e.ts의 numberForElement와 같은 방식(기본 배치 자리 −14,−14에 가장 가까운 번호표).
async function numberFor(page: Page, box: Box): Promise<string> {
  return page.evaluate(
    ({ x, y }) => {
      const host = document.querySelector('tremor-helper-root');
      const labels = host?.shadowRoot?.querySelectorAll('.hint-label');
      if (!labels) {
        return '';
      }
      let closestText = '';
      let closestDistance = Number.POSITIVE_INFINITY;
      for (const label of Array.from(labels)) {
        const rect = label.getBoundingClientRect();
        const distance = Math.hypot(rect.x - (x - 14), rect.y - (y - 14));
        if (distance < closestDistance) {
          closestDistance = distance;
          closestText = label.textContent ?? '';
        }
      }
      return closestText;
    },
    { x: box.x, y: box.y },
  );
}

async function applyMethod(page: Page, serviceWorker: Worker, method: Method, box: Box): Promise<void> {
  const c = center(box);
  if (method === 'M1') {
    await page.mouse.move(c.x, c.y);
    await page.waitForTimeout(50);
    await page.mouse.click(c.x, c.y);
    return;
  }
  if (method === 'M2') {
    const x = box.x - 30;
    const y = c.y;
    await page.mouse.move(x, y);
    await page.waitForTimeout(50);
    await page.mouse.click(x, y);
    return;
  }
  if (method === 'M3') {
    await page.mouse.move(c.x, c.y);
    await page.waitForTimeout(50);
    await page.keyboard.press('Space');
    return;
  }
  if (method === 'M4') {
    await page.mouse.move(c.x, c.y);
    await page.waitForTimeout(50);
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(50);
    const number = await numberFor(page, box);
    await page.keyboard.press(`Digit${number}`);
    return;
  }
  // M5: 머무르기 — dwellMs를 400으로 낮춰 확실히 발사되게 한 뒤 원래대로 되돌린다.
  await patchSettings(serviceWorker, { dwellEnabled: true, dwellMs: 400 });
  await page.mouse.move(c.x, c.y);
  await page.waitForTimeout(500);
  await patchSettings(serviceWorker, { dwellEnabled: false });
}

interface OrderLogEntry {
  type: string;
  trusted: boolean;
}
interface SpikeWindow extends Window {
  resetOrderLog?: () => void;
  getOrderLog?: () => OrderLogEntry[];
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

// Task 2: 대상 × 방법 스파이크 결과표(설계 11장 ①·④·⑤, 로컬 연습 사이트만). 대상마다 시험
// 하나(6개, A~F) + shortcuts.html 1개(G) + 표 확인 1개 = 8개. serial — matrixResults를
// 공유하고 마지막 시험이 전체가 끝난 뒤 표를 낸다.
test.describe('스파이크 매트릭스(대상 × 방법)', () => {
  test.describe.configure({ mode: 'serial' });

  test('대상 A(사람 입력만 받는 버튼): 다섯 방법 결과', async ({ context, serviceWorker, expectNoExternalRequests }) => {
    const page = await context.newPage();
    await page.goto('http://practice.test/spike.html');
    await waitForHelperReady(page);
    const box = await boxOf(page, '#trusted-only');

    for (const method of METHODS) {
      const before = Number((await page.locator('#trusted-only-count').textContent()) ?? '0');
      await applyMethod(page, serviceWorker, method, box);
      await page.waitForTimeout(300);
      const after = Number((await page.locator('#trusted-only-count').textContent()) ?? '0');
      matrixResults.push({
        target: 'A-사람입력만',
        method,
        outcome: after > before ? 'works' : 'blocked',
        evidence: `trusted-only-count ${String(before)}→${String(after)}`,
      });
      await page.waitForTimeout(400);
    }

    expect(matrixResults.find((c) => c.target === 'A-사람입력만' && c.method === 'M1')?.outcome).toBe('works');
    expectNoExternalRequests();
    await page.close();
  });

  test('대상 B(window.open 버튼): 다섯 방법 결과', async ({ context, serviceWorker, expectNoExternalRequests }) => {
    const page = await context.newPage();
    await page.goto('http://practice.test/spike.html');
    await waitForHelperReady(page);
    const box = await boxOf(page, '#opener');

    for (const method of METHODS) {
      const waiter = context.waitForEvent('page', { timeout: 1500 }).catch(() => null);
      await applyMethod(page, serviceWorker, method, box);
      const popup = await waiter;
      if (popup) {
        await popup.close();
      }
      matrixResults.push({
        target: 'B-새창열기',
        method,
        outcome: popup ? 'works' : 'blocked',
        evidence: popup ? '새 페이지 열림(popup-target.html)' : '1500ms 안에 새 페이지 없음',
      });
      await page.waitForTimeout(400);
    }

    expect(matrixResults.find((c) => c.target === 'B-새창열기' && c.method === 'M1')?.outcome).toBe('works');
    expectNoExternalRequests();
    await page.close();
  });

  test('대상 C(target=_blank 링크): 다섯 방법 결과', async ({ context, serviceWorker, expectNoExternalRequests }) => {
    const page = await context.newPage();
    await page.goto('http://practice.test/spike.html');
    await waitForHelperReady(page);
    const box = await boxOf(page, '#new-tab-link');

    for (const method of METHODS) {
      const waiter = context.waitForEvent('page', { timeout: 1500 }).catch(() => null);
      await applyMethod(page, serviceWorker, method, box);
      const popup = await waiter;
      if (popup) {
        await popup.close();
      }
      matrixResults.push({
        target: 'C-새탭링크',
        method,
        outcome: popup ? 'works' : 'blocked',
        evidence: popup ? '새 페이지 열림(popup-target.html)' : '1500ms 안에 새 페이지 없음',
      });
      await page.waitForTimeout(400);
    }

    expect(matrixResults.find((c) => c.target === 'C-새탭링크' && c.method === 'M1')?.outcome).toBe('works');
    expectNoExternalRequests();
    await page.close();
  });

  // D(선택 목록) 판정 근거는 Task 1에서 확인한 대로다: 이 샌드박스에서는 ArrowDown·Enter로 값이
  // 바뀌는지가 신뢰할 수 없어(01-12-SUMMARY.md), focus 이동 + 차단 메시지 없음으로 판정한다.
  test('대상 D(선택 목록): 다섯 방법 결과', async ({ context, serviceWorker, expectNoExternalRequests }) => {
    const page = await context.newPage();
    await page.goto('http://practice.test/spike.html');
    await waitForHelperReady(page);
    const box = await boxOf(page, '#sel');

    for (const method of METHODS) {
      await applyMethod(page, serviceWorker, method, box);
      await page.waitForTimeout(100);
      const active = await page.evaluate(() => document.activeElement?.id ?? '');
      const blockedShown = (await indicatorText(page)).includes('직접 눌러 주세요');
      const outcome: Outcome = active === 'sel' && !blockedShown ? 'works' : 'blocked';
      matrixResults.push({
        target: 'D-선택목록',
        method,
        outcome,
        evidence: `activeElement=${active || '(none)'}, blocked메시지=${String(blockedShown)}`,
      });
      // 네이티브 select 팝업이 남아 다음 방법·다음 시험(E)을 방해하지 않도록 닫는다(Task 1에서
      // 확인한 간헐 실패 원인).
      await page.mouse.click(10, 500);
      await page.waitForTimeout(200);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    expect(matrixResults.find((c) => c.target === 'D-선택목록' && c.method === 'M1')?.outcome).toBe('works');
    expectNoExternalRequests();
    await page.close();
  });

  test('대상 E(파일 선택): 다섯 방법 결과', async ({ context, serviceWorker, expectNoExternalRequests }) => {
    const page = await context.newPage();
    await page.goto('http://practice.test/spike.html');
    await waitForHelperReady(page);
    const box = await boxOf(page, '#file');

    for (const method of METHODS) {
      const waiter = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
      await applyMethod(page, serviceWorker, method, box);
      const chooser = await waiter;
      matrixResults.push({
        target: 'E-파일선택',
        method,
        outcome: chooser ? 'works' : 'blocked',
        evidence: chooser ? 'filechooser 이벤트 발생' : '5000ms 안에 filechooser 없음',
      });
      await page.waitForTimeout(400);
    }

    expect(matrixResults.find((c) => c.target === 'E-파일선택' && c.method === 'M1')?.outcome).toBe('works');
    expectNoExternalRequests();
    await page.close();
  });

  test('대상 F(이벤트 순서 기록): 다섯 방법 결과', async ({ context, serviceWorker, expectNoExternalRequests }) => {
    const page = await context.newPage();
    await page.goto('http://practice.test/spike.html');
    await waitForHelperReady(page);
    const box = await boxOf(page, '#order-target');

    for (const method of METHODS) {
      await page.evaluate(() => (window as unknown as SpikeWindow).resetOrderLog?.());
      await applyMethod(page, serviceWorker, method, box);
      await page.waitForTimeout(200);
      const log = await page.evaluate(() => (window as unknown as SpikeWindow).getOrderLog?.() ?? []);
      const hasClick = log.some((entry) => entry.type === 'click');
      matrixResults.push({
        target: 'F-이벤트순서',
        method,
        outcome: hasClick ? 'works' : 'blocked',
        evidence: JSON.stringify(log),
      });
      await page.waitForTimeout(400);
    }

    expect(matrixResults.find((c) => c.target === 'F-이벤트순서' && c.method === 'M1')?.outcome).toBe('works');
    expectNoExternalRequests();
    await page.close();
  });

  // 설계 11장 ④: shortcuts.html이 window capture·keypress·keyup으로 스페이스바를 자체 단축키로
  // 써도 도우미 모드에서는 도우미 키가 먼저 받는지.
  test('shortcuts.html에서 잡힌 버튼 + 스페이스바 결과(도우미 먼저/사이트 먼저)', async ({ context, expectNoExternalRequests }) => {
    const page = await context.newPage();
    await page.goto('http://practice.test/shortcuts.html');
    await waitForHelperReady(page);

    const box = await boxOf(page, '#target');
    const c = center(box);
    await page.mouse.move(c.x, c.y);
    await page.waitForTimeout(50);
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);

    const targetCount = (await page.locator('#target-count').textContent()) ?? '';
    const siteKeydown = (await page.locator('#site-keydown').textContent()) ?? '';
    const outcome: Outcome = targetCount === '1' && siteKeydown === '0' ? 'works' : 'blocked';
    matrixResults.push({
      target: 'G-사이트단축키',
      method: 'M3',
      outcome,
      evidence: `target-count=${targetCount}, site-keydown=${siteKeydown}`,
    });

    expect(matrixResults.length).toBeGreaterThan(0);
    expectNoExternalRequests();
    await page.close();
  });

  test('결과표가 31칸 모두 찼고 M1은 모든 대상에서 works이며 파일·콘솔로 낸다', () => {
    expect(matrixResults).toHaveLength(31);
    const m1Rows = matrixResults.filter((c) => c.method === 'M1');
    for (const row of m1Rows) {
      expect(row.outcome).toBe('works');
    }

    fs.mkdirSync('test-results', { recursive: true });
    fs.writeFileSync('test-results/spike-matrix.json', JSON.stringify(matrixResults, null, 2));

    const header = '| 대상 | 방법 | 결과 | 근거 |';
    const sep = '| --- | --- | --- | --- |';
    const rows = matrixResults.map((c) => `| ${c.target} | ${c.method} | ${c.outcome} | ${c.evidence} |`);
    console.log([header, sep, ...rows].join('\n'));
  });
});
