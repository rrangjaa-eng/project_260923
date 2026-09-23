// 끌어서 놓기 두 번 누르기 상태 기계(D-08, FILT-04) — 순수 함수(document·window·chrome 참조
// 없음). 대기 상태에서 끌 수 있는 대상을 누르면 arm(끌기 시작), 끌 수 없으면 pass(보통
// 누르기). 끌기 시작 상태에서 다른 대상을 누르면 drop(source·target)과 함께 대기로, 같은
// 대상을 다시 누르면 cancel. cancel()(Esc)은 끌기 시작 상태일 때만 대기로 되돌린다.

export type DragTwoPressResult =
  | { action: 'arm' }
  | { action: 'pass' }
  | { action: 'cancel' }
  | { action: 'drop'; sourceId: string; targetId: string };

export interface DragTwoPress {
  press(target: { id: string; draggable: boolean }): DragTwoPressResult;
  cancel(): void;
  armed(): string | null;
}

export function createDragTwoPress(): DragTwoPress {
  let armedId: string | null = null;

  return {
    press(target) {
      if (armedId === null) {
        if (target.draggable) {
          armedId = target.id;
          return { action: 'arm' };
        }
        return { action: 'pass' };
      }

      if (target.id === armedId) {
        armedId = null;
        return { action: 'cancel' };
      }

      const sourceId = armedId;
      armedId = null;
      return { action: 'drop', sourceId, targetId: target.id };
    },
    cancel() {
      armedId = null;
    },
    armed() {
      return armedId;
    },
  };
}
