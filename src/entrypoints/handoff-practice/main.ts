import tokensCss from '../../../docs/design/tokens.css?inline';
import { createPracticeFileProvider } from '@/core/file-selection';
import { FileReplyGate, parseFileRequest, type FileContext, type FileProtocolRequest, type FileProtocolReply } from '@/core/file-protocol';
import { createSwitchState, reduceSwitch, type SwitchItem } from '@/core/switch-engine';
import { SwitchHandoff, type OwnedAction } from '@/core/switch-handoff';
import { createSwitchPanel } from '@/page/overlay/switch-panel';
function required<T extends Element>(found: T | null): T { if (!found) throw new Error('연습 화면 없음'); return found; }
const style = document.createElement('style');
style.textContent = `${tokensCss}\nbody{margin:var(--space-4);font-family:var(--font);font-size:var(--text-body);line-height:var(--leading);color:var(--fg);background:var(--bg)}h1{font-size:var(--text-title)}label{display:block;margin:var(--space-2) 0}button,input{font:inherit;min-height:var(--target-min);box-sizing:border-box}button{background:var(--surface);color:var(--fg);padding:var(--space-2);border:var(--border-strong) solid var(--accent);border-radius:var(--radius-button)}`;
document.head.append(style);
const pageCount = required(document.querySelector<HTMLOutputElement>('#page-count'));
const practiceCount = required(document.querySelector<HTMLOutputElement>('#practice-count'));
const ownerLabel = required(document.querySelector<HTMLElement>('#owner'));
const normalCount = required(document.querySelector<HTMLOutputElement>('#normal-count'));
const delayed = required(document.querySelector<HTMLInputElement>('[aria-label="지연 응답 연습"]'));
const provider = createPracticeFileProvider();
const item = (id: string, label: string): SwitchItem => ({ id, label, action: { kind: 'command' } });
const pause = item('pause', '쉬기'), stop = item('stop', '즉시 정지 · 연습 종료');
function initial(items: SwitchItem[]) { return reduceSwitch(createSwitchState(), { type: 'start', now: performance.now(), mode: 'groupScan', items }).state; }
const pageState = initial([item('move', '연습 역할로 이동'), item('page-test', '페이지 연습 동작'), pause, stop]); pageState.mode = 'ready';
const practiceState = initial([item('cancel', '취소 · 페이지 역할로 복귀'), item('status', '연습 상태 확인'), pause, stop]);
const flow = new SwitchHandoff({ page: pageState, practice: practiceState });
let session = 1, documentGeneration = 1, sequence = 0;
let inFlight: OwnedAction | null = null;
let stopped = false;
function context(): FileContext {
  const state = flow.snapshot(flow.owner ?? 'page');
  return { sessionId: `session${String(session)}`, documentGeneration: `document${String(documentGeneration)}`, modeGeneration: state.modeGeneration, handoffGeneration: flow.generation };
}
const gate = new FileReplyGate(context());
const panel = createSwitchPanel();
function render() {
  gate.changeContext(context());
  if (flow.owner === null) { shutdown(); return; }
  const state = flow.snapshot(flow.owner);
  const label = flow.owner === 'page' ? '페이지 역할' : '연습 역할';
  ownerLabel.textContent = `지금 입력: ${label}`;
  ownerLabel.dataset.generation = String(flow.generation);
  panel.render(state, `${label} · 실제 파일/OS 입력 없음`, state.draft,
    state.mode === 'executing' ? '응답 대기 · 다음 스페이스바는 전체 정지' : state.mode === 'paused' ? '쉬는 중 · 새 스페이스바로 재개만' : '스페이스바로 선택');
}
async function echo(request: FileProtocolRequest): Promise<FileProtocolReply> {
  if (request.command === 'status' && delayed.checked) await new Promise<void>((resolve) => { setTimeout(resolve, 2500); });
  return { version: 1, sessionId: request.sessionId, requestId: request.requestId, documentGeneration: request.documentGeneration,
    modeGeneration: request.modeGeneration, handoffGeneration: request.handoffGeneration, command: request.command, result: provider.files.length > 0 ? 'done' : 'refused' };
}
async function perform(action: OwnedAction) {
  if (action.itemId === 'pause') { flow.pause(performance.now()); render(); return; }
  if (action.itemId === 'stop') { flow.stop(performance.now()); render(); return; }
  const command = action.itemId === 'move' ? 'list-files' : action.itemId === 'cancel' ? 'cancel' : 'status';
  const parsed = parseFileRequest({ version: 1, ...context(), requestId: `r${String(++sequence)}`, command, expiresAt: Date.now() + 60000 }, Date.now(), context());
  if (!parsed || !gate.arm(parsed, Date.now())) { flow.complete(action, 'refused', performance.now()); render(); return; }
  inFlight = action;
  const reply = await echo(parsed);
  if (stopped) return;
  const accepted = gate.take(reply, Date.now());
  if (inFlight === action) inFlight = null;
  if (!accepted || !flow.complete(action, accepted.result, performance.now())) { render(); return; }
  if (accepted.result === 'done') {
    if (action.itemId === 'move') flow.transfer('practice', performance.now());
    else if (action.itemId === 'cancel') flow.cancel(performance.now());
    else { const counter = action.surface === 'page' ? pageCount : practiceCount; counter.textContent = String(Number(counter.textContent) + 1); }
  }
  render();
}
function pauseInput() { if (!stopped) { flow.pause(performance.now()); render(); } }
function focus(event: FocusEvent) {
  const owner = flow.owner;
  if (owner && (event.target instanceof HTMLInputElement || flow.snapshot(owner).pressed !== null)) pauseInput();
}
function key(event: KeyboardEvent) {
  if (stopped || event.code !== 'Space' || event.target === document.querySelector('#stop')) return;
  if (event.target instanceof HTMLInputElement) { const owner = flow.owner; if (owner && flow.snapshot(owner).pressed !== null) pauseInput(); return; }
  event.preventDefault(); event.stopImmediatePropagation();
  for (const surface of ['page', 'practice'] as const) {
    const actions = flow.key(surface, { type: event.type === 'keydown' ? 'keyDown' : 'keyUp', code: event.code, repeat: event.repeat, trusted: event.isTrusted, isComposing: event.isComposing,
      modified: event.altKey || event.ctrlKey || event.metaKey || event.shiftKey, now: performance.now() });
    for (const action of actions) void perform(action);
  }
  render();
}
function shutdown() {
  if (stopped) return;
  stopped = true; flow.stop(performance.now()); gate.changeContext(context()); inFlight = null; clearInterval(timer); panel.destroy();
  document.querySelector('tremor-helper-root')?.remove(); ownerLabel.textContent = '지금 입력: 연습 종료 · 일반 키 복구';
  document.removeEventListener('keydown', key, true); document.removeEventListener('keyup', key, true); document.removeEventListener('focusin', focus, true); window.removeEventListener('blur', pauseInput);
}
for (const [surface, name] of [['page', '페이지 역할 문장'], ['practice', '연습 역할 문장']] as const) {
  const input = required(document.querySelector<HTMLInputElement>(`[aria-label="${name}"]`));
  input.addEventListener('input', () => { flow.setDraft(surface, input.value); render(); });
}
required(document.querySelector('#normal')).addEventListener('click', () => { normalCount.textContent = String(Number(normalCount.textContent) + 1); });
required(document.querySelector('#document-change')).addEventListener('click', () => { documentGeneration++; pauseInput(); });
required(document.querySelector('#session-change')).addEventListener('click', () => { session++; pauseInput(); });
required(document.querySelector('#stop')).addEventListener('click', shutdown);
document.addEventListener('keydown', key, true); document.addEventListener('keyup', key, true); document.addEventListener('focusin', focus, true); window.addEventListener('blur', pauseInput);
const timer = setInterval(() => {
  if (stopped) return;
  flow.tick(performance.now()); gate.changeContext(context());
  if (gate.expire(Date.now()) && inFlight) { flow.complete(inFlight, 'unknown', performance.now()); inFlight = null; }
  render();
}, 50);
render();
