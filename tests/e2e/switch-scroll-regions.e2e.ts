import {test,expect} from './fixtures';
import {chooseSwitch,startSwitch} from './switch-helpers';

const fixture=(name='오른쪽 본문')=>`<!doctype html><html lang="ko"><head><style>
body{margin:16px;min-height:2400px}main{display:flex;gap:16px;margin-top:580px}.region{width:calc(50% - 8px);height:180px;overflow-y:auto;scroll-behavior:smooth;border:1px solid} .content{height:2400px}button{height:56px}
</style></head><body><button id="unwanted" onclick="this.dataset.clicked='true'">사이트 버튼</button><main><section id="left" class="region" aria-label="왼쪽 본문"><div class="content">왼쪽 읽기</div></section><section id="right" class="region" aria-label="${name}"><div class="content">오른쪽 읽기</div></section></main></body></html>`;
test.beforeEach(async({serviceWorker})=>{await serviceWorker.evaluate(async()=>chrome.storage.local.set({switchSettings:{schemaVersion:1,mode:'switch',intervalMs:800,protectionMs:100}}));});

for(const width of [360,768,1280])test(`Space selects one vertical region and stops without another action at ${String(width)}px`,async({context,servePage,expectNoExternalRequests})=>{
 test.setTimeout(100000);servePage('http://practice.test/regions.html',fixture());const page=await context.newPage();await page.setViewportSize({width,height:900});await page.goto('http://practice.test/regions.html');
 await startSwitch(page);await chooseSwitch(page,'읽기·이동');await chooseSwitch(page,'세로 스크롤 영역 선택');await chooseSwitch(page,'영역 2 · 오른쪽 본문');
 const panel=page.locator('tremor-helper-root').locator('.switch-panel');await expect(panel.locator('h2')).toContainText('영역 2 · 오른쪽 본문');
 await expect(page.locator('tremor-helper-root').locator('.ring')).toHaveAttribute('data-visible','true');
 const positions=()=>page.evaluate(()=>({left:document.querySelector('#left')?.scrollTop,right:document.querySelector('#right')?.scrollTop,page:scrollY,clicked:document.querySelector('#unwanted')?.getAttribute('data-clicked')}));
 expect(await positions()).toEqual({left:0,right:0,page:0,clicked:null});await chooseSwitch(page,'한 화면 아래');expect(await positions()).toEqual({left:0,right:144,page:0,clicked:null});
 await chooseSwitch(page,'자동 스크롤');await expect.poll(async()=>(await positions()).right).toBeGreaterThan(144);
 await page.keyboard.down('Space');await expect(panel).toHaveAttribute('data-mode','itemScan');const stopped=await positions();await page.waitForTimeout(350);await page.keyboard.up('Space');expect(await positions()).toEqual(stopped);
 await expect(panel.locator('.switch-status')).toContainText('멈췄어요');
 const geometry=await panel.evaluate(el=>{const box=el.getBoundingClientRect(),choice=el.querySelector('.switch-choice[aria-current="true"]')?.getBoundingClientRect(),list=el.querySelector('.switch-choices')?.getBoundingClientRect();return {right:box.right,bottom:box.bottom,choiceTop:choice?.top,choiceBottom:choice?.bottom,listTop:list?.top,listBottom:list?.bottom};});
 expect(geometry.right).toBeLessThanOrEqual(width);expect(geometry.bottom).toBeLessThanOrEqual(900);expect(geometry.choiceTop).toBeDefined();expect(geometry.choiceTop).toBeGreaterThanOrEqual(geometry.listTop??0);expect(geometry.choiceBottom).toBeLessThanOrEqual(geometry.listBottom??0);
 await chooseSwitch(page,'상위로');await expect(panel.locator('h2')).toHaveText('스페이스바 작업판');expectNoExternalRequests();
});

