import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

// D-18·D-19·D-26·SAFE-02·SAFE-03: 번호표로 고른 위험한 버튼은 빨간 테두리 확인 화면이 "정말
// 누를까요? Enter = 예"를 물은 뒤(1초 보호, 진짜 Enter 또는 스페이스바 1초 누르기로만 확인, Esc는
// 취소) 눌린다. 가짜 Enter·가짜 클릭으로는 확인되지 않는다(D-09). 연습 사이트는
// tests/practice-site/danger.html(D-28).

async function indicatorText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    const el = host?.shadowRoot?.querySelector('.mode-indicator');
    return el?.textContent ?? '';
  });
}

async function waitForHelperReady(page: Page): Promise<void> {
  await expect.poll(() => indicatorText(page)).toBe('도우미');
}

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

// 요소의 기본 배치 자리(왼쪽 위 바깥 −14px,−14px)에 가장 가까운 번호표를 찾는다(danger.e2e.ts와
// 같은 방식).
async function numberForElement(page: Page, elementId: string): Promise<string> {
  const box = await boxOf(page, `#${elementId}`);
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

interface HintDangerState {
  danger: boolean;
  borderStyle: string;
  tagText: string | null;
}

async function hintDangerState(page: Page, elementId: string): Promise<HintDangerState | null> {
  const box = await boxOf(page, `#${elementId}`);
  return page.evaluate(
    ({ x, y }) => {
      const shadow = document.querySelector('tremor-helper-root')?.shadowRoot;
      const labels = shadow?.querySelectorAll('.hint-label');
      if (!shadow || !labels) {
        return null;
      }
      let nearest: Element | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const label of Array.from(labels)) {
        const rect = label.getBoundingClientRect();
        const distance = Math.hypot(rect.x - (x - 14), rect.y - (y - 14));
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = label;
        }
      }
      if (!nearest) {
        return null;
      }
      const style = getComputedStyle(nearest);
      const tag = nearest.nextElementSibling;
      return {
        danger: nearest.getAttribute('data-danger') === 'true',
        borderStyle: style.borderTopStyle,
        tagText: tag ? tag.textContent : null,
      };
    },
    { x: box.x, y: box.y },
  );
}

// F → 대상 요소의 번호를 찾아 눌러 확인 화면을 연다.
async function openDangerConfirm(page: Page, elementId: string): Promise<void> {
  await page.keyboard.press('KeyF');
  // WR-10: openHints()는 storage 읽기 두 번(sync 고정 번호 + local 자주 누른 기록)을 기다린 뒤에야
  // 번호표를 그린다 — 고정 50ms sleep은 그 왕복이 느릴 때(부하가 큰 CI 등) 아직 안 그려진 채로
  // numberForElement를 불러 ''을 돌려받고 `Digit${''}`(잘못된 키)를 누르게 만들 수 있다(재현
  // 가능한 결정적 실패라기보다 타이밍에 좌우되는 불안정함). 번호표가 실제로 뜰 때까지 기다린다.
  await expect.poll(() => numberForElement(page, elementId)).not.toBe('');
  const number = await numberForElement(page, elementId);
  await page.keyboard.press(`Digit${number}`);
  await page.waitForTimeout(50);
}

interface DialogState {
  visible: boolean;
  width: number;
  borderColorMatchesAccent: boolean;
  title: string | null;
  body: string | null;
  confirmButtonHeight: number;
  cancelButtonHeight: number;
}

async function readDialog(page: Page): Promise<DialogState | null> {
  return page.evaluate(() => {
    const shadow = document.querySelector('tremor-helper-root')?.shadowRoot;
    const dialog = shadow?.querySelector('[data-part="confirm-dialog"]');
    if (!shadow || !dialog) {
      return null;
    }
    const rect = dialog.getBoundingClientRect();
    const style = getComputedStyle(dialog);

    // --accent 토큰의 실제 계산 값을 얻어(하드코딩 없이) 테두리 색과 비교한다(danger.e2e.ts와 같은 방식).
    // 01-16 감사: 확인 카드 테두리는 --accent 3px(SYSTEM.md 형태) — 위험은 빨강 채움 버튼·글자로만 신호한다.
    const probe = document.createElement('div');
    probe.style.color = 'var(--accent)';
    shadow.append(probe);
    const accentColor = getComputedStyle(probe).color;
    probe.remove();

    const confirmBtn = shadow.querySelector('[data-part="confirm-button-confirm"]');
    const cancelBtn = shadow.querySelector('[data-part="confirm-button-cancel"]');

    return {
      visible: dialog.getAttribute('data-visible') === 'true',
      width: rect.width,
      borderColorMatchesAccent: style.borderTopColor === accentColor,
      title: shadow.querySelector('[data-part="confirm-title"]')?.textContent ?? null,
      body: shadow.querySelector('[data-part="confirm-body"]')?.textContent ?? null,
      confirmButtonHeight: confirmBtn ? confirmBtn.getBoundingClientRect().height : 0,
      cancelButtonHeight: cancelBtn ? cancelBtn.getBoundingClientRect().height : 0,
    };
  });
}

