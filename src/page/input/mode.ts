// 입력칸 판정과 현재 모드(D-16). document를 읽는 page-context 모듈.

import { getFocusSink, isFocusSink } from '@/page/overlay/mode-indicator';

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

// CR-01(01-REVIEW-FIX.md iteration 4, 사용자 결정): "초점 옮기기" 방식 — iteration 3의 "커서
// 숨기기"(선택 범위만 지우고 초점은 그대로 둠)는 실측상 트러스트된 키 이벤트마다 Chrome이 지운
// 선택을 스스로 되살려, CDP IME 조합이 편집 루트에 실제로 삽입되는 것을 막지 못했다(iteration 3
// REVIEW-FIX.md 실측). 대신 나올 때 선택을 저장·해제하고 초점 자체를 도우미 오버레이의 비편집
// tabindex=-1 요소(mode-indicator.ts getFocusSink)로 옮긴다 — spike 실측(designMode·
// contenteditable 모두, closed/open shadow·plain div 모두): 이 요소로 초점을 옮기면 CDP 조합·확정
// 시도가 편집 루트·이 요소 어디에도 삽입되지 않는다(5/5).
let savedRanges: Range[] = [];
let escapedRoot: HTMLElement | null = null;

export function escapeDocumentEditor(root: Element | null): void {
  escapedFromDocumentEditor = true;
  escapedRoot = root instanceof HTMLElement ? root : null;
  const sel = document.getSelection();
  savedRanges = [];
  if (sel) {
    for (let i = 0; i < sel.rangeCount; i += 1) {
      savedRanges.push(sel.getRangeAt(i).cloneRange()); // Range는 이후 DOM 변화를 따라간다
    }
    sel.removeAllRanges();
  }
  getFocusSink().focus();
}

// restoreSelection: Esc를 다시 눌러 돌아올 때만 true(편집 루트에 초점을 되돌리고 저장한 범위를
// 복원한다 — 아무도 다른 수단으로 초점을 되돌리지 않으므로 여기서 직접 해야 한다). 편집기를 눌러
// 돌아올 때·다른 요소로 focusin일 때는 false — 브라우저가 이미(또는 곧) 초점을 옮기므로 복원하지
// 않는다.
export function resumeDocumentEditor(opts: { restoreSelection: boolean }): void {
  escapedFromDocumentEditor = false;
  const root = escapedRoot;
  escapedRoot = null;
  const ranges = savedRanges;
  savedRanges = [];
  if (!opts.restoreSelection) {
    return;
  }
  root?.focus();
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
  // 초점이 우리 오버레이의 focusSink 자신이면 언제나 도우미다 — designMode 문서에서는
  // HTMLElement.isContentEditable이 문서 전체에 적용돼(contentEditable과 달리 부분 트리가
  // 아니라 document.designMode 하나로 결정된다) 이 shadow DOM 안 평범한 div도 true를 돌려준다
  // (실측으로 확인: 이 검사 없이는 designMode 문서에서 나온 상태가 즉시 "입력 중"으로 잘못
  // 보고된다). isTypingTarget보다 먼저 검사해야 한다.
  if (isFocusSink(active)) {
    return 'helper';
  }
  if (escapedFromDocumentEditor && isDocumentEditingRoot(active)) {
    return 'helper';
  }
  return isTypingTarget(active) ? 'typing' : 'helper';
}
