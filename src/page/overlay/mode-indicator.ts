import tokensCss from '../../../docs/design/tokens.css?inline';
import { parseMessage } from '@/shared/messages';

// 오버레이 = Shadow DOM(open) + 토큰만(D-26). 프레임마다 호스트 하나(tremor-helper-root), 사이트
// CSS를 받지도 주지도 않는다. open으로 두는 이유(DOM 감사가 계산된 스타일을 실측해야 함)는
// RESEARCH.md Pattern 5. 이후 계획(테두리·번호표·확인 화면)이 같은 shadow root를 이어 쓴다.

const HOST_TAG = 'tremor-helper-root';
const MODE_INDICATOR_CLASS = 'mode-indicator';

// 모드 표시 비키기(SYSTEM.md "모드 표시", D-26): 커서가 이 거리 안으로 오면 반대편으로 옮기고,
// 커서가 떠나도 그 자리에 머문다. 다음에 커서가 다가오면 다시 반대편으로 옮긴다.
const PROXIMITY_PX = 80;

export type Mode = 'helper' | 'typing';
export type Side = 'left' | 'right';

let hostElement: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let indicatorElement: HTMLDivElement | null = null;
let mode: Mode = 'helper';
let side: Side = 'left';
let wasNearIndicator = false;
let transientTimeoutId: ReturnType<typeof setTimeout> | null = null;
// 끌어서 놓기 두 번 누르기(D-08): 끌기 시작 상태일 때 모드 표시 둘째 줄에 다음 행동을 안내한다.
let hintText: string | null = null;
// 확대 역보정(Plan 01-15, D-26, RESEARCH Pattern 5): 호스트가 살아 있는 동안만 zoom/changed를
// 구독한다 — destroyOverlayRoot()가 이 컨트롤러를 abort해 리스너를 뗀다.
let zoomAbortController: AbortController | null = null;

// fix(01-15 known gap, 01-16): --overlay-scale이 바뀔 때마다 위치(테두리 오프셋·번호표 자리)를
// 다시 계산해야 하는 content.ts가 구독한다. mode-indicator.ts는 여기서 크기 변수만 두고, "어디에
// 다시 그릴지"는 모른다 — 그 판단은 그대로 content.ts(자석·번호표 상태를 쥔 쪽)에 둔다.
type OverlayScaleListener = () => void;
const overlayScaleListeners = new Set<OverlayScaleListener>();

export function onOverlayScaleChange(listener: OverlayScaleListener): void {
  overlayScaleListeners.add(listener);
}

