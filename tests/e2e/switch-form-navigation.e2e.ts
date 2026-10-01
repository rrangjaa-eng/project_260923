import { test, expect } from './fixtures';
import { chooseSwitch, startSwitch } from './switch-helpers';
test.beforeEach(async ({ serviceWorker }) => {
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
});
const form = `<form onsubmit="window.submits=(window.submits||0)+1;return false">
<label>첫 문장<input id="first" value="처음"></label><label>둘째 문장<textarea id="second">다음</textarea></label>
<label>PW<input id="hidden-a" value="secret-a"></label><label>인증번호<input id="hidden-b" value="secret-b"></label>
<label>보안카드<input id="hidden-c" value="secret-c"></label><input aria-label="암호" type="password" value="secret-d">
<select aria-label="분류"><option>하나</option></select><input aria-label="파일" type="file"><button>제출</button></form>
<script>document.querySelectorAll('#first,#second').forEach(el=>el.setSelectionRange(el.value.length,el.value.length));window.inputs=0;window.changes=0;document.addEventListener('input',()=>window.inputs++);document.addEventListener('change',()=>window.changes++);</script>`;
test('form overview reads only field names, excludes sensitive and unsupported controls, and fits real viewports', async ({ context, serviceWorker, servePage, expectNoExternalRequests }) => {
  servePage('http://practice.test/form.html', form);
  const page = await context.newPage(); await page.goto('http://practice.test/form.html'); await startSwitch(page); await chooseSwitch(page, '글쓰기'); await chooseSwitch(page, '양식 한 장 보기');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await expect(panel.locator('.switch-choice[data-item-id^="form-field:"]')).toHaveText(['첫 문장', '둘째 문장']);
  await expect(panel).not.toContainText('secret'); await expect(panel.locator('.switch-draft')).toHaveCount(0);
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const metrics = await panel.evaluate((el) => ({ right: el.getBoundingClientRect().right, bottom: el.getBoundingClientRect().bottom, choices: Array.from(el.querySelectorAll('.switch-choice')).map((choice) => ({ height: choice.getBoundingClientRect().height, font: parseFloat(getComputedStyle(choice).fontSize) })) }));
    expect(metrics.right).toBeLessThanOrEqual(width); expect(metrics.bottom).toBeLessThanOrEqual(800);
    for (const choice of metrics.choices) { expect(choice.height).toBeGreaterThanOrEqual(56); expect(choice.font).toBeGreaterThanOrEqual(18); }
    await page.screenshot({ path: `docs/verification/form-overview-${String(width)}.png` });
  }
  const stored = await serviceWorker.evaluate(async () => JSON.stringify({ local: await chrome.storage.local.get(null), session: await chrome.storage.session.get(null) }));
  expect(stored).not.toContain('secret'); expect(stored).not.toContain('처음'); expect(stored).not.toContain('다음');
  expect(await page.evaluate(() => [(window as Window & { inputs?: number }).inputs, (window as Window & { changes?: number }).changes])).toEqual([0, 0]); expectNoExternalRequests();
});
test('Space field movement preserves each draft and original workspace; only explicit apply dispatches input once', async ({ context, serviceWorker, servePage, expectNoExternalRequests }) => {
  test.setTimeout(150000); servePage('http://practice.test/form-drafts.html', form);
  const page = await context.newPage(); await page.goto('http://practice.test/form-drafts.html'); await startSwitch(page); await chooseSwitch(page, '글쓰기'); await chooseSwitch(page, '새 문장'); await chooseSwitch(page, '띄어쓰기');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await chooseSwitch(page, '양식 한 장 보기'); await chooseSwitch(page, '첫 문장'); await chooseSwitch(page, '띄어쓰기');
  await expect.poll(()=>panel.locator('.switch-draft').textContent()).toBe('처음 '); await chooseSwitch(page, '다음 칸'); await expect.poll(()=>panel.locator('.switch-draft').textContent()).toBe('다음');
  await chooseSwitch(page, '띄어쓰기'); await chooseSwitch(page, '이전 칸'); await expect.poll(()=>panel.locator('.switch-draft').textContent()).toBe('처음 ');
  await expect(page.locator('#first')).toHaveValue('처음'); await expect(page.locator('#second')).toHaveValue('다음');
  await expect(panel.locator('.switch-choice[data-item-id="search"]')).toHaveCount(0);
  await chooseSwitch(page, '입력칸에 적용'); await expect(page.locator('#first')).toHaveValue('처음 ');
  expect(await page.evaluate(() => [(window as Window & { inputs?: number }).inputs, (window as Window & { changes?: number }).changes, (window as Window & { submits?: number }).submits ?? 0])).toEqual([1, 1, 0]);
  await chooseSwitch(page, '원래 화면으로'); await expect.poll(()=>panel.locator('.switch-draft').textContent()).toBe(' '); await expect(panel.locator('h2')).toHaveText('글쓰기');
  await chooseSwitch(page, '양식 한 장 보기'); await chooseSwitch(page, '둘째 문장'); await expect.poll(()=>panel.locator('.switch-draft').textContent()).toBe('다음 ');
  const stored = await serviceWorker.evaluate(async () => JSON.stringify(await chrome.storage.session.get(null))); expect(stored).not.toContain('처음'); expect(stored).not.toContain('다음'); expectNoExternalRequests();
});

