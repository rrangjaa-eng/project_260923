import { expect, it } from 'vitest';
import { SwitchMessage } from '../../src/shared/switch-messages';
const authorization = { documentGeneration: 'document', modeGeneration: 1, pendingActionId: 'pending' };
const valid = { type: 'switch/phrase/update', mutation: { kind: 'remove', expected: ['가'], index: 0 }, authorization };
it('accepts a strict explicit phrase mutation with current authorization', () => {
  expect(SwitchMessage.safeParse(valid).success).toBe(true);
});
it.each([{ ...valid, authorization: undefined }, { ...valid, authorization: { ...authorization, extra: 'x' } }, { ...valid, extra: 'x' }, { ...valid, mutation: { ...valid.mutation, extra: 'x' } }, { ...valid, mutation: { kind: 'remove', expected: ['가'], index: -1 } }, { ...valid, mutation: { kind: 'replace', expected: ['가'], index: 0, text: '' } }])('rejects an invalid phrase message %j', (message) => {
  expect(SwitchMessage.safeParse(message).success).toBe(false);
});
