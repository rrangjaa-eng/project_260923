export type SwitchMode = 'ready' | 'groupScan' | 'itemScan' | 'composing' | 'confirming' | 'executing' | 'scrolling' | 'paused' | 'recovering';
export interface SwitchTarget { tabId: number; frameId: number; documentGeneration: string; itemId: string }
export interface SwitchAction {
  actionId: string;
  modeGeneration: number;
  kind: 'press' | 'applyText' | 'search' | 'scrollStep' | 'scrollStart' | 'scrollStop' | 'back' | 'activateTab' | 'command';
  target?: SwitchTarget;
  text?: string;
  tabId?: number;
  direction?: 'up' | 'down';
  itemId?: string;
}
export interface SwitchItem {
  id: string;
  label: string;
  action?: Omit<SwitchAction, 'actionId' | 'modeGeneration'>;
  disabled?: boolean;
}
export interface SwitchState {
  mode: SwitchMode;
  items: SwitchItem[];
  scanIndex: number;
  cycleCount: number;
  pressed: string | null;
  modeGeneration: number;
  pendingAction: SwitchAction | null;
  lastSelection: number;
  changedAt: number;
  intervalMs: number;
  protectionMs: number;
  sequence: number;
  draft: string;
  resumeMode: SwitchMode;
}
type Timed = { now: number };
type Key = Timed & { code: string; repeat: boolean; trusted: boolean; isComposing: boolean; modified?: boolean };
export type SwitchEvent =
  | (Timed & { type: 'start' | 'setItems'; items: SwitchItem[]; mode?: SwitchMode })
  | (Key & { type: 'keyDown' | 'keyUp' })
  | (Timed & { type: 'tick' | 'pause' | 'resume' | 'invalidate' })
  | (Timed & { type: 'actionResult'; actionId: string; result: 'done' | 'refused' | 'unknown' })
  | (Timed & { type: 'compose'; text: string });

export function createSwitchState(): SwitchState {
  return { mode: 'ready', items: [], scanIndex: 0, cycleCount: 0, pressed: null, modeGeneration: 0, pendingAction: null,
    lastSelection: -Infinity, changedAt: 0, intervalMs: 1500, protectionMs: 300, sequence: 0, draft: '', resumeMode: 'groupScan' };
}

export function reduceSwitch(previous: SwitchState, event: SwitchEvent): { state: SwitchState; actions: SwitchAction[] } {
  const state = { ...previous };
  const actions: SwitchAction[] = [];
  const pause = () => {
    if (state.mode === 'scrolling') state.resumeMode = 'itemScan';
    else if (state.mode !== 'paused' && state.mode !== 'executing' && state.mode !== 'recovering') state.resumeMode = state.mode;
    state.mode = 'paused'; state.pressed = null; state.pendingAction = null; state.modeGeneration += 1;
  };
  if (event.type === 'pause' || event.type === 'invalidate') pause();
  if (event.type === 'start' || event.type === 'setItems') {
    state.items = event.items;
    state.pendingAction = null;
    state.mode = event.mode ?? 'itemScan'; state.resumeMode = state.mode;
    state.scanIndex = 0; state.cycleCount = 0; state.pressed = null; state.changedAt = event.now;
    state.modeGeneration += 1;
  }
  if (event.type === 'compose') state.draft = event.text;
  if (event.type === 'resume') {
    state.mode = state.resumeMode === 'ready' ? 'groupScan' : state.resumeMode;
    state.scanIndex = 0; state.cycleCount = 0; state.changedAt = event.now; state.pressed = null;
  }
  if (event.type === 'actionResult' && state.pendingAction?.actionId === event.actionId) {
    state.pendingAction = null;
    state.mode = event.result === 'unknown' ? 'recovering' : state.resumeMode;
    state.changedAt = event.now;
  }
  if (event.type === 'tick' && state.pressed === null && ['groupScan', 'itemScan', 'composing', 'confirming'].includes(state.mode)) {
    const dwell = state.intervalMs * (state.scanIndex === 0 ? 2 : 1);
    if (event.now - state.changedAt >= dwell && state.items.length > 0) {
      state.scanIndex = (state.scanIndex + 1) % state.items.length; state.changedAt = event.now;
      if (state.scanIndex === 0) state.cycleCount += 1;
      if (state.cycleCount >= 2) pause();
    }
  }
  if (event.type === 'keyDown' && event.code === 'Space' && event.trusted && !event.repeat && !event.isComposing && !event.modified
      && state.pressed === null && state.pendingAction === null && event.now - state.lastSelection >= state.protectionMs) {
    state.pressed = ['ready', 'paused', 'recovering'].includes(state.mode) ? '@resume' : state.mode === 'scrolling' ? '@stop' : state.items[state.scanIndex]?.id ?? null;
  }
  if (event.type === 'keyUp' && event.code === 'Space' && event.trusted && !event.isComposing && !event.modified && state.pressed !== null) {
    const selected = state.pressed; state.pressed = null; state.lastSelection = event.now; state.cycleCount = 0;
    if (selected === '@resume') {
      state.mode = state.resumeMode === 'ready' ? 'groupScan' : state.resumeMode;
      state.scanIndex = 0; state.changedAt = event.now;
    } else {
      const item = state.items.find((entry) => entry.id === selected);
      const action = selected === '@stop' ? { kind: 'scrollStop' as const } : !item?.disabled ? item?.action : undefined;
      if (action) {
        state.sequence += 1;
        const request: SwitchAction = { ...action, itemId: selected, actionId: `${String(state.modeGeneration)}:${String(state.sequence)}`, modeGeneration: state.modeGeneration };
        actions.push(request); state.pendingAction = request; state.resumeMode = state.mode;
        state.mode = 'executing';
      }
    }
  }
  return { state, actions };
}
