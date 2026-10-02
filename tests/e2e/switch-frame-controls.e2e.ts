import {test,expect} from './fixtures';
import {chooseSwitch,startSwitch} from './switch-helpers';
import type {Page,Worker} from '@playwright/test';

type Kind='radio'|'multiple';
const fields={radio:'우편',multiple:'관심 주제'};
const proposals={radio:'이 항목 선택',multiple:'2. 나 · 선택하기'};
function controls(suffix=''){
 return `<form><label><input id="visit" type="radio" name="delivery" value="private-visit" checked>방문${suffix}</label><label><input id="mail" type="radio" name="delivery" value="private-mail">우편${suffix}</label><label>관심 주제${suffix}<select id="topics" multiple><option value="private-a" selected>가</option><option value="private-b">나</option><optgroup disabled label="고정"><option selected>다</option></optgroup></select></label></form>`;
}
function child(doc='old'){
 return `<body data-doc="${doc}">${controls()}<script>window.inputs=0;window.changes=0;window.clicks=0;window.submits=0;document.addEventListener('input',()=>window.inputs++);document.addEventListener('change',()=>window.changes++);document.addEventListener('click',()=>window.clicks++);document.addEventListener('submit',event=>{event.preventDefault();window.submits++;});</script>`;
}
const parent=(origin:string)=>`${controls(' 부모')}<iframe id="target" title="양식" style="width:340px;height:220px" src="http://${origin}/frame-controls.html"></iframe><iframe id="sibling" title="옆 양식" style="width:340px;height:220px" src="http://other.test/sibling-controls.html"></iframe>`;
const panel=(page:Page)=>page.locator('tremor-helper-root').locator('.switch-panel');
async function field(page:Page,kind:Kind){await chooseSwitch(page,'글쓰기');await chooseSwitch(page,'양식 한 장 보기');await chooseSwitch(page,fields[kind]);}
async function unchanged(page:Page){
 const frame=page.frameLocator('#target');await expect(frame.locator('#visit')).toBeChecked();await expect(frame.locator('#mail')).not.toBeChecked();expect(await frame.locator('#topics').evaluate((el:HTMLSelectElement)=>Array.from(el.selectedOptions).map(option=>option.text))).toEqual(['가','다']);
}
async function applied(page:Page,kind:Kind){
 const frame=page.frameLocator('#target');if(kind==='radio'){await expect(frame.locator('#mail')).toBeChecked();await expect(frame.locator('#visit')).not.toBeChecked();expect(await frame.locator('#topics').evaluate((el:HTMLSelectElement)=>Array.from(el.selectedOptions).map(option=>option.text))).toEqual(['가','다']);}
 else{await expect(frame.locator('#visit')).toBeChecked();await expect(frame.locator('#mail')).not.toBeChecked();expect(await frame.locator('#topics').evaluate((el:HTMLSelectElement)=>Array.from(el.selectedOptions).map(option=>option.text))).toEqual(['가','나','다']);}
}
async function counts(page:Page){return page.frameLocator('#target').locator('body').evaluate(()=>{const w=window as Window&{inputs?:number;changes?:number;clicks?:number;submits?:number};return [w.inputs,w.changes,w.clicks,w.submits];});}
async function holdApply(worker:Worker,mode:'delivery'|'reply'|'authorization'='delivery'){
 await worker.evaluate(mode=>{
  const send=chrome.tabs.sendMessage.bind(chrome.tabs);const held={ready:false,started:false,finished:false,release:null as (()=>void)|null};(globalThis as typeof globalThis&{frameControlHeld:typeof held}).frameControlHeld=held;
  const wait=async()=>{held.ready=true;await new Promise<void>(resolve=>{held.release=resolve;});};
  chrome.tabs.sendMessage=async(tabId,message,options)=>{
   if(typeof message==='object'&&message!==null&&'type' in message){
    if(mode==='authorization'&&held.started&&message.type==='switch/action-check'){const reply=await send(tabId,message,options);await wait();return reply;}
    if(message.type==='switch/execute'&&'action' in message&&typeof message.action==='object'&&message.action!==null&&'kind' in message.action&&message.action.kind==='applyControl'){
     held.started=true;
     try{if(mode==='delivery')await wait();const reply=await send(tabId,message,options);return mode==='reply'?{result:'unknown'}:reply;}finally{held.finished=true;}
    }
   }
   return send(tabId,message,options);
  };
 },mode);
}
async function waitHeld(worker:Worker){await expect.poll(()=>worker.evaluate(()=>(globalThis as typeof globalThis&{frameControlHeld:{ready:boolean}}).frameControlHeld.ready)).toBe(true);}
async function release(worker:Worker){await worker.evaluate(()=>(globalThis as typeof globalThis&{frameControlHeld:{release:(()=>void)|null}}).frameControlHeld.release?.());await expect.poll(()=>worker.evaluate(()=>(globalThis as typeof globalThis&{frameControlHeld:{finished:boolean}}).frameControlHeld.finished)).toBe(true);}
test.beforeEach(async({servePage,serviceWorker})=>{
 servePage('http://practice.test/frame-controls.html',child());servePage('http://other.test/frame-controls.html',child());servePage('http://other.test/new-controls.html',child('new'));servePage('http://other.test/sibling-controls.html',controls(' 옆'));
 await serviceWorker.evaluate(async()=>chrome.storage.local.set({switchSettings:{schemaVersion:1,mode:'switch',intervalMs:800,protectionMs:100}}));
});
test.afterEach(({expectNoExternalRequests})=>{expectNoExternalRequests();});

