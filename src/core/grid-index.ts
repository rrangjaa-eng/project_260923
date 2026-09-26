// 격자 공간 색인(D-04): 화면 안 요소를 칸으로 나눠 커서 가까운 요소를 빠르게 찾는다. DOM에 닿지
// 않는 순수 함수 — document·window·chrome 참조 없음.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

// 점과 사각형 사이 최단 거리. 점이 사각형 안이면 0.
export function rectDistance(p: Point, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

export interface GridIndex<T> {
  build(items: T[]): void;
  nearby(p: Point, radius: number): T[];
}

export function createGridIndex<T extends { rect: Rect }>(cellPx = 128): GridIndex<T> {
  let cells = new Map<string, T[]>();

  function cellKey(cx: number, cy: number): string {
    return `${cx.toString()},${cy.toString()}`;
  }

  return {
    build(items: T[]): void {
      cells = new Map();
      for (const item of items) {
        const x0 = Math.floor(item.rect.x / cellPx);
        const y0 = Math.floor(item.rect.y / cellPx);
        const x1 = Math.floor((item.rect.x + item.rect.w) / cellPx);
        const y1 = Math.floor((item.rect.y + item.rect.h) / cellPx);
        for (let cx = x0; cx <= x1; cx += 1) {
          for (let cy = y0; cy <= y1; cy += 1) {
            const key = cellKey(cx, cy);
            const existing = cells.get(key);
            if (existing) {
              existing.push(item);
            } else {
              cells.set(key, [item]);
            }
          }
        }
      }
    },

    nearby(p: Point, radius: number): T[] {
      const x0 = Math.floor((p.x - radius) / cellPx);
      const y0 = Math.floor((p.y - radius) / cellPx);
      const x1 = Math.floor((p.x + radius) / cellPx);
      const y1 = Math.floor((p.y + radius) / cellPx);

      const seen = new Set<T>();
      const result: T[] = [];
      for (let cx = x0; cx <= x1; cx += 1) {
        for (let cy = y0; cy <= y1; cy += 1) {
          const bucket = cells.get(cellKey(cx, cy));
          if (!bucket) {
            continue;
          }
          for (const item of bucket) {
            if (seen.has(item)) {
              continue;
            }
            seen.add(item);
            if (rectDistance(p, item.rect) <= radius) {
              result.push(item);
            }
          }
        }
      }
      return result;
    },
  };
}
