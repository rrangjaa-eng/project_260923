import tokensCss from '../../../docs/design/tokens.css?inline';

// 오버레이 = Shadow DOM(open) + 토큰만(D-26). 프레임마다 호스트 하나(tremor-helper-root), 사이트
// CSS를 받지도 주지도 않는다. open으로 두는 이유(DOM 감사가 계산된 스타일을 실측해야 함)는
// RESEARCH.md Pattern 5. 이후 계획(테두리·번호표·확인 화면)이 같은 shadow root를 이어 쓴다.

const HOST_TAG = 'tremor-helper-root';
const MODE_INDICATOR_CLASS = 'mode-indicator';

let hostElement: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let indicatorElement: HTMLDivElement | null = null;

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
}
`;
  shadowRoot.append(style);

  return shadowRoot;
}

export function destroyOverlayRoot(): void {
  hostElement?.remove();
  hostElement = null;
  shadowRoot = null;
  indicatorElement = null;
}

export function showModeIndicator(): void {
  const root = ensureOverlayRoot();
  if (!indicatorElement) {
    indicatorElement = document.createElement('div');
    indicatorElement.className = MODE_INDICATOR_CLASS;
    indicatorElement.textContent = '도우미';
    root.append(indicatorElement);
  }
}

export function hideModeIndicator(): void {
  // 도우미 꺼짐 = 호스트째 제거(사이트를 가리지 않음).
  destroyOverlayRoot();
}
