import { test, expect } from './fixtures';
import type { Page, Worker } from '@playwright/test';

// D-20(SAFE-04)·D-21(SAFE-05)·D-23·D-24(STOR-01): 지금 사이트에서만 끄기와 확장이 동작하지 않는
// 페이지의 "도울 수 없음" 표시. 연습 사이트는 servePage가 등록하는 로컬 고정물이다(D-28).

// 지금 활성 탭의 확장 아이콘 제목·배지를 SW 안에서 직접 읽는다(별도로 tabId를 주고받지 않는다 —
// active 탭을 찾는 것 자체가 background.ts가 하는 일과 같은 필터라 시험도 그대로 재사용한다).
async function activeTabTitle(serviceWorker: Worker): Promise<string> {
  return serviceWorker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ active: true });
    const tabId = tabs[0]?.id;
    return tabId === undefined ? '' : chrome.action.getTitle({ tabId });
  });
}

async function activeTabBadge(serviceWorker: Worker): Promise<string> {
  return serviceWorker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ active: true });
    const tabId = tabs[0]?.id;
    return tabId === undefined ? '' : chrome.action.getBadgeText({ tabId });
  });
}

test('chrome://version 탭을 활성으로 하면 아이콘 제목이 "도울 수 없음", 배지가 "없음"이다', async ({
  context,
  serviceWorker,
}) => {
  const page = await context.newPage();
  await page.goto('chrome://version');

  await expect.poll(() => activeTabTitle(serviceWorker)).toBe('도울 수 없음');
  await expect.poll(() => activeTabBadge(serviceWorker)).toBe('없음');
  await page.close();
});

test('연습 사이트 탭은 아이콘 제목이 "손 떨림 도우미", 배지가 ""이다', async ({ context, serviceWorker, servePage }) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');

  await expect.poll(() => activeTabTitle(serviceWorker)).toBe('손 떨림 도우미');
  await expect.poll(() => activeTabBadge(serviceWorker)).toBe('');
  await page.close();
});

test('chrome://version 탭을 대상으로 연 메뉴에 "도울 수 없음" 안내가 뜨고 카드 2(이 사이트에서 끄기)는 없다', async ({
  context,
  openPopup,
}) => {
  const page = await context.newPage();
  await page.goto('chrome://version');

  const popup = await openPopup(page);
  await expect(popup.getByText('이 페이지에서는 도울 수 없어요. 다른 탭에서 쓰세요.')).toBeVisible();
  await expect(popup.getByRole('button', { name: /이 사이트에서/ })).toHaveCount(0);

  await popup.close();
  await page.close();
});

// Task 3: 지금 사이트에서만 끄기·사이트별 동기화 항목·쓰기 합치기(D-20, D-23, D-24, T-01-36~39).

async function hasHelperRoot(page: Page): Promise<boolean> {
  return page.evaluate(() => document.querySelector('tremor-helper-root') !== null);
}

async function waitForHelperReady(page: Page): Promise<void> {
  await expect.poll(() => hasHelperRoot(page)).toBe(true);
}

async function readSiteEntry(
  serviceWorker: Worker,
  origin: string,
): Promise<{ schemaVersion: number; data: { disabled: boolean; pins: unknown[] } } | undefined> {
  const key = `site:${origin}`;
  const stored = await serviceWorker.evaluate((k) => chrome.storage.sync.get(k), key);
  return stored[key] as { schemaVersion: number; data: { disabled: boolean; pins: unknown[] } } | undefined;
}

test('연습 사이트 탭에서 "이 사이트에서 끄기"를 누르면 site:http://practice.test가 꺼지고 그 탭만 사라지며 다른 사이트 탭은 그대로다', async ({
  context,
  serviceWorker,
  openPopup,
  servePage,
}) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  servePage('http://other.test/', '<!doctype html><html><body><h1>다른 사이트</h1></body></html>');

  const practicePage = await context.newPage();
  await practicePage.goto('http://practice.test/');
  await waitForHelperReady(practicePage);

  const otherPage = await context.newPage();
  await otherPage.goto('http://other.test/');
  await waitForHelperReady(otherPage);

  const popup = await openPopup(practicePage);
  await popup.getByRole('button', { name: /이 사이트에서 끄기/ }).click();

  await expect.poll(async () => (await readSiteEntry(serviceWorker, 'http://practice.test'))?.data.disabled).toBe(true);
  await expect.poll(() => hasHelperRoot(practicePage)).toBe(false);
  await expect.poll(() => hasHelperRoot(otherPage)).toBe(true);

  await popup.close();
  await practicePage.close();
  await otherPage.close();
});

