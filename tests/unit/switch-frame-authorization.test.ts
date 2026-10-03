import {afterEach,expect,it,vi} from 'vitest';
import {createSwitchRelay} from '../../src/worker/switch-relay';
import type {StorageWriter} from '../../src/worker/storage-writer';
afterEach(()=>{vi.unstubAllGlobals();});
async function setup(holdAt:'top'|'first-visibility'|'last-visibility'='top'){
 let visible=true,hold=false,release=()=>{},markWaiting=()=>{};const waiting=new Promise<void>(resolve=>{markWaiting=resolve;});const checks:number[]=[];const sent:{message:unknown;frameId:number|undefined}[]=[];
 vi.stubGlobal('chrome',{runtime:{id:'extension'},tabs:{onDetached:{addListener:()=>undefined},onRemoved:{addListener:()=>{}},onUpdated:{addListener:()=>{}},onActivated:{addListener:()=>{}},sendMessage:async(_tabId:number,message:{type:string},options?:{frameId:number})=>{
  sent.push({message,frameId:options?.frameId});
  if(message.type==='switch/frame-check'){checks.push(options?.frameId??-1);const reply={result:visible?'done':'refused'};if(hold&&(holdAt==='first-visibility'&&checks.length===1||holdAt==='last-visibility'&&checks.length===2)){markWaiting();await new Promise<void>(resolve=>{release=resolve;});}return reply;}
  if(message.type==='switch/action-check'){if(hold&&holdAt==='top'){markWaiting();await new Promise<void>(resolve=>{release=resolve;});}return {result:'done'};}
  return {result:'done'};
 }}});
 const relay=createSwitchRelay({} as StorageWriter);const parent={id:'extension',tab:{id:1},frameId:0};const child={...parent,frameId:1};
 await relay.handle({type:'switch/report',documentGeneration:'top',path:[],items:[]},parent);await relay.handle({type:'switch/report',documentGeneration:'child',path:[0],items:[]},child);
 const message={type:'switch/action-check',authorization:{documentGeneration:'top',modeGeneration:1,pendingActionId:'apply'}};
 return {relay,parent,child,message,checks,sent,hide:()=>{visible=false;},hold:()=>{hold=true;},waiting,release:()=>{release();}};
}
it('refuses child final approval when its current parent is not visible',async()=>{
 const f=await setup();f.hide();expect(await f.relay.handle(f.message,f.child)).toEqual({result:'refused'});
});
it('rechecks child visibility after a delayed top authorization reply',async()=>{
 const f=await setup();f.hold();const pending=f.relay.handle(f.message,f.child);await f.waiting;f.hide();f.release();expect(await pending).toEqual({result:'refused'});
});
it('refuses child approval after cancellation while the prior top reply was in flight',async()=>{
 const f=await setup();f.hold();const pending=f.relay.handle(f.message,f.child);await f.waiting;await f.relay.handle({type:'switch/cancel-peers'},f.parent);f.release();expect(await pending).toEqual({result:'refused'});
});
it('refuses an unreported child or replaced child document',async()=>{
 const f=await setup();expect(await f.relay.handle(f.message,{...f.child,frameId:2})).toEqual({result:'refused'});f.hold();const pending=f.relay.handle(f.message,f.child);await f.waiting;await f.relay.handle({type:'switch/report',documentGeneration:'replacement',path:[0],items:[]},f.child);f.release();expect(await pending).toEqual({result:'refused'});
});
it('allows a current visible child and preserves top-frame approval behavior',async()=>{
 const f=await setup();expect(await f.relay.handle(f.message,f.child)).toEqual({result:'done'});f.hide();expect(await f.relay.handle(f.message,f.parent)).toEqual({result:'done'});
});

it('allows same-document reports refreshed while the top reply is in flight',async()=>{
 const f=await setup();f.hold();const pending=f.relay.handle(f.message,f.child);await f.waiting;await f.relay.handle({type:'switch/report',documentGeneration:'child',path:[0],items:[]},f.child);await f.relay.handle({type:'switch/report',documentGeneration:'top',path:[],items:[]},f.parent);f.release();expect(await pending).toEqual({result:'done'});
});
it('refuses a replaced top document even if its old approval arrives later',async()=>{
 const f=await setup();f.hold();const pending=f.relay.handle(f.message,f.child);await f.waiting;await f.relay.handle({type:'switch/report',documentGeneration:'new-top',path:[],items:[]},f.parent);f.release();expect(await pending).toEqual({result:'refused'});
});

it.each(['first-visibility','last-visibility'] as const)('allows same-document report refresh during %s',async boundary=>{
 const f=await setup(boundary);f.hold();const pending=f.relay.handle(f.message,f.child);await f.waiting;await f.relay.handle({type:'switch/report',documentGeneration:'child',path:[0],items:[]},f.child);f.release();expect(await pending).toEqual({result:'done'});
});
it.each(['cancel','child','parent'] as const)('refuses %s change while the final visibility reply is in flight',async change=>{
 const f=await setup('last-visibility');f.hold();const pending=f.relay.handle(f.message,f.child);await f.waiting;
 if(change==='cancel')await f.relay.handle({type:'switch/cancel-peers'},f.parent);
 else await f.relay.handle({type:'switch/report',documentGeneration:'replaced',path:change==='child'?[0]:[],items:[]},change==='child'?f.child:f.parent);
 f.release();expect(await pending).toEqual({result:'refused'});
});

it.each([false,true])('keeps the refresh notification but marks an identical child report unchanged (hasItems=%s)',async hasItems=>{
 const f=await setup();const items=hasItems?[{itemId:'field',label:'문장',kind:'input',danger:false,editable:true,sensitive:false,identity:'same-identity'}]:[];
 await f.relay.handle({type:'switch/report',documentGeneration:'child',path:[0],items},f.child);f.sent.length=0;
 await f.relay.handle({type:'switch/report',documentGeneration:'child',path:[0],items:structuredClone(items)},f.child);
 expect(f.sent).toEqual([{message:{type:'switch/refresh',changed:false},frameId:0}]);
});
it.each(['items','document','path'] as const)('marks a real child %s change in the top refresh notification',async change=>{
 const f=await setup();f.sent.length=0;
 const item={itemId:'returned-field',label:'문장',kind:'input',danger:false,editable:true,sensitive:false,identity:'returned-identity'};
 await f.relay.handle({type:'switch/report',documentGeneration:change==='document'?'new-child':'child',path:change==='path'?[1]:[0],items:change==='items'?[item]:[]},f.child);
 expect(f.sent).toContainEqual({message:{type:'switch/refresh',changed:true},frameId:0});
});
it('rejects a forged reporter without a refresh or alteration of the current child report',async()=>{
 const f=await setup();f.sent.length=0;
 expect(await f.relay.handle({type:'switch/report',documentGeneration:'forged',path:[0],items:[]},{...f.child,id:'other-extension'})).toBeUndefined();
 expect(f.sent).toEqual([]);
 const list=await f.relay.handle({type:'switch/list'},f.parent);
 expect(list).toEqual({tabId:1,frames:[{frameId:0,documentGeneration:'top',path:[],items:[]},{frameId:1,documentGeneration:'child',path:[0],items:[]}]});
});
