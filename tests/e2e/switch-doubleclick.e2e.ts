import { test, expect } from './fixtures';
import { chooseSwitch, startSwitch } from './switch-helpers';
import type { Page } from '@playwright/test';
const panel=(page:Page)=>page.locator('tremor-helper-root').locator('.switch-panel');
const html='<button type="button" id="open" onclick="window.clicks++">열기</button><button type="submit">제출</button><a href="https://external.test">링크</a><input value="글"><script>window.clicks=0;window.doubles=0;window.details=[];document.body.addEventListener("dblclick",e=>{window.doubles++;window.details.push([e.detail,e.isTrusted]);})</script>';
async function preview(page:Page){await startSwitch(page);await chooseSwitch(page,'읽기·이동');await chooseSwitch(page,'더블클릭 · 제한');await expect(panel(page).locator('[data-item-id^="double-target:"]')).toHaveCount(1);await chooseSwitch(page,'대상 · 열기');}
async function counts(page:Page){return page.evaluate(()=>{const state=window as Window&{clicks?:number;doubles?:number;details?:unknown[]};return {clicks:state.clicks,doubles:state.doubles,details:state.details};});}
test.beforeEach(async({serviceWorker,servePage})=>{await serviceWorker.evaluate(async()=>chrome.storage.local.set({switchSettings:{schemaVersion:1,mode:'switch',intervalMs:800,protectionMs:100}}));servePage('http://practice.test/double',html);});
test.afterEach(({expectNoExternalRequests})=>{expectNoExternalRequests();});
test('explicit Space confirmation sends only one delegated dblclick and cancel sends nothing',async({context})=>{
 test.setTimeout(120000);const page=await context.newPage();await page.goto('http://practice.test/double');await preview(page);
 await expect(panel(page)).toContainText('일반 클릭 없이');await expect(panel(page).locator('.switch-draft')).toContainText('열기');
 for(const width of [360,768,1280]){await page.setViewportSize({width,height:800});const box=await panel(page).boundingBox();expect(box).not.toBeNull();expect((box?.x??0)+(box?.width??0)).toBeLessThanOrEqual(width);expect((box?.y??0)+(box?.height??0)).toBeLessThanOrEqual(800);}
 await page.waitForTimeout(1100);await chooseSwitch(page,'취소');expect(await counts(page)).toEqual({clicks:0,doubles:0,details:[]});
 await chooseSwitch(page,'대상 · 열기');await chooseSwitch(page,'확인 · 더블클릭 전달');await expect(panel(page)).toContainText('사이트 결과를 확인');expect(await counts(page)).toEqual({clicks:0,doubles:1,details:[[2,false]]});
});
for(const boundary of ['reinserted','identity','disabled','pause','scroll','settings'])test(`late doubleclick approval after ${boundary} never delivers any event`,async({context,serviceWorker})=>{
 test.setTimeout(90000);const page=await context.newPage();await page.goto('http://practice.test/double');if(boundary==='scroll')await page.evaluate(()=>{document.body.style.height='3000px';});await preview(page);
 await serviceWorker.evaluate(()=>{const send=chrome.tabs.sendMessage.bind(chrome.tabs);const state=globalThis as typeof globalThis&{doubleReady?:boolean;releaseDouble?:()=>void};chrome.tabs.sendMessage=async(tabId,message,options)=>{const reply=await send(tabId,message,options);if(typeof message==='object'&&message!==null&&'type' in message&&message.type==='switch/action-check'&&'doubleClick' in message){state.doubleReady=true;await new Promise<void>(resolve=>{state.releaseDouble=resolve;});}return reply;};});
 await chooseSwitch(page,'확인 · 더블클릭 전달');await expect.poll(()=>serviceWorker.evaluate(()=>(globalThis as typeof globalThis&{doubleReady?:boolean}).doubleReady)).toBe(true);
 if(boundary==='pause'){await page.keyboard.press('Space');await expect(panel(page)).toHaveAttribute('data-mode','paused');}
 else if(boundary==='settings')await serviceWorker.evaluate(async()=>chrome.storage.local.set({switchSettings:{schemaVersion:1,mode:'switch',intervalMs:1200,protectionMs:100}}));
 else if(boundary==='scroll')await page.evaluate(()=>{window.scrollTo(0,1200);});
 else await page.locator('#open').evaluate((el:HTMLButtonElement,boundary)=>{if(boundary==='disabled')el.disabled=true;else if(boundary==='identity')el.setAttribute('aria-label','다른 동작');else{el.remove();document.body.prepend(el);}},boundary);
 await serviceWorker.evaluate(()=>(globalThis as typeof globalThis&{releaseDouble?:()=>void}).releaseDouble?.());
 if(boundary==='pause'||boundary==='settings'){await page.waitForTimeout(300);await expect(panel(page)).toHaveAttribute('data-mode','paused');}else await expect(panel(page)).toContainText('전달 결과를 확인');
 expect(await counts(page)).toEqual({clicks:0,doubles:0,details:[]});
});
test('lost delivery acknowledgment and duplicate action never replay the dblclick',async({context,serviceWorker})=>{
 test.setTimeout(90000);const page=await context.newPage();await page.goto('http://practice.test/double');await preview(page);
 await serviceWorker.evaluate(()=>{const send=chrome.tabs.sendMessage.bind(chrome.tabs);const state=globalThis as typeof globalThis&{duplicateResult?:unknown};chrome.tabs.sendMessage=async(tabId,message,options)=>{const reply=await send(tabId,message,options);if(typeof message==='object'&&message!==null&&'type' in message&&message.type==='switch/execute'&&'action' in message&&typeof message.action==='object'&&message.action!==null&&'kind' in message.action&&message.action.kind==='doubleClick'){state.duplicateResult=await send(tabId,message,options);throw new Error('lost acknowledgment');}return reply;};});
 await chooseSwitch(page,'확인 · 더블클릭 전달');await expect(panel(page)).toHaveAttribute('data-mode','recovering');expect(await counts(page)).toEqual({clicks:0,doubles:1,details:[[2,false]]});expect(await serviceWorker.evaluate(()=>(globalThis as typeof globalThis&{duplicateResult?:unknown}).duplicateResult)).toEqual({result:'refused'});
 await page.keyboard.press('Space');await page.waitForTimeout(125);await chooseSwitch(page,'확인 · 더블클릭 전달');expect(await counts(page)).toEqual({clicks:0,doubles:1,details:[[2,false]]});
});
test('sites requiring prior clicks or lacking a handler receive no fallback and no success claim',async({context,servePage})=>{
 test.setTimeout(120000);servePage('http://practice.test/unsupported-double','<button type="button" id="needs" onclick="window.clicks++">클릭 선행 필요</button><button type="button" id="none">처리기 없음</button><script>window.clicks=0;window.effect=0;document.querySelector("#needs").addEventListener("dblclick",()=>{if(window.clicks===2)window.effect++})</script>');const page=await context.newPage();await page.goto('http://practice.test/unsupported-double');await startSwitch(page);await chooseSwitch(page,'읽기·이동');await chooseSwitch(page,'더블클릭 · 제한');
 for(const label of ['클릭 선행 필요','처리기 없음']){await chooseSwitch(page,'대상 · '+label);await chooseSwitch(page,'확인 · 더블클릭 전달');await expect(panel(page)).toContainText('사이트 결과를 확인');}
 expect(await page.evaluate(()=>{const s=window as Window&{clicks?:number;effect?:number};return [s.clicks,s.effect];})).toEqual([0,0]);
});