test('invalidation preserves the original workspace and offers the unbound form draft without applying', async ({ context, servePage }) => {
  test.setTimeout(120000); servePage('http://practice.test/invalidate-form.html', form);
  const page = await context.newPage(); await page.goto('http://practice.test/invalidate-form.html'); await startSwitch(page); await chooseSwitch(page, '글쓰기'); await chooseSwitch(page, '새 문장'); await chooseSwitch(page, '띄어쓰기');
  await chooseSwitch(page, '양식 한 장 보기'); await chooseSwitch(page, '첫 문장'); await chooseSwitch(page, '띄어쓰기');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel');
  await page.evaluate(() => { const frame=document.createElement('iframe');frame.src='about:blank';document.body.append(frame); });
  await expect(panel).toHaveAttribute('data-mode', 'paused'); await expect.poll(()=>panel.locator('.switch-draft').textContent()).toBe(' ');
  await page.keyboard.press('Space'); await page.waitForTimeout(125); await chooseSwitch(page, '글쓰기'); await chooseSwitch(page, '양식 작성 문장 복구');
  await expect.poll(()=>panel.locator('.switch-draft').textContent()).toBe('처음 '); await chooseSwitch(page, '입력칸에 적용'); await expect(panel.locator('.switch-status')).toContainText('먼저 선택');
  await expect(page.locator('#first')).toHaveValue('처음'); await chooseSwitch(page,'띄어쓰기'); await chooseSwitch(page, '원래 화면으로'); await expect.poll(()=>panel.locator('.switch-draft').textContent()).toBe(' ');
  await chooseSwitch(page,'양식 작성 문장 복구'); await expect.poll(()=>panel.locator('.switch-draft').textContent()).toBe('처음  ');
});
test('rest during phrase approval returns to form overview and keeps the shown field aligned with apply', async ({ context, serviceWorker, servePage }) => {
  test.setTimeout(120000); await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchPhrases: ['문구'] })); servePage('http://practice.test/approval-form.html', form);
  const page = await context.newPage(); await page.goto('http://practice.test/approval-form.html'); await startSwitch(page); await chooseSwitch(page, '글쓰기'); await chooseSwitch(page, '양식 한 장 보기'); await chooseSwitch(page, '첫 문장');
  await chooseSwitch(page, '문구'); await chooseSwitch(page, '문구 관리'); await chooseSwitch(page, '문구'); await chooseSwitch(page, '저장 문구 삭제'); await chooseSwitch(page, '쉬기');
  const panel = page.locator('tremor-helper-root').locator('.switch-panel'); await page.keyboard.press('Space'); await page.waitForTimeout(125);
  await expect(panel.locator('h2')).toContainText('양식 한 장 보기'); await expect(panel.locator('.switch-choice[data-item-id^="group:"]')).toHaveCount(0);
  await chooseSwitch(page, '둘째 문장'); await expect(panel.locator('h2')).toContainText('둘째 문장'); await chooseSwitch(page, '띄어쓰기'); await chooseSwitch(page, '입력칸에 적용');
  await expect(page.locator('#first')).toHaveValue('처음'); await expect(page.locator('#second')).toHaveValue('다음 ');
  expect(await serviceWorker.evaluate(async () => (await chrome.storage.local.get('switchPhrases')).switchPhrases)).toEqual(['문구']);
});

