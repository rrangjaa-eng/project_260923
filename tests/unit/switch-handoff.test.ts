import { describe, expect, it } from 'vitest';
import { createSwitchState, reduceSwitch } from '../../src/core/switch-engine';
import { SwitchHandoff, type OwnedAction } from '../../src/core/switch-handoff';
const key = (type: 'keyDown' | 'keyUp', now: number, extra = {}) => ({ type, now, code: 'Space', repeat: false, trusted: true, isComposing: false, ...extra } as const);
function required(action: OwnedAction | undefined): OwnedAction { if (!action) throw new Error('expected owned action'); return action; }
function setup() {
  const state = reduceSwitch(createSwitchState(), { type: 'start', now: 0, items: [{ id: 'act', label: '시험 동작', action: { kind: 'command' } }] }).state;
  return new SwitchHandoff({ page: { ...state, draft: '페이지 초안' }, practice: { ...state, draft: '연습 초안' } });
}
describe('single-owner fake handoff', () => {
  it('the same down/up delivered to both roles executes only the owner once', () => {
    const flow = setup();
    expect(flow.key('page', key('keyDown', 10))).toEqual([]); expect(flow.key('practice', key('keyDown', 10))).toEqual([]);
    const actions = flow.key('page', key('keyUp', 20)); expect(actions).toHaveLength(1);
    expect(flow.key('practice', key('keyUp', 20))).toEqual([]);
    expect(flow.complete(required(actions[0]), 'done', 30)).toBe(true); expect(flow.complete(required(actions[0]), 'done', 40)).toBe(false);
  });
  it('transfer during a held press consumes its release and then a new resume only', () => {
    const flow = setup(); flow.key('page', key('keyDown', 10)); expect(flow.transfer('practice', 20)).toBe(true);
    expect(flow.owner).toBe('practice'); expect(flow.generation).toBe(1);
    expect(flow.key('practice', key('keyUp', 30))).toEqual([]); expect(flow.key('page', key('keyUp', 31))).toEqual([]);
    expect(flow.key('practice', key('keyDown', 500))).toEqual([]); expect(flow.key('practice', key('keyUp', 510))).toEqual([]);
    expect(flow.snapshot('practice').mode).toBe('itemScan');
    flow.key('practice', key('keyDown', 1000)); expect(flow.key('practice', key('keyUp', 1010))).toHaveLength(1);
  });
  it('cancel returns a new generation to the page without selection or losing either draft', () => {
    const flow = setup(); flow.transfer('practice', 10); flow.key('practice', key('keyDown', 100)); flow.cancel(110);
    expect(flow.owner).toBe('page'); expect(flow.generation).toBe(2);
    expect(flow.key('page', key('keyUp', 120))).toEqual([]);
    flow.key('page', key('keyDown', 500)); expect(flow.key('page', key('keyUp', 510))).toEqual([]);
    expect(flow.snapshot('page').draft).toBe('페이지 초안'); expect(flow.snapshot('practice').draft).toBe('연습 초안');
  });
  it('old results after transfer or cancellation cannot revive any pending action', () => {
    const flow = setup(); flow.key('page', key('keyDown', 10)); const [action] = flow.key('page', key('keyUp', 20));
    expect(action).toBeDefined(); flow.transfer('practice', 30); flow.cancel(40);
    expect(flow.complete(required(action), 'done', 50)).toBe(false); expect(flow.snapshot('page').pendingAction).toBeNull();
    expect(flow.snapshot('page').mode).toBe('paused');
  });
  it.each([{ trusted: false }, { isComposing: true }, { modified: true }, { repeat: true }])('rejects an unsafe new key %j', (extra) => {
    const flow = setup(); expect(flow.key('page', key('keyDown', 10, extra))).toEqual([]); expect(flow.key('page', key('keyUp', 20))).toEqual([]);
  });
  it('a modified release discards the original press and needs a new resume', () => {
    const flow = setup(); flow.key('page', key('keyDown', 10)); expect(flow.key('page', key('keyUp', 20, { modified: true }))).toEqual([]);
    expect(flow.snapshot('page').pressed).toBeNull(); flow.key('page', key('keyDown', 500)); expect(flow.key('page', key('keyUp', 510))).toEqual([]);
  });
  it('pause invalidates held and pending keys; stop permanently rejects resume and transfer', () => {
    const flow = setup(); flow.key('page', key('keyDown', 10)); flow.pause(20); expect(flow.key('page', key('keyUp', 30))).toEqual([]);
    flow.stop(40); expect(flow.owner).toBeNull(); expect(flow.transfer('practice', 50)).toBe(false);
    flow.key('page', key('keyDown', 500)); expect(flow.key('page', key('keyUp', 510))).toEqual([]);
  });
  it('ticks drive only the current role and silent pause changes the boundary generation', () => {
    const flow = setup(); const before = flow.snapshot('practice').changedAt;
    flow.tick(3000); flow.tick(6000);
    expect(flow.snapshot('practice').changedAt).toBe(before); expect(flow.snapshot('page').mode).toBe('paused'); expect(flow.generation).toBe(1);
  });
});

it('edits preserve both role drafts across cancel; stopped or oversized writes are rejected', () => {
  const flow = setup(); expect(flow.setDraft('page', '새 페이지 문장')).toBe(true);
  expect(flow.setDraft('practice', '새 연습 문장')).toBe(true); flow.transfer('practice', 10); flow.cancel(20);
  expect(flow.snapshot('page').draft).toBe('새 페이지 문장'); expect(flow.snapshot('practice').draft).toBe('새 연습 문장');
  expect(flow.setDraft('page', 'x'.repeat(4001))).toBe(false); flow.stop(30); expect(flow.setDraft('page', '덮어쓰기')).toBe(false);
});
it('a new trusted Space during pending work is consumed only by stop', () => {
  const flow = setup(); flow.key('page', key('keyDown', 10)); const [action] = flow.key('page', key('keyUp', 20));
  expect(action).toBeDefined(); flow.key('page', key('keyDown', 500)); expect(flow.key('page', key('keyUp', 510))).toEqual([]);
  expect(flow.owner).toBeNull(); expect(flow.complete(required(action), 'done', 520)).toBe(false);
});
it('stop intent survives a reply arriving between Space down and up', () => {
  const flow = setup(); flow.key('page', key('keyDown', 10)); const action = required(flow.key('page', key('keyUp', 20))[0]);
  flow.key('page', key('keyDown', 500)); expect(flow.complete(action, 'done', 510)).toBe(true);
  expect(flow.key('page', key('keyUp', 520))).toEqual([]); expect(flow.owner).toBeNull();
});
