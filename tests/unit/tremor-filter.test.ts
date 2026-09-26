import { describe, expect, it } from 'vitest';
import { createTremorFilter } from '../../src/core/tremor-filter';

// 떨림 필터 판단 규칙(D-07, D-30) — 시각은 인자로 넣는 숫자, 실제 타이머 없음.

describe('createTremorFilter', () => {
  it('repeat: true인 키 입력은 거절한다', () => {
    const filter = createTremorFilter({ intervalMs: 300, sameSpotPx: 16 });

    expect(filter.accept({ kind: 'key', code: 'KeyA', repeat: true, t: 0 })).toBe(false);
  });

  it('같은 code가 마지막으로 받아들인 시각에서 intervalMs 미만 뒤에 오면 거절하고, 정확히 intervalMs 뒤면 받아들인다', () => {
    const filter = createTremorFilter({ intervalMs: 300, sameSpotPx: 16 });

    expect(filter.accept({ kind: 'key', code: 'KeyA', repeat: false, t: 0 })).toBe(true);
    expect(filter.accept({ kind: 'key', code: 'KeyA', repeat: false, t: 299 })).toBe(false);
    expect(filter.accept({ kind: 'key', code: 'KeyA', repeat: false, t: 300 })).toBe(true);
  });

  it('다른 code는 서로 영향을 주지 않는다', () => {
    const filter = createTremorFilter({ intervalMs: 300, sameSpotPx: 16 });

    expect(filter.accept({ kind: 'key', code: 'KeyA', repeat: false, t: 0 })).toBe(true);
    expect(filter.accept({ kind: 'key', code: 'KeyB', repeat: false, t: 50 })).toBe(true);
  });

  it('누름이 마지막으로 받아들인 누름에서 intervalMs 미만 + 거리 sameSpotPx 이하이면 거절하고, 거리를 넘으면 받아들인다', () => {
    const filter = createTremorFilter({ intervalMs: 300, sameSpotPx: 16 });

    expect(filter.accept({ kind: 'press', x: 0, y: 0, t: 0 })).toBe(true);
    expect(filter.accept({ kind: 'press', x: 5, y: 0, t: 100 })).toBe(false);
    expect(filter.accept({ kind: 'press', x: 100, y: 0, t: 150 })).toBe(true);
  });

  it('거절된 입력은 마지막 받아들인 시각을 바꾸지 않는다', () => {
    const filter = createTremorFilter({ intervalMs: 300, sameSpotPx: 16 });

    expect(filter.accept({ kind: 'key', code: 'KeyA', repeat: false, t: 0 })).toBe(true);
    expect(filter.accept({ kind: 'key', code: 'KeyA', repeat: false, t: 200 })).toBe(false);
    expect(filter.accept({ kind: 'key', code: 'KeyA', repeat: false, t: 400 })).toBe(true);
  });

  it('shouldSuppressDblclick()은 바로 앞 누름이 거절됐을 때만 true다', () => {
    const filter = createTremorFilter({ intervalMs: 300, sameSpotPx: 16 });

    expect(filter.accept({ kind: 'press', x: 0, y: 0, t: 0 })).toBe(true);
    expect(filter.shouldSuppressDblclick()).toBe(false);

    expect(filter.accept({ kind: 'press', x: 0, y: 0, t: 100 })).toBe(false);
    expect(filter.shouldSuppressDblclick()).toBe(true);

    expect(filter.accept({ kind: 'press', x: 0, y: 0, t: 500 })).toBe(true);
    expect(filter.shouldSuppressDblclick()).toBe(false);
  });

  it('intervalMs·sameSpotPx를 바꾼 새 필터는 새 값으로 판단한다', () => {
    const filter = createTremorFilter({ intervalMs: 100, sameSpotPx: 5 });

    expect(filter.accept({ kind: 'key', code: 'KeyA', repeat: false, t: 0 })).toBe(true);
    expect(filter.accept({ kind: 'key', code: 'KeyA', repeat: false, t: 100 })).toBe(true);

    expect(filter.accept({ kind: 'press', x: 0, y: 0, t: 0 })).toBe(true);
    expect(filter.accept({ kind: 'press', x: 6, y: 0, t: 50 })).toBe(true);
  });
});
