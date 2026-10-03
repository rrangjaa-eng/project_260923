// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createSwitchController } from '../../src/page/input/switch-controller';
import type { Collector, Item } from '../../src/page/collector/collector';
import type { InputPipeline } from '../../src/page/input/pipeline';
import type { SwitchState } from '../../src/core/switch-engine';
import type { TextSelection, SwitchFrameReport } from '../../src/shared/switch-messages';

const view = vi.hoisted(() => ({ state: null as SwitchState | null, text: '', notice: '', selection: undefined as TextSelection | undefined }));
// 브라우저 메시지 전달·화면만 대체하고 실제 controller·capture·DOM으로 초안 전환을 검사한다.
vi.mock('@/page/overlay/switch-panel', () => ({ createSwitchPanel: () => ({
  render: (state: SwitchState, _title: string, text: string, _notice: string, selection?: TextSelection) => {
    view.state = state; view.text = text; view.notice=_notice; view.selection = selection;
  }, destroy: () => { view.state = null; },
}) }));

const cleanups: (() => void)[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] });
  document.body.innerHTML = ''; view.state = null; view.text = ''; view.selection = undefined;
});
afterEach(() => { cleanups.splice(0).forEach((cleanup) => { cleanup(); }); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function fixture(readDraft?: () => Promise<{ text: string }>,helperPage=false,pinButton=false,pinName='열기') {
  const field = document.createElement('input'); field.value = '가👍🏽나'; field.setAttribute('aria-label', '문장');
  document.body.append(field); field.setSelectionRange(1, 5, 'backward');
  const item: Item = { id: 'field', name: '문장', kind: 'input', danger: false,
    rect: { x: 10, y: 10, w: 100, h: 30 }, fingerprint: { framePath: [], domPath: 'body/input', buttonText: '문장' } };
  const second=document.createElement('input');second.setAttribute('aria-label','다음 칸');document.body.append(second);
  const secondItem:Item={...item,id:'second',name:'다음 칸',fingerprint:{...item.fingerprint,domPath:'body/input[2]'}};
  const button=document.createElement('button');button.type='button';button.textContent=pinName;if(pinButton)document.body.append(button);
  const buttonItem:Item={...item,id:'pin-button',name:pinName,kind:'button',fingerprint:{id:'pin-button',buttonText:pinName,domPath:'body/button',framePath:[]}};
  let reportChange: () => void = () => undefined;
  const collector: Collector = { items: () => [...(field.isConnected?[item]:[]),...(second.isConnected?[secondItem]:[]),...(pinButton?[buttonItem]:[])], get: id => id==='pin-button'?button:id==='second'?second:field, onChange: (handler) => { reportChange = handler; }, refresh: () => { reportChange(); } };
  let consume: Parameters<InputPipeline['setSwitchHandler']>[0] = null;
  const pipeline: InputPipeline = { setSwitchHandler: (handler) => { consume = handler; }, setSwitchExclusive: () => undefined,
    onKey: () => undefined, onPress: () => undefined, setModal: () => undefined };
  type Listener = (message: unknown, sender: chrome.runtime.MessageSender, response: (value?: unknown) => void) => boolean | undefined;
  const listeners: Listener[] = []; let frames: SwitchFrameReport[] = []; let storedDraft = ''; const navigation: unknown[]=[];const requests: unknown[]=[];let executeReply:((raw:unknown)=>Promise<unknown>)|undefined;let listReply:(()=>Promise<unknown>)|undefined;
  let sitePins:unknown[]=[];const storageListeners=new Set<(changes:Record<string,chrome.storage.StorageChange>,area:string)=>void>();
  vi.stubGlobal('chrome', {
    runtime: { id: 'unit-extension', onMessage: { addListener: (listener: Listener) => { listeners.push(listener); }, removeListener: (listener: Listener) => { const at = listeners.indexOf(listener); if (at >= 0) listeners.splice(at, 1); } },
      sendMessage: async (raw: unknown) => {
        requests.push(raw);
        const message = raw as { type: string; documentGeneration?: string; items?: SwitchFrameReport['items']; text?: string };
        if (message.type === 'switch/report') { frames = [{ frameId: 0, documentGeneration: message.documentGeneration ?? '', path: [], items: message.items ?? [] }]; return { tabId: 1 }; }
        if (message.type === 'switch/list') return listReply?listReply():{ tabId: 1, frames };
        if (message.type === 'switch/draft/read') return readDraft ? readDraft() : { text: storedDraft };
        if (message.type === 'switch/draft') { storedDraft = message.text ?? ''; return { ok: true }; }
        if(message.type==='switch/navigation'){ navigation.push(raw); const m=raw as {kind:string};return m.kind==='close-preview'?{result:'done',token:'preview',title:'돌아갈 곳'}:{result:'done'};}
        if ((message.type === 'switch/execute'||message.type==='switch/site-off')&&executeReply)return executeReply(raw);
        if (message.type === 'switch/execute') return new Promise((resolve) => { listeners.forEach((listener) => listener(raw, { id: 'unit-extension' }, resolve)); });
        return { ok: true };
      } },
    storage: { sync:{get:()=>Promise.resolve({[`site:${location.origin}`]:{schemaVersion:1,data:{disabled:false,pins:sitePins}}})}, local: { get: (key: string) => Promise.resolve(key === 'switchSettings' ? { switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } } : { switchPhrases: ['라'] }) },
      onChanged: { addListener: (listener:(changes:Record<string,chrome.storage.StorageChange>,area:string)=>void) => storageListeners.add(listener), removeListener: (listener:(changes:Record<string,chrome.storage.StorageChange>,area:string)=>void) => storageListeners.delete(listener) } },
  });
  let enabled = false; const abort = new AbortController(); cleanups.push(() => { abort.abort(); });
  const controller = createSwitchController({ helperPage, collector, pipeline, enabled: () => enabled, onExclusive: () => undefined, signal: abort.signal });
  await vi.advanceTimersByTimeAsync(1);
  async function press() {
    await vi.advanceTimersByTimeAsync(125);
    const event = { code: 'Space', isTrusted: true, repeat: false, isComposing: false, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false } as KeyboardEvent;
    consume?.('keyDown', event); consume?.('keyUp', event); await vi.advanceTimersByTimeAsync(1);
  }
  async function choose(label: string) {
    for (let i = 0; i < 120 && view.state?.items[view.state.scanIndex]?.label !== label; i++) await vi.advanceTimersByTimeAsync(100);
    expect(view.state?.items[view.state.scanIndex]?.label).toBe(label); await press();
  }
  async function setEnabled(next: boolean) { enabled = next; controller.enabledChanged(); await vi.advanceTimersByTimeAsync(1); }
  async function begin() { listeners.forEach((listener) => listener({ type: 'switch/begin', url: location.href }, { id: 'unit-extension' }, () => undefined)); await vi.advanceTimersByTimeAsync(1); }
  async function capture() { if (view.state?.mode === 'paused' || view.state?.mode === 'ready') await press(); await choose('찾기'); await choose('문장'); }
  const deliver=(raw:unknown)=>new Promise(resolve=>{listeners.forEach(listener=>listener(raw,{id:'unit-extension'},resolve));});
  return { second, holdList:(reply:()=>Promise<unknown>)=>{listReply=reply;}, deliver, setPins:(value:unknown[])=>{sitePins=value;storageListeners.forEach(listener=> { listener({[`site:${location.origin}`]:{newValue:{schemaVersion:1,data:{disabled:false,pins:value}}}},'sync'); });}, buttonFingerprint:buttonItem.fingerprint, requests, holdExecute:(reply:(raw:unknown)=>Promise<unknown>)=>{executeReply=reply;}, navigation, controller, field, button, setEnabled, press, choose, begin, capture, reportChange: () => { reportChange(); } };
}


it.each(['새로고침','탭 닫기'])('unapplied text blocks %s and preserves the draft',async label=>{
 const f=await fixture();await f.setEnabled(true);await f.capture();await f.choose('문구');await f.choose('라');await f.choose('상위로');await f.choose('읽기·이동');await f.choose(label);
 expect(f.navigation).toEqual([]);expect(view.notice).toContain('적용하지 않은');expect(view.text).toBe('가라나');expect(f.field.value).toBe('가👍🏽나');
});
it('reload requires a new confirmation and cancel has no effect',async()=>{
 const f=await fixture();await f.setEnabled(true);await f.press();await f.choose('읽기·이동');await f.choose('새로고침');expect(f.navigation).toEqual([]);expect(view.state?.items[0]?.label).toBe('취소');await vi.advanceTimersByTimeAsync(1000);await f.choose('취소');expect(f.navigation).toEqual([]);
 await f.choose('새로고침');await vi.advanceTimersByTimeAsync(1000);await f.choose('확인 · 새로고침');expect(f.navigation).toMatchObject([{kind:'reload'}]);
});
it('close preview is visible and its token is sent only after explicit confirmation',async()=>{
 const f=await fixture();await f.setEnabled(true);await f.press();await f.choose('읽기·이동');await f.choose('탭 닫기');expect(view.text).toContain('돌아갈 곳');expect(f.navigation).toMatchObject([{kind:'close-preview'}]);await vi.advanceTimersByTimeAsync(1000);await f.choose('확인 · 탭 닫기');expect(f.navigation).toMatchObject([{kind:'close-preview'},{kind:'close',token:'preview'}]);
});

it('helper address editor composes ASCII through Space groups without applying it early',async()=>{
 const f=await fixture(undefined,true);await f.setEnabled(true);await f.capture();await f.choose('영문·주소 쓰기');await f.choose('a b c d e f');await f.choose('a');expect(view.text).toBe('가a나');expect(f.field.value).toBe('가👍🏽나');
});

it('general editor replaces a selected grapheme with ASCII and undo keeps the page unchanged',async()=>{
 const f=await fixture();await f.setEnabled(true);await f.capture();await f.choose('영문·숫자 쓰기');await f.choose('a b c d e f');await f.choose('a');
 expect(view.text).toBe('가a나');expect(f.field.value).toBe('가👍🏽나');
 await f.choose('수정');await f.choose('입력 되돌리기');expect(view.text).toBe('가👍🏽나');expect(f.field.value).toBe('가👍🏽나');
});

it('form editor preserves a numeric draft across field movement without applying it',async()=>{
 const f=await fixture();await f.setEnabled(true);await f.capture();await f.choose('양식 한 장 보기');await f.choose('문장');await f.choose('영문·숫자 쓰기');await f.choose('W X Y Z 0 1');await f.choose('1');
 const text=view.text;expect(text).toContain('1');expect(f.field.value).toBe('가👍🏽나');await f.choose('다음 칸');await f.choose('이전 칸');expect(view.text).toBe(text);expect(f.field.value).toBe('가👍🏽나');
});

it.each([false,true])('unfinished Hangul blocks ASCII without moving the draft cursor (helper=%s)',async helper=>{
 const f=await fixture(undefined,helper);await f.setEnabled(true);await f.capture();await f.choose('한글 쓰기');await f.choose('ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ');await f.choose('ㄱ');await f.choose('ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ');await f.choose('ㅏ');
 const label=helper?'영문·주소 쓰기':'영문·숫자 쓰기';
 for(let i=0;i<6&&!view.state?.items.some(item=>item.label===label);i++)await f.choose('상위로');
 const before=view.text;await f.choose(label);expect(view.notice).toContain('한글 조합을 마치거나 취소');expect(view.text).toBe(before);expect(f.field.value).toBe('가👍🏽나');
 await f.choose('한글 쓰기');await f.choose('없음 ㄱ ㄲ ㄳ ㄴ ㄵ');await f.choose('없음');expect(view.text).toBe('가가나');
 await f.choose(label);await f.choose('a b c d e f');await f.choose('a');expect(view.text).toBe('가가a나');expect(f.field.value).toBe('가👍🏽나');
});

it.each(['띄어쓰기','라','앞 글자','뒤 글자','입력 되돌리기'])('unfinished Hangul preserves the draft position when selecting %s',async label=>{
 const f=await fixture();await f.setEnabled(true);await f.capture();
 await f.choose('영문·숫자 쓰기');await f.choose('a b c d e f');await f.choose('a');
 await f.choose('한글 쓰기');await f.choose('ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ');await f.choose('ㄱ');await f.choose('ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ');await f.choose('ㅏ');
 for(let i=0;i<6&&!view.state?.items.some(item=>item.label==='띄어쓰기');i++)await f.choose('상위로');
 if(label==='라')await f.choose('문구');else if(label!=='띄어쓰기')await f.choose('수정');
 const before={text:view.text,selection:view.selection};await f.choose(label);
 expect({text:view.text,selection:view.selection}).toEqual(before);expect(view.notice).toContain('한글 조합을 마치거나 취소');expect(f.field.value).toBe('가👍🏽나');
 for(let i=0;i<3&&!view.state?.items.some(item=>item.label==='한글 쓰기');i++)await f.choose('상위로');
 await f.choose('한글 쓰기');await f.choose('없음 ㄱ ㄲ ㄳ ㄴ ㄵ');await f.choose('없음');expect(view.text).toBe('가a가나');
 if(label==='라')await f.choose('문구');else if(label!=='띄어쓰기')await f.choose('수정');
 await f.choose(label);
 if(label==='띄어쓰기')expect(view.text).toBe('가a가 나');
 if(label==='라')expect(view.text).toBe('가a가라나');
 if(label==='입력 되돌리기')expect(view.text).toBe('가a나');
 if(label==='앞 글자')expect(view.selection).toMatchObject({start:2,end:2});
 if(label==='뒤 글자')expect(view.selection).toMatchObject({start:4,end:4});
 expect(f.field.value).toBe('가👍🏽나');
});

it.each(['unknown','timeout'])('late %s after pause and resume still blocks destructive navigation',async result=>{
 const f=await fixture();await f.setEnabled(true);await f.capture();let release:(value:unknown)=>void=()=>{};f.holdExecute(()=>new Promise(resolve=>{release=resolve;}));await f.choose('입력칸에 적용');f.controller.pause();await f.press();
 if(result==='unknown')release({result:'unknown'});else await vi.advanceTimersByTimeAsync(3100);
 await vi.advanceTimersByTimeAsync(1);await f.choose('상위로');await f.choose('읽기·이동');await f.choose('새로고침');expect(f.navigation).toEqual([]);expect(view.notice).toContain('결과를 확인하지 못한');
});

it('unfinished Hangul blocks reload even before any character is committed',async()=>{
 const f=await fixture();await f.setEnabled(true);await f.capture();await f.choose('한글 쓰기');await f.choose('ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ');await f.choose('ㄱ');f.controller.pause();await f.press();for(let i=0;i<6&&!view.state?.items.some(item=>item.label==='읽기·이동');i++)await f.choose('상위로');await f.choose('읽기·이동');await f.choose('새로고침');expect(view.notice).toContain('적용하지 않은');
});

it('a dirty field retained behind the form list blocks reload after leaving the form',async()=>{
 const f=await fixture();await f.setEnabled(true);await f.capture();await f.choose('양식 한 장 보기');await f.choose('문장');await f.choose('문구');await f.choose('라');await f.choose('다음 칸');await f.choose('원래 화면으로');await f.choose('상위로');await f.choose('읽기·이동');await f.choose('새로고침');expect(view.notice).toContain('적용하지 않은');expect(f.navigation).toEqual([]);
});


it.each(['입력칸에 적용','검색','문구 저장'].flatMap(label=>['complete','cancel'].map(resolution=>({label,resolution}))))('unfinished Hangul blocks external commit through $label until $resolution',async({label,resolution})=>{
 const f=await fixture();await f.setEnabled(true);await f.capture();
 await f.choose('영문·숫자 쓰기');await f.choose('a b c d e f');await f.choose('a');
 await f.choose('한글 쓰기');await f.choose('ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ');await f.choose('ㄱ');if(resolution==='complete'){await f.choose('ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ');await f.choose('ㅏ');}
 for(let i=0;i<6&&!view.state?.items.some(item=>item.label==='입력칸에 적용');i++)await f.choose('상위로');
 if(label==='문구 저장')await f.choose('문구');
 const before={text:view.text,selection:view.selection};f.requests.length=0;await f.choose(label);
 expect(f.requests).toEqual([]);expect(f.field.value).toBe('가👍🏽나');
 expect({text:view.text,selection:view.selection}).toEqual(before);expect(view.notice).toContain('한글 조합을 마치거나 취소');
 if(label==='문구 저장')await f.choose('상위로');
 if(resolution==='complete'){await f.choose('한글 쓰기');await f.choose('없음 ㄱ ㄲ ㄳ ㄴ ㄵ');await f.choose('없음');}
 else{await f.choose('수정');await f.choose('조합 한 단계 취소');}
 const expected=resolution==='complete'?'가a가나':'가a나';expect(view.text).toBe(expected);
 if(label==='문구 저장')await f.choose('문구');f.requests.length=0;await f.choose(label);
 if(label==='문구 저장')expect(f.requests).toContainEqual(expect.objectContaining({type:'switch/phrase',text:expected}));
 else expect(f.field.value).toBe(expected);
});

it('explicit applied-value undo confirms, cancels without effects and restores the original field once',async()=>{
 const f=await fixture();await f.setEnabled(true);await f.capture();await f.choose('영문·숫자 쓰기');await f.choose('a b c d e f');await f.choose('a');await f.choose('입력칸에 적용');expect(f.field.value).toBe('가a나');
 await f.choose('적용한 값 되돌리기');expect(view.state?.mode).toBe('confirming');await vi.advanceTimersByTimeAsync(1001);await f.choose('취소');expect(f.field.value).toBe('가a나');expect(view.text).toBe('가a나');
 await f.choose('적용한 값 되돌리기');await vi.advanceTimersByTimeAsync(1001);await f.choose('확인 · 적용한 값 되돌리기');expect(f.field.value).toBe('가👍🏽나');expect(view.text).toBe('가👍🏽나');expect(f.field.selectionStart).toBe(1);expect(f.field.selectionEnd).toBe(5);
 await f.choose('적용한 값 되돌리기');expect(view.state?.mode).not.toBe('confirming');expect(f.field.value).toBe('가👍🏽나');
});

async function appliedFixture(){const f=await fixture();await f.setEnabled(true);await f.capture();await f.choose('문구');await f.choose('라');await f.choose('입력칸에 적용');expect(f.field.value).toBe('가라나');return f;}
it.each(['before-preview','after-preview'])('applied undo rejects an external value change %s',async timing=>{
 const f=await appliedFixture();if(timing==='after-preview')await f.choose('적용한 값 되돌리기');f.field.value='사이트 값';
 if(timing==='before-preview')await f.choose('적용한 값 되돌리기');else{await vi.advanceTimersByTimeAsync(1001);await f.choose('확인 · 적용한 값 되돌리기');}
 expect(f.field.value).toBe('사이트 값');expect(view.state?.mode).not.toBe('confirming');expect(view.text).toBe('가라나');
});
it('unapplied text prevents applied undo without sending a target request',async()=>{
 const f=await appliedFixture();await f.choose('띄어쓰기');f.requests.length=0;await f.choose('적용한 값 되돌리기');expect(f.requests).toEqual([]);expect(view.notice).toContain('작성 중');expect(f.field.value).toBe('가라나');
});
it('rest discards the applied undo capability without changing the draft',async()=>{
 const f=await appliedFixture();f.controller.pause();await f.press();await f.choose('적용한 값 되돌리기');expect(view.state?.mode).not.toBe('confirming');expect(f.field.value).toBe('가라나');expect(view.text).toBe('가라나');
});
it('leaving a form field discards undo and preserves all values',async()=>{
 const f=await fixture();await f.setEnabled(true);await f.capture();await f.choose('양식 한 장 보기');await f.choose('문장');await f.choose('문구');await f.choose('라');await f.choose('입력칸에 적용');await f.choose('다음 칸');await f.choose('이전 칸');await f.choose('적용한 값 되돌리기');expect(view.state?.mode).not.toBe('confirming');expect(f.field.value).toBe('가라나');
});
it('early confirmation input is ignored and unknown undo cannot be replayed',async()=>{
 const f=await appliedFixture();await f.choose('적용한 값 되돌리기');f.requests.length=0;await f.press();expect(view.state?.mode).toBe('confirming');expect(f.requests).toEqual([]);
 await vi.advanceTimersByTimeAsync(1001);f.holdExecute(()=>Promise.resolve({result:'unknown'}));await f.choose('확인 · 적용한 값 되돌리기');expect(view.state?.mode).toBe('paused');expect(f.field.value).toBe('가라나');await f.press();await f.choose('적용한 값 되돌리기');expect(view.state?.mode).not.toBe('confirming');
});
it('rest during pending undo prevents a late reply from rewriting the draft',async()=>{
 const f=await appliedFixture();await f.choose('적용한 값 되돌리기');await vi.advanceTimersByTimeAsync(1001);let release:(raw:unknown)=>void=()=>{};f.holdExecute(()=>new Promise(resolve=>{release=resolve;}));await f.choose('확인 · 적용한 값 되돌리기');f.controller.pause();release({result:'done',value:'가👍🏽나'});await vi.advanceTimersByTimeAsync(1);expect(view.state?.mode).toBe('paused');expect(view.text).toBe('가라나');expect(f.field.value).toBe('가라나');
});

it('pin setup previews an explicit target and cancellation never sends a write or site click',async()=>{
 const f=await fixture(undefined,false,true);let clicks=0;f.button.addEventListener('click',()=>clicks++);await f.setEnabled(true);await f.press();await f.choose('읽기·이동');await f.choose('번호 고정 설정');await f.choose('1번 · 비어 있음');await f.choose('대상 고르기');await f.choose('고정할 대상 · 열기');
 await vi.advanceTimersByTimeAsync(1000);await f.choose('다음 고정 읽기');expect(view.text).toContain('열기');expect(f.requests.some(raw=>(raw as {type:string}).type==='switch/pin/update')).toBe(false);await vi.advanceTimersByTimeAsync(1000);await f.choose('취소 · 번호 설정으로');expect(clicks).toBe(0);expect(f.requests.some(raw=>(raw as {type:string}).type==='switch/pin/update')).toBe(false);
});

it('pin confirmation exposes the ending of long target names through preview pages',async()=>{
 const name='같은 이름이 길게 이어지는 업무 항목 '.repeat(3)+'마지막 A';const f=await fixture(undefined,false,true,name);await f.setEnabled(true);await f.press();await f.choose('읽기·이동');await f.choose('번호 고정 설정');await f.choose('1번 · 비어 있음');await f.choose('대상 고르기');await f.choose('고정할 대상 · '+Array.from(name).slice(0,24).join('')+'…');
 expect(view.state?.items.some(item=>item.label==='다음 고정 읽기')).toBe(true);await vi.advanceTimersByTimeAsync(1000);let text=view.text;for(let i=0;i<5&&view.state?.items.some(item=>item.label==='다음 고정 읽기');i++){await f.choose('다음 고정 읽기');text+=view.text;}expect(text).toContain('마지막 A');
});

it('changing saved pins during the target confirmation prevents the old button from running',async()=>{
 const f=await fixture(undefined,false,true);f.setPins([{number:1,fingerprint:f.buttonFingerprint}]);let clicks=0;f.button.addEventListener('click',()=>clicks++);await f.setEnabled(true);await f.press();await f.choose('읽기·이동');await f.choose('고정 번호');await f.choose('1번 · 열기');f.setPins([]);await vi.advanceTimersByTimeAsync(1000);await f.choose('열기');expect(clicks).toBe(0);expect(view.notice).toContain('바뀌');
});
it('refuses a null site original instead of presenting empty pin slots',async()=>{
 const f=await fixture(undefined,false,true);await f.setEnabled(true);await f.press();await f.choose('읽기·이동');
 chrome.storage.sync.get=()=>Promise.resolve({[`site:${location.origin}`]:null});await f.choose('번호 고정 설정');expect(view.notice).toContain('고정 설정을 읽지 못했어요');expect(view.state?.items.some(item=>item.id==='pin-slot:1')).toBe(false);
});

it('explicit doubleclick previews and cancels without effects, then delivers only dblclick after confirmation',async()=>{
 const f=await fixture(undefined,false,true);let clicks=0,doubles=0;f.button.addEventListener('click',()=>clicks++);f.button.addEventListener('dblclick',()=>doubles++);
 await f.setEnabled(true);await f.press();await f.choose('읽기·이동');await f.choose('더블클릭 · 제한');await f.choose('대상 · 열기');
 expect(view.state?.mode).toBe('confirming');expect(view.text).toContain('열기');expect(view.notice).toContain('일반 클릭 없이');
 await vi.advanceTimersByTimeAsync(1100);await f.choose('취소');expect([clicks,doubles]).toEqual([0,0]);
 await f.choose('대상 · 열기');await vi.advanceTimersByTimeAsync(1100);await f.choose('확인 · 더블클릭 전달');expect([clicks,doubles]).toEqual([0,1]);expect(view.notice).toContain('사이트 결과를 확인');
});

async function doubleFixture(){const f=await fixture(undefined,false,true);await f.setEnabled(true);await f.press();await f.choose('읽기·이동');await f.choose('더블클릭 · 제한');await f.choose('대상 · 열기');await vi.advanceTimersByTimeAsync(1100);return f;}
it('doubleclick approval cannot be substituted with an ordinary press',async()=>{
 const f=await doubleFixture();let clicks=0,doubles=0;f.button.addEventListener('click',()=>clicks++);f.button.addEventListener('dblclick',()=>doubles++);
 f.holdExecute(raw=>{const message=raw as {action:Record<string,unknown>};return f.deliver({...message,action:{...message.action,kind:'press'}});});
 await f.choose('확인 · 더블클릭 전달');expect([clicks,doubles]).toEqual([0,0]);
});
it.each(['reinserted','identity','disabled','pause'])('doubleclick refuses late execution after %s',async boundary=>{
 const f=await doubleFixture();let events=0;f.button.addEventListener('click',()=>events++);f.button.addEventListener('dblclick',()=>events++);
 let release=()=>{};f.holdExecute(raw=>new Promise(resolve=>{release=()=>{void f.deliver(raw).then(resolve);};}));await f.choose('확인 · 더블클릭 전달');
 if(boundary==='pause')f.controller.pause();else if(boundary==='identity')f.button.type='submit';else if(boundary==='disabled')f.button.disabled=true;else{f.button.remove();document.body.append(f.button);}
 release();await vi.advanceTimersByTimeAsync(1);expect(events).toBe(0);
});
it('lost doubleclick acknowledgment never repeats delivery, even after explicit retry',async()=>{
 const f=await doubleFixture();let doubles=0;f.button.addEventListener('dblclick',()=>doubles++);
 f.holdExecute(async raw=>{await f.deliver(raw);return {result:'unknown'};});await f.choose('확인 · 더블클릭 전달');expect(doubles).toBe(1);expect(view.state?.mode).toBe('recovering');
 await f.press();await f.choose('확인 · 더블클릭 전달');expect(doubles).toBe(1);
});

it('site-off authorizes only its exact origin and stops scanning while saving',async()=>{
 const f=await fixture();await f.setEnabled(true);await f.press();await f.choose('조절·쉬기');let release:(value:unknown)=>void=()=>{};f.holdExecute(()=>new Promise(resolve=>{release=resolve;}));
 await f.choose('이 사이트에서 끄기 · 다시 켜기는 확장 아이콘');expect(view.state?.mode).toBe('executing');
 const request=f.requests.find((raw)=>typeof raw==='object'&&raw!==null&&'type' in raw&&raw.type==='switch/site-off') as {authorization:unknown;origin:string};expect(request.origin).toBe(location.origin);
 const check={type:'switch/action-check',authorization:request.authorization};
 expect(await f.deliver({...check,siteOff:location.origin})).toEqual({result:'done'});
 expect(await f.deliver(check)).toEqual({result:'refused'});expect(await f.deliver({...check,siteOff:'https://wrong.test'})).toEqual({result:'refused'});
 expect(await f.deliver({...check,siteOff:location.origin,navigation:{kind:'reload'}})).toEqual({result:'refused'});
 await f.press();expect(view.state?.mode).toBe('paused');expect(await f.deliver({...check,siteOff:location.origin})).toEqual({result:'refused'});
 release({result:'refused'});await vi.advanceTimersByTimeAsync(1);expect(view.state?.mode).toBe('paused');
});
it('site-off timeout pauses without claiming it was disabled or replaying',async()=>{
 const f=await fixture();await f.setEnabled(true);await f.press();await f.choose('조절·쉬기');f.holdExecute(()=>new Promise(()=>{}));await f.choose('이 사이트에서 끄기 · 다시 켜기는 확장 아이콘');await vi.advanceTimersByTimeAsync(3100);
 expect(view.state?.mode).toBe('paused');expect(view.notice).toContain('결과를 확인하지 못했어요');
 expect(f.requests.filter(raw=>typeof raw==='object'&&raw!==null&&'type' in raw&&raw.type==='switch/site-off')).toHaveLength(1);
});
it('site-off authorization cannot be substituted for a final page press',async()=>{
 const f=await fixture(undefined,false,true);await f.setEnabled(true);await f.press();await f.choose('조절·쉬기');f.holdExecute(()=>new Promise(()=>{}));await f.choose('이 사이트에서 끄기 · 다시 켜기는 확장 아이콘');
 const request=f.requests.find((raw)=>typeof raw==='object'&&raw!==null&&'type' in raw&&raw.type==='switch/site-off') as {authorization:{documentGeneration:string}};
 const report=f.requests.find(raw=>typeof raw==='object'&&raw!==null&&'type' in raw&&raw.type==='switch/report') as {items:{itemId:string;identity:string}[]};
 const target=report.items.find(item=>item.itemId==='pin-button');expect(target).toBeDefined();let clicks=0;f.button.addEventListener('click',()=>{clicks++;});
 expect(await f.deliver({type:'switch/execute',action:{actionId:'substituted',target:{tabId:1,frameId:0,documentGeneration:request.authorization.documentGeneration,itemId:'pin-button'},kind:'press',expectedIdentity:target?.identity,confirmed:true,authorization:request.authorization}})).toEqual({result:'refused'});expect(clicks).toBe(0);
});

it.each(['remove','rename'])('unavailable %s field draft is readable, cancelable and explicitly discardable before navigation',async change=>{
 const f=await fixture();await f.setEnabled(true);await f.capture();await f.choose('양식 한 장 보기');await f.choose('문장');await f.choose('띄어쓰기');const pending=view.text;
 await f.choose('양식 목록');if(change==='remove')f.field.remove();else f.field.setAttribute('aria-label','바뀐 이름');
 await f.choose('양식 목록 새로 읽기');await f.choose('보관 문장');await f.choose('보관 1 · 문장');expect(view.text).toContain(pending);
 await f.choose('이 보관 문장 버리기');expect(view.state?.items[0]?.label).toBe('취소');await vi.advanceTimersByTimeAsync(1001);await f.choose('취소');expect(view.text).toContain(pending);
 await f.choose('이 보관 문장 버리기');await vi.advanceTimersByTimeAsync(1001);await f.choose('확인 · 이 보관 문장 버리기');
 f.controller.connectionLost();await f.press();await f.choose('글쓰기');expect(view.state?.items.some(item=>item.label==='양식 작성 문장 복구')).toBe(false);
 await f.choose('상위로');await f.choose('읽기·이동');await f.choose('새로고침');expect(view.state?.mode).toBe('confirming');expect(f.navigation).toEqual([]);
});
it('a field reappearing during discard confirmation preserves its draft',async()=>{
 const f=await fixture();await f.setEnabled(true);await f.capture();await f.choose('양식 한 장 보기');await f.choose('문장');await f.choose('띄어쓰기');const pending=view.text;await f.choose('양식 목록');f.field.remove();await f.choose('양식 목록 새로 읽기');await f.choose('보관 문장');await f.choose('보관 1 · 문장');await f.choose('이 보관 문장 버리기');
 document.body.prepend(f.field);await vi.advanceTimersByTimeAsync(1001);await f.choose('확인 · 이 보관 문장 버리기');expect(view.notice).toContain('보존');await f.choose('보관 목록');await f.choose('양식 목록');await f.choose('양식 목록 새로 읽기');await f.choose('문장');expect(view.text).toBe(pending);
});

it('discarding one of multiple unavailable drafts keeps the other and the original workspace',async()=>{
 const f=await fixture();await f.setEnabled(true);await f.capture();await f.choose('양식 한 장 보기');await f.choose('문장');await f.choose('띄어쓰기');await f.choose('다음 칸');await f.choose('띄어쓰기');await f.choose('양식 목록');f.field.remove();f.second.remove();await f.choose('양식 목록 새로 읽기');
 await f.choose('보관 문장');await f.choose('보관 1 · 문장');await f.choose('이 보관 문장 버리기');await vi.advanceTimersByTimeAsync(1001);await f.choose('확인 · 이 보관 문장 버리기');expect(view.text).toBe('가👍🏽나');
 await f.choose('상위로');await f.choose('읽기·이동');await f.choose('새로고침');expect(view.notice).toContain('적용하지 않은');
 await f.choose('상위로');await f.choose('글쓰기');await f.choose('양식 한 장 보기');await f.choose('보관 문장');await f.choose('보관 1 · 다음 칸');expect(view.text).toContain(' ');expect(view.state?.items.some(item=>item.label==='보관 1 · 문장')).toBe(false);
});
it('rest during final live lookup never discards a stored draft',async()=>{
 const f=await fixture();await f.setEnabled(true);await f.capture();await f.choose('양식 한 장 보기');await f.choose('문장');await f.choose('띄어쓰기');const pending=view.text;await f.choose('양식 목록');f.field.remove();await f.choose('양식 목록 새로 읽기');await f.choose('보관 문장');await f.choose('보관 1 · 문장');await f.choose('이 보관 문장 버리기');
 let release:(value:unknown)=>void=()=>{};f.holdList(()=>new Promise(resolve=>{release=resolve;}));await vi.advanceTimersByTimeAsync(1001);await f.choose('확인 · 이 보관 문장 버리기');f.controller.pause();release({tabId:1,frames:[]});await vi.advanceTimersByTimeAsync(1);expect(view.state?.mode).toBe('paused');await f.press();await f.choose('보관 문장');await f.choose('보관 1 · 문장');expect(view.text).toContain(pending);
});
it('rest in the discard dialog cancels its authority and preserves unfinished Hangul',async()=>{
 const f=await fixture();await f.setEnabled(true);await f.capture();await f.choose('양식 한 장 보기');await f.choose('문장');await f.choose('한글 쓰기');await f.choose('ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ');await f.choose('ㄱ');
 for(let i=0;i<6&&!view.state?.items.some(item=>item.label==='양식 목록');i++)await f.choose('상위로');
 await f.choose('양식 목록');f.field.remove();await f.choose('양식 목록 새로 읽기');await f.choose('보관 문장');await f.choose('보관 1 · 문장');expect(view.text).toContain('[ㄱ]');await f.choose('이 보관 문장 버리기');await vi.advanceTimersByTimeAsync(1001);await f.choose('쉬기');await f.press();expect(view.state?.mode).not.toBe('confirming');await f.choose('보관 문장');await f.choose('보관 1 · 문장');expect(view.text).toContain('[ㄱ]');
});
it('long unavailable text is paged without truncating Unicode or copying it to the original workspace',async()=>{
 const f=await fixture();f.field.value='가👍🏽'.repeat(35);f.field.setSelectionRange(f.field.value.length,f.field.value.length);await f.setEnabled(true);await f.capture();await f.choose('양식 한 장 보기');await f.choose('문장');await f.choose('띄어쓰기');const pending=view.text;await f.choose('양식 목록');f.field.remove();await f.choose('양식 목록 새로 읽기');await f.choose('보관 문장');await f.choose('보관 1 · 문장');let read=view.text.slice(view.text.indexOf('\n')+1);
 while(view.state?.items.some(item=>item.label==='다음 문장 읽기')){await f.choose('다음 문장 읽기');read+=view.text.slice(view.text.indexOf('\n')+1);}
 expect(read).toBe(pending);await f.choose('보관 목록');await f.choose('양식 목록');await f.choose('원래 화면으로');expect(view.text).toBe('가👍🏽'.repeat(35));
});
it('a collector change while the final list reply is pending preserves the unavailable draft',async()=>{
 const f=await fixture();await f.setEnabled(true);await f.capture();await f.choose('양식 한 장 보기');await f.choose('문장');await f.choose('띄어쓰기');const pending=view.text;await f.choose('양식 목록');f.field.remove();await f.choose('양식 목록 새로 읽기');await f.choose('보관 문장');await f.choose('보관 1 · 문장');await f.choose('이 보관 문장 버리기');
 let release:(value:unknown)=>void=()=>{};f.holdList(()=>new Promise(resolve=>{release=resolve;}));await vi.advanceTimersByTimeAsync(1001);await f.choose('확인 · 이 보관 문장 버리기');document.body.prepend(f.field);f.reportChange();release({tabId:1,frames:[]});await vi.advanceTimersByTimeAsync(1);expect(view.text).toContain(pending);expect(view.notice).toContain('보존');
});
it('a changed remote frame report during final list lookup preserves the selected stored draft',async()=>{
 const f=await fixture();await f.setEnabled(true);await f.capture();await f.choose('양식 한 장 보기');await f.choose('문장');await f.choose('띄어쓰기');const pending=view.text;await f.choose('양식 목록');f.field.remove();await f.choose('양식 목록 새로 읽기');await f.choose('보관 문장');await f.choose('보관 1 · 문장');await f.choose('이 보관 문장 버리기');
 let release:(value:unknown)=>void=()=>{};f.holdList(()=>new Promise(resolve=>{release=resolve;}));await vi.advanceTimersByTimeAsync(1001);await f.choose('확인 · 이 보관 문장 버리기');const finalReply=release;void f.deliver({type:'switch/refresh',changed:true});finalReply({tabId:1,frames:[]});await vi.advanceTimersByTimeAsync(1);expect(view.text).toContain(pending);expect(view.notice).toContain('보존');
});
