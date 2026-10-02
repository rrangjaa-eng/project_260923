import {test,expect} from './fixtures';
import {chooseSwitch,startSwitch} from './switch-helpers';
test.beforeEach(async({serviceWorker,servePage})=>{
 await serviceWorker.evaluate(()=>chrome.storage.local.set({switchSettings:{schemaVersion:1,mode:'switch',intervalMs:800,protectionMs:100},switchPhrases:['아직 작성 중']}));
 servePage('http://practice.test/nav02.html','<title>출발 화면</title><label>문장<input></label><p>페이지</p>');
 servePage('http://practice.test/return.html','<title>돌아갈 화면</title><p>돌아갈 화면</p>');
});
test.afterEach(({expectNoExternalRequests})=>{expectNoExternalRequests();});
test('Space creates one helper tab in the same window and preserves source draft',async({context,serviceWorker,extensionId})=>{
 test.setTimeout(90000);const page=await context.newPage();await page.goto('http://practice.test/nav02.html');await startSwitch(page);await chooseSwitch(page,'글쓰기');await chooseSwitch(page,'새 문장');await chooseSwitch(page,'문구');await chooseSwitch(page,'아직 작성 중');await chooseSwitch(page,'상위로');await chooseSwitch(page,'읽기·이동');const opened=context.waitForEvent('page');await chooseSwitch(page,'새 탭');const helper=await opened;await helper.waitForLoadState();await expect(helper).toHaveURL(`chrome-extension://${extensionId}/start.html`);await expect(helper.locator('tremor-helper-root').locator('.switch-panel')).toBeVisible();
 const tabs=await serviceWorker.evaluate(()=>chrome.tabs.query({}));expect(tabs.filter(t=>t.url?.endsWith('/start.html'))).toHaveLength(1);expect(tabs.find(t=>t.url===page.url())?.windowId).toBe(tabs.find(t=>t.url===helper.url())?.windowId);
 await page.bringToFront();await expect(page.locator('tremor-helper-root').locator('.switch-draft')).toHaveText('아직 작성 중');
});
test('reload cancel keeps the document and explicit confirmation replaces it once',async({context})=>{
 test.setTimeout(80000);const page=await context.newPage();await page.goto('http://practice.test/nav02.html');await page.evaluate(()=>{document.body.dataset.original='yes';});await startSwitch(page);await chooseSwitch(page,'읽기·이동');await chooseSwitch(page,'새로고침');await chooseSwitch(page,'취소');expect(await page.locator('body').getAttribute('data-original')).toBe('yes');await chooseSwitch(page,'새로고침');const reload=page.waitForEvent('domcontentloaded');await chooseSwitch(page,'확인 · 새로고침');await reload;expect(await page.locator('body').getAttribute('data-original')).toBeNull();await expect(page.locator('tremor-helper-root').locator('.switch-panel')).toBeVisible();
});
for(const label of ['새로고침','탭 닫기'])test(`unapplied Korean draft blocks ${label}`,async({context})=>{
 test.setTimeout(80000);const page=await context.newPage();await page.goto('http://practice.test/nav02.html');await startSwitch(page);await chooseSwitch(page,'찾기');await chooseSwitch(page,'문장');await chooseSwitch(page,'문구');await chooseSwitch(page,'아직 작성 중');await chooseSwitch(page,'상위로');await chooseSwitch(page,'읽기·이동');await chooseSwitch(page,label);await expect(page.locator('tremor-helper-root').locator('.switch-status')).toContainText('적용하지 않은');await expect(page.getByLabel('문장')).toHaveValue('');await expect(page.locator('tremor-helper-root').locator('.switch-draft')).toHaveText('아직 작성 중');
});
test('close previews the same-window return page, cancels, then confirms once and leaves return paused',async({context})=>{
 test.setTimeout(100000);const target=await context.newPage();await target.goto('http://practice.test/return.html');const page=await context.newPage();await page.goto('http://practice.test/nav02.html');await page.bringToFront();await startSwitch(page);await chooseSwitch(page,'읽기·이동');await chooseSwitch(page,'탭 닫기');await expect(page.locator('tremor-helper-root').locator('.switch-draft')).toContainText('돌아갈 화면');await chooseSwitch(page,'취소');expect(page.isClosed()).toBe(false);await chooseSwitch(page,'탭 닫기');const closed=page.waitForEvent('close');await chooseSwitch(page,'확인 · 탭 닫기');await closed;await expect.poll(()=>target.evaluate(()=>document.hasFocus())).toBe(true);await expect(target.locator('tremor-helper-root').locator('.switch-panel')).toHaveAttribute('data-mode','paused');
});
test('a last tab cannot be closed',async({context})=>{
 test.setTimeout(60000);const page=await context.newPage();await page.goto('http://practice.test/nav02.html');for(const other of context.pages())if(other!==page)await other.close();await page.bringToFront();await startSwitch(page);await chooseSwitch(page,'읽기·이동');await chooseSwitch(page,'탭 닫기');await expect(page.locator('tremor-helper-root').locator('.switch-status')).toContainText('마지막 탭');expect(page.isClosed()).toBe(false);
});
