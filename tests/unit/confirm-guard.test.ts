import { describe, expect, it } from 'vitest';
import { createConfirmGuard } from '../../src/core/confirm-guard';

// D-19: 확인 화면 보호 상태 기계 — 연 뒤 1000ms(guardMs)는 모든 입력을 무시하고, 확인은 방금 누른
// 스페이스바가 아닌 Enter(또는 스페이스바 1초 누르기, holdMs)로, 취소는 Esc로만 한다. 순수 함수
// (document·window·chrome 없음) — 시각은 인자로만 받는다.

const KEYMAP = { confirm: 'Enter', cancel: 'Escape', press: 'Space' };

describe('createConfirmGuard', () => {
  it('연 뒤 1000ms 미만의 Enter·Esc·스페이스바·다른 키는 모두 ignore다', () => {
    const guard = createConfirmGuard({ openedAt: 0, keymap: KEYMAP });
    expect(guard.handle({ type: 'keydown', code: 'Enter', repeat: false, t: 300 })).toBe('ignore');
    expect(guard.handle({ type: 'keydown', code: 'Escape', repeat: false, t: 300 })).toBe('ignore');
    expect(guard.handle({ type: 'keydown', code: 'Space', repeat: false, t: 300 })).toBe('ignore');
    expect(guard.handle({ type: 'keydown', code: 'KeyA', repeat: false, t: 300 })).toBe('ignore');
  });

  it('1000ms 뒤 Enter keydown(repeat: false)은 confirm이다', () => {
    const guard = createConfirmGuard({ openedAt: 0, keymap: KEYMAP });
    expect(guard.handle({ type: 'keydown', code: 'Enter', repeat: false, t: 1000 })).toBe('confirm');
  });

  it('보호 시간 안에 눌러 계속 누르고 있는 Enter의 repeat: true keydown은 1000ms 뒤에도 ignore다', () => {
    const guard = createConfirmGuard({ openedAt: 0, keymap: KEYMAP });
    expect(guard.handle({ type: 'keydown', code: 'Enter', repeat: false, t: 300 })).toBe('ignore');
    expect(guard.handle({ type: 'keydown', code: 'Enter', repeat: true, t: 1100 })).toBe('ignore');
  });

  it('1000ms 뒤 Esc는 cancel이다', () => {
    const guard = createConfirmGuard({ openedAt: 0, keymap: KEYMAP });
    expect(guard.handle({ type: 'keydown', code: 'Escape', repeat: false, t: 1000 })).toBe('cancel');
  });

  it('1000ms 뒤 스페이스바 keydown 후 1000ms 동안 keyup 없이 tick하면 confirm이다', () => {
    const guard = createConfirmGuard({ openedAt: 0, keymap: KEYMAP });
    expect(guard.handle({ type: 'keydown', code: 'Space', repeat: false, t: 1000 })).toBe('ignore');
    expect(guard.tick(2000)).toBe('confirm');
  });

  it('스페이스바를 1000ms 전에 떼면 confirm이 되지 않는다', () => {
    const guard = createConfirmGuard({ openedAt: 0, keymap: KEYMAP });
    expect(guard.handle({ type: 'keydown', code: 'Space', repeat: false, t: 1000 })).toBe('ignore');
    expect(guard.handle({ type: 'keyup', code: 'Space', repeat: false, t: 1500 })).toBe('ignore');
    expect(guard.tick(2000)).toBeNull();
  });

  it('보호 시간 안에 누르기 시작한 스페이스바는 계속 누르고 있어도 confirm이 되지 않는다', () => {
    const guard = createConfirmGuard({ openedAt: 0, keymap: KEYMAP });
    expect(guard.handle({ type: 'keydown', code: 'Space', repeat: false, t: 300 })).toBe('ignore');
    expect(guard.handle({ type: 'keydown', code: 'Space', repeat: true, t: 1100 })).toBe('ignore');
    expect(guard.tick(2200)).toBeNull();
  });

  it('키 배치를 바꾸면(confirm=NumpadEnter) 그 키로 확인된다', () => {
    const guard = createConfirmGuard({ openedAt: 0, keymap: { ...KEYMAP, confirm: 'NumpadEnter' } });
    expect(guard.handle({ type: 'keydown', code: 'NumpadEnter', repeat: false, t: 1000 })).toBe('confirm');
  });
});
