import { isSameElement } from './fingerprint';
import type { Fingerprint } from './fingerprint';
import type { Rect } from './grid-index';

// 번호 순서(D-11, 설계 6.2·6.8): 고정 번호 → 자주 누른 요소 → 커서 근처. 한 장에 1~9만, 10번째부터
// 다음 장. 고정 번호의 요소가 화면에 없으면 그 번호를 비워 두지 않고 다음 순위가 채운다. 번호표
// 자리 배치(SYSTEM.md "크기 — 번호표 배치")도 함께 둔다. 순수 함수 — 전역 참조 없음.

export interface HintItem {
  id: string;
  rect: Rect;
  fingerprint: Fingerprint;
}

export interface Pin {
  number: number; // 1~9(SiteEntryV1.pins가 검사)
  fingerprint: Fingerprint;
}

export interface PressCount {
  fingerprint: Fingerprint;
  count: number;
}

export interface HintEntry {
  number: number;
  itemId: string;
}

const CHAPTER_SIZE = 9;

function distanceToCursor(cursor: { x: number; y: number }, rect: Rect): number {
  const dx = Math.max(rect.x - cursor.x, 0, cursor.x - (rect.x + rect.w));
  const dy = Math.max(rect.y - cursor.y, 0, cursor.y - (rect.y + rect.h));
  return Math.hypot(dx, dy);
}

export function orderHints(opts: {
  items: HintItem[];
  pins: Pin[];
  presses: PressCount[];
  cursor: { x: number; y: number };
}): HintEntry[][] {
  const { items, pins, presses, cursor } = opts;

  // 고정 번호가 가리키는 요소를 먼저 그 번호 자리에 배정한다(D-11). 화면에 없으면(match 없음)
  // 그 번호는 그냥 비고, 아래 "미고정 자리 채우기"에서 다음 순위가 채운다.
  const usedItemIds = new Set<string>();
  const pinnedByNumber = new Map<number, string>();
  for (const pin of pins) {
    if (pinnedByNumber.has(pin.number)) {
      continue;
    }
    const match = items.find((item) => !usedItemIds.has(item.id) && isSameElement(item.fingerprint, pin.fingerprint));
    if (match) {
      pinnedByNumber.set(pin.number, match.id);
      usedItemIds.add(match.id);
    }
  }

  function pressCountFor(item: HintItem): number {
    const match = presses.find((p) => isSameElement(p.fingerprint, item.fingerprint));
    return match ? match.count : 0;
  }

  // 미고정 요소 순위: 누른 횟수 많은 순 → 같은 횟수는 커서에 가까운 순(누른 기록이 없는 요소는
  // 이 규칙만으로 커서 가까운 순이 된다). shift()로 순서대로 소비하는 대기열로 둔다 —
  // noUncheckedIndexedAccess 아래에서 인덱스 접근 대신 shift()의 undefined 검사로 안전하게 꺼낸다.
  const queue = items
    .filter((item) => !usedItemIds.has(item.id))
    .map((item, index) => ({
      item,
      pressCount: pressCountFor(item),
      distance: distanceToCursor(cursor, item.rect),
      index,
    }))
    .sort((a, b) => {
      if (b.pressCount !== a.pressCount) {
        return b.pressCount - a.pressCount;
      }
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      return a.index - b.index;
    })
    .map((entry) => entry.item);

  const chapters: HintEntry[][] = [];

  // 1장: 고정 번호 자리를 먼저 채우고, 나머지 번호는 순위대로 채운다.
  const firstChapter: HintEntry[] = [];
  for (let number = 1; number <= CHAPTER_SIZE; number += 1) {
    const pinnedId = pinnedByNumber.get(number);
    if (pinnedId) {
      firstChapter.push({ number, itemId: pinnedId });
      continue;
    }
    const next = queue.shift();
    if (next) {
      firstChapter.push({ number, itemId: next.id });
    }
  }
  if (firstChapter.length > 0) {
    chapters.push(firstChapter);
  }

  // 다음 장부터는 고정 번호 없이 9개씩.
  while (queue.length > 0) {
    const chapter: HintEntry[] = [];
    for (let number = 1; number <= CHAPTER_SIZE && queue.length > 0; number += 1) {
      const next = queue.shift();
      if (next) {
        chapter.push({ number, itemId: next.id });
      }
    }
    chapters.push(chapter);
  }

  return chapters;
}

// 번호표 자리 배치(SYSTEM.md "크기 — 번호표 배치"): 기본은 요소 왼쪽 위 모서리 바깥
// (−14px, −14px, labelSize=28 기준). 앞 번호부터 차례로 자리를 정해, 이미 놓인 번호표와 겹치면
// 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래 → 요소 안쪽 왼쪽 위 순으로 옮긴다.

type Point = { x: number; y: number };

// 5-튜플로 고정해 마지막 자리(안쪽 왼쪽 위, 넷 다 겹칠 때 쓰는 최종 대안)를 noUncheckedIndexedAccess
// 아래에서도 단정 없이 정의된 값으로 읽을 수 있게 한다.
function candidatePositions(rect: Rect, size: number): [Point, Point, Point, Point, Point] {
  const half = size / 2;
  return [
    { x: rect.x - half, y: rect.y - half }, // 왼쪽 위 바깥(기본)
    { x: rect.x + rect.w - half, y: rect.y - half }, // 오른쪽 위
    { x: rect.x - half, y: rect.y + rect.h - half }, // 왼쪽 아래
    { x: rect.x + rect.w - half, y: rect.y + rect.h - half }, // 오른쪽 아래
    { x: rect.x, y: rect.y }, // 안쪽 왼쪽 위
  ];
}

function boxesOverlap(a: { x: number; y: number }, b: { x: number; y: number }, size: number): boolean {
  return a.x < b.x + size && a.x + size > b.x && a.y < b.y + size && a.y + size > b.y;
}

export function placeLabels(
  entries: Array<{ itemId: string; rect: Rect }>,
  labelSize = 28,
): Array<{ itemId: string; x: number; y: number }> {
  const placed: Array<{ x: number; y: number }> = [];
  const result: Array<{ itemId: string; x: number; y: number }> = [];

  for (const entry of entries) {
    const candidates = candidatePositions(entry.rect, labelSize);
    let chosen: Point = candidates[4];
    for (const candidate of candidates) {
      if (!placed.some((p) => boxesOverlap(p, candidate, labelSize))) {
        chosen = candidate;
        break;
      }
    }
    placed.push(chosen);
    result.push({ itemId: entry.itemId, x: chosen.x, y: chosen.y });
  }

  return result;
}
