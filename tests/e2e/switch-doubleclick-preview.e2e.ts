import { test, expect } from './fixtures';
import { chooseSwitch, startSwitch } from './switch-helpers';
test('limited doubleclick keeps the full target name readable and rejects an early Space confirmation',async({context,serviceWorker,servePage,expectNoExternalRequests})=>{
 test.setTimeout(120000);const name='같은 이름이 길게 이어지는 업무 문서 '.repeat(4)+'마지막 대상 Z';
 await serviceWorker.evaluate(async()=>chrome.storage.local.set({switchSettings:{schemaVersion:1,mode:'switch',intervalMs:800,protectionMs:100}}));
 servePage('http://practice.test/long-double',`<button type="button" id="target">${name}</button><script>window.effects=0;document.body.addEventListener('dblclick',()=>window.effects++);document.body.addEventListener('click',()=>window.effects++)</script>`);
 const page=await context.newPage();await page.setViewportSize({width:360,height:800});await page.goto('http://practice.test/long-double');await startSwitch(page);await chooseSwitch(page,'읽기·이동');await chooseSwitch(page,'더블클릭 · 제한');await chooseSwitch(page,'대상 · '+Array.from(name).slice(0,24).join('')+'…');
 const panel=page.locator('tremor-helper-root').locator('.switch-panel');await page.keyboard.press('Space');await expect(panel).toHaveAttribute('data-mode','confirming');
 let seen=await panel.locator('.switch-draft').innerText();await page.waitForTimeout(1100);
 for(let i=0;i<10&&!seen.includes('마지막 대상 Z');i++){await chooseSwitch(page,'다음 대상 이름 읽기');seen+=await panel.locator('.switch-draft').innerText();expect(await panel.locator('.switch-draft').evaluate(el=>el.scrollHeight<=el.clientHeight)).toBe(true);}
 expect(seen).toContain('마지막 대상 Z');
 for(const width of [360,768,1280]){await page.setViewportSize({width,height:800});const metrics=await panel.evaluate(el=>({right:el.getBoundingClientRect().right,bottom:el.getBoundingClientRect().bottom,heights:Array.from(el.querySelectorAll('.switch-choice')).map(choice=>choice.getBoundingClientRect().height)}));expect(metrics.right).toBeLessThanOrEqual(width);expect(metrics.bottom).toBeLessThanOrEqual(800);metrics.heights.forEach(height=>{expect(height).toBeGreaterThanOrEqual(56);});}
 await chooseSwitch(page,'취소');expect(await page.evaluate(()=>(window as Window&{effects?:number}).effects)).toBe(0);expectNoExternalRequests();
});
