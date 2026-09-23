// 대신 끌어서 놓기(D-08): 하나의 DataTransfer로 source에 dragstart→drag, target에
// dragenter→dragover(사이트가 preventDefault로 받아들이면)→drop, source에 dragend를 차례로
// 보낸다. HTML 끌기 이벤트 순서 그대로이므로 사이트 자신의 dragstart(dataTransfer.setData)·
// dragover(preventDefault)·drop 처리기가 그대로 받는다. 모두 isTrusted:false로 만들어지고,
// dataTransfer에는 도우미가 아무 데이터도 넣지 않는다(T-01-31, 페이지 자신의 dragstart가 넣는다).

function centerOf(el: Element): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  return {
    x: Math.min(Math.max(cx, 0), window.innerWidth),
    y: Math.min(Math.max(cy, 0), window.innerHeight),
  };
}

// dispatchEvent가 false를 돌려주면 preventDefault()된 것(HTML DnD 규약: dragover를 취소해야
// 그 자리가 놓을 곳으로 받아들여진다).
function dispatchDrag(el: Element, type: string, dataTransfer: DataTransfer, pos: { x: number; y: number }): boolean {
  return el.dispatchEvent(
    new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: pos.x,
      clientY: pos.y,
      dataTransfer,
    }),
  );
}

export function synthesizeDrag(source: Element, target: Element): void {
  const dataTransfer = new DataTransfer();
  const sourcePos = centerOf(source);
  const targetPos = centerOf(target);

  dispatchDrag(source, 'dragstart', dataTransfer, sourcePos);
  dispatchDrag(source, 'drag', dataTransfer, sourcePos);

  dispatchDrag(target, 'dragenter', dataTransfer, targetPos);
  const dragoverNotCancelled = dispatchDrag(target, 'dragover', dataTransfer, targetPos);
  if (!dragoverNotCancelled) {
    dispatchDrag(target, 'drop', dataTransfer, targetPos);
  }

  dispatchDrag(source, 'dragend', dataTransfer, sourcePos);
}
