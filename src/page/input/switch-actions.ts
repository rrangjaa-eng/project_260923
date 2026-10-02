import { buildFrameReport, contentBoxOf, type Collector, type Item } from '@/page/collector/collector';
import type { SwitchReportItem, SwitchTargetAction, TextSelection } from '@/shared/switch-messages';
import type { FormControl } from '@/shared/switch-messages';
import { captureControl, applyControl, controlElement, readValidity } from './form-control';
import { synthesizePress } from '@/page/click/press';
import { applyDraft, captureTextTarget, sensitiveElement, typingElement, restoreTextTarget, fieldLabel } from './text-target';

export interface SwitchPageResult { result: 'done' | 'refused' | 'unknown'; value?: string; selection?: TextSelection; control?: FormControl; validation?: string }

export function reportSwitchItem(item: Item, el: Element | undefined): SwitchReportItem {
  const textField=typingElement(el)||controlElement(el)||el instanceof HTMLSelectElement||el instanceof HTMLInputElement&&el.type==='password';
  const label = (textField?fieldLabel(el):item.name || item.fingerprint.buttonText || item.kind).slice(0, 300);
  const fingerprint=textField?{...item.fingerprint,labelText:label,aria:label,buttonText:undefined}:item.fingerprint;
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
    ...(controlElement(el)&&!el.disabled&&(el instanceof HTMLSelectElement?el.options.length>0&&el.options.length<=100&&(!el.multiple||el.getRootNode()===el.ownerDocument):(el.type==='radio'?!!el.name&&el.getRootNode()===el.ownerDocument:!el.indeterminate))?{controlKind:el instanceof HTMLSelectElement?(el.multiple?'multiple' as const:'select' as const):el.type==='radio'?'radio' as const:'checkbox' as const}:{}),
    editable: typingElement(el)&&!el.readOnly&&!el.disabled, sensitive: !!el && sensitiveElement(el),
    identity: JSON.stringify([textField?label:item.name, item.kind, danger, fingerprint, destination, inputType, submission, submitter?.type]),
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
  if (action.kind === 'captureControl') {
    const control = captureControl(el); return control ? {result:'done',control} : {result:'refused'};
  }
  if (action.kind === 'applyControl') {
    const result=applyControl(el,action);
    if(result==='done'&&action.control?.kind==='multiple'){const control=captureControl(el);return control?{result,control}:{result:'refused'};}
    return {result};
  }
  if (action.kind === 'readValidity') {
    const validation=readValidity(el); return validation===null?{result:'refused'}:{result:'done',validation};
  }
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
  if (action.kind === 'press' && !typingElement(el) && !el.matches('input[type=file],input[type=checkbox],input[type=radio],select,input[type=date],input[type=color],input[type=time]')) {
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
