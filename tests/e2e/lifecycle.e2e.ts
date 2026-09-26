import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type BrowserContext, type Worker } from '@playwright/test';
import { test, expect } from './fixtures';
import { SYNC_ITEM_LIMIT, defaultSettings, siteKey, syncItemBytes } from '../../src/core/settings-schema';

// D-22·D-24·D-25·D-30(STOR-02): 저장 형식이 바뀌다 실패해도 원본을 지키고 알리며, 동기화 항목
// 8KB 한도를 지킨다. 업데이트·재시작 뒤 옛 도우미가 스스로 물러나고 새 도우미가 한 번만 들어간다.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// fixtures.ts·skeleton.e2e.ts와 같은 이유(Rule 3): global-setup.ts가 CI 여부로 다른 폴더에 짓는다.
const EXTENSION_PATH = path.resolve(
  __dirname,
  process.env.CI === 'true' ? '../../.output/chrome-mv3' : '../../.output/chrome-mv3-dev',
);
const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
const executablePath = browsersPath ? path.join(browsersPath, 'chromium') : undefined;

// 확장 재시작 재현(skeleton.e2e.ts와 같은 결정): 이 샌드박스 헤드리스 크로미움에서는
// chrome.runtime.reload()가 이전 service worker를 끝내기만 하고 새 worker를 관찰 가능하게
// 깨우지 않는다(01-01에서 실측 확인됨) — 같은 사용자 데이터 폴더로 컨텍스트를 다시 여는 쪽이
// 재시작 뒤 onStartup이 실제로 도는 동작을 그대로 재현한다.
async function launchExtension(userDataDir: string): Promise<{ context: BrowserContext; serviceWorker: Worker }> {
  const context = await chromium.launchPersistentContext(userDataDir, {
    ...(executablePath ? { executablePath } : { channel: 'chromium' }),
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  });
  const serviceWorker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await expect.poll(() => serviceWorker.evaluate(() => typeof chrome.storage !== 'undefined')).toBe(true);
  return { context, serviceWorker };
}

async function readSyncKey(serviceWorker: Worker, key: string): Promise<unknown> {
  const stored = await serviceWorker.evaluate((k) => chrome.storage.sync.get(k), key);
  return stored[key];
}

async function readLocalKey(serviceWorker: Worker, key: string): Promise<unknown> {
  const stored = await serviceWorker.evaluate((k) => chrome.storage.local.get(k), key);
  return stored[key];
}

// Task 2: 변환 실패 시 원본 보존·알림(메뉴 경고 카드, 토스트)·크기 한도(D-24, D-25).

