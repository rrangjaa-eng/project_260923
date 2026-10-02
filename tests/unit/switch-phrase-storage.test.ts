import { afterEach, expect, it, vi } from 'vitest';
import { createStorageWriter } from '../../src/worker/storage-writer';
afterEach(() => vi.unstubAllGlobals());
function fixture(initial: unknown) {
  let value = initial;
  const writes: unknown[] = [];
  vi.stubGlobal('chrome', { storage: { local: {
    get: () => Promise.resolve({ switchPhrases: value }),
    set: (data: { switchPhrases: unknown }) => { writes.push(data.switchPhrases); value = data.switchPhrases; return Promise.resolve(); },
  } } });
  return { writer: createStorageWriter(), writes, value: () => value };
}
it('explicit replacement preserves order and removal affects only the selected snapshot', async () => {
  const f = fixture(['가', '나']);
  expect(await f.writer.changeSwitchPhrases({ kind: 'replace', expected: ['가', '나'], index: 0, text: '새 문구' }, () => Promise.resolve(true))).toEqual({ ok: true });
  expect(f.value()).toEqual(['새 문구', '나']);
  expect(await f.writer.changeSwitchPhrases({ kind: 'remove', expected: ['새 문구', '나'], index: 1 }, () => Promise.resolve(true))).toEqual({ ok: true });
  expect(f.value()).toEqual(['새 문구']);
});
it('a changed list or revoked current approval performs no write', async () => {
  const f = fixture(['가', '나']);
  expect((await f.writer.changeSwitchPhrases({ kind: 'remove', expected: ['나', '가'], index: 0 }, () => Promise.resolve(true))).ok).toBe(false);
  expect((await f.writer.changeSwitchPhrases({ kind: 'remove', expected: ['가', '나'], index: 0 }, () => Promise.resolve(false))).ok).toBe(false);
  expect(f.writes).toEqual([]); expect(f.value()).toEqual(['가', '나']);
});
it('serialized mutations cannot overwrite a previous accepted change', async () => {
  const f = fixture(['가', '나']);
  const [first, second] = await Promise.all([
    f.writer.changeSwitchPhrases({ kind: 'replace', expected: ['가', '나'], index: 0, text: '새 문구' }, () => Promise.resolve(true)),
    f.writer.changeSwitchPhrases({ kind: 'remove', expected: ['가', '나'], index: 1 }, () => Promise.resolve(true)),
  ]);
  expect(first.ok).toBe(true); expect(second.ok).toBe(false); expect(f.value()).toEqual(['새 문구', '나']); expect(f.writes).toHaveLength(1);
});
it('an external list change while checking approval is preserved', async () => {
  const f = fixture(['가', '나']);
  const result = await f.writer.changeSwitchPhrases({ kind: 'remove', expected: ['가', '나'], index: 0 }, async () => {
    await chrome.storage.local.set({ switchPhrases: ['다른 문구', '나'] }); return true;
  });
  expect(result.ok).toBe(false); expect(f.value()).toEqual(['다른 문구', '나']); expect(f.writes).toHaveLength(1);
});
it('approval revoked during the final storage read blocks the commit', async () => {
  const f = fixture(['가']); let reads = 0, approved = true;
  chrome.storage.local.get = () => { if (++reads === 2) approved = false; return Promise.resolve({ switchPhrases: ['가'] }); };
  expect((await f.writer.changeSwitchPhrases({ kind: 'remove', expected: ['가'], index: 0 }, () => Promise.resolve(approved))).ok).toBe(false);
  expect(f.writes).toEqual([]);
});
it.each([null, ['가', 3], [''], ['가'.repeat(1001)], Array.from({ length: 21 }, () => '가')])('preserves malformed stored data %j', async (stored) => {
  const f = fixture(stored);
  expect((await f.writer.changeSwitchPhrases({ kind: 'add', text: '새 문구' }, () => Promise.resolve(true))).ok).toBe(false);
  expect(f.value()).toEqual(stored); expect(f.writes).toEqual([]);
});
it('new saves share the queue and duplicate saves preserve all twenty phrases', async () => {
  const initial = Array.from({ length: 20 }, (_, i) => `문구${String(i)}`); const f = fixture(initial);
  expect((await f.writer.changeSwitchPhrases({ kind: 'add', text: '문구0' }, () => Promise.resolve(true))).ok).toBe(true);
  expect(f.value()).toEqual(initial);
  await f.writer.changeSwitchPhrases({ kind: 'add', text: '새 문구' }, () => Promise.resolve(true));
  expect(f.value()).toEqual([...initial.slice(1), '새 문구']);
});
it('invalid payloads and a duplicate replacement do not mutate storage', async () => {
  const f = fixture(['가', '나']);
  for (const mutation of [{ kind: 'remove', expected: ['가', '나'], index: 2 }, { kind: 'replace', expected: ['가', '나'], index: 0, text: '나' }, { kind: 'remove', expected: ['가', '나'], index: 0, extra: 'x' }]) {
    expect((await f.writer.changeSwitchPhrases(mutation, () => Promise.resolve(true))).ok).toBe(false);
  }
  expect(f.writes).toEqual([]);
});
