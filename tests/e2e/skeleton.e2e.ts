import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, chromium, type BrowserContext, type Worker } from '@playwright/test';
import { SettingsV1 } from '../../src/core/settings-schema';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '../../.output/chrome-mv3');

// 이 샌드박스에는 Playwright가 기대하는 정확한 chromium 리비전이 설치돼 있지 않다(PLAYWRIGHT_BROWSERS_PATH
// 아래 미리 깐 바이너리를 쓴다 — 실행자 안내). PLAYWRIGHT_BROWSERS_PATH가 없는 환경에서는 기본 channel로 되돌아간다.
const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
const executablePath = browsersPath ? path.join(browsersPath, 'chromium') : undefined;

async function launchExtension(userDataDir = ''): Promise<{ context: BrowserContext; serviceWorker: Worker }> {
  const context = await chromium.launchPersistentContext(userDataDir, {
    ...(executablePath ? { executablePath } : { channel: 'chromium' }),
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  });
  const serviceWorker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  return { context, serviceWorker };
}

test('빌드한 확장을 Playwright 크롬에 올리면 service worker가 뜬다', async () => {
  const { context, serviceWorker } = await launchExtension();
  expect(serviceWorker.url()).toContain('background');
  await context.close();
});

test('설치 직후 기본 설정이 형식 버전 1과 함께 storage.sync에 저장된다', async () => {
  const { context, serviceWorker } = await launchExtension();

  // onInstalled의 get→set 체인은 비동기라, SW가 뜬 시점에는 아직 쓰기 전일 수 있다 — 값이 나타날 때까지 기다린다.
  await expect
    .poll(async () => {
      const stored = await serviceWorker.evaluate(async () => chrome.storage.sync.get('settings'));
      return stored.settings;
    })
    .toBeDefined();

  const stored = await serviceWorker.evaluate(async () => chrome.storage.sync.get('settings'));
  const value = stored.settings;

  const parsed = SettingsV1.safeParse(value);
  expect(parsed.success).toBe(true);
  expect((value as { schemaVersion: number }).schemaVersion).toBe(1);

  await context.close();
});

test('이미 settings 값이 있으면 설치 처리가 덮어쓰지 않는다', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tremor-helper-e2e-'));
  let launched = await launchExtension(userDataDir);

  const sentinel = { schemaVersion: 1, data: { marker: 'existing-value-should-survive' } };
  await launched.serviceWorker.evaluate(async (v) => {
    await chrome.storage.sync.set({ settings: v });
  }, sentinel);

  // 확장 재시작(같은 프로필)을 실제로 재현한다: 이 샌드박스의 헤드리스 크로미움에서는
  // `chrome.runtime.reload()`가 이전 service worker를 끝내기만 하고 새 worker를 관찰 가능하게
  // 깨우지 않는다(직접 확인함) — 같은 사용자 데이터 폴더로 컨텍스트를 다시 여는 쪽이 재시작 뒤
  // storage.sync 보존이라는 실제 동작을 그대로 재현한다.
  await launched.context.close();
  launched = await launchExtension(userDataDir);

  const stored = await launched.serviceWorker.evaluate(async () => chrome.storage.sync.get('settings'));
  expect(stored.settings).toEqual(sentinel);

  await launched.context.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});
