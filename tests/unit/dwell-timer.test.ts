import { describe, expect, it } from 'vitest';
import { createDwellTimer } from '../../src/core/dwell-timer';

// D-12: 머무르기 클릭 상태 기계 — 잡힌 대상 위에 dwellMs만큼 머물면 한 번만 fire하고, 떠나면
// 취소, 위험한 대상은 늘 진행 0이다. 순수 함수(document·window·chrome 없음) — 시각은 인자.

describe('createDwellTimer', () => {
  it('새 대상이 잡히면 진행 0에서 시작하고, (t - 시작) / dwellMs로 오른다', () => {
    const timer = createDwellTimer({ dwellMs: 800 });
    expect(timer.update({ targetId: 'a', danger: false, t: 0 })).toEqual({ progress: 0, fire: false });
    expect(timer.update({ targetId: 'a', danger: false, t: 400 })).toEqual({ progress: 0.5, fire: false });
  });

  it('진행이 1에 닿는 첫 update에서만 fire: true다', () => {
    const timer = createDwellTimer({ dwellMs: 800 });
    timer.update({ targetId: 'a', danger: false, t: 0 });
    expect(timer.update({ targetId: 'a', danger: false, t: 800 })).toEqual({ progress: 1, fire: true });
  });

  it('발사한 대상에 계속 머물러도 다시 fire하지 않는다', () => {
    const timer = createDwellTimer({ dwellMs: 800 });
    timer.update({ targetId: 'a', danger: false, t: 0 });
    timer.update({ targetId: 'a', danger: false, t: 800 });
    expect(timer.update({ targetId: 'a', danger: false, t: 1600 })).toEqual({ progress: 1, fire: false });
    expect(timer.update({ targetId: 'a', danger: false, t: 5000 })).toEqual({ progress: 1, fire: false });
  });

  it('대상이 null이 되었다가(떠남) 같은 대상으로 돌아오면 처음부터 다시 진행해 한 번 더 발사할 수 있다', () => {
    const timer = createDwellTimer({ dwellMs: 800 });
    timer.update({ targetId: 'a', danger: false, t: 0 });
    timer.update({ targetId: 'a', danger: false, t: 800 }); // 첫 발사
    timer.update({ targetId: null, danger: false, t: 900 }); // 떠남
    expect(timer.update({ targetId: 'a', danger: false, t: 1000 })).toEqual({ progress: 0, fire: false });
    expect(timer.update({ targetId: 'a', danger: false, t: 1800 })).toEqual({ progress: 1, fire: true });
  });

  it('1에 닿기 전에 대상이 null이나 다른 대상으로 바뀌면 진행이 0으로 돌아간다(취소)', () => {
    const timer = createDwellTimer({ dwellMs: 800 });
    timer.update({ targetId: 'a', danger: false, t: 0 });
    timer.update({ targetId: 'a', danger: false, t: 400 });
    expect(timer.update({ targetId: null, danger: false, t: 500 })).toEqual({ progress: 0, fire: false });

    timer.update({ targetId: 'b', danger: false, t: 600 });
    timer.update({ targetId: 'b', danger: false, t: 900 });
    expect(timer.update({ targetId: 'c', danger: false, t: 1000 })).toEqual({ progress: 0, fire: false });
  });

  it('danger: true 대상은 진행이 늘 0이고 발사하지 않는다', () => {
    const timer = createDwellTimer({ dwellMs: 800 });
    expect(timer.update({ targetId: 'a', danger: true, t: 0 })).toEqual({ progress: 0, fire: false });
    expect(timer.update({ targetId: 'a', danger: true, t: 800 })).toEqual({ progress: 0, fire: false });
    expect(timer.update({ targetId: 'a', danger: true, t: 5000 })).toEqual({ progress: 0, fire: false });
  });

  it('dwellMs를 바꾼 새 타이머는 새 시간으로 발사한다', () => {
    const timer = createDwellTimer({ dwellMs: 400 });
    timer.update({ targetId: 'a', danger: false, t: 0 });
    expect(timer.update({ targetId: 'a', danger: false, t: 400 })).toEqual({ progress: 1, fire: true });
  });
});
