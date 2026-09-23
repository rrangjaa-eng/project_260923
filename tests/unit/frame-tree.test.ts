import { describe, expect, it } from 'vitest';
import { composeTree, type FrameReport } from '../../src/core/frame-tree';
import type { Fingerprint } from '../../src/core/fingerprint';

// D-03(RESEARCH Pattern 2): 각 프레임이 보고한 요소·자식 iframe 오프셋·잘림(clip)을 맨 위
// 좌표로 합성한다. document·window·chrome을 참조하지 않는 순수 함수.

function fp(overrides: Partial<Fingerprint> = {}): Fingerprint {
  return { domPath: 'body>div', framePath: [], ...overrides };
}

function report(overrides: Partial<FrameReport> & { frameId: number }): FrameReport {
  return { items: [], children: [], ...overrides };
}

describe('composeTree', () => {
  it('맨 위 프레임만 있으면 요소 좌표가 그대로다', () => {
    const reports = new Map<number, FrameReport>([
      [0, report({ frameId: 0, items: [{ id: 'a', rect: { x: 10, y: 20, w: 30, h: 40 }, fingerprint: fp() }] })],
    ]);

    const result = composeTree(reports);

    expect(result).toEqual([
      { frameId: 0, itemId: 'a', rect: { x: 10, y: 20, w: 30, h: 40 }, fingerprint: fp({ framePath: [] }) },
    ]);
  });

  it('자식 프레임 요소에는 부모가 보고한 자식 iframe 오프셋이 더해진다', () => {
    const reports = new Map<number, FrameReport>([
      [
        0,
        report({
          frameId: 0,
          children: [{ childFrameId: 1, offset: { x: 100, y: 200 }, clip: { x: 100, y: 200, w: 500, h: 500 }, pathKey: 'child-1' }],
        }),
      ],
      [1, report({ frameId: 1, items: [{ id: 'b', rect: { x: 5, y: 5, w: 10, h: 10 }, fingerprint: fp() }] })],
    ]);

    const result = composeTree(reports);

    expect(result).toEqual([
      { frameId: 1, itemId: 'b', rect: { x: 105, y: 205, w: 10, h: 10 }, fingerprint: fp({ framePath: ['child-1'] }) },
    ]);
  });

  it('손자 프레임은 두 단계 오프셋이 모두 더해진다', () => {
    const reports = new Map<number, FrameReport>([
      [
        0,
        report({
          frameId: 0,
          children: [{ childFrameId: 1, offset: { x: 100, y: 100 }, clip: { x: 0, y: 0, w: 1000, h: 1000 }, pathKey: 'c1' }],
        }),
      ],
      [
        1,
        report({
          frameId: 1,
          children: [{ childFrameId: 2, offset: { x: 10, y: 10 }, clip: { x: 0, y: 0, w: 1000, h: 1000 }, pathKey: 'c2' }],
        }),
      ],
      [2, report({ frameId: 2, items: [{ id: 'g', rect: { x: 1, y: 1, w: 5, h: 5 }, fingerprint: fp() }] })],
    ]);

    const result = composeTree(reports);

    expect(result).toEqual([
      { frameId: 2, itemId: 'g', rect: { x: 111, y: 111, w: 5, h: 5 }, fingerprint: fp({ framePath: ['c1', 'c2'] }) },
    ]);
  });

  it('부모의 iframe 보이는 영역(clip) 밖 요소는 빠진다', () => {
    const reports = new Map<number, FrameReport>([
      [
        0,
        report({
          frameId: 0,
          children: [{ childFrameId: 1, offset: { x: 0, y: 0 }, clip: { x: 0, y: 0, w: 50, h: 50 }, pathKey: 'c1' }],
        }),
      ],
      [1, report({ frameId: 1, items: [{ id: 'hidden', rect: { x: 200, y: 200, w: 10, h: 10 }, fingerprint: fp() }] })],
    ]);

    const result = composeTree(reports);

    expect(result).toEqual([]);
  });

  it('일부만 보이는 요소는 보이는 부분으로 잘린 사각형이 된다', () => {
    const reports = new Map<number, FrameReport>([
      [
        0,
        report({
          frameId: 0,
          children: [{ childFrameId: 1, offset: { x: 0, y: 0 }, clip: { x: 0, y: 0, w: 50, h: 50 }, pathKey: 'c1' }],
        }),
      ],
      [1, report({ frameId: 1, items: [{ id: 'partial', rect: { x: 40, y: 40, w: 20, h: 20 }, fingerprint: fp() }] })],
    ]);

    const result = composeTree(reports);

    expect(result).toEqual([
      { frameId: 1, itemId: 'partial', rect: { x: 40, y: 40, w: 10, h: 10 }, fingerprint: fp({ framePath: ['c1'] }) },
    ]);
  });

  it('부모가 가리키는 자식 보고가 아직 없으면 그 가지는 건너뛴다(오류 없음)', () => {
    const reports = new Map<number, FrameReport>([
      [
        0,
        report({
          frameId: 0,
          items: [{ id: 'top', rect: { x: 0, y: 0, w: 10, h: 10 }, fingerprint: fp() }],
          children: [{ childFrameId: 1, offset: { x: 0, y: 0 }, clip: { x: 0, y: 0, w: 50, h: 50 }, pathKey: 'c1' }],
        }),
      ],
    ]);

    expect(() => composeTree(reports)).not.toThrow();
    const result = composeTree(reports);
    expect(result).toEqual([{ frameId: 0, itemId: 'top', rect: { x: 0, y: 0, w: 10, h: 10 }, fingerprint: fp({ framePath: [] }) }]);
  });

  it('각 요소의 framePath가 맨 위부터의 iframe 경로 키 사슬이다(맨 위 요소는 [])', () => {
    const reports = new Map<number, FrameReport>([
      [
        0,
        report({
          frameId: 0,
          items: [{ id: 'top', rect: { x: 0, y: 0, w: 10, h: 10 }, fingerprint: fp() }],
          children: [{ childFrameId: 1, offset: { x: 0, y: 0 }, clip: { x: 0, y: 0, w: 1000, h: 1000 }, pathKey: 'same-origin-frame' }],
        }),
      ],
      [1, report({ frameId: 1, items: [{ id: 'child', rect: { x: 1, y: 1, w: 1, h: 1 }, fingerprint: fp() }] })],
    ]);

    const result = composeTree(reports);

    expect(result.find((r) => r.itemId === 'top')?.fingerprint.framePath).toEqual([]);
    expect(result.find((r) => r.itemId === 'child')?.fingerprint.framePath).toEqual(['same-origin-frame']);
  });

  it('보고가 서로를 가리키는 고리가 있어도 끝난다', () => {
    const reports = new Map<number, FrameReport>([
      [
        0,
        report({
          frameId: 0,
          children: [{ childFrameId: 1, offset: { x: 0, y: 0 }, clip: { x: 0, y: 0, w: 1000, h: 1000 }, pathKey: 'c1' }],
        }),
      ],
      [
        1,
        report({
          frameId: 1,
          items: [{ id: 'looped', rect: { x: 1, y: 1, w: 1, h: 1 }, fingerprint: fp() }],
          children: [{ childFrameId: 0, offset: { x: 0, y: 0 }, clip: { x: 0, y: 0, w: 1000, h: 1000 }, pathKey: 'back-to-top' }],
        }),
      ],
    ]);

    expect(() => composeTree(reports)).not.toThrow();
    const result = composeTree(reports);
    expect(result.map((r) => r.itemId)).toEqual(['looped']);
  });
});
