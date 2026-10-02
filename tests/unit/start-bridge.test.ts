import {afterEach,expect,it,vi} from 'vitest';
import {createStartBridge} from '../../src/worker/start-bridge';
import {createPortRpc} from '../../src/shared/port-rpc';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
function pair(sender:chrome.runtime.MessageSender){
 function endpoint(){const messages:((v:unknown)=>void)[]=[],closed:(()=>void)[]=[];return {name:'switch-start',sender,onMessage:{addListener:(f:(v:unknown)=>void)=>{messages.push(f);}},onDisconnect:{addListener:(f:()=>void)=>{closed.push(f);}},postMessage:(v:unknown):unknown=>v,disconnect:()=>{},messages,closed};}
 const a=endpoint(),b=endpoint();a.postMessage=v=>{b.messages.forEach(f=>{f(v);});};b.postMessage=v=>{a.messages.forEach(f=>{f(v);});};a.disconnect=b.disconnect=()=>{a.closed.forEach(f=>{f();});b.closed.forEach(f=>{f();});};return {a,b};
}
const sender={id:'ext',url:'chrome-extension://ext/start.html',tab:{id:1,url:'chrome-extension://ext/start.html'},frameId:0,documentId:'doc'};
function setup(){vi.stubGlobal('chrome',{runtime:{id:'ext',getURL:(p:string)=>`chrome-extension://ext/${p}`},tabs:{sendMessage:()=>Promise.resolve({normal:true})}});}
it('verified start port supports nested approvals without a serial deadlock',async()=>{
 setup();const p=pair(sender);const bridge=createStartBridge(async(m,s)=>({sender:s.tab?.id,approval:await bridge.send(s.tab?.id??-1,{type:'check'},{frameId:0})}),()=>{});
 bridge.attach(p.a);const client=createPortRpc(p.b,()=>Promise.resolve({result:'done'}));
 expect(await client.request({type:'run'})).toEqual({sender:1,approval:{result:'done'}});
});
it.each([{url:'chrome-extension://ext/popup.html'},{frameId:1},{documentId:undefined},{tab:undefined},{id:'other'}])('unverified sender is rejected: %j',async change=>{
 setup();const p=pair(Object.fromEntries(Object.entries({...sender,...change}).filter(([,value])=>value!==undefined)));let called=false;const bridge=createStartBridge(()=>{called=true;return Promise.resolve({});},()=>{});expect(bridge.attach(p.a)).toBe(false);expect(called).toBe(false);expect(await bridge.send(1,{},{})).toEqual({normal:true});
});
it('replacing a port invalidates the old document without a late disconnect erasing the new one',async()=>{
 setup();const invalid:number[]=[];const bridge=createStartBridge(()=>Promise.resolve({}),id=>{invalid.push(id);});const old=pair(sender),next=pair({...sender,documentId:'new'});bridge.attach(old.a);createPortRpc(old.b,()=>Promise.resolve({old:true}));bridge.attach(next.a);createPortRpc(next.b,()=>Promise.resolve({current:true}));old.a.disconnect();expect(await bridge.send(1,{},{})).toEqual({current:true});expect(invalid).toEqual([1]);next.a.disconnect();expect(invalid).toEqual([1,1]);
});
it('a disconnected in-flight call resolves unknown and cannot replay',async()=>{
 setup();const p=pair(sender);createPortRpc(p.a,()=>new Promise(()=>{}));const client=createPortRpc(p.b,()=>Promise.resolve({}));const work=client.request({});p.a.disconnect();expect(await work).toEqual({result:'unknown'});expect(await client.request({})).toEqual({result:'unknown'});
});
