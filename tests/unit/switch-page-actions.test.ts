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
