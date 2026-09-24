import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type BrowserContext, type Worker } from '@playwright/test';
import { test, expect } from './fixtures';
import { SYNC_ITEM_LIMIT, siteKey, syncItemBytes } from '../../src/core/settings-schema';

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
