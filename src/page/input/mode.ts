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

// Task 3(01-18, KEY-01): 문서 전체가 편집 가능한 편집기(designMode 문서, contenteditable
// 본문 — src= iframe·document.write 편집기 모두)인지 — 초점 대상이 자기 ownerDocument의
// body나 documentElement이고 편집 가능한 경우다.
export function isDocumentEditingRoot(el: Element | null): boolean {
  if (el === null) {
    return false;
  }
  const doc = el.ownerDocument;
  return (el === doc.body || el === doc.documentElement) && isTypingTarget(el);
}

// Esc로 문서 전체 편집기에서 "나옴" 상태(probe evidence: blur()는 캐럿을 지워 편집기가 키를
// 받지 못하게 만든다 — 그래서 blur 대신 이 표시만 바꾼다). 프레임(모듈 인스턴스)마다 독립이다.
let escapedFromDocumentEditor = false;

export function escapeDocumentEditor(): void {
  escapedFromDocumentEditor = true;
}

export function resumeDocumentEditor(): void {
  escapedFromDocumentEditor = false;
}

export function isEscapedFromDocumentEditor(): boolean {
  return escapedFromDocumentEditor;
}

export function currentMode(): 'typing' | 'helper' {
  const active = deepActiveElement();
  if (escapedFromDocumentEditor && isDocumentEditingRoot(active)) {
    return 'helper';
  }
  return isTypingTarget(active) ? 'typing' : 'helper';
}
