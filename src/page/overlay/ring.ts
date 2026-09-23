import type { Rect } from '@/core/grid-index';
import { ensureOverlayRoot } from '@/page/overlay/mode-indicator';

// 강조 테두리(D-26, D-27): 잡힌 요소보다 --ring-offset 바깥에 --ring-width 두께 남색 테두리와
// 바깥 흰 후광(outline), 그림자 없음. mode-indicator.ts와 같은 shadow root(ensureOverlayRoot)를
// 이어 쓴다. 잡힘이 바뀌면 --motion-ring(80ms, 움직임 줄이기면 0)으로 옮긴다. 위험한 버튼(D-18,
// D-26, Plan 01-08): 테두리는 남색 대신 --danger 색 점선, 테두리 바깥 오른쪽에 "! 위험" 글자
// (--danger 글자, 흰 후광 — 사이트 배경과 상관없이 보이도록 text-shadow 네 방향으로 흉내).

const RING_CLASS = 'ring';
const DANGER_LABEL_CLASS = 'ring-danger-label';
const DANGER_LABEL_TEXT = '! 위험';

export interface ShowRingOptions {
  danger?: boolean;
}

let ringElement: HTMLDivElement | null = null;
let dangerLabelElement: HTMLDivElement | null = null;
let ringOffsetPx = 8;
let labelGapPx = 8;

function readPx(el: Element, name: string, fallback: number): number {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

function ensureRingElement(): HTMLDivElement {
  const root = ensureOverlayRoot();
  if (ringElement?.isConnected && dangerLabelElement?.isConnected) {
    return ringElement;
  }

  const style = document.createElement('style');
  style.textContent = `
.${RING_CLASS} {
  position: fixed;
  left: 0;
  top: 0;
  box-sizing: border-box;
  border: var(--ring-width) solid var(--accent);
  border-radius: var(--radius-ring);
  outline: var(--halo-width) solid var(--halo);
  pointer-events: none;
  transition: transform var(--motion-ring), width var(--motion-ring), height var(--motion-ring);
  display: none;
}
.${RING_CLASS}[data-visible="true"] {
  display: block;
}
.${RING_CLASS}[data-danger="true"] {
  border-style: dashed;
  border-color: var(--danger);
}
.${DANGER_LABEL_CLASS} {
  position: fixed;
  left: 0;
  top: 0;
  display: none;
  align-items: center;
  white-space: nowrap;
  color: var(--danger);
  font-family: var(--font);
  font-size: var(--text-label);
  font-weight: var(--weight-bold);
  font-variant-numeric: tabular-nums;
  text-shadow:
    calc(var(--halo-width) * -1) 0 0 var(--halo),
    var(--halo-width) 0 0 var(--halo),
    0 calc(var(--halo-width) * -1) 0 var(--halo),
    0 var(--halo-width) 0 var(--halo);
  pointer-events: none;
  transition: transform var(--motion-ring);
}
.${DANGER_LABEL_CLASS}[data-visible="true"] {
  display: inline-flex;
}
`;
  root.append(style);

  ringElement = document.createElement('div');
  ringElement.className = RING_CLASS;
  ringElement.dataset.part = 'ring';
  ringElement.dataset.visible = 'false';
  ringElement.dataset.danger = 'false';
  root.append(ringElement);

  dangerLabelElement = document.createElement('div');
  dangerLabelElement.className = DANGER_LABEL_CLASS;
  dangerLabelElement.dataset.visible = 'false';
  dangerLabelElement.textContent = DANGER_LABEL_TEXT;
  root.append(dangerLabelElement);

  ringOffsetPx = readPx(ringElement, '--ring-offset', 8);
  labelGapPx = readPx(dangerLabelElement, '--space-2', 8);

  return ringElement;
}

export function showRing(rect: Rect, options?: ShowRingOptions): void {
  const el = ensureRingElement();
  const danger = options?.danger === true;

  el.style.width = `${(rect.w + ringOffsetPx * 2).toString()}px`;
  el.style.height = `${(rect.h + ringOffsetPx * 2).toString()}px`;
  el.style.transform = `translate(${(rect.x - ringOffsetPx).toString()}px, ${(rect.y - ringOffsetPx).toString()}px)`;
  el.dataset.visible = 'true';
  el.dataset.danger = danger ? 'true' : 'false';

  if (dangerLabelElement) {
    dangerLabelElement.dataset.visible = danger ? 'true' : 'false';
    if (danger) {
      const labelX = rect.x + rect.w + ringOffsetPx + labelGapPx;
      const labelY = rect.y - ringOffsetPx;
      dangerLabelElement.style.transform = `translate(${labelX.toString()}px, ${labelY.toString()}px)`;
    }
  }
}

export function hideRing(): void {
  if (ringElement?.isConnected) {
    ringElement.dataset.visible = 'false';
  }
  if (dangerLabelElement?.isConnected) {
    dangerLabelElement.dataset.visible = 'false';
  }
}
