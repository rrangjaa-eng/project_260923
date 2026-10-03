// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import type { Collector, Item } from '../../src/page/collector/collector';
import { executeSwitchAction, reportSwitchItem } from '../../src/page/input/switch-actions';
import type { SwitchTargetAction } from '../../src/shared/switch-messages';
import { sensitiveElement } from '../../src/page/input/text-target';

beforeEach(() => { document.body.innerHTML = ''; });

it('excludes sensitive textareas and OTP fields from capture and application', () => {
  for (const [tag, name] of [['textarea', '주민등록번호'], ['textarea', 'ssn'], ['input', 'otp'], ['input', '인증번호']]) {
    const f = fixture(tag);
    f.el.setAttribute('aria-label', name ?? '');
    expect(sensitiveElement(f.el)).toBe(true);
    expect(executeSwitchAction(f.collector, { ...f.action, kind: 'capture' }, f.press).result).toBe('refused');
  }
});

function fixture(tag = 'a') {
  const el = document.createElement(tag);
  el.textContent = '읽기';
  el.setAttribute('href', '#read');
  document.body.append(el);
  let item: Item = { id: 'A', name: '읽기', kind: tag, danger: false, rect: { x: 0, y: 0, w: 10, h: 10 }, fingerprint: { framePath: [], domPath: 'body/a', buttonText: '읽기' } };
  const collector: Collector = { get: () => el, items: () => [item], refresh: () => undefined, onChange: () => undefined };
  const action: SwitchTargetAction = { actionId: 'once', kind: 'press', target: { tabId: 1, frameId: 0, documentGeneration: 'doc', itemId: 'A' }, expectedIdentity: reportSwitchItem(item, el).identity, authorization: { documentGeneration: 'doc', modeGeneration: 0, pendingActionId: 'pending' } };
  const press = vi.fn();
  return { el, collector, action, press, change: (patch: Partial<Item>) => { item = { ...item, ...patch }; } };
}

it('revalidates meaning, destination, visibility and active state immediately before a press', () => {
  for (const change of ['meaning', 'href', 'disabled', 'hidden', 'detached']) {
    const f = fixture();
    if (change === 'meaning') f.change({ name: '삭제', danger: true });
    if (change === 'href') f.el.setAttribute('href', '#delete');
    if (change === 'disabled') f.el.setAttribute('aria-disabled', 'true');
    if (change === 'hidden') f.el.hidden = true;
    if (change === 'detached') f.el.remove();
    expect(executeSwitchAction(f.collector, f.action, f.press).result).toBe('refused');
    expect(f.press).not.toHaveBeenCalled();
  }
});

it('requires explicit confirmation for an unknown button and accepts the unchanged confirmed action once', () => {
  const f = fixture('button');
  expect(executeSwitchAction(f.collector, f.action, f.press).result).toBe('refused');
  expect(f.press).not.toHaveBeenCalled();
  expect(executeSwitchAction(f.collector, { ...f.action, confirmed: true }, f.press).result).toBe('done');
  expect(f.press).toHaveBeenCalledTimes(1);
});

it('refuses a changed external input value and excludes sensitive fields from capture', () => {
  const f = fixture('input');
  const el = f.el as HTMLInputElement;
  el.value = 'changed';
  expect(executeSwitchAction(f.collector, { ...f.action, kind: 'applyText', text: '안녕', expectedValue: '' }, f.press).result).toBe('refused');
  expect(el.value).toBe('changed');
  el.type = 'password';
  expect(executeSwitchAction(f.collector, { ...f.action, kind: 'capture' }, f.press).result).toBe('refused');
});

it('captures selection and explicitly returns only to an unchanged eligible field', () => {
  const f = fixture('textarea');
  const el = f.el as HTMLTextAreaElement;
  el.value = '가👍🏽나';
  el.setSelectionRange(1, 5, 'backward');
  const captured = executeSwitchAction(f.collector, { ...f.action, kind: 'capture' }, f.press);
  expect(captured).toEqual({ result: 'done', value: '가👍🏽나', selection: { start: 1, end: 5, direction: 'backward' } });
  const restore = { ...f.action, kind: 'restoreText' as const, expectedValue: el.value, selection: captured.selection };
  el.setSelectionRange(0, 0);
  expect(executeSwitchAction(f.collector, restore, f.press).result).toBe('done');
  expect(document.activeElement).toBe(el);
  expect([el.selectionStart, el.selectionEnd, el.selectionDirection]).toEqual([1, 5, 'backward']);
  document.body.focus();
  el.value = '사이트 변경';
  expect(executeSwitchAction(f.collector, restore, f.press).result).toBe('refused');
  expect(el.value).toBe('사이트 변경');
  expect(f.press).not.toHaveBeenCalled();
});

it('applies to email fields without selection APIs and leaves focus for an explicit return', () => {
  for (const tag of ['input', 'textarea']) {
    const f = fixture(tag);
    const el = f.el as HTMLInputElement;
    if (tag === 'input') el.type = 'email';
    el.value = 'old';
    const action = { ...f.action, expectedIdentity: reportSwitchItem(f.collector.items()[0] as Item, el).identity, kind: 'applyText' as const, text: 'new', expectedValue: 'old', selection: { start: 1, end: 1, direction: 'none' as const } };
    expect(executeSwitchAction(f.collector, action, f.press).result).toBe('done');
    expect(el.value).toBe('new');
    expect(document.activeElement).not.toBe(el);
  }
});

