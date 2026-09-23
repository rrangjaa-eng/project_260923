// 대신 누르기(RED 단계 스텁) — 실제 이벤트 순서·좌표·초점은 GREEN 커밋에서 구현한다.
export function synthesizePress(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}