test('다시 "이 사이트에서 켜기"를 누르면 도우미가 돌아온다', async ({ context, openPopup, servePage }) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');
  await waitForHelperReady(page);

  const popup = await openPopup(page);
  await popup.getByRole('button', { name: /이 사이트에서 끄기/ }).click();
  await expect.poll(() => hasHelperRoot(page)).toBe(false);

  // WR-06: 같은 카드를 다시 누르는 것 — 떨림 두 번 탭과 구분되도록 간격을 띄운다.
  await popup.waitForTimeout(350);
  await popup.getByRole('button', { name: /이 사이트에서 켜기/ }).click();
  await expect.poll(() => hasHelperRoot(page)).toBe(true);

  await popup.close();
  await page.close();
});

test('SW가 미리 pins를 넣어 둔 상태에서 끄고 켜도 pins가 그대로다', async ({ context, serviceWorker, openPopup, servePage }) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');
  await waitForHelperReady(page);

  const pins = [{ number: 1, fingerprint: { domPath: 'body>button', framePath: [] } }];
  await serviceWorker.evaluate(async (p) => {
    await chrome.storage.sync.set({
      'site:http://practice.test': { schemaVersion: 1, data: { disabled: false, pins: p } },
    });
  }, pins);

  const popup = await openPopup(page);
  await popup.getByRole('button', { name: /이 사이트에서 끄기/ }).click();
  await expect.poll(() => hasHelperRoot(page)).toBe(false);
  // WR-06: 같은 카드를 다시 누르는 것 — 떨림 두 번 탭과 구분되도록 간격을 띄운다.
  await popup.waitForTimeout(350);
  await popup.getByRole('button', { name: /이 사이트에서 켜기/ }).click();
  await expect.poll(() => hasHelperRoot(page)).toBe(true);

  const entry = await readSiteEntry(serviceWorker, 'http://practice.test');
  expect(entry?.data.pins).toEqual(pins);

  await popup.close();
  await page.close();
});

// 오버레이(tremor-helper-root)는 맨 위 프레임에만 있다(자식 프레임 요소도 맨 위 좌표계에
// 그린다, frame-tree.ts) — 자식 프레임 자신의 켜짐 상태는 frame/state 보고(frameStates)로 본다
// (helper-toggle.e2e.ts와 같은 방식).
async function readFrameStates(serviceWorker: Worker, urlPattern: string): Promise<boolean[]> {
  const tabs = await serviceWorker.evaluate((pattern) => chrome.tabs.query({ url: pattern }), urlPattern);
  const tabId = tabs[0]?.id;
  if (tabId === undefined) {
    return [];
  }
  return serviceWorker.evaluate((id) => {
    const store = (globalThis as unknown as { frameStates?: Record<number, Record<number, boolean>> }).frameStates;
    const tabFrames = store?.[id] ?? {};
    return Object.values(tabFrames);
  }, tabId);
}

test('practice.test 안의 other.test iframe도 practice.test를 끄면 도우미가 꺼진다(사이트 = 맨 위 페이지 출처)', async ({
  context,
  serviceWorker,
  openPopup,
  serveFramedPracticePage,
}) => {
  serveFramedPracticePage();
  const page = await context.newPage();
  await page.goto('http://practice.test/');
  await waitForHelperReady(page);

  await expect
    .poll(async () => {
      const states = await readFrameStates(serviceWorker, 'http://practice.test/*');
      return states.length >= 3 && states.every((v) => v);
    })
    .toBe(true);

  const popup = await openPopup(page);
  await popup.getByRole('button', { name: /이 사이트에서 끄기/ }).click();

  await expect.poll(() => hasHelperRoot(page)).toBe(false);
  await expect
    .poll(async () => {
      const states = await readFrameStates(serviceWorker, 'http://practice.test/*');
      return states.length >= 3 && states.every((v) => !v);
    })
    .toBe(true);

  await popup.close();
  await page.close();
});

