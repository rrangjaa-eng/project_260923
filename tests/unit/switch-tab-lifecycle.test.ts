import {afterEach,expect,it,vi} from 'vitest';
import {createSwitchRelay} from '../../src/worker/switch-relay';
import {createStorageWriter} from '../../src/worker/storage-writer';
afterEach(()=>vi.unstubAllGlobals());
const authorization={documentGeneration:'source',modeGeneration:1,pendingActionId:'a'};
async function fixture(){
 const tabs=[{id:1,windowId:10,index:0,active:true,url:'https://practice.test/a',title:'현재'},{id:2,windowId:10,index:1,active:false,url:'https://practice.test/b',title:'돌아갈 곳'},{id:3,windowId:20,index:0,active:true,url:'https://other.test/c',title:'다른 창'}];
 const effects:string[]=[];let allow=true,fail=false;let moved:(id:number)=>void=()=>{};
 let hold: (()=>Promise<void>)|undefined;
 vi.stubGlobal('chrome',{runtime:{id:'extension',getURL:(p:string)=>`chrome-extension://extension/${p}`},storage:{session:{set:()=>Promise.resolve()}},tabs:{onDetached:{addListener:(f:(id:number)=>void)=>{moved=f;}},onRemoved:{addListener:()=>undefined},onUpdated:{addListener:()=>undefined},onActivated:{addListener:()=>undefined},query:async()=>{await hold?.();return structuredClone(tabs);},get:(id:number)=>Promise.resolve(structuredClone(tabs.find(t=>t.id===id))),sendMessage:()=>Promise.resolve({result:allow?'done':'refused',ok:true}),reload:(id:number)=>{effects.push(`reload:${String(id)}`);return fail?Promise.reject(Error('lost')):Promise.resolve();},remove:(id:number)=>{effects.push(`close:${String(id)}`);return fail?Promise.reject(Error('lost')):Promise.resolve();},update:(id:number)=>{effects.push(`activate:${String(id)}`);return Promise.resolve();}}});
 const relay=createSwitchRelay(createStorageWriter());
 const sender={id:'extension',tab:{id:1},frameId:0} as chrome.runtime.MessageSender;
 await relay.handle({type:'switch/report',documentGeneration:'source',path:[],items:[]},sender);
 await relay.handle({type:'switch/report',documentGeneration:'return-doc',path:[],items:[]},{...sender,tab:{id:2}});
 let n=0;
 const send=(kind:string,extra:Record<string,unknown>={})=>relay.handle({type:'switch/navigation',authorization:{...authorization,pendingActionId:`a${String(++n)}`},kind,...extra},sender);
 return {moved:(id:number)=>{moved(id);},relay,sender,tabs,effects,send,deny:()=>{allow=false;},fail:()=>{fail=true;},hold:(fn:()=>Promise<void>)=>{hold=fn;}};
}
it('reload is a single authorized effect and rejects replay',async()=>{
 const f=await fixture();const m={type:'switch/navigation',kind:'reload',authorization};
 expect(await f.relay.handle(m,f.sender)).toEqual({result:'done'});expect(await f.relay.handle(m,f.sender)).toEqual({result:'refused'});expect(f.effects).toEqual(['reload:1']);
});
it('reload does nothing when the controller refuses dirty or pending state',async()=>{const f=await fixture();f.deny();expect(await f.send('reload')).toEqual({result:'refused'});expect(f.effects).toEqual([]);});
it('an uncertain reload result is unknown and never retried',async()=>{const f=await fixture();f.fail();expect(await f.send('reload')).toEqual({result:'unknown'});expect(f.effects).toEqual(['reload:1']);});
it('close preview identifies a same-window return tab without effects, then closes once',async()=>{
 const f=await fixture();const p=await f.send('close-preview') as {result:string;token:string;title:string};expect(p).toMatchObject({result:'done',title:'돌아갈 곳'});expect(f.effects).toEqual([]);
 expect(await f.send('close',{token:p.token})).toEqual({result:'done'});expect(f.effects).toEqual(['close:1','activate:2']);
 expect(await f.send('close',{token:p.token})).toEqual({result:'refused'});
});
it('last tab in its window is never closed even with another window',async()=>{const f=await fixture();f.tabs.splice(1,1);expect(await f.send('close-preview')).toEqual({result:'refused',reason:'last-tab'});expect(f.effects).toEqual([]);});
it.each(['url','window','missing','document'] as const)('changed %s return target refuses a previewed close',async kind=>{
 const f=await fixture();const p=await f.send('close-preview') as {token:string};
 if(kind==='url'&&f.tabs[1])f.tabs[1].url='https://practice.test/new';if(kind==='window'&&f.tabs[1])f.tabs[1].windowId=20;if(kind==='missing')f.tabs.splice(1,1);
 if(kind==='document')await f.relay.handle({type:'switch/report',documentGeneration:'new-doc',path:[],items:[]},{...f.sender,tab:{id:2}});
 expect(await f.send('close',{token:p.token})).toMatchObject({result:'refused'});expect(f.effects).toEqual([]);
});
it('unsupported-only sibling tab does not permit a close',async()=>{const f=await fixture();Object.assign(f.tabs[1]??{}, {url:'chrome://settings/'});expect(await f.send('close-preview')).toEqual({result:'refused',reason:'no-return-tab'});expect(f.effects).toEqual([]);});
it('cancellation during query prevents reload',async()=>{
 const f=await fixture();let release:()=>void=()=>undefined;let entered:()=>void=()=>undefined;const waiting=new Promise<void>(r=>{entered=r;});f.hold(()=>new Promise<void>(r=>{release=r;entered();}));const task=f.send('reload');await waiting;await f.relay.handle({type:'switch/cancel-peers'},f.sender);release();expect(await task).toEqual({result:'refused'});expect(f.effects).toEqual([]);
});
it('new tab opens only the helper page in the source window and consumes one action',async()=>{
 const f=await fixture();const create=vi.fn(()=>Promise.resolve({id:4}));Object.assign(chrome.tabs,{create});const m={type:'switch/navigation',kind:'new',authorization};expect(await f.relay.handle(m,f.sender)).toEqual({result:'done'});expect(create).toHaveBeenCalledWith({windowId:10,url:'chrome-extension://extension/start.html',active:true});expect(await f.relay.handle(m,f.sender)).toEqual({result:'refused'});expect(create).toHaveBeenCalledTimes(1);
});
it.each(['unknown','refused'])('unconfirmed return-tab pause %s never closes source',async result=>{
 const f=await fixture();const p=await f.send('close-preview') as {token:string};const send=chrome.tabs.sendMessage;chrome.tabs.sendMessage=(id,m,options)=>id===2?Promise.resolve({result}):send(id,m,options);expect(await f.send('close',{token:p.token})).toEqual({result:'refused'});expect(f.effects).toEqual([]);
});

it('moving the return tab while final approval is delayed never closes the last source-window tab',async()=>{
 const f=await fixture();const p=await f.send('close-preview') as {token:string};let calls=0;let release:()=>void=()=>{},entered:()=>void=()=>{};const waiting=new Promise<void>(r=>{entered=r;});const send=chrome.tabs.sendMessage;
 chrome.tabs.sendMessage=async(id,m,options)=>{const result=await send(id,m,options);if(id===1&&typeof m==='object'&&m!==null&&'type' in m&&m.type==='switch/action-check'&&++calls===4){entered();await new Promise<void>(r=>{release=r;});}return result;};
 const close=f.send('close',{token:p.token});await waiting;f.moved(2);if(f.tabs[1])f.tabs[1].windowId=20;release();expect(await close).toEqual({result:'refused'});expect(f.effects).toEqual([]);
});
