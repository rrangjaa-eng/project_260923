import {createPortRpc} from '@/shared/port-rpc';
export function createStartBridge(handle:(message:unknown,sender:chrome.runtime.MessageSender)=>Promise<unknown>,invalidate:(tabId:number)=>void){
 const connections=new Map<number,ReturnType<typeof createPortRpc>>();
 function attach(port:chrome.runtime.Port){
  const s=port.sender,url=chrome.runtime.getURL('start.html');
  if(port.name!=='switch-start'||s?.id!==chrome.runtime.id||s.url!==url||s.tab?.url!==url||s.frameId!==0||s.tab.id===undefined||!s.documentId){port.disconnect();return false;}
  const id=s.tab.id,old=connections.get(id);
  if(old){connections.delete(id);old.close();invalidate(id);}
  const rpc=createPortRpc(port,async message=>connections.get(id)===rpc?handle(message,s):{result:'refused'});
  connections.set(id,rpc);
  port.onDisconnect.addListener(()=>{if(connections.get(id)===rpc){connections.delete(id);invalidate(id);}});
  return true;
 }
 return {attach,send:(tabId:number,message:unknown,options?:{frameId?:number})=>{
  const rpc=connections.get(tabId);
  return rpc&&(options?.frameId===undefined||options.frameId===0)?rpc.request(message):chrome.tabs.sendMessage(tabId,message,options);
 },broadcast:(message:unknown)=>{for(const rpc of connections.values())void rpc.request(message);}};
}
