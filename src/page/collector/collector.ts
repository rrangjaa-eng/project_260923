import { isDanger } from '@/core/danger';
import type { Fingerprint } from '@/core/fingerprint';
import type { RawFrameReport } from '@/core/frame-tree';
import { framePathOf, type FrameLike } from '@/core/frame-path';
import type { Rect } from '@/core/grid-index';

// 요소 수집기(D-04, ELEM-01, ELEM-03): 프레임 안에서 누를 수 있는 요소를 모아 위치·이름·종류
// 목록으로 만든다. 화면 변화(MutationObserver)·스크롤·크기 변경은 requestAnimationFrame 하나로
// 모아 한 번에 다시 모은다. 페이지 리스너(addEventListener)는 content script에서 보이지 않으므로
// "클릭 이벤트가 걸린 이미지"는 onclick 속성·role·tabindex·계산된 cursor: pointer로 판정한다(가정
// 문단 참고). danger(D-18, Plan 01-08): 이름에 settings.dangerWords가 들어 있으면 true —
// 목록이 바뀌면 refresh()로 다시 계산한다.

export interface Item {
  id: string;
  rect: Rect;
  name: string;
  kind: string;
  fingerprint: Fingerprint;
  danger: boolean;
}

export interface Collector {
  items(): Item[];
  get(id: string): Element | undefined;
  onChange(cb: () => void): void;
  // T-01-21: 형제 프레임의 iframe 구성이 바뀌었다는 frame/refresh를 받으면 바로 다시 모아
  // selfPath를 새로 계산해 보고한다(스케줄 대기 없이 즉시).
  refresh(): void;
}

// 태그·속성만으로 항상 후보인 요소. cursor: pointer가 필요한 것은 아래 CURSOR_TAGS.
const NAMED_SELECTOR = [
  'button',
  'a[href]',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="option"]',
  '[role="switch"]',
  '[onclick]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

// 계산된 cursor: pointer일 때만 후보에 넣는 태그(위 NAMED_SELECTOR에 걸리지 않는 경우).
const CURSOR_TAGS = new Set(['img', 'svg', 'div', 'span']);

const SELECTOR = `${NAMED_SELECTOR}, img, svg, div, span`;

function isCandidateTag(el: Element): boolean {
  if (el.matches(NAMED_SELECTOR)) {
    return true;
  }
  if (CURSOR_TAGS.has(el.tagName.toLowerCase())) {
    return getComputedStyle(el).cursor === 'pointer';
  }
  return false;
}

function isDisabled(el: Element): boolean {
  if (
    el instanceof HTMLButtonElement ||
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  ) {
    return el.disabled;
  }
  return el.getAttribute('aria-disabled') === 'true';
}

function isHiddenAncestor(el: Element): boolean {
  let node: Element | null = el;
  while (node) {
    if (node instanceof HTMLElement) {
      if (node.hidden || node.inert) {
        return true;
      }
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return true;
      }
    }
    node = node.parentElement;
  }
  return false;
}

function isInViewport(rect: DOMRect): boolean {
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
}

function normalizeText(text: string | null | undefined): string {
  return (text ?? '').trim().replace(/\s+/g, ' ');
}

function computeName(el: Element): string {
  const ariaLabel = normalizeText(el.getAttribute('aria-label'));
  if (ariaLabel) {
    return ariaLabel;
  }

  if ('labels' in el) {
    const labels = (el as HTMLInputElement).labels;
    if (labels && labels.length > 0) {
      const labelText = normalizeText(labels[0]?.textContent);
      if (labelText) {
        return labelText;
      }
    }
  }

  const text = normalizeText(el.textContent);
  if (text) {
    return text;
  }

  if (el instanceof HTMLInputElement && el.type === 'submit') {
    const value = normalizeText(el.value);
    if (value) {
      return value;
    }
  }

  const alt = normalizeText(el.getAttribute('alt'));
  if (alt) {
    return alt;
  }

  return normalizeText(el.getAttribute('title'));
}

// 요소 식별 묶음(D-11, 설계 6.8): id·name·라벨 글자·버튼 글자·aria·문서 안 위치 경로를 함께
// 기억한다. framePath는 이 계획에서는 항상 []([] — 프레임 경로는 Plan 01-07이 채운다).

function textOrUndefined(text: string | null | undefined): string | undefined {
  const trimmed = normalizeText(text);
  return trimmed || undefined;
}

function ariaOf(el: Element): string | undefined {
  const ariaLabel = textOrUndefined(el.getAttribute('aria-label'));
  if (ariaLabel) {
    return ariaLabel;
  }
  const labelledBy = el.getAttribute('aria-labelledby');
  if (!labelledBy) {
    return undefined;
  }
  const text = labelledBy
    .split(/\s+/)
    .map((id) => normalizeText(document.getElementById(id)?.textContent))
    .filter((part) => part.length > 0)
    .join(' ');
  return textOrUndefined(text);
}

function labelTextOf(el: Element): string | undefined {
  if (!('labels' in el)) {
    return undefined;
  }
  const labels = (el as HTMLInputElement).labels;
  if (!labels || labels.length === 0) {
    return undefined;
  }
  return textOrUndefined(labels[0]?.textContent);
}

