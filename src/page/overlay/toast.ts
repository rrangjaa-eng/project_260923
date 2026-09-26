import { ensureOverlayRoot } from '@/page/overlay/mode-indicator';

// 알림(토스트, SYSTEM.md "알림(토스트)", D-25): 오른쪽 아래, 4초. mode-indicator.ts·ring.ts와
// 같은 shadow root(ensureOverlayRoot)를 이어 쓴다. 형식 변환이 실패했을 때 content.ts가 페이지를
// 열 때 한 번 부른다.

const TOAST_CLASS = 'toast';
const TOAST_DURATION_MS = 4000;

let toastElement: HTMLDivElement | null = null;
let toastTimeoutId: ReturnType<typeof setTimeout> | null = null;

function ensureToastElement(): HTMLDivElement {
  const root = ensureOverlayRoot();
  if (toastElement?.isConnected) {
    return toastElement;
  }

  const style = document.createElement('style');
  style.textContent = `
.${TOAST_CLASS} {
  position: fixed;
  right: var(--space-4);
  bottom: var(--space-4);
  max-width: 320px;
  padding: calc(var(--space-3) * var(--overlay-scale)) calc(var(--space-4) * var(--overlay-scale));
  background: var(--surface);
  color: var(--fg);
  font-family: var(--font);
  font-size: calc(var(--text-body) * var(--overlay-scale));
  line-height: var(--leading);
  letter-spacing: var(--tracking);
  word-break: keep-all;
  border: calc(var(--border-strong) * var(--overlay-scale)) solid var(--warning);
  border-radius: calc(var(--radius-card) * var(--overlay-scale));
  opacity: 0;
  visibility: hidden;
  transition: opacity var(--motion-appear);
  pointer-events: none;
}
.${TOAST_CLASS}[data-visible="true"] {
  opacity: 1;
  visibility: visible;
}
`;
  root.append(style);

  toastElement = document.createElement('div');
  toastElement.className = TOAST_CLASS;
  toastElement.dataset.visible = 'false';
  root.append(toastElement);

  return toastElement;
}

export function showToast(text: string): void {
  const el = ensureToastElement();
  el.textContent = text;
  el.dataset.visible = 'true';

  if (toastTimeoutId !== null) {
    clearTimeout(toastTimeoutId);
  }
  toastTimeoutId = setTimeout(() => {
    toastTimeoutId = null;
    if (toastElement) {
      toastElement.dataset.visible = 'false';
    }
  }, TOAST_DURATION_MS);
}
