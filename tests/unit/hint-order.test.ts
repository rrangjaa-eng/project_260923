import { describe, expect, it } from 'vitest';
import { isSameElement, matchScore, type Fingerprint } from '../../src/core/fingerprint';
import { orderHints, placeLabels, type HintItem, type Pin, type PressCount } from '../../src/core/hint-order';

// D-11(설계 6.8): 요소 식별 일치 점수·번호 순서(고정→자주→근처)·번호표 자리 배치를 순수 함수로
// 고정한다. fingerprint.ts·hint-order.ts는 document·window·chrome을 참조하지 않는다.

function fp(overrides: Partial<Fingerprint> = {}): Fingerprint {
  return { domPath: 'body>div', framePath: [], ...overrides };
}

describe('matchScore·isSameElement', () => {
  it('framePath가 다르면 점수 0', () => {
    const a = fp({ id: 'x', framePath: [] });
    const b = fp({ id: 'x', framePath: ['0'] });

    expect(matchScore(a, b)).toBe(0);
    expect(isSameElement(a, b)).toBe(false);
  });

  it('id·name·labelText·buttonText·aria·domPath 중 같은 값의 개수가 점수이고, 2 이상이면 같은 요소로 본다', () => {
    const a = fp({ id: 'x', name: 'n', domPath: 'body>div' });
    const b = fp({ id: 'x', name: 'n', domPath: 'body>span' });
    expect(matchScore(a, b)).toBe(2);
    expect(isSameElement(a, b)).toBe(true);

    const c = fp({ id: 'x', domPath: 'body>span' });
    expect(matchScore(a, c)).toBe(1);
    expect(isSameElement(a, c)).toBe(false);
  });

  it('값이 없는 표시(undefined)는 일치로 세지 않는다', () => {
    const a = fp({ domPath: 'body>div' });
    const b = fp({ domPath: 'body>div' });

    expect(matchScore(a, b)).toBe(1);
    expect(isSameElement(a, b)).toBe(false);
  });
});

describe('orderHints', () => {
  it('고정 번호가 있으면 그 요소는 그 번호 자리에 온다', () => {
    const items: HintItem[] = [
      { id: 'a', rect: { x: 0, y: 0, w: 10, h: 10 }, fingerprint: fp({ id: 'a-fp' }) },
      { id: 'b', rect: { x: 100, y: 0, w: 10, h: 10 }, fingerprint: fp({ id: 'b-fp' }) },
    ];
    const pins: Pin[] = [{ number: 3, fingerprint: fp({ id: 'b-fp' }) }];

    const chapters = orderHints({ items, pins, presses: [], cursor: { x: 0, y: 0 } });

    const three = chapters[0]?.find((entry) => entry.number === 3);
    expect(three?.itemId).toBe('b');
  });

  it('고정되지 않은 자리는 누른 횟수가 많은 순, 같은 횟수는 커서에 가까운 순이다', () => {
    const items: HintItem[] = [
      { id: 'far', rect: { x: 500, y: 0, w: 10, h: 10 }, fingerprint: fp({ id: 'far' }) },
      { id: 'near', rect: { x: 10, y: 0, w: 10, h: 10 }, fingerprint: fp({ id: 'near' }) },
      { id: 'popular', rect: { x: 900, y: 0, w: 10, h: 10 }, fingerprint: fp({ id: 'popular' }) },
    ];
    const presses: PressCount[] = [{ fingerprint: fp({ id: 'popular' }), count: 5 }];

    const chapters = orderHints({ items, pins: [], presses, cursor: { x: 0, y: 0 } });
    const order = chapters[0]?.map((entry) => entry.itemId);

    expect(order).toEqual(['popular', 'near', 'far']);
  });

  it('한 장에는 1~9만 담고 10번째부터는 다음 장이다', () => {
    const items: HintItem[] = Array.from({ length: 11 }, (_, i) => ({
      id: `item-${i.toString()}`,
      rect: { x: i * 10, y: 0, w: 5, h: 5 },
      fingerprint: fp({ id: `item-${i.toString()}` }),
    }));

    const chapters = orderHints({ items, pins: [], presses: [], cursor: { x: 0, y: 0 } });

    expect(chapters.length).toBe(2);
    expect(chapters[0]?.length).toBe(9);
    expect(chapters[1]?.length).toBe(2);
  });

  it('고정 번호의 요소가 지금 화면에 없으면 빈 채로 두지 않고 다음 순위가 채운다', () => {
    const items: HintItem[] = [{ id: 'only', rect: { x: 0, y: 0, w: 10, h: 10 }, fingerprint: fp({ id: 'only' }) }];
    const pins: Pin[] = [{ number: 3, fingerprint: fp({ id: 'missing' }) }];

    const chapters = orderHints({ items, pins, presses: [], cursor: { x: 0, y: 0 } });
    const entry = chapters[0]?.find((e) => e.itemId === 'only');

    expect(entry?.number).toBe(1);
  });
});

describe('placeLabels', () => {
  it('번호표 기본 자리는 요소 왼쪽 위 모서리 바깥(-14px, -14px)이다', () => {
    const placements = placeLabels([{ itemId: 'a', rect: { x: 100, y: 200, w: 40, h: 40 } }]);

    expect(placements).toEqual([{ itemId: 'a', x: 86, y: 186 }]);
  });

  it('번호표끼리 겹치면 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래 → 요소 안쪽 왼쪽 위 순으로 옮긴다', () => {
    const rect = { x: 100, y: 100, w: 40, h: 40 };
    const entries = [1, 2, 3, 4, 5].map((n) => ({ itemId: `item-${n.toString()}`, rect }));

    const placements = placeLabels(entries);

    expect(placements).toEqual([
      { itemId: 'item-1', x: 86, y: 86 },
      { itemId: 'item-2', x: 126, y: 86 },
      { itemId: 'item-3', x: 86, y: 126 },
      { itemId: 'item-4', x: 126, y: 126 },
      { itemId: 'item-5', x: 100, y: 100 },
    ]);
  });
});