test('CR-03: 이 사이트에서 끄기를 누르면 입력 파이프라인도 꺼져 자동 반복 키와 빠른 재클릭이 그대로 사이트에 간다', async ({
  context,
  openPopup,
}) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/input.html');
  await waitForHelperReady(page);

  const popup = await openPopup(page);
  await popup.getByRole('button', { name: /이 사이트에서 끄기/ }).click();
  await expect.poll(() => hasHelperRoot(page)).toBe(false);
  await popup.close();

  // 빠른 재클릭(100ms 안) — 도우미가 켜져 있으면 하나로 줄었을 클릭이 둘 다 간다.
  const box = await page.locator('#btn-a').boundingBox();
  if (!box) {
    throw new Error('버튼 위치를 찾지 못했다');
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await page.waitForTimeout(100);
  await page.mouse.click(x, y);
  await expect(page.locator('#count-a')).toHaveText('2');

  // 자동 반복 키 — 도우미가 켜져 있으면 한 글자로 줄었을 반복이 그대로 여러 번 간다.
  await page.locator('#name').click();
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.down('b');
  }
  await page.keyboard.up('b');
  await expect(page.locator('#name')).toHaveValue('bbbbb');

  await page.close();
});

test('SW가 site:http://practice.test를 직접 바꾸면(다른 PC 동기화 흉내) 1초 안에 따른다', async ({
  context,
  serviceWorker,
  servePage,
}) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');
  await waitForHelperReady(page);

  await serviceWorker.evaluate(async () => {
    await chrome.storage.sync.set({
      'site:http://practice.test': { schemaVersion: 1, data: { disabled: true, pins: [] } },
    });
  });

  await expect.poll(() => hasHelperRoot(page)).toBe(false);
  await page.close();
});

// 계획의 가정("CSP: sandbox 최상위 문서에는 content script가 들어가지 않는다")은 실측과
// 달랐다(01-13 systematic-debugging, 편차로 SUMMARY에 기록): 확장 content script는 isolated
// world에서 실행되어 페이지 자신의 CSP(sandbox 포함)에 영향받지 않는다 — 헤더가 실제로
// 응답에 실렸는지(route 확인), site/ping에 여전히 { ok: true }로 답하는지 직접 확인했다. 그래서
// 이 시험은 "여전히 도울 수 있음"을 확인하고, 응답 없음 판정의 "보내기가 실패하면" 경로
// (RESEARCH.md "Open Questions (RESOLVED)" 6번)는 같은 시험 안에서 탭을 닫은 뒤 site/ping을
// 보내 chrome.tabs.sendMessage가 거절되는지로 확인한다(이 시험 환경에서 결정적으로 재현할 수
// 있는 유일한 방법 — "1초 안에 답이 없거나" 쪽은 재현 방법을 찾지 못해 SUMMARY에 남긴다).
test('Content-Security-Policy: sandbox 머리글이 있어도 content script는 isolated world라 영향받지 않고 여전히 도울 수 있다(+ 닫힌 탭은 보내기 실패로 거절된다)', async ({
  context,
  serviceWorker,
  servePage,
}) => {
  servePage(
    'http://practice.test/sandboxed.html',
    '<!doctype html><html><body><h1>격리된 페이지</h1></body></html>',
    { 'Content-Security-Policy': 'sandbox' },
  );
  const page = await context.newPage();
  const response = await page.goto('http://practice.test/sandboxed.html');
  expect(response?.headers()['content-security-policy']).toBe('sandbox');

  await expect.poll(() => activeTabTitle(serviceWorker)).toBe('손 떨림 도우미');
  await expect.poll(() => activeTabBadge(serviceWorker)).toBe('');

  const tabs = await serviceWorker.evaluate(() => chrome.tabs.query({ url: 'http://practice.test/*' }));
  const tabId = tabs[0]?.id;
  if (tabId === undefined) {
    throw new Error('practice.test 탭을 찾지 못했다');
  }
  await page.close();

  const rejected = await serviceWorker.evaluate(async (id) => {
    try {
      await chrome.tabs.sendMessage(id, { type: 'site/ping' }, { frameId: 0 });
      return false;
    } catch {
      return true;
    }
  }, tabId);
  expect(rejected).toBe(true);
});

