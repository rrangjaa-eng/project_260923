import type { Rect } from '@/core/grid-index';
import { ensureOverlayRoot } from '@/page/overlay/mode-indicator';

// 강조 테두리(D-26, D-27): 잡힌 요소보다 --ring-offset 바깥에 --ring-width 두께 남색 테두리와
// 바깥 흰 후광(outline), 그림자 없음. mode-indicator.ts와 같은 shadow root(ensureOverlayRoot)를
// 이어 쓴다. 잡힘이 바뀌면 --motion-ring(80ms, 움직임 줄이기면 0)으로 옮긴다.

const RING_CLASS = 'ring';

let ringElement: HTMLDivElement | null = null;
let ringOffsetPx = 8;

function readPx(el: Element, name: string, fallback: number): number {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

function ensureRingElement(): HTMLDivElement {
  const root = ensureOverlayRoot();
  if (ringElement?.isConnected) {
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
`;
  root.append(style);

  ringElement = document.createElement('div');
  ringElement.className = RING_CLASS;
  ringElement.dataset.part = 'ring';
  ringElement.dataset.visible = 'false';
  root.append(ringElement);

  ringOffsetPx = readPx(ringElement, '--ring-offset', 8);

  return ringElement;
}

export function showRing(rect: Rect): void {
  const el = ensureRingElement();
  el.style.width = `${(rect.w + ringOffsetPx * 2).toString()}px`;
  el.style.height = `${(rect.h + ringOffsetPx * 2).toString()}px`;
  el.style.transform = `translate(${(rect.x - ringOffsetPx).toString()}px, ${(rect.y - ringOffsetPx).toString()}px)`;
  el.dataset.visible = 'true';
}

export function hideRing(): void {
  if (!ringElement?.isConnected) {
    return;
  }
  ringElement.dataset.visible = 'false';
}
