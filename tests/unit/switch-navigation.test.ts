import { afterEach, expect, it, vi } from 'vitest';
import { createSwitchRelay } from '../../src/worker/switch-relay';
import { createStorageWriter } from '../../src/worker/storage-writer';
afterEach(() => vi.unstubAllGlobals());
const authorization={documentGeneration:'doc',modeGeneration:1,pendingActionId:'nav-1'};
async function setup(hold: 'query' | 'ping' | 'pause' | 'authorization' | 'final-authorization' | 'none' = 'none') {
  let release: () => void = () => undefined;
  let entered: () => void = () => undefined;
  const waiting = new Promise<void>(resolve => { entered = resolve; });
  const effects: string[] = [];
  let allowed=true;let rejectHistory=false;
  const checks: unknown[]=[];
  let removed:(id:number)=>void=()=>undefined;
  const delay = () => new Promise<void>(resolve => { release = resolve; entered(); });
  const tabs = [{ id: 1, url: 'https://practice.test/a' }, { id: 2, url: 'https://practice.test/b' }];
  vi.stubGlobal('chrome', {
    runtime: { id: 'extension' },
    storage: { session: { set: () => Promise.resolve() } },
    tabs: { onRemoved: { addListener: (listener:(id:number)=>void) => {removed=listener;} }, onUpdated: { addListener: () => undefined }, onActivated: { addListener: () => undefined },
      query: async () => { if (hold === 'query') await delay(); return tabs; },
      goBack: () => { if(rejectHistory)return Promise.reject(new Error('Cannot go back'));effects.push('back'); return Promise.resolve(); },
      goForward: () => { if(rejectHistory)return Promise.reject(new Error('Cannot go forward'));effects.push('forward'); return Promise.resolve(); },
      update: () => { effects.push('activate'); return Promise.resolve(); },
      sendMessage: async (_tab: number, message: { type: string }) => { if(message.type==='switch/action-check'){checks.push(message);const result=allowed?'done':'refused';if(hold==='authorization'&&checks.length===1||hold==='final-authorization'&&checks.length===2)await delay();return {result};}if (hold === 'ping' && message.type === 'site/ping' || hold === 'pause' && _tab === 2 && message.type === 'switch/pause') await delay(); return { result: 'done' }; },
    },
  });
  const relay = createSwitchRelay(createStorageWriter());
  const sender = { id: 'extension', tab: { id: 1 }, frameId: 0 } as chrome.runtime.MessageSender;
  await relay.handle({type:'switch/report',documentGeneration:'doc',path:[],items:[]},sender);
  return { relay, sender, checks, deny:()=>{allowed=false;}, noHistory:()=>{rejectHistory=true;}, removed:()=>{removed(1);}, waiting, release: () => { release(); }, effects };
}
it('a back request waiting on tab query must not run after pause', async () => {
  const f = await setup('query'); const request = f.relay.handle({ type: 'switch/navigation', authorization, kind: 'back' }, f.sender);
  await f.waiting; await f.relay.handle({ type: 'switch/pause' }, f.sender); f.release();
  expect(await request).toEqual({ result: 'refused' }); expect(f.effects).toEqual([]);
});
it('activation waiting on target ping must not run after cancel', async () => {
  const f = await setup('ping'); const request = f.relay.handle({ type: 'switch/navigation', authorization, kind: 'activate', tabId: 2 }, f.sender);
  await f.waiting; await f.relay.handle({ type: 'switch/cancel-peers' }, f.sender); f.release();
  expect(await request).toEqual({ result: 'refused' }); expect(f.effects).toEqual([]);
});
it.each(['back', 'activate'] as const)('an uninterrupted %s request still runs once', async kind => {
  const f = await setup(); expect(await f.relay.handle({ type: 'switch/navigation', authorization, kind, ...(kind === 'activate' ? { tabId: 2 } : {}) }, f.sender)).toEqual({ result: 'done' }); expect(f.effects).toEqual([kind]);
});

it('removing the source tab invalidates an activation waiting on target ping', async () => {
  const f = await setup('ping'); const request = f.relay.handle({ type: 'switch/navigation', authorization, kind: 'activate', tabId: 2 }, f.sender);
  await f.waiting; f.removed(); f.release();
  expect(await request).toEqual({ result: 'refused' }); expect(f.effects).toEqual([]);
});
it('cancellation while waiting for target pause also prevents activation', async () => {
  const f = await setup('pause'); const request = f.relay.handle({ type: 'switch/navigation', authorization, kind: 'activate', tabId: 2 }, f.sender);
  await f.waiting; await f.relay.handle({ type: 'switch/cancel-peers' }, f.sender); f.release();
  expect(await request).toEqual({ result: 'refused' }); expect(f.effects).toEqual([]);
});

