import { test, expect } from './fixtures';
import type { Page, Worker } from '@playwright/test';

// D-11·D-15·D-23·D-24·CLICK-03: keymap.toggleHints(기본 F)로 번호표를 켜고 끄고, 떠 있을 때만
// 숫자·0·Esc를 도우미가 쓴다. 번호는 1부터 중복 없이, 28×28px 이상, 서로 겹치지 않는다. 누를 곳이
// 없으면 모드 표시에 "누를 곳이 없어요" 2초, 9개 넘으면 "0 다음 번호" 카드로 다음 9개를 본다.
// 자주 누른 기록(storage.local)·고정 번호(storage.sync)가 번호 순서에 반영된다. 연습 사이트는
// tests/practice-site/targets.html·shortcuts.html(D-28) + 이 파일이 등록하는 11개 버튼 페이지.

// name=id도 함께 달아 둔다 — Task 3의 고정 번호 시험이 domPath 없이도(id+name 2개 일치)
// isSameElement를 만족시켜 실제 collector의 domPath 계산 방식을 시험이 몰라도 되게 한다.
const MANY_BUTTONS_HTML = `<!doctype html><html><body style="margin:0">
<script>
  function makeBtn(id, x) {
    var b = document.createElement('button');
    b.id = id;
    b.name = id;
    b.textContent = id;
    b.dataset.count = '0';
    b.style.position = 'absolute';
    b.style.left = x + 'px';
    b.style.top = '50px';
    b.style.width = '40px';
    b.style.height = '40px';
    b.addEventListener('click', function () {
      b.dataset.count = String(Number(b.dataset.count) + 1);
    });
    document.body.appendChild(b);
  }
  for (var i = 0; i < 11; i += 1) {
    makeBtn('btn-' + i, 50 + i * 60);
  }
</script>
</body></html>`;

async function labelTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const labels = host?.shadowRoot?.querySelectorAll('.hint-label');
    return labels ? Array.from(labels).map((el) => el.textContent) : [];
  });
}

async function labelBoxes(page: Page): Promise<Array<{ x: number; y: number; width: number; height: number }>> {
  return page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const labels = host?.shadowRoot?.querySelectorAll('.hint-label');
    if (!labels) {
      return [];
    }
    return Array.from(labels).map((el) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
  });
}

async function hasNextCard(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    return host?.shadowRoot?.querySelector('.hint-next-card') !== null;
  });
}

async function indicatorText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const el = host?.shadowRoot?.querySelector('.mode-indicator');
    return el?.textContent ?? '';
  });
}

// content script의 storage.sync.get(설정 읽기)이 끝나 도우미가 실제로 켜진 뒤에야 F가 뜻대로
// 먹는다 — 고정 시간 대기 대신 모드 표시가 "도우미"로 뜨는 것을 직접 확인해 경합을 없앤다.
async function waitForHelperReady(page: Page): Promise<void> {
  await expect.poll(() => indicatorText(page)).toBe('도우미');
}

// 어떤 요소가 몇 번 번호표를 받았는지: 그 요소의 기본 배치 자리(왼쪽 위 바깥 −14px,−14px)에
// 가장 가까운 번호표를 찾는다. 이 페이지의 버튼은 서로 60px 떨어져 있어 겹침 대안 자리로 옮겨도
// 다른 버튼의 자리보다는 항상 가깝다.
async function numberForElement(page: Page, elementId: string): Promise<string> {
  const box = await page.locator(`#${elementId}`).boundingBox();
  if (!box) {
    throw new Error(`요소를 찾지 못했다: ${elementId}`);
  }
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
          closestText = label.textContent;
        }
      }
      return closestText;
    },
    { x: box.x, y: box.y },
  );
}

interface PressesShape {
  schemaVersion: number;
  isArray: boolean;
}

async function readPressesShape(serviceWorker: Worker, origin: string): Promise<PressesShape | null> {
  const key = `presses:${origin}`;
  return serviceWorker.evaluate(async (storageKey) => {
    const result = await chrome.storage.local.get(storageKey);
    const stored = result[storageKey] as { schemaVersion?: number; data?: { counts?: unknown } } | undefined;
    if (!stored) {
      return null;
    }
    return { schemaVersion: stored.schemaVersion ?? -1, isArray: Array.isArray(stored.data?.counts) };
  }, key);
}

