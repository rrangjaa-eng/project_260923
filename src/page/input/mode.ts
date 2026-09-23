// 입력칸 판정과 현재 모드(D-16). document를 읽는 page-context 모듈.

const NON_TYPING_INPUT_TYPES = new Set([
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'file',
  'range',
  'color',
  'image',
  'hidden',
]);

export function isTypingTarget(el: Element | null): boolean {
  if (el === null) {
    return false;
  }
  if (el instanceof HTMLTextAreaElement) {
    return true;
  }
  if (el instanceof HTMLInputElement) {
    return !NON_TYPING_INPUT_TYPES.has(el.type);
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

// 열린 shadow root 안의 포커스도 따라간다.
export function deepActiveElement(): Element | null {
  let active: Element | null = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

export function currentMode(): 'typing' | 'helper' {
  return isTypingTarget(deepActiveElement()) ? 'typing' : 'helper';
}
