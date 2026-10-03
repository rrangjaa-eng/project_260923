import fs from 'node:fs';
import os from 'node:os';
import { test, expect } from '../../../tests/e2e/fixtures';
import type { Page } from '@playwright/test';
type Key={down:number;up?:number;ui?:number;label:string};
type Meter={keys:Key[];events:{kind:string;at:number}[];modeAt:number;mode:string;signature:string};
declare global {interface Window {speedMeter:Meter;speedClicks:number}}
const resultPath=process.env.SPEED_RESULTS??'/tmp/browser-speed-results.jsonl';
const panel=(p:Page)=>p.locator('tremor-helper-root').locator('.switch-panel');
async function instrument(page:Page){
 await page.evaluate(()=>{
  const m:Meter=window.speedMeter={keys:[],events:[],modeAt:performance.now(),mode:'paused',signature:''};
  for(const kind of ['click','input','scroll'])window.addEventListener(kind,e=>{if(kind!=='click'||e.target instanceof HTMLElement&&e.target.id==='open')m.events.push({kind,at:performance.now()});},true);
  const root=document.querySelector('tremor-helper-root')?.shadowRoot;if(!root)throw Error('missing helper root');
  const observe=()=>{const p=root.querySelector('.switch-panel');const mode=p?.getAttribute('data-mode')??'';if(mode!==m.mode){m.mode=mode;m.modeAt=performance.now();}const signature=[mode,p?.querySelector('.switch-status')?.textContent,p?.querySelector('.switch-draft')?.textContent,...Array.from(p?.querySelectorAll('.switch-choice')??[]).map(x=>x.textContent)].join('|');if(signature!==m.signature){m.signature=signature;const k=m.keys.at(-1);if(k&&k.ui===undefined)k.ui=performance.now();}};
  observe();new MutationObserver(observe).observe(root,{subtree:true,childList:true,characterData:true,attributes:true});
 });
}
async function press(page:Page){await page.keyboard.press('Space',{delay:30});await page.waitForTimeout(40);}
async function choose(page:Page,label:string,protection:number){
 await page.waitForFunction(({label,protection})=>{const root=document.querySelector('tremor-helper-root')?.shadowRoot;const m=window.speedMeter;return root?.querySelector('.switch-choice[aria-current="true"]')?.textContent===label&&performance.now()-(m.keys.at(-1)?.up??-9999)>protection+20&&(m.mode!=='confirming'||performance.now()-m.modeAt>1050);},{label,protection},{timeout:45000});
 await press(page);
}
const simple='<title>출발 화면</title><button type="button" id="open" onclick="window.speedClicks++">열기</button><label>시험 문장<input id="field"></label><div style="height:9000px">본문</div><script>window.speedClicks=0</script>';
function html(load:boolean){return simple+(load?'<div>'+Array.from({length:2000},(_,i)=>`<p>부하 문단 ${String(i)}</p>`).join('')+'</div><script>setInterval(()=>{const t=performance.now();while(performance.now()-t<20){}},100)</script>':'');}
const append=(value:unknown)=>{fs.appendFileSync(resultPath,JSON.stringify(value)+'\n');console.log('MEASUREMENT '+JSON.stringify(value));};
test('bounded browser speed measurements',async({context,serviceWorker,servePage,extensionId,expectNoExternalRequests})=>{
 await context.addInitScript(()=>{
  window.speedMeter={keys:[],events:[],modeAt:performance.now(),mode:'paused',signature:''};
  window.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat)window.speedMeter.keys.push({down:performance.now(),label:document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.switch-choice[aria-current="true"]')?.textContent??'start/stop'});},true);
  window.addEventListener('keyup',e=>{if(e.code==='Space'){const k=window.speedMeter.keys.at(-1);if(k)k.up=performance.now();}},true);
 });
 const phase=process.env.SPEED_PHASE??'quick';
 append({kind:'environment',phase,node:process.version,cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,os:os.release(),chromium:context.browser()?.version(),viewport:{width:1280,height:800},headless:true,hardwareConcurrency:await (await context.newPage()).evaluate(()=>navigator.hardwareConcurrency)});
 if(phase==='baseline'){
  await serviceWorker.evaluate(()=>chrome.storage.local.set({switchSettings:{schemaVersion:1,mode:'pointer',intervalMs:1500,protectionMs:300}}));
  for(const loaded of [false,true])for(const workload of ['click','scroll','write'])for(let repeat=0;repeat<5;repeat++){
   servePage('http://practice.test/speed',html(loaded));const page=await context.newPage();await page.goto('http://practice.test/speed');await page.bringToFront();await expect(page.locator('#open')).toBeVisible();await expect(panel(page)).toHaveCount(0);
   const start=performance.now();
   if(workload==='click'){await page.locator('#open').click();await expect.poll(()=>page.evaluate(()=>window.speedClicks)).toBe(1);}
   if(workload==='scroll'){await page.mouse.wheel(0,640);await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(0);}
   if(workload==='write'){await page.locator('#field').click();await page.keyboard.insertText('가');await page.keyboard.press('a',{delay:30});await page.keyboard.press('1',{delay:30});await expect(page.locator('#field')).toHaveValue('가a1');}
   append({kind:'baseline',phase,loaded,workload,repeat,totalMs:performance.now()-start,method:workload==='write'?'field click + Unicode insertion 가 (not IME) + a/1 keypress each30ms':workload==='click'?'Playwright locator.click':'mouse.wheel 640px',finalScrollY:await page.evaluate(()=>scrollY)});await page.close();
  }
  expectNoExternalRequests();return;
 }
 const workloads=phase==='reuse'?['phrase']:phase==='controls'?['cancel','stop']:phase==='quick'?['click','scroll']:phase==='loaded'?['click','scroll']:phase==='fast'?['click','write']:['cancel','stop','tab','newtab','write','pin'];
 const interval=phase==='fast'?800:1500,protection=phase==='fast'?100:300,load=phase==='loaded';
 await serviceWorker.evaluate(async settings=>chrome.storage.local.set({switchSettings:settings}),{schemaVersion:1,mode:'switch',intervalMs:interval,protectionMs:protection});
 if(phase==='reuse')await serviceWorker.evaluate(()=>chrome.storage.local.set({switchPhrases:['가a1']}));
 servePage('http://practice.test/speed',html(load));servePage('http://practice.test/other-speed','<title>목표 탭</title><p>다른 읽기 화면</p>');
 let run=0;
 for(const workload of workloads)for(let repeat=0;repeat<3;repeat++){
  for(const old of context.pages())await old.close();
  await serviceWorker.evaluate(async()=>chrome.storage.sync.remove('site:http://practice.test'));
  let other:Page|undefined;
  if(workload==='tab'){other=await context.newPage();await other.goto('http://practice.test/other-speed');}
  const page=await context.newPage();const readyStart=performance.now();await page.goto('http://practice.test/speed');await page.bringToFront();await expect(panel(page)).toBeVisible();const readyMs=performance.now()-readyStart;
  await instrument(page);const started=performance.now();await press(page);expect(await page.evaluate(()=>window.speedMeter.keys.length)).toBe(1);
  const pick=(label:string)=>choose(page,label,protection);
  let extra:Record<string,unknown>={};
  if(workload==='click'||workload==='cancel'){
   await pick('페이지 항목');await pick('열기');await pick(workload==='cancel'?'취소':'열기');
   await expect.poll(()=>page.evaluate(()=>window.speedClicks)).toBe(workload==='cancel'?0:1);
  }else if(workload==='scroll'||workload==='stop'){
   await pick('읽기·이동');await pick(workload==='scroll'?'한 화면 아래':'자동 스크롤');await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(0);
   if(workload==='stop'){await press(page);await expect(panel(page)).toHaveAttribute('data-mode','itemScan');const y=await page.evaluate(()=>scrollY);await page.waitForTimeout(150);expect(await page.evaluate(()=>scrollY)).toBe(y);}
  }else if(workload==='tab'){
   await pick('읽기·이동');await pick('열린 탭');await pick('목표 탭');const target=other;if(!target)throw Error('target tab missing');await expect.poll(()=>target.evaluate(()=>document.hasFocus())).toBe(true);
  }else if(workload==='newtab'){
   await pick('읽기·이동');const opened=context.waitForEvent('page');await pick('새 탭');const newPage=await opened;await expect(newPage).toHaveURL(`chrome-extension://${extensionId}/start.html`);await expect(panel(newPage)).toBeVisible();
  }else if(workload==='phrase'){
   for(const label of ['글쓰기','양식 한 장 보기','시험 문장','문구','가a1','입력칸에 적용'])await pick(label);
   await expect(page.locator('#field')).toHaveValue('가a1');
  }else if(workload==='write'){
   await pick('글쓰기');await pick('양식 한 장 보기');await pick('시험 문장');
   for(const label of ['한글 쓰기','ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ','ㄱ','ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ','ㅏ','없음 ㄱ ㄲ ㄳ ㄴ ㄵ','없음','영문·숫자 쓰기','a b c d e f','a','영문·숫자 쓰기','W X Y Z 0 1','1','입력칸에 적용'])await pick(label);
   await expect(page.locator('#field')).toHaveValue('가a1');
  }else if(workload==='pin'){
   for(const label of ['읽기·이동','번호 고정 설정','1번 · 비어 있음','대상 고르기','고정할 대상 · 열기','확인 · 번호 고정'])await pick(label);
   extra={pinSetupMs:performance.now()-started,pinSetupSpaces:await page.evaluate(()=>window.speedMeter.keys.length)};
   // Reload is excluded from reuse timing; both routes start from the paused root menu.
   await page.reload();await expect(panel(page)).toBeVisible();await instrument(page);const reuse=performance.now();await press(page);
   for(const label of ['읽기·이동','고정 번호','1번 · 열기','열기'])await pick(label);
   await expect.poll(()=>page.evaluate(()=>window.speedClicks)).toBe(1);extra.pinReuseMs=performance.now()-reuse;
  }
  const totalMs=performance.now()-started;const meter=await page.evaluate(()=>window.speedMeter);
  const last=meter.keys.at(-1);const action=meter.events.find(e=>last?.up!==undefined&&e.at>=last.up);
  append({kind:'sample',phase,workload,repeat,run:run++,intervalMs:interval,protectionMs:protection,loaded:load,readyMs,totalMs,spaces:meter.keys.length,lastKeyToActionMs:action&&last?.up!==undefined?action.at-last.up:null,keys:meter.keys,events:meter.events,...extra});
 }
 expectNoExternalRequests();
});