for(const origin of ['practice.test','other.test'])for(const kind of ['radio','multiple'] as const){
 test(`${origin} ${kind} cancels and pauses proposals before fresh explicit apply, isolating other frames`,async({context,servePage,serviceWorker})=>{
  test.setTimeout(130000);servePage('http://practice.test/frame-main.html',parent(origin));const page=await context.newPage();await page.goto('http://practice.test/frame-main.html');await expect(page.frameLocator('#target').locator('#topics')).toBeVisible();await startSwitch(page);await field(page,kind);await chooseSwitch(page,proposals[kind]);await unchanged(page);await chooseSwitch(page,'양식 목록');await unchanged(page);await chooseSwitch(page,fields[kind]);await expect(panel(page).locator('[data-item-id="control-apply"]')).toHaveCount(0);
  await chooseSwitch(page,proposals[kind]);await chooseSwitch(page,'쉬기');await expect(panel(page)).toHaveAttribute('data-mode','paused');await page.keyboard.press('Space');await page.waitForTimeout(125);await unchanged(page);await chooseSwitch(page,fields[kind]);await expect(panel(page).locator('[data-item-id="control-apply"]')).toHaveCount(0);await chooseSwitch(page,proposals[kind]);await chooseSwitch(page,'선택 적용');await applied(page,kind);expect(await counts(page)).toEqual([1,1,0,0]);
  await expect(page.locator('body > form #visit')).toBeChecked();await expect(page.locator('body > form #mail')).not.toBeChecked();await expect(page.frameLocator('#sibling').locator('#visit')).toBeChecked();await expect(page.frameLocator('#sibling').locator('#mail')).not.toBeChecked();for(const target of [page.locator('body > form #topics'),page.frameLocator('#sibling').locator('#topics')])expect(await target.evaluate((el:HTMLSelectElement)=>Array.from(el.selectedOptions).map(option=>option.text))).toEqual(['가','다']);
  expect(await serviceWorker.evaluate(async()=>JSON.stringify([await chrome.storage.local.get(null),await chrome.storage.session.get(null)]))).not.toContain('private-');
 });
}
for(const kind of ['radio','multiple'] as const){
 test(`cross-origin ${kind} held delivery is cancelled by Space before reaching the child`,async({context,servePage,serviceWorker})=>{
  test.setTimeout(85000);servePage('http://practice.test/frame-main.html',parent('other.test'));const page=await context.newPage();await page.goto('http://practice.test/frame-main.html');await startSwitch(page);await field(page,kind);await chooseSwitch(page,proposals[kind]);await holdApply(serviceWorker);await chooseSwitch(page,'선택 적용');await waitHeld(serviceWorker);await page.keyboard.press('Space');await expect(panel(page)).toHaveAttribute('data-mode','paused');await release(serviceWorker);await unchanged(page);expect(await counts(page)).toEqual([0,0,0,0]);await expect(panel(page).locator('[data-item-id="control-apply"]')).toHaveCount(0);
 });
 for(const change of ['navigation','replacement'] as const){
  test(`cross-origin ${kind} rejects its held old target after frame ${change}`,async({context,servePage,serviceWorker})=>{
   test.setTimeout(90000);servePage('http://practice.test/frame-main.html',parent('other.test'));const page=await context.newPage();await page.goto('http://practice.test/frame-main.html');await startSwitch(page);await field(page,kind);await chooseSwitch(page,proposals[kind]);await holdApply(serviceWorker);await chooseSwitch(page,'선택 적용');await waitHeld(serviceWorker);
   await page.locator('#target').evaluate((el,change)=>{if(change==='navigation')(el as HTMLIFrameElement).src='http://other.test/new-controls.html';else{const replacement=el.cloneNode(false) as HTMLIFrameElement;replacement.src='http://other.test/new-controls.html';el.replaceWith(replacement);}},change);await expect(page.frameLocator('#target').locator('body')).toHaveAttribute('data-doc','new');await expect(panel(page)).toHaveAttribute('data-mode','paused');await release(serviceWorker);await unchanged(page);expect(await counts(page)).toEqual([0,0,0,0]);await expect(panel(page).locator('[data-item-id="control-apply"]')).toHaveCount(0);
  });
 }
 test(`cross-origin ${kind} lost acknowledgement pauses without replaying the committed value`,async({context,servePage,serviceWorker})=>{
  test.setTimeout(85000);servePage('http://practice.test/frame-main.html',parent('other.test'));const page=await context.newPage();await page.goto('http://practice.test/frame-main.html');await startSwitch(page);await field(page,kind);await chooseSwitch(page,proposals[kind]);await holdApply(serviceWorker,'reply');await chooseSwitch(page,'선택 적용');await expect(panel(page)).toHaveAttribute('data-mode','paused');await expect(panel(page)).toContainText('실행 결과를 확인하세요');await applied(page,kind);await page.keyboard.press('Space');await page.waitForTimeout(125);await expect(panel(page).locator('[data-item-id="control-apply"]')).toHaveCount(0);expect(await counts(page)).toEqual([1,1,0,0]);
 });
}

for(const kind of ['radio','multiple'] as const)for(const boundary of ['delivery','authorization'] as const){
 test(`cross-origin ${kind} leaving the viewport during ${boundary} must not apply`,async({context,servePage,serviceWorker})=>{
  test.setTimeout(85000);servePage('http://practice.test/frame-main.html',parent('other.test')+'<div style="height:2000px"></div>');const page=await context.newPage();await page.goto('http://practice.test/frame-main.html');await startSwitch(page);await field(page,kind);await chooseSwitch(page,proposals[kind]);await holdApply(serviceWorker,boundary);await chooseSwitch(page,'선택 적용');await waitHeld(serviceWorker);await page.evaluate(()=>{window.scrollTo(0,1000);});await expect.poll(()=>page.locator('#target').evaluate(el=>el.getBoundingClientRect().bottom)).toBeLessThan(0);await release(serviceWorker);await unchanged(page);expect(await counts(page)).toEqual([0,0,0,0]);
 });
}
