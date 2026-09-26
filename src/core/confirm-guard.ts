// 확인 화면 보호 상태 기계(D-19) — 순수 함수(document·window·chrome 참조 없음), 시각은 인자로만
// 받는다. 확인 화면이 뜬 뒤 guardMs(1000ms) 동안은 모든 입력을 무시하고, 그 뒤에는 진짜 Enter
// (keymap.confirm, repeat 없음) 또는 스페이스바(keymap.press)를 holdMs(1000ms) 동안 keyup 없이
// 누르고 있어야 confirm, Esc(keymap.cancel)는 곧바로 cancel이다. 한 번 confirm·cancel이 되면
// 이후 모든 입력은 ignore다.

export type ConfirmGuardResult = 'confirm' | 'cancel' | 'ignore';

export interface ConfirmGuardEvent {
  type: 'keydown' | 'keyup';
  code: string;
  repeat: boolean;
  t: number;
}

export interface ConfirmGuardKeymap {
  confirm: string;
  cancel: string;
  press: string;
}

export interface ConfirmGuard {
  handle(e: ConfirmGuardEvent): ConfirmGuardResult;
  tick(t: number): 'confirm' | null;
}

export function createConfirmGuard(opts: {
  openedAt: number;
  guardMs?: number;
  holdMs?: number;
  keymap: ConfirmGuardKeymap;
}): ConfirmGuard {
  const { openedAt, guardMs = 1000, holdMs = 1000, keymap } = opts;

  let resolved: 'confirm' | 'cancel' | null = null;
  let holdStartedAt: number | null = null;

  return {
    handle(e) {
      if (resolved !== null) {
        return 'ignore';
      }
      if (e.t - openedAt < guardMs) {
        return 'ignore';
      }

      if (e.type === 'keyup') {
        if (e.code === keymap.press) {
          holdStartedAt = null;
        }
        return 'ignore';
      }

      if (e.code === keymap.confirm && !e.repeat) {
        resolved = 'confirm';
        return 'confirm';
      }
      if (e.code === keymap.cancel) {
        resolved = 'cancel';
        return 'cancel';
      }
      if (e.code === keymap.press && !e.repeat) {
        holdStartedAt = e.t;
        return 'ignore';
      }
      return 'ignore';
    },
    tick(t) {
      if (resolved !== null || holdStartedAt === null) {
        return null;
      }
      if (t - holdStartedAt >= holdMs) {
        resolved = 'confirm';
        holdStartedAt = null;
        return 'confirm';
      }
      return null;
    },
  };
}
