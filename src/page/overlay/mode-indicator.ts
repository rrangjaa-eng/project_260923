import tokensCss from '../../../docs/design/tokens.css?inline';
import type { Rect } from '@/core/grid-index';
import { parseMessage } from '@/shared/messages';

// 오버레이 = Shadow DOM(open) + 토큰만(D-26). 프레임마다 호스트 하나(tremor-helper-root), 사이트
// CSS를 받지도 주지도 않는다. open으로 두는 이유(DOM 감사가 계산된 스타일을 실측해야 함)는
// RESEARCH.md Pattern 5. 이후 계획(테두리·번호표·확인 화면)이 같은 shadow root를 이어 쓴다.

const HOST_TAG = 'tremor-helper-root';
const MODE_INDICATOR_CLASS = 'mode-indicator';
// DOM 감사 경고 4: focus sink에 outline: none을 걸어 둔다(보이는 포커스 링이 필요 없다 — 상태는
// 모드 표시가 이미 보여 준다; 토큰 밖 색이 드러날 여지도 없앤다).
const FOCUS_SINK_CLASS = 'focus-sink';
// 모드 표시의 도우미 모드 문구("도우미")와 같은 용어 — focus sink의 접근 가능한 이름에 새 용어를
// 만들지 않고 그대로 쓴다.
const HELPER_MODE_LABEL = '도우미';

// 모드 표시 비키기(SYSTEM.md "모드 표시", D-26): 커서가 이 거리 안으로 오면 반대편으로 옮기고,
// 커서가 떠나도 그 자리에 머문다. 다음에 커서가 다가오면 다시 반대편으로 옮긴다.
const PROXIMITY_PX = 80;

export type Mode = 'helper' | 'typing';
export type Side = 'left' | 'right';

let hostElement: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let indicatorElement: HTMLDivElement | null = null;
// CR-01(iteration 4, 사용자 결정): 문서 전체 편집기에서 나올 때 초점을 이 요소로 옮긴다("초점
// 옮기기" — 선택 범위 해제만으로는 트러스트된 키 이벤트마다 Chrome이 선택을 되살려 한글 IME
// 조합을 막지 못했다, iteration 3 실측). tabindex=-1이라 Tab으로 이 요소 자체에는 닿지 않지만,
// 나옴 상태에서 Tab keydown은 삼키지 않으므로(/review 사용자 결정) 여기서 Tab을 누르면 초점이
// 다음 탭 대상으로 그대로 넘어간다. 시각 요소가 없어 그려지지 않는다(빈 div, all:initial 호스트
// 안). escapeDocumentEditor()가 실제로 나올 때만 lazily 만든다 — dom-audit 감사 시나리오는 이
// 경로를 타지 않아 기존 감사 기준에 영향이 없다.
let focusSinkElement: HTMLElement | null = null;
let mode: Mode = 'helper';
let side: Side = 'left';
let wasNearIndicator = false;
let transientTimeoutId: ReturnType<typeof setTimeout> | null = null;
// 끌어서 놓기 두 번 누르기(D-08): 끌기 시작 상태일 때 모드 표시 둘째 줄에 다음 행동을 안내한다.
let hintText: string | null = null;
// 확대 역보정(Plan 01-15, D-26, RESEARCH Pattern 5): 호스트가 살아 있는 동안만 zoom/changed를
// 구독한다 — destroyOverlayRoot()가 이 컨트롤러를 abort해 리스너를 뗀다.
let zoomAbortController: AbortController | null = null;

// 오버레이·메뉴 서체(D-26, RESEARCH Pattern 5 A4): Shadow DOM 안 @font-face는 적용되지 않으므로
// document.fonts에 직접 등록한다. 한글·라틴 유니코드 범위 파일(fontsource "korean"·"latin" 부분
// 집합, public/fonts/, wxt.config.ts web_accessible_resources)만 400·700 두 굵기로 넣는다 —
// IBM Plex Sans KR의 전체 CJK 통합 한자 묶음(수백 개 파일)은 이 도우미가 쓰는 한글·숫자·라틴
// 문구에 필요하지 않다(실행자 판단, SUMMARY 편차로 기록). popup/main.ts도 이 함수를 그대로 써
// 문서(확장 페이지) 쪽 document.fonts에 등록한다 — 실패하면 예외를 삼키고 조용히 대체 서체
// (var(--font)의 뒤 순서, 'Malgun Gothic')로 남는다.
const FONT_SPECS: ReadonlyArray<{ subset: 'korean' | 'latin'; weight: 400 | 700 }> = [
  { subset: 'korean', weight: 400 },
  { subset: 'korean', weight: 700 },
  { subset: 'latin', weight: 400 },
  { subset: 'latin', weight: 700 },
];
let fontsRegistered = false;

