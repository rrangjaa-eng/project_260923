import { describe, expect, it } from 'vitest';
import { createDragTwoPress } from '../../src/core/drag-two-press';

// D-08: 끌어서 놓기 두 번 누르기 상태 기계 — 순수 함수(document·window·chrome 없음). 대기 상태에서
// 끌 수 있는 대상을 누르면 arm, 못 끄는 대상을 누르면 pass. 끌기 시작 뒤 다른 대상을 누르면
// drop(source·target)과 함께 대기로, 같은 대상을 다시 누르면 cancel. cancel()(Esc)은 대기로
// 돌아가고, 대기 중 cancel()은 아무 일도 없다.

describe('createDragTwoPress', () => {
  it('대기 상태에서 끌 수 있는 대상을 누르면 arm이다', () => {
    const drag = createDragTwoPress();
    expect(drag.press({ id: 'a', draggable: true })).toEqual({ action: 'arm' });
    expect(drag.armed()).toBe('a');
  });

  it('대기 상태에서 끌 수 없는 대상을 누르면 pass다', () => {
    const drag = createDragTwoPress();
    expect(drag.press({ id: 'a', draggable: false })).toEqual({ action: 'pass' });
    expect(drag.armed()).toBeNull();
  });

  it('끌기 시작 상태에서 다른 대상을 누르면 drop(source·target)과 함께 대기로 돌아간다', () => {
    const drag = createDragTwoPress();
    drag.press({ id: 'a', draggable: true });
    expect(drag.press({ id: 'b', draggable: false })).toEqual({ action: 'drop', sourceId: 'a', targetId: 'b' });
    expect(drag.armed()).toBeNull();
  });

  it('끌기 시작 상태에서 같은 대상을 다시 누르면 cancel이다', () => {
    const drag = createDragTwoPress();
    drag.press({ id: 'a', draggable: true });
    expect(drag.press({ id: 'a', draggable: true })).toEqual({ action: 'cancel' });
    expect(drag.armed()).toBeNull();
  });

  it('cancel()(Esc)은 대기로 돌아가고, 대기 중 cancel()은 아무 일도 없다', () => {
    const drag = createDragTwoPress();
    drag.cancel();
    expect(drag.armed()).toBeNull();

    drag.press({ id: 'a', draggable: true });
    drag.cancel();
    expect(drag.armed()).toBeNull();
    // 취소 뒤 같은 대상을 다시 누르면 새로 arm(취소로 대기가 되었다는 증거)
    expect(drag.press({ id: 'a', draggable: true })).toEqual({ action: 'arm' });
  });
});
