import { test, expect } from './fixtures';
import type { Locator, Page, Worker } from '@playwright/test';

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

// F를 누른 뒤 번호가 뜰 때까지 기다리고(expect.poll, 고정 sleep 금지) 그 번호를 찾는다. 방금
// 나타난 프레임(about:blank 뒤 이동·다른 출처 안 srcdoc)은 collect() → frame/report → relay →
// frames/reports 왕복이 F를 누른 그 순간에는 아직 안 왔을 수 있다 — openHints()는 그 순간의
// 스냅샷만 쓰므로, 번호를 못 찾으면 닫았다 다시 열어 새 스냅샷으로 다시 찾는다(고정 sleep 대신
// 조건 재시도).
async function findHintNumberFor(page: Page, locator: Locator): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await pressFUntilLabels(page, 1);
    try {
      const number = await numberForLocator(page, locator);
      if (number) {
        return number;
      }
    } catch {
      // 이 요소의 보고가 이 스냅샷엔 없었다 — 닫고 다시 열어 본다.
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  throw new Error('번호를 찾지 못했다');
}

// 초점을 맨 위로 되돌리고 번호를 찾아 누른다.
async function pressHintFor(page: Page, locator: Locator): Promise<void> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.focus();
  });
  const number = await findHintNumberFor(page, locator);
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

// Task 2: document.write로 다시 쓴 문서에서 옛 도우미는 물러나고 새 도우미가 한 번만 들어온다.
// probe evidence 2·3·4번(PLAN.md): document.open()이 문서·Window의 이벤트 리스너를 지워 옛
// 인스턴스는 "주입은 됐지만 귀가 먹은" 상태가 된다 — chrome.runtime.onMessage는 살아남는다.

async function ringVisible(page: Page, frameSelector: string): Promise<boolean> {
  return page
    .frameLocator(frameSelector)
    .locator('tremor-helper-root')
    .evaluate((host) => host.shadowRoot?.querySelector('.ring')?.getAttribute('data-visible') === 'true')
    .catch(() => false);
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

// document.write 프레임을 쓰는 시험은 조작 전에 이 확인으로 살아 있는 도우미를 먼저 기다린다
// (고정 sleep 대신 expect.poll) — 새 도우미가 아직 들어오기 전(RED)이면 테두리가 안 보여 여기서
// 실패한다.
async function waitForFrameHelperAlive(page: Page, frameSelector: string, buttonSelector: string): Promise<Box> {
  const box = await page.frameLocator(frameSelector).locator(buttonSelector).boundingBox();
  if (!box) {
    throw new Error(`버튼을 찾지 못했다: ${frameSelector} ${buttonSelector}`);
  }
  await page.mouse.move(box.x - 15, box.y + box.height / 2);
  await expect.poll(() => ringVisible(page, frameSelector), { timeout: 5000 }).toBe(true);
  await page.mouse.move(5, 400);
  await page.waitForTimeout(200);
  return box;
}

async function confirmDialogVisible(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('[data-part="confirm-dialog"]')?.getAttribute('data-visible') ===
      'true',
  );
}

// SW 전역 배열에 frame/state 기록을 쌓는 시험 전용 리스너(제품 코드 훅 아님, 응답하지 않음) —
// 시험이 그 배열을 읽어 옛 인스턴스가 조용한지 확인한다.
async function setupFrameStateRecorder(serviceWorker: Worker): Promise<void> {
  await serviceWorker.evaluate(() => {
    const g = globalThis as typeof globalThis & { __frameStateRecords?: Array<{ frameId: number; enabled: boolean }> };
    g.__frameStateRecords = [];
    chrome.runtime.onMessage.addListener((raw: unknown, sender: chrome.runtime.MessageSender) => {
      const msg = raw as { type?: string; enabled?: boolean } | undefined;
      if (msg?.type === 'frame/state' && sender.frameId !== undefined) {
        g.__frameStateRecords?.push({ frameId: sender.frameId, enabled: msg.enabled === true });
      }
      return undefined;
    });
  });
}

async function frameStateRecordCount(serviceWorker: Worker, frameId: number): Promise<number> {
  const records = await serviceWorker.evaluate(
    () => (globalThis as typeof globalThis & { __frameStateRecords?: Array<{ frameId: number; enabled: boolean }> }).__frameStateRecords ?? [],
  );
  return records.filter((r) => r.frameId === frameId && r.enabled).length;
}

