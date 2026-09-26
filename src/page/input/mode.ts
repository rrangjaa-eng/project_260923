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

// CR-01(01-REVIEW.md 2회차, 사용자 결정): "커서 숨기기" 방식 — 나올 때 선택 범위(Range)를
// 저장해 두고 지운다(초점은 그대로 둔다, DOM·편집 속성은 건드리지 않는다). 선택의 편집 루트가
// 없으면 한글 IME가 조합을 시작하지 않을 것으로 예상한다(실측 필요, REVIEW.md 판정 1 참고).
let savedRanges: Range[] = [];

export function escapeDocumentEditor(): void {
  escapedFromDocumentEditor = true;
  const sel = document.getSelection();
  savedRanges = [];
  if (sel) {
    for (let i = 0; i < sel.rangeCount; i += 1) {
      savedRanges.push(sel.getRangeAt(i).cloneRange()); // Range는 이후 DOM 변화를 따라간다
    }
    sel.removeAllRanges();
  }
}

// restoreSelection: Esc를 다시 눌러 돌아올 때만 true(저장한 범위를 복원한다). 편집기를 눌러
// 돌아올 때는 false — 브라우저가 누른 자리에 캐럿을 이미 두므로 복원하지 않는다.
export function resumeDocumentEditor(opts: { restoreSelection: boolean }): void {
  escapedFromDocumentEditor = false;
  const ranges = savedRanges;
  savedRanges = [];
  if (!opts.restoreSelection) {
    return;
  }
  const sel = document.getSelection();
  const alive = ranges.filter((r) => r.startContainer.isConnected && r.endContainer.isConnected);
  if (sel && alive.length > 0) {
    sel.removeAllRanges();
    alive.forEach((r) => {
      sel.addRange(r);
    });
  }
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
