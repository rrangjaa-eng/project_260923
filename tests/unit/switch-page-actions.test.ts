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