test('SW가 settings를 더 높은 형식 버전으로 바꾼 뒤 확장이 다시 시작해도 settings는 그대로고 notice:migration-failed에 newer-version이 남는다', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tremor-helper-lifecycle-'));
  let launched = await launchExtension(userDataDir);

  await expect.poll(() => readSyncKey(launched.serviceWorker, 'settings')).toBeDefined();

  const corrupted = { schemaVersion: 99, data: { corrupted: true } };
  await launched.serviceWorker.evaluate(async (v) => {
    await chrome.storage.sync.set({ settings: v });
  }, corrupted);

  await launched.context.close();
  launched = await launchExtension(userDataDir);

  await expect.poll(() => readLocalKey(launched.serviceWorker, 'notice:migration-failed')).toBeDefined();

  const settingsAfter = await readSyncKey(launched.serviceWorker, 'settings');
  expect(settingsAfter).toEqual(corrupted);

  const notice = (await readLocalKey(launched.serviceWorker, 'notice:migration-failed')) as {
    data: { key: string; reason: string };
  };
  expect(notice.data.key).toBe('settings');
  expect(notice.data.reason).toBe('newer-version');

  await launched.context.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

test('enabled: "yes"처럼 잘못된 v1 값도 재시작 뒤 그대로 보존되고 notice에 invalid가 남는다', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tremor-helper-lifecycle-'));
  let launched = await launchExtension(userDataDir);

  await expect.poll(() => readSyncKey(launched.serviceWorker, 'settings')).toBeDefined();

  const existing = (await readSyncKey(launched.serviceWorker, 'settings')) as { schemaVersion: number; data: Record<string, unknown> };
  const corrupted = { ...existing, data: { ...existing.data, enabled: 'yes' } };
  await launched.serviceWorker.evaluate(async (v) => {
    await chrome.storage.sync.set({ settings: v });
  }, corrupted);

  await launched.context.close();
  launched = await launchExtension(userDataDir);

  await expect.poll(() => readLocalKey(launched.serviceWorker, 'notice:migration-failed')).toBeDefined();

  const settingsAfter = await readSyncKey(launched.serviceWorker, 'settings');
  expect(settingsAfter).toEqual(corrupted);

  const notice = (await readLocalKey(launched.serviceWorker, 'notice:migration-failed')) as {
    data: { key: string; reason: string };
  };
  expect(notice.data.key).toBe('settings');
  expect(notice.data.reason).toBe('invalid');

  await launched.context.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

// 아래 세 시험은 알림을 "쓰는 쪽"이 아니라 "읽는 쪽"(content.ts·popup/main.ts)을 시험한다 —
// 알림 자체가 실제로 기록되는 경로는 위 두 시험이 이미 확인했으므로, 여기서는 SW가 notice와
// 깨진 settings를 직접 넣어 둔다(시험 준비 코드, 제품 코드 아님).
async function seedMigrationFailure(serviceWorker: Worker): Promise<void> {
  // onInstalled → ensureDefaultSettings()의 get→set 체인이 아직 끝나기 전에 바로 덮어쓰면, 그
  // 체인의 set()이 나중에 끝나 우리가 넣은 깨진 값을 되돌려 버리는 경쟁이 생긴다(재현
  // 확인됨) — 기본값이 먼저 나타나길 기다린 뒤에 깨뜨린다(skeleton.e2e.ts와 같은 이유).
  await expect.poll(() => readSyncKey(serviceWorker, 'settings')).toBeDefined();
  await serviceWorker.evaluate(async () => {
    await chrome.storage.sync.set({ settings: { schemaVersion: 99, data: { corrupted: true } } });
    await chrome.storage.local.set({
      'notice:migration-failed': { schemaVersion: 1, data: { key: 'settings', reason: 'newer-version', at: Date.now() } },
    });
  });
}

const MIGRATION_FAILED_TOAST_TEXT = '설정을 읽지 못해 기본 설정으로 동작해요. 원래 설정은 그대로 두었어요.';
const PRESERVED_ORIGINAL_TEXT = '원래 설정을 지키려고 저장하지 않았어요.';

test('설정 형식 변환이 실패한 상태에서 연습 사이트를 열면 토스트가 뜨고 4초 뒤 사라지며 기본 설정대로 도우미가 켜진다', async ({
  context,
  serviceWorker,
  servePage,
}) => {
  await seedMigrationFailure(serviceWorker);
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');

  async function toastText(): Promise<string | null> {
    return page.evaluate(() => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.toast')?.textContent ?? null);
  }

  await expect.poll(toastText).toBe(MIGRATION_FAILED_TOAST_TEXT);

  await expect
    .poll(() =>
      page.evaluate(
        () => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.mode-indicator')?.textContent ?? null,
      ),
    )
    .toBe('도우미');

  await page.waitForTimeout(4500);
  const toastEl = await page.evaluate(() => {
    const el = document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.toast');
    return el ? el.getAttribute('data-visible') : null;
  });
  expect(toastEl).toBe('false');

  await page.close();
});

test('메뉴에 --warning 경고 카드가 뜨고, 저장이 실패하면 카드 문구가 바뀐다', async ({ serviceWorker, openPopup }) => {
  await seedMigrationFailure(serviceWorker);
  const popup = await openPopup();

  const warningCard = popup.locator('.warning-card');
  await expect(warningCard).toHaveText(MIGRATION_FAILED_TOAST_TEXT);
  await expect(warningCard).toHaveCSS('border-color', 'rgb(138, 90, 0)'); // --warning: #8a5a00

  await popup.getByRole('button', { name: '도우미 끄기' }).click();

  await expect(warningCard).toHaveText(PRESERVED_ORIGINAL_TEXT);
  const settingsAfter = await readSyncKey(serviceWorker, 'settings');
  expect(settingsAfter).toEqual({ schemaVersion: 99, data: { corrupted: true } });

  await popup.close();
});

// F3(/review 사용자 결정): popup/main.ts의 hideWarningCard()가 토글 성공 때마다 지금 떠 있는
// 안내를 종류와 무관하게 지웠다 — 형식 변환 실패(D-25) 경고가 뜬 상태에서 사이트 카드 토글이
// 성공하면(원인이 서로 다른데) 그 경고까지 함께 지워졌다. 토글 성공은 자기(토글) 종류 안내만
// 지운다.
test('F3: 형식 변환 실패 경고가 뜬 상태에서 사이트 카드 토글이 성공해도 경고는 그대로 남는다', async ({
  context,
  serviceWorker,
  openPopup,
  servePage,
}) => {
  await seedMigrationFailure(serviceWorker);
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');
  await expect.poll(() => page.evaluate(() => document.querySelector('tremor-helper-root') !== null)).toBe(true);

  const popup = await openPopup(page);
  const warningCard = popup.locator('.warning-card');
  await expect(warningCard).toHaveText(MIGRATION_FAILED_TOAST_TEXT);

  await popup.getByRole('button', { name: /이 사이트에서 끄기/ }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector('tremor-helper-root') !== null)).toBe(false);

  // 사이트 카드 토글은 성공했지만, 형식 변환 실패 경고는(다른 원인) 그대로 남아야 한다.
  await expect(warningCard).toHaveText(MIGRATION_FAILED_TOAST_TEXT);

  await popup.close();
  await page.close();
});

test('site 항목이 정확히 8192바이트일 때 "이 사이트에서 켜기"로 8193바이트가 되면 쓰기가 거절되고 저장된 값이 그대로다', async ({
  context,
  serviceWorker,
  openPopup,
  servePage,
}) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');

  const origin = 'http://practice.test';
  const key = siteKey(origin);
  const base = { schemaVersion: 1 as const, data: { disabled: true, pins: [{ number: 1 as const, fingerprint: { domPath: '', framePath: [] as string[] } }] } };
  const baseBytes = syncItemBytes(key, base);
  const padLength = SYNC_ITEM_LIMIT - baseBytes;
  expect(padLength).toBeGreaterThanOrEqual(0);
  const padded = {
    ...base,
    data: { ...base.data, pins: [{ number: 1 as const, fingerprint: { domPath: 'x'.repeat(padLength), framePath: [] as string[] } }] },
  };
  expect(syncItemBytes(key, padded)).toBe(SYNC_ITEM_LIMIT);

  await serviceWorker.evaluate(async ({ k, v }) => {
    await chrome.storage.sync.set({ [k]: v });
  }, { k: key, v: padded });

  const popup = await openPopup(page);
  const siteCard = popup.getByRole('button', { name: /이 사이트에서 켜기/ });
  await expect(siteCard).toBeVisible();
  await siteCard.click();

  await popup.waitForTimeout(300);
  const stored = await readSyncKey(serviceWorker, key);
  expect(stored).toEqual(padded);

  await popup.close();
  await page.close();
});

test('WR-08: settings 키가 아예 없어도(동기화 초기화 등) "도우미 끄기"가 영원히 막히지 않는다', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tremor-helper-lifecycle-'));
  let launched = await launchExtension(userDataDir);

  await expect.poll(() => readSyncKey(launched.serviceWorker, 'settings')).toBeDefined();

  // 동기화 초기화·onInstalled 미완료 등으로 settings 키 자체가 사라진 상태를 흉내 낸다(값이
  // 깨진 게 아니라 아예 없는 것 — corrupted 시험들과 다르다).
  await launched.serviceWorker.evaluate(async () => {
    await chrome.storage.sync.remove('settings');
  });

  await launched.context.close();
  launched = await launchExtension(userDataDir);

  // onInstalled의 ensureDefaultSettings()가 다시 채워 넣기 전에 곧바로 지운다 — "한 번도 안
  // 써진 것"과 "값이 있었는데 방금 사라진 것"을 구분하지 않는 코드 경로를 시험한다.
  await expect.poll(() => readSyncKey(launched.serviceWorker, 'settings')).toBeDefined();
  await launched.serviceWorker.evaluate(async () => {
    await chrome.storage.sync.remove('settings');
  });
  await expect.poll(() => readSyncKey(launched.serviceWorker, 'settings')).toBeUndefined();

  const extensionId = new URL(launched.serviceWorker.url()).host;
  const popup = await launched.context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('button', { name: '도우미 끄기' }).click();

  await expect
    .poll(async () => {
      const settings = (await readSyncKey(launched.serviceWorker, 'settings')) as { data?: { enabled?: boolean } } | undefined;
      return settings?.data?.enabled;
    }, 'settings 키가 없다는 이유만으로 "도우미 끄기"가 preserved-original로 영원히 거절되면 안 된다')
    .toBe(false);

  await launched.context.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

test('WR-08: 깨진 설정이 스스로 고쳐지면(예: 다른 기기 동기화) 다음 성공한 저장 뒤 옛 알림이 사라진다', async ({ serviceWorker, openPopup }) => {
  await seedMigrationFailure(serviceWorker);
  const popup = await openPopup();
  const warningCard = popup.locator('.warning-card');
  await expect(warningCard).toHaveText(MIGRATION_FAILED_TOAST_TEXT);

  // 다른 기기 동기화가 settings를 다시 올바른 값으로 되돌렸다고 흉내 낸다.
  await serviceWorker.evaluate(async (value) => {
    await chrome.storage.sync.set({ settings: value });
  }, defaultSettings());

  // 아무 저장 요청이나 보내 readAndValidateSettings가 다시 성공하게 만든다.
  await popup.getByRole('button', { name: '도우미 끄기' }).click();

  await expect
    .poll(async () => {
      const stored = await serviceWorker.evaluate(() => chrome.storage.local.get('notice:migration-failed'));
      return stored['notice:migration-failed'];
    }, '설정이 스스로 고쳐진 뒤에는 옛 알림이 남아 있으면 안 된다')
    .toBeUndefined();

  await popup.close();
});

// Task 3: 옛 도우미 자기 정리와 업데이트 직후 새 도우미 넣기(D-22).
//
// 알려진 한계(RESEARCH.md Pattern 6, 01-01·01-14 실측): 이 샌드박스 헤드리스 크로미움의
// chrome.runtime.reload()는 예전 SW를 끝내기만 할 뿐 새 worker를 관찰 가능하게 깨우지 않고
// (context.waitForEvent('serviceworker')가 뜨지 않는다), onInstalled도 실제 갱신처럼 다시
// 돌지 않는다 — 그래서 "재시작 뒤 새 도우미가 다시 들어간다"의 방아쇠 자체를 reload()로는
// 재현할 수 없다. 아래는 production 코드가 실제로 쓰는 chrome.scripting.executeScript
// 재주입 경로를 시험이 직접 불러 "이미 열린 탭에 두 번째 content script가 들어가도 호스트는
// 하나"를 검증한다(injectContentScriptIntoOpenTabs와 같은 API 호출, background.ts:114).
// 다만 진짜 확장 업데이트라면 크롬이 옛 컨텍스트의 chrome.runtime.id 자체를 무효화하는데,
// 이 재주입 호출만으로는 옛 인스턴스가 진짜로 무효화되지 않는다 — 그래서 "옛 리스너가 완전히
// 멎는다"까지는 이 샌드박스에서 끝까지 확인할 수 없다(Known Gap, SUMMARY.md에 기록).

async function helperRootCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => document.querySelectorAll('tremor-helper-root').length);
}

