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

async function fixture(labels?:[string,string]) {
  const field = labels?document.createElement('select'):document.createElement('input');
  if(field instanceof HTMLInputElement)field.type='checkbox';
  else for(const label of labels??[]){const option=document.createElement('option');option.textContent=label;field.append(option);}
  field.setAttribute('aria-label', '알림');
  document.body.append(field);
  const item: Item = { id: 'field', name: '문장', kind: 'input', danger: false,
    rect: { x: 10, y: 10, w: 100, h: 30 }, fingerprint: { framePath: [], domPath: 'body/input', buttonText: '문장' } };
  let loseReply=false;
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
        if (message.type === 'switch/report') { frames = [{ frameId: 0, documentGeneration: message.documentGeneration ?? '', path: [], items: message.items ?? [] }]; return { tabId: 1 }; }
        if (message.type === 'switch/list') return { tabId: 1, frames };
        if (message.type === 'switch/draft/read') return { text: storedDraft };
        if (message.type === 'switch/draft') { storedDraft = message.text ?? ''; return { ok: true }; }
        if (message.type === 'switch/execute' && (raw as {action:{kind:string}}).action.kind==='applyControl' && loseReply) return {result:'unknown'};
        if (message.type === 'switch/execute') return new Promise((resolve) => { listeners.forEach((listener) => listener(raw, { id: 'unit-extension' }, resolve)); });
        return { ok: true };
      } },
    storage: { local: { get: (key: string) => Promise.resolve(key === 'switchSettings' ? { switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } } : { switchPhrases: ['라'] }) },
      onChanged: { addListener: () => undefined, removeListener: () => undefined } },
  });
  let enabled = false; const abort = new AbortController(); cleanups.push(() => { abort.abort(); });
  const controller = createSwitchController({ collector, pipeline, enabled: () => enabled, onExclusive: () => undefined, signal: abort.signal });
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
  return { lose:()=>{loseReply=true;}, controller, field, setEnabled, press, choose };
}


async function control() {const f=await fixture();await f.setEnabled(true);await f.press();await f.choose('글쓰기');await f.choose('양식 한 장 보기');await f.choose('알림');return f;}
it('automatic pause must drop pending control proposal', async()=> { const f=await control();await f.choose('체크하기');expect(view.text).toContain('변경안: 체크하기');await vi.advanceTimersByTimeAsync(30000);expect(view.state?.mode).toBe('paused');await f.press();expect(view.state?.items.map(i=>i.id)).not.toContain('control-apply');});
it('unknown apply pauses with result uncertainty and drops its proposal', async()=> { const f=await control();await f.choose('체크하기');f.lose();await f.choose('체크 상태 적용');expect(view.state?.mode).toBe('paused');expect(view.notice).toContain('결과');expect(view.state?.items.map(item=>item.id)).not.toContain('control-apply');});

it('long current and proposed select labels can be read in complete Space pages before applying',async()=>{
 const current='현재 항목 '.repeat(7)+'현재끝';const proposed='바꿀 항목 '.repeat(7)+'변경끝';
 const f=await fixture([current,proposed]);await f.setEnabled(true);await f.press();await f.choose('글쓰기');await f.choose('양식 한 장 보기');await f.choose('알림');
 expect(view.text).toMatch(/^현재 선택 1\//);const currentPages=[view.text];
 while(view.state?.items.some(item=>item.id==='control-preview-next')){await f.choose('다음 항목 읽기');currentPages.push(view.text);}
 expect(currentPages.map(page=>page.split('\n').slice(1).join('\n')).join('')).toBe(current);
 const choice=view.state?.items.find(item=>item.id==='control-option:1');expect(choice?.label.length).toBeLessThan(proposed.length);if(!choice)throw new Error('missing option');await f.choose(choice.label);
 expect(view.text).toMatch(/^변경안 1\//);const proposalPages=[view.text];
 while(view.state?.items.some(item=>item.id==='control-preview-next')){await f.choose('다음 항목 읽기');proposalPages.push(view.text);}
 expect(proposalPages.map(page=>page.split('\n').slice(1).join('\n')).join('')).toBe(proposed);
 expect((f.field as HTMLSelectElement).selectedIndex).toBe(0);await f.choose('선택값 적용');expect((f.field as HTMLSelectElement).selectedIndex).toBe(1);
});
