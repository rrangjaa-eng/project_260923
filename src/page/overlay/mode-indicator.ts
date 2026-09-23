import tokensCss from '../../../docs/design/tokens.css?inline';

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
  align-items: center;
  padding: var(--space-2) var(--space-3);
  background: var(--accent);
  color: var(--bg);
  font-family: var(--font);
  font-size: var(--text-label);
  font-weight: var(--weight-bold);
  line-height: var(--leading);
  letter-spacing: var(--tracking);
  border-radius: var(--radius-button);
  box-shadow: 0 0 0 var(--halo-width) var(--halo);
  pointer-events: none;
  transition: left var(--motion-appear);
}
:host([data-side="right"]) .${MODE_INDICATOR_CLASS} {
  left: calc(100vw - 100% - var(--space-4));
}
:host([data-mode="typing"]) .${MODE_INDICATOR_CLASS} {
  background: var(--bg);
  color: var(--accent);
  border: var(--border-strong) solid var(--accent);
}
.${MODE_INDICATOR_CLASS}__hint {
  font-weight: var(--weight-regular);
}
`;
  shadowRoot.append(style);

  hostElement.dataset.mode = mode;
  hostElement.dataset.side = side;

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
}

function renderIndicatorContent(): void {
  if (!indicatorElement) {
    return;
  }
  indicatorElement.textContent = '';
  if (mode === 'helper') {
    indicatorElement.textContent = '도우미';
    return;
  }
  const label = document.createElement('span');
  label.className = `${MODE_INDICATOR_CLASS}__label`;
  label.textContent = '입력 중';
  const hint = document.createElement('span');
  hint.className = `${MODE_INDICATOR_CLASS}__hint`;
  hint.textContent = ' · Esc로 도우미';
  indicatorElement.append(label, hint);
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
