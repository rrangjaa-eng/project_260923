import type { Fingerprint } from './settings-schema';

export type { Fingerprint };

// 요소 식별 일치 점수(D-11, 설계 6.8): id·name·labelText·buttonText·aria·domPath 중 같은 값의
// 개수가 점수다. framePath가 다르면 점수 0(다른 프레임의 요소는 애초에 후보가 아니다). 두 쪽 다
// 값이 없는 표시(undefined)는 일치로 세지 않는다 — 우연히 둘 다 비어서 같은 요소로 보이는 것을
// 막는다. 순수 함수 — 전역 참조 없음.

const COMPARABLE_KEYS = ['id', 'name', 'labelText', 'buttonText', 'aria', 'domPath'] as const;

function sameFramePath(a: Fingerprint, b: Fingerprint): boolean {
  return a.framePath.length === b.framePath.length && a.framePath.every((part, i) => part === b.framePath[i]);
}

export function matchScore(a: Fingerprint, b: Fingerprint): number {
  if (!sameFramePath(a, b)) {
    return 0;
  }
  let score = 0;
  for (const key of COMPARABLE_KEYS) {
    const va = a[key];
    const vb = b[key];
    if (va !== undefined && vb !== undefined && va === vb) {
      score += 1;
    }
  }
  return score;
}

export function isSameElement(a: Fingerprint, b: Fingerprint): boolean {
  return matchScore(a, b) >= 2;
}