test('메뉴에서 150번 빠르게 끄고 켜기를 번갈아 보낸 뒤 최종 disabled가 마지막 요청과 같고 오류가 없다', async ({
  context,
  serviceWorker,
  openPopup,
  servePage,
}) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');
  await waitForHelperReady(page);

  const tabs = await serviceWorker.evaluate(() => chrome.tabs.query({ url: 'http://practice.test/*' }));
  const tabId = tabs[0]?.id;
  if (tabId === undefined) {
    throw new Error('practice.test 탭을 찾지 못했다');
  }

  const popup = await openPopup(page);
  const results = await popup.evaluate(async (id) => {
    const origin = 'http://practice.test';
    const promises = Array.from({ length: 150 }, (_, i) =>
      chrome.runtime.sendMessage({
        type: 'storage/request',
        op: { kind: 'setSiteDisabled', origin, disabled: i % 2 === 0, tabId: id },
      }),
    );
    return Promise.all(promises);
  }, tabId);

  expect(results.every((r) => (r as { ok?: boolean }).ok === true)).toBe(true);

  const entry = await readSiteEntry(serviceWorker, 'http://practice.test');
  // 149번째(마지막, index 149, 짝수 아님) 요청의 disabled 값과 최종 상태가 같아야 한다.
  expect(entry?.data.disabled).toBe(false);

  await popup.close();
  await page.close();
});

test('WR-07: storage.sync.set이 거부돼도(예: 할당량 초과) 사이트별 끄기 대기열이 막히지 않는다', async ({
  context,
  serviceWorker,
  openPopup,
  servePage,
}) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');
  await waitForHelperReady(page);

  const tabId = await serviceWorker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ url: 'http://practice.test/*' });
    return tabs[0]?.id;
  });
  if (tabId === undefined) {
    throw new Error('practice.test 탭을 찾지 못했다');
  }

  // 첫 번째 storage.sync.set만 거부되도록 흉내 낸다(할당량 초과 등 현실적인 실패) — 그 뒤로는
  // 원래대로 동작한다.
  await serviceWorker.evaluate(() => {
    const original = chrome.storage.sync.set.bind(chrome.storage.sync);
    let failedOnce = false;
    chrome.storage.sync.set = (items: Record<string, unknown>) => {
      if (!failedOnce) {
        failedOnce = true;
        return Promise.reject(new Error('시험: 할당량 초과 흉내'));
      }
      return original(items);
    };
  });

  // chrome.runtime은 확장 페이지(팝업)의 주 세계에서만 접근할 수 있다 — 연습 페이지의
  // page.evaluate는 격리된 content script 세계 밖(일반 페이지 주 세계)이라 쓸 수 없다.
  const popup = await openPopup(page);

  async function sendSetSiteDisabled(disabled: boolean): Promise<unknown> {
    return popup.evaluate(
      ({ disabled, tabId }) =>
        Promise.race([
          chrome.runtime.sendMessage({
            type: 'storage/request',
            op: { kind: 'setSiteDisabled', origin: 'http://practice.test', disabled, tabId },
          }),
          new Promise((resolve) => {
            setTimeout(() => {
              resolve('TIMEOUT');
            }, 2000);
          }),
        ]),
      { disabled, tabId },
    );
  }

  // 첫 번째 요청 — storage.sync.set이 거부되어 실패해야 한다(멈추지 않고 응답은 와야 한다).
  const first = await sendSetSiteDisabled(true);
  expect(first, '거부된 쓰기도 응답이 와야 한다(멈추면 안 된다)').not.toBe('TIMEOUT');

  // 두 번째 요청 — 첫 번째가 대기열을 막았다면(state.writing이 영원히 true로 남으면) 이것도
  // 응답이 안 온다.
  const second = await sendSetSiteDisabled(false);
  expect(second, '첫 요청이 실패해도 다음 요청이 대기열에서 막히면 안 된다').not.toBe('TIMEOUT');
  expect((second as { ok?: boolean } | undefined)?.ok).toBe(true);

  await popup.close();
  await page.close();
});

