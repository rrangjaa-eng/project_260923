// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { createCollector } from '../../src/page/collector/collector';

// F3(/design-review 3회차, 사용자 결정): 크기·위치(rect)가 같은 조상·자식 항목(예: <a> 안
// cursor:pointer를 상속한 <img>)은 하나로 합친다 — 조상을 남긴다(누르면 같은 동작이라 번호표
// 두 개가 무의미하다). press.test.ts와 같은 방식으로 happy-dom엔 실제 레이아웃 엔진이 없어
// getBoundingClientRect를 직접 지정한다.

// collector.ts는 변화가 있을 때마다 chrome.runtime.sendMessage로 프레임 보고를 보낸다(D-03) —
// 이 시험은 합치기 로직만 보므로 응답을 아무것도 안 하는 최소 흉내만 둔다(happy-dom엔 chrome이
// 없다, e2e만 실제 확장 안에서 돈다).
(globalThis as unknown as { chrome: { runtime: { sendMessage: (message: unknown) => Promise<unknown> } } }).chrome = {
  runtime: {
    sendMessage: () => Promise.resolve(undefined),
  },
};

function stubRect(el: Element, rect: { x: number; y: number; width: number; height: number }): void {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.y,
    left: rect.x,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
    toJSON() {
      return this;
    },
  });
}

describe('createCollector', () => {
  it('F3: <a> 안 cursor:pointer를 상속한 <img>가 조상과 크기·위치가 같으면 하나(조상)로 합친다', () => {
    document.body.innerHTML = '';
    const a = document.createElement('a');
    a.href = '#';
    a.style.cursor = 'pointer';
    const img = document.createElement('img');
    img.alt = '아이콘';
    // 실제 브라우저는 cursor가 상속되지만(a에 명시), happy-dom의 상속 계산에 기대지 않고
    // 여기서도 같은 값을 명시해 이 시험이 검증하려는 것(합치기 로직)만 결정적으로 만든다.
    img.style.cursor = 'pointer';
    a.append(img);
    document.body.append(a);

    stubRect(a, { x: 10, y: 10, width: 40, height: 40 });
    stubRect(img, { x: 10, y: 10, width: 40, height: 40 });

    const controller = new AbortController();
    const collector = createCollector({ signal: controller.signal, getDangerWords: () => [] });

    const items = collector.items();
    expect(items.length, '조상(a)·자식(img)이 하나로 합쳐져야 한다').toBe(1);
    expect(collector.get(items[0]?.id ?? '')).toBe(a);
  });

  it('조상·자식이라도 크기·위치가 다르면 합치지 않는다(둘 다 남는다)', () => {
    document.body.innerHTML = '';
    const a = document.createElement('a');
    a.href = '#';
    const btn = document.createElement('button');
    btn.textContent = '안쪽 버튼';
    a.append(btn);
    document.body.append(a);

    stubRect(a, { x: 0, y: 0, width: 200, height: 60 });
    stubRect(btn, { x: 10, y: 10, width: 40, height: 20 });

    const controller = new AbortController();
    const collector = createCollector({ signal: controller.signal, getDangerWords: () => [] });

    expect(collector.items().length).toBe(2);
  });
});