interface GuardBarState {
  text: string | null;
  transitionProperty: string;
  transitionDuration: string;
  transitionTimingFunction: string;
}

async function readGuardBar(page: Page): Promise<GuardBarState | null> {
  return page.evaluate(() => {
    const shadow = document.querySelector('tremor-helper-root')?.shadowRoot;
    const bar = shadow?.querySelector('[data-part="confirm-guard-bar"]');
    const text = shadow?.querySelector('[data-part="confirm-guard-text"]');
    if (!bar || !text) {
      return null;
    }
    const style = getComputedStyle(bar);
    return {
      text: text.textContent,
      transitionProperty: style.transitionProperty,
      transitionDuration: style.transitionDuration,
      transitionTimingFunction: style.transitionTimingFunction,
    };
  });
}

test('F → 삭제 번호(빨간 점선+! 위험) → 번호를 누르면 확인 화면이 뜨고 카드 규칙을 지킨다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(50);

  const dangerState = await hintDangerState(page, 'btn-delete-solo');
  expect(dangerState?.danger).toBe(true);
  expect(dangerState?.borderStyle).toBe('dashed');
  expect(dangerState?.tagText).toBe('! 위험');

  const number = await numberForElement(page, 'btn-delete-solo');
  await page.keyboard.press(`Digit${number}`);
  await page.waitForTimeout(100);

  const dialog = await readDialog(page);
  expect(dialog?.visible).toBe(true);
  expect(dialog?.title).toBe('정말 누를까요? Enter = 예');
  expect(dialog?.body).toContain('삭제');
  expect(Math.abs((dialog?.width ?? 0) - 600)).toBeLessThanOrEqual(1);
  expect(dialog?.confirmButtonHeight ?? 0).toBeGreaterThanOrEqual(64);
  expect(dialog?.cancelButtonHeight ?? 0).toBeGreaterThanOrEqual(64);
  expect(dialog?.borderColorMatchesAccent).toBe(true);
});

test('확인 화면 1초 보호: 300ms 뒤 Enter는 무시되고 1,100ms 뒤 Enter로 확인·눌림·닫힘', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  await openDangerConfirm(page, 'btn-delete-solo');

  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(50);
  await expect(page.locator('#btn-delete-solo-count')).toHaveText('0');
  expect((await readDialog(page))?.visible).toBe(true);

  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  await expect(page.locator('#btn-delete-solo-count')).toHaveText('1');
  expect(await readDialog(page)).toBeNull();
});

test('확인 화면 1초 보호: 300ms 뒤 Esc는 무시되고 1,100ms 뒤 Esc로 닫히고 카운터는 0이다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  await openDangerConfirm(page, 'btn-delete-solo');

  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(50);
  expect((await readDialog(page))?.visible).toBe(true);

  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(50);
  expect(await readDialog(page)).toBeNull();
  await expect(page.locator('#btn-delete-solo-count')).toHaveText('0');
});

