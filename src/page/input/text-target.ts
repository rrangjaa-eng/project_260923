import type { Collector } from '@/page/collector/collector';
export function typingElement(el: Element | undefined): el is HTMLInputElement | HTMLTextAreaElement {
  return el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && ['text','search','email','tel','url'].includes(el.type));
}
export function sensitiveElement(el: Element): boolean {
  return el instanceof HTMLInputElement && (el.type === 'password' || /password|one-time-code|cc-/.test(el.autocomplete)
    || /비밀번호|주민|계좌|카드번호|password|ssn/i.test(`${el.name} ${el.id} ${el.getAttribute('aria-label') ?? ''}`));
}
export function captureTextTarget(collector: Collector, itemId: string): { value: string } | null {
  const el=collector.get(itemId);
  return typingElement(el) && el.isConnected && !el.readOnly && !el.disabled && !sensitiveElement(el) ? { value: el.value } : null;
}
export function applyDraft(collector: Collector, itemId: string, expected: string, text: string): 'done' | 'refused' {
  const el=collector.get(itemId);
  if(!typingElement(el)||!el.isConnected||el.readOnly||el.disabled||sensitiveElement(el)||el.value!==expected)return 'refused';
  const descriptor=Object.getOwnPropertyDescriptor(el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype,'value');
  if(!descriptor?.set)return 'refused';
  descriptor.set.call(el,text);el.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,inputType:'insertText',data:text}));
  el.dispatchEvent(new Event('change',{bubbles:true}));return 'done';
}
