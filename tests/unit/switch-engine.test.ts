import { describe, expect, it } from 'vitest';
import { createSwitchState, reduceSwitch, type SwitchItem } from '../../src/core/switch-engine';

const items: SwitchItem[] = ['A', 'B'].map((id) => ({ id, label: id, action: { kind: 'press' } }));
const key = (type: 'keyDown' | 'keyUp', now: number, extra = {}) => ({ type, now, code: 'Space', trusted: true, repeat: false, isComposing: false, ...extra } as const);
function ready() {
  return reduceSwitch(createSwitchState(), { type: 'start', now: 0, items }).state;
}
describe('single switch engine', () => {
  it('locks item on keydown until release and executes once', () => {
    const down = reduceSwitch(ready(), key('keyDown', 10)).state;
    const tick = reduceSwitch(down, { type: 'tick', now: 6000 }).state;
    const up = reduceSwitch(tick, key('keyUp', 6001));
    expect(up.actions).toHaveLength(1);
    expect(up.actions[0]?.itemId).toBe('A');
    expect(reduceSwitch(up.state, key('keyUp', 6100)).actions).toHaveLength(0);
  });
  it('ignores synthetic, composition, repeat and orphan release', () => {
    for (const extra of [{ trusted: false }, { isComposing: true }, { repeat: true }, { modified: true }]) {
      const down = reduceSwitch(ready(), key('keyDown', 10, extra)).state;
      expect(reduceSwitch(down, key('keyUp', 20)).actions).toHaveLength(0);
    }
  });
  it('discards incomplete presses on blur and consumes resume', () => {
    const down = reduceSwitch(ready(), key('keyDown', 10)).state;
    const paused = reduceSwitch(down, { type: 'pause', now: 20 }).state;
    expect(reduceSwitch(paused, key('keyUp', 30)).actions).toHaveLength(0);
    const resumeDown = reduceSwitch(paused, key('keyDown', 500)).state;
    const resumed = reduceSwitch(resumeDown, key('keyUp', 510));
    expect(resumed.actions).toHaveLength(0);
    expect(resumed.state.mode).toBe('itemScan');
  });
  it('starts with twice dwell and pauses after two silent cycles', () => {
    expect(reduceSwitch(ready(), { type: 'tick', now: 2999 }).state.scanIndex).toBe(0);
    const next = reduceSwitch(ready(), { type: 'tick', now: 3000 }).state;
    expect(next.scanIndex).toBe(1);
    let state = next;
    for (const now of [4500, 7500, 9000]) state = reduceSwitch(state, { type: 'tick', now }).state;
    expect(state.mode).toBe('paused');
    expect(state.pendingAction).toBeNull();
  });
  it('does not catch up delayed ticks or execute while pending', () => {
    expect(reduceSwitch(ready(), { type: 'tick', now: 1e7 }).state.scanIndex).toBe(1);
    const down = reduceSwitch(ready(), key('keyDown', 10)).state;
    const up = reduceSwitch(down, key('keyUp', 20)).state;
    expect(reduceSwitch(up, key('keyDown', 1000)).state.pressed).toBeNull();
  });
  it('pausing auto scroll resumes the menu without restarting scrolling', () => {
    const scrolling = { ...ready(), mode: 'scrolling' as const, resumeMode: 'itemScan' as const };
    const paused = reduceSwitch(scrolling, { type: 'pause', now: 10 }).state;
    const down = reduceSwitch(paused, key('keyDown', 500)).state;
    const resumed = reduceSwitch(down, key('keyUp', 510));
    expect(resumed.state.mode).toBe('itemScan');
    expect(resumed.actions).toHaveLength(0);
  });
  it('pausing an executing editor command preserves the editor resume mode', () => {
    const composing = { ...ready(), mode: 'composing' as const };
    const down = reduceSwitch(composing, key('keyDown', 10)).state;
    const executing = reduceSwitch(down, key('keyUp', 20)).state;
    const paused = reduceSwitch(executing, { type: 'pause', now: 30 }).state;
    expect(paused.resumeMode).toBe('composing');
  });
});
