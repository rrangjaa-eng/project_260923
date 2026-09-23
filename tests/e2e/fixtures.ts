import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, expect, chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// global-setup.ts가 CI=true면 wxt build(.output/chrome-mv3), 아니면 wxt build --mode
// development(.output/chrome-mv3-dev)로 짓는다 — 두 출력 폴더 이름이 다르므로 여기서도 같은
// 분기를 따라야 방금 지은 빌드를 실제로 올린다(Rule 3: 안 그러면 오래된/없는 폴더를 올린다).
const EXTENSION_PATH = path.resolve(
  __dirname,
  process.env.CI === 'true' ? '../../.output/chrome-mv3' : '../../.output/chrome-mv3-dev',
);
const PRACTICE_SITE_DIR = path.resolve(__dirname, '../practice-site');

// 이 샌드박스에는 Playwright가 기대하는 정확한 chromium 리비전이 설치돼 있지 않다(PLAYWRIGHT_BROWSERS_PATH
// 아래 미리 깐 바이너리를 쓴다 — 실행자 안내). PLAYWRIGHT_BROWSERS_PATH가 없는 환경에서는 기본 channel로 되돌아간다.
const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
const executablePath = browsersPath ? path.join(browsersPath, 'chromium') : undefined;

type ServedPages = Map<string, string>;

interface Fixtures {
  servedPages: ServedPages;
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
  openPopup: () => Promise<Page>;
  // routePath: 전체 URL(스킴+호스트+경로), 예: 'http://practice.test/frame-same.html'
  servePage: (routePath: string, html: string) => void;
  // practice.test(같은 출처)와 other.test(다른 출처) iframe을 담은 연습 페이지를 등록한다(D-28).
  serveFramedPracticePage: () => void;
}

export const test = base.extend<Fixtures>({
  servedPages: async ({}, use) => {
    await use(new Map());
  },

  context: async ({ servedPages }, use) => {
    const context = await chromium.launchPersistentContext('', {
      ...(executablePath ? { executablePath } : { channel: 'chromium' }),
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });

    // practice.test·other.test는 회사 시스템이 아닌 로컬 고정물이다(D-28) — 실제 네트워크로 나가지 않고
    // 여기서 등록한 inline HTML이나 tests/practice-site/ 아래 파일로만 응답한다.
    await context.route(/^http:\/\/(practice|other)\.test\//, async (route) => {
      const requestUrl = route.request().url();
      const withoutQuery = requestUrl.split('?')[0] ?? requestUrl;
      const inline = servedPages.get(withoutQuery);
      if (inline !== undefined) {
        await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: inline });
        return;
      }

      const url = new URL(requestUrl);
      const filePath = path.join(PRACTICE_SITE_DIR, url.pathname);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        await route.fulfill({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: fs.readFileSync(filePath, 'utf8'),
        });
        return;
      }

      await route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
    });

    await use(context);
    await context.close();
  },

  serviceWorker: async ({ context }, use) => {
    const serviceWorker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    // skeleton.e2e.ts의 launchExtension()과 같은 이유: service worker 대상이 알려지는 시점과
    // chrome.storage 같은 확장 API 바인딩이 실제로 주입되는 시점 사이의 짧은 틈을 기다린다.
    await expect.poll(() => serviceWorker.evaluate(() => typeof chrome.storage !== 'undefined')).toBe(true);
    await use(serviceWorker);
  },

  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },

  openPopup: async ({ context, extensionId }, use) => {
    await use(async () => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      return page;
    });
  },

  servePage: async ({ servedPages }, use) => {
    await use((routePath: string, html: string) => {
      servedPages.set(routePath, html);
    });
  },

  serveFramedPracticePage: async ({ servedPages }, use) => {
    await use(() => {
      servedPages.set(
        'http://practice.test/',
        '<!doctype html><html><body><h1>연습 사이트</h1>' +
          '<iframe src="http://practice.test/frame-same.html" title="같은 출처"></iframe>' +
          '<iframe src="http://other.test/frame-other.html" title="다른 출처"></iframe>' +
          '</body></html>',
      );
      servedPages.set(
        'http://practice.test/frame-same.html',
        '<!doctype html><html><body><p>같은 출처 프레임</p></body></html>',
      );
      servedPages.set(
        'http://other.test/frame-other.html',
        '<!doctype html><html><body><p>다른 출처 프레임</p></body></html>',
      );
    });
  },
});

export { expect } from '@playwright/test';
