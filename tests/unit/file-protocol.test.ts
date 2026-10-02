import { describe, expect, it } from 'vitest';
import { FileReplyGate, parseFileRequest, type FileContext } from '../../src/core/file-protocol';
const context: FileContext = { sessionId: 'session1', documentGeneration: 'doc1', modeGeneration: 1, handoffGeneration: 0 };
const request = (command = 'status') => ({ version: 1, ...context, requestId: 'r1', expiresAt: 10000, command, ...(['select-file', 'confirm-file'].includes(command) ? { fileToken: 'sample-text' } : {}) });
const reply = (command = 'status') => ({ version: 1, ...context, requestId: 'r1', command, result: 'done' });
describe('strict local fake file protocol', () => {
  it.each(['list-files', 'select-file', 'confirm-file', 'cancel', 'pause', 'resume', 'stop', 'status'])('accepts only the v1 %s contract', (command) => {
    const parsed = parseFileRequest(request(command), 1000, context); expect(parsed?.command).toBe(command);
  });
  it.each([
    { version: 2 }, { version: '1' }, { command: 'shell' }, { command: 'open-url' }, { path: '/tmp/file' }, { token: 'file' },
    { sessionId: '' }, { requestId: 'r'.repeat(65) }, { documentGeneration: '../doc' }, { modeGeneration: -1 }, { handoffGeneration: 1.2 },
    { expiresAt: Infinity }, { expiresAt: NaN }, { expiresAt: 1000 }, { expiresAt: 61001 }, { expiresAt: '10000' }, { confirmed: true },
  ])('rejects malformed or extra request fields %j', (patch) => {
    expect(parseFileRequest(request(), 1000, context)).not.toBeNull();
    expect(parseFileRequest({ ...request(), ...patch }, 1000, context)).toBeNull();
  });
  it.each(['../file', 'C:\\file.txt', 'https://host/file', '', 'x'.repeat(129)])('rejects paths and invalid opaque tokens %s', (fileToken) => {
    expect(parseFileRequest(request('select-file'), 1000, context)).not.toBeNull();
    expect(parseFileRequest({ ...request('select-file'), fileToken }, 1000, context)).toBeNull();
  });
  it('requires a token for selection and rejects tokens on other commands', () => {
    const missing = request('select-file'); delete missing.fileToken;
    expect(parseFileRequest(missing, 1000, context)).toBeNull();
    expect(parseFileRequest({ ...request(), fileToken: 'sample-text' }, 1000, context)).toBeNull();
  });
  it.each(['sessionId', 'documentGeneration', 'modeGeneration', 'handoffGeneration'] as const)('rejects a foreign %s, including stop', (field) => {
    const foreign = { ...context, [field]: field.endsWith('Generation') && field !== 'documentGeneration' ? 2 : 'other' };
    expect(parseFileRequest(request(), 1000, foreign)).toBeNull();
    expect(parseFileRequest(request('stop'), 1000, foreign)).toBeNull();
  });
  it('keeps current-context stop available after expiry', () => {
    expect(parseFileRequest({ ...request('stop'), expiresAt: 1 }, 1000, context)?.command).toBe('stop');
  });
});
describe('reply gate', () => {
  it('accepts one matching reply once and never reuses the same request id', () => {
    const gate = new FileReplyGate(context); expect(gate.arm(request(), 1000)).toBe(true);
    expect(gate.arm({ ...request(), requestId: 'r2' }, 1100)).toBe(false);
    expect(gate.take(reply(), 1200)?.result).toBe('done'); expect(gate.take(reply(), 1300)).toBeNull();
    expect(gate.arm(request(), 1400)).toBe(false);
  });
  it.each(['sessionId', 'documentGeneration', 'modeGeneration', 'handoffGeneration'] as const)('discards old replies after %s changes without consuming a new request', (field) => {
    const gate = new FileReplyGate(context); expect(gate.arm(request(), 1000)).toBe(true);
    const next = { ...context, [field]: field.endsWith('Generation') && field !== 'documentGeneration' ? 2 : 'other' };
    gate.changeContext(next); expect(gate.take(reply(), 1200)).toBeNull();
    expect(gate.arm({ ...request(), ...next, requestId: 'r2' }, 1300)).toBe(true);
    expect(gate.take(reply(), 1400)).toBeNull();
    expect(gate.take({ ...reply(), ...next, requestId: 'r2' }, 1500)?.result).toBe('done');
  });
  it('rejects malformed/mismatched replies and preserves the expected one', () => {
    const gate = new FileReplyGate(context); expect(gate.arm(request(), 1000)).toBe(true);
    for (const patch of [{ version: 2 }, { command: 'select-file' }, { requestId: 'r2' }, { path: '/tmp/file' }, { result: 'retry' }]) expect(gate.take({ ...reply(), ...patch }, 1200)).toBeNull();
    expect(gate.take(reply(), 1300)?.result).toBe('done');
  });
  it('clones caller identities and request fields before waiting', () => {
    const original = { ...context }; const payload = request(); const gate = new FileReplyGate(original);
    expect(gate.arm(payload, 1000)).toBe(true); original.sessionId = 'changed'; payload.requestId = 'changed';
    expect(gate.take(reply(), 1200)?.result).toBe('done');
  });
  it('expires to unknown without automatic rearming and discards late success', () => {
    const gate = new FileReplyGate(context); expect(gate.arm(request(), 1000)).toBe(true);
    expect(gate.expire(10000)).toBe(true); expect(gate.status).toBe('unknown');
    expect(gate.take(reply(), 10001)).toBeNull(); expect(gate.arm(request(), 10002)).toBe(false);
    expect(gate.arm({ ...request(), requestId: 'r2', expiresAt: 20000 }, 10003)).toBe(true);
  });
});

it('a current stop preempts a waiting reply even when its execute deadline expired', () => {
  const gate = new FileReplyGate(context); expect(gate.arm(request(), 1000)).toBe(true);
  expect(gate.arm({ ...request('stop'), requestId: 'stop1', expiresAt: 1 }, 1100)).toBe(true);
  expect(gate.take(reply(), 1200)).toBeNull();
  expect(gate.take({ ...reply('stop'), requestId: 'stop1' }, 1300)?.result).toBe('done');
});