// production의 injectContentScriptIntoOpenTabs와 같은 API 호출을 시험에서 직접 부른다
// (background.ts가 onInstalled reason:'update'일 때 이미 열린 탭에 하는 일과 동일).
async function reinjectContentScript(serviceWorker: Worker, urlPrefix: string): Promise<void> {
  await serviceWorker.evaluate(async (prefix) => {
    const manifest = chrome.runtime.getManifest();
    const files = manifest.content_scripts?.[0]?.js ?? [];
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((t) => t.url?.startsWith(prefix));
    if (!tab || tab.id === undefined) {
      throw new Error('대상 탭을 찾지 못했다');
    }
    await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files });
  }, urlPrefix);
}

test('업데이트로 이미 열린 탭에 content script가 다시 들어가도 tremor-helper-root 호스트는 정확히 1개다', async ({
  context,
  serviceWorker,
  servePage,
}) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');
  await expect.poll(() => helperRootCount(page)).toBe(1);

  await reinjectContentScript(serviceWorker, 'http://practice.test/');
  await page.waitForTimeout(300);

  await expect.poll(() => helperRootCount(page)).toBe(1);
  await page.close();
});

// SW가 유휴에 들어 alive 포트가 끊겨도(쉬었다 깬 것뿐) 도우미는 걷히지 않는다 — disconnectAlivePorts
// 훅을 `?.()`가 아니라 그대로 불러, 훅이 없으면(구현 전) evaluate 자체가 던져 실패한다(RED 보장).
test('SW 포트가 끊겨도(쉬었다 깬 것 흉내) 확장이 살아 있으면 도우미는 걷히지 않는다', async ({ context, serviceWorker, servePage }) => {
  servePage('http://practice.test/', '<!doctype html><html><body><h1>연습 사이트</h1></body></html>');
  const page = await context.newPage();
  await page.goto('http://practice.test/');
  await expect.poll(() => helperRootCount(page)).toBe(1);

  await serviceWorker.evaluate(() => {
    (globalThis as unknown as { disconnectAlivePorts: () => void }).disconnectAlivePorts();
  });
  await page.waitForTimeout(500);

  await expect.poll(() => helperRootCount(page)).toBe(1);
  await page.close();
});

