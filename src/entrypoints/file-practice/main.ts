import tokensCss from '../../../docs/design/tokens.css?inline';
import { createPracticeFileProvider, FileSelection, type FileRequest } from '@/core/file-selection';
import { createSwitchState, reduceSwitch, type SwitchEvent, type SwitchItem, type SwitchMode } from '@/core/switch-engine';
import { createSwitchPanel } from '@/page/overlay/switch-panel';

const style = document.createElement('style');
style.textContent = `${tokensCss}\nbody{font-family:var(--font);font-size:var(--text-body);line-height:var(--leading);color:var(--fg);background:var(--bg);margin:var(--space-4)}h1{font-size:var(--text-title)}input,button{font:inherit;min-height:var(--target-min);box-sizing:border-box}button{border:var(--border-strong) solid var(--accent);border-radius:var(--radius-button);background:var(--surface);color:var(--fg);padding:var(--space-2)}label{display:block;margin:var(--space-2) 0}`;
document.head.append(style);
function required<T extends Element>(found: T | null): T {
  if (!found) throw new Error('연습 화면 없음');
  return found;
}
const draftInput = required(document.querySelector<HTMLInputElement>('[aria-label="보존할 연습 문장"]'));
const output = required(document.querySelector('output'));
const normal = required(document.querySelector<HTMLButtonElement>('#normal'));
const count = required(document.querySelector<HTMLElement>('#normal-count'));
normal.addEventListener('click', () => { count.textContent = String(Number(count.textContent) + 1); });
const provider = createPracticeFileProvider();
const flow = new FileSelection(provider);
const panel = createSwitchPanel();
let engine = createSwitchState();
let request: FileRequest | null = null;
let serial = 0;
let stopped = false;
let notice = '스페이스바로 연습 시작';
let heading = '연습 · 스페이스바 작업판';
const item = (id: string, label: string): SwitchItem => ({ id, label, action: { kind: 'command' } });
const cancel = item('cancel', '취소 · 원래 화면으로');
const pause = item('pause', '쉬기');
const stop = item('stop', '즉시 정지 · 연습 종료');
const groups = [item('files', '연습 파일 선택'), item('controls', '조절·쉬기'), stop];
const files = [cancel, ...provider.files.map((file) => item(file.token, file.name)), pause, stop];
function render() {
  if (stopped) return;
  const selected = flow.selected;
  const preview = selected ? `${selected.folder} / ${selected.name}\n요청 페이지: 로컬 연습 화면\n이 사이트는 파일을 즉시 보낼 수 있어요\n실제 파일 전송 없음` : flow.draft;
  panel.render(engine, heading, preview, notice);
}
function show(items: SwitchItem[], mode: SwitchMode, title: string, status = '스페이스바로 선택') {
  engine = reduceSwitch(engine, { type: 'start', items, mode, now: performance.now() }).state;
  heading = title; notice = status; render();
}
function ready(message: string) {
  request = null;
  show(groups, 'groupScan', '연습 · 스페이스바 작업판', `${message} · 스페이스바로 재개`);
  engine.mode = 'ready'; render();
}
function rest() {
  if (request) flow.pause();
  engine = reduceSwitch(engine, { type: 'pause', now: performance.now() }).state;
  notice = '쉬는 중 · 승인 취소됨 · 스페이스바로 재개'; render();
}
function shutdown() {
  if (stopped) return;
  stopped = true; flow.stop(); clearInterval(timer); panel.destroy();
  document.querySelector('tremor-helper-root')?.remove();
  document.removeEventListener('keydown', key, true); document.removeEventListener('keyup', key, true);
  window.removeEventListener('blur', rest);
  output.setAttribute('data-stopped', 'true');
}
async function act(id: string) {
  if (id === 'stop') { shutdown(); return; }
  if (id === 'pause') { rest(); return; }
  if (id === 'cancel') { flow.cancel(); ready('선택 취소'); return; }
  if (id === 'files') {
    flow.draft = draftInput.value;
    request = { sessionId: 'practice-session', requestId: String(++serial), documentGeneration: 'practice-document', modeGeneration: serial, expiresAt: performance.now() + 60000 };
    if (!flow.begin(request, performance.now())) { ready('새 선택을 시작하지 못했어요'); return; }
    show(files, 'itemScan', '연습 파일 선택'); return;
  }
  if (id === 'controls') { show([item('back', '상위로'), pause, stop], 'itemScan', '조절·쉬기'); return; }
  if (id === 'back') { show(groups, 'groupScan', '연습 · 스페이스바 작업판'); return; }
  if (id === 'confirm' && request) {
    const selected = flow.selected;
    show([stop], 'itemScan', '연습 선택 처리 중', '스페이스바로 즉시 정지 · 응답 대기 최대 3초');
    const result = await flow.confirm(request, performance.now());
    if (stopped) return;
    if (result === 'done' && selected) { output.textContent = selected.name; ready('연습 선택 완료 · 실제 파일 전송 없음'); }
    else if (flow.state === 'confirming') { show([cancel, item('confirm', '확인 · 이 파일 선택'), pause, stop], 'confirming', '파일 선택 확인', '1초 보호 뒤 새 스페이스바로 확인'); }
    else ready(result === 'unknown' ? '결과 확인 필요 · 자동 재시도하지 않아요' : '선택을 적용하지 못했어요');
    return;
  }
  if (flow.select(id, performance.now())) show([cancel, item('confirm', '확인 · 이 파일 선택'), pause, stop], 'confirming', '파일 선택 확인', '취소 먼저 · 1초 보호 뒤 새 스페이스바로 확인');
}
function send(event: SwitchEvent) {
  const prior = engine.mode;
  const result = reduceSwitch(engine, event); engine = result.state;
  if (engine.mode === 'paused' && prior !== 'paused') { if (request) flow.pause(); notice = '쉬는 중 · 승인 취소됨 · 스페이스바로 재개'; }
  if (event.type === 'keyUp' && prior === 'paused' && engine.mode !== 'paused') {
    if (request) { flow.resume(); show(files, 'itemScan', '연습 파일 선택'); }
    else show(groups, 'groupScan', '연습 · 스페이스바 작업판');
  } else if (prior === 'ready' && engine.mode === 'groupScan') notice = '스페이스바로 선택';
  for (const action of result.actions) void act(action.itemId ?? '');
  render();
}
function key(event: KeyboardEvent) {
  if (stopped || event.code !== 'Space') return;
  if (event.target instanceof HTMLInputElement || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  event.preventDefault(); event.stopImmediatePropagation();
  send({ type: event.type === 'keydown' ? 'keyDown' : 'keyUp', code: event.code, repeat: event.repeat, trusted: event.isTrusted, isComposing: event.isComposing, now: performance.now() });
}
show(groups, 'groupScan', '연습 · 스페이스바 작업판', notice); engine.mode = 'ready'; render();
const timer = setInterval(() => { send({ type: 'tick', now: performance.now() }); }, 50);
document.addEventListener('keydown', key, true); document.addEventListener('keyup', key, true);
window.addEventListener('blur', rest);
document.querySelector('#stop')?.addEventListener('click', shutdown);