test('확인 화면에서 스페이스바를 1초 넘게 누르고 있으면 확인되고, 1초 전에 떼면 확인되지 않는다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  await openDangerConfirm(page, 'btn-delete-solo');
  await page.waitForTimeout(1100);
  await page.keyboard.down('Space');
  await page.waitForTimeout(1200);
  await page.keyboard.up('Space');
  await page.waitForTimeout(100);
  await expect(page.locator('#btn-delete-solo-count')).toHaveText('1');
  expect(await readDialog(page)).toBeNull();

  await openDangerConfirm(page, 'btn-delete-paired');
  await page.waitForTimeout(1100);
  await page.keyboard.down('Space');
  await page.waitForTimeout(200);
  await page.keyboard.up('Space');
  await page.waitForTimeout(100);
  await expect(page.locator('#btn-delete-paired-count')).toHaveText('0');
  expect((await readDialog(page))?.visible).toBe(true);

  // WR-10: keyup이 hold를 안 끊는 고장이라면(guard가 keydown 시각 기준으로 계속 시간을 잰다)
  // 원래 keydown으로부터 1000ms(holdMs) 뒤 저절로 confirm된다 — 위 300ms 시점 확인만으로는 이
  // 고장을 잡지 못한다(그 시점엔 아직 1000ms가 안 지났다). keydown으로부터 1200ms까지 기다린
  // 뒤에도 여전히 안 눌려 있어야 한다.
  await page.waitForTimeout(900); // 총 200+100+900 = 1200ms(keydown 기준).
  await expect(page.locator('#btn-delete-paired-count')).toHaveText('0');
  expect((await readDialog(page))?.visible).toBe(true);

  // 다음 시험에 영향 없도록 열린 채로 남은 확인 화면을 정리한다.
  await page.keyboard.press('Escape');
});

test('WR-01: 스페이스바를 누른 채 창이 포커스를 잃으면(keyup을 못 받아도) 누르고 있던 시간이 끊긴다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  await openDangerConfirm(page, 'btn-delete-solo');
  await page.waitForTimeout(1100); // 보호 시간이 지난 뒤에만 누르고 있는 시간이 시작된다.

  await page.keyboard.down('Space');
  await page.waitForTimeout(200);
  // 실제 keyup 없이(예: alt-tab으로 다른 창에 포커스가 간 것처럼) 창이 blur된다 — 다음 tick이
  // 이 순간을 뗌으로 봐야 한다.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));

  // 원래 keydown으로부터 1000ms(holdMs)가 지나는 시점까지 기다린다. keyup 재설정이 없었다면
  // 여기서 tick()이 confirm으로 판정해 버튼이 눌린다.
  await page.waitForTimeout(900);
  await expect(page.locator('#btn-delete-solo-count')).toHaveText('0');
  expect((await readDialog(page))?.visible).toBe(true);

  await page.keyboard.up('Space');
  await page.waitForTimeout(50);
  await page.keyboard.press('Escape');
});

test('확인 화면이 뜬 뒤 페이지가 가짜(isTrusted=false) Enter를 보내도 확인되지 않는다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  await openDangerConfirm(page, 'btn-delete-solo');
  await page.waitForTimeout(1100);

  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
  });
  await page.waitForTimeout(100);

  await expect(page.locator('#btn-delete-solo-count')).toHaveText('0');
  expect((await readDialog(page))?.visible).toBe(true);

  await page.keyboard.press('Escape');
});

test('확인 화면이 뜬 뒤 페이지가 열린 shadow root의 확인 버튼을 .click()해도 확인되지 않는다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  await openDangerConfirm(page, 'btn-delete-solo');
  await page.waitForTimeout(1100);

  await page.evaluate(() => {
    const shadow = document.querySelector('tremor-helper-root')?.shadowRoot;
    const btn = shadow?.querySelector('[data-part="confirm-button-confirm"]');
    if (btn instanceof HTMLElement) {
      btn.click();
    }
  });
  await page.waitForTimeout(100);

  await expect(page.locator('#btn-delete-solo-count')).toHaveText('0');
  expect((await readDialog(page))?.visible).toBe(true);

  await page.keyboard.press('Escape');
});

test('확인 화면이 떠 있는 동안 누른 키를 사이트의 keydown 기록이 받지 않는다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  await openDangerConfirm(page, 'btn-delete-solo');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(50);
  await expect(page.locator('#site-keydown')).toHaveText('0');

  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  await expect(page.locator('#site-keydown')).toHaveText('0');
});

test('확인 화면에 "1초 뒤에 누를 수 있어요" 글자와 1s linear 보호 막대가 있다(움직임 줄이기에서도 유지)', async ({ context }) => {
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  await openDangerConfirm(page, 'btn-delete-solo');

  const guard = await readGuardBar(page);
  expect(guard?.text).toBe('1초 뒤에 누를 수 있어요');
  expect(guard?.transitionProperty).toBe('width');
  expect(guard?.transitionDuration).toBe('1s');
  expect(guard?.transitionTimingFunction).toBe('linear');

  await page.waitForTimeout(1100);
  const guardAfter = await readGuardBar(page);
  expect(guardAfter?.text).toBe('지금 누를 수 있어요');

  await page.keyboard.press('Enter');
});

