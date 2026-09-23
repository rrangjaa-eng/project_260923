// 대신 누르기(D-13): 잡은 요소 가운데 좌표로 마우스·포인터·포커스·클릭을 차례로 보낸다
// (pointerover→pointerenter→mouseover→pointerdown→mousedown→focus→pointerup→mouseup→click).
// 개발자 도구 프로토콜(CDP)이나 확장 디버거 API는 쓰지 않는다(설계 11장 ⑤). 모든 이벤트는
// isTrusted:false로 만들어지므로 입력 파이프라인이 되먹임으로 다시 처리기에 넘기지 않는다(D-09).
// <select>·파일 입력·새 창 처리는 이 계획 범위가 아니다(Plan 01-12 스파이크).

function centerOf(el: Element): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  return {
    x: Math.min(Math.max(cx, 0), window.innerWidth),
    y: Math.min(Math.max(cy, 0), window.innerHeight),
  };
}

function dispatchPointer(el: Element, type: string, x: number, y: number, extra: PointerEventInit = {}): void {
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      ...extra,
    }),
  );
}

// dispatchEvent가 false를 돌려주면 preventDefault()된 것 — mousedown이 취소되면 초점을 옮기지 않는다.
function dispatchMouse(el: Element, type: string, x: number, y: number, extra: MouseEventInit = {}): boolean {
  return el.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
      button: 0,
      detail: 1,
      ...extra,
    }),
  );
}

export function synthesizePress(el: Element): void {
  const { x, y } = centerOf(el);

  dispatchPointer(el, 'pointerover', x, y);
  dispatchPointer(el, 'pointerenter', x, y);
  dispatchMouse(el, 'mouseover', x, y);

  dispatchPointer(el, 'pointerdown', x, y, { buttons: 1 });
  const mousedownNotCancelled = dispatchMouse(el, 'mousedown', x, y, { buttons: 1 });

  if (mousedownNotCancelled && el instanceof HTMLElement) {
    el.focus({ preventScroll: true });
  }

  dispatchPointer(el, 'pointerup', x, y);
  dispatchMouse(el, 'mouseup', x, y);
  dispatchMouse(el, 'click', x, y);
}
