import { describe, expect, it } from 'vitest';
import { pickTarget, type Candidate } from '../../src/core/magnet';

// D-10: 자석 잡기 판단 — 잡는 범위(captureMarginPx)·히스테리시스(switchHysteresisPx).

const CAPTURE_MARGIN_PX = 48;
const SWITCH_HYSTERESIS_PX = 24;

function pick(cursor: { x: number; y: number }, candidates: Candidate[], currentId: string | null): string | null {
  return pickTarget({
    cursor,
    candidates,
    currentId,
    captureMarginPx: CAPTURE_MARGIN_PX,
    switchHysteresisPx: SWITCH_HYSTERESIS_PX,
  });
}

describe('pickTarget', () => {
  it('커서가 요소 안이면 거리 0으로 그 요소를 잡는다', () => {
    const candidates: Candidate[] = [{ id: 'a', rect: { x: 0, y: 0, w: 100, h: 100 } }];

    expect(pick({ x: 50, y: 50 }, candidates, null)).toBe('a');
  });

  it('잡는 범위 안에서 가장 가까운 요소를 잡고, 범위 밖이면 null', () => {
    const candidates: Candidate[] = [{ id: 'a', rect: { x: 0, y: 0, w: 10, h: 10 } }];

    // 커서에서 요소까지 거리 30px (< 48px) → 잡힌다.
    expect(pick({ x: 40, y: 0 }, candidates, null)).toBe('a');
    // 커서에서 요소까지 거리 90px (> 48px) → null.
    expect(pick({ x: 100, y: 0 }, candidates, null)).toBeNull();
  });

  it('현재 잡힌 A보다 B가 24px 미만 더 가까우면 A를 유지한다', () => {
    const a: Candidate = { id: 'a', rect: { x: 0, y: 0, w: 1, h: 1 } };
    const b: Candidate = { id: 'b', rect: { x: 20, y: 0, w: 1, h: 1 } };
    // 커서 x=10: A까지 거리 10, B까지 거리 10 (차이 0, 24 미만).
    const cursor = { x: 10, y: 0 };

    expect(pick(cursor, [a, b], 'a')).toBe('a');
  });

  it('현재 잡힌 A보다 B가 24px 초과 더 가까우면 B로 바뀐다', () => {
    const a: Candidate = { id: 'a', rect: { x: 0, y: 0, w: 1, h: 1 } };
    const b: Candidate = { id: 'b', rect: { x: 40, y: 0, w: 1, h: 1 } };
    // 커서 x=39: A까지 거리 39, B까지 거리 1 (차이 38, 24 초과).
    const cursor = { x: 39, y: 0 };

    expect(pick(cursor, [a, b], 'a')).toBe('b');
  });

  it('커서가 A에서 잡는 범위 밖으로 나가면 놓는다(범위 안 다른 요소가 없으면 null)', () => {
    const a: Candidate = { id: 'a', rect: { x: 0, y: 0, w: 1, h: 1 } };
    // 커서가 A에서 100px — 잡는 범위(48px) 밖, 다른 후보 없음.
    const cursor = { x: 100, y: 0 };

    expect(pick(cursor, [a], 'a')).toBeNull();
  });

  it('커서가 A의 잡는 범위 밖으로 나가고 B가 범위 안이면 B를 잡는다', () => {
    const a: Candidate = { id: 'a', rect: { x: 0, y: 0, w: 1, h: 1 } };
    const b: Candidate = { id: 'b', rect: { x: 100, y: 0, w: 1, h: 1 } };
    // 커서가 A에서 100px(범위 밖), B에서 10px(범위 안).
    const cursor = { x: 90, y: 0 };

    expect(pick(cursor, [a, b], 'a')).toBe('b');
  });

  it('거리가 같으면 면적이 작은 요소(안쪽 요소)를 고른다', () => {
    const outer: Candidate = { id: 'outer', rect: { x: 0, y: 0, w: 100, h: 100 } };
    const inner: Candidate = { id: 'inner', rect: { x: 40, y: 40, w: 20, h: 20 } };
    // 커서가 둘 다의 안쪽(거리 0으로 동률) — 더 작은 inner를 고른다.
    const cursor = { x: 50, y: 50 };

    expect(pick(cursor, [outer, inner], null)).toBe('inner');
  });
});

describe('pickTarget — 위험한 버튼 예외(D-18, Plan 01-08)', () => {
  it('danger 후보는 커서가 그 사각형 안(거리 0)일 때만 잡힌다', () => {
    const danger: Candidate = { id: 'd', rect: { x: 0, y: 0, w: 10, h: 10 }, danger: true };

    // 커서가 사각형 안(거리 0) — 잡힌다.
    expect(pick({ x: 5, y: 5 }, [danger], null)).toBe('d');
    // 커서가 사각형 밖(거리 5, 잡는 범위 48px 안이지만 danger는 거리 0에서만 잡힌다) — null.
    expect(pick({ x: 15, y: 5 }, [danger], null)).toBeNull();
  });

  it('잡힌 위험 후보는 커서가 사각형 밖으로 나가면 히스테리시스 없이 놓인다', () => {
    const danger: Candidate = { id: 'd', rect: { x: 0, y: 0, w: 1, h: 1 }, danger: true };

    // 커서가 사각형 밖으로 5px만 나가도(히스테리시스 24px 미만) 곧바로 놓인다.
    expect(pick({ x: 5, y: 0 }, [danger], 'd')).toBeNull();
  });

  it('CR-04: 커서가 danger 사각형 안(거리 0)이면 범위 안 일반 후보가 있어도 danger를 잡는다', () => {
    const danger: Candidate = { id: 'd', rect: { x: 0, y: 0, w: 1, h: 1 }, danger: true };
    const normal: Candidate = { id: 'n', rect: { x: 40, y: 0, w: 1, h: 1 } };

    // 커서가 danger 안(거리 0)이면, normal이 범위 안(거리 39)이라도 danger를 밀어내지 않는다 —
    // §8: 위험한 버튼은 커서가 정확히 위에 있을 때 반드시 잡혀야 한다(CR-04).
    expect(pick({ x: 0, y: 0 }, [danger, normal], null)).toBe('d');
  });
});
