import { test, expect } from './fixtures';
import { chooseSwitch, startSwitch } from './switch-helpers';
import type { Page } from '@playwright/test';
const panel=(page:Page)=>page.locator('tremor-helper-root').locator('.switch-panel');
const html='<button type="button" id="open" onclick="window.clicks++">열기</button><button type="submit">제출</button><input value="저장하면 안 되는 값"><script>window.clicks=0</script>';
async function preview(page:Page){await startSwitch(page);await chooseSwitch(page,'읽기·이동');await chooseSwitch(page,'번호 고정 설정');await chooseSwitch(page,'1번 · 비어 있음');await chooseSwitch(page,'대상 고르기');await chooseSwitch(page,'고정할 대상 · 열기');}
test.beforeEach(async({serviceWorker,servePage})=>{await serviceWorker.evaluate(async()=>chrome.storage.local.set({switchSettings:{schemaVersion:1,mode:'switch',intervalMs:800,protectionMs:100}}));servePage('http://practice.test/pins',html);});
test.afterEach(({expectNoExternalRequests})=>{expectNoExternalRequests();});
test('Space previews, cancels, saves one pin, executes it with existing confirmation and explicitly removes it',async({context,serviceWorker})=>{
 test.setTimeout(240000);const page=await context.newPage();await page.goto('http://practice.test/pins');await preview(page);
 await expect(panel(page).locator('.switch-draft')).toContainText('비어 있음');await chooseSwitch(page,'다음 고정 읽기');await expect(panel(page).locator('.switch-draft')).toContainText('열기');
 for(const width of [360,768,1280]){await page.setViewportSize({width,height:800});const metrics=await panel(page).evaluate(el=>({right:el.getBoundingClientRect().right,bottom:el.getBoundingClientRect().bottom,heights:Array.from(el.querySelectorAll('.switch-choice')).map(choice=>choice.getBoundingClientRect().height)}));expect(metrics.right).toBeLessThanOrEqual(width);expect(metrics.bottom).toBeLessThanOrEqual(800);metrics.heights.forEach(height=>{expect(height).toBeGreaterThanOrEqual(56);});}
 await page.waitForTimeout(1100);await chooseSwitch(page,'취소 · 번호 설정으로');expect(await page.evaluate(()=>(window as Window&{clicks?:number}).clicks)).toBe(0);
 expect(await serviceWorker.evaluate(async()=>(await chrome.storage.sync.get('site:http://practice.test'))['site:http://practice.test'])).toBeUndefined();
 await chooseSwitch(page,'1번 · 비어 있음');await chooseSwitch(page,'대상 고르기');await chooseSwitch(page,'고정할 대상 · 열기');await chooseSwitch(page,'확인 · 번호 고정');
 await expect(panel(page)).toContainText('고정 설정을 저장했어요');
 const saved=await serviceWorker.evaluate(async()=>JSON.stringify((await chrome.storage.sync.get('site:http://practice.test'))['site:http://practice.test']));expect(saved).toContain('"number":1');expect(saved).not.toContain('저장하면 안 되는 값');expect(await page.evaluate(()=>(window as Window&{clicks?:number}).clicks)).toBe(0);
 await page.reload();await startSwitch(page);await chooseSwitch(page,'읽기·이동');await chooseSwitch(page,'고정 번호');await chooseSwitch(page,'1번 · 열기');await chooseSwitch(page,'열기');await expect.poll(()=>page.evaluate(()=>(window as Window&{clicks?:number}).clicks)).toBe(1);
 await chooseSwitch(page,'번호 고정 설정');await chooseSwitch(page,'1번 · 열기');await chooseSwitch(page,'고정 해제');await chooseSwitch(page,'확인 · 고정 해제');await expect(panel(page)).toContainText('고정 설정을 저장했어요');
 expect(await serviceWorker.evaluate(async()=>(await chrome.storage.sync.get('site:http://practice.test'))['site:http://practice.test'])).toEqual({schemaVersion:1,data:{disabled:false,pins:[]}});
});
for(const boundary of ['removed','reinserted','disabled','settings','pause'])test(`pin confirmation refuses ${boundary} without clicking or overwriting`,async({context,serviceWorker})=>{
 test.setTimeout(90000);const page=await context.newPage();await page.goto('http://practice.test/pins');await preview(page);
 if(boundary==='settings')await serviceWorker.evaluate(async()=>chrome.storage.sync.set({'site:http://practice.test':{schemaVersion:1,data:{disabled:false,pins:[{number:9,fingerprint:{id:'other',buttonText:'다른 설정',domPath:'body/other',framePath:[]}}]}}}));
 else if(boundary==='pause'){await chooseSwitch(page,'쉬기');await page.keyboard.press('Space');await page.waitForTimeout(125);await expect(panel(page).locator('[data-item-id="pin-commit"]')).toHaveCount(0);}
 else await page.locator('#open').evaluate((el:HTMLButtonElement,boundary)=>{if(boundary==='disabled')el.disabled=true;else{el.remove();if(boundary==='reinserted')document.body.prepend(el);}},boundary);
 if(boundary!=='pause'){await chooseSwitch(page,'확인 · 번호 고정');await expect(panel(page)).toContainText('다시 확인');}
 const saved=await serviceWorker.evaluate(async()=>(await chrome.storage.sync.get('site:http://practice.test'))['site:http://practice.test']);if(boundary==='settings')expect(saved).toMatchObject({data:{pins:[{number:9}]}});else expect(saved).toBeUndefined();expect(await page.evaluate(()=>(window as Window&{clicks?:number}).clicks)).toBe(0);
});
test('changing a saved pin while its button confirmation is open prevents execution',async({context,serviceWorker})=>{
 test.setTimeout(120000);const page=await context.newPage();await page.goto('http://practice.test/pins');await preview(page);await chooseSwitch(page,'확인 · 번호 고정');await expect(panel(page)).toContainText('고정 설정을 저장했어요');
 await page.reload();await startSwitch(page);await chooseSwitch(page,'읽기·이동');await chooseSwitch(page,'고정 번호');await chooseSwitch(page,'1번 · 열기');
 await serviceWorker.evaluate(async()=>chrome.storage.sync.set({'site:http://practice.test':{schemaVersion:1,data:{disabled:false,pins:[]}}}));
 await chooseSwitch(page,'열기');await expect(panel(page)).toContainText('고정 대상이 바뀌었어요');expect(await page.evaluate(()=>(window as Window&{clicks?:number}).clicks)).toBe(0);
});
test('long target names remain readable through comparison pages at 360px',async({context,servePage})=>{
 test.setTimeout(120000);const name='아주 긴 동일 업무 문서 이름 '.repeat(3)+'마지막 A';servePage('http://practice.test/long-pin',`<button type="button" id="long">${name}</button>`);const page=await context.newPage();await page.setViewportSize({width:360,height:800});await page.goto('http://practice.test/long-pin');await startSwitch(page);await chooseSwitch(page,'읽기·이동');await chooseSwitch(page,'번호 고정 설정');await chooseSwitch(page,'1번 · 비어 있음');await chooseSwitch(page,'대상 고르기');await chooseSwitch(page,'고정할 대상 · '+Array.from(name).slice(0,24).join('')+'…');
 let seen=await panel(page).locator('.switch-draft').innerText();for(let i=0;i<5&&!seen.includes('마지막 A');i++){await chooseSwitch(page,'다음 고정 읽기');seen+=await panel(page).locator('.switch-draft').innerText();expect(await panel(page).locator('.switch-draft').evaluate(el=>el.scrollHeight<=el.clientHeight)).toBe(true);}expect(seen).toContain('마지막 A');
 await chooseSwitch(page,'취소 · 번호 설정으로');
});

