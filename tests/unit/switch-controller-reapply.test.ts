// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createSwitchController } from '../../src/page/input/switch-controller';
import type { Collector, Item } from '../../src/page/collector/collector';
import type { InputPipeline } from '../../src/page/input/pipeline';
import type { SwitchState } from '../../src/core/switch-engine';
import type { TextSelection, SwitchFrameReport } from '../../src/shared/switch-messages';

const view = vi.hoisted(() => ({ state: null as SwitchState | null, text: '', notice: '', selection: undefined as TextSelection | undefined }));
// Chrome 메시지 전달과 화면만 대체하고 실제 controller와 DOM 적용을 검사한다.
vi.mock('@/page/overlay/switch-panel', () => ({ createSwitchPanel: () => ({
  render: (state: SwitchState, _title: string, text: string, _notice: string, selection?: TextSelection) => {
    view.notice = _notice; view.state = state; view.text = text; view.selection = selection;
  }, destroy: () => { view.state = null; },
}) }));

const cleanups: (() => void)[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] });
  document.body.innerHTML = ''; view.state = null; view.text = ''; view.notice = ''; view.selection = undefined;
});
afterEach(() => { cleanups.splice(0).forEach((cleanup) => { cleanup(); }); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function fixture() {
  const field = document.createElement('input');
  field.value='원래 문장';
  field.setAttribute('aria-label', '알림');
  document.body.append(field);
  const item: Item = { id: 'field', name: '문장', kind: 'input', danger: false,
    rect: { x: 10, y: 10, w: 100, h: 30 }, fingerprint: { framePath: [], domPath: 'body/input', buttonText: '문장' } };
  let loseReply=false;let holdCapture=false;let holdSettings=false;let releaseCapture:(()=>void)|undefined;
  const collector: Collector = { items: () => [item], get: () => field, onChange: () => undefined, refresh: () => undefined };
  let consume: Parameters<InputPipeline['setSwitchHandler']>[0] = null;
  const pipeline: InputPipeline = { setSwitchHandler: (handler) => { consume = handler; }, setSwitchExclusive: () => undefined,
    onKey: () => undefined, onPress: () => undefined, setModal: () => undefined };
  type Listener = (message: unknown, sender: chrome.runtime.MessageSender, response: (value?: unknown) => void) => boolean | undefined;
  const listeners: Listener[] = []; let frames: SwitchFrameReport[] = []; let storedDraft = '';
  vi.stubGlobal('chrome', {
    runtime: { id: 'unit-extension', onMessage: { addListener: (listener: Listener) => { listeners.push(listener); }, removeListener: (listener: Listener) => { const at = listeners.indexOf(listener); if (at >= 0) listeners.splice(at, 1); } },
      sendMessage: async (raw: unknown) => {
        const message = raw as { type: string; documentGeneration?: string; items?: SwitchFrameReport['items']; text?: string };
        if (message.type === 'switch/settings'&&holdSettings){await new Promise<void>(resolve=>{releaseCapture=resolve;});return {ok:true};}
        if (message.type === 'switch/report') { frames = [{ frameId: 0, documentGeneration: message.documentGeneration ?? '', path: [], items: message.items ?? [] }]; return { tabId: 1 }; }
        if (message.type === 'switch/list') return { tabId: 1, frames };
        if (message.type === 'switch/draft/read') return { text: storedDraft };
        if (message.type === 'switch/draft') { storedDraft = message.text ?? ''; return { ok: true }; }
        if (message.type === 'switch/execute' && (raw as {action:{kind:string}}).action.kind==='applyText' && loseReply) return {result:'unknown'};
        if (message.type === 'switch/execute') {
          const result=await new Promise((resolve) => { listeners.forEach((listener) => listener(raw, { id: 'unit-extension' }, resolve)); });
          if(holdCapture&&(raw as {action:{kind:string}}).action.kind==='capture')await new Promise<void>(resolve=>{releaseCapture=resolve;});
          return result;
        }
        return { ok: true };
      } },
    storage: { local: { get: (key: string) => Promise.resolve(key === 'switchSettings' ? { switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } } : { switchPhrases: ['라'] }) },
      onChanged: { addListener: () => undefined, removeListener: () => undefined } },
  });
  let enabled = false; const abort = new AbortController(); cleanups.push(() => { abort.abort(); });
  const controller = createSwitchController({ collector, pipeline, enabled: () => enabled, onExclusive: () => undefined, signal: abort.signal });
  await vi.advanceTimersByTimeAsync(1);
  const event = { code: 'Space', isTrusted: true, repeat: false, isComposing: false, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false } as KeyboardEvent;
  async function press() {
    await vi.advanceTimersByTimeAsync(125);
    consume?.('keyDown', event); consume?.('keyUp', event); await vi.advanceTimersByTimeAsync(1);
  }
  async function choose(label: string) {
    if(view.state?.mode==='confirming')await vi.advanceTimersByTimeAsync(1000);
    for (let i = 0; i < 120 && view.state?.items[view.state.scanIndex]?.label !== label; i++) await vi.advanceTimersByTimeAsync(100);
    expect(view.state?.items[view.state.scanIndex]?.label).toBe(label); await press();
  }
  async function setEnabled(next: boolean) { enabled = next; controller.enabledChanged(); await vi.advanceTimersByTimeAsync(1); }
  return { holdSettings:()=>{holdSettings=true;}, down:()=>consume?.('keyDown',event), up:()=>consume?.('keyUp',event), remoteKey:(flags:{repeat?:boolean;isComposing?:boolean;modified?:boolean})=>{listeners.forEach(listener=>listener({type:'switch/key',kind:'keyDown',repeat:false,isComposing:false,modified:false,...flags},{id:'unit-extension'},()=>undefined));}, hold:()=>{holdCapture=true;},release:()=>{releaseCapture?.();}, lose:()=>{loseReply=true;}, controller, field, setEnabled, press, choose };
}

async function editor() {const f=await fixture();await f.setEnabled(true);await f.press();await f.choose('글쓰기');await f.choose('양식 한 장 보기');await f.choose('알림');await f.choose('띄어쓰기');f.field.value='사이트 변경';return f;}
it('refused apply preserves the field and draft for explicit comparison and protected reapply',async()=>{
 const f=await editor();let changes=0;f.field.addEventListener('input',()=>{changes++;});
 await f.choose('입력칸에 적용');expect(f.field.value).toBe('사이트 변경');expect(changes).toBe(0);for(const detail of ['바뀌었어요','보존','현재 값과 비교하세요'])expect(view.notice).toContain(detail);
 await f.choose('현재 값과 비교');expect(view.text).toContain('사이트 변경');expect(view.state?.mode).toBe('confirming');expect(view.state?.items[0]?.label).toBe('취소');
 await f.choose('다음 비교 읽기');expect(view.text).toContain('원래 문장 ');
 await f.choose('확인 · 입력칸에 적용');expect(f.field.value).toBe('원래 문장 ');expect(changes).toBe(1);
});
it('cancel retains draft and a second page change refuses the confirmed overwrite',async()=>{
 const f=await editor();await f.choose('현재 값과 비교');await f.choose('취소');expect(f.field.value).toBe('사이트 변경');expect(view.text).toBe('원래 문장 ');
 await f.choose('현재 값과 비교');f.field.value='다시 변경';await f.choose('확인 · 입력칸에 적용');expect(f.field.value).toBe('다시 변경');expect(view.text).toBe('원래 문장 ');
});
it('rest cancels comparison so resume cannot apply its stale proposal',async()=>{
 const f=await editor();await f.choose('현재 값과 비교');await f.choose('쉬기');await f.press();expect(view.state?.items.some(item=>item.id==='reapply-commit')).toBe(false);expect(f.field.value).toBe('사이트 변경');
});
it('unknown confirmed application pauses without leaving another confirm action',async()=>{
 const f=await editor();await f.choose('현재 값과 비교');f.lose();await f.choose('확인 · 입력칸에 적용');expect(view.state?.mode).toBe('paused');expect(view.notice).toContain('결과');expect(view.state?.items.some(item=>item.id==='reapply-commit')).toBe(false);
});
it('the first protected Space cannot cancel or apply before one second',async()=>{
 const f=await editor();await f.choose('현재 값과 비교');await f.press();expect(view.state?.mode).toBe('confirming');expect(f.field.value).toBe('사이트 변경');
});
it('comparison pages retain every grapheme of the page value and draft',async()=>{
 const f=await editor();f.field.value='아주 긴 현재값 👩‍💻 '.repeat(8)+'끝';const current=f.field.value;
 await f.choose('현재 값과 비교');const pages=[view.text];
 while(view.state?.items.some(item=>item.id==='reapply-next')){await f.choose('다음 비교 읽기');pages.push(view.text);}
 expect(pages.filter(page=>page.startsWith('현재 입력값')).map(page=>page.split('\n').slice(1).join('\n')).join('')).toBe(current);
 expect(pages.filter(page=>page.startsWith('작성 문장')).map(page=>page.split('\n').slice(1).join('\n')).join('')).toBe('원래 문장 ');expect(f.field.value).toBe(current);
});

it('late comparison capture cannot reopen confirmation after the helper is disabled',async()=>{
 const f=await editor();f.hold();await f.choose('현재 값과 비교');expect(view.state?.mode).toBe('executing');await f.setEnabled(false);f.release();await vi.advanceTimersByTimeAsync(200);expect(view.state).toBe(null);expect(f.field.value).toBe('사이트 변경');
});
it('a newly sensitive field is refused without exposing its current value',async()=>{
 const f=await editor();f.field.autocomplete='one-time-code';f.field.value='sensitive-current';await f.choose('현재 값과 비교');expect(view.state?.mode).not.toBe('confirming');expect(view.text).not.toContain('sensitive-current');expect(f.field.value).toBe('sensitive-current');
});
it('automatic rest discards confirmation and keeps the page value',async()=>{
 const f=await editor();await f.choose('현재 값과 비교');await vi.advanceTimersByTimeAsync(30000);expect(view.state?.mode).toBe('paused');await f.press();expect(view.state?.items.some(item=>item.id==='reapply-commit')).toBe(false);expect(f.field.value).toBe('사이트 변경');
});
it('partial Hangul must be completed before comparison without losing composition',async()=>{
 const f=await editor();await f.choose('한글 쓰기');await f.choose('ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ');await f.choose('ㄱ');await f.choose('상위로');await f.choose('상위로');await f.choose('상위로');expect(view.text).toContain('[ㄱ]');await f.choose('현재 값과 비교');expect(view.state?.mode).not.toBe('confirming');expect(view.text).toContain('[ㄱ]');expect(view.notice).toContain('조합');
});
it('a fresh Space press stops a pending comparison and its release cannot resume or replay it',async()=>{
 const f=await editor();f.hold();await f.choose('현재 값과 비교');expect(view.state?.mode).toBe('executing');
 await f.press();expect(view.state?.mode).toBe('paused');f.release();await vi.advanceTimersByTimeAsync(200);expect(view.state?.mode).toBe('paused');expect(f.field.value).toBe('사이트 변경');
 await f.press();expect(view.state?.mode).not.toBe('confirming');expect(view.state?.items.some(item=>item.id==='reapply-commit')).toBe(false);expect(f.field.value).toBe('사이트 변경');
});

it('a capture reply between the stop down and up cannot resume or reopen comparison',async()=>{
 const f=await editor();f.hold();await f.choose('현재 값과 비교');f.down();expect(view.state?.mode).toBe('paused');f.release();await vi.advanceTimersByTimeAsync(100);f.up();await vi.advanceTimersByTimeAsync(100);expect(view.state?.mode).toBe('paused');expect(f.field.value).toBe('사이트 변경');expect(view.state?.items.some(item=>item.id==='reapply-commit')).toBe(false);
});
it('repeated, composing and modified child-frame Space signals do not stop; a fresh Space does',async()=>{
 const f=await editor();f.hold();await f.choose('현재 값과 비교');
 for(const flags of [{repeat:true},{isComposing:true},{modified:true}]){f.remoteKey(flags);expect(view.state?.mode).toBe('executing');}
 f.remoteKey({});expect(view.state?.mode).toBe('paused');f.release();await vi.advanceTimersByTimeAsync(100);expect(view.state?.mode).toBe('paused');
});

it('late settings replies cannot resume the panel after a Space stop',async()=>{
 const f=await fixture();await f.setEnabled(true);await f.press();await f.choose('조절·쉬기');await f.choose('순환 속도');f.holdSettings();await f.choose('1.5초');expect(view.state?.mode).toBe('executing');await f.press();expect(view.state?.mode).toBe('paused');f.release();await vi.advanceTimersByTimeAsync(200);expect(view.state?.mode).toBe('paused');
});
it('the stop press starts protection so an immediate bounce cannot resume',async()=>{
 const f=await editor();f.hold();await f.choose('현재 값과 비교');await vi.advanceTimersByTimeAsync(200);f.down();f.up();expect(view.state?.mode).toBe('paused');f.down();f.up();expect(view.state?.mode).toBe('paused');f.release();await vi.advanceTimersByTimeAsync(200);await f.press();expect(view.state?.mode).not.toBe('paused');
});
