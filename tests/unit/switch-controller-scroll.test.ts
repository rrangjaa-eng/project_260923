// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {createSwitchController} from '../../src/page/input/switch-controller';
import type {Collector} from '../../src/page/collector/collector';
import type {InputPipeline} from '../../src/page/input/pipeline';
import type {SwitchState} from '../../src/core/switch-engine';
import {createScrollRegions} from '../../src/page/input/scroll-regions';

const view=vi.hoisted(()=>({state:null as SwitchState|null,title:'',notice:''}));
vi.mock('@/page/overlay/switch-panel',()=>({createSwitchPanel:()=>({render:(state:SwitchState,title:string,_text:string,notice:string)=>{Object.assign(view,{state,title,notice});},destroy:()=>{view.state=null;}})}));
const cleanups:Array<()=>void>=[];
beforeEach(()=>{vi.useFakeTimers({toFake:['setTimeout','clearTimeout','setInterval','clearInterval','performance']});document.body.innerHTML='';document.body.removeAttribute('style');Object.assign(view,{state:null,title:'',notice:''});});
afterEach(()=>{cleanups.splice(0).forEach(fn=>{fn();});vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});
function region(label:string){
 const el=document.createElement('div');el.setAttribute('aria-label',label);el.style.overflowY='auto';document.body.append(el);
 Object.defineProperties(el,{clientHeight:{configurable:true,value:200},scrollHeight:{configurable:true,value:2000},clientWidth:{value:200}});
 el.getBoundingClientRect=()=>new DOMRect(20,20,200,200);
 el.scrollTo=(options?:ScrollToOptions|number)=>{if(typeof options==='object')el.scrollTop=Math.max(0,Math.min(1800,options.top??el.scrollTop));};
 return el;
}
async function fixture(){
 const left=region('왼쪽 본문'),right=region('오른쪽 본문');
 const root=document.documentElement;Object.defineProperty(document,'scrollingElement',{configurable:true,value:root});
 Object.defineProperties(root,{clientHeight:{configurable:true,value:800},scrollHeight:{configurable:true,value:5000}});root.scrollTop=0;
 root.scrollTo=(options?:ScrollToOptions|number)=>{if(typeof options==='object')root.scrollTop=Math.max(0,Math.min(4200,options.top??root.scrollTop));};
 vi.spyOn(window,'scrollBy').mockImplementation((_x:number|ScrollToOptions,y?:number)=>{root.scrollTop+=y??0;});
 const collector:Collector={items:()=>[],get:()=>undefined,onChange:()=>undefined,refresh:()=>undefined};
 let consume:Parameters<InputPipeline['setSwitchHandler']>[0]=null;
 const pipeline:InputPipeline={setSwitchHandler:fn=>{consume=fn;},setSwitchExclusive:()=>undefined,onKey:()=>undefined,onPress:()=>undefined,setModal:()=>undefined};
 vi.stubGlobal('chrome',{runtime:{id:'unit',onMessage:{addListener:()=>undefined,removeListener:()=>undefined},sendMessage:()=>Promise.resolve({ok:true})},storage:{local:{get:()=>Promise.resolve({switchSettings:{schemaVersion:1,mode:'switch',intervalMs:800,protectionMs:300}})},onChanged:{addListener:()=>undefined,removeListener:()=>undefined}}});
 const abort=new AbortController();cleanups.push(()=>{abort.abort();});
 const controller=createSwitchController({collector,pipeline,enabled:()=>true,onExclusive:()=>undefined,signal:abort.signal});
 const event={code:'Space',isTrusted:true,repeat:false,isComposing:false,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false};
 const down=(flags:Partial<KeyboardEvent>={})=>consume?.('keyDown',{...event,...flags} as KeyboardEvent),up=()=>consume?.('keyUp',event as KeyboardEvent);
 async function press(){await vi.advanceTimersByTimeAsync(310);down();up();await vi.advanceTimersByTimeAsync(1);}
 async function choose(label:string){for(let i=0;i<170&&view.state?.items[view.state.scanIndex]?.label!==label;i++)await vi.advanceTimersByTimeAsync(100);expect(view.state?.items[view.state.scanIndex]?.label).toBe(label);await press();}
 await vi.advanceTimersByTimeAsync(1);await press();await choose('읽기·이동');
 return {left,right,root,choose,press,down,up,controller,abort};
}
it('offers explicit region selection before scrolling only the chosen region',async()=>{
 const f=await fixture();await f.choose('세로 스크롤 영역 선택');await f.choose('영역 2 · 오른쪽 본문');
 expect(view.title).toContain('오른쪽 본문');expect(f.right.scrollTop).toBe(0);
 await f.choose('한 화면 아래');expect(f.right.scrollTop).toBe(160);expect(f.left.scrollTop).toBe(0);expect(f.root.scrollTop).toBe(0);
 await f.choose('한 화면 위');expect(f.right.scrollTop).toBe(0);
});
it('the first Space down immediately stops auto scroll even inside selection protection and release does nothing',async()=>{
 const f=await fixture();await f.choose('자동 스크롤');expect(view.state?.mode).toBe('scrolling');
 f.down();expect(view.state?.mode).toBe('itemScan');const stopped=f.root.scrollTop;
 await vi.advanceTimersByTimeAsync(500);f.up();await vi.advanceTimersByTimeAsync(100);expect(f.root.scrollTop).toBe(stopped);expect(view.state?.mode).toBe('itemScan');
});
it('replacement refuses the old region without falling back to the page',async()=>{
 const f=await fixture();await f.choose('세로 스크롤 영역 선택');await f.choose('영역 1 · 왼쪽 본문');
 f.left.replaceWith(f.left.cloneNode(true));await f.choose('한 화면 아래');expect(f.root.scrollTop).toBe(0);expect(f.left.scrollTop).toBe(0);expect(view.notice).toContain('다시 선택');
});
it('removal and reinsertion of the same node invalidates its old selection',async()=>{
 const f=await fixture();await f.choose('세로 스크롤 영역 선택');await f.choose('영역 1 · 왼쪽 본문');
 f.left.remove();document.body.append(f.left);await f.choose('한 화면 아래');expect(f.left.scrollTop).toBe(0);expect(f.root.scrollTop).toBe(0);expect(view.notice).toContain('다시 선택');
});
it.each(['hidden','overflow','renamed'])('a %s region stops automatic movement and never scrolls the page',async(change)=>{
 const f=await fixture();await f.choose('세로 스크롤 영역 선택');await f.choose('영역 1 · 왼쪽 본문');await f.choose('자동 스크롤');await vi.advanceTimersByTimeAsync(90);expect(f.left.scrollTop).toBeGreaterThan(0);
 if(change==='hidden')f.left.hidden=true;else if(change==='overflow')f.left.style.overflowY='hidden';else f.left.setAttribute('aria-label','다른 내용');
 const stopped=f.left.scrollTop;await vi.advanceTimersByTimeAsync(90);expect(view.state?.mode).toBe('itemScan');expect(f.left.scrollTop).toBe(stopped);expect(f.root.scrollTop).toBe(0);expect(view.notice).toContain('다시 선택');
});
it('pause and pagehide stop, and a resume press cannot restart automatic movement',async()=>{
 const f=await fixture();await f.choose('자동 스크롤');await vi.advanceTimersByTimeAsync(90);f.controller.pause();const stopped=f.root.scrollTop;
 await vi.advanceTimersByTimeAsync(90);await f.press();await vi.advanceTimersByTimeAsync(90);expect(view.state?.mode).toBe('itemScan');expect(f.root.scrollTop).toBe(stopped);
 await f.choose('자동 스크롤');window.dispatchEvent(new Event('pagehide'));const hidden=f.root.scrollTop;await vi.advanceTimersByTimeAsync(90);expect(view.state?.mode).toBe('paused');expect(f.root.scrollTop).toBe(hidden);
});
it('repeat and composition do not stop, but a trusted new Space down does',async()=>{
 const f=await fixture();await f.choose('자동 스크롤');f.down({repeat:true});f.down({isComposing:true});f.down({shiftKey:true});expect(view.state?.mode).toBe('scrolling');
 f.down();expect(view.state?.mode).toBe('itemScan');f.up();expect(view.state?.scanIndex).toBe(0);
});
it('cancel preserves the chosen scope, while leaving reading and returning starts with an explicit page scope',async()=>{
 const f=await fixture();await f.choose('세로 스크롤 영역 선택');await f.choose('영역 2 · 오른쪽 본문');await f.choose('세로 스크롤 영역 선택');await f.choose('취소 · 읽기·이동으로');expect(view.title).toContain('오른쪽 본문');
 await f.choose('상위로');expect(view.title).toBe('스페이스바 작업판');await f.choose('읽기·이동');expect(view.title).toBe('읽기·이동 · 페이지 전체');expect(f.root.scrollTop).toBe(0);
});
it('automatic scrolling stops at the selected end instead of scrolling an ancestor',async()=>{
 const f=await fixture();await f.choose('세로 스크롤 영역 선택');await f.choose('영역 1 · 왼쪽 본문');f.left.scrollTop=1798;await f.choose('자동 스크롤');await vi.advanceTimersByTimeAsync(90);expect(f.left.scrollTop).toBe(1800);expect(f.root.scrollTop).toBe(0);expect(view.state?.mode).toBe('itemScan');expect(view.notice).toContain('끝');
});
it('discovery excludes hidden, clipped, editor, horizontal-only and extension regions without reading their contents',async()=>{
 await fixture();const hidden=region('숨김');hidden.hidden=true;const horizontal=region('가로');horizontal.style.overflowY='visible';
 const editor=region('편집');editor.contentEditable='true';const outside=region('화면 밖');outside.getBoundingClientRect=()=>new DOMRect(0,10000,200,200);
 const host=document.createElement('tremor-helper-root');document.body.append(host);host.append(region('확장'));
 const manager=createScrollRegions();cleanups.push(()=>{manager.destroy();});expect(manager.discover().map(r=>r.label)).toEqual(['페이지 전체','영역 1 · 왼쪽 본문','영역 2 · 오른쪽 본문']);
});
it('a locked page refuses programmatic scrolling',async()=>{
 const f=await fixture();document.body.style.overflowY='hidden';await f.choose('한 화면 아래');expect(f.root.scrollTop).toBe(0);expect(view.notice).toContain('다시 선택');document.body.style.overflowY='';
});
it.each(['opacity','collapse'])('an invisible page with %s refuses movement',async(kind)=>{
 const f=await fixture();if(kind==='opacity')document.body.style.opacity='0';else document.body.style.visibility='collapse';await f.choose('한 화면 아래');expect(f.root.scrollTop).toBe(0);expect(view.notice).toContain('다시 선택');
});
it('automatic scrolling stops when the browser cannot move the chosen region',async()=>{
 const f=await fixture();await f.choose('세로 스크롤 영역 선택');await f.choose('영역 1 · 왼쪽 본문');f.left.scrollTo=()=>undefined;await f.choose('자동 스크롤');await vi.advanceTimersByTimeAsync(60);expect(view.state?.mode).toBe('itemScan');expect(f.left.scrollTop).toBe(0);expect(f.root.scrollTop).toBe(0);
});
it('additional region pages retain cancellation and selecting does not scroll',async()=>{
 const f=await fixture();for(let i=3;i<=8;i++)region(`본문 ${String(i)}`);await f.choose('세로 스크롤 영역 선택');await f.choose('다음 영역');await f.choose('영역 8 · 본문 8');expect(view.title).toContain('본문 8');expect(f.root.scrollTop).toBe(0);
 await f.choose('세로 스크롤 영역 선택');await f.choose('다음 영역');await f.choose('이전 영역');await f.choose('취소 · 읽기·이동으로');expect(view.title).toContain('본문 8');
});
