import type { Rect } from '@/core/grid-index';
import { ensureOverlayRoot, getOverlayScale } from '@/page/overlay/mode-indicator';

// 번호표 오버레이(D-11, D-26, D-27): mode-indicator.ts·ring.ts와 같은 shadow root를 이어 쓴다.
// 크기·형태는 tokens.css만 따른다 — 새 색·서체·radius 금지.

const HINTS_CLASS = 'hints';
const LABEL_CLASS = 'hint-label';
const LABEL_DANGER_TAG_CLASS = 'hint-label-danger-tag';
const NEXT_CARD_CLASS = 'hint-next-card';
const NEXT_CARD_KEY_CLASS = 'hint-next-card__key';

// CR-06: 모듈 전역 boolean이면 destroyOverlayRoot()가 shadow root를 통째로 새로 만들어도
// true로 남아 새 root에는 <style>이 다시 들어가지 않는다(번호표가 스타일 없는 div가 되어
// 28px 정사각형이 무너진다) — root별로 기억한다.
const styledRoots = new WeakSet<ShadowRoot>();
let hintsElement: HTMLDivElement | null = null;
let nextCardElement: HTMLDivElement | null = null;

function readPx(el: Element, name: string, fallback: number): number {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

function ensureStyle(root: ShadowRoot): void {
  if (styledRoots.has(root)) {
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
  width: calc(var(--label-size) * var(--overlay-scale));
  height: calc(var(--label-size) * var(--overlay-scale));
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: var(--bg);
  font-family: var(--font);
  font-size: calc(var(--text-label) * var(--overlay-scale));
  font-weight: var(--weight-bold);
  font-variant-numeric: tabular-nums;
  border-radius: calc(var(--radius-label) * var(--overlay-scale));
  outline: calc(var(--halo-width) * var(--overlay-scale)) solid var(--halo);
  transition: opacity var(--motion-appear);
}
.${LABEL_CLASS}[data-danger="true"] {
  background: var(--bg);
  color: var(--danger);
  border: calc(var(--border-strong) * var(--overlay-scale)) dashed var(--danger);
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
  font-size: calc(var(--text-label) * var(--overlay-scale));
  font-weight: var(--weight-bold);
  word-break: keep-all;
  text-shadow:
    calc(var(--halo-width) * var(--overlay-scale) * -1) 0 0 var(--halo),
    calc(var(--halo-width) * var(--overlay-scale)) 0 0 var(--halo),
    0 calc(var(--halo-width) * var(--overlay-scale) * -1) 0 var(--halo),
    0 calc(var(--halo-width) * var(--overlay-scale)) 0 var(--halo);
  pointer-events: none;
}
.${NEXT_CARD_CLASS} {
  position: fixed;
  right: var(--space-4);
  bottom: var(--space-4);
  min-height: calc(var(--target-min) * var(--overlay-scale));
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: calc(var(--space-2) * var(--overlay-scale));
  padding: 0 calc(var(--space-4) * var(--overlay-scale));
  background: var(--surface);
  color: var(--fg);
  font-family: var(--font);
  font-size: calc(var(--text-body) * var(--overlay-scale));
  font-weight: var(--weight-regular);
  border-radius: calc(var(--radius-card) * var(--overlay-scale));
  outline: calc(var(--halo-width) * var(--overlay-scale)) solid var(--halo);
  word-break: keep-all;
}
.${NEXT_CARD_KEY_CLASS} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: calc(var(--space-6) * var(--overlay-scale));
  height: calc(var(--space-6) * var(--overlay-scale));
  border: calc(var(--border-strong) * var(--overlay-scale)) solid var(--accent);
  border-radius: calc(var(--radius-key) * var(--overlay-scale));
  font-weight: var(--weight-bold);
  font-variant-numeric: tabular-nums;
}
`;
  root.append(style);
  styledRoots.add(root);
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

export function showHints(
  labels: Array<{ number: number; x: number; y: number; danger?: boolean; dangerTagX?: number; dangerTagY?: number }>,
): void {
  const container = ensureHintsElement();
  container.textContent = '';
  const scale = getOverlayScale();
  const labelSizePx = readPx(container, '--label-size', 28) * scale;
  const gapPx = readPx(container, '--space-2', 8) * scale;
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
      // 같은 text-shadow 네 방향 흉내). ISSUE-003(/qa 사용자 결정): 자리는 hint-order.ts의
      // placeLabels가 다른 번호표를 피해 이미 정해 준다(dangerTagX·dangerTagY) — 없으면(직접
      // showHints를 부르는 기존 호출부 호환) 예전처럼 이 번호표 오른쪽에 그린다.
      const tag = document.createElement('div');
      tag.className = LABEL_DANGER_TAG_CLASS;
      tag.textContent = '! 위험';
      const tagX = label.dangerTagX ?? label.x + labelSizePx + gapPx;
      const tagY = label.dangerTagY ?? label.y;
      tag.style.transform = `translate(${tagX.toString()}px, ${tagY.toString()}px)`;
      container.append(tag);
    }
  }
}

// ISSUE-002·003(/qa 사용자 결정): placeLabels(순수 함수)는 폰트·DOM을 모른다 — "! 위험" 표시의
// 실제 렌더 폭·간격을 이 함수가 재서(같은 클래스의 숨긴 사본으로 측정) content.ts에 값으로
// 건네준다. 위험 항목이 없는 장(chapter)에서는 부를 필요가 없다(호출부가 판단).
export function measureDangerTag(): { width: number; gap: number } {
  const root = ensureOverlayRoot();
  ensureStyle(root);
  const scale = getOverlayScale();
  const probe = document.createElement('div');
  probe.className = LABEL_DANGER_TAG_CLASS;
  probe.textContent = '! 위험';
  probe.style.visibility = 'hidden';
  probe.style.transform = 'translate(-9999px, -9999px)';
  root.append(probe);
  const width = probe.getBoundingClientRect().width;
  const gap = readPx(probe, '--space-2', 8) * scale;
  probe.remove();
  return { width, gap };
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

// F4(/design-review 3회차, 사용자 결정, DECISIONS.md 2026-09-26): "다음 번호" 카드가 떠 있으면
// content.ts가 번호표 자리를 계산할 때 이 카드도 다른 번호표처럼 피할 장애물로 넘긴다. 떠 있지
// 않으면 null.
export function getNextCardRect(): Rect | null {
  if (!nextCardElement?.isConnected) {
    return null;
  }
  const rect = nextCardElement.getBoundingClientRect();
  return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
}

// F4: 이 장(chapter)에는 "다음" 카드가 필요 없어졌으면(예: 마지막 장) content.ts가 자리 계산
// 전에 미리 지운다 — hideHints()처럼 번호표까지 함께 지우지 않는, 카드만 지우는 좁은 버전이다.
export function hideNextCard(): void {
  nextCardElement?.remove();
  nextCardElement = null;
}
