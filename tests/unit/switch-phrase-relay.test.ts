import { afterEach, expect, it, vi } from 'vitest';
import { createSwitchRelay } from '../../src/worker/switch-relay';
import { createStorageWriter } from '../../src/worker/storage-writer';
afterEach(() => vi.unstubAllGlobals());
it.each(['switch/cancel-peers', 'switch/pause'])('a late final authorization reply after %s cannot change saved phrases', async (type) => {
  let checks = 0;
  let release: () => void = () => undefined;
  let entered: () => void = () => undefined;
  const waiting = new Promise<void>((resolve) => { entered = resolve; });
  let phrases = ['가'];
  vi.stubGlobal('chrome', {
    runtime: { id: 'extension' },
    storage: { local: { get: () => Promise.resolve({ switchPhrases: phrases }), set: (value: { switchPhrases: string[] }) => { phrases = value.switchPhrases; return Promise.resolve(); } } },
    tabs: { onRemoved: { addListener: () => undefined }, onUpdated: { addListener: () => undefined }, onActivated: { addListener: () => undefined },
      sendMessage: (_tab: number, message: { type: string }) => {
        if (message.type !== 'switch/action-check') return Promise.resolve({ result: 'done' });
        if (++checks === 1) return Promise.resolve({ result: 'done' });
        return new Promise((resolve) => { release = () => { resolve({ result: 'done' }); }; entered(); });
      } },
  });
  const relay = createSwitchRelay(createStorageWriter());
  const sender = { id: 'extension', tab: { id: 1 }, frameId: 0 } as chrome.runtime.MessageSender;
  await relay.handle({ type: 'switch/report', documentGeneration: 'document', path: [], items: [] }, sender);
  const update = relay.handle({ type: 'switch/phrase/update', mutation: { kind: 'remove', expected: ['가'], index: 0 }, authorization: { documentGeneration: 'document', modeGeneration: 1, pendingActionId: 'pending' } }, sender);
  await waiting; await relay.handle({ type }, sender); release();
  expect(await update).toEqual({ ok: false }); expect(phrases).toEqual(['가']);
});
