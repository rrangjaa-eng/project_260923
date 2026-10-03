import { test, expect } from './fixtures';
import { chooseSwitch, startSwitch } from './switch-helpers';

test.beforeEach(async ({ serviceWorker }) => {
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
});
for(const change of ['remove','rename'] as const){
 test(`unavailable ${change} draft stays readable until explicit discard and then permits reload confirmation`,async({context,servePage,expectNoExternalRequests})=>{
  test.setTimeout(180000);
  servePage('http://practice.test/orphan.html','<label>첫 문장<input id="first" value="보존 문장"></label><script>const f=document.querySelector("input");f.setSelectionRange(f.value.length,f.value.length);</script>');
  const page=await context.newPage();await page.goto('http://practice.test/orphan.html');await startSwitch(page);await chooseSwitch(page,'글쓰기');await chooseSwitch(page,'양식 한 장 보기');await chooseSwitch(page,'첫 문장');await chooseSwitch(page,'띄어쓰기');await chooseSwitch(page,'양식 목록');
  await page.evaluate(kind=>{const field=document.querySelector('input');if(kind==='remove')field?.remove();else field?.setAttribute('aria-label','바뀐 칸');},change);
  await chooseSwitch(page,'양식 목록 새로 읽기');await chooseSwitch(page,'보관 문장');await chooseSwitch(page,'보관 1 · 첫 문장');
  const panel=page.locator('tremor-helper-root').locator('.switch-panel');await expect(panel.locator('.switch-draft')).toContainText('보존 문장 ');
  for(const width of [360,768,1280,1440]){
   await page.setViewportSize({width,height:800});
   const size=await panel.evaluate(el=>({right:el.getBoundingClientRect().right,bottom:el.getBoundingClientRect().bottom,choices:Array.from(el.querySelectorAll('.switch-choice')).map(c=>({height:c.getBoundingClientRect().height,font:parseFloat(getComputedStyle(c).fontSize)}))}));
   if(change==='remove'&&width===360)await page.screenshot({path:'/tmp/orphan-preview-360.png'});
   expect(size.right).toBeLessThanOrEqual(width);expect(size.bottom).toBeLessThanOrEqual(800);for(const choice of size.choices){expect(choice.height).toBeGreaterThanOrEqual(56);expect(choice.font).toBeGreaterThanOrEqual(18);}
  }
  await chooseSwitch(page,'이 보관 문장 버리기');await expect(panel.locator('.switch-choice').first()).toHaveText('취소');await page.waitForTimeout(1001);await chooseSwitch(page,'취소');await expect(panel.locator('.switch-draft')).toContainText('보존 문장 ');
  await chooseSwitch(page,'이 보관 문장 버리기');await page.waitForTimeout(1001);await chooseSwitch(page,'확인 · 이 보관 문장 버리기');await chooseSwitch(page,'상위로');await chooseSwitch(page,'읽기·이동');await chooseSwitch(page,'새로고침');await expect(panel).toHaveAttribute('data-mode','confirming');expectNoExternalRequests();
 });
}
test('rest cancels orphan discard and a returning identity refuses deletion',async({context,servePage})=>{
 test.setTimeout(180000);servePage('http://practice.test/orphan-return.html','<input aria-label="문장" value="보존">');const page=await context.newPage();await page.goto('http://practice.test/orphan-return.html');await startSwitch(page);await chooseSwitch(page,'글쓰기');await chooseSwitch(page,'양식 한 장 보기');await chooseSwitch(page,'문장');await chooseSwitch(page,'띄어쓰기');await chooseSwitch(page,'양식 목록');
 await page.locator('input').evaluate(el=>{el.setAttribute('aria-label','다른 이름');});await chooseSwitch(page,'양식 목록 새로 읽기');await chooseSwitch(page,'보관 문장');await chooseSwitch(page,'보관 1 · 문장');await chooseSwitch(page,'이 보관 문장 버리기');await page.waitForTimeout(1001);await chooseSwitch(page,'쉬기');await page.keyboard.press('Space');await page.waitForTimeout(125);await chooseSwitch(page,'보관 문장');await chooseSwitch(page,'보관 1 · 문장');await chooseSwitch(page,'이 보관 문장 버리기');await page.locator('input').evaluate(el=>{el.setAttribute('aria-label','문장');});await page.waitForTimeout(1001);await chooseSwitch(page,'확인 · 이 보관 문장 버리기');const panel=page.locator('tremor-helper-root').locator('.switch-panel');await expect(panel.locator('.switch-status')).toContainText('보존');await chooseSwitch(page,'보관 목록');await chooseSwitch(page,'양식 목록');await chooseSwitch(page,'양식 목록 새로 읽기');await chooseSwitch(page,'문장');await expect(panel.locator('.switch-draft')).toContainText('보존');await expect(page.locator('input')).toHaveValue('보존');
});
test('a cross-origin field returning during the final list reply keeps its stored draft',async({context,serviceWorker,servePage})=>{
 test.setTimeout(180000);servePage('http://practice.test/orphan-frame.html','<iframe id="child" style="width:340px;height:220px" src="http://other.test/orphan-child.html"></iframe>');servePage('http://other.test/orphan-child.html','<input aria-label="자식 문장" value="프레임 보존">');
 const page=await context.newPage();await page.goto('http://practice.test/orphan-frame.html');await startSwitch(page);await chooseSwitch(page,'글쓰기');await chooseSwitch(page,'양식 한 장 보기');await chooseSwitch(page,'자식 문장');await chooseSwitch(page,'띄어쓰기');const panel=page.locator('tremor-helper-root').locator('.switch-panel');const pending=await panel.locator('.switch-draft').textContent();await chooseSwitch(page,'양식 목록');const input=page.frameLocator('#child').locator('input');await input.evaluate(el=>{el.setAttribute('aria-label','새 이름');});await chooseSwitch(page,'양식 목록 새로 읽기');await chooseSwitch(page,'보관 문장');await chooseSwitch(page,'보관 1 · 자식 문장');await chooseSwitch(page,'이 보관 문장 버리기');
 await serviceWorker.evaluate(()=>{
  const send=chrome.tabs.sendMessage.bind(chrome.tabs);const held={active:true,ready:false,changed:0,releases:[] as (()=>void)[]};(globalThis as typeof globalThis&{orphanHeld:typeof held}).orphanHeld=held;
  chrome.tabs.sendMessage=async(tabId,message,options)=>{
   if(typeof message==='object'&&message!==null&&'type' in message){
    if(message.type==='switch/refresh'&&'changed' in message&&message.changed===true)held.changed++;
    if(message.type==='switch/frame-check'&&held.active){const result=await send(tabId,message,options);held.ready=true;await new Promise<void>(resolve=>{held.releases.push(resolve);});return result;}
   }
   return send(tabId,message,options);
  };
 });
 await page.waitForTimeout(1001);await chooseSwitch(page,'확인 · 이 보관 문장 버리기');await expect(panel).toHaveAttribute('data-mode','executing');await expect.poll(()=>serviceWorker.evaluate(()=>(globalThis as typeof globalThis&{orphanHeld:{ready:boolean}}).orphanHeld.ready)).toBe(true);
 await input.evaluate(el=>{el.setAttribute('aria-label','자식 문장');});await expect.poll(()=>serviceWorker.evaluate(()=>(globalThis as typeof globalThis&{orphanHeld:{changed:number}}).orphanHeld.changed)).toBeGreaterThan(0);
 await serviceWorker.evaluate(()=>{const held=(globalThis as typeof globalThis&{orphanHeld:{active:boolean;releases:(()=>void)[]}}).orphanHeld;held.active=false;held.releases.splice(0).forEach(release=>{release();});});
 await expect(panel.locator('.switch-status')).toContainText('보존');await expect(panel.locator('.switch-draft')).toContainText(pending??'missing draft');await expect(input).toHaveValue('프레임 보존');
});