test('cached cursor, undo and partial Hangul survive field moves; externally changed value refuses apply', async ({ context, servePage }) => {
  test.setTimeout(160000); servePage('http://practice.test/form-state.html', form);
  const page=await context.newPage();await page.goto('http://practice.test/form-state.html');
  await page.locator('#first').evaluate((el)=>{const input=el as HTMLInputElement;input.setSelectionRange(0,1,'backward');});
  await startSwitch(page);await chooseSwitch(page,'글쓰기');await chooseSwitch(page,'양식 한 장 보기');await chooseSwitch(page,'첫 문장');
  const panel=page.locator('tremor-helper-root').locator('.switch-panel');
  await chooseSwitch(page,'띄어쓰기');await chooseSwitch(page,'다음 칸');await chooseSwitch(page,'이전 칸');
  await expect.poll(()=>panel.locator('.switch-draft').textContent()).toBe(' 음');await chooseSwitch(page,'수정');await chooseSwitch(page,'입력 되돌리기');await chooseSwitch(page,'상위로');
  await expect(panel.locator('.switch-selection')).toHaveText('처');
  await chooseSwitch(page,'한글 쓰기');await chooseSwitch(page,'ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ');await chooseSwitch(page,'ㄱ');await chooseSwitch(page,'상위로');await chooseSwitch(page,'상위로');await chooseSwitch(page,'상위로');
  await expect(panel.locator('.switch-draft')).toContainText('[ㄱ]');await chooseSwitch(page,'다음 칸');await chooseSwitch(page,'이전 칸');await expect(panel.locator('.switch-draft')).toContainText('[ㄱ]');
  await chooseSwitch(page,'쉬기');await page.keyboard.press('Space');await page.waitForTimeout(125);await expect(panel.locator('.switch-draft')).toContainText('[ㄱ]');
  await chooseSwitch(page,'다음 칸');await page.locator('#first').evaluate((el)=>{(el as HTMLInputElement).value='사이트 변경';});await chooseSwitch(page,'이전 칸');
  await chooseSwitch(page,'입력칸에 적용');await expect(panel.locator('.switch-status')).toContainText('바뀌었어요');await expect(page.locator('#first')).toHaveValue('사이트 변경');
});
test('late selected-field capture after blur cannot change the overview or apply any input', async ({ context, serviceWorker, servePage }) => {
  test.setTimeout(90000);servePage('http://practice.test/form-late.html',form);const page=await context.newPage();await page.goto('http://practice.test/form-late.html');await startSwitch(page);await chooseSwitch(page,'글쓰기');await chooseSwitch(page,'양식 한 장 보기');
  await serviceWorker.evaluate(()=>{
    const send=chrome.tabs.sendMessage.bind(chrome.tabs);const held=globalThis as typeof globalThis&{heldFormReply?:boolean;releaseFormReply?:()=>void};
    chrome.tabs.sendMessage=async(tabId,message,options)=>{
      const result=await send(tabId,message,options);
      if(typeof message==='object'&&message!==null&&'action' in message&&typeof message.action==='object'&&message.action!==null&&'kind' in message.action&&message.action.kind==='capture'){
        held.heldFormReply=true;await new Promise<void>((resolve)=>{held.releaseFormReply=resolve;});
      }
      return result;
    };
  });
  await chooseSwitch(page,'첫 문장');await expect.poll(()=>serviceWorker.evaluate(()=>(globalThis as typeof globalThis&{heldFormReply?:boolean}).heldFormReply)).toBe(true);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const panel=page.locator('tremor-helper-root').locator('.switch-panel');await expect(panel).toHaveAttribute('data-mode','paused');
  await serviceWorker.evaluate(()=>{(globalThis as typeof globalThis&{releaseFormReply?:()=>void}).releaseFormReply?.();});await page.waitForTimeout(400);
  await expect(panel).toHaveAttribute('data-mode','paused');await expect(panel.locator('.switch-draft')).toHaveCount(0);await expect(page.locator('#first')).toHaveValue('처음');
  expect(await page.evaluate(()=>(window as Window&{inputs?:number}).inputs)).toBe(0);
});
test('overview order stays fixed until explicit refresh and a live sensitive relabel refuses capture', async ({ context, servePage }) => {
  test.setTimeout(90000);servePage('http://practice.test/form-order.html',form);const page=await context.newPage();await page.goto('http://practice.test/form-order.html');await startSwitch(page);await chooseSwitch(page,'글쓰기');await chooseSwitch(page,'양식 한 장 보기');
  const panel=page.locator('tremor-helper-root').locator('.switch-panel');
  await page.evaluate(()=>{const first=document.querySelector('#first')?.parentElement;const second=document.querySelector('#second')?.parentElement;if(!first||!second)throw new Error('missing fields');first.before(second);const extra=document.createElement('input');extra.setAttribute('aria-label','새 칸');document.querySelector('form')?.append(extra);});
  await expect(panel.locator('.switch-choice[data-item-id^="form-field:"]')).toHaveText(['첫 문장','둘째 문장']);
  await chooseSwitch(page,'양식 목록 새로 읽기');await expect(panel.locator('.switch-choice[data-item-id^="form-field:"]')).toHaveText(['둘째 문장','첫 문장','새 칸']);
  await page.evaluate(()=>{const label=document.querySelector('#first')?.parentElement?.firstChild;if(label)label.textContent='PW';});
  // 목록 갱신 뒤에는 새 민감칸을 제외한다. 값은 capture하지 않는다.
  await chooseSwitch(page,'양식 목록 새로 읽기');await expect(panel.locator('.switch-choice[data-item-id^="form-field:"]')).toHaveText(['둘째 문장','새 칸']);await expect(panel).not.toContainText('secret');
});

