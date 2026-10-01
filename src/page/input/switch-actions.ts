import { buildFrameReport, contentBoxOf, type Collector, type Item } from '@/page/collector/collector';
import type { SwitchReportItem, SwitchTargetAction, TextSelection } from '@/shared/switch-messages';
import { synthesizePress } from '@/page/click/press';
import { applyDraft, captureTextTarget, sensitiveElement, typingElement, restoreTextTarget } from './text-target';

export interface SwitchPageResult { result: 'done' | 'refused' | 'unknown'; value?: string; selection?: TextSelection }

export function reportSwitchItem(item: Item, el: Element | undefined): SwitchReportItem {
  const label = (item.name || item.fingerprint.buttonText || item.kind).slice(0, 300);
  const destination = el instanceof HTMLAnchorElement ? el.href : '';
  const submitter = el instanceof HTMLInputElement || el instanceof HTMLButtonElement ? el : null;
  const form = submitter?.form;
  const submission = form ? [
    submitter.hasAttribute('formaction') ? submitter.formAction : form.action,
    submitter.hasAttribute('formmethod') ? submitter.formMethod : form.method,
    submitter.hasAttribute('formtarget') ? submitter.formTarget : form.target,
    submitter.hasAttribute('formenctype') ? submitter.formEnctype : form.enctype,
    form.noValidate || submitter.formNoValidate,
  ] : null;
  const inputType = el instanceof HTMLInputElement ? el.type : '';
  const danger = item.danger || (el instanceof HTMLAnchorElement && !['http:', 'https:'].includes(el.protocol));
  return {
    itemId: item.id, label, kind: item.kind, danger,
    editable: typingElement(el), sensitive: !!el && sensitiveElement(el),
    identity: JSON.stringify([item.name, item.kind, danger, item.fingerprint, destination, inputType, submission, submitter?.type]),
  };
}

export function visibleSwitchChild(index: number): boolean {
  const frame = Array.from(document.querySelectorAll('iframe')).find((el) => el.contentWindow === window.frames[index]);
  if (!frame || !activeElement(frame)) return false;
  const child = buildFrameReport([]).children.find((entry) => entry.index === index);
  const box = contentBoxOf(frame);
  // 부분적으로 가려진 프레임도 보수적으로 제외한다. 자식의 로컬 뷰포트만으로는
  // 선택된 요소가 부모의 clip 안에 보이는지 보장할 수 없다.
  return !!child && child.clip.x <= box.x && child.clip.y <= box.y
    && child.clip.x + child.clip.w >= box.x + box.w && child.clip.y + child.clip.h >= box.y + box.h;
}

function activeElement(el: Element): boolean {
  if (!el.isConnected || el.matches(':disabled,[aria-disabled="true"]')) return false;
  for (let ancestor: Element | null = el; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor instanceof HTMLElement && (ancestor.hidden || ancestor.inert)) return false;
    const style = getComputedStyle(ancestor);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}

export function executeSwitchAction(
  collector: Collector,
  action: SwitchTargetAction,
  press: (el: Element) => void = synthesizePress,
): SwitchPageResult {
  collector.refresh();
  const item = collector.items().find((entry) => entry.id === action.target.itemId);
  const el = collector.get(action.target.itemId);
  if (!item || !el || !activeElement(el) || sensitiveElement(el)) return { result: 'refused' };
  const current = reportSwitchItem(item, el);
  if (current.identity !== action.expectedIdentity) return { result: 'refused' };
  if (action.kind === 'capture') {
    const snapshot = captureTextTarget(collector, action.target.itemId);
    return snapshot ? { result: 'done', ...snapshot } : { result: 'refused' };
  }
  if (action.kind === 'applyText' && typeof action.expectedValue === 'string' && typeof action.text === 'string') {
    return { result: applyDraft(collector, action.target.itemId, action.expectedValue, action.text, action.selection) };
  }
  if (action.kind === 'restoreText' && typeof action.expectedValue === 'string') {
    return { result: restoreTextTarget(collector, action.target.itemId, action.expectedValue, action.selection) };
  }
  if (action.kind === 'press' && !typingElement(el) && !el.matches('input[type=file],select,input[type=date],input[type=color],input[type=time]')) {
    if ((current.danger || !['a', 'link'].includes(current.kind)) && !action.confirmed) return { result: 'refused' };
    press(el);
    return { result: 'done' };
  }
  if (action.kind === 'search' && el instanceof HTMLInputElement && !el.readOnly && el.type === 'search'
      && el.form?.method.toLowerCase() === 'get' && el.value === action.expectedValue) {
    el.form.requestSubmit();
    return { result: 'done' };
  }
  return { result: 'refused' };
}