test('CR-02: 확인 화면이 떠 있을 때 도우미를 껐다 다시 켜면 옛 확인이 화면 없이 다시 무장되지 않는다', async ({
  context,
  openPopup,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  await openDangerConfirm(page, 'btn-delete-solo');
  await page.waitForTimeout(1100); // 보호 시간이 지난 뒤 끈다 — CR-02 재현 조건(guard가 이미 지남).

  const popup = await openPopup(page);
  await popup.getByRole('button', { name: '도우미 끄기' }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector('tremor-helper-root') !== null)).toBe(false);

  // WR-06: 같은 카드를 다시 누르는 것 — 떨림 두 번 탭과 구분되도록 간격을 띄운다(helper-toggle
  // .e2e.ts와 같은 관례).
  await popup.waitForTimeout(350);
  await popup.getByRole('button', { name: '도우미 켜기' }).click();
  await popup.close();
  await waitForHelperReady(page);

  // 평범한 Enter — 화면에 확인 대화상자는 없다. 옛 확인이 조용히 다시 무장돼 있으면 안 된다.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);

  await expect(page.locator('#btn-delete-solo-count')).toHaveText('0');
  expect(await readDialog(page)).toBeNull();
});

test('CR-01: 확인 화면이 떠 있을 때 취소 버튼 근처(48px 안) 페이지 버튼이 대신 눌리지 않고 취소 클릭이 통한다', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  await openDangerConfirm(page, 'btn-delete-solo');
  await page.waitForTimeout(1100); // 보호 시간이 지나야 진짜 취소 클릭이 통한다.

  const cancelBox = await page.evaluate(() => {
    const shadow = document.querySelector('tremor-helper-root')?.shadowRoot;
    const btn = shadow?.querySelector('[data-part="confirm-button-cancel"]');
    const rect = btn?.getBoundingClientRect();
    return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
  });
  if (!cancelBox) {
    throw new Error('취소 버튼을 찾지 못했다');
  }
  const clickX = cancelBox.x + cancelBox.width / 2;
  const clickY = cancelBox.y + cancelBox.height / 2;

  // 취소 버튼 클릭 지점에서 15px 떨어진(자석 잡는 범위 48px 안, 클릭 지점 자체는 벗어난) 곳에
  // 평범한 페이지 버튼을 둔다 — CR-01은 취소 클릭이 이 버튼으로 새는 사고를 낸다.
  await page.evaluate(
    ({ x, y }) => {
      const btn = document.createElement('button');
      btn.id = 'nearby-under-dialog';
      btn.textContent = '몰래';
      btn.style.cssText = `position:fixed;left:${(x + 15).toString()}px;top:${(y - 15).toString()}px;width:30px;height:30px`;
      (window as unknown as { __nearbyClicks: number }).__nearbyClicks = 0;
      btn.addEventListener('click', () => {
        (window as unknown as { __nearbyClicks: number }).__nearbyClicks += 1;
      });
      document.body.append(btn);
    },
    { x: clickX, y: clickY },
  );

  // collector가 새 버튼을 모으도록(MutationObserver → rAF) 기다린다.
  await page.waitForTimeout(100);

  await page.mouse.click(clickX, clickY);
  await page.waitForTimeout(150);

  const nearbyClicks = await page.evaluate(() => (window as unknown as { __nearbyClicks?: number }).__nearbyClicks ?? 0);
  expect(nearbyClicks, '취소 버튼 근처 페이지 버튼이 대신 눌리면 안 된다').toBe(0);
  expect(await readDialog(page), '취소를 눌렀으니 확인 화면이 닫혀야 한다').toBeNull();
  await expect(page.locator('#btn-delete-solo-count')).toHaveText('0');
});