// Task 2(01-18, IN-04, SAFE-04): site/query가 실패해도 "이 사이트에서 끄기"는 fail-open되지
// 않는다 — 맨 위는 site/query 없이 자기 출처로 안다(항상 적용), 자식 프레임은 재시도하고 실패가
// 이어지는 동안 fail-closed하며 알린다.

async function failSiteQueryForE2E(serviceWorker: Worker, count: number): Promise<void> {
  await serviceWorker.evaluate((c) => {
    (globalThis as unknown as { failSiteQueryForE2E: (n: number) => void }).failSiteQueryForE2E(c);
  }, count);
}

// readFrameStates(위)는 Object.values만 돌려줘 frameId 0(맨 위)과 자식을 구분하지 못한다 —
// frameId로 찾아야 하는 시험을 위한 도우미.
async function readFrameStatesByFrameId(serviceWorker: Worker, urlPattern: string): Promise<Record<number, boolean>> {
  const tabs = await serviceWorker.evaluate((pattern) => chrome.tabs.query({ url: pattern }), urlPattern);
  const tabId = tabs[0]?.id;
  if (tabId === undefined) {
    return {};
  }
  return serviceWorker.evaluate((id) => {
    const store = (globalThis as unknown as { frameStates?: Record<number, Record<number, boolean>> }).frameStates;
    return store?.[id] ?? {};
  }, tabId);
}

test('맨 위 프레임의 "이 사이트에서 끄기"는 site/query가 실패해도 적용된다(IN-04, 맨 위는 자기 출처로 안다)', async ({
  context,
  serviceWorker,
}) => {
  await failSiteQueryForE2E(serviceWorker, 1000);
  await serviceWorker.evaluate(async () => {
    await chrome.storage.sync.set({
      'site:http://practice.test': { schemaVersion: 1, data: { disabled: true, pins: [] } },
    });
  });

  const page = await context.newPage();
  await page.goto('http://practice.test/frames.html');

  await expect.poll(() => hasHelperRoot(page), { timeout: 5000 }).toBe(false);
  await expect
    .poll(async () => (await readFrameStatesByFrameId(serviceWorker, 'http://practice.test/*'))[0], { timeout: 5000 })
    .toBe(false);

  await page.close();
});

