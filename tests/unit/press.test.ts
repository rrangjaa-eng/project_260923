// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { synthesizePress } from '../../src/page/click/press';

// D-13: 대신 누르기 이벤트 순서·좌표·초점·click 속성을 happy-dom으로 고정한다.

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
  } as DOMRect);
}

const PRESS_EVENT_TYPES = ['pointerover', 'pointerenter', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];

describe('synthesizePress', () => {
  it('이벤트가 pointerover→pointerenter→mouseover→pointerdown→mousedown→pointerup→mouseup→click 순서로 도착한다', () => {
    const el = document.createElement('div');
    document.body.append(el);
    stubRect(el, { x: 100, y: 100, width: 20, height: 20 });

    const order: string[] = [];
    for (const type of PRESS_EVENT_TYPES) {
      el.addEventListener(type, () => order.push(type));
    }

    synthesizePress(el);

    expect(order).toEqual(PRESS_EVENT_TYPES);
  });

  it('모든 마우스·포인터 이벤트의 clientX/clientY가 요소 사각형의 가운데다', () => {
    const el = document.createElement('div');
    document.body.append(el);
    stubRect(el, { x: 100, y: 200, width: 40, height: 20 });
    // center: x=120, y=210

    const seen: Array<{ type: string; x: number; y: number }> = [];
    for (const type of PRESS_EVENT_TYPES) {
      el.addEventListener(type, (e) => {
        const me = e as MouseEvent;
        seen.push({ type, x: me.clientX, y: me.clientY });
      });
    }

    synthesizePress(el);

    expect(seen).toHaveLength(PRESS_EVENT_TYPES.length);
    for (const entry of seen) {
      expect(entry.x).toBe(120);
      expect(entry.y).toBe(210);
    }
  });

  it('화면 밖으로 삐져나간 요소는 화면 안쪽으로 자른 가운데를 쓴다', () => {
    const el = document.createElement('div');
    document.body.append(el);
    // 오른쪽·위쪽 화면 밖으로 튀어나간 사각형.
    stubRect(el, { x: window.innerWidth + 100, y: -50, width: 40, height: 20 });

    let clientX = -1;
    let clientY = -1;
    el.addEventListener('click', (e) => {
      const me = e as MouseEvent;
      clientX = me.clientX;
      clientY = me.clientY;
    });

    synthesizePress(el);

    expect(clientX).toBe(window.innerWidth);
    expect(clientY).toBe(0);
  });

  it('초점을 받을 수 있는 요소는 mousedown 뒤·pointerup 앞에 초점을 받는다', () => {
    const input = document.createElement('input');
    document.body.append(input);
    stubRect(input, { x: 0, y: 0, width: 100, height: 20 });

    const order: string[] = [];
    input.addEventListener('mousedown', () => order.push('mousedown'));
    input.addEventListener('focus', () => order.push('focus'));
    input.addEventListener('pointerup', () => order.push('pointerup'));

    synthesizePress(input);

    expect(order).toEqual(['mousedown', 'focus', 'pointerup']);
    expect(document.activeElement).toBe(input);
  });

  it('페이지가 mousedown을 preventDefault()하면 초점을 옮기지 않는다', () => {
    const input = document.createElement('input');
    document.body.append(input);
    stubRect(input, { x: 0, y: 0, width: 100, height: 20 });
    input.addEventListener('mousedown', (e) => e.preventDefault());

    const focusHandler = vi.fn();
    input.addEventListener('focus', focusHandler);

    synthesizePress(input);

    expect(focusHandler).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(input);
  });

  it('click은 bubbles:true, cancelable:true, composed:true, button:0, detail:1이다', () => {
    const el = document.createElement('div');
    document.body.append(el);
    stubRect(el, { x: 0, y: 0, width: 20, height: 20 });

    let clickEvent: MouseEvent | null = null;
    el.addEventListener('click', (e) => {
      clickEvent = e as MouseEvent;
    });

    synthesizePress(el);

    expect(clickEvent).not.toBeNull();
    const evt = clickEvent as unknown as MouseEvent;
    expect(evt.bubbles).toBe(true);
    expect(evt.cancelable).toBe(true);
    expect(evt.composed).toBe(true);
    expect(evt.button).toBe(0);
    expect(evt.detail).toBe(1);
  });
});
