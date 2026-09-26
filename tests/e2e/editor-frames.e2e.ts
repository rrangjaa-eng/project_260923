import { test, expect } from './fixtures';
import type { Locator, Page } from '@playwright/test';

// 01-17 gap closure(01-VERIFICATION BLOCKER, ELEM-02·KEY-01·FILT-01/02 partial, 01-07 truth 1·5
// 실패): srcdoc iframe과 document.write로 채운 about:blank iframe(SmartEditor 2·CKEditor 4·
// TinyMCE classic 같은 사내 편집기 iframe 모양) 안에서도 도우미가 번호표·떨림 필터·입력 모드로
// 동작하고, 문서 다시 쓰기 뒤에도 한 번 누르기가 정확히 한 번만 눌리는지 확인한다. 연습 페이지는
// tests/practice-site/editor-frames.html(D-28).

async function waitForHelperReady(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.mode-indicator')?.textContent),
    )
    .toBe('도우미');
}

async function labelTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const labels = host?.shadowRoot?.querySelectorAll('.hint-label');
    return labels ? Array.from(labels).map((el) => el.textContent) : [];
  });
}

// 떨림 간격(300ms, D-07)보다 넉넉히 띄워 F를 다시 눌러 본다(frames.e2e.ts·input-filter.e2e.ts와
// 같은 방식) — 프레임마다 collect() → frame/report → relay → frames/reports 왕복 시간이 다르다.
async function pressFUntilLabels(page: Page, minCount: number): Promise<void> {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(150);
    if ((await labelTexts(page)).length >= minCount) {
      return;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
  }
}

// dom-audit.e2e.ts의 numberForElementAcrossChapters와 같은 규칙 — 요소를 selector 대신
// frameLocator로 얻은 Locator로 받는다(편집기 iframe 안 버튼도 그대로 쓸 수 있게). 요소 상자의
// (x−14, y−14)에서 20px 안에 있는 번호표를 찾고, 없으면 hint-next-card가 있는 동안 Digit0으로
// 다음 장으로 넘긴다.
async function numberForLocator(page: Page, locator: Locator): Promise<string> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('요소를 찾지 못했다(boundingBox 없음)');
  }
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await page.evaluate(
      ({ x, y }) => {
        const labels = document.querySelector('tremor-helper-root')?.shadowRoot?.querySelectorAll('.hint-label');
        let best = '';
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const label of Array.from(labels ?? [])) {
          const r = label.getBoundingClientRect();
          const d = Math.hypot(r.x - (x - 14), r.y - (y - 14));
          if (d < bestDistance) {
            bestDistance = d;
            best = label.textContent;
          }
        }
        return { best, bestDistance };
      },
      { x: box.x, y: box.y },
    );
    if (result.bestDistance < 20) {
      return result.best;
    }
    const hasNext = await page.evaluate(
      () => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.hint-next-card') !== null,
    );
    if (!hasNext) {
      break;
    }
    await page.keyboard.press('Digit0');
    await page.waitForTimeout(100);
  }
  throw new Error('번호표에서 요소를 찾지 못했다(모든 장을 넘겨 봄)');
}

// 초점을 맨 위로 되돌리고 F를 누른 뒤 번호가 뜰 때까지 기다리고(expect.poll, 고정 sleep 금지)
// 그 번호 키를 누른다.
async function pressHintFor(page: Page, locator: Locator): Promise<void> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.focus();
  });
  await pressFUntilLabels(page, 1);
  const number = await numberForLocator(page, locator);
  if (!number) {
    throw new Error('번호를 찾지 못했다');
  }
  await page.keyboard.press(`Digit${number}`);
}

async function openEditorFrames(page: Page): Promise<void> {
  await page.goto('http://practice.test/editor-frames.html');
  await waitForHelperReady(page);
}

// Task 1(tracer): srcdoc 편집기 프레임 하나 — 주입부터 번호 누르기·떨림 필터·입력 모드까지 끝까지.

test('srcdoc 편집기 프레임 안 버튼에 번호표가 붙고 번호를 누르면 정확히 한 번 눌린다', async ({ context }) => {
  const page = await context.newPage();
  await openEditorFrames(page);

  const btn = page.frameLocator('#frame-srcdoc').locator('#btn-srcdoc');
  await pressHintFor(page, btn);
  await page.waitForTimeout(300);

  await expect(page.frameLocator('#frame-srcdoc').locator('#btn-srcdoc-count')).toHaveText('1');
});

test('srcdoc 편집기 프레임 버튼을 100ms 간격으로 두 번 클릭하면 카운터가 1만 오른다 (FILT-01)', async ({ context }) => {
  const page = await context.newPage();
  await openEditorFrames(page);

  const box = await page.frameLocator('#frame-srcdoc').locator('#btn-srcdoc').boundingBox();
  if (!box) {
    throw new Error('버튼을 찾지 못했다');
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await page.waitForTimeout(100);
  await page.mouse.click(x, y);
  await page.waitForTimeout(300);

  await expect(page.frameLocator('#frame-srcdoc').locator('#btn-srcdoc-count')).toHaveText('1');
});

test('srcdoc 편집기 프레임 입력칸에 초점이 가면 입력 중 표시, Esc로 도우미로 복귀한다 (KEY-01)', async ({ context }) => {
  const page = await context.newPage();
  await openEditorFrames(page);

  const input = page.frameLocator('#frame-srcdoc').locator('#input-srcdoc');
  await input.click();
  await expect
    .poll(() => page.evaluate(() => document.querySelector('tremor-helper-root')?.getAttribute('data-mode')))
    .toBe('typing');

  await input.pressSequentially('12 3');
  await expect(input).toHaveValue('12 3');

  await page.keyboard.press('Escape');
  await expect
    .poll(() => page.evaluate(() => document.querySelector('tremor-helper-root')?.getAttribute('data-mode')))
    .toBe('helper');
});
