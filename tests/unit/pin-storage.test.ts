import { afterEach, expect, it, vi } from 'vitest';
import { createStorageWriter } from '../../src/worker/storage-writer';
const fp={id:'a',buttonText:'열기',domPath:'body/button',framePath:[]};
const mutation={number:1,expected:[],fingerprint:fp};
afterEach(()=>vi.unstubAllGlobals());
function fixture(initial:unknown={schemaVersion:1,data:{disabled:false,pins:[]}}){
 let value=initial;const writes:unknown[]=[];const listeners=new Set<(changes:Record<string,unknown>,area:string)=>void>();
 vi.stubGlobal('chrome',{storage:{onChanged:{addListener:(listener:(changes:Record<string,unknown>,area:string)=>void)=>listeners.add(listener),removeListener:(listener:(changes:Record<string,unknown>,area:string)=>void)=>listeners.delete(listener)},sync:{get:()=>Promise.resolve({'site:https://example.test':value}),set:(data:Record<string,unknown>)=>{value=data['site:https://example.test'];writes.push(value);return Promise.resolve();}}}});
 return {writer:createStorageWriter(),writes,value:()=>value,external:(next:unknown)=>{value=next;listeners.forEach(listener=> { listener({'site:https://example.test':{newValue:next}},'sync'); });}};
}
it('explicit confirmed changes use the existing site setting and preserve disabled state',async()=>{
 const f=fixture();expect(await f.writer.changePins('https://example.test',mutation,()=>Promise.resolve(true))).toEqual({result:'done'});
 expect(f.value()).toEqual({schemaVersion:1,data:{disabled:false,pins:[{number:1,fingerprint:fp}]}});
 expect(await f.writer.changePins('https://example.test',{...mutation,expected:[{number:1,fingerprint:fp}],fingerprint:null},()=>Promise.resolve(true))).toEqual({result:'done'});
 expect(f.writes).toHaveLength(2);
});
it('revoked approval, concurrent settings change and malformed stored originals are not overwritten',async()=>{
 const f=fixture();expect(await f.writer.changePins('https://example.test',mutation,()=>Promise.resolve(false))).toEqual({result:'refused'});expect(f.writes).toEqual([]);
 expect(await f.writer.changePins('https://example.test',mutation,()=>{f.external({schemaVersion:1,data:{disabled:false,pins:[{number:9,fingerprint:fp}]}});return Promise.resolve(true);})).toEqual({result:'refused'});expect(f.writes).toEqual([]);
 f.external({broken:true});expect(await f.writer.changePins('https://example.test',mutation,()=>Promise.resolve(true))).toEqual({result:'refused'});expect(f.value()).toEqual({broken:true});
});
it('duplicate queued proposals cause only one storage write',async()=>{
 const f=fixture();const result=await Promise.all([f.writer.changePins('https://example.test',mutation,()=>Promise.resolve(true)),f.writer.changePins('https://example.test',mutation,()=>Promise.resolve(true))]);
 expect(result.map(r=>r.result)).toEqual(['done','refused']);expect(f.writes).toHaveLength(1);
});
it('write acknowledgement failure is unknown without retry',async()=>{
 const f=fixture();chrome.storage.sync.set=()=>Promise.reject(new Error('lost acknowledgement'));
 expect(await f.writer.changePins('https://example.test',mutation,()=>Promise.resolve(true))).toEqual({result:'unknown'});
});

it('preserves a sync change completed while final approval is pending',async()=>{
 const f=fixture();let checks=0;const external={schemaVersion:1,data:{disabled:false,pins:[{number:9,fingerprint:{...fp,id:'external'}}]}};
 expect(await f.writer.changePins('https://example.test',mutation,()=>{if(++checks===2)f.external(external);return Promise.resolve(true);})).toEqual({result:'refused'});expect(f.value()).toEqual(external);expect(f.writes).toEqual([]);
});
it('rechecks cancellation after waiting for the shared sync quota slot',async()=>{
 vi.useFakeTimers();try{
  const f=fixture();let expected:{number:number;fingerprint:typeof fp}[]=[];
  for(let i=0;i<100;i++){const fingerprint=i%2===0?fp:null;expect(await f.writer.changePins('https://example.test',{number:1,expected,fingerprint},()=>Promise.resolve(true))).toEqual({result:'done'});expected=fingerprint?[{number:1,fingerprint}]:[];}
  let approved=true;const pending=f.writer.changePins('https://example.test',mutation,()=>Promise.resolve(approved));await vi.advanceTimersByTimeAsync(0);expect(f.writes).toHaveLength(100);approved=false;await vi.advanceTimersByTimeAsync(60001);expect(await pending).toEqual({result:'refused'});expect(f.writes).toHaveLength(100);
 }finally{vi.useRealTimers();}
});
it('disabled sites and oversized proposals preserve the existing setting',async()=>{
 const disabled={schemaVersion:1,data:{disabled:true,pins:[]}};const f=fixture(disabled);expect(await f.writer.changePins('https://example.test',mutation,()=>Promise.resolve(true))).toEqual({result:'refused'});expect(f.value()).toEqual(disabled);f.external({schemaVersion:1,data:{disabled:false,pins:[]}});expect(await f.writer.changePins('https://example.test',{...mutation,fingerprint:{...fp,buttonText:'x'.repeat(1001)}},()=>Promise.resolve(true))).toEqual({result:'refused'});expect(f.writes).toEqual([]);
});
