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
// ISSUE-002·003(/qa 2026-09-26 사용자 결정): 화면(뷰포트) 밖으로 나가는 자리와 위험한 요소의
// "! 위험" 표시를 가리는 자리도 겹침과 같은 기준으로 건너뛴다 — viewportWidth·viewportHeight·
// dangerTagWidth를 안 주면(opts 생략) 예전과 똑같이 동작한다(기존 호출부·시험 호환).

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

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ISSUE-002: 후보 자리가 뷰포트를 벗어나는지 — viewportWidth·viewportHeight가 유한할 때만
// 판단한다(Infinity면 늘 안 벗어난 것으로 본다, opts 생략 시 기존 동작 유지). F1(/design-review
// 3회차, 사용자 결정): 폭·높이를 따로 받아 위험 항목의 "번호표 + 표시" 합친 상자도 그대로 잴 수
// 있다(정사각형이면 w===h===size로 기존 호출과 같다).
function withinViewport(p: Point, w: number, h: number, viewportWidth: number, viewportHeight: number): boolean {
  if (Number.isFinite(viewportWidth) && (p.x < 0 || p.x + w > viewportWidth)) {
    return false;
  }
  if (Number.isFinite(viewportHeight) && (p.y < 0 || p.y + h > viewportHeight)) {
    return false;
  }
  return true;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

export interface PlaceLabelsOptions {
  viewportWidth?: number;
  viewportHeight?: number;
  // ISSUE-003: 위험 항목의 "! 위험" 표시 상자 크기 — 0(기본)이면 다른 번호표가 이 표시를
  // 피할 obstacle로 안 쓴다(기존 동작 유지). 실제 렌더 폭은 DOM 쪽(hints.ts measureDangerTag)에서
  // 재 이 함수에 넘긴다 — 이 파일은 순수 함수라 폰트를 직접 재지 않는다.
  dangerTagWidth?: number;
  dangerGap?: number;
}

export interface LabelPlacement {
  itemId: string;
  x: number;
  y: number;
  // entry.danger일 때만 값이 있다 — 렌더 쪽(hints.ts)이 "! 위험" 표시를 이 자리에 그린다.
  dangerTagX?: number;
  dangerTagY?: number;
}

export function placeLabels(
  entries: Array<{ itemId: string; rect: Rect; danger?: boolean }>,
  labelSize = 28,
  opts: PlaceLabelsOptions = {},
): LabelPlacement[] {
  const {
    viewportWidth = Number.POSITIVE_INFINITY,
    viewportHeight = Number.POSITIVE_INFINITY,
    dangerTagWidth = 0,
    dangerGap = 8,
  } = opts;

  // ISSUE-002·003(사용자 결정): 위험 항목을 먼저 자리 잡아야 그 "! 위험" 표시가 다른 번호표의
  // obstacle 목록에 먼저 들어간다 — 번호·순서 자체(entries가 돌려주는 항목 순서)는 바뀌지 않는다,
  // 자리를 고르는 처리 순서만 바꾼다. 안정 정렬로 같은 위험 여부 안에서는 원래 순서를 지킨다.
  const order = entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const da = a.entry.danger ? 0 : 1;
      const db = b.entry.danger ? 0 : 1;
      return da !== db ? da - db : a.index - b.index;
    });

  const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
  const resultByItemId = new Map<string, { x: number; y: number; dangerTagX?: number; dangerTagY?: number }>();

  for (const { entry } of order) {
    // F1·F2(/design-review 3회차, 사용자 결정): 위험 항목은 번호표 + "! 위험" 표시를 한 상자로
    // 보고 자리를 고른다 — 표시는 항상 번호표 오른쪽(뒤집지 않음)이라 상자 폭은 번호표+간격+표시
    // 폭이다. 위험이 아니거나 표시 폭을 모르면(opts 생략) 상자 폭은 번호표 하나 그대로다(기존
    // 동작 유지).
    const extraWidth = entry.danger && dangerTagWidth > 0 ? dangerGap + dangerTagWidth : 0;
    const combinedWidth = labelSize + extraWidth;

    const candidates = candidatePositions(entry.rect, labelSize);
    let chosen: Point = candidates[4];
    for (const candidate of candidates) {
      const box = { x: candidate.x, y: candidate.y, w: combinedWidth, h: labelSize };
      const blocked = placed.some((p) => rectsOverlap(p, box));
      if (!blocked && withinViewport(candidate, combinedWidth, labelSize, viewportWidth, viewportHeight)) {
        chosen = candidate;
        break;
      }
    }

    // ISSUE-002·F1(사용자 결정): 다섯 자리 모두 화면 밖이거나 막혀 있으면, 겹침보다 잘림을 더
    // 나쁘게 보고 화면 안으로 밀어 넣는다(잘림 0 우선, 마지막 안전망) — 밀어 넣기도 합친 상자
    // 폭 기준(x ≤ W − size − gap − tagW)으로 계산해 위험 표시까지 화면 안에 들어오게 한다.
    const x = Number.isFinite(viewportWidth) ? clamp(chosen.x, 0, Math.max(0, viewportWidth - combinedWidth)) : chosen.x;
    const y = Number.isFinite(viewportHeight) ? clamp(chosen.y, 0, Math.max(0, viewportHeight - labelSize)) : chosen.y;

    const entryResult: { x: number; y: number; dangerTagX?: number; dangerTagY?: number } = { x, y };
    // 이 항목이 차지하는 자리(번호표 + 있다면 표시까지)를 한 상자로 남긴다 — 다음 항목은 danger
    // 여부와 무관하게 이 상자 전체를 피한다.
    placed.push({ x, y, w: combinedWidth, h: labelSize });

    if (entry.danger) {
      entryResult.dangerTagX = x + labelSize + dangerGap;
      entryResult.dangerTagY = y;
    }

    resultByItemId.set(entry.itemId, entryResult);
  }

  return entries.map((entry) => {
    const pos = resultByItemId.get(entry.itemId);
    const placement: LabelPlacement = { itemId: entry.itemId, x: pos?.x ?? 0, y: pos?.y ?? 0 };
    if (pos?.dangerTagX !== undefined && pos.dangerTagY !== undefined) {
      placement.dangerTagX = pos.dangerTagX;
      placement.dangerTagY = pos.dangerTagY;
    }
    return placement;
  });
}