for(const boundary of ['reinserted','identity','settings','pause','scroll'])test(`final pin approval delayed across ${boundary} refuses the save`,async({context,serviceWorker})=>{
 test.setTimeout(90000);const page=await context.newPage();await page.goto('http://practice.test/pins');if(boundary==='scroll')await page.evaluate(()=>{document.body.style.height='3000px';});await preview(page);
 await serviceWorker.evaluate(()=>{
  const send=chrome.tabs.sendMessage.bind(chrome.tabs);let checks=0;
  const held=globalThis as typeof globalThis&{pinReady?:boolean;releasePin?:()=>void};
  chrome.tabs.sendMessage=async(tabId,message,options)=>{
   const reply=await send(tabId,message,options);
   if(typeof message==='object'&&message!==null&&'type' in message&&message.type==='switch/action-check'&&'pin' in message&&++checks===2){held.pinReady=true;await new Promise<void>(resolve=>{held.releasePin=resolve;});}
   return reply;
  };
 });
 await chooseSwitch(page,'확인 · 번호 고정');await expect.poll(()=>serviceWorker.evaluate(()=>(globalThis as typeof globalThis&{pinReady?:boolean}).pinReady)).toBe(true);
 if(boundary==='settings')await serviceWorker.evaluate(async()=>chrome.storage.sync.set({'site:http://practice.test':{schemaVersion:1,data:{disabled:false,pins:[{number:9,fingerprint:{id:'other',buttonText:'다른 설정',domPath:'body/other',framePath:[]}}]}}}));
 else if(boundary==='scroll'){await page.evaluate(()=>{window.scrollTo(0,1200);});await expect.poll(()=>page.locator('#open').evaluate(el=>el.getBoundingClientRect().bottom)).toBeLessThan(0);}
 else if(boundary==='pause'){await page.keyboard.press('Space');await expect(panel(page)).toHaveAttribute('data-mode','paused');}
 else await page.locator('#open').evaluate((el,boundary)=>{if(boundary==='identity')el.setAttribute('aria-label','바뀐 이름');else{el.remove();document.body.prepend(el);}},boundary);
 await serviceWorker.evaluate(()=>(globalThis as typeof globalThis&{releasePin?:()=>void}).releasePin?.());
 if(boundary==='pause'){await page.waitForTimeout(300);await expect(panel(page)).toHaveAttribute('data-mode','paused');}else await expect(panel(page)).toContainText('고정 설정 결과를 확인하세요');
 const saved=await serviceWorker.evaluate(async()=>(await chrome.storage.sync.get('site:http://practice.test'))['site:http://practice.test']);if(boundary==='settings')expect(saved).toMatchObject({data:{pins:[{number:9}]}});else expect(saved).toBeUndefined();
 expect(await page.evaluate(()=>(window as Window&{clicks?:number}).clicks)).toBe(0);
});

