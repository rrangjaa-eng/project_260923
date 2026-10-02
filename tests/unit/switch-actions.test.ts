import { expect, it } from 'vitest';
import { createActionGate } from '../../src/core/switch-actions';

it('accepts once, rejects concurrent or stale actions and does not retry unknown results', () => {
  const gate = createActionGate('doc');
  expect(gate.accept('A', 'doc')).toBe(true);
  expect(gate.accept('B', 'doc')).toBe(false);
  gate.finish('A');
  expect(gate.accept('A', 'doc')).toBe(false);
  expect(gate.accept('C', 'old')).toBe(false);
  expect(gate.accept('B', 'doc')).toBe(true);
  gate.finish('B');
  expect(gate.accept('B', 'doc')).toBe(false);
});
