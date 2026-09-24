import type { Fingerprint } from './fingerprint';
import type { Point, Rect } from './grid-index';

// 프레임 트리 합성(D-03, RESEARCH Pattern 2): 각 프레임이 자기 요소(자기 viewport 좌표)와 자식
// iframe 자리(오프셋·잘림)를 보고하면, 맨 위 프레임이 트리를 따라 내려가며 오프셋을 더하고 clip을
// 교차해 모든 요소를 맨 위 좌표로 바꾼다. 순수 함수 — document·window·chrome 참조 없음.

export interface FrameReport {
  frameId: number;
  items: Array<{ id: string; rect: Rect; fingerprint: Fingerprint; danger?: boolean | undefined }>;
  children: Array<{ childFrameId: number; offset: Point; clip: Rect; pathKey: string }>;
}

export interface ComposedItem {
  frameId: number;
  itemId: string;
  rect: Rect;
  fingerprint: Fingerprint;
  danger?: boolean;
}

function translateRect(rect: Rect, offset: Point): Rect {
  return { x: rect.x + offset.x, y: rect.y + offset.y, w: rect.w, h: rect.h };
}

// 두 사각형의 교차. 겹치지 않으면(폭·높이가 0 이하) undefined.
function intersectRect(a: Rect, b: Rect): Rect | undefined {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  if (x1 <= x0 || y1 <= y0) {
    return undefined;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// 맨 위 프레임은 잘림이 없다 — Infinity는 x+w 계산에서 NaN(-Infinity+Infinity)이 나오므로
// 유한하지만 실제 화면 크기보다 훨씬 큰 값으로 "잘리지 않음"을 표현한다.
const UNBOUNDED_EXTENT = 1e9;
const UNBOUNDED_CLIP: Rect = { x: -UNBOUNDED_EXTENT, y: -UNBOUNDED_EXTENT, w: UNBOUNDED_EXTENT * 2, h: UNBOUNDED_EXTENT * 2 };

export function composeTree(reports: ReadonlyMap<number, FrameReport>, topFrameId = 0): ComposedItem[] {
  const result: ComposedItem[] = [];
  const visited = new Set<number>();

  function walk(frameId: number, offset: Point, clip: Rect, framePath: string[]): void {
    if (visited.has(frameId)) {
      // 보고가 서로를 가리키는 고리(순환 참조)를 막는다 — 이미 다녀간 프레임은 다시 내려가지 않는다.
      return;
    }
    visited.add(frameId);

    const report = reports.get(frameId);
    if (!report) {
      // 부모가 가리키는 자식 보고가 아직 도착하지 않았다 — 오류 없이 이 가지를 건너뛴다.
      return;
    }

    for (const item of report.items) {
      const rect = translateRect(item.rect, offset);
      const clipped = intersectRect(rect, clip);
      if (!clipped) {
        continue;
      }
      result.push({
        frameId,
        itemId: item.id,
        rect: clipped,
        fingerprint: { ...item.fingerprint, framePath },
        ...(item.danger !== undefined ? { danger: item.danger } : {}),
      });
    }

    for (const child of report.children) {
      // child.clip·child.offset은 이 프레임(frameId)의 자기 좌표로 보고됐다 — 맨 위 좌표로 바꾼 뒤
      // 지금까지 누적된 clip과 교차해야 조상 프레임에서 잘린 부분도 함께 반영된다.
      const childOffset = { x: offset.x + child.offset.x, y: offset.y + child.offset.y };
      const childClipInTop = translateRect(child.clip, offset);
      const childClip = intersectRect(childClipInTop, clip);
      if (!childClip) {
        continue;
      }
      walk(child.childFrameId, childOffset, childClip, [...framePath, child.pathKey]);
    }
  }

  walk(topFrameId, { x: 0, y: 0 }, UNBOUNDED_CLIP, []);
  return result;
}

// RESEARCH A2 정정(D-03): Chrome에는 chrome.runtime.getFrameId가 없다(Firefox 전용
// API였다). 부모는 자기 iframe의 실제 frameId를 알 수 없으므로, 대신 각 프레임이 스스로
// 계산한 창 위치 경로(selfPath, src/core/frame-path.ts)와 부모가 보고하는 자식의 상대
// 순번(index)만 보낸다. resolveReports는 이 둘을 맞춰(selfPath + index === 자식의
// selfPath) 실제 frameId(sender.frameId, relay.ts가 신뢰)를 채운 FrameReport로 바꿔
// composeTree가 그대로 쓸 수 있게 한다. 아직 경로를 모르는 자식(보고가 안 왔음)은
// 건너뛴다(오류 없음) — 순수 함수.

export interface RawFrameReport {
  frameId: number;
  selfPath: number[];
  items: FrameReport['items'];
  children: Array<{ index: number; offset: Point; clip: Rect; pathKey: string }>;
}

export function resolveReports(entries: Array<{ frameId: number; report: RawFrameReport }>): Map<number, FrameReport> {
  const frameIdByPath = new Map<string, number>();
  for (const { frameId, report } of entries) {
    frameIdByPath.set(report.selfPath.join(','), frameId);
  }

  const resolved = new Map<number, FrameReport>();
  for (const { frameId, report } of entries) {
    const children: FrameReport['children'] = [];
    for (const child of report.children) {
      const childPath = [...report.selfPath, child.index].join(',');
      const childFrameId = frameIdByPath.get(childPath);
      if (childFrameId === undefined) {
        continue;
      }
      children.push({ childFrameId, offset: child.offset, clip: child.clip, pathKey: child.pathKey });
    }
    resolved.set(frameId, { frameId, items: report.items, children });
  }
  return resolved;
}
