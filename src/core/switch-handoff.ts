import { reduceSwitch, type SwitchState, type SwitchEvent, type SwitchAction } from './switch-engine';
export type HandoffSurface = 'page' | 'practice';
export type HandoffKey = Extract<SwitchEvent, { type: 'keyDown' | 'keyUp' }>;
export type OwnedAction = SwitchAction & { surface: HandoffSurface; handoffGeneration: number };
export class SwitchHandoff {
  private active: HandoffSurface | null = 'page';
  private epoch = 0;
  private physicalDown = false;
  private awaitingRelease = false;
  private readonly states: Record<HandoffSurface, SwitchState>;
  get owner() { return this.active; }
  get generation() { return this.epoch; }
  constructor(states: Record<HandoffSurface, SwitchState>) {
    this.states = structuredClone(states);
    this.states.page.pressed = null; this.states.page.pendingAction = null;
    if (this.states.page.mode === 'executing') this.states.page.mode = 'paused';
    this.states.practice = reduceSwitch(this.states.practice, { type: 'pause', now: 0 }).state;
  }
  key(surface: HandoffSurface, event: HandoffKey): OwnedAction[] {
    if (event.code !== 'Space' || !event.trusted) return [];
    if (event.type === 'keyUp' && this.awaitingRelease) { this.awaitingRelease = false; this.physicalDown = false; return []; }
    if (surface !== this.active) return [];
    if (event.isComposing || event.modified) {
      if (this.physicalDown) this.pause(event.now);
      if (event.type === 'keyUp') { this.awaitingRelease = false; this.physicalDown = false; }
      return [];
    }
    if (this.awaitingRelease || event.repeat) return [];
    if (event.type === 'keyDown') { if (this.physicalDown) return []; this.physicalDown = true; }
    else {
      if (!this.physicalDown) return []; this.physicalDown = false;
      if (this.states[surface].pendingAction) { this.stop(event.now); return []; }
    }
    const result = reduceSwitch(this.states[surface], event); this.states[surface] = result.state;
    return result.actions.map((action) => ({ ...action, surface, handoffGeneration: this.epoch }));
  }
  transfer(owner: HandoffSurface, now: number): boolean {
    if (this.active === null || owner === this.active) return false;
    this.invalidate(now); this.active = owner; return true;
  }
  cancel(now: number) { if (this.active !== null) { this.invalidate(now); this.active = 'page'; } }
  pause(now: number) { if (this.active !== null) this.invalidate(now); }
  stop(now: number) { if (this.active !== null) { this.invalidate(now); this.active = null; } }
  tick(now: number) {
    const owner = this.active; if (!owner) return;
    const previous = this.states[owner].mode;
    this.states[owner] = reduceSwitch(this.states[owner], { type: 'tick', now }).state;
    if (previous !== 'paused' && this.states[owner].mode === 'paused') this.invalidate(now);
  }
  complete(action: OwnedAction, result: 'done' | 'refused' | 'unknown', now: number): boolean {
    if (action.surface !== this.active || action.handoffGeneration !== this.epoch) return false;
    const state = this.states[action.surface];
    if (state.pendingAction?.actionId !== action.actionId || state.modeGeneration !== action.modeGeneration) return false;
    this.states[action.surface] = reduceSwitch(state, { type: 'actionResult', actionId: action.actionId, result, now }).state; return true;
  }
  snapshot(surface: HandoffSurface): SwitchState { return structuredClone(this.states[surface]); }
  setDraft(surface: HandoffSurface, text: string): boolean {
    if (this.active === null || text.length > 4000) return false;
    this.states[surface] = reduceSwitch(this.states[surface], { type: 'compose', text, now: 0 }).state; return true;
  }
  private invalidate(now: number) {
    this.epoch++;
    this.awaitingRelease = this.awaitingRelease || this.physicalDown; this.physicalDown = false;
    for (const surface of ['page', 'practice'] as const) this.states[surface] = reduceSwitch(this.states[surface], { type: 'pause', now }).state;
  }
}