it('refuses restoration when a focus handler changes the field to an unsupported type', () => {
  const f = fixture('input');
  const el = f.el as HTMLInputElement;
  el.value = '123';
  el.addEventListener('focus', () => { el.type = 'number'; });
  const action = { ...f.action, kind: 'restoreText' as const, expectedValue: '123', selection: { start: 1, end: 2, direction: 'forward' as const } };
  expect(executeSwitchAction(f.collector, action, f.press).result).toBe('refused');
  expect(el.value).toBe('123');
  expect(f.press).not.toHaveBeenCalled();
});

it('field metadata strips embedded textarea contents and live sensitive labels refuse capture/apply', () => {
  const el = document.createElement('textarea'); el.id = 'plain'; el.textContent = 'private-value';
  const label = document.createElement('label'); label.append('문장', el); document.body.append(label);
  let item: Item = { id: 'A', name: '문장private-value', kind: 'textarea', danger: false, rect: { x: 0, y: 0, w: 10, h: 10 }, fingerprint: { framePath: [], domPath: 'label/textarea', labelText: '문장private-value' } };
  const collector: Collector = { get: () => el, items: () => [item], refresh: () => undefined, onChange: () => undefined };
  const report = reportSwitchItem(item, el); expect(report.label).toBe('문장'); expect(JSON.stringify(report)).not.toContain('private-value');
  const action: SwitchTargetAction = { actionId: 'once', kind: 'capture', target: { tabId: 1, frameId: 0, documentGeneration: 'doc', itemId: 'A' }, expectedIdentity: report.identity, authorization: { documentGeneration: 'doc', modeGeneration: 0, pendingActionId: 'pending' } };
  if(label.firstChild)label.firstChild.textContent = 'PW'; el.setAttribute('aria-label', '문장');
  expect(sensitiveElement(el)).toBe(true); expect(executeSwitchAction(collector, action).result).toBe('refused');
  expect(executeSwitchAction(collector, { ...action, kind: 'applyText', expectedValue: 'private-value', text: '변경' }).result).toBe('refused');
  item = { ...item, name: 'PW' }; expect(reportSwitchItem(item, el).sensitive).toBe(true); expect(el.value).toBe('private-value');
});

it('metadata cannot read a control or contenteditable root through aria-labelledby', () => {
  for(const tag of ['textarea','div']){
    document.body.innerHTML='<textarea aria-labelledby="label-source"></textarea>';
    const source=document.createElement(tag);source.id='label-source';source.textContent='private-value';if(tag==='div')source.setAttribute('contenteditable','true');document.body.append(source);
    const el=document.querySelector('textarea');if(!el)throw new Error('missing fixture');
    const item:Item={id:'A',name:'private-value',kind:'textarea',danger:false,rect:{x:0,y:0,w:10,h:10},fingerprint:{framePath:[],domPath:'textarea',aria:'private-value'}};
    expect(JSON.stringify(reportSwitchItem(item,el))).not.toContain('private-value');
  }
});

it('explicit doubleClick dispatches only one bubbling detail-2 dblclick, without click, focus or press fallback', () => {
  const f=fixture('button');f.el.setAttribute('type','button');
  const events:{type:string;detail:number}[]=[];
  const parent=document.createElement('div');document.body.append(parent);parent.append(f.el);
  for(const type of ['pointerdown','mousedown','focus','click','dblclick'])parent.addEventListener(type,event=>{events.push({type,detail:(event as MouseEvent).detail});},{once:true,capture:true});
  const action={...f.action,kind:'doubleClick' as SwitchTargetAction['kind'],confirmed:true,expectedIdentity:reportSwitchItem(f.collector.items()[0] as Item,f.el).identity};
  expect(executeSwitchAction(f.collector,action,f.press).result).toBe('done');
  expect(events).toEqual([{type:'dblclick',detail:2}]);expect(f.press).not.toHaveBeenCalled();
});

it('doubleClick refuses unconfirmed, frame, dangerous and non-native-button targets without any fallback',()=>{
 for(const scenario of ['unconfirmed','frame','danger','link','submit','reset','editable','nested-input','disabled']){
  const f=fixture(scenario==='link'?'a':'button');f.el.setAttribute('type',scenario==='submit'?'submit':scenario==='reset'?'reset':'button');
  if(scenario==='danger')f.change({danger:true});
  if(scenario==='editable')f.el.setAttribute('contenteditable','true');
  if(scenario==='nested-input')f.el.append(document.createElement('input'));
  if(scenario==='disabled')f.el.setAttribute('disabled','');
  let effects=0;f.el.addEventListener('dblclick',()=>effects++);f.el.addEventListener('click',()=>effects++);
  const action={...f.action,kind:'doubleClick' as SwitchTargetAction['kind'],confirmed:scenario!=='unconfirmed',target:{...f.action.target,frameId:scenario==='frame'?1:0},expectedIdentity:reportSwitchItem(f.collector.items()[0] as Item,f.el).identity};
  expect(executeSwitchAction(f.collector,action,f.press).result).toBe('refused');expect(effects).toBe(0);expect(f.press).not.toHaveBeenCalled();
 }
});
