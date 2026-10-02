// 확장 시작 탭과 worker 사이 전용 양방향 연결. 요청 중 승인 요청도 처리한다.
export function createPortRpc(port:chrome.runtime.Port,handle:(message:unknown)=>Promise<unknown>){
 let sequence=0,closed=false;
 const pending=new Map<number,{resolve:(value:unknown)=>void;timer:ReturnType<typeof setTimeout>}>();
 function stop(){if(closed)return;closed=true;for(const entry of pending.values()){clearTimeout(entry.timer);entry.resolve({result:'unknown'});}pending.clear();}
 port.onDisconnect.addListener(stop);
 port.onMessage.addListener((raw:unknown)=>{
  if(closed||typeof raw!=='object'||raw===null)return;
  const m=raw as {id?:unknown;kind?:unknown;value?:unknown};
  if(typeof m.id!=='number'||!Number.isSafeInteger(m.id)||m.id<1)return;
  if(m.kind==='response'){const entry=pending.get(m.id);if(entry){pending.delete(m.id);clearTimeout(entry.timer);entry.resolve(m.value);}return;}
  if(m.kind==='request'){const id=m.id;void handle(m.value).catch(()=>({result:'unknown'})).then(value=>{if(!closed)try{port.postMessage({kind:'response',id,value});}catch{stop();}});}
 });
 return {request:(value:unknown):Promise<unknown>=>{
  if(closed)return Promise.resolve({result:'unknown'});
  const id=++sequence;
  return new Promise(resolve=>{
   const timer=setTimeout(()=>{pending.delete(id);resolve({result:'unknown'});},3000);
   pending.set(id,{resolve,timer});
   try{port.postMessage({kind:'request',id,value});}catch{stop();}
  });
 },close:()=>{stop();port.disconnect();}};
}