test('long selected-field context and exit stay inside the viewport while only the choices scroll', async ({ context, servePage }) => {
  test.setTimeout(60000);const label='긴 입력칸 이름 '.repeat(12).trim();servePage('http://practice.test/form-context.html',`<label>${label}<textarea>작성 문장</textarea></label>`);
  const page=await context.newPage();await page.goto('http://practice.test/form-context.html');await startSwitch(page);await chooseSwitch(page,'글쓰기');await chooseSwitch(page,'양식 한 장 보기');await chooseSwitch(page,label);
  const panel=page.locator('tremor-helper-root').locator('.switch-panel');
  for(const width of [360,768,1280]){
    await page.setViewportSize({width,height:800});
    const metrics=await panel.evaluate((el)=>{const heading=el.querySelector('h2');const status=el.querySelector('.switch-status');if(!heading||!status)throw new Error('missing context');const box=el.getBoundingClientRect();return {x:box.x,right:box.right,bottom:box.bottom,headingTop:heading.getBoundingClientRect().top,statusBottom:status.getBoundingClientRect().bottom,pageY:window.scrollY,choices:Array.from(el.querySelectorAll('.switch-choice')).map((choice)=>({height:choice.getBoundingClientRect().height,font:parseFloat(getComputedStyle(choice).fontSize)}))};});
    expect(metrics.x).toBeGreaterThanOrEqual(0);expect(metrics.right).toBeLessThanOrEqual(width);expect(metrics.bottom).toBeLessThanOrEqual(800);expect(metrics.headingTop).toBeGreaterThanOrEqual(0);expect(metrics.statusBottom).toBeLessThanOrEqual(800);expect(metrics.pageY).toBe(0);
    for(const choice of metrics.choices){expect(choice.height).toBeGreaterThanOrEqual(56);expect(choice.font).toBeGreaterThanOrEqual(18);}
    await expect(panel.locator('h2')).toContainText('양식 1/1');await expect(panel.locator('.switch-choice[data-item-id="form-exit"]')).toHaveText('원래 화면으로');
    await page.screenshot({path:`docs/verification/form-context-${String(width)}.png`});
  }
  await chooseSwitch(page,'원래 화면으로');await expect(page.locator('textarea')).toHaveValue('작성 문장');
});
