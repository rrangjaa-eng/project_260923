import { ensureOverlayRoot } from '@/page/overlay/mode-indicator';

// 확인 화면(D-18, D-19, D-26, SYSTEM.md "확인 화면" 템플릿): 사이트 전체를 덮는 --scrim 위에
// 600px(--dialog-width) 카드를 띄운다. 확인은 진짜 Enter·스페이스바 1초로만(포인터 클릭으로는
// 확인하지 않는다, T-01-25) — 확인 버튼에는 어떤 클릭 리스너도 달지 않는다. 취소는 Esc 또는
// 보호 시간이 지난 뒤 진짜(isTrusted) 클릭으로만. mode-indicator.ts·ring.ts·hints.ts와 같은
// shadow root(ensureOverlayRoot)를 이어 쓴다.

const GUARD_MS = 1000;

const SCRIM_CLASS = 'confirm-scrim';
const DIALOG_CLASS = 'confirm-dialog';
const TITLE_CLASS = 'confirm-dialog__title';
const BODY_CLASS = 'confirm-dialog__body';
const GUARD_TRACK_CLASS = 'confirm-dialog__guard-track';
const GUARD_BAR_CLASS = 'confirm-dialog__guard-bar';
const GUARD_TEXT_CLASS = 'confirm-dialog__guard-text';
const BUTTONS_CLASS = 'confirm-dialog__buttons';
const BUTTON_CLASS = 'confirm-dialog__button';
const KEY_CLASS = 'confirm-dialog__key';

const TITLE_TEXT = '정말 누를까요? Enter = 예';
const GUARD_TEXT_BEFORE = '1초 뒤에 누를 수 있어요';
const GUARD_TEXT_AFTER = '지금 누를 수 있어요';

export interface OpenConfirmOptions {
  name: string;
  onResult: (result: 'cancel') => void;
}

let styleInjected = false;
let scrimElement: HTMLDivElement | null = null;
let dialogElement: HTMLDivElement | null = null;
let guardBarElement: HTMLDivElement | null = null;
let guardTextElement: HTMLDivElement | null = null;
let guardTimeoutId: ReturnType<typeof setTimeout> | null = null;

function ensureStyle(root: ShadowRoot): void {
  if (styleInjected) {
    return;
  }
  const style = document.createElement('style');
  style.textContent = `
.${SCRIM_CLASS} {
  position: fixed;
  inset: 0;
  background: var(--scrim);
  pointer-events: auto;
}
.${DIALOG_CLASS} {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: var(--dialog-width);
  box-sizing: border-box;
  padding: var(--space-6);
  background: var(--bg);
  border: var(--border-strong) solid var(--danger);
  border-radius: var(--radius-dialog);
  font-family: var(--font);
  pointer-events: auto;
  opacity: 0;
  transition: opacity var(--motion-appear);
}
.${DIALOG_CLASS}[data-visible="true"] {
  opacity: 1;
}
.${TITLE_CLASS} {
  margin: 0 0 var(--space-3) 0;
  font-size: var(--text-title);
  font-weight: var(--weight-bold);
  color: var(--fg);
}
.${BODY_CLASS} {
  margin: 0 0 var(--space-5) 0;
  font-size: var(--text-body);
  color: var(--fg);
}
.${GUARD_TRACK_CLASS} {
  height: var(--space-2);
  background: var(--surface);
  border-radius: var(--radius-button);
  overflow: hidden;
}
.${GUARD_BAR_CLASS} {
  height: 100%;
  width: 0%;
  background: var(--accent);
  transition: width var(--confirm-guard) linear;
}
.${GUARD_TEXT_CLASS} {
  margin: var(--space-2) 0 var(--space-5) 0;
  font-size: var(--text-sm);
  color: var(--muted);
}
.${BUTTONS_CLASS} {
  display: flex;
  gap: var(--space-3);
}
.${BUTTON_CLASS} {
  flex: 1;
  height: var(--target-confirm);
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border-radius: var(--radius-button);
  font-family: var(--font);
  font-size: var(--text-body);
  font-weight: var(--weight-bold);
}
.${BUTTON_CLASS}--confirm {
  background: var(--danger);
  color: var(--bg);
  border: none;
}
.${BUTTON_CLASS}--cancel {
  background: var(--bg);
  color: var(--accent);
  border: var(--border-strong) solid var(--accent);
}
.${KEY_CLASS} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--space-6);
  height: var(--space-6);
  padding: 0 var(--space-2);
  border: var(--border-strong) solid currentColor;
  border-radius: var(--radius-key);
  font-weight: var(--weight-bold);
}
`;
  root.append(style);
  styleInjected = true;
}

