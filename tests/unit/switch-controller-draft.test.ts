// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createSwitchController } from '../../src/page/input/switch-controller';
import type { Collector, Item } from '../../src/page/collector/collector';
import type { InputPipeline } from '../../src/page/input/pipeline';
import type { SwitchState } from '../../src/core/switch-engine';
import type { TextSelection, SwitchFrameReport } from '../../src/shared/switch-messages';

const view = vi.hoisted(() => ({ state: null as SwitchState | null, text: '', selection: undefined as TextSelection | undefined }));
// 브라우저 메시지 전달·화면만 대체하고 실제 controller·capture·DOM으로 초안 전환을 검사한다.
vi.mock('@/page/overlay/switch-panel', () => ({ createSwitchPanel: () => ({
  render: (state: SwitchState, _title: string, text: string, _notice: string, selection?: TextSelection) => {
    view.state = state; view.text = text; view.selection = selection;
  }, destroy: () => { view.state = null; },
}) }));

const cleanups: (() => void)[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] });
  document.body.innerHTML = ''; view.state = null; view.text = ''; view.selection = undefined;
});
afterEach(() => { cleanups.splice(0).forEach((cleanup) => { cleanup(); }); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function fixture(readDraft?: () => Promise<{ text: string }>) {
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
  const listeners: Listener[] = []; let frames: SwitchFrameReport[] = []; let storedDraft = '';
  vi.stubGlobal('chrome', {
    runtime: { id: 'unit-extension', onMessage: { addListener: (listener: Listener) => { listeners.push(listener); }, removeListener: (listener: Listener) => { const at = listeners.indexOf(listener); if (at >= 0) listeners.splice(at, 1); } },
      sendMessage: async (raw: unknown) => {
        const message = raw as { type: string; documentGeneration?: string; items?: SwitchFrameReport['items']; text?: string };
        if (message.type === 'switch/report') { frames = [{ frameId: 0, documentGeneration: message.documentGeneration ?? '', path: [], items: message.items ?? [] }]; return { tabId: 1 }; }
        if (message.type === 'switch/list') return { tabId: 1, frames };
        if (message.type === 'switch/draft/read') return readDraft ? readDraft() : { text: storedDraft };
        if (message.type === 'switch/draft') { storedDraft = message.text ?? ''; return { ok: true }; }
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
  async function begin() { listeners.forEach((listener) => listener({ type: 'switch/begin', url: location.href }, { id: 'unit-extension' }, () => undefined)); await vi.advanceTimersByTimeAsync(1); }
  async function capture() { if (view.state?.mode === 'paused' || view.state?.mode === 'ready') await press(); await choose('찾기'); await choose('문장'); }
  return { controller, field, setEnabled, press, choose, begin, capture, reportChange: () => { reportChange(); } };
}

it('first enabled load captures the existing text and backward selection', async () => {
  const f = await fixture(); await f.setEnabled(true); await f.capture();
  expect(view.text).toBe('가👍🏽나'); expect(view.selection).toEqual({ start: 1, end: 5, direction: 'backward' });
});

it('turning off and explicitly enabling an unused panel still permits first capture', async () => {
  const f = await fixture(); await f.setEnabled(true); await f.setEnabled(false); await f.setEnabled(true); await f.capture();
  expect(view.text).toBe('가👍🏽나');
});

it('popup begin before any draft still captures the existing field', async () => {
  const f = await fixture(); await f.setEnabled(true); await f.begin(); await f.capture();
  expect(view.text).toBe('가👍🏽나'); expect(view.selection?.direction).toBe('backward');
});

it('pause and resume retain captured text and resume only resumes', async () => {
  const f = await fixture(); await f.setEnabled(true); await f.capture(); f.controller.pause(); await f.press();
  expect(view.state?.mode).toBe('composing'); expect(view.text).toBe('가👍🏽나'); expect(f.field.value).toBe('가👍🏽나');
});

it('explicit reenable and popup begin preserve an edited draft across recapture', async () => {
  const f = await fixture(); await f.setEnabled(true); await f.capture(); await f.choose('문구'); await f.choose('라');
  await f.setEnabled(false); await f.setEnabled(true); await f.begin(); await f.capture();
  expect(view.text).toBe('가라나'); expect(f.field.value).toBe('가👍🏽나');
});

it('an explicitly chosen blank new sentence survives stop, reenable and begin', async () => {
  const f = await fixture(); await f.setEnabled(true); await f.press(); await f.choose('글쓰기'); await f.choose('새 문장');
  await f.setEnabled(false); await f.setEnabled(true); await f.begin(); await f.capture();
  expect(view.text).toBe(''); expect(f.field.value).toBe('가👍🏽나');
});

it('a delayed draft read cannot restore old text after an explicit blank new sentence', async () => {
  let delayed = false;
  let release: (value: { text: string }) => void = () => { throw new Error('read not started'); };
  const pending = new Promise<{ text: string }>((resolve) => { release = resolve; });
  const f = await fixture(() => delayed ? pending : Promise.resolve({ text: '' }));
  await f.setEnabled(true); await f.press(); await f.choose('글쓰기');
  delayed = true; f.reportChange(); await vi.advanceTimersByTimeAsync(1);
  await f.choose('새 문장'); expect(view.text).toBe('');
  release({ text: '이전 문장' }); await vi.advanceTimersByTimeAsync(1);
  expect(view.text).toBe(''); expect(f.field.value).toBe('가👍🏽나');
});

it('a delayed saved draft still restores when the user has not chosen or edited a draft', async () => {
  let release: (value: { text: string }) => void = () => { throw new Error('read not started'); };
  const pending = new Promise<{ text: string }>((resolve) => { release = resolve; });
  const f = await fixture(() => pending); await f.setEnabled(true);
  release({ text: '이어 쓸 문장' }); await vi.advanceTimersByTimeAsync(1);
  expect(view.text).toBe('이어 쓸 문장'); expect(f.field.value).toBe('가👍🏽나');
});
