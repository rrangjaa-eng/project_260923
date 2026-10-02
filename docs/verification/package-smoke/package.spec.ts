import { test, expect, chromium } from '@playwright/test';
import { createServer } from 'node:https';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { nativePopup } from '../../../tests/e2e/installed-popup-helpers';
import { chooseSwitch, composeSwitchSyllable, startSwitch } from '../../../tests/e2e/switch-helpers';

test('final ZIP: native popup Space → Korean search/read → immediate stop → normal keys', async () => {
  test.setTimeout(240000);
  const zip = path.resolve('downloads/tremor-browser-helper-3ae6ad2.zip');
  expect(createHash('sha256').update(readFileSync(zip)).digest('hex')).toBe('bf84ada9a8b1f211b6d43318c02da1fd53b4482aafa41f648b4c9aef1eec2bdb');
  const temporary = mkdtempSync(path.join(tmpdir(), 'final-zip-smoke-'));
  const extension = path.join(temporary, 'extension');
  execFileSync('unzip', ['-q', zip, '-d', extension]);
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(temporary, 'key.pem'), '-out', path.join(temporary, 'cert.pem'), '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });
  const server = createServer({ key: readFileSync(path.join(temporary, 'key.pem')), cert: readFileSync(path.join(temporary, 'cert.pem')) }, (request, response) => {
    const pathname = new URL(request.url ?? '/', 'https://localhost').pathname;
    const allowed = ['/switch-search.html', '/switch-results.html', '/switch-article.html'];
    if (!allowed.includes(pathname)) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
    response.end(readFileSync(path.join('tests/practice-site', pathname), 'utf8') + '<input aria-label="일반 입력"><button id="normal">일반 버튼</button><script>window.normalClicks=0;document.querySelector("#normal").onclick=()=>window.normalClicks++;</script>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('server address');
  const origin = `https://127.0.0.1:${String(address.port)}`;
  const context = await chromium.launchPersistentContext('', {
    ...(process.env.PLAYWRIGHT_BROWSERS_PATH ? { executablePath: path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium') } : { channel: 'chromium' }),
    ignoreHTTPSErrors: true, ignoreDefaultArgs: ['--disable-extensions'], args: ['--enable-unsafe-extension-debugging'],
  });
  const errors: string[] = [];
  try {
    const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${origin}/switch-search.html`);
    const browser = context.browser(); if (!browser) throw new Error('browser unavailable');
    const cdp = await browser.newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path: extension });
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.sync.get('settings')).settings !== undefined)).toBe(true);
    await expect(page.locator('tremor-helper-root')).toHaveCount(0);
    const popup = await nativePopup(cdp, worker, id);
    await popup.choose('활동 선택 시작');
    const panel = page.locator('tremor-helper-root').locator('.switch-panel');
    await expect(panel).toHaveAttribute('data-mode', 'groupScan');
    await page.screenshot({ path: 'downloads/evidence/01-space-start.png' });
    await chooseSwitch(page, '찾기'); await chooseSwitch(page, '검색어');
    await composeSwitchSyllable(page, 'ㄱ', 'ㅏ');
    await expect(panel.locator('.switch-draft')).toHaveText('가');
    await chooseSwitch(page, '입력칸에 적용');
    await expect(page.getByRole('searchbox')).toHaveValue('가');
    await chooseSwitch(page, '검색');
    await expect(page.locator('#query')).toHaveText('가');
    await startSwitch(page); await chooseSwitch(page, '페이지 항목'); await chooseSwitch(page, '한글 결과 읽기');
    await expect(page.locator('article')).toContainText('안녕하세요');
    await startSwitch(page); await chooseSwitch(page, '읽기·이동'); await chooseSwitch(page, '자동 스크롤');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await page.screenshot({ path: 'downloads/evidence/02-korean-reading.png' });
    const stopping = await nativePopup(cdp, worker, id); await stopping.choose('즉시 정지');
    await expect(page.locator('tremor-helper-root')).toHaveCount(0);
    const stopped = await page.evaluate(() => window.scrollY); await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.scrollY)).toBe(stopped);
    await page.bringToFront(); await page.getByRole('textbox', { name: '일반 입력' }).focus(); await page.keyboard.type('a b');
    await expect(page.getByRole('textbox', { name: '일반 입력' })).toHaveValue('a b');
    await page.getByRole('button', { name: '일반 버튼' }).focus(); await page.keyboard.press('Space');
    await expect.poll(() => page.evaluate(() => (window as unknown as { normalClicks: number }).normalClicks)).toBe(1);
    await page.screenshot({ path: 'downloads/evidence/03-stopped-normal-keys.png' });
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await new Promise<void>((resolve, reject) => server.close((error) => { if (error) reject(error); else resolve(); }));
    rmSync(temporary, { recursive: true, force: true });
  }
});
