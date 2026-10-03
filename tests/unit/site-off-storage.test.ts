import { afterEach, expect, it, vi } from 'vitest';
import { createStorageWriter } from '../../src/worker/storage-writer';
afterEach(()=>vi.unstubAllGlobals());
function fixture(original:unknown={schemaVersion:1,data:{disabled:false,pins:[]}}){
 const key='site:https://example.test';const data:Record<string,unknown>={[key]:original,other:{unchanged:true}};
 const listeners=new Set<(changes:Record<string,unknown>,area:string)=>void>();
 const set=vi.fn((items:Record<string,unknown>)=>{Object.assign(data,items);return Promise.resolve();});
 vi.stubGlobal('chrome',{storage:{onChanged:{addListener:(fn:(changes:Record<string,unknown>,area:string)=>void)=>listeners.add(fn),removeListener:(fn:(changes:Record<string,unknown>,area:string)=>void)=>listeners.delete(fn)},sync:{get:()=>Promise.resolve({...data}),set}}});
 return {writer:createStorageWriter(),data,set,key,external:(value:unknown)=>{data[key]=value;listeners.forEach(fn=>{fn({[key]:{newValue:value}},'sync');});}};
}
it('uses the same site setting and preserves pins and unrelated keys',async()=>{
 const original={schemaVersion:1,data:{disabled:false,pins:[{number:1,fingerprint:{id:'a',buttonText:'열기',domPath:'body/button',framePath:[]}}]}};
 const f=fixture(original);expect(await f.writer.setSiteDisabled('https://example.test',true,()=>Promise.resolve(true))).toEqual({ok:true});
 expect(f.data[f.key]).toEqual({...original,data:{...original.data,disabled:true}});expect(f.data.other).toEqual({unchanged:true});
});
it('revoked final authorization prevents a delayed write',async()=>{
 const f=fixture();let checks=0;
 expect(await f.writer.setSiteDisabled('https://example.test',true,()=>Promise.resolve(++checks===1))).toEqual({ok:false,reason:'superseded'});expect(f.set).not.toHaveBeenCalled();
});
it('external pin changes during final authorization are preserved',async()=>{
 const f=fixture();let checks=0;const external={schemaVersion:1,data:{disabled:false,pins:[]}};
 expect(await f.writer.setSiteDisabled('https://example.test',true,()=>{if(++checks===2)f.external(external);return Promise.resolve(true);})).toEqual({ok:false,reason:'superseded'});expect(f.set).not.toHaveBeenCalled();expect(f.data[f.key]).toEqual(external);
});
it.each([null,false,0,'',{broken:true}])('preserves malformed original %j',async original=>{
 const f=fixture(original);expect(await f.writer.setSiteDisabled('https://example.test',true,()=>Promise.resolve(true))).toEqual({ok:false,reason:'invalid-site'});expect(f.data[f.key]).toEqual(original);expect(f.set).not.toHaveBeenCalled();
});
it('lost write acknowledgement returns unknown and does not retry',async()=>{
 const f=fixture();f.set.mockRejectedValue(new Error('lost ack'));
 expect(await f.writer.setSiteDisabled('https://example.test',true,()=>Promise.resolve(true))).toEqual({ok:false,reason:'unknown'});expect(f.set).toHaveBeenCalledTimes(1);
});
it('shared quota waiting rechecks authorization before disabling',async()=>{
 vi.useFakeTimers();try{
  const f=fixture();for(let i=0;i<100;i++)expect(await f.writer.setSiteDisabled('https://example.test',false)).toEqual({ok:true});
  let approved=true;const pending=f.writer.setSiteDisabled('https://example.test',true,()=>Promise.resolve(approved));await vi.advanceTimersByTimeAsync(0);expect(f.set).toHaveBeenCalledTimes(100);
  approved=false;await vi.advanceTimersByTimeAsync(60001);expect(await pending).toEqual({ok:false,reason:'superseded'});expect(f.set).toHaveBeenCalledTimes(100);
 }finally{vi.useRealTimers();}
});