// WR-01(01-REVIEW.md): setupFrameStateRecorder가 켜져 있어야 자식 프레임의 frameId를 알 수
// 있다 — waitForFrameHelperAlive가 통과한 시점에는 새 인스턴스가 이미 true를 보낸 뒤다.
async function childFrameIdFromRecords(serviceWorker: Worker): Promise<number | null> {
  const records = await serviceWorker.evaluate(
    () => (globalThis as typeof globalThis & { __frameStateRecords?: Array<{ frameId: number; enabled: boolean }> }).__frameStateRecords ?? [],
  );
  const found = records.find((r) => r.frameId !== 0 && r.enabled);
  return found ? found.frameId : null;
}

test('document.write 프레임: 커서를 대면 그 프레임 안에 강조 테두리가 그려진다(살아 있는 도우미 확인)', async ({ context }) => {
  const page = await context.newPage();
  await openEditorFrames(page);

  await waitForFrameHelperAlive(page, '#frame-write', '#btn-write');
});

test('document.write 프레임 버튼을 100ms 간격으로 두 번 클릭하면 카운터가 1만 오른다 (FILT-01)', async ({ context }) => {
  const page = await context.newPage();
  await openEditorFrames(page);

  const box = await waitForFrameHelperAlive(page, '#frame-write', '#btn-write');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await page.waitForTimeout(100);
  await page.mouse.click(x, y);
  await page.waitForTimeout(300);

  await expect(page.frameLocator('#frame-write').locator('#btn-write-count')).toHaveText('1');
});

test('document.write 프레임: F → 번호 → 정확히 한 번만 눌린다(옛 인스턴스가 함께 누르지 않음)', async ({ context }) => {
  const page = await context.newPage();
  await openEditorFrames(page);

  await waitForFrameHelperAlive(page, '#frame-write', '#btn-write');
  const btn = page.frameLocator('#frame-write').locator('#btn-write');
  await pressHintFor(page, btn);
  await page.waitForTimeout(300);
  await expect(page.frameLocator('#frame-write').locator('#btn-write-count')).toHaveText('1');

  await page.waitForTimeout(500);
  await expect(page.frameLocator('#frame-write').locator('#btn-write-count')).toHaveText('1');
});

test('document.write 프레임: 삭제 번호 → 확인 화면 → 1,100ms 뒤 Enter → 정확히 한 번 눌린다', async ({ context }) => {
  const page = await context.newPage();
  await openEditorFrames(page);

  await waitForFrameHelperAlive(page, '#frame-write', '#btn-write');
  const deleteBtn = page.frameLocator('#frame-write').locator('#btn-write-delete');
  await pressHintFor(page, deleteBtn);

  await expect.poll(() => confirmDialogVisible(page)).toBe(true);
  await page.waitForTimeout(1100);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);

  await expect(page.frameLocator('#frame-write').locator('#btn-write-delete-count')).toHaveText('1');
});

test('document.write 프레임 입력칸에 초점이 가면 입력 중 표시, Esc로 도우미로 복귀한다 (KEY-01)', async ({ context }) => {
  const page = await context.newPage();
  await openEditorFrames(page);

  await waitForFrameHelperAlive(page, '#frame-write', '#btn-write');
  const input = page.frameLocator('#frame-write').locator('#input-write');
  await input.click();
  await expect
    .poll(() => page.evaluate(() => document.querySelector('tremor-helper-root')?.getAttribute('data-mode')))
    .toBe('typing');

  await page.keyboard.press('Escape');
  await expect
    .poll(() => page.evaluate(() => document.querySelector('tremor-helper-root')?.getAttribute('data-mode')))
    .toBe('helper');
});

test('designMode 편집기 프레임 본문 클릭 → 입력 중, 자동 반복은 한 번만 더해진다 (KEY-01, FILT-02)', async ({ context }) => {
  const page = await context.newPage();
  await openEditorFrames(page);

  const text = page.frameLocator('#frame-editor').locator('#editor-text');
  await text.click();
  await page.keyboard.press('End');
  await expect
    .poll(() => page.evaluate(() => document.querySelector('tremor-helper-root')?.getAttribute('data-mode')))
    .toBe('typing');

  await page.keyboard.type('12 3');
  await expect(text).toContainText('12 3');

  const before = await text.textContent();
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.down('b');
  }
  await page.keyboard.up('b');
  await expect(text).toHaveText(`${before ?? ''}b`);
});

