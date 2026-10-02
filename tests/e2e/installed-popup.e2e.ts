import { test, expect, chromium } from '@playwright/test';
import { createServer } from 'node:https';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { nativePopup } from './installed-popup-helpers';
import { chooseSwitch } from './switch-helpers';
import { test as fixtureTest } from './fixtures';

test('production install → real popup Space start → page selection → real popup stop → normal input', async ({},testInfo) => {
  test.setTimeout(90000);
  const temporary = mkdtempSync(path.join(tmpdir(), 'installed-popup-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(temporary,'key.pem'), '-out', path.join(temporary,'cert.pem'), '-days', '1', '-subj', '/CN=localhost'], {stdio:'ignore'});
  const server=createServer({key:readFileSync(path.join(temporary,'key.pem')),cert:readFileSync(path.join(temporary,'cert.pem'))}, (_request,response) => {
    response.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
    response.end('<title>일반 HTTPS 문서</title><input aria-label="검색어"><button id="normal">일반 버튼</button><main style="height:10000px">읽기</main><script>window.normalClicks=0;document.querySelector("#normal").onclick=()=>window.normalClicks++;</script>');
  });
  await new Promise<void>((resolve) => { server.listen(0,'127.0.0.1',resolve); });
  const address=server.address(); if(!address||typeof address==='string')throw new Error('server address');
  const url=`https://127.0.0.1:${String(address.port)}/ordinary.html`;
  const context=await chromium.launchPersistentContext('',{
    ...(process.env.PLAYWRIGHT_BROWSERS_PATH?{executablePath:path.join(process.env.PLAYWRIGHT_BROWSERS_PATH,'chromium')}:{channel:'chromium'}),
    ignoreHTTPSErrors:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging'],
  });
  try {
    const old=await context.newPage(); await old.goto(url);
    const browser=context.browser(); if(!browser)throw new Error('browser unavailable');
    const cdp=await browser.newBrowserCDPSession();
    const {id}=await cdp.send('Extensions.loadUnpacked',{path:process.env.INSTALLED_EXTENSION_PATH??path.resolve('.output/chrome-mv3')});
    const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
    await expect.poll(()=>worker.evaluate(async()=> (await chrome.storage.sync.get('settings')).settings!==undefined)).toBe(true);
    expect(await old.locator('tremor-helper-root').count()).toBe(0);
    const popup=await nativePopup(cdp,worker,id);
    await expect.poll(()=>popup.selected()).toContain('활동 선택 시작');
    const popupDOM=await popup.evaluate<{height:number;buttons:Array<{text:string;height:number;selected:string|null;outline:string}>}>(`(() => {const root=document.querySelector('#app').shadowRoot;return {height:root.querySelector('.popup').getBoundingClientRect().height,buttons:Array.from(root.querySelectorAll('button')).map(el=>({text:el.textContent,height:el.getBoundingClientRect().height,selected:el.getAttribute('aria-current'),outline:getComputedStyle(el).outlineColor}))};})()`);
    expect(popupDOM.height).toBeLessThanOrEqual(600);for(const button of popupDOM.buttons)expect(button.height).toBeGreaterThanOrEqual(56);
    await testInfo.attach('native-popup-dom',{body:JSON.stringify(popupDOM),contentType:'application/json'});
    await popup.down();await popup.down(true);
    await old.waitForTimeout(1700);
    expect(await old.locator('tremor-helper-root').count()).toBe(0);
    expect(await popup.selected()).toContain('활동 선택 시작');
    await popup.up();
    const panel=old.locator('tremor-helper-root').locator('.switch-panel');
    await expect(panel).toHaveAttribute('data-mode','groupScan');
    await chooseSwitch(old,'읽기·이동');
    await chooseSwitch(old,'자동 스크롤');
    await expect.poll(()=>old.evaluate(()=>window.scrollY)).toBeGreaterThan(0);
    const stopping=await nativePopup(cdp,worker,id);
    await stopping.choose('즉시 정지');
    await expect(old.locator('tremor-helper-root')).toHaveCount(0);
    await expect.poll(()=>stopping.evaluate<string>(`document.querySelector('#app').shadowRoot.querySelector('.status').textContent`)).toBe('지금: 꺼짐');
    const stopped=await old.evaluate(()=>window.scrollY);
    await old.waitForTimeout(350);
    expect(await old.evaluate(()=>window.scrollY)).toBe(stopped);
    await old.bringToFront();
    await old.getByRole('textbox').focus();await old.keyboard.type('a b');
    await expect(old.getByRole('textbox')).toHaveValue('a b');
    await old.evaluate(()=>document.querySelector<HTMLButtonElement>('#normal')?.focus());
    await old.keyboard.press('Space');
    await expect.poll(()=>old.evaluate(()=> (window as unknown as {normalClicks:number}).normalClicks)).toBe(1);
    await old.getByRole('button',{name:'일반 버튼'}).click();
    await expect.poll(()=>old.evaluate(()=> (window as unknown as {normalClicks:number}).normalClicks)).toBe(2);
    await old.waitForTimeout(350);
    const restoredPosition=await old.evaluate(()=>window.scrollY);
    await old.waitForTimeout(350);
    expect(await old.evaluate(()=>window.scrollY)).toBe(restoredPosition);
    const fresh=await context.newPage();await fresh.goto(url+'?fresh=1');
    await expect(fresh.locator('tremor-helper-root')).toHaveCount(0);
    const restart=await nativePopup(cdp,worker,id);
    await restart.choose('도우미 켜기');
    await restart.choose('활동 선택 시작');
    await expect(fresh.locator('tremor-helper-root').locator('.switch-panel')).toHaveAttribute('data-mode','groupScan');
    await chooseSwitch(fresh,'조절·쉬기');await chooseSwitch(fresh,'도우미 끄기 · 페이지 입력 돌려주기');
    await expect(fresh.locator('tremor-helper-root')).toHaveCount(0);
    const reenable=await nativePopup(cdp,worker,id);await reenable.choose('도우미 켜기');await reenable.choose('활동 선택 시작');
    await expect(fresh.locator('tremor-helper-root').locator('.switch-panel')).toHaveAttribute('data-mode','groupScan');
    const manager=await context.newPage();await manager.goto(`chrome://extensions/?id=${id}`);
    await manager.locator('extensions-detail-view #enableToggle').click();
    await expect.poll(async()=>(await cdp.send('Extensions.getExtensions')).extensions.find(extension=>extension.id===id)?.enabled).toBe(false);
    await expect(fresh.locator('tremor-helper-root')).toHaveCount(0);
    await fresh.bringToFront();await fresh.getByRole('textbox').focus();await fresh.keyboard.type('after disable ');
    await expect(fresh.getByRole('textbox')).toHaveValue('after disable ');
  } finally { await context.close();await new Promise<void>((resolve,reject)=>{server.close(error=>{if(error)reject(error);else resolve();});});rmSync(temporary,{recursive:true,force:true}); }
});

for(const fault of ['corrupt','read-failure','late-enable','local-commit-delay'] as const){
  fixtureTest(`real popup stop survives ${fault} without revival`,async({context,serviceWorker,extensionId,servePage})=>{
    fixtureTest.setTimeout(60000);
    servePage('http://practice.test/stop.html','<input aria-label="본문"><button>보통 버튼</button><main style="height:10000px">문서</main>');
    const page=await context.newPage();await page.goto('http://practice.test/stop.html');
    const browser=context.browser();if(!browser)throw new Error('browser');
    const cdp=await browser.newBrowserCDPSession();
    const popup=await nativePopup(cdp,serviceWorker,extensionId);
    await popup.choose('활동 선택 시작');
    await expect(page.locator('tremor-helper-root').locator('.switch-panel')).toHaveAttribute('data-mode','groupScan');
    const stop=await nativePopup(cdp,serviceWorker,extensionId);
    if(fault==='corrupt')await serviceWorker.evaluate(()=>chrome.storage.sync.set({settings:{broken:true}}));
    if(fault==='read-failure')await serviceWorker.evaluate(()=>{chrome.storage.sync.get=()=>Promise.reject(new Error('fault-injected sync read'));});
    if(fault==='late-enable'||fault==='local-commit-delay'){
      await stop.click('즉시 정지');await expect(page.locator('tremor-helper-root')).toHaveCount(0);
      await page.waitForTimeout(400);
      await serviceWorker.evaluate((boundary)=>{
        const original=chrome.storage.sync.get.bind(chrome.storage.sync);
        const global=globalThis as typeof globalThis & {releaseEnabledRead?:()=>void};
        if(boundary==='late-enable')chrome.storage.sync.get=(key)=>new Promise((resolve,reject)=>{global.releaseEnabledRead=()=>{void original(key).then(resolve,reject);};});
        else {
          const originalSet=chrome.storage.local.set.bind(chrome.storage.local);
          chrome.storage.local.set=(value)=>value.helperSafetyOff===false?new Promise((resolve,reject)=>{global.releaseEnabledRead=()=>{void originalSet(value).then(resolve,reject);};}):originalSet(value);
        }
      },fault);
      await stop.click('도우미 켜기');
      await expect.poll(()=>serviceWorker.evaluate(()=>typeof (globalThis as typeof globalThis & {releaseEnabledRead?:()=>void}).releaseEnabledRead)).toBe('function');
      await page.waitForTimeout(400);
    }
    await stop.click('즉시 정지');
    await expect(page.locator('tremor-helper-root')).toHaveCount(0);
    // 로컬 켜기 commit을 풀기 전에도 실행이 정지하고 키가 페이지로 돌아온다.
    if(fault==='local-commit-delay'){
      await page.bringToFront();await page.getByRole('textbox').focus();await page.keyboard.type('safe ');
      await expect(page.getByRole('textbox')).toHaveValue('safe ');
      await page.getByRole('textbox').fill('');
    }
    if(fault==='late-enable'||fault==='local-commit-delay')await serviceWorker.evaluate(()=>{(globalThis as typeof globalThis & {releaseEnabledRead?:()=>void}).releaseEnabledRead?.();});
    if(fault!=='local-commit-delay')await expect.poll(()=>stop.evaluate<string>(`document.querySelector('#app').shadowRoot.querySelector('.status').textContent`)).toBe('지금: 꺼짐');
    else {
      await expect.poll(async()=> (await serviceWorker.evaluate(()=>chrome.storage.local.get('helperSafetyOff'))).helperSafetyOff).toBe(true);
    }
    await page.bringToFront();await page.getByRole('textbox').focus();await page.keyboard.type('a b');
    await expect(page.getByRole('textbox')).toHaveValue('a b');
    await page.waitForTimeout(500);await expect(page.locator('tremor-helper-root')).toHaveCount(0);
  });
}
