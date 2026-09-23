import type { Rect } from '@/core/grid-index';

// 요소 수집기(D-04, ELEM-01, ELEM-03): 프레임 안에서 누를 수 있는 요소를 모아 위치·이름·종류
// 목록으로 만든다. 화면 변화(MutationObserver)·스크롤·크기 변경은 requestAnimationFrame 하나로
// 모아 한 번에 다시 모은다. 페이지 리스너(addEventListener)는 content script에서 보이지 않으므로
// "클릭 이벤트가 걸린 이미지"는 onclick 속성·role·tabindex·계산된 cursor: pointer로 판정한다(가정
// 문단 참고).

export interface Item {
  id: string;
  rect: Rect;
  name: string;
  kind: string;
}

export interface Collector {
  items(): Item[];
  get(id: string): Element | undefined;
  onChange(cb: () => void): void;
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

export function createCollector(opts: { signal: AbortSignal }): Collector {
  const { signal } = opts;

  const idMap = new WeakMap<Element, string>();
  let nextId = 0;
  let currentItems: Item[] = [];
  let elementById = new Map<string, Element>();
  const changeHandlers: Array<() => void> = [];
  let scheduled = false;

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
      next.push({
        id,
        rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
        name: computeName(el),
        kind: kindOf(el),
      });
    }
    currentItems = next;
    elementById = nextById;
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
  };
}
