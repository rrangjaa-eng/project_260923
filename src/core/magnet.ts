import { rectDistance, type Rect } from './grid-index';

// 자석 잡기 판단(D-10): 커서에서 가장 가까운 요소를 넓은 범위·히스테리시스로 잡는다. 순수 함수 —
// document·window·chrome 참조 없음. 위험한 버튼 예외(D-18, Plan 01-08): danger 후보는 커서가
// 그 사각형 안(거리 0)일 때만 잡히고, 범위 안에 일반 후보가 있으면 항상 일반 후보를 먼저 본다 —
// 벗어나면(거리 0이 아니게 되면) 히스테리시스 없이 곧바로 놓인다.

export interface Candidate {
  id: string;
  rect: Rect;
  danger?: boolean;
}

export interface PickTargetOptions {
  cursor: { x: number; y: number };
  candidates: Candidate[];
  currentId: string | null;
  captureMarginPx: number;
  switchHysteresisPx: number;
}

interface DistanceEntry {
  candidate: Candidate;
  distance: number;
}

function area(r: Rect): number {
  return r.w * r.h;
}

// entries 중 가장 가까운(동률이면 면적이 작은) 것을 고르되, currentId가 그 안에 있으면
// switchHysteresisPx를 초과해 가까울 때만 바뀐다. entries는 비어 있지 않아야 한다.
function pickBest(entries: DistanceEntry[], currentId: string | null, switchHysteresisPx: number): string {
  const best = entries.reduce((acc, entry) => {
    if (entry.distance < acc.distance) {
      return entry;
    }
    if (entry.distance === acc.distance && area(entry.candidate.rect) < area(acc.candidate.rect)) {
      return entry;
    }
    return acc;
  });

  const current = currentId === null ? undefined : entries.find(({ candidate }) => candidate.id === currentId);
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

export function pickTarget(opts: PickTargetOptions): string | null {
  const { cursor, candidates, currentId, captureMarginPx, switchHysteresisPx } = opts;

  const withDistance = candidates.map((candidate) => ({ candidate, distance: rectDistance(cursor, candidate.rect) }));

  // CR-04: 커서가 danger 사각형 안(거리 0)이면 언제나 그 danger를 잡는다 — 범위 안 일반 후보가
  // 있다는 이유로 밀어내면 §8이 요구하는 "커서가 정확히 위에 있으면 반드시 잡힌다"가 깨진다
  // (붙어 있는 "저장/삭제" 같은 배치에서 삭제 클릭이 저장으로 새는 사고). 히스테리시스는 적용하지
  // 않는다(거리 0이 아니게 되면 이 목록에서 곧바로 빠진다).
  const dangerAtZero = withDistance.filter(({ candidate, distance }) => candidate.danger === true && distance === 0);
  if (dangerAtZero.length > 0) {
    return pickBest(dangerAtZero, currentId, 0);
  }

  // 커서가 danger 위가 아닐 때만 일반 후보를 본다 — danger는 이 범위 판정으로 끌려오지 않는다.
  const normalInRange = withDistance.filter(
    ({ candidate, distance }) => !candidate.danger && distance <= captureMarginPx,
  );
  if (normalInRange.length > 0) {
    return pickBest(normalInRange, currentId, switchHysteresisPx);
  }

  return null;
}
