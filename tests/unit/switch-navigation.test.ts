import { afterEach, expect, it, vi } from 'vitest';
import { createSwitchRelay } from '../../src/worker/switch-relay';
import { createStorageWriter } from '../../src/worker/storage-writer';
afterEach(() => vi.unstubAllGlobals());
function setup(hold: 'query' | 'ping' | 'pause' | 'none' = 'none') {
  let release: () => void = () => undefined;
  let entered: () => void = () => undefined;
  const waiting = new Promise<void>(resolve => { entered = resolve; });
  const effects: string[] = [];
  let removed:(id:number)=>void=()=>undefined;
  const delay = () => new Promise<void>(resolve => { release = resolve; entered(); });
  const tabs = [{ id: 1, url: 'https://practice.test/a' }, { id: 2, url: 'https://practice.test/b' }];
  vi.stubGlobal('chrome', {
    runtime: { id: 'extension' },
    storage: { session: { set: () => Promise.resolve() } },
    tabs: { onRemoved: { addListener: (listener:(id:number)=>void) => {removed=listener;} }, onUpdated: { addListener: () => undefined }, onActivated: { addListener: () => undefined },
      query: async () => { if (hold === 'query') await delay(); return tabs; },
      goBack: () => { effects.push('back'); return Promise.resolve(); },
      update: () => { effects.push('activate'); return Promise.resolve(); },
      sendMessage: async (_tab: number, message: { type: string }) => { if (hold === 'ping' && message.type === 'site/ping' || hold === 'pause' && _tab === 2 && message.type === 'switch/pause') await delay(); return { result: 'done' }; },
    },
  });
  const relay = createSwitchRelay(createStorageWriter());
  const sender = { id: 'extension', tab: { id: 1 }, frameId: 0 } as chrome.runtime.MessageSender;
  return { relay, sender, removed:()=>{removed(1);}, waiting, release: () => { release(); }, effects };
}
it('a back request waiting on tab query must not run after pause', async () => {
  const f = setup('query'); const request = f.relay.handle({ type: 'switch/navigation', kind: 'back' }, f.sender);
  await f.waiting; await f.relay.handle({ type: 'switch/pause' }, f.sender); f.release();
  expect(await request).toEqual({ result: 'refused' }); expect(f.effects).toEqual([]);
});
it('activation waiting on target ping must not run after cancel', async () => {
  const f = setup('ping'); const request = f.relay.handle({ type: 'switch/navigation', kind: 'activate', tabId: 2 }, f.sender);
  await f.waiting; await f.relay.handle({ type: 'switch/cancel-peers' }, f.sender); f.release();
  expect(await request).toEqual({ result: 'refused' }); expect(f.effects).toEqual([]);
});
it.each(['back', 'activate'] as const)('an uninterrupted %s request still runs once', async kind => {
  const f = setup(); expect(await f.relay.handle({ type: 'switch/navigation', kind, ...(kind === 'activate' ? { tabId: 2 } : {}) }, f.sender)).toEqual({ result: 'done' }); expect(f.effects).toEqual([kind]);
});

it('removing the source tab invalidates an activation waiting on target ping', async () => {
  const f = setup('ping'); const request = f.relay.handle({ type: 'switch/navigation', kind: 'activate', tabId: 2 }, f.sender);
  await f.waiting; f.removed(); f.release();
  expect(await request).toEqual({ result: 'refused' }); expect(f.effects).toEqual([]);
});
it('cancellation while waiting for target pause also prevents activation', async () => {
  const f = setup('pause'); const request = f.relay.handle({ type: 'switch/navigation', kind: 'activate', tabId: 2 }, f.sender);
  await f.waiting; await f.relay.handle({ type: 'switch/cancel-peers' }, f.sender); f.release();
  expect(await request).toEqual({ result: 'refused' }); expect(f.effects).toEqual([]);
});
