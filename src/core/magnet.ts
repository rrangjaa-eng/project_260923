import { rectDistance, type Rect } from './grid-index';

// 자석 잡기 판단(D-10): 커서에서 가장 가까운 요소를 넓은 범위·히스테리시스로 잡는다. 순수 함수 —
// document·window·chrome 참조 없음. 위험한 버튼 예외는 Plan 01-08이 여기에 더한다.

export interface Candidate {
  id: string;
  rect: Rect;
}

export interface PickTargetOptions {
  cursor: { x: number; y: number };
  candidates: Candidate[];
  currentId: string | null;
  captureMarginPx: number;
  switchHysteresisPx: number;
}

function area(r: Rect): number {
  return r.w * r.h;
}

export function pickTarget(opts: PickTargetOptions): string | null {
  const { cursor, candidates, currentId, captureMarginPx, switchHysteresisPx } = opts;

  const inRange = candidates
    .map((candidate) => ({ candidate, distance: rectDistance(cursor, candidate.rect) }))
    .filter(({ distance }) => distance <= captureMarginPx);

  if (inRange.length === 0) {
    return null;
  }

  const best = inRange.reduce((acc, entry) => {
    if (entry.distance < acc.distance) {
      return entry;
    }
    if (entry.distance === acc.distance && area(entry.candidate.rect) < area(acc.candidate.rect)) {
      return entry;
    }
    return acc;
  });

  const current = currentId === null ? undefined : inRange.find(({ candidate }) => candidate.id === currentId);
  if (!current) {
    return best.candidate.id;
  }
  if (best.candidate.id === current.candidate.id) {
    return current.candidate.id;
  }
  // 히스테리시스: B가 현재 A보다 switchHysteresisPx를 초과해 가까울 때만 바뀐다.
  if (current.distance - best.distance > switchHysteresisPx) {
    return best.candidate.id;
  }
  return current.candidate.id;
}
