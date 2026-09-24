import { ensureOverlayRoot } from '@/page/overlay/mode-indicator';

// 번호표 오버레이(D-11, D-26, D-27): mode-indicator.ts·ring.ts와 같은 shadow root를 이어 쓴다.
// 크기·형태는 tokens.css만 따른다 — 새 색·서체·radius 금지.

const HINTS_CLASS = 'hints';
const LABEL_CLASS = 'hint-label';
const LABEL_DANGER_TAG_CLASS = 'hint-label-danger-tag';
const NEXT_CARD_CLASS = 'hint-next-card';
const NEXT_CARD_KEY_CLASS = 'hint-next-card__key';

let styleInjected = false;
let hintsElement: HTMLDivElement | null = null;
let nextCardElement: HTMLDivElement | null = null;

function readPx(el: Element, name: string, fallback: number): number {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

function ensureStyle(root: ShadowRoot): void {
  if (styleInjected) {
    return;
  }
  const style = document.createElement('style');
  style.textContent = `
.${HINTS_CLASS} {
  position: fixed;
  inset: 0;
  pointer-events: none;
}
.${LABEL_CLASS} {
  position: fixed;
  left: 0;
  top: 0;
  width: var(--label-size);
  height: var(--label-size);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: var(--bg);
  font-family: var(--font);
  font-size: var(--text-label);
  font-weight: var(--weight-bold);
  font-variant-numeric: tabular-nums;
  border-radius: var(--radius-label);
  box-shadow: 0 0 0 var(--halo-width) var(--halo);
  transition: opacity var(--motion-appear);
}
.${LABEL_CLASS}[data-danger="true"] {
  background: var(--bg);
  color: var(--danger);
  border: var(--border-strong) dashed var(--danger);
}
.${LABEL_DANGER_TAG_CLASS} {
  position: fixed;
  left: 0;
  top: 0;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  color: var(--danger);
  font-family: var(--font);
  font-size: var(--text-label);
  font-weight: var(--weight-bold);
  text-shadow:
    calc(var(--halo-width) * -1) 0 0 var(--halo),
    var(--halo-width) 0 0 var(--halo),
    0 calc(var(--halo-width) * -1) 0 var(--halo),
    0 var(--halo-width) 0 var(--halo);
  pointer-events: none;
}
.${NEXT_CARD_CLASS} {
  position: fixed;
  right: var(--space-4);
  bottom: var(--space-4);
  min-height: var(--target-min);
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-4);
  background: var(--surface);
  color: var(--fg);
  font-family: var(--font);
  font-size: var(--text-body);
  font-weight: var(--weight-regular);
  border-radius: var(--radius-card);
  box-shadow: 0 0 0 var(--halo-width) var(--halo);
}
.${NEXT_CARD_KEY_CLASS} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--space-6);
  height: var(--space-6);
  border: var(--border-strong) solid var(--accent);
  border-radius: var(--radius-key);
  font-weight: var(--weight-bold);
  font-variant-numeric: tabular-nums;
}
`;
  root.append(style);
  styleInjected = true;
}

function ensureHintsElement(): HTMLDivElement {
  const root = ensureOverlayRoot();
  ensureStyle(root);
  if (!hintsElement?.isConnected) {
    hintsElement = document.createElement('div');
    hintsElement.className = HINTS_CLASS;
    root.append(hintsElement);
  }
  return hintsElement;
}

export function showHints(labels: Array<{ number: number; x: number; y: number; danger?: boolean }>): void {
  const container = ensureHintsElement();
  container.textContent = '';
  const labelSizePx = readPx(container, '--label-size', 28);
  const gapPx = readPx(container, '--space-2', 8);
  for (const label of labels) {
    const el = document.createElement('div');
    el.className = LABEL_CLASS;
    el.textContent = String(label.number);
    el.style.transform = `translate(${label.x.toString()}px, ${label.y.toString()}px)`;
    if (label.danger) {
      el.dataset.danger = 'true';
    }
    container.append(el);

    if (label.danger) {
      // 위험 번호표 옆 "! 위험" 글자(D-18, D-26) — 사이트 배경과 상관없이 보이도록 흰 후광(ring.ts와
      // 같은 text-shadow 네 방향 흉내).
      const tag = document.createElement('div');
      tag.className = LABEL_DANGER_TAG_CLASS;
      tag.textContent = '! 위험';
      const tagX = label.x + labelSizePx + gapPx;
      tag.style.transform = `translate(${tagX.toString()}px, ${label.y.toString()}px)`;
      container.append(tag);
    }
  }
}

export function hideHints(): void {
  hintsElement?.remove();
  hintsElement = null;
  nextCardElement?.remove();
  nextCardElement = null;
}

export function showNextCard(): void {
  const root = ensureOverlayRoot();
  ensureStyle(root);
  if (nextCardElement?.isConnected) {
    return;
  }
  nextCardElement = document.createElement('div');
  nextCardElement.className = NEXT_CARD_CLASS;

  const key = document.createElement('span');
  key.className = NEXT_CARD_KEY_CLASS;
  key.textContent = '0';

  const label = document.createElement('span');
  label.textContent = '다음 번호';

  nextCardElement.append(key, label);
  root.append(nextCardElement);
}