test('a replaced region is refused and a refreshed choice needs explicit selection',async({context,servePage})=>{
 test.setTimeout(100000);servePage('http://practice.test/regions-replace.html',fixture());const page=await context.newPage();await page.goto('http://practice.test/regions-replace.html');await startSwitch(page);await chooseSwitch(page,'읽기·이동');await chooseSwitch(page,'세로 스크롤 영역 선택');await chooseSwitch(page,'영역 1 · 왼쪽 본문');
 await page.evaluate(()=>{const el=document.querySelector('#left');el?.replaceWith(el.cloneNode(true));});await chooseSwitch(page,'한 화면 아래');
 const panel=page.locator('tremor-helper-root').locator('.switch-panel');await expect(panel.locator('.switch-status')).toContainText('다시 선택');expect(await page.evaluate(()=>scrollY)).toBe(0);expect(await page.locator('#left').evaluate(el=>el.scrollTop)).toBe(0);
 await chooseSwitch(page,'세로 스크롤 영역 선택');await chooseSwitch(page,'취소 · 읽기·이동으로');await chooseSwitch(page,'한 화면 아래');expect(await page.locator('#left').evaluate(el=>el.scrollTop)).toBe(0);
 await chooseSwitch(page,'세로 스크롤 영역 선택');await chooseSwitch(page,'영역 1 · 왼쪽 본문');await chooseSwitch(page,'한 화면 아래');expect(await page.locator('#left').evaluate(el=>el.scrollTop)).toBe(144);
});

test('automatic region scrolling stops on removal and a new tab, and resume never restarts it',async({context,servePage})=>{
 test.setTimeout(110000);servePage('http://practice.test/regions-stop.html',fixture());servePage('http://practice.test/stop-target.html','<p>다른 탭</p>');const page=await context.newPage();await page.goto('http://practice.test/regions-stop.html');await startSwitch(page);await chooseSwitch(page,'읽기·이동');await chooseSwitch(page,'세로 스크롤 영역 선택');await chooseSwitch(page,'영역 2 · 오른쪽 본문');await chooseSwitch(page,'자동 스크롤');
 await expect.poll(()=>page.locator('#right').evaluate(el=>el.scrollTop)).toBeGreaterThan(0);await page.locator('#right').evaluate(el=>{el.remove();});const panel=page.locator('tremor-helper-root').locator('.switch-panel');await expect(panel).toHaveAttribute('data-mode','itemScan');await expect(panel.locator('.switch-status')).toContainText('다시 선택');expect(await page.evaluate(()=>scrollY)).toBe(0);
 await chooseSwitch(page,'세로 스크롤 영역 선택');await chooseSwitch(page,'영역 1 · 왼쪽 본문');await chooseSwitch(page,'자동 스크롤');await expect.poll(()=>page.locator('#left').evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
 const other=await context.newPage();await other.goto('http://practice.test/stop-target.html');await other.bringToFront();await expect(panel).toHaveAttribute('data-mode','paused');const stopped=await page.locator('#left').evaluate(el=>el.scrollTop);await page.bringToFront();await page.keyboard.press('Space');await expect(panel).toHaveAttribute('data-mode','itemScan');await page.waitForTimeout(200);expect(await page.locator('#left').evaluate(el=>el.scrollTop)).toBe(stopped);
});

test('long region names stay within a narrow panel and its current choice is visible',async({context,servePage})=>{
 test.setTimeout(70000);const label='LongUnbrokenRegionName'.repeat(5);servePage('http://practice.test/regions-long.html',fixture(label));const page=await context.newPage();await page.setViewportSize({width:360,height:800});await page.goto('http://practice.test/regions-long.html');await startSwitch(page);await chooseSwitch(page,'읽기·이동');await chooseSwitch(page,'세로 스크롤 영역 선택');await chooseSwitch(page,`영역 2 · ${label.slice(0,80)}`);
 const panel=page.locator('tremor-helper-root').locator('.switch-panel');const geometry=await panel.evaluate(el=>{const title=el.querySelector('h2'),choice=el.querySelector('.switch-choice[aria-current="true"]')?.getBoundingClientRect(),list=el.querySelector('.switch-choices')?.getBoundingClientRect();return {width:el.clientWidth,scroll:el.scrollWidth,titleWidth:title?.clientWidth,titleScroll:title?.scrollWidth,choiceTop:choice?.top,choiceBottom:choice?.bottom,listTop:list?.top,listBottom:list?.bottom};});expect(geometry.scroll).toBeLessThanOrEqual(geometry.width);expect(geometry.titleScroll).toBeLessThanOrEqual(geometry.titleWidth??0);expect(geometry.choiceTop).toBeDefined();expect(geometry.choiceTop).toBeGreaterThanOrEqual(geometry.listTop??0);expect(geometry.choiceBottom).toBeLessThanOrEqual(geometry.listBottom??0);
});