test('contenteditable 편집기 프레임 본문 클릭 → 입력 중 표시 (KEY-01)', async ({ context }) => {
  const page = await context.newPage();
  await openEditorFrames(page);

  const text = page.frameLocator('#frame-ce').locator('#ce-text');
  await text.click();
  await expect
    .poll(() => page.evaluate(() => document.querySelector('tremor-helper-root')?.getAttribute('data-mode')))
    .toBe('typing');
});

test('맨 위 문서를 document.open/write/close로 다시 쓰면 옛 도우미는 물러나고 새 도우미가 한 번만 들어온다', async ({
  context,
  serviceWorker,
}) => {
  await setupFrameStateRecorder(serviceWorker);
  const page = await context.newPage();
  await page.goto('http://practice.test/input.html');
  await expect
    .poll(() => page.evaluate(() => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.mode-indicator')?.textContent))
    .toBe('도우미');

  const before = await frameStateRecordCount(serviceWorker, 0);

  await page.evaluate(() => {
    document.open();
    // document.write는 이 시험이 직접 재현하려는 대상(SmartEditor 2·CKEditor 4·TinyMCE classic이
    // 편집 영역을 만드는 패턴)이다 — deprecated 경고는 알고 억제한다.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.write(
      '<!doctype html><body style="margin:0">' +
        '<button id="btn-rewrite" style="width:100px;height:32px;margin:20px;padding:0">rewrite</button>' +
        '<span id="btn-rewrite-count">0</span>' +
        '<script>document.getElementById("btn-rewrite").addEventListener("click",function(){' +
        'var c=document.getElementById("btn-rewrite-count");c.textContent=String(Number(c.textContent)+1);});</script>' +
        '</body>',
    );
    document.close();
  });

  await expect
    .poll(() => page.evaluate(() => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.mode-indicator')?.textContent))
    .toBe('도우미');
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('tremor-helper-root').length)).toBe(1);

  const after = await frameStateRecordCount(serviceWorker, 0);
  expect(after - before, '다시 쓴 맨 위 문서의 frameId 0 frame/state(true)는 정확히 1번이어야 한다').toBe(1);

  // WR-06(01-REVIEW.md): 다시 쓰기 직후 onUpdated(complete)가 옛 인스턴스 정리→frame/reinject→
  // executeScript 왕복과 경쟁해 ping 한 번이 실패하면 아이콘이 "도울 수 없음"으로 굳을 수 있다.
  await expect
    .poll(
      async () =>
        serviceWorker.evaluate(async () => {
          const tabs = await chrome.tabs.query({ url: 'http://practice.test/*' });
          const id = tabs[0]?.id;
          return id === undefined ? '' : chrome.action.getTitle({ tabId: id });
        }),
      { timeout: 5000 },
    )
    .toBe('손 떨림 도우미');

  const btn = page.locator('#btn-rewrite');
  await pressHintFor(page, btn);
  await page.waitForTimeout(300);
  await expect(page.locator('#btn-rewrite-count')).toHaveText('1');
});

// WR-01/WR-02(01-REVIEW.md): 01-19의 documentWasRewritten() 방어(content.ts)는 근거가 서로
// 모순되는 추측성 코드였고 되돌렸다(WR-01) — 다시 쓰기 경로에 실제로 들어가면 frame/reinject
// 없이 정리돼 그 프레임의 도우미가 통째로 사라지는 부작용이 있었다. 그때 함께 바뀐 이 시험의
// hostCount===1 단언은 새 인스턴스가 시작할 때 tremor-helper-root를 모두 지우므로(content.ts)
// 옛 인스턴스의 정리 여부와 무관하게 거의 항상 참이라 "다시 쓰기 뒤 옛 인스턴스가 조용함"을
// 결정적으로 보지 못했다 — waitForFrameHelperAlive가 통과한 시점(새 인스턴스가 이미 true를
// 보낸 뒤) 이후 그 자식 frameId의 frame/state가 관찰 창(1500ms) 동안 0건인지로 원래 의도를
// 경쟁 없이 되살렸다(WR-02).
test('document.write로 채운 프레임이 막 생겨도 옛 인스턴스는 조용하다(자식 프레임)', async ({ context, servePage, serviceWorker }) => {
  await setupFrameStateRecorder(serviceWorker);
  // 인라인 스크립트가 iframe 하나를 붙이자마자 open/write/close로 버튼+카운터를 쓴다(맨 위에는
  // 누를 요소가 없다) — CKEditor 4 classic이 편집 영역을 만드는 바로 그 패턴.
  servePage(
    'http://practice.test/write-child.html',
    '<!doctype html><body style="margin:0">' +
      '<iframe id="frame-w" title="document.write 자식" style="width:300px;height:140px;border:1px solid #999"></iframe>' +
      '<script>' +
      'var f=document.getElementById("frame-w");' +
      "var d=f.contentWindow.document;d.open();d.write('" +
      '<!doctype html><meta charset="utf-8"><body style="margin:0">' +
      '<button id="btn-w" style="width:100px;height:32px;margin:20px;padding:0">w</button>' +
      '<span id="btn-w-count">0</span>' +
      '<script>document.getElementById("btn-w").addEventListener("click",function(){' +
      'var c=document.getElementById("btn-w-count");c.textContent=String(Number(c.textContent)+1);});<\\/script>' +
      '</body>' +
      "');d.close();" +
      '</script>' +
      '</body>',
  );

  const page = await context.newPage();
  await page.goto('http://practice.test/write-child.html');
  await waitForFrameHelperAlive(page, '#frame-w', '#btn-w');

  // 결정적(경쟁 없는) 안전 확인 1: 새 인스턴스가 이미 true를 보낸 시점부터, 그 frameId의
  // frame/state(true)가 관찰 창 동안 0건이어야 한다(옛 인스턴스가 함께·뒤늦게 켜지지 않음).
  const childFrameId = await childFrameIdFromRecords(serviceWorker);
  expect(childFrameId, '새 인스턴스의 frame/state(true) 기록을 찾지 못했다').not.toBeNull();
  const baseline = await frameStateRecordCount(serviceWorker, childFrameId as number);
  await page.waitForTimeout(1500);
  expect(
    (await frameStateRecordCount(serviceWorker, childFrameId as number)) - baseline,
    '다시 쓰기 뒤 관찰 창 동안 그 frameId의 frame/state(true)가 새로 오면 안 된다(옛 인스턴스가 조용함)',
  ).toBe(0);

  // 결정적 안전 확인 2: 옛 인스턴스가 스스로 지운 자기 호스트든, 새 인스턴스가 시작할 때 지우는
  // 남은 옛 호스트든, 정리 시점과 무관하게 최종 상태는 항상 호스트 정확히 1개다.
  const hostCount = await page.frameLocator('#frame-w').locator('tremor-helper-root').count();
  expect(hostCount, '자식 프레임 안 도우미 호스트는 정확히 1개여야 한다(옛 인스턴스가 자기 것을 남기지 않음)').toBe(1);

  // 결정적 안전 확인 3: 옛 인스턴스의 리스너가 안 떼어졌다면(probe evidence 4번, 01-17) 번호를
  // 누를 때 옛 인스턴스도 press/request를 함께 받아 카운터가 2가 된다 — 정확히 1이어야 한다.
  const btn = page.frameLocator('#frame-w').locator('#btn-w');
  await pressHintFor(page, btn);
  await page.waitForTimeout(300);
  await expect(page.frameLocator('#frame-w').locator('#btn-w-count')).toHaveText('1');
});

// Task 3: 나머지 편집기 프레임 모양과 경계 — 나중에 이동하는 about:blank, 다른 출처 안 srcdoc,
// 번호 중복 없음, 기록 출처. 맨 위 about: 새 창(window.open('')) 관련 가드·시험은 이용자 결정으로
// 이 계획 범위에서 뺐다(SUMMARY 참고 — 전체 지원은 01-18).

test('about:blank로 시작해 이동한 프레임의 버튼도 번호·필터가 정확히 한 번씩 동작한다', async ({ context }) => {
  const page = await context.newPage();
  await openEditorFrames(page);

  const btn = page.frameLocator('#frame-nav').locator('#btn-nav');
  await expect(btn).toBeVisible({ timeout: 5000 });

  await pressHintFor(page, btn);
  await page.waitForTimeout(300);
  await expect(page.frameLocator('#frame-nav').locator('#btn-nav-count')).toHaveText('1');

  const box = await btn.boundingBox();
  if (!box) {
    throw new Error('버튼을 찾지 못했다');
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await page.waitForTimeout(100);
  await page.mouse.click(x, y);
  await page.waitForTimeout(300);
  await expect(page.frameLocator('#frame-nav').locator('#btn-nav-count')).toHaveText('2');
});

test('다른 출처(other.test) 안 srcdoc 손자 프레임의 버튼도 번호로 정확히 한 번 눌린다', async ({ context }) => {
  const page = await context.newPage();
  await openEditorFrames(page);

  const btn = page.frameLocator('#frame-host').frameLocator('#frame-nested').locator('#btn-nested');
  await pressHintFor(page, btn);
  await page.waitForTimeout(300);

  await expect(page.frameLocator('#frame-host').frameLocator('#frame-nested').locator('#btn-nested-count')).toHaveText('1');
});

test('F를 누른 뒤 모든 장을 넘겨도 한 장 안에서 번호가 겹치지 않고, 편집기 다섯 버튼이 모두 어느 한 장에서 번호표를 받는다 (ELEM-02)', async ({
  context,
}) => {
  const page = await context.newPage();
  await openEditorFrames(page);
  await expect(page.frameLocator('#frame-nav').locator('#btn-nav')).toBeVisible({ timeout: 5000 });

  await pressFUntilLabels(page, 1);
  const chapters: string[][] = [];
  for (;;) {
    chapters.push(await labelTexts(page));
    const hasNext = await page.evaluate(
      () => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.hint-next-card') !== null,
    );
    if (!hasNext) {
      break;
    }
    await page.keyboard.press('Digit0');
    await page.waitForTimeout(100);
  }
  for (const chapter of chapters) {
    expect(new Set(chapter).size, '한 장 안에서 번호가 겹치면 안 된다').toBe(chapter.length);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);

  const targets: Array<[string, Locator]> = [
    ['#btn-srcdoc', page.frameLocator('#frame-srcdoc').locator('#btn-srcdoc')],
    ['#btn-write', page.frameLocator('#frame-write').locator('#btn-write')],
    ['#btn-write-delete', page.frameLocator('#frame-write').locator('#btn-write-delete')],
    ['#btn-nav', page.frameLocator('#frame-nav').locator('#btn-nav')],
    ['#btn-nested', page.frameLocator('#frame-host').frameLocator('#frame-nested').locator('#btn-nested')],
  ];
  for (const [name, locator] of targets) {
    const number = await findHintNumberFor(page, locator);
    expect(number, `${name}가 어느 한 장에서 기본 자리에 번호표를 받아야 한다`).not.toBe('');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
  }
});

test('편집기 iframe 안에서 누른 기록은 맨 위 사이트 출처 키에 쌓이고 presses:null은 생기지 않는다', async ({
  context,
  serviceWorker,
}) => {
  const page = await context.newPage();
  await openEditorFrames(page);

  const srcdocBtn = page.frameLocator('#frame-srcdoc').locator('#btn-srcdoc');
  await pressHintFor(page, srcdocBtn);
  await page.waitForTimeout(300);

  await waitForFrameHelperAlive(page, '#frame-write', '#btn-write');
  const writeBtn = page.frameLocator('#frame-write').locator('#btn-write');
  await pressHintFor(page, writeBtn);
  await page.waitForTimeout(300);

  const nestedBtn = page.frameLocator('#frame-host').frameLocator('#frame-nested').locator('#btn-nested');
  await pressHintFor(page, nestedBtn);
  await page.waitForTimeout(300);

  const allKeys = await serviceWorker.evaluate(async () => {
    const all = await chrome.storage.local.get(null);
    return Object.keys(all);
  });
  expect(allKeys, '맨 위 사이트 출처 키가 있어야 한다').toContain('presses:http://practice.test');
  expect(allKeys, '불투명 출처(null) 키가 생기면 안 된다').not.toContain('presses:null');
});
