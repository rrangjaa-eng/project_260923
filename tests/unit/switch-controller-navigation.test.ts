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

async function fixture(readDraft?: () => Promise<{ text: string }>,helperPage=false) {
  const field = document.createElement('input'); field.value = '가👍🏽나'; field.setAttribute('aria-label', '문장');
  document.body.append(field); field.setSelectionRange(1, 5, 'backward');
  const item: Item = { id: 'field', name: '문장', kind: 'input', danger: false,
    rect: { x: 10, y: 10, w: 100, h: 30 }, fingerprint: { framePath: [], domPath: 'body/input', buttonText: '문장' } };
  let reportChange: () => void = () => undefined;
  const collector: Collector = { items: () => [item], get: () => field, onChange: (handler) => { reportChange = handler; }, refresh: () => undefined };
  let consume: Parameters<InputPipeline['setSwitchHandler']>[0] = null;
  const pipeline: InputPipeline = { setSwitchHandler: (handler) => { consume = handler; }, setSwitchExclusive: () => undefined,
    onKey: () => undefined, onPress: () => undefined, setModal: () => undefined };
  type Listener = (message: unknown, sender: chrome.runtime.MessageSender, response: (value?: unknown) => void) => boolean | undefined;
  const listeners: Listener[] = []; let frames: SwitchFrameReport[] = []; let storedDraft = ''; const navigation: unknown[]=[];
  vi.stubGlobal('chrome', {
    runtime: { id: 'unit-extension', onMessage: { addListener: (listener: Listener) => { listeners.push(listener); }, removeListener: (listener: Listener) => { const at = listeners.indexOf(listener); if (at >= 0) listeners.splice(at, 1); } },
      sendMessage: async (raw: unknown) => {
        const message = raw as { type: string; documentGeneration?: string; items?: SwitchFrameReport['items']; text?: string };
        if (message.type === 'switch/report') { frames = [{ frameId: 0, documentGeneration: message.documentGeneration ?? '', path: [], items: message.items ?? [] }]; return { tabId: 1 }; }
        if (message.type === 'switch/list') return { tabId: 1, frames };
        if (message.type === 'switch/draft/read') return readDraft ? readDraft() : { text: storedDraft };
        if (message.type === 'switch/draft') { storedDraft = message.text ?? ''; return { ok: true }; }
        if(message.type==='switch/navigation'){ navigation.push(raw); const m=raw as {kind:string};return m.kind==='close-preview'?{result:'done',token:'preview',title:'돌아갈 곳'}:{result:'done'};}
        if (message.type === 'switch/execute') return new Promise((resolve) => { listeners.forEach((listener) => listener(raw, { id: 'unit-extension' }, resolve)); });
        return { ok: true };
      } },
    storage: { local: { get: (key: string) => Promise.resolve(key === 'switchSettings' ? { switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } } : { switchPhrases: ['라'] }) },
      onChanged: { addListener: () => undefined, removeListener: () => undefined } },
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
  return { navigation, controller, field, setEnabled, press, choose, begin, capture, reportChange: () => { reportChange(); } };
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
