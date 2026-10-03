import { test, expect } from './fixtures';
import { chooseSwitch, startSwitch } from './switch-helpers';
import type { Page } from '@playwright/test';
const panel=(page:Page)=>page.locator('tremor-helper-root').locator('.switch-panel');
const key='site:http://practice.test';
const label='이 사이트에서 끄기 · 다시 켜기는 확장 아이콘';
const html='<input id="text" value=""><button type="button">열기</button>';
test.beforeEach(async({serviceWorker,servePage})=>{await serviceWorker.evaluate(async()=>chrome.storage.local.set({switchSettings:{schemaVersion:1,mode:'switch',intervalMs:800,protectionMs:100}}));servePage('http://practice.test/off',html+'<iframe src="http://other.test/child"></iframe>');servePage('http://other.test/child',html);servePage('http://other.test/off',html);});
test.afterEach(({expectNoExternalRequests})=>{expectNoExternalRequests();});
test('Space disables only this top origin, preserves pins, returns frame input, survives reload and popup reenables',async({context,serviceWorker,openPopup})=>{
 test.setTimeout(90000);const other=await context.newPage();await other.goto('http://other.test/off');const page=await context.newPage();await page.goto('http://practice.test/off');
 const pin={number:1,fingerprint:{id:'open',buttonText:'열기',domPath:'body/button',framePath:[]}};
 await serviceWorker.evaluate(async({key,pin})=>chrome.storage.sync.set({[key]:{schemaVersion:1,data:{disabled:false,pins:[pin]}}}),{key,pin});
 const settings=await serviceWorker.evaluate(async()=>(await chrome.storage.sync.get('settings')).settings);
 await startSwitch(page);await chooseSwitch(page,'조절·쉬기');
 for(const width of [360,768,1280]){await page.setViewportSize({width,height:800});expect(await panel(page).evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(width);}
 await chooseSwitch(page,label);await expect(panel(page)).toHaveCount(0);
 expect(await serviceWorker.evaluate(async key=>(await chrome.storage.sync.get(key))[key],key)).toEqual({schemaVersion:1,data:{disabled:true,pins:[pin]}});
 expect(await serviceWorker.evaluate(async()=>(await chrome.storage.sync.get('settings')).settings)).toEqual(settings);
 await expect(panel(other)).toBeVisible();await page.locator('#text').focus();await page.keyboard.press('Space');await expect(page.locator('#text')).toHaveValue(' ');
 const child=page.frameLocator('iframe');await child.locator('#text').focus();await page.keyboard.press('Space');await expect(child.locator('#text')).toHaveValue(' ');
 await page.reload();await expect(panel(page)).toHaveCount(0);await page.locator('#text').focus();await page.keyboard.press('Space');await expect(page.locator('#text')).toHaveValue(' ');
 const popup=await openPopup(page);await popup.getByRole('button',{name:/이 사이트에서 켜기/}).click();await expect(panel(page)).toBeVisible();
 expect(await serviceWorker.evaluate(async key=>(await chrome.storage.sync.get(key))[key],key)).toEqual({schemaVersion:1,data:{disabled:false,pins:[pin]}});
});
for(const boundary of ['pause','navigate','settings','timeout'])test(`delayed final site-off approval across ${boundary} cannot write`,async({context,serviceWorker})=>{
 test.setTimeout(60000);const page=await context.newPage();await page.goto('http://practice.test/off');await startSwitch(page);await chooseSwitch(page,'조절·쉬기');
 await serviceWorker.evaluate(()=>{const send=chrome.tabs.sendMessage.bind(chrome.tabs);let checks=0;const held=globalThis as typeof globalThis&{siteReady?:boolean;releaseSite?:()=>void};chrome.tabs.sendMessage=async(id,message,options)=>{const reply=await send(id,message,options);if(typeof message==='object'&&message!==null&&'siteOff' in message&&++checks===3){held.siteReady=true;await new Promise<void>(resolve=>{held.releaseSite=resolve;});}return reply;};});
 await chooseSwitch(page,label);await expect.poll(()=>serviceWorker.evaluate(()=>(globalThis as typeof globalThis&{siteReady?:boolean}).siteReady)).toBe(true);
 if(boundary==='pause')await page.keyboard.press('Space');
 if(boundary==='navigate')await page.goto('http://other.test/off');
 if(boundary==='settings')await serviceWorker.evaluate(async key=>chrome.storage.sync.set({[key]:null}),key);
 if(boundary==='timeout')await expect(panel(page)).toContainText('끄기 결과를 확인하지 못했어요');
 await serviceWorker.evaluate(()=>(globalThis as typeof globalThis&{releaseSite?:()=>void}).releaseSite?.());
 await page.waitForTimeout(300);
 expect(await serviceWorker.evaluate(async key=>(await chrome.storage.sync.get(key))[key],key)).toBe(boundary==='settings'?null:undefined);
 if(boundary!=='navigate')await expect(panel(page)).toHaveAttribute('data-mode','paused');
});
for(const failure of ['malformed','write'])test(`site-off ${failure} failure pauses and preserves state`,async({context,serviceWorker})=>{
 test.setTimeout(60000);const page=await context.newPage();await page.goto('http://practice.test/off');await startSwitch(page);await chooseSwitch(page,'조절·쉬기');
 if(failure==='malformed')await serviceWorker.evaluate(async key=>chrome.storage.sync.set({[key]:null}),key);
 else await serviceWorker.evaluate(()=>{const set=chrome.storage.sync.set.bind(chrome.storage.sync);chrome.storage.sync.set=async items=>{if('site:http://practice.test' in items)throw new Error('denied');await set(items);};});
 await chooseSwitch(page,label);await expect(panel(page)).toHaveAttribute('data-mode','paused');await expect(panel(page)).toContainText(failure==='malformed'?'끄지 못했어요':'결과를 확인하지 못했어요');
 expect(await serviceWorker.evaluate(async key=>(await chrome.storage.sync.get(key))[key],key)).toBe(failure==='malformed'?null:undefined);
});
test('lost acknowledgement after a committed disable never replays or reactivates',async({context,serviceWorker})=>{
 test.setTimeout(60000);const page=await context.newPage();await page.goto('http://practice.test/off');await startSwitch(page);await chooseSwitch(page,'조절·쉬기');
 await serviceWorker.evaluate(()=>{const set=chrome.storage.sync.set.bind(chrome.storage.sync),state=globalThis as typeof globalThis&{siteWrites?:number};state.siteWrites=0;chrome.storage.sync.set=async items=>{await set(items);if('site:http://practice.test' in items){state.siteWrites=(state.siteWrites??0)+1;throw new Error('lost ack');}};});
 await chooseSwitch(page,label);await expect(panel(page)).toHaveCount(0);await page.locator('#text').focus();await page.keyboard.press('Space');await expect(page.locator('#text')).toHaveValue(' ');
 expect(await serviceWorker.evaluate(async key=>(await chrome.storage.sync.get(key))[key],key)).toMatchObject({data:{disabled:true}});expect(await serviceWorker.evaluate(()=>(globalThis as typeof globalThis&{siteWrites?:number}).siteWrites)).toBe(1);
});