export async function ensureHelperFontsRegistered(): Promise<void> {
  if (fontsRegistered) {
    return;
  }
  fontsRegistered = true;
  await Promise.all(
    FONT_SPECS.map(async ({ subset, weight }) => {
      try {
        const url = chrome.runtime.getURL(`fonts/ibm-plex-sans-kr-${subset}-${String(weight)}-normal.woff2`);
        const face = new FontFace('IBM Plex Sans KR', `url(${url})`, { weight: String(weight) });
        await face.load();
        document.fonts.add(face);
      } catch {
        // 조용히 대체 서체로 남는다(action 설명) — 등록 실패는 치명적이지 않다.
      }
    }),
  );
}

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
  outline: calc(var(--halo-width) * var(--overlay-scale)) solid var(--halo);
  word-break: keep-all;
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
.${FOCUS_SINK_CLASS} {
  outline: none;
}
`;
  shadowRoot.append(style);

  hostElement.dataset.mode = mode;
  hostElement.dataset.side = side;
  // 실제 비율이 도착하기 전까지 calc()가 유효한 값을 쓰도록 기본값을 먼저 둔다.
  hostElement.style.setProperty('--overlay-scale', '1');
  subscribeToZoom();
  void ensureHelperFontsRegistered();

  return shadowRoot;
}

// mode.ts의 escapeDocumentEditor()가 나올 때 부른다(spike 실측: designMode·contenteditable 모두
// 이 요소로 초점을 옮기면 CDP IME 조합이 편집 루트·이 요소 어디에도 삽입되지 않는다, 5/5).
export function getFocusSink(): HTMLElement {
  const root = ensureOverlayRoot();
  if (!focusSinkElement) {
    focusSinkElement = document.createElement('div');
    focusSinkElement.tabIndex = -1;
    focusSinkElement.className = FOCUS_SINK_CLASS;
    // DOM 감사 경고 4: 초점을 받는 요소를 aria-hidden으로 숨기면 접근성 반패턴이다 — 대신 지금
    // 상태를 말하는 접근 가능한 이름을 준다(모드 표시와 같은 용어). role="group"(사용자 결정,
    // /review): "application"은 이 요소가 자기만의 키 처리를 스크린리더 탐색 모드 밖에서 전부
    // 가로챈다는 뜻까지 전달해 과했다 — 이 요소는 도우미가 지금 "나옴" 상태임을 나타내는 이름
    // 있는 묶음일 뿐이다.
    focusSinkElement.setAttribute('role', 'group');
    focusSinkElement.setAttribute('aria-label', HELPER_MODE_LABEL);
    root.append(focusSinkElement);
  }
  return focusSinkElement;
}

// pipeline.ts의 focusin 처리기가 이 초점 이동 자체를 "다른 요소로 나감"(복귀 신호)으로 잘못
// 해석하지 않게 구분한다.
export function isFocusSink(el: Element | null): boolean {
  return el !== null && el === focusSinkElement;
}

export function destroyOverlayRoot(): void {
  hostElement?.remove();
  hostElement = null;
  shadowRoot = null;
  indicatorElement = null;
  focusSinkElement = null;
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

// F4(/design-review 3회차, 사용자 결정, DECISIONS.md 2026-09-26): content.ts가 번호표 자리를
// 계산할 때 이 모드 표시도 다른 번호표처럼 피할 장애물로 넘긴다. 떠 있지 않으면(꺼짐, 아직
// showModeIndicator() 전) null — 호출부가 obstacles 목록에 넣지 않으면 된다.
export function getModeIndicatorRect(): Rect | null {
  if (!indicatorElement) {
    return null;
  }
  const rect = indicatorElement.getBoundingClientRect();
  return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
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
