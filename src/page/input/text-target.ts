import type { TextSelection } from '@/shared/switch-messages';
import { sensitiveFieldLabel } from '@/core/form-navigation';
import type { Collector } from '@/page/collector/collector';
export function typingElement(el: Element | undefined): el is HTMLInputElement | HTMLTextAreaElement {
  return el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && ['text','search','email','tel','url'].includes(el.type));
}
function labelText(node:Element):string {
  if(node.matches('input,textarea,select,[contenteditable]'))return '';
  const copy=node.cloneNode(true) as Element;
  copy.querySelectorAll('input,textarea,select,[contenteditable]').forEach((control)=>{control.remove();});
  return copy.textContent.replace(/\s+/g,' ').trim();
}
function labelsOf(el:HTMLInputElement|HTMLTextAreaElement):string[] {
  return [...Array.from(el.labels??[],labelText),...(el.getAttribute('aria-labelledby')??'').split(/\s+/).map((id)=>{const node=el.ownerDocument.getElementById(id);return node?labelText(node):'';})];
}
export function fieldLabel(el:HTMLInputElement|HTMLTextAreaElement):string {
  return el.getAttribute('aria-label')?.trim()||labelsOf(el).find(Boolean)||el.getAttribute('placeholder')?.trim()||el.name||'입력칸';
}
export function sensitiveElement(el: Element): boolean {
  return (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
    && (el instanceof HTMLInputElement && el.type === 'password' || /password|one-time-code|cc-/i.test(el.autocomplete)
    || sensitiveFieldLabel(`${el.name} ${el.id} ${el.getAttribute('aria-label')??''} ${labelsOf(el).join(' ')}`));
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