function buttonTextOf(el: Element): string | undefined {
  const tag = el.tagName.toLowerCase();
  if (tag === 'button' || el.getAttribute('role') === 'button') {
    return textOrUndefined(el.textContent);
  }
  if (el instanceof HTMLInputElement && (el.type === 'submit' || el.type === 'button' || el.type === 'reset')) {
    return textOrUndefined(el.value);
  }
  return undefined;
}

const DOM_PATH_MAX_DEPTH = 12;

function domPathOf(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  let depth = 0;
  while (node && depth < DOM_PATH_MAX_DEPTH) {
    const current: Element = node;
    const tag: string = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;
    let index = 1;
    if (parent) {
      const siblings: Element[] = Array.from(parent.children).filter(
        (child: Element) => child.tagName === current.tagName,
      );
      index = siblings.indexOf(current) + 1;
    }
    parts.unshift(`${tag}:nth-of-type(${index.toString()})`);
    node = parent;
    depth += 1;
  }
  return parts.join('>');
}

function computeFingerprint(el: Element): Fingerprint {
  return {
    id: textOrUndefined(el.id),
    name: textOrUndefined(el.getAttribute('name')),
    labelText: labelTextOf(el),
    buttonText: buttonTextOf(el),
    aria: ariaOf(el),
    domPath: domPathOf(el),
    framePath: [],
  };
}

function kindOf(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'textarea' || tag === 'summary') {
    return tag;
  }
  const role = el.getAttribute('role');
  if (role) {
    return role;
  }
  if (el.hasAttribute('onclick')) {
    return 'onclick';
  }
  if (el.hasAttribute('tabindex')) {
    return 'tabindex';
  }
  return 'pointer-cursor';
}

// 프레임 보고(D-03, RESEARCH Pattern 2): 자기 문서의 각 <iframe>에 chrome.runtime.getFrameId로
// 자식 frameId를 얻고, content box(테두리·padding 뺌) 위치를 offset, 그 content box와 자기
// 문서에서 실제로 보이는 영역(뷰포트 + overflow로 잘라내는 조상)의 교차를 clip으로 보고한다.

function intersectRects(a: Rect, b: Rect): Rect | undefined {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  if (x1 <= x0 || y1 <= y0) {
    return undefined;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function contentBoxOf(el: HTMLIFrameElement): Rect {
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
  const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
  const borderRight = Number.parseFloat(style.borderRightWidth) || 0;
  const borderBottom = Number.parseFloat(style.borderBottomWidth) || 0;
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
  const paddingTop = Number.parseFloat(style.paddingTop) || 0;
  const paddingRight = Number.parseFloat(style.paddingRight) || 0;
  const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
  return {
    x: rect.x + borderLeft + paddingLeft,
    y: rect.y + borderTop + paddingTop,
    w: rect.width - borderLeft - paddingLeft - borderRight - paddingRight,
    h: rect.height - borderTop - paddingTop - borderBottom - paddingBottom,
  };
}

// getBoundingClientRect는 조상의 overflow:hidden/auto/scroll로 실제 화면에서 잘린 부분을
// 반영하지 않는다 — 부모 스크롤 영역 안 iframe이 반쯤 가려도 그대로 온전한 사각형을 돌려준다.
// 조상을 거슬러 올라가며 overflow가 visible이 아닌 조상의 사각형과 계속 교차해 실제 보이는
// 영역을 구한다.
function visibleAncestorClip(el: Element): Rect {
  let clip: Rect = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  let node: Element | null = el.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
      const rect = node.getBoundingClientRect();
      const next = intersectRects(clip, { x: rect.x, y: rect.y, w: rect.width, h: rect.height });
      clip = next ?? { x: 0, y: 0, w: 0, h: 0 };
    }
    node = node.parentElement;
  }
  return clip;
}

// pathKey 우선순위(id → name → src의 origin+pathname → 형제 순번) 중 하나만 고른다. 이 값은
// 요소 식별 묶음(Fingerprint.framePath)에만 쓰는 표시용 이름이다 — 아래 selfPath(숫자 경로,
// D-03 라우팅용)와는 다른 목적.
function pathKeyOf(el: HTMLIFrameElement): string {
  if (el.id) {
    return `id:${el.id}`;
  }
  if (el.name) {
    return `name:${el.name}`;
  }
  if (el.src) {
    try {
      const url = new URL(el.src, document.baseURI);
      return `src:${url.origin}${url.pathname}`;
    } catch {
      // src가 있어도 파싱할 수 없으면 형제 순번으로 넘어간다.
    }
  }
  const siblings = Array.from(el.parentElement?.children ?? []).filter((child) => child.tagName === 'IFRAME');
  return `idx:${siblings.indexOf(el).toString()}`;
}

function asFrameLike(win: Window): FrameLike {
  return win;
}

