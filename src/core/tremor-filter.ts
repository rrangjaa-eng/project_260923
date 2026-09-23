// 떨림 필터 순수 함수(D-06, D-07, D-30) — document·window·chrome 없이 판단만 한다.
// 입력 파이프라인(src/page/input/pipeline.ts)이 이 판단으로 preventDefault 여부를 정한다.

export type TremorInput =
  | { kind: 'key'; code: string; repeat: boolean; t: number }
  | { kind: 'press'; x: number; y: number; t: number };

export interface TremorFilter {
  accept(input: TremorInput): boolean;
  shouldSuppressDblclick(): boolean;
}

export function createTremorFilter(opts: { intervalMs: number; sameSpotPx: number }): TremorFilter {
  const { intervalMs, sameSpotPx } = opts;

  const lastAcceptedKeyAt = new Map<string, number>();
  let lastAcceptedPress: { x: number; y: number; t: number } | null = null;
  let lastPressRejected = false;

  function acceptKey(input: { code: string; repeat: boolean; t: number }): boolean {
    if (input.repeat) {
      return false;
    }
    const lastAt = lastAcceptedKeyAt.get(input.code);
    if (lastAt !== undefined && input.t - lastAt < intervalMs) {
      return false;
    }
    lastAcceptedKeyAt.set(input.code, input.t);
    return true;
  }

  function acceptPress(input: { x: number; y: number; t: number }): boolean {
    if (lastAcceptedPress !== null) {
      const dt = input.t - lastAcceptedPress.t;
      const distance = Math.hypot(input.x - lastAcceptedPress.x, input.y - lastAcceptedPress.y);
      if (dt < intervalMs && distance <= sameSpotPx) {
        lastPressRejected = true;
        return false;
      }
    }
    lastAcceptedPress = { x: input.x, y: input.y, t: input.t };
    lastPressRejected = false;
    return true;
  }

  return {
    accept(input) {
      return input.kind === 'key' ? acceptKey(input) : acceptPress(input);
    },
    shouldSuppressDblclick() {
      return lastPressRejected;
    },
  };
}
