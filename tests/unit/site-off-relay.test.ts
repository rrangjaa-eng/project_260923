import { afterEach, expect, it, vi } from 'vitest';
import { createSwitchRelay } from '../../src/worker/switch-relay';
import { createStorageWriter } from '../../src/worker/storage-writer';
afterEach(()=>vi.unstubAllGlobals());
async function fixture(){
 let stored:unknown={schemaVersion:1,data:{disabled:false,pins:[]}};let reply:()=>Promise<unknown>=()=>Promise.resolve({result:'done'});const checks:unknown[]=[];const pauses:unknown[]=[];
 vi.stubGlobal('chrome',{runtime:{id:'extension'},storage:{onChanged:{addListener:()=>undefined,removeListener:()=>undefined},sync:{get:()=>Promise.resolve({'site:https://example.test':stored}),set:(value:Record<string,unknown>)=>{stored=value['site:https://example.test'];return Promise.resolve();}}},tabs:{onDetached:{addListener:()=>undefined},onRemoved:{addListener:()=>undefined},onUpdated:{addListener:()=>undefined},onActivated:{addListener:()=>undefined},get:()=>Promise.resolve({url:'https://example.test/page'}),sendMessage:(_id:number,message:{type:string},options:{frameId:number})=>{if(message.type==='switch/pause')pauses.push(options);if(message.type==='switch/action-check'){checks.push(message);return reply();}return Promise.resolve({result:'done'});}}});
 const relay=createSwitchRelay(createStorageWriter()),sender={id:'extension',frameId:0,url:'https://example.test/page',tab:{id:1}} as chrome.runtime.MessageSender;
 await relay.handle({type:'switch/report',documentGeneration:'doc',path:[],items:[]},sender);
 const message={type:'switch/site-off',origin:'https://example.test',authorization:{documentGeneration:'doc',modeGeneration:1,pendingActionId:'save-pin'}};
 return {relay,sender,message,checks,pauses,value:()=>stored,reply:(next:()=>Promise<unknown>)=>{reply=next;}};
}
it('binds a site disable to the sender current origin, document and exact origin',async()=>{
 const f=await fixture();expect(await f.relay.handle(f.message,f.sender)).toEqual({result:'done'});expect(f.checks).toHaveLength(3);expect(f.checks[1]).toMatchObject({siteOff:f.message.origin});
});
it('late authorization after pause cannot disable a site',async()=>{
 const f=await fixture();let enter:()=>void=()=>undefined,release:()=>void=()=>undefined;const waiting=new Promise<void>(resolve=>{enter=resolve;});f.reply(()=>new Promise(resolve=>{release=()=> { resolve({result:'done'}); };enter();}));
 const pending=f.relay.handle(f.message,f.sender);await waiting;await f.relay.handle({type:'switch/pause'},f.sender);release();expect(await pending).toEqual({result:'refused'});expect(f.value()).toMatchObject({data:{pins:[]}});
});
it('rejects child frames and stale top document generations without a write',async()=>{
 const f=await fixture();expect(await f.relay.handle(f.message,{...f.sender,frameId:2})).toEqual({result:'refused'});expect(await f.relay.handle({...f.message,authorization:{...f.message.authorization,documentGeneration:'old'}},f.sender)).toEqual({result:'refused'});expect(f.value()).toMatchObject({data:{pins:[]}});
});

it('rejects wrong origin, a changed tab URL and duplicate requests',async()=>{
 const f=await fixture();expect(await f.relay.handle({...f.message,origin:'https://other.test'},f.sender)).toEqual({result:'refused'});
 expect(await f.relay.handle(f.message,f.sender)).toEqual({result:'done'});expect(await f.relay.handle(f.message,f.sender)).toEqual({result:'refused'});
 const next={...f.message,authorization:{...f.message.authorization,pendingActionId:'next'}};chrome.tabs.get=vi.fn().mockResolvedValue({url:'https://other.test/'});
 expect(await f.relay.handle(next,f.sender)).toEqual({result:'refused'});
});
it('a URL change during final authorization cannot disable the prior site',async()=>{
 const f=await fixture();let checks=0;f.reply(()=>{if(++checks===3)chrome.tabs.get=vi.fn().mockResolvedValue({url:'https://other.test/'});return Promise.resolve({result:'done'});});
 expect(await f.relay.handle(f.message,f.sender)).toEqual({result:'refused'});expect(f.value()).toMatchObject({data:{disabled:false}});
});

it('a stale site-off request cannot pause children or cancel a current action',async()=>{
 const f=await fixture();await f.relay.handle({type:'switch/report',documentGeneration:'child',path:[0],items:[]},{...f.sender,frameId:2});f.reply(()=>Promise.resolve({result:'refused'}));
 expect(await f.relay.handle(f.message,f.sender)).toEqual({result:'refused'});expect(f.pauses).toEqual([]);
});
