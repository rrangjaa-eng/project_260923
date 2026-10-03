import { afterEach, expect, it, vi } from 'vitest';
import { createSwitchRelay } from '../../src/worker/switch-relay';
import { createStorageWriter } from '../../src/worker/storage-writer';
afterEach(()=>vi.unstubAllGlobals());
async function fixture(){
 let stored:unknown={schemaVersion:1,data:{disabled:false,pins:[]}};let reply:()=>Promise<unknown>=()=>Promise.resolve({result:'done'});const checks:unknown[]=[];
 vi.stubGlobal('chrome',{runtime:{id:'extension'},storage:{onChanged:{addListener:()=>undefined,removeListener:()=>undefined},sync:{get:()=>Promise.resolve({'site:https://example.test':stored}),set:(value:Record<string,unknown>)=>{stored=value['site:https://example.test'];return Promise.resolve();}}},tabs:{onDetached:{addListener:()=>undefined},onRemoved:{addListener:()=>undefined},onUpdated:{addListener:()=>undefined},onActivated:{addListener:()=>undefined},get:()=>Promise.resolve({url:'https://example.test/page'}),sendMessage:(_id:number,message:{type:string})=>{if(message.type==='switch/action-check'){checks.push(message);return reply();}return Promise.resolve({result:'done'});}}});
 const relay=createSwitchRelay(createStorageWriter()),sender={id:'extension',frameId:0,url:'https://example.test/page',tab:{id:1}} as chrome.runtime.MessageSender;
 await relay.handle({type:'switch/report',documentGeneration:'doc',path:[],items:[]},sender);
 const message={type:'switch/pin/update',mutation:{number:1,expected:[],fingerprint:{id:'a',buttonText:'열기',domPath:'body/button',framePath:[]}},authorization:{documentGeneration:'doc',modeGeneration:1,pendingActionId:'save-pin'}};
 return {relay,sender,message,checks,value:()=>stored,reply:(next:()=>Promise<unknown>)=>{reply=next;}};
}
it('binds a pin change to the sender current origin, document and exact proposal',async()=>{
 const f=await fixture();expect(await f.relay.handle(f.message,f.sender)).toEqual({result:'done'});expect(f.checks).toHaveLength(2);expect(f.checks[1]).toMatchObject({pin:f.message.mutation});
});
it('late authorization after pause cannot write a pin',async()=>{
 const f=await fixture();let enter:()=>void=()=>undefined,release:()=>void=()=>undefined;const waiting=new Promise<void>(resolve=>{enter=resolve;});f.reply(()=>new Promise(resolve=>{release=()=> { resolve({result:'done'}); };enter();}));
 const pending=f.relay.handle(f.message,f.sender);await waiting;await f.relay.handle({type:'switch/pause'},f.sender);release();expect(await pending).toEqual({result:'refused'});expect(f.value()).toMatchObject({data:{pins:[]}});
});
it('rejects child frames and stale top document generations without a write',async()=>{
 const f=await fixture();expect(await f.relay.handle(f.message,{...f.sender,frameId:2})).toEqual({result:'refused'});expect(await f.relay.handle({...f.message,authorization:{...f.message.authorization,documentGeneration:'old'}},f.sender)).toEqual({result:'refused'});expect(f.value()).toMatchObject({data:{pins:[]}});
});