async function readPressesCount(serviceWorker: Worker, origin: string, elementId: string): Promise<number> {
  return serviceWorker.evaluate(
    async ({ storageKey, id }) => {
      const result = await chrome.storage.local.get(storageKey);
      const stored = result[storageKey] as
        | { data: { counts: Array<{ fingerprint: { id?: string }; count: number }> } }
        | undefined;
      const entry = stored?.data.counts.find((c) => c.fingerprint.id === id);
      return entry?.count ?? 0;
    },
    { storageKey: `presses:${origin}`, id: elementId },
  );
}

function boxesOverlap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test('F를 누르면 번호표가 보이는 요소에 붙고 번호는 1부터 중복 없이, 각 번호표 상자가 28×28px 이상이다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(50);

  const texts = await labelTexts(page);
  expect(texts.length).toBeGreaterThan(0);
  expect(texts.length).toBeLessThanOrEqual(9);
  const numbers = texts.map(Number).sort((a, b) => a - b);
  expect(numbers).toEqual(Array.from({ length: numbers.length }, (_, i) => i + 1));

  const boxes = await labelBoxes(page);
  for (const box of boxes) {
    expect(box.width).toBeGreaterThanOrEqual(28);
    expect(box.height).toBeGreaterThanOrEqual(28);
  }
});

test('번호표가 떠 있을 때 숫자 키를 누르면 그 번호의 요소가 눌리고 번호표가 사라진다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);

  const box = await page.locator('#btn-tiny').boundingBox();
  if (!box) {
    throw new Error('버튼을 찾지 못했다');
  }
  // btn-tiny 위에 커서를 두어(거리 0) 반드시 1번이 되게 한다.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(50);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(50);

  const texts = await labelTexts(page);
  expect(texts[0]).toBe('1');

  await page.keyboard.press('Digit1');
  await page.waitForTimeout(50);

  await expect(page.locator('#btn-tiny-count')).toHaveText('1');
  expect((await labelTexts(page)).length).toBe(0);
});

test('번호표가 떠 있을 때 F 또는 Esc를 누르면 번호표가 사라진다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(50);
  expect((await labelTexts(page)).length).toBeGreaterThan(0);

  // 같은 키(KeyF)의 두 번째 입력이므로 떨림 간격(기본 300ms, D-07)보다 넉넉히 띄운다.
  await page.waitForTimeout(350);
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(50);
  expect((await labelTexts(page)).length).toBe(0);

  await page.waitForTimeout(350);
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(50);
  expect((await labelTexts(page)).length).toBeGreaterThan(0);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(50);
  expect((await labelTexts(page)).length).toBe(0);
});

test('CR-06: 도우미를 껐다 켜면 번호표 자리·크기가 무너지지 않는다', async ({ context, openPopup }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);

  const elBox = await page.locator('#btn-tiny').boundingBox();
  if (!elBox) {
    throw new Error('버튼을 찾지 못했다');
  }
  // btn-tiny 위에 커서를 두어(거리 0) 반드시 1번이 되게 한다(위 시험과 같은 방식).
  await page.mouse.move(elBox.x + elBox.width / 2, elBox.y + elBox.height / 2);
  await page.waitForTimeout(50);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(50);
  const before = (await labelBoxes(page))[0];
  if (!before) {
    throw new Error('첫 번째 번호표가 열릴 때는 자리를 찾을 수 있어야 한다');
  }

  await page.keyboard.press('Escape');
  await page.waitForTimeout(50);

  const popup = await openPopup(page);
  await popup.getByRole('button', { name: '도우미 끄기' }).click();
  // WR-06: 같은 카드를 다시 누르는 것 — 떨림 두 번 탭과 구분되도록 간격을 띄운다(다른 파일의
  // 같은 관례와 같은 이유, helper-toggle.e2e.ts 참고).
  await popup.waitForTimeout(350);
  await popup.getByRole('button', { name: '도우미 켜기' }).click();
  await popup.close();
  await waitForHelperReady(page);

  await page.mouse.move(elBox.x + elBox.width / 2, elBox.y + elBox.height / 2);
  await page.waitForTimeout(50);
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(50);
  const after = (await labelBoxes(page))[0];
  if (!after) {
    throw new Error('껐다 켠 뒤에도 번호표가 열려야 한다');
  }

  expect(after.width, '스타일이 없으면 28px 정사각형이 무너진다').toBeGreaterThanOrEqual(28);
  expect(after.height).toBeGreaterThanOrEqual(28);
  expect(Math.abs(after.x - before.x), 'x 자리가 껐다 켜기 전후로 같아야 한다').toBeLessThanOrEqual(2);
  expect(Math.abs(after.y - before.y), 'y 자리가 껐다 켜기 전후로 같아야 한다').toBeLessThanOrEqual(2);
});

