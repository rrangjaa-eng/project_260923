import type { TextSelection } from '@/shared/switch-messages';
import type { Collector } from '@/page/collector/collector';
export function typingElement(el: Element | undefined): el is HTMLInputElement | HTMLTextAreaElement {
  return el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && ['text','search','email','tel','url'].includes(el.type));
}
export function sensitiveElement(el: Element): boolean {
  return (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
    && (el instanceof HTMLInputElement && el.type === 'password' || /password|one-time-code|cc-/i.test(el.autocomplete)
    || /비밀번호|주민|계좌|카드번호|인증번호|password|ssn|\botp\b/i.test(`${el.name} ${el.id} ${el.getAttribute('aria-label') ?? ''}`));
}
export function captureTextTarget(collector: Collector, itemId: string): { value: string; selection?: TextSelection } | null {
  const el=collector.get(itemId);
  if (!typingElement(el) || !el.isConnected || el.readOnly || el.disabled || sensitiveElement(el)) return null;
  const selection = el.selectionStart !== null && el.selectionEnd !== null ? { start: el.selectionStart, end: el.selectionEnd, direction: el.selectionDirection ?? 'none' } : undefined;
  return { value: el.value, ...(selection ? { selection } : {}) };
}
export function applyDraft(collector: Collector, itemId: string, expected: string, text: string, selection?: TextSelection): 'done' | 'refused' {
  const el=collector.get(itemId);
  if(!typingElement(el)||!el.isConnected||el.readOnly||el.disabled||sensitiveElement(el)||el.value!==expected)return 'refused';
  const descriptor=Object.getOwnPropertyDescriptor(el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype,'value');
  if(!descriptor?.set)return 'refused';
  descriptor.set.call(el,text);el.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,inputType:'insertText',data:text}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
  if (!writable(el, text)) return 'refused';
  if (selection && el.selectionStart !== null) el.setSelectionRange(selection.start, selection.end, selection.direction);
  return 'done';
}

export function restoreTextTarget(collector: Collector, itemId: string, expected: string, selection?: TextSelection): 'done' | 'refused' {
  const el = collector.get(itemId);
  if (!typingElement(el) || !writable(el, expected)) return 'refused';
  if (selection && selection.end > el.value.length) return 'refused';
  el.focus({ preventScroll: true });
  if (!writable(el, expected)) return 'refused';
  if (selection && el.selectionStart !== null) el.setSelectionRange(selection.start, selection.end, selection.direction);
  return el.ownerDocument.activeElement === el ? 'done' : 'refused';
}

function writable(el: HTMLInputElement | HTMLTextAreaElement, expected: string): boolean {
  if (!typingElement(el) || !el.isConnected || el.readOnly || el.disabled || sensitiveElement(el) || el.value !== expected) return false;
  for (let ancestor: Element | null = el; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor);
    if (ancestor instanceof HTMLElement && (ancestor.hidden || ancestor.inert) || style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}