it('forward navigation runs once with the same authorization boundary',async()=>{
 const f=await setup();expect(await f.relay.handle({type:'switch/navigation',authorization,kind:'forward'},f.sender)).toEqual({result:'done'});expect(f.effects).toEqual(['forward']);expect(f.checks).toContainEqual({type:'switch/action-check',authorization,navigation:{kind:'forward'}});
});
it('an old request rejected before worker acceptance never navigates',async()=>{
 const f=await setup();f.deny();expect(await f.relay.handle({type:'switch/navigation',authorization,kind:'back'},f.sender)).toEqual({result:'refused'});expect(f.effects).toEqual([]);
});
it('a request for a replaced source document never navigates',async()=>{
 const f=await setup();expect(await f.relay.handle({type:'switch/navigation',authorization:{...authorization,documentGeneration:'old'},kind:'back'},f.sender)).toEqual({result:'refused'});expect(f.effects).toEqual([]);
});
it.each(['back','forward'] as const)('unavailable %s history returns a refusal without retry',async kind=>{
 const f=await setup();f.noHistory();expect(await f.relay.handle({type:'switch/navigation',authorization,kind},f.sender)).toEqual({result:'refused',reason:'unavailable'});expect(f.effects).toEqual([]);
});
it('duplicate concurrent navigation requests consume one action only',async()=>{
 const f=await setup();const message={type:'switch/navigation',authorization,kind:'forward'};
 const results=await Promise.all([f.relay.handle(message,f.sender),f.relay.handle(message,f.sender)]);
 expect(f.effects).toEqual(['forward']);expect(results).toContainEqual({result:'refused'});
});
it('a completed navigation authorization cannot be replayed',async()=>{
 const f=await setup();const message={type:'switch/navigation',authorization,kind:'back'};
 await f.relay.handle(message,f.sender);expect(await f.relay.handle(message,f.sender)).toEqual({result:'refused'});expect(f.effects).toEqual(['back']);
});
it('an unchanged document report refresh does not cancel the current navigation',async()=>{
 const f=await setup('query');const task=f.relay.handle({type:'switch/navigation',authorization,kind:'back'},f.sender);await f.waiting;
 await f.relay.handle({type:'switch/report',documentGeneration:'doc',path:[],items:[]},f.sender);f.release();expect(await task).toEqual({result:'done'});expect(f.effects).toEqual(['back']);
});

it('a replacement document report during query still refuses navigation',async()=>{
 const f=await setup('query');const task=f.relay.handle({type:'switch/navigation',authorization,kind:'back'},f.sender);await f.waiting;
 await f.relay.handle({type:'switch/report',documentGeneration:'new-doc',path:[],items:[]},f.sender);f.release();expect(await task).toEqual({result:'refused'});expect(f.effects).toEqual([]);
});
it.each(['authorization','final-authorization'] as const)('pause while a previously approved %s reply is delayed prevents navigation',async hold=>{
 const f=await setup(hold);const task=f.relay.handle({type:'switch/navigation',authorization,kind:'back'},f.sender);await f.waiting;
 await f.relay.handle({type:'switch/cancel-peers'},f.sender);f.release();expect(await task).toEqual({result:'refused'});expect(f.effects).toEqual([]);
});
it('a new action is allowed after a consumed action without permitting the old replay',async()=>{
 const f=await setup();await f.relay.handle({type:'switch/navigation',authorization,kind:'back'},f.sender);
 expect(await f.relay.handle({type:'switch/navigation',authorization:{...authorization,pendingActionId:'nav-2'},kind:'forward'},f.sender)).toEqual({result:'done'});
 expect(await f.relay.handle({type:'switch/navigation',authorization,kind:'back'},f.sender)).toEqual({result:'refused'});expect(f.effects).toEqual(['back','forward']);
});
it('navigation without authorization or from a child frame has no browser effect',async()=>{
 const f=await setup();expect(await f.relay.handle({type:'switch/navigation',kind:'back'},f.sender)).toBeUndefined();
 expect(await f.relay.handle({type:'switch/navigation',authorization,kind:'forward'},{...f.sender,frameId:1})).toEqual({result:'refused'});expect(f.effects).toEqual([]);
});