test('번호표 상자끼리 서로 겹치지 않는다', async ({ context, servePage }) => {
  servePage('http://practice.test/hints-many.html', MANY_BUTTONS_HTML);
  const page = await context.newPage();
  await page.goto('http://practice.test/hints-many.html');
  await waitForHelperReady(page);
  // 이 페이지는 <script>가 만든 버튼을 collector의 MutationObserver(rAF 코얼레싱)가 한 번 더
  // 모아야 잡힌다 — 정적 파일 두 곳(targets.html·shortcuts.html)은 자연 지연으로 이미 충분하지만
  // 여기는 명시로 기다린다.
  await page.waitForTimeout(100);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(50);

  const boxes = await labelBoxes(page);
  expect(boxes.length).toBeGreaterThan(1);
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      if (!a || !b) {
        continue;
      }
      expect(boxesOverlap(a, b)).toBe(false);
    }
  }
});

async function labelRectByNumber(
  page: Page,
  number: string,
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return page.evaluate((num) => {
    const host = document.querySelector('tremor-helper-root');
    const labels = host?.shadowRoot?.querySelectorAll('.hint-label');
    if (!labels) {
      return null;
    }
    for (const label of Array.from(labels)) {
      if (label.textContent === num) {
        const r = label.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }
    }
    return null;
  }, number);
}

test('WR-03: 번호표가 떠 있는 동안 스크롤하면 번호표도 요소를 따라 옮겨간다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);

  // btn-scroll(문서 좌표 top:2000px)을 화면 안으로 들어오게 한 뒤 그 위에서 번호표를 연다.
  // (최대 스크롤 한계 안의 값 — 문서 높이 2400px·뷰포트 720px 기준 최대 scrollTop은 1680px이다.)
  await page.evaluate(() => {
    window.scrollTo(0, 1500);
  });
  await page.waitForTimeout(150); // collector의 scroll → rAF 재수집을 기다린다.

  const beforeElBox = await page.locator('#btn-scroll').boundingBox();
  if (!beforeElBox) {
    throw new Error('버튼을 찾지 못했다');
  }
  await page.mouse.move(beforeElBox.x + beforeElBox.width / 2, beforeElBox.y + beforeElBox.height / 2);
  await page.waitForTimeout(50);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(50);

  const number = await numberForElement(page, 'btn-scroll');
  const before = await labelRectByNumber(page, number);
  if (!before) {
    throw new Error('번호표를 찾지 못했다');
  }

  // 번호표가 떠 있는 채로 50px 더 스크롤한다 — 요소는 화면에서 위로 50px 옮겨간다.
  await page.evaluate(() => {
    window.scrollBy(0, 50);
  });
  await page.waitForTimeout(150);

  const afterElBox = await page.locator('#btn-scroll').boundingBox();
  if (!afterElBox) {
    throw new Error('스크롤 뒤 버튼을 찾지 못했다');
  }
  const after = await labelRectByNumber(page, number);
  if (!after) {
    throw new Error('스크롤 뒤 번호표를 찾지 못했다');
  }

  // 번호표는 실제로 옮겨간 요소를 따라가야 한다(요소 왼쪽 위 바깥 −14px,−14px 근처).
  expect(Math.abs(after.y - (afterElBox.y - 14)), '스크롤 뒤에도 번호표가 요소를 따라와야 한다').toBeLessThanOrEqual(20);
  // 제자리(스크롤 전 자리)에 그대로 남아 있지 않아야 한다 — 실제로 움직였는지도 확인한다.
  expect(Math.abs(after.y - before.y), '번호표가 스크롤 전 자리에 그대로 남아 있으면 안 된다').toBeGreaterThan(30);
});