test('WR-02: 번호표가 뜬 뒤 요소 글자가 위험 단어로 바뀌면, 그 번호는 확인 없이 곧바로 누르지 않는다', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(50);
  const number = await numberForElement(page, 'btn-save');

  // SPA 재렌더링 흉내: 번호표가 뜬 뒤(스냅샷을 만든 뒤) 이 요소의 글자가 위험 단어로 바뀐다.
  // 번호는 아직 "저장"으로 열렸을 때의 스냅샷(danger:false)을 들고 있다.
  await page.evaluate(() => {
    const btn = document.getElementById('btn-save');
    if (btn) {
      btn.textContent = '삭제';
    }
  });
  await page.waitForTimeout(150); // collector의 MutationObserver → rAF 재수집을 기다린다.

  await page.keyboard.press(`Digit${number}`);
  await page.waitForTimeout(100);

  await expect(page.locator('#btn-save-count'), '위험해진 요소가 확인 없이 곧바로 눌리면 안 된다').toHaveText('0');
  expect((await readDialog(page))?.visible, '대신 확인 화면이 떠야 한다').toBe(true);
  expect((await readDialog(page))?.body).toContain('삭제');

  await page.keyboard.press('Escape');
});

test('저장(위험 아님) 번호는 확인 화면 없이 곧바로 눌린다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  await page.keyboard.press('KeyF');
  await page.waitForTimeout(50);
  const number = await numberForElement(page, 'btn-save');
  await page.keyboard.press(`Digit${number}`);
  await page.waitForTimeout(100);

  await expect(page.locator('#btn-save-count')).toHaveText('1');
  expect(await readDialog(page)).toBeNull();
});

// Task 3(D-03, D-09, T-01-19, T-01-26): 다른 출처 iframe(other.test) 안 위험한 버튼도 맨 위
// 화면의 확인 화면을 거쳐서만 눌린다. 초점이 iframe 안(입력칸 밖)에 있어도 확인 키가
// hints/key·confirm/key를 거쳐 맨 위에 전달된다. danger.html은 맨 위 8개 + frame-child 안
// btn-child-delete 1개 = 9개라 한 장에 모두 뜬다(frames.e2e.ts와 같은 재시도 방식으로 프레임
// 보고 왕복을 기다린다).

async function labelCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const host = document.querySelector('tremor-helper-root');
    return host?.shadowRoot?.querySelectorAll('.hint-label').length ?? 0;
  });
}

async function pressFUntilLabelCount(page: Page, expectedCount: number): Promise<void> {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(120);
    if ((await labelCount(page)) >= expectedCount) {
      return;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
  }
}

async function numberForFrameElement(page: Page, frameSelector: string, elementId: string): Promise<string> {
  const box = await page.frameLocator(frameSelector).locator(`#${elementId}`).boundingBox();
  if (!box) {
    throw new Error(`요소를 찾지 못했다: ${frameSelector} ${elementId}`);
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

async function openDangerConfirmInFrame(page: Page, frameSelector: string, elementId: string): Promise<void> {
  await pressFUntilLabelCount(page, 9);
  const number = await numberForFrameElement(page, frameSelector, elementId);
  await page.keyboard.press(`Digit${number}`);
  await page.waitForTimeout(150);
}

test('other.test 자식 프레임 안 삭제 번호 → 맨 위 확인 화면, 1,100ms 뒤 Enter → 프레임 안 카운터 1', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  await openDangerConfirmInFrame(page, '#frame-child', 'btn-child-delete');

  const dialog = await readDialog(page);
  expect(dialog?.visible).toBe(true);
  expect(dialog?.body).toContain('삭제');

  await page.waitForTimeout(1100);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);

  await expect(page.frameLocator('#frame-child').locator('#btn-child-delete-count')).toHaveText('1');
  expect(await readDialog(page)).toBeNull();
});

test('먼저 iframe 안(입력칸 밖)에 초점을 옮긴 뒤 같은 흐름 → 300ms Enter는 무시, 1,100ms 뒤 Enter로 확인된다', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  await page.frameLocator('#frame-child').locator('#child-focus-target').click();

  await openDangerConfirmInFrame(page, '#frame-child', 'btn-child-delete');

  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  await expect(page.frameLocator('#frame-child').locator('#btn-child-delete-count')).toHaveText('0');

  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await expect(page.frameLocator('#frame-child').locator('#btn-child-delete-count')).toHaveText('1');
});

test('초점이 iframe 안에 있을 때 확인 화면이 떠 있는 동안 그 프레임의 keydown 기록이 늘지 않는다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);

  await page.frameLocator('#frame-child').locator('#child-focus-target').click();

  await openDangerConfirmInFrame(page, '#frame-child', 'btn-child-delete');

  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  await expect(page.frameLocator('#frame-child').locator('#site-keydown')).toHaveText('0');

  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await expect(page.frameLocator('#frame-child').locator('#site-keydown')).toHaveText('0');
});