// CR-08: relay.ts는 reportsByTab을 메모리에만 들고 있다 — SW가 유휴에서 다시 시작하면(약 30초
// 무동작) 이 상태가 통째로 사라진다(content script는 그대로 살아 있다 — 프레임은 재시작되지
// 않는다). 각 프레임의 collector는 보고 JSON이 안 바뀌면 다시 보내지 않으므로(보고 폭주 방지),
// 재시작 뒤 처음 다시 보고하는 프레임(대개 맨 위, 평범한 스크롤로 맨 위의 iframe 오프셋만
// 바뀌어도 촉발됨)이 탭의 전체 보고 목록을 자기 하나로 통째로 덮어써 자식 프레임 항목이 번호표에서
// 사라진다. resetRelayForE2E·disconnectAlivePorts는 e2e 전용 시험 훅으로, 실제 SW 재시작이
// relay 메모리를 지우고 alive 포트를 끊는 두 효과를 함께 흉내 낸다. 맨 위 1개 + 자식 프레임 1개
// 뿐인 최소 페이지를 직접 등록해 danger.html처럼 항목이 9개 넘는 페이지의 "한 장(chapter)엔
// 최대 9개" 상한과 뒤섞이지 않게 한다.
test('CR-08: SW가 유휴에서 다시 시작한 뒤(+평범한 스크롤) 자식 프레임 번호표 항목이 사라지지 않는다', async ({
  context,
  serviceWorker,
  servePage,
}) => {
  servePage(
    'http://practice.test/cr08-top.html',
    '<!doctype html><html><body style="margin:0">' +
      '<button id="top-btn" style="position:absolute;left:0;top:50px;width:60px;height:30px">위</button>' +
      '<iframe id="child-frame" src="http://other.test/cr08-child.html" ' +
      'style="position:absolute;left:300px;top:50px;width:200px;height:100px;border:0"></iframe>' +
      // 스크롤이 실제로 일어나려면 페이지가 뷰포트보다 커야 한다 — 보이는 배치는 안 바꾼다.
      '<div style="position:absolute;left:0;top:2000px;height:10px">spacer</div>' +
      '</body></html>',
  );
  servePage(
    'http://other.test/cr08-child.html',
    '<!doctype html><html><body style="margin:0">' +
      '<button id="child-btn" style="position:absolute;left:0;top:0;width:60px;height:30px">아래</button>' +
      '</body></html>',
  );

  const page = await context.newPage();
  await page.goto('http://practice.test/cr08-top.html');

  async function indicatorText(): Promise<string> {
    return page.evaluate(
      () => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.mode-indicator')?.textContent ?? '',
    );
  }
  await expect.poll(indicatorText).toBe('도우미');

  async function labelCount(): Promise<number> {
    return page.evaluate(() => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelectorAll('.hint-label').length ?? 0);
  }

  // frames.e2e.ts·confirm.e2e.ts와 같은 재시도 방식으로 프레임 보고 왕복(비동기)을 기다린다.
  async function pressFUntilLabelCount(expectedCount: number): Promise<boolean> {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await page.keyboard.press('KeyF');
      await page.waitForTimeout(150);
      if ((await labelCount()) >= expectedCount) {
        return true;
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(350);
    }
    return false;
  }

  expect(await pressFUntilLabelCount(2), '맨 위 1개 + 자식 프레임 1개, 모두 2개가 한 번은 모여야 한다').toBe(true);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);

  // SW가 유휴에서 다시 시작한 것을 흉내 낸다: relay의 메모리 상태가 통째로 사라지고, alive
  // 포트가 끊겼다 다시 연결된다.
  await serviceWorker.evaluate(() => {
    (globalThis as unknown as { resetRelayForE2E: () => void }).resetRelayForE2E();
  });
  await serviceWorker.evaluate(() => {
    (globalThis as unknown as { disconnectAlivePorts: () => void }).disconnectAlivePorts();
  });
  await page.waitForTimeout(600);

  // 평범한 페이지 스크롤 — 자식 프레임 내용 자체는 안 바뀌지만 맨 위 프레임이 보는 iframe
  // 오프셋이 바뀌어 맨 위가 다시 보고한다(review 재현 조건, "a plain page scroll is enough").
  await page.mouse.wheel(0, 20);
  await page.waitForTimeout(500);

  expect(
    await pressFUntilLabelCount(2),
    'SW 재시작+스크롤 뒤에도 자식 프레임 항목이 번호표에서 사라지면 안 된다',
  ).toBe(true);

  await page.close();
});
