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
