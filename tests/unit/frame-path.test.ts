import { describe, expect, it } from 'vitest';
import { framePathOf, type FrameLike } from '../../src/core/frame-path';

// D-03, RESEARCH A2 정정: Chrome에는 chrome.runtime.getFrameId가 없다(Firefox 전용이었다).
// 대신 각 프레임이 스스로 맨 위까지 거슬러 올라가며 "부모의 자식 창 목록에서 내가 몇 번째인지"를
// 구한다. 순수 함수 — document·window·chrome을 참조하지 않고 최소 모양(FrameLike)으로 시험한다.

// 순환 부모·자식 창 목록을 손으로 잇는다(실제 Window의 parent·frames 관계를 흉내).
function makeTop(): FrameLike {
  const top: { parent: FrameLike; frames: FrameLike[] } = { parent: undefined as unknown as FrameLike, frames: [] };
  top.parent = top;
  return top;
}

function addChild(parent: FrameLike & { frames: FrameLike[] }): FrameLike & { frames: FrameLike[] } {
  const child: { parent: FrameLike; frames: FrameLike[] } = { parent, frames: [] };
  parent.frames.push(child);
  return child;
}

describe('framePathOf', () => {
  it('맨 위 프레임의 경로는 []이다', () => {
    const top = makeTop();
    expect(framePathOf(top)).toEqual([]);
  });

  it('한 단계 자식의 경로는 부모의 자식 목록에서 자기 순번 하나다', () => {
    const top = makeTop() as FrameLike & { frames: FrameLike[] };
    addChild(top); // index 0 (다른 형제)
    addChild(top); // index 1 (다른 형제)
    const target = addChild(top); // index 2

    expect(framePathOf(target)).toEqual([2]);
  });

  it('두 단계 손자의 경로는 두 순번이 모두 있다', () => {
    const top = makeTop() as FrameLike & { frames: FrameLike[] };
    addChild(top);
    addChild(top);
    const mid = addChild(top); // index 2
    const leaf = addChild(mid); // mid의 index 0

    expect(framePathOf(leaf)).toEqual([2, 0]);
  });

  it('부모의 자식 목록에서 자기를 찾지 못해도(예상 밖 상태) 죽지 않고 지금까지의 경로로 멈춘다', () => {
    const top = makeTop() as FrameLike & { frames: FrameLike[] };
    const mid = addChild(top); // index 0
    const leaf: FrameLike = { parent: mid, frames: [] };
    // leaf를 mid.frames에 등록하지 않는다 — "찾지 못함" 상태를 흉내낸다.

    expect(() => framePathOf(leaf)).not.toThrow();
    expect(framePathOf(leaf)).toEqual([]);
  });
});
