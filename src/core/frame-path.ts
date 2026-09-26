// 프레임 위치 경로(D-03, RESEARCH A2 정정): Chrome에는 chrome.runtime.getFrameId가 없다
// (Firefox 전용 API였다 — 이전 가정이 틀렸다). 대신 각 프레임이 스스로 맨 위까지 거슬러
// 올라가며 "부모의 자식 창 목록에서 내가 몇 번째인지"를 구한다. parent·frames·length와
// 창 객체 자체의 동일 비교(===)는 다른 출처 프레임 사이에서도 허용된다(교차 출처 스크립트
// 접근 제한과 무관). 순수 함수 — 실제 Window 대신 이 최소 모양이면 시험할 수 있다.

export interface FrameLike {
  readonly parent: FrameLike;
  readonly frames: ArrayLike<FrameLike>;
}

export function framePathOf(win: FrameLike): number[] {
  const path: number[] = [];
  let current = win;
  while (current.parent !== current) {
    const parent = current.parent;
    let index = -1;
    for (let i = 0; i < parent.frames.length; i += 1) {
      if (parent.frames[i] === current) {
        index = i;
        break;
      }
    }
    if (index === -1) {
      // 예상 밖 상태(찾지 못함)라도 지금까지 구한 경로로 멈추고 죽지 않는다.
      break;
    }
    path.unshift(index);
    current = parent;
  }
  return path;
}