test('요소가 하나도 없는 페이지에서 F를 누르면 모드 표시에 "누를 곳이 없어요"가 보이고 2초 뒤 사라진다', async ({
  context,
  servePage,
}) => {
  servePage('http://practice.test/empty.html', '<!doctype html><html><body></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/empty.html');
  await waitForHelperReady(page);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(50);

  await expect.poll(() => indicatorText(page)).toContain('누를 곳이 없어요');
  await page.waitForTimeout(2100);
  await expect.poll(() => indicatorText(page)).not.toContain('누를 곳이 없어요');
});

test('요소가 9개 넘는 페이지에서 F → "0 다음 번호" 카드가 보이고, 0 → 다음 9개 번호표', async ({ context, servePage }) => {
  servePage('http://practice.test/hints-many.html', MANY_BUTTONS_HTML);
  const page = await context.newPage();
  await page.goto('http://practice.test/hints-many.html');
  await waitForHelperReady(page);
  await page.waitForTimeout(100);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(50);

  expect((await labelTexts(page)).length).toBe(9);
  expect(await hasNextCard(page)).toBe(true);

  await page.keyboard.press('Digit0');
  await page.waitForTimeout(50);

  expect((await labelTexts(page)).length).toBe(2);
  expect(await hasNextCard(page)).toBe(false);

  await page.keyboard.press('Digit1');
  await page.waitForTimeout(50);
  await expect(page.locator('#btn-9')).toHaveAttribute('data-count', '1');
});

test('shortcuts.html에서 번호표가 떠 있을 때 1은 사이트 단축키 카운터를 올리지 않고, 번호표가 없을 때 1은 올린다', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/shortcuts.html');
  await waitForHelperReady(page);

  await page.keyboard.press('KeyF');
  // WR-10과 같은 이유(고정 sleep 대신 조건 대기): openHints()는 storage 읽기 두 번을 기다린 뒤에야
  // 번호표를 그린다 — 고정 50ms는 부하가 큰 상황(전체 스위트를 이어서 돌릴 때 재현됨)에서 아직
  // 번호표가 안 뜬 채로 Digit1을 눌러, hintsActive가 아직 false라 그 키가 그대로 사이트로 샌다.
  await expect.poll(() => labelTexts(page)).not.toEqual([]);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(50);
  await expect(page.locator('#site-keydown')).toHaveText('0');

  // 같은 키(Digit1)의 두 번째 입력이므로 떨림 간격(기본 300ms, D-07)보다 넉넉히 띄운다.
  await page.waitForTimeout(350);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(50);
  await expect(page.locator('#site-keydown')).toHaveText('1');
});

// ISSUE-001(/qa 사용자 결정 2026-09-26): Ctrl·Alt·Meta가 함께 눌린 키는 도우미 키(F 번호표 열기,
// 번호표가 떠 있을 때 숫자 누르기 등)로 보지 않고 preventDefault 없이 브라우저·페이지로 넘긴다.
// Shift+F는 그대로 번호표를 연다(유지).
async function installBubbleKeyLogger(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __bubbleKeyLog: Array<{ code: string; defaultPrevented: boolean }> }).__bubbleKeyLog = [];
    window.addEventListener('keydown', (e) => {
      (window as unknown as { __bubbleKeyLog: Array<{ code: string; defaultPrevented: boolean }> }).__bubbleKeyLog.push({
        code: e.code,
        defaultPrevented: e.defaultPrevented,
      });
    });
  });
}

async function bubbleKeyLog(page: Page): Promise<Array<{ code: string; defaultPrevented: boolean }>> {
  return page.evaluate(
    () =>
      (window as unknown as { __bubbleKeyLog?: Array<{ code: string; defaultPrevented: boolean }> }).__bubbleKeyLog ?? [],
  );
}