function clearGuardTimeout(): void {
  if (guardTimeoutId !== null) {
    clearTimeout(guardTimeoutId);
    guardTimeoutId = null;
  }
}

export function openConfirm(options: OpenConfirmOptions): void {
  closeConfirm();

  const { name, onResult } = options;
  const root = ensureOverlayRoot();
  ensureStyle(root);

  scrimElement = document.createElement('div');
  scrimElement.className = SCRIM_CLASS;
  scrimElement.dataset.part = 'confirm-scrim';

  dialogElement = document.createElement('div');
  dialogElement.className = DIALOG_CLASS;
  dialogElement.dataset.part = 'confirm-dialog';
  dialogElement.dataset.visible = 'false';

  const title = document.createElement('div');
  title.className = TITLE_CLASS;
  title.dataset.part = 'confirm-title';
  title.textContent = TITLE_TEXT;

  const body = document.createElement('div');
  body.className = BODY_CLASS;
  body.dataset.part = 'confirm-body';
  body.textContent = `누를 버튼: ${name}`;

  const guardWrap = document.createElement('div');
  const guardTrack = document.createElement('div');
  guardTrack.className = GUARD_TRACK_CLASS;
  guardBarElement = document.createElement('div');
  guardBarElement.className = GUARD_BAR_CLASS;
  guardBarElement.dataset.part = 'confirm-guard-bar';
  guardTrack.append(guardBarElement);

  guardTextElement = document.createElement('div');
  guardTextElement.className = GUARD_TEXT_CLASS;
  guardTextElement.dataset.part = 'confirm-guard-text';
  guardTextElement.textContent = GUARD_TEXT_BEFORE;

  guardWrap.append(guardTrack, guardTextElement);

  const buttons = document.createElement('div');
  buttons.className = BUTTONS_CLASS;

  // T-01-25: 확인 버튼에는 클릭 리스너를 달지 않는다 — 포인터로는 절대 확인되지 않는다.
  const confirmButton = document.createElement('div');
  confirmButton.className = `${BUTTON_CLASS} ${BUTTON_CLASS}--confirm`;
  confirmButton.dataset.part = 'confirm-button-confirm';
  const confirmKey = document.createElement('span');
  confirmKey.className = KEY_CLASS;
  confirmKey.textContent = 'Enter';
  const confirmLabel = document.createElement('span');
  confirmLabel.textContent = name;
  confirmButton.append(confirmKey, confirmLabel);

  const cancelButton = document.createElement('div');
  cancelButton.className = `${BUTTON_CLASS} ${BUTTON_CLASS}--cancel`;
  cancelButton.dataset.part = 'confirm-button-cancel';
  const cancelKey = document.createElement('span');
  cancelKey.className = KEY_CLASS;
  cancelKey.textContent = 'Esc';
  const cancelLabel = document.createElement('span');
  cancelLabel.textContent = '취소';
  cancelButton.append(cancelKey, cancelLabel);

  // T-01-25: 취소는 보호 시간이 지난 뒤 isTrusted 클릭만 받는다(가정 — 안전한 방향, 확인은
  // 절대 포인터로 받지 않지만 취소는 닫기만 하므로 허용).
  let guardPassed = false;
  cancelButton.addEventListener('click', (event) => {
    if (!event.isTrusted || !guardPassed) {
      return;
    }
    onResult('cancel');
  });

  buttons.append(confirmButton, cancelButton);

  dialogElement.append(title, body, guardWrap, buttons);
  root.append(scrimElement, dialogElement);

  requestAnimationFrame(() => {
    if (!dialogElement || !guardBarElement) {
      return;
    }
    dialogElement.dataset.visible = 'true';
    guardBarElement.style.width = '100%';
  });

  clearGuardTimeout();
  guardTimeoutId = setTimeout(() => {
    guardPassed = true;
    if (guardTextElement) {
      guardTextElement.textContent = GUARD_TEXT_AFTER;
    }
  }, GUARD_MS);
}

export function closeConfirm(): void {
  clearGuardTimeout();
  scrimElement?.remove();
  scrimElement = null;
  dialogElement?.remove();
  dialogElement = null;
  guardBarElement = null;
  guardTextElement = null;
}