test('IN-04: site/query가 계속 실패하면 자식 프레임은 fail-closed하고 알리며, 회복되면 설정을 따른다', async ({
  context,
  serviceWorker,
}) => {
  await failSiteQueryForE2E(serviceWorker, 1000);

  const page = await context.newPage();
  await page.goto('http://practice.test/frames.html');

  // 맨 위(frameId 0)는 site/query와 무관하게 즉시 안다 — 아직 사이트 항목이 없으니(켜짐) true.
  await expect.poll(() => hasHelperRoot(page), { timeout: 5000 }).toBe(true);

  // frameId 0이 아닌 모든 자식 프레임은 site/query가 계속 실패해 fail-closed(false)한다.
  await expect
    .poll(
      async () => {
        const states = await readFrameStatesByFrameId(serviceWorker, 'http://practice.test/*');
        const nonTop = Object.entries(states).filter(([frameId]) => frameId !== '0');
        return nonTop.length >= 4 && nonTop.every(([, enabled]) => !enabled);
      },
      { timeout: 5000 },
    )
    .toBe(true);

  // #frame-cross(other.test)의 shadow root 안 .toast에 "사이트 설정을 다시 읽는 동안"이 뜬다.
  await expect
    .poll(
      () =>
        page
          .frameLocator('#frame-cross')
          .locator(':root')
          .evaluate(() => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.toast')?.textContent ?? null),
      { timeout: 5000 },
    )
    .toContain('사이트 설정을 다시 읽는 동안');

  // 그 프레임 도우미가 꺼져 있으니 100ms 간격 두 번 클릭이 필터 없이 그대로 둘 다 간다(+2).
  const crossBtn = page.frameLocator('#frame-cross').locator('#btn-cross');
  await crossBtn.click();
  await page.waitForTimeout(100);
  await crossBtn.click();
  await expect(page.frameLocator('#frame-cross').locator('#cross-count')).toHaveText('2');

  // 회복: site/query가 다시 성공하면(사이트 항목 없음 = 켜짐) 모든 프레임이 설정을 따른다.
  await failSiteQueryForE2E(serviceWorker, 0);
  await expect
    .poll(
      async () => {
        const states = await readFrameStatesByFrameId(serviceWorker, 'http://practice.test/*');
        const values = Object.values(states);
        return values.length >= 5 && values.every((enabled) => enabled);
      },
      { timeout: 10000 },
    )
    .toBe(true);

  // 회복 뒤에는 다시 필터가 돈다 — 100ms 두 번 클릭은 한 번으로 줄어(+1만 더해 총 3).
  await page.waitForTimeout(400);
  await crossBtn.click();
  await page.waitForTimeout(100);
  await crossBtn.click();
  await expect(page.frameLocator('#frame-cross').locator('#cross-count')).toHaveText('3');

  await page.close();
});

test('IN-04: 문서 다시 쓰기로 새로 생긴 자식 프레임에서도 옛 인스턴스의 site/query 재시도 이어짐은 조용하다', async ({
  context,
  serviceWorker,
  servePage,
}) => {
  await failSiteQueryForE2E(serviceWorker, 1000);

  // 01-17 editor-frames.e2e.ts "document.write로 채운 프레임이 막 생겨도 옛 인스턴스는
  // 조용하다"와 같은 fixture 패턴 — 인라인 스크립트가 iframe 하나를 붙이자마자 open/write/close로
  // 버튼을 쓴다(CKEditor 4 classic이 편집 영역을 만드는 방식).
  servePage(
    'http://practice.test/site-write-child.html',
    '<!doctype html><body style="margin:0">' +
      '<iframe id="frame-w" title="document.write 자식" style="width:300px;height:140px;border:1px solid #999"></iframe>' +
      '<script>' +
      'var f=document.getElementById("frame-w");' +
      "var d=f.contentWindow.document;d.open();d.write('" +
      '<!doctype html><meta charset="utf-8"><body style="margin:0">' +
      '<button id="btn-w">w</button>' +
      "');d.close();" +
      '</script>' +
      '</body>',
  );

  const page = await context.newPage();
  await page.goto('http://practice.test/site-write-child.html');
  await page.waitForTimeout(3500);

  const hostCount = await page.frameLocator('#frame-w').locator('tremor-helper-root').count();
  expect(hostCount, '옛 인스턴스가 정리 뒤에도 늦게 도착한 실패로 새 호스트를 만들면 안 된다').toBe(1);

  // document.write로 다시 쓴 프레임은 최초 src 없는 about:blank 그대로 남아 page.frames()의
  // url()로 찾을 수 없다 — #frame-w 요소로 스코프한 frameLocator 안에서 evaluate한다.
  const toastCount = await page.frameLocator('#frame-w').locator(':root').evaluate(
    () => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelectorAll('.toast').length ?? 0,
  );
  expect(toastCount, '옛 인스턴스가 늦게 도착한 실패로 토스트를 더 만들면 안 된다').toBe(1);

  await page.close();
});

// WR-05(01-REVIEW.md): createSiteCard의 onToggle은 render(next) 뒤 SW 응답을 보지 않는다 —
// SW가 setSiteDisabled를 거절해도(예: 저장된 site 항목이 검사에 실패해 invalid-site) 카드 문구는
// 낙관적으로 바뀐 채 남아 실제로는 켜져 있는데 꺼졌다고 보여 준다. 응답의 ok가 true가 아니면
// 되돌린다.
test('SW가 setSiteDisabled를 거절하면(저장된 site 항목이 깨짐) 카드 문구가 실제 상태로 되돌아간다(WR-05)', async ({
  context,
  serviceWorker,
  openPopup,
  servePage,
}) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');
  await waitForHelperReady(page);

  // storage-writer.ts writeSiteDisabledOnce의 invalid-site 경로를 실제로 밟게 한다(검사 실패 —
  // 아무것도 쓰지 않고 거절).
  await serviceWorker.evaluate(async () => {
    await chrome.storage.sync.set({ 'site:http://practice.test': { not: 'valid' } });
  });

  const popup = await openPopup(page);
  await popup.getByRole('button', { name: /이 사이트에서 끄기/ }).click();

  await expect(popup.getByRole('button', { name: /이 사이트에서 끄기/ })).toBeVisible();
  await expect.poll(() => hasHelperRoot(page)).toBe(true);

  await popup.close();
  await page.close();
});
