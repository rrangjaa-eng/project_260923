import { describe, expect, it } from 'vitest';
import { createGridIndex, rectDistance, type Rect } from '../../src/core/grid-index';

// D-04: 격자 공간 색인 — 사각형이 걸치는 모든 칸에 넣고, 조회는 점 ± 반경이 걸치는 칸만 본 뒤
// 점-사각형 거리로 거른다.

interface Item {
  id: string;
  rect: Rect;
}

// 시드 고정 LCG(선형 합동 생성기) — 시험 안에서만 쓰는 결정적 의사난수.
function makeLcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

describe('createGridIndex', () => {
  it('같은 칸의 요소를 찾는다', () => {
    const grid = createGridIndex<Item>(128);
    const item: Item = { id: 'a', rect: { x: 10, y: 10, w: 20, h: 20 } };
    grid.build([item]);

    const found = grid.nearby({ x: 15, y: 15 }, 5);

    expect(found).toEqual([item]);
  });

  it('칸 경계를 넘어 반경 안에 있는 요소를 찾는다', () => {
    const grid = createGridIndex<Item>(128);
    // x=130은 128px 칸 기준으로 커서가 있는 칸(0)의 옆 칸(1)에 속한다.
    const item: Item = { id: 'b', rect: { x: 130, y: 0, w: 10, h: 10 } };
    grid.build([item]);

    const found = grid.nearby({ x: 125, y: 5 }, 10);

    expect(found).toEqual([item]);
  });

  it('반경 밖 요소는 돌려주지 않는다', () => {
    const grid = createGridIndex<Item>(128);
    const item: Item = { id: 'c', rect: { x: 500, y: 500, w: 10, h: 10 } };
    grid.build([item]);

    const found = grid.nearby({ x: 0, y: 0 }, 10);

    expect(found).toEqual([]);
  });

  it('빈 색인은 빈 배열', () => {
    const grid = createGridIndex<Item>(128);
    grid.build([]);

    expect(grid.nearby({ x: 0, y: 0 }, 1000)).toEqual([]);
  });

  it('고정 시드 무작위 5,000개 사각형에서 100개 점의 nearby 결과가 전수 검사 결과와 같다', () => {
    const rand = makeLcg(42);
    const items: Item[] = [];
    for (let i = 0; i < 5000; i += 1) {
      items.push({
        id: `item-${i.toString()}`,
        rect: {
          x: rand() * 10000,
          y: rand() * 10000,
          w: 5 + rand() * 50,
          h: 5 + rand() * 50,
        },
      });
    }

    const grid = createGridIndex<Item>(128);
    grid.build(items);

    for (let p = 0; p < 100; p += 1) {
      const point = { x: rand() * 10000, y: rand() * 10000 };
      const radius = 20 + rand() * 100;

      const gridResult = grid.nearby(point, radius).map((it) => it.id).sort();
      const bruteForce = items
        .filter((it) => rectDistance(point, it.rect) <= radius)
        .map((it) => it.id)
        .sort();

      expect(gridResult).toEqual(bruteForce);
    }
  });
});

describe('rectDistance', () => {
  it('점이 사각형 안이면 거리 0', () => {
    const rect: Rect = { x: 0, y: 0, w: 10, h: 10 };
    expect(rectDistance({ x: 5, y: 5 }, rect)).toBe(0);
  });
});