// RESEARCH A2 정정: chrome.runtime.getFrameId는 Chrome에 없다(Firefox 전용 API였다).
// 대신 iframe의 contentWindow가 이 창의 window.frames에서 몇 번째인지(상대 순번)만 안다 —
// 실제 frameId는 SW가 각 프레임 스스로 보고한 selfPath로 나중에 맞춘다(resolveReports).
function frameIndexOf(iframeEl: HTMLIFrameElement): number {
  const target = iframeEl.contentWindow;
  if (!target) {
    return -1;
  }
  const frames = asFrameLike(window).frames;
  const targetLike = asFrameLike(target);
  for (let i = 0; i < frames.length; i += 1) {
    if (frames[i] === targetLike) {
      return i;
    }
  }
  return -1;
}

export function buildFrameReport(items: Item[]): RawFrameReport {
  const wireItems = items.map((item) => ({ id: item.id, rect: item.rect, fingerprint: item.fingerprint, danger: item.danger }));

  // D-03: 창 접근(parent·frames·contentWindow)이 예상 밖으로 실패해도(교차 출처 제약 등) 이
  // 함수 하나가 content script main() 전체를 죽이면 안 된다(자석·번호표 등 이 프레임의 다른
  // 기능까지 함께 멎는다) — 프레임 보고 부분만 통째로 건너뛴다.
  try {
    const selfPath = framePathOf(asFrameLike(window));
    const children: RawFrameReport['children'] = [];
    for (const iframeEl of document.querySelectorAll('iframe')) {
      try {
        const index = frameIndexOf(iframeEl);
        if (index === -1) {
          // 아직 자식 프레임의 창이 없다(sandbox·로딩 전 등) — 건너뛴다.
          continue;
        }
        const contentBox = contentBoxOf(iframeEl);
        const clip = intersectRects(contentBox, visibleAncestorClip(iframeEl));
        if (!clip) {
          // 부모 안에서 완전히 가려져 있으면 이 가지 자체를 보고하지 않는다.
          continue;
        }
        children.push({ index, offset: { x: contentBox.x, y: contentBox.y }, clip, pathKey: pathKeyOf(iframeEl) });
      } catch {
        // 이 iframe 하나만 건너뛴다 — 다른 iframe·이 프레임 자신의 요소 보고는 계속한다.
      }
    }
    return { frameId: 0, selfPath, items: wireItems, children };
  } catch {
    // 창 위치 경로 계산 자체가 실패해도 최소한 이 프레임 자신의 요소는 보고한다(자식 없이).
    return { frameId: 0, selfPath: [], items: wireItems, children: [] };
  }
}

export function createCollector(opts: { signal: AbortSignal; getDangerWords: () => readonly string[] }): Collector {
  const { signal, getDangerWords } = opts;

  const idMap = new WeakMap<Element, string>();
  let nextId = 0;
  let currentItems: Item[] = [];
  let elementById = new Map<string, Element>();
  const changeHandlers: Array<() => void> = [];
  let scheduled = false;
  let lastReportedJson = '';

  // 프레임 보고(D-03, T-01-21): 목록이 바뀔 때만 SW에 보낸다 — 매 rAF tick마다 똑같은 보고를
  // 다시 보내지 않는다(보고 폭주 방지).
  function reportFrame(): void {
    const report = buildFrameReport(currentItems);
    const json = JSON.stringify(report);
    if (json === lastReportedJson) {
      return;
    }
    lastReportedJson = json;
    void chrome.runtime.sendMessage({ type: 'frame/report', report });
  }

  function idFor(el: Element): string {
    const existing = idMap.get(el);
    if (existing) {
      return existing;
    }
    const id = `el-${(nextId++).toString()}`;
    idMap.set(el, id);
    return id;
  }

  function collect(): void {
    const next: Item[] = [];
    const nextById = new Map<string, Element>();
    for (const el of document.querySelectorAll(SELECTOR)) {
      if (isDisabled(el)) {
        continue;
      }
      if (!isCandidateTag(el)) {
        continue;
      }
      if (isHiddenAncestor(el)) {
        continue;
      }
      const rect = el.getBoundingClientRect();
      if (!isInViewport(rect)) {
        continue;
      }
      const id = idFor(el);
      nextById.set(id, el);
      const name = computeName(el);
      next.push({
        id,
        rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
        name,
        kind: kindOf(el),
        fingerprint: computeFingerprint(el),
        danger: isDanger(name, getDangerWords()),
      });
    }
    currentItems = next;
    elementById = nextById;
    reportFrame();
    for (const handler of changeHandlers) {
      handler();
    }
  }

  function schedule(): void {
    if (scheduled) {
      return;
    }
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      collect();
    });
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true });
  signal.addEventListener('abort', () => {
    observer.disconnect();
  });

  window.addEventListener('scroll', schedule, { capture: true, passive: true, signal });
  window.addEventListener('resize', schedule, { signal });

  collect();

  return {
    items(): Item[] {
      return currentItems;
    },
    get(id: string): Element | undefined {
      return elementById.get(id);
    },
    onChange(cb: () => void): void {
      changeHandlers.push(cb);
    },
    refresh(): void {
      collect();
    },
  };
}
