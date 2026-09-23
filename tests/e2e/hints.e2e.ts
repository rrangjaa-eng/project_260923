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
  await page.waitForTimeout(50);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(50);
  await expect(page.locator('#site-keydown')).toHaveText('0');

  // 같은 키(Digit1)의 두 번째 입력이므로 떨림 간격(기본 300ms, D-07)보다 넉넉히 띄운다.
  await page.waitForTimeout(350);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(50);
  await expect(page.locator('#site-keydown')).toHaveText('1');
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
