import { test, expect } from './fixtures';
import { chooseSwitch, startSwitch } from './switch-helpers';

test.beforeEach(async ({ serviceWorker }) => {
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
});

test('Space back then forward follows history once and preserves an unfinished draft', async ({ context, serviceWorker, servePage }) => {
  test.setTimeout(120000);
  servePage('http://practice.test/history-a.html', '<title>첫 화면</title><p>첫 화면</p>');
  servePage('http://practice.test/history-b.html', '<title>둘째 화면</title><p>둘째 화면</p>');
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchPhrases: ['보존할 문장'] }));
  const page=await context.newPage();await page.goto('http://practice.test/history-a.html');await page.goto('http://practice.test/history-b.html');
  await startSwitch(page);await chooseSwitch(page,'글쓰기');await chooseSwitch(page,'새 문장');await chooseSwitch(page,'문구');await chooseSwitch(page,'보존할 문장');await chooseSwitch(page,'상위로');
  await chooseSwitch(page,'읽기·이동');await chooseSwitch(page,'뒤로');await expect(page).toHaveURL('http://practice.test/history-a.html');
  await startSwitch(page);await expect(page.locator('tremor-helper-root').locator('.switch-draft')).toHaveText('보존할 문장');
  await chooseSwitch(page,'읽기·이동');await chooseSwitch(page,'앞으로');await expect(page).toHaveURL('http://practice.test/history-b.html');
  await startSwitch(page);await expect(page.locator('tremor-helper-root').locator('.switch-draft')).toHaveText('보존할 문장');
});

for(const width of [360,768,1280])test(`unavailable forward history explains refusal with a visible current choice at ${String(width)}px`, async ({ context, servePage }) => {
  test.setTimeout(60000);
  servePage('http://practice.test/history-end.html','<p>현재 화면</p>');
  const page=await context.newPage();await page.setViewportSize({width,height:800});await page.goto('http://practice.test/history-end.html');await startSwitch(page);await chooseSwitch(page,'읽기·이동');await chooseSwitch(page,'앞으로');
  const panel=page.locator('tremor-helper-root').locator('.switch-panel');
  await expect(panel.locator('.switch-status')).toContainText('앞으로 이동할 수 없어요');await expect(panel).toHaveAttribute('data-mode','itemScan');await expect(page).toHaveURL('http://practice.test/history-end.html');
  const measurement=await panel.evaluate(el=>{
    const choice=el.querySelector('.switch-choice[aria-current="true"]')?.getBoundingClientRect();const list=el.querySelector('.switch-choices')?.getBoundingClientRect();
    return {right:el.getBoundingClientRect().right,choiceTop:choice?.top,choiceBottom:choice?.bottom,listTop:list?.top,listBottom:list?.bottom};
  });
  expect(measurement.right).toBeLessThanOrEqual(width);expect(measurement.choiceTop).toBeDefined();expect(measurement.listTop).toBeDefined();
  expect(measurement.choiceTop).toBeGreaterThanOrEqual(measurement.listTop??0);expect(measurement.choiceBottom).toBeLessThanOrEqual(measurement.listBottom??0);
});

test('Space cancels a delayed approved navigation reply and a different command cannot borrow it', async ({ context, serviceWorker, servePage }) => {
  test.setTimeout(80000);
  servePage('http://practice.test/auth-a.html','<p>첫 화면</p>');servePage('http://practice.test/auth-b.html','<p>둘째 화면</p>');
  const page=await context.newPage();await page.goto('http://practice.test/auth-a.html');await page.goto('http://practice.test/auth-b.html');await startSwitch(page);await chooseSwitch(page,'읽기·이동');
  await serviceWorker.evaluate(()=>{
    const send=chrome.tabs.sendMessage.bind(chrome.tabs);
    const state=globalThis as typeof globalThis & {navWaiting?:boolean;releaseNav?:()=>void;wrongCommand?:unknown;navigationChecks:number};state.navigationChecks=0;
    chrome.tabs.sendMessage=async(tabId,message,options)=>{
      const result=await send(tabId,message,options);
      if(typeof message==='object'&&message!==null&&'type' in message&&message.type==='switch/action-check'&&'navigation' in message&&++state.navigationChecks===2){
        state.wrongCommand=await send(tabId,{...message,navigation:{kind:'forward'}},options);
        state.navWaiting=true;await new Promise<void>(resolve=>{state.releaseNav=resolve;});
      }
      return result;
    };
  });
  await chooseSwitch(page,'뒤로');await expect.poll(()=>serviceWorker.evaluate(()=>(globalThis as typeof globalThis & {navWaiting?:boolean}).navWaiting)).toBe(true);
  expect(await serviceWorker.evaluate(()=>(globalThis as typeof globalThis & {wrongCommand?:unknown}).wrongCommand)).toEqual({result:'refused'});
  await page.keyboard.press('Space');const panel=page.locator('tremor-helper-root').locator('.switch-panel');await expect(panel).toHaveAttribute('data-mode','paused');
  await serviceWorker.evaluate(()=>{(globalThis as typeof globalThis & {releaseNav?:()=>void}).releaseNav?.();});await page.waitForTimeout(300);
  await expect(page).toHaveURL('http://practice.test/auth-b.html');await expect(panel).toHaveAttribute('data-mode','paused');await page.keyboard.press('Space');await expect(panel).toHaveAttribute('data-mode','itemScan');await expect(page).toHaveURL('http://practice.test/auth-b.html');
});

test('a tab activation remains stoppable with Space while its target ping is pending', async ({ context, serviceWorker, servePage }) => {
  test.setTimeout(80000);
  servePage('http://practice.test/activate-target.html','<title>목표 탭</title><p>목표</p>');servePage('http://practice.test/activate-source.html','<title>출발 탭</title><p>출발</p>');
  const target=await context.newPage();await target.goto('http://practice.test/activate-target.html');const page=await context.newPage();await page.goto('http://practice.test/activate-source.html');await page.bringToFront();await startSwitch(page);await chooseSwitch(page,'읽기·이동');await chooseSwitch(page,'열린 탭');
  await serviceWorker.evaluate(()=>{
    const send=chrome.tabs.sendMessage.bind(chrome.tabs);const state=globalThis as typeof globalThis & {navWaiting?:boolean;releaseNav?:()=>void;activations?:number};state.activations=0;
    const update=chrome.tabs.update.bind(chrome.tabs);chrome.tabs.update=async(tabId,changes)=>{if(changes.active)state.activations=(state.activations??0)+1;return update(tabId,changes);};
    chrome.tabs.sendMessage=async(tabId,message,options)=>{if(typeof message==='object'&&message!==null&&'type' in message&&message.type==='site/ping'){state.navWaiting=true;await new Promise<void>(resolve=>{state.releaseNav=resolve;});}return send(tabId,message,options);};
  });
  await chooseSwitch(page,'목표 탭');await expect.poll(()=>serviceWorker.evaluate(()=>(globalThis as typeof globalThis & {navWaiting?:boolean}).navWaiting)).toBe(true);
  const panel=page.locator('tremor-helper-root').locator('.switch-panel');await expect(panel).toHaveAttribute('data-mode','executing');await page.keyboard.press('Space');await expect(panel).toHaveAttribute('data-mode','paused');
  await serviceWorker.evaluate(()=>{(globalThis as typeof globalThis & {releaseNav?:()=>void}).releaseNav?.();});await page.waitForTimeout(300);expect(await serviceWorker.evaluate(()=>(globalThis as typeof globalThis & {activations?:number}).activations)).toBe(0);
  await expect(panel).toHaveAttribute('data-mode','paused');
});