test('ISSUE-001: Ctrl+F·Alt+F·Ctrl+Shift+F는 도우미 키로 보지 않아 번호표를 열지 않고 페이지 버블 리스너에 defaultPrevented=false로 도달한다', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);
  await installBubbleKeyLogger(page);

  await page.keyboard.press('Control+F');
  await page.waitForTimeout(50);
  expect((await labelTexts(page)).length, 'Ctrl+F는 번호표를 열면 안 된다').toBe(0);

  // 같은 물리 키(KeyF)라 떨림 간격(기본 300ms, D-07)보다 넉넉히 띄운다(다른 시험과 같은 관례).
  await page.waitForTimeout(350);
  await page.keyboard.press('Alt+F');
  await page.waitForTimeout(50);
  expect((await labelTexts(page)).length, 'Alt+F는 번호표를 열면 안 된다').toBe(0);

  await page.waitForTimeout(350);
  await page.keyboard.press('Control+Shift+F');
  await page.waitForTimeout(50);
  expect((await labelTexts(page)).length, 'Ctrl+Shift+F는 번호표를 열면 안 된다').toBe(0);

  const log = await bubbleKeyLog(page);
  const fEvents = log.filter((entry) => entry.code === 'KeyF');
  expect(fEvents.length, '세 조합 모두 페이지 버블 리스너에 닿아야 한다').toBe(3);
  for (const entry of fEvents) {
    expect(entry.defaultPrevented, '도우미 키가 아니므로 preventDefault 없이 넘어가야 한다').toBe(false);
  }
});

test('ISSUE-001: 번호표가 떠 있을 때 Ctrl+1을 누르면 1번 요소가 눌리지 않고 번호표도 그대로 남는다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);

  const box = await page.locator('#btn-tiny').boundingBox();
  if (!box) {
    throw new Error('버튼을 찾지 못했다');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(50);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(50);
  expect((await labelTexts(page))[0]).toBe('1');

  await page.keyboard.press('Control+Digit1');
  await page.waitForTimeout(50);

  await expect(page.locator('#btn-tiny-count')).toHaveText('0');
  expect((await labelTexts(page)).length, 'Ctrl+1은 번호표를 쓰지 않으니 번호표가 그대로 남아야 한다').toBeGreaterThan(0);
});

test('ISSUE-001 회귀 방지: Shift+F는 그대로 번호표를 연다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);

  await page.keyboard.press('Shift+F');
  await page.waitForTimeout(50);

  expect((await labelTexts(page)).length).toBeGreaterThan(0);
});

// ISSUE-002·003(/qa 사용자 결정 2026-09-26, SYSTEM.md "번호표 배치"): 화면 가장자리 요소의 번호표도
// 뷰포트 안에 온전히 보이고, 이웃 번호표가 위험 표시("! 위험")를 가리지 않는다.
async function dangerTagBoxes(page: Page): Promise<Array<{ x: number; y: number; width: number; height: number }>> {
  return page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const tags = host?.shadowRoot?.querySelectorAll('.hint-label-danger-tag');
    if (!tags) {
      return [];
    }
    return Array.from(tags).map((el) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
  });
}

test('ISSUE-002·003: danger.html에서 F를 누르면 모든 번호표가 화면 안에 있고, 서로 겹치지 않으며, "! 위험" 표시도 가리지 않는다', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(100);

  const viewport = page.viewportSize();
  if (!viewport) {
    throw new Error('뷰포트 크기를 알 수 없다');
  }

  const boxes = await labelBoxes(page);
  expect(boxes.length).toBeGreaterThan(0);
  for (const box of boxes) {
    expect(box.x, '번호표 왼쪽이 화면 밖이면 안 된다').toBeGreaterThanOrEqual(0);
    expect(box.y, '번호표 위쪽이 화면 밖이면 안 된다').toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, '번호표 오른쪽이 화면 밖이면 안 된다').toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height, '번호표 아래쪽이 화면 밖이면 안 된다').toBeLessThanOrEqual(viewport.height);
  }
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      if (!a || !b) {
        continue;
      }
      expect(boxesOverlap(a, b), '번호표끼리 겹치면 안 된다').toBe(false);
    }
  }

  const tagBoxes = await dangerTagBoxes(page);
  for (const tag of tagBoxes) {
    for (const box of boxes) {
      expect(boxesOverlap(tag, box), '번호표가 "! 위험" 표시를 가리면 안 된다').toBe(false);
    }
  }
});

