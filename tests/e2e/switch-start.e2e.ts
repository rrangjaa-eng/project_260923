import {test,expect} from './fixtures';
import {chooseSwitch,startSwitch,composeSwitchSyllable} from './switch-helpers';
test.afterEach(({expectNoExternalRequests})=>{expectNoExternalRequests();});
test('helper start page uses Space Korean draft and explicit search without early transmission',async({context,serviceWorker,extensionId})=>{
 test.setTimeout(120000);
 await serviceWorker.evaluate(()=>chrome.storage.local.set({switchSettings:{schemaVersion:1,mode:'switch',intervalMs:800,protectionMs:100}}));
 const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/start.html`);
 await startSwitch(page);await chooseSwitch(page,'찾기');await chooseSwitch(page,'Google 검색어');await composeSwitchSyllable(page,'ㄱ','ㅏ');
 await expect(page.getByLabel('Google 검색어')).toHaveValue('');await chooseSwitch(page,'입력칸에 적용');await expect(page.getByLabel('Google 검색어')).toHaveValue('가');
 let search='';await context.route('https://www.google.com/search**',async route=>{search=route.request().url();await route.fulfill({contentType:'text/html',body:'<title>합성 검색 결과</title><h1>검색 결과</h1>'});});
 expect(search).toBe('');await chooseSwitch(page,'검색');await expect(page).toHaveURL(/https:\/\/www.google.com\/search\?q=/);expect(new URL(search).searchParams.get('q')).toBe('가');
});
test('a delayed initial safety reply cannot reenable the helper after stop',async({context,serviceWorker,extensionId})=>{
 test.setTimeout(30000);
 await serviceWorker.evaluate(()=>{
  chrome.runtime.onConnect.addListener(port=>{if(port.name!=='switch-start')return;const post=port.postMessage.bind(port);port.postMessage=message=>{
   const m=message as {kind?:string;value?:{off?:boolean;revision?:number}};const g=globalThis as typeof globalThis & {safetyHeld?:boolean;releaseSafety?:()=>void};
   if(m.kind==='response'&&m.value?.off===false&&!g.safetyHeld){g.safetyHeld=true;g.releaseSafety=()=>{post(message);};return;}post(message);
  };});
 });
 await serviceWorker.evaluate(()=>chrome.storage.local.set({switchSettings:{schemaVersion:1,mode:'switch',intervalMs:800,protectionMs:100}}));
 const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/start.html`);
 await expect.poll(()=>serviceWorker.evaluate(()=>(globalThis as typeof globalThis & {safetyHeld?:boolean}).safetyHeld)).toBe(true);
 await serviceWorker.evaluate(()=>chrome.storage.local.set({helperSafetyOff:true}));
 await serviceWorker.evaluate(()=>{(globalThis as typeof globalThis & {releaseSafety?:()=>void}).releaseSafety?.();});
 await expect(page.locator('tremor-helper-root').locator('.switch-panel')).toHaveCount(0);await page.keyboard.press('Space');await expect(page.locator('tremor-helper-root').locator('.switch-panel')).toHaveCount(0);
});
test('helper address entry uses Space ASCII and navigates only after explicit confirmation',async({context,serviceWorker,extensionId,servePage})=>{
 test.setTimeout(130000);servePage('http://practice.test/a','<title>주소 목적지</title><h1>주소 목적지</h1>');
 await serviceWorker.evaluate(()=>chrome.storage.local.set({switchSettings:{schemaVersion:1,mode:'switch',intervalMs:800,protectionMs:100},switchPhrases:['http://practice.test/']}));
 const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/start.html`);await startSwitch(page);await chooseSwitch(page,'찾기');await chooseSwitch(page,'페이지 주소');await chooseSwitch(page,'문구');await chooseSwitch(page,'http://practice.test/');await chooseSwitch(page,'영문·주소 쓰기');await chooseSwitch(page,'a b c d e f');await chooseSwitch(page,'a');await expect(page.getByLabel('페이지 주소')).toHaveValue('');await chooseSwitch(page,'입력칸에 적용');await expect(page.getByLabel('페이지 주소')).toHaveValue('http://practice.test/a');await chooseSwitch(page,'상위로');await chooseSwitch(page,'페이지 항목');await chooseSwitch(page,'주소로 이동');await page.waitForTimeout(1100);await chooseSwitch(page,'주소로 이동');await expect(page).toHaveURL('http://practice.test/a');
});
test('two helper pages isolate Space input and helper stop disables both immediately',async({context,serviceWorker,extensionId})=>{
 test.setTimeout(70000);await serviceWorker.evaluate(()=>chrome.storage.local.set({switchSettings:{schemaVersion:1,mode:'switch',intervalMs:800,protectionMs:100}}));
 const first=await context.newPage();await first.goto(`chrome-extension://${extensionId}/start.html`);const second=await context.newPage();await second.goto(`chrome-extension://${extensionId}/start.html`);await first.bringToFront();await startSwitch(first);await chooseSwitch(first,'조절·쉬기');
 const inactive=second.locator('tremor-helper-root').locator('.switch-panel');await expect(inactive).toHaveAttribute('data-mode','paused');
 await serviceWorker.evaluate(async()=>{await chrome.runtime.sendMessage({type:'switch/key',kind:'keyDown',repeat:false,isComposing:false,modified:false}).catch(()=>undefined);await chrome.runtime.sendMessage({type:'switch/key',kind:'keyUp',repeat:false,isComposing:false,modified:false}).catch(()=>undefined);});await expect(inactive).toHaveAttribute('data-mode','paused');
 await chooseSwitch(first,'도우미 끄기 · 페이지 입력 돌려주기');await expect(first.locator('tremor-helper-root').locator('.switch-panel')).toHaveCount(0);await expect(inactive).toHaveCount(0);expect(await serviceWorker.evaluate(async()=> (await chrome.storage.local.get('helperSafetyOff')).helperSafetyOff)).toBe(true);
});
for(const width of [360,768,1280])test(`helper start controls use design tokens within ${String(width)}px`,async({context,extensionId})=>{
 const page=await context.newPage();await page.setViewportSize({width,height:800});await page.goto(`chrome-extension://${extensionId}/start.html`);
 const dimensions=await page.locator('input,button').evaluateAll(nodes=>nodes.map(node=>({height:node.getBoundingClientRect().height,right:node.getBoundingClientRect().right,font:getComputedStyle(node).fontSize,color:getComputedStyle(node).color})));
 for(const d of dimensions){expect(d.height).toBeGreaterThanOrEqual(56);expect(d.right).toBeLessThanOrEqual(width);expect(d.font).toBe('18px');expect(d.color).toBe('rgb(17, 24, 39)');}
});
test('fresh Space reconnects a disconnected helper without replaying or losing its draft',async({context,serviceWorker,extensionId})=>{
 test.setTimeout(90000);
 await serviceWorker.evaluate(()=>{chrome.runtime.onConnect.addListener(port=>{if(port.name==='switch-start')(globalThis as typeof globalThis & {startPort?:chrome.runtime.Port}).startPort=port;});return chrome.storage.local.set({switchSettings:{schemaVersion:1,mode:'switch',intervalMs:800,protectionMs:100},switchPhrases:['연결 전에 쓴 글']});});
 const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/start.html`);await startSwitch(page);await chooseSwitch(page,'찾기');await chooseSwitch(page,'Google 검색어');await chooseSwitch(page,'문구');await chooseSwitch(page,'연결 전에 쓴 글');
 await serviceWorker.evaluate(()=>{(globalThis as typeof globalThis & {startPort?:chrome.runtime.Port}).startPort?.disconnect();});await expect(page.locator('tremor-helper-root').locator('.switch-panel')).toHaveCount(0);
 await page.keyboard.press('Space');await expect(page.locator('tremor-helper-root').locator('.switch-panel')).toBeVisible();await expect(page.locator('tremor-helper-root').locator('.switch-draft')).toHaveText('연결 전에 쓴 글');await expect(page.getByLabel('Google 검색어')).toHaveValue('');await expect(page).toHaveURL(`chrome-extension://${extensionId}/start.html`);
});
test('invalid settings disable the start page until valid settings return and fresh Space resumes',async({context,serviceWorker,extensionId})=>{
 test.setTimeout(40000);await serviceWorker.evaluate(()=>chrome.storage.local.set({switchSettings:{schemaVersion:1,mode:'switch',intervalMs:800,protectionMs:100}}));const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/start.html`);await startSwitch(page);
 const stored=await serviceWorker.evaluate(()=>chrome.storage.sync.get('settings'));await serviceWorker.evaluate(()=>chrome.storage.sync.set({settings:{broken:true}}));await expect(page.locator('tremor-helper-root').locator('.switch-panel')).toHaveCount(0);await page.keyboard.press('Space');await expect(page.locator('tremor-helper-root').locator('.switch-panel')).toHaveCount(0);
 await serviceWorker.evaluate(value=>chrome.storage.sync.set(value),stored);await expect(page.locator('tremor-helper-root').locator('.switch-panel')).toHaveAttribute('data-mode','paused');await page.keyboard.press('Space');await expect(page.locator('tremor-helper-root').locator('.switch-panel')).toHaveAttribute('data-mode','groupScan');
});
test('pending apply disconnect and explicit reconnect keep unknown blocked without replay',async({context,serviceWorker,extensionId})=>{
 test.setTimeout(100000);
 await serviceWorker.evaluate(()=>{
  const g=globalThis as typeof globalThis & {startPort?:chrome.runtime.Port;holdStart?:boolean;startHeld?:boolean;releaseStart?:()=>void;startReleased?:boolean};
  chrome.runtime.onConnect.addListener(port=>{if(port.name!=='switch-start')return;g.startPort=port;const post=port.postMessage.bind(port);port.postMessage=message=>{
   const m=message as {kind?:string;value?:{type?:string}};
   if(g.holdStart&&!g.startHeld&&m.kind==='request'&&m.value?.type==='switch/action-check'){g.startHeld=true;g.releaseStart=()=>{try{post(message);}catch{}g.startReleased=true;};return;}post(message);
  };});return chrome.storage.local.set({switchSettings:{schemaVersion:1,mode:'switch',intervalMs:800,protectionMs:100}});
 });
 const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/start.html`);await page.getByLabel('Google 검색어').evaluate(el=>{(el as HTMLInputElement).value='기존';el.setAttribute('data-events','0');for(const name of ['input','change'])el.addEventListener(name,()=>{el.setAttribute('data-events',String(Number(el.getAttribute('data-events'))+1));});});
 await startSwitch(page);await chooseSwitch(page,'찾기');await chooseSwitch(page,'Google 검색어');await serviceWorker.evaluate(()=>{(globalThis as typeof globalThis & {holdStart?:boolean}).holdStart=true;});await chooseSwitch(page,'입력칸에 적용');await expect.poll(()=>serviceWorker.evaluate(()=>(globalThis as typeof globalThis & {startHeld?:boolean}).startHeld)).toBe(true);
 await serviceWorker.evaluate(()=>{(globalThis as typeof globalThis & {startPort?:chrome.runtime.Port}).startPort?.disconnect();});await expect(page.locator('tremor-helper-root').locator('.switch-panel')).toHaveCount(0);await page.keyboard.press('Space');await expect(page.locator('tremor-helper-root').locator('.switch-panel')).toBeVisible();
 await serviceWorker.evaluate(()=>{(globalThis as typeof globalThis & {releaseStart?:()=>void}).releaseStart?.();});await expect.poll(()=>serviceWorker.evaluate(()=>(globalThis as typeof globalThis & {startReleased?:boolean}).startReleased)).toBe(true);await expect(page.getByLabel('Google 검색어')).toHaveValue('기존');await expect(page.getByLabel('Google 검색어')).toHaveAttribute('data-events','0');
 await page.keyboard.press('Space');await chooseSwitch(page,'읽기·이동');await chooseSwitch(page,'새로고침');await expect(page.locator('tremor-helper-root').locator('.switch-status')).toContainText('결과를 확인하지 못한');await expect(page.getByLabel('Google 검색어')).toHaveValue('기존');
});
