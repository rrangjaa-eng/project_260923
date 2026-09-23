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
const DWELL_PROGRESS_CLASS = 'dwell-progress';
const SVG_NS = 'http://www.w3.org/2000/svg';

export interface ShowRingOptions {
  danger?: boolean;
}

let ringElement: HTMLDivElement | null = null;
let dangerLabelElement: HTMLDivElement | null = null;
let dwellProgressElement: SVGSVGElement | null = null;
let dwellProgressRectElement: SVGRectElement | null = null;
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
.${DWELL_PROGRESS_CLASS} {
  position: fixed;
  left: 0;
  top: 0;
  pointer-events: none;
  display: none;
}
.${DWELL_PROGRESS_CLASS}[data-visible="true"] {
  display: block;
}
.${DWELL_PROGRESS_CLASS} rect {
  fill: none;
  stroke: var(--accent);
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

  // 머무르기 진행 표시(D-12, D-26, Plan 01-10): 강조 테두리와 같은 박스 위에 겹쳐 그리는 SVG
  // 사각형 — stroke-dasharray/stroke-dashoffset을 매 update의 값으로 직접 그려(CSS transition
  // 없음) 움직임 줄이기에서도 남는다(SYSTEM.md "모션" — 시간 정보).
  dwellProgressElement = document.createElementNS(SVG_NS, 'svg');
  dwellProgressElement.classList.add(DWELL_PROGRESS_CLASS);
  dwellProgressElement.dataset.visible = 'false';
  dwellProgressRectElement = document.createElementNS(SVG_NS, 'rect');
  dwellProgressElement.append(dwellProgressRectElement);
  root.append(dwellProgressElement);

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
  setDwellProgress(null);
}

// 머무르기 진행 표시(D-12): p는 0~1, null이면 감춘다. 강조 테두리(ringElement)와 같은 박스
// 크기·위치를 그대로 따라간다 — showRing이 먼저 그 박스를 그려 둔 뒤에만 뜻이 있다.
export function setDwellProgress(p: number | null): void {
  if (!dwellProgressElement || !dwellProgressRectElement) {
    return;
  }
  if (p === null || !ringElement?.isConnected || ringElement.dataset.visible !== 'true') {
    dwellProgressElement.dataset.visible = 'false';
    return;
  }

  const w = Number.parseFloat(ringElement.style.width) || 0;
  const h = Number.parseFloat(ringElement.style.height) || 0;
  const strokeWidth = readPx(dwellProgressElement, '--border-strong', 3);
  const radius = readPx(dwellProgressElement, '--radius-ring', 8);
  const inset = strokeWidth / 2;
  const boxW = Math.max(0, w - strokeWidth);
  const boxH = Math.max(0, h - strokeWidth);
  const perimeter = 2 * (boxW + boxH);

  dwellProgressElement.style.width = `${w.toString()}px`;
  dwellProgressElement.style.height = `${h.toString()}px`;
  dwellProgressElement.style.transform = ringElement.style.transform;
  dwellProgressRectElement.setAttribute('x', inset.toString());
  dwellProgressRectElement.setAttribute('y', inset.toString());
  dwellProgressRectElement.setAttribute('width', boxW.toString());
  dwellProgressRectElement.setAttribute('height', boxH.toString());
  dwellProgressRectElement.setAttribute('rx', radius.toString());
  dwellProgressRectElement.setAttribute('stroke-width', strokeWidth.toString());
  dwellProgressRectElement.style.strokeDasharray = perimeter.toString();
  dwellProgressRectElement.style.strokeDashoffset = (perimeter * (1 - p)).toString();

  dwellProgressElement.dataset.visible = 'true';
  dwellProgressElement.setAttribute('data-progress', p.toString());
}