// F4(/design-review 3회차, 사용자 결정, DECISIONS.md 2026-09-26): 번호표는 도우미 자신의 모드
// 표시(왼쪽 아래)도 다른 번호표처럼 장애물로 피한다.
test('F4: 번호표가 도우미 자신의 모드 표시와 겹치지 않는다', async ({ context, servePage }) => {
  servePage('http://practice.test/f4-mode.html', '<!doctype html><html><body style="margin:0"></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/f4-mode.html');
  await waitForHelperReady(page);

  const indicatorBox = await page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const el = host?.shadowRoot?.querySelector('.mode-indicator');
    const r = el?.getBoundingClientRect();
    return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
  });
  if (!indicatorBox) {
    throw new Error('모드 표시를 찾지 못했다');
  }

  // 모드 표시 오른쪽 바로 옆(5px 간격)에 버튼을 둔다 — 번호표의 기본 자리(요소 왼쪽 위 바깥
  // −14px,−14px)는 모드 표시 오른쪽 끝과 겹치지만, 다음 대안 자리(오른쪽 위)는 모드 표시 폭
  // 밖이라 장애물을 안다면 그 자리로 피할 수 있어야 한다.
  await page.evaluate(
    ({ x, y }) => {
      const b = document.createElement('button');
      b.id = 'btn-over-indicator';
      b.textContent = '겹침';
      b.style.cssText = `position:absolute;left:${x.toString()}px;top:${y.toString()}px;width:20px;height:20px`;
      document.body.appendChild(b);
    },
    { x: indicatorBox.x + indicatorBox.width + 5, y: indicatorBox.y + 5 },
  );
  await page.waitForTimeout(100);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(100);

  const boxes = await labelBoxes(page);
  expect(boxes.length).toBeGreaterThan(0);
  for (const box of boxes) {
    const overlap =
      box.x < indicatorBox.x + indicatorBox.width &&
      box.x + box.width > indicatorBox.x &&
      box.y < indicatorBox.y + indicatorBox.height &&
      box.y + box.height > indicatorBox.y;
    expect(overlap, '번호표가 모드 표시와 겹치면 안 된다').toBe(false);
  }
});

// F4 후속(DOM 감사 4회차, 사용자 결정 2026-09-26, DECISIONS.md): f4detail.mjs 실측 — frames.html을
// 확대 150%로 보면 중첩 iframe("nest") 버튼 번호표(5)의 다섯 자리가 모두 모드 표시에 막혀, 예전엔
// 그 겹친 자리를 그대로 썼다(hints4.txt "OVERLAP label 5 × mode-indicator"). 같은 확대·페이지로
// 다시 실제 화면에서 확인한다(기존 zoom 시험 도구, tests/e2e/zoom.e2e.ts와 같은 setZoom 방식).
test('F4 후속: frames.html을 확대 150%로 봐도 번호표가 도우미 자신의 모드 표시와 겹치지 않는다', async ({
  context,
  serviceWorker,
}) => {
  const page = await context.newPage();
  // f4detail.mjs 실측 창 크기(1280×800)와 맞춘다 — 확대 150%에서 innerWidth·innerHeight가
  // 실측(853×533)과 같아야 같은 레이아웃(중첩 iframe "nest" 버튼 위치)이 재현된다.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://practice.test/frames.html');
  await waitForHelperReady(page);

  const tabs = await serviceWorker.evaluate((url) => chrome.tabs.query({ url }), page.url());
  const tabId = tabs[0]?.id;
  if (tabId === undefined) {
    throw new Error('탭을 찾지 못했다');
  }
  await serviceWorker.evaluate(({ id, factor }) => chrome.tabs.setZoom(id, factor), { id: tabId, factor: 1.5 });
  await page.waitForTimeout(600);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(150);

  const indicatorBox = await page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const el = host?.shadowRoot?.querySelector('.mode-indicator');
    const r = el?.getBoundingClientRect();
    return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
  });
  if (!indicatorBox) {
    throw new Error('모드 표시를 찾지 못했다');
  }

  const boxes = await labelBoxes(page);
  expect(boxes.length).toBeGreaterThan(0);
  for (const box of boxes) {
    const overlap =
      box.x < indicatorBox.x + indicatorBox.width &&
      box.x + box.width > indicatorBox.x &&
      box.y < indicatorBox.y + indicatorBox.height &&
      box.y + box.height > indicatorBox.y;
    expect(overlap, '확대 150%에서도 번호표가 모드 표시와 겹치면 안 된다').toBe(false);
  }

  await page.keyboard.press('Escape');
  await serviceWorker.evaluate(({ id }) => chrome.tabs.setZoom(id, 1), { id: tabId });
});