test('lost pin write acknowledgment stays unknown and never replays the save',async({context,serviceWorker})=>{
 test.setTimeout(90000);const page=await context.newPage();await page.goto('http://practice.test/pins');await preview(page);
 await serviceWorker.evaluate(()=>{
  const set=chrome.storage.sync.set.bind(chrome.storage.sync),state=globalThis as typeof globalThis&{pinWrites?:number};state.pinWrites=0;
  chrome.storage.sync.set=async(items)=>{await set(items);if('site:http://practice.test' in items){state.pinWrites=(state.pinWrites??0)+1;throw new Error('lost acknowledgment');}};
 });
 await chooseSwitch(page,'확인 · 번호 고정');await expect(panel(page)).toHaveAttribute('data-mode','recovering');await expect(panel(page)).toContainText('실행 결과를 확인하세요');
 expect(await serviceWorker.evaluate(async()=>(await chrome.storage.sync.get('site:http://practice.test'))['site:http://practice.test'])).toMatchObject({data:{pins:[{number:1}]}});
 await page.keyboard.press('Space');await page.waitForTimeout(125);await chooseSwitch(page,'확인 · 번호 고정');await expect(panel(page)).toContainText('다시 확인');
 expect(await serviceWorker.evaluate(()=>(globalThis as typeof globalThis&{pinWrites?:number}).pinWrites)).toBe(1);expect(await page.evaluate(()=>(window as Window&{clicks?:number}).clicks)).toBe(0);
});
