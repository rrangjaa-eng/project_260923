// @vitest-environment happy-dom
import { beforeEach, expect, it } from 'vitest';
import type { Collector, Item } from '../../src/page/collector/collector';
import type { SwitchTargetAction } from '../../src/shared/switch-messages';
import { executeSwitchAction, reportSwitchItem } from '../../src/page/input/switch-actions';
import { clearAppliedText } from '../../src/page/input/applied-text-undo';

beforeEach(() => { document.body.innerHTML = ''; });
function fixture(tag: 'input' | 'textarea' = 'input') {
  let el = document.createElement(tag); el.value = '가👍🏽나'; el.setAttribute('aria-label', '문장'); const wrapper=document.createElement('div');wrapper.append(el);document.body.append(wrapper); el.setSelectionRange(1, 5, 'backward');
  const item: Item = { id: 'field', name: '문장', kind: 'input', danger: false, rect: { x: 0, y: 0, w: 100, h: 30 }, fingerprint: { framePath: [], domPath: 'body/input' } };
  const collector: Collector = { get: () => el, items: () => [item], refresh: () => undefined, onChange: () => undefined };
  const action: SwitchTargetAction = { actionId: 'apply-1', kind: 'applyText', target: { tabId: 1, frameId: 0, documentGeneration: 'doc', itemId: 'field' }, expectedIdentity: reportSwitchItem(item, el).identity,
    expectedValue: '가👍🏽나', text: '새 값', authorization: { documentGeneration: 'doc', modeGeneration: 0, pendingActionId: 'pending' } };
  let inputs = 0; let changes = 0;
  el.addEventListener('input', () => { inputs++; }); el.addEventListener('change', () => { changes++; });
  const applied = executeSwitchAction(collector, action); expect(applied.result).toBe('done'); expect(applied.undoToken).toBe('apply-1');
  const undo = (patch: Partial<SwitchTargetAction> = {}) => executeSwitchAction(collector, { ...action, actionId: 'undo-1', kind: 'undoText', undoToken: applied.undoToken, confirmed: true, ...patch });
  return { collector, action, undo, get el() { return el; }, counts: () => [inputs, changes], replace() { const replacement = el.cloneNode(true) as typeof el; replacement.value = el.value; el.replaceWith(replacement); el = replacement; } };
}

it.each(['input', 'textarea'] as const)('restores %s value and backward selection once; preview has no effects', tag => {
  const f = fixture(tag);
  expect(f.undo({ kind: 'previewUndo' })).toMatchObject({ result: 'done', value: '가👍🏽나', appliedValue: '새 값' }); expect(f.counts()).toEqual([1, 1]);
  expect(f.undo()).toMatchObject({ result: 'done', value: '가👍🏽나' }); expect(f.el.value).toBe('가👍🏽나'); expect([f.el.selectionStart, f.el.selectionEnd, f.el.selectionDirection]).toEqual([1, 5, 'backward']); expect(f.counts()).toEqual([2, 2]);
  expect(f.undo({ actionId: 'undo-again' }).result).toBe('refused'); expect(f.counts()).toEqual([2, 2]);
});

it.each(['value', 'node', 'label', 'sensitive', 'disabled', 'readonly', 'hidden', 'removed', 'reattached', 'rescued', 'clear'])('rejects changed %s before undo without further input/change events', boundary => {
  const f = fixture();
  if (boundary === 'value') f.el.value = '사이트 변경';
  if (boundary === 'node') f.replace();
  if (boundary === 'label') f.el.setAttribute('aria-label', '다른 의미');
  if (boundary === 'sensitive') f.el.setAttribute('autocomplete', 'one-time-code');
  if (boundary === 'disabled') f.el.disabled = true;
  if (boundary === 'readonly') f.el.readOnly = true;
  if (boundary === 'hidden') f.el.hidden = true;
  if (boundary === 'removed') f.el.remove();
  if (boundary === 'reattached') { f.el.remove(); document.body.append(f.el); }
  if (boundary === 'rescued') { const parent=f.el.parentElement; parent?.remove(); document.body.append(f.el); }
  if (boundary === 'clear') clearAppliedText(f.collector);
  const before = f.el.value; expect(f.undo().result).toBe('refused'); expect(f.el.value).toBe(before); expect(f.counts()).toEqual([1, 1]);
});

it.each(['token', 'document', 'frame', 'unconfirmed'])('rejects %s mismatch and consumes the old capability', boundary => {
  const f = fixture(); const patch: Partial<SwitchTargetAction> = boundary === 'token' ? { undoToken: 'other' } : boundary === 'unconfirmed' ? { confirmed: false } : { target: { ...f.action.target, ...(boundary === 'frame' ? { frameId: 2 } : { documentGeneration: 'other-doc' }) } };
  expect(f.undo(patch).result).toBe('refused'); expect(f.undo().result).toBe('refused'); expect(f.el.value).toBe('새 값'); expect(f.counts()).toEqual([1, 1]);
});

it('site mutation during undo yields unknown and cannot be replayed', () => {
  const f = fixture(); f.el.addEventListener('input', () => { f.el.value = '사이트가 다시 변경'; }, { once: true });
  expect(f.undo().result).toBe('unknown'); expect(f.el.value).toBe('사이트가 다시 변경'); expect(f.counts()).toEqual([2, 2]);
  expect(f.undo().result).toBe('refused'); expect(f.counts()).toEqual([2, 2]);
});

it('a subsequent application replaces the earlier one instead of building history', () => {
  const f = fixture(); const second = executeSwitchAction(f.collector, { ...f.action, actionId: 'apply-2', expectedValue: '새 값', text: '다음 값' });
  expect(second.undoToken).toBe('apply-2'); expect(f.undo({ undoToken: second.undoToken })).toMatchObject({ result: 'done', value: '새 값' });
  expect(f.undo().result).toBe('refused'); expect(f.el.value).toBe('새 값');
});

it('removal and reinsertion during undo is unknown and consumes the capability', () => {
 const f=fixture();f.el.addEventListener('input',()=>{f.el.remove();document.body.append(f.el);},{once:true});
 expect(f.undo().result).toBe('unknown');expect(f.undo().result).toBe('refused');expect(f.counts()).toEqual([2,2]);
});

it('a node removed and reinserted by the apply event cannot acquire a new undo token', () => {
 const f=fixture();f.el.addEventListener('input',()=>{f.el.remove();document.body.append(f.el);},{once:true});
 const result=executeSwitchAction(f.collector,{...f.action,actionId:'apply-2',expectedValue:'새 값',text:'다음 값'});
 expect(result.undoToken).toBeUndefined();expect(f.undo().result).toBe('refused');expect(f.el.value).toBe('다음 값');expect(f.counts()).toEqual([2,2]);
});