test('ISSUE-002: blank-popup.html(화면 왼쪽 위 링크)에서 F를 누르면 그 번호표도 화면 안에 있다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/blank-popup.html');
  await waitForHelperReady(page);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(100);

  const viewport = page.viewportSize();
  if (!viewport) {
    throw new Error('뷰포트 크기를 알 수 없다');
  }

  const boxes = await labelBoxes(page);
  expect(boxes.length).toBeGreaterThan(0);
  for (const box of boxes) {
    expect(box.x, '번호표 왼쪽이 화면 밖이면 안 된다').toBeGreaterThanOrEqual(0);
    expect(box.y, '번호표 위쪽이 화면 밖이면 안 된다').toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, '번호표 오른쪽이 화면 밖이면 안 된다').toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height, '번호표 아래쪽이 화면 밖이면 안 된다').toBeLessThanOrEqual(viewport.height);
  }
});

test('입력칸에 초점이 있으면 F는 글자로 들어간다(번호표 안 뜸)', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/shortcuts.html');

  await page.locator('#text-input').click();
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(50);

  await expect(page.locator('#text-input')).toHaveValue('f');
  expect((await labelTexts(page)).length).toBe(0);
});

test('번호표로 같은 요소를 3번 누른 뒤 새로 고치고 F → 그 요소가 1번(고정 번호 없음)', async ({ context, servePage }) => {
  servePage('http://practice.test/hints-many.html', MANY_BUTTONS_HTML);
  const page = await context.newPage();
  await page.goto('http://practice.test/hints-many.html');
  await waitForHelperReady(page);
  await page.waitForTimeout(100);

  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(50);
    const number = await numberForElement(page, 'btn-1');
    await page.keyboard.press(`Digit${number}`);
    // recordPress(content→SW→storage.local) 왕복과 다음 F까지 떨림 간격(300ms, D-07) 확보.
    await page.waitForTimeout(450);
  }

  await page.reload();
  await waitForHelperReady(page);
  await page.waitForTimeout(100);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(50);

  expect(await numberForElement(page, 'btn-1')).toBe('1');
});

test('SW가 site:<origin>에 고정 번호를 쓰면 F에서 그 요소가 그 번호가 된다', async ({ context, servePage, serviceWorker }) => {
  servePage('http://practice.test/hints-many.html', MANY_BUTTONS_HTML);
  const page = await context.newPage();
  await page.goto('http://practice.test/hints-many.html');
  await waitForHelperReady(page);
  await page.waitForTimeout(100);

  await serviceWorker.evaluate(async () => {
    await chrome.storage.sync.set({
      'site:http://practice.test': {
        schemaVersion: 1,
        data: {
          disabled: false,
          pins: [
            {
              number: 5,
              fingerprint: { id: 'btn-2', name: 'btn-2', domPath: 'pinned', framePath: [] },
            },
          ],
        },
      },
    });
  });

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(50);

  expect(await numberForElement(page, 'btn-2')).toBe('5');
});

test('누르기 뒤 storage.local의 presses가 형식대로 저장되고 그 요소의 count가 는다', async ({
  context,
  servePage,
  serviceWorker,
}) => {
  servePage('http://practice.test/hints-many.html', MANY_BUTTONS_HTML);
  const page = await context.newPage();
  await page.goto('http://practice.test/hints-many.html');
  await waitForHelperReady(page);
  await page.waitForTimeout(100);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(50);
  const number = await numberForElement(page, 'btn-0');
  await page.keyboard.press(`Digit${number}`);
  await page.waitForTimeout(200);

  const shape = await readPressesShape(serviceWorker, 'http://practice.test');
  expect(shape).toEqual({ schemaVersion: 1, isArray: true });

  const count = await readPressesCount(serviceWorker, 'http://practice.test', 'btn-0');
  expect(count).toBeGreaterThanOrEqual(1);
});

test('자석 커서로 누른 요소도 누른 횟수에 들어간다', async ({ context, serviceWorker }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);

  const box = await page.locator('#btn-tiny').boundingBox();
  if (!box) {
    throw new Error('버튼을 찾지 못했다');
  }
  const x = box.x - 30;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.waitForTimeout(50);
  await page.mouse.click(x, y);
  await page.waitForTimeout(200);

  const count = await readPressesCount(serviceWorker, 'http://practice.test', 'btn-tiny');
  expect(count).toBeGreaterThanOrEqual(1);
});