// 오버레이 부품(ring.ts·hints.ts 등)이 위치 계산에 쓸 현재 배율. hostElement의 인라인 스타일
// 값(리터럴, var()·calc() 없음)이라 getPropertyValue가 그대로 돌려준다.
export function getOverlayScale(): number {
  if (!hostElement) {
    return 1;
  }
  const raw = hostElement.style.getPropertyValue('--overlay-scale').trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function applyOverlayScale(zoom: number): void {
  if (!hostElement) {
    return;
  }
  hostElement.style.setProperty('--overlay-scale', (1 / zoom).toString());
  for (const listener of overlayScaleListeners) {
    listener();
  }
}

function subscribeToZoom(): void {
  zoomAbortController = new AbortController();
  const handleMessage = (raw: unknown): undefined => {
    const parsed = parseMessage(raw);
    if (parsed.success && parsed.data.type === 'zoom/changed') {
      applyOverlayScale(parsed.data.zoom);
    }
    return undefined;
  };
  chrome.runtime.onMessage.addListener(handleMessage);
  zoomAbortController.signal.addEventListener('abort', () => {
    chrome.runtime.onMessage.removeListener(handleMessage);
  });
  void chrome.runtime.sendMessage({ type: 'zoom/query' }).then((raw) => {
    const response = raw as { zoom?: number } | undefined;
    if (typeof response?.zoom === 'number') {
      applyOverlayScale(response.zoom);
    }
  });
}

export function ensureOverlayRoot(): ShadowRoot {
  if (shadowRoot) {
    return shadowRoot;
  }

  hostElement = document.createElement(HOST_TAG);
  hostElement.style.cssText = 'all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;';
  document.documentElement.append(hostElement);

  shadowRoot = hostElement.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
${tokensCss}
.${MODE_INDICATOR_CLASS} {
  position: fixed;
  left: var(--space-4);
  bottom: var(--space-4);
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  padding: calc(var(--space-2) * var(--overlay-scale)) calc(var(--space-3) * var(--overlay-scale));
  background: var(--accent);
  color: var(--bg);
  font-family: var(--font);
  font-size: calc(var(--text-label) * var(--overlay-scale));
  font-weight: var(--weight-bold);
  line-height: var(--leading);
  letter-spacing: var(--tracking);
  border-radius: calc(var(--radius-button) * var(--overlay-scale));
  box-shadow: 0 0 0 calc(var(--halo-width) * var(--overlay-scale)) var(--halo);
  pointer-events: none;
  transition: left var(--motion-appear);
}
.${MODE_INDICATOR_CLASS}__row {
  display: inline-flex;
  align-items: center;
}
.${MODE_INDICATOR_CLASS}__drag-hint {
  font-size: calc(var(--text-label) * var(--overlay-scale));
  font-weight: var(--weight-regular);
}
:host([data-side="right"]) .${MODE_INDICATOR_CLASS} {
  left: calc(100vw - 100% - var(--space-4));
}
:host([data-mode="typing"]) .${MODE_INDICATOR_CLASS} {
  background: var(--bg);
  color: var(--accent);
  border: calc(var(--border-strong) * var(--overlay-scale)) solid var(--accent);
}
.${MODE_INDICATOR_CLASS}__hint {
  font-weight: var(--weight-regular);
}
`;
  shadowRoot.append(style);

  hostElement.dataset.mode = mode;
  hostElement.dataset.side = side;
  // 실제 비율이 도착하기 전까지 calc()가 유효한 값을 쓰도록 기본값을 먼저 둔다.
  hostElement.style.setProperty('--overlay-scale', '1');
  subscribeToZoom();

  return shadowRoot;
}

export function destroyOverlayRoot(): void {
  hostElement?.remove();
  hostElement = null;
  shadowRoot = null;
  indicatorElement = null;
  mode = 'helper';
  side = 'left';
  wasNearIndicator = false;
  hintText = null;
  if (transientTimeoutId !== null) {
    clearTimeout(transientTimeoutId);
    transientTimeoutId = null;
  }
  zoomAbortController?.abort();
  zoomAbortController = null;
}

function renderIndicatorContent(): void {
  if (!indicatorElement) {
    return;
  }
  indicatorElement.textContent = '';

  const row = document.createElement('div');
  row.className = `${MODE_INDICATOR_CLASS}__row`;
  if (mode === 'helper') {
    row.textContent = '도우미';
  } else {
    const label = document.createElement('span');
    label.className = `${MODE_INDICATOR_CLASS}__label`;
    label.textContent = '입력 중';
    const hint = document.createElement('span');
    hint.className = `${MODE_INDICATOR_CLASS}__hint`;
    hint.textContent = ' · Esc로 도우미';
    row.append(label, hint);
  }
  indicatorElement.append(row);

  if (hintText !== null) {
    const dragHint = document.createElement('div');
    dragHint.className = `${MODE_INDICATOR_CLASS}__drag-hint`;
    dragHint.textContent = hintText;
    indicatorElement.append(dragHint);
  }
}

export function showModeIndicator(): void {
  const root = ensureOverlayRoot();
  if (!indicatorElement) {
    indicatorElement = document.createElement('div');
    indicatorElement.className = MODE_INDICATOR_CLASS;
    root.append(indicatorElement);
  }
  renderIndicatorContent();
}

export function hideModeIndicator(): void {
  // 도우미 꺼짐 = 호스트째 제거(사이트를 가리지 않음).
  destroyOverlayRoot();
}

export function setMode(next: Mode): void {
  mode = next;
  if (!hostElement) {
    return;
  }
  hostElement.dataset.mode = mode;
  renderIndicatorContent();
}

// 끌어서 놓기 두 번 누르기(D-08): 끌기 시작 상태에서 다음 행동 안내("놓을 곳을 누르세요 ·
// Esc 취소")를 모드 표시 둘째 줄로 보여 준다. null이면 지운다(대기로 돌아감).
export function setHint(text: string | null): void {
  hintText = text;
  renderIndicatorContent();
}

// 상태 표(D-27): 모드 표시에 잠깐 다른 글자를 보여 준 뒤 ms 뒤에 원래 모드 글자로 되돌린다.
// (번호표 "누를 곳이 없어요" 2초 등). 도우미가 켜져 있어야(showModeIndicator 호출됨) 뜬다.
export function showTransientMessage(text: string, ms: number): void {
  if (!hostElement || !indicatorElement) {
    return;
  }
  if (transientTimeoutId !== null) {
    clearTimeout(transientTimeoutId);
  }
  indicatorElement.textContent = text;
  transientTimeoutId = setTimeout(() => {
    transientTimeoutId = null;
    renderIndicatorContent();
  }, ms);
}

// 맨 위 프레임의 pointermove(pipeline.ts, D-04)가 부른다.
export function updateIndicatorProximity(x: number, y: number): void {
  if (!hostElement || !indicatorElement) {
    return;
  }
  const rect = indicatorElement.getBoundingClientRect();
  const dx = Math.max(rect.left - x, 0, x - rect.right);
  const dy = Math.max(rect.top - y, 0, y - rect.bottom);
  const near = Math.hypot(dx, dy) < PROXIMITY_PX;
  if (near && !wasNearIndicator) {
    side = side === 'left' ? 'right' : 'left';
    hostElement.dataset.side = side;
  }
  wasNearIndicator = near;
}