async function pressesEntries(
  serviceWorker: Worker,
  origin: string,
): Promise<Array<{ fingerprint: { id?: string }; count: number }>> {
  const key = `presses:${origin}`;
  return serviceWorker.evaluate(async (storageKey) => {
    const result = await chrome.storage.local.get(storageKey);
    const stored = result[storageKey] as { data?: { counts?: Array<{ fingerprint: { id?: string }; count: number }> } } | undefined;
    return stored?.data?.counts ?? [];
  }, key);
}

test('WR-04: id·name·aria가 없는 링크를 여러 번 눌러도 글자로 같은 요소임을 알아채 기록이 하나로 쌓인다', async ({
  context,
  servePage,
  serviceWorker,
}) => {
  servePage(
    'http://practice.test/wr04-link.html',
    '<!doctype html><html><body style="margin:0">' +
      '<a href="javascript:void(0)" style="position:absolute;left:100px;top:100px;width:80px;height:30px;display:block">전용링크글자</a>' +
      '</body></html>',
  );
  const page = await context.newPage();
  await page.goto('http://practice.test/wr04-link.html');
  await waitForHelperReady(page);
  await page.waitForTimeout(100);

  const box = await page.locator('a').boundingBox();
  if (!box) {
    throw new Error('링크를 찾지 못했다');
  }
  // 요소 안(pointInRect)을 클릭하면 원래 클릭이 그대로 통과해(D-10) pressOrDrag를 거치지 않는다
  // — 자석이 "떨어진 곳에서 잡아 대신 누르기"를 하도록 요소 밖(잡는 범위 안)을 클릭한다(다른
  // presses 시험과 같은 방식, 아래 "자석 커서로 누른 요소도..." 시험 참고).
  const x = box.x - 10;
  const y = box.y + box.height / 2;

  // 같은 자리를 세 번 누른다 — 떨림 필터의 같은 자리 간격(기본 300ms, D-07)보다 넉넉히 띄운다.
  for (let i = 0; i < 3; i += 1) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(20);
    await page.mouse.click(x, y);
    await page.waitForTimeout(400);
  }

  const entries = await pressesEntries(serviceWorker, 'http://practice.test');
  expect(entries.length, '같은 링크를 여러 번 눌러도 기록 항목은 하나로 쌓여야 한다(id·name·aria가 없어도)').toBe(1);
  expect(entries[0]?.count).toBeGreaterThanOrEqual(3);
});

test('WR-04: 기록이 200개로 가득 차 있어도 방금 새로 누른 요소는 곧바로 밀려나지 않는다', async ({
  context,
  servePage,
  serviceWorker,
}) => {
  servePage(
    'http://practice.test/wr04-cap.html',
    '<!doctype html><html><body style="margin:0">' +
      '<button id="btn-new" style="position:absolute;left:50px;top:50px;width:40px;height:40px">새버튼</button>' +
      '</body></html>',
  );

  const origin = 'http://practice.test';
  const key = `presses:${origin}`;
  await serviceWorker.evaluate(
    async ({ storageKey, count }) => {
      const counts = [];
      for (let i = 0; i < count; i += 1) {
        counts.push({ fingerprint: { id: `seed-${i.toString()}`, domPath: `seed:nth-of-type(${i.toString()})`, framePath: [] }, count: 1 });
      }
      await chrome.storage.local.set({ [storageKey]: { schemaVersion: 1, data: { counts } } });
    },
    { storageKey: key, count: 200 },
  );

  const page = await context.newPage();
  await page.goto('http://practice.test/wr04-cap.html');
  await waitForHelperReady(page);
  await page.waitForTimeout(100);

  const box = await page.locator('#btn-new').boundingBox();
  if (!box) {
    throw new Error('버튼을 찾지 못했다');
  }
  // 요소 밖(잡는 범위 안)을 눌러 자석이 대신 누르기(pressOrDrag → sendRecordPress)를 거치게 한다.
  const x = box.x - 10;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.waitForTimeout(50);
  await page.mouse.click(x, y);
  await page.waitForTimeout(200);

  const entries = await pressesEntries(serviceWorker, origin);
  expect(entries.length).toBeLessThanOrEqual(200);
  const found = entries.find((entry) => entry.fingerprint.id === 'btn-new');
  expect(found, '방금 새로 누른 요소가 상한(200개) 때문에 곧바로 밀려나면 안 된다').toBeTruthy();
});
