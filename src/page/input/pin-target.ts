import type { Collector } from '@/page/collector/collector';
import type { Fingerprint } from '@/core/fingerprint';
import { uniquePinnedTarget, PinMutation, pinName } from '@/core/pin-settings';
import { reportSwitchItem } from './switch-actions';
export interface PinCapture { fingerprint:Fingerprint; label:string;valid:()=>boolean;dispose:()=>void }
export function pinEligible(el:Element|undefined):boolean{
 if(!el?.isConnected||!(el instanceof HTMLButtonElement&&el.type==='button'||el instanceof HTMLAnchorElement&&['http:','https:'].includes(el.protocol)))return false;
 const editable='input,textarea,select,[contenteditable]:not([contenteditable="false"])';
 if(el.matches(':disabled,[aria-disabled="true"]')||el.querySelector(editable))return false;
 const labels=[...(el instanceof HTMLButtonElement?Array.from(el.labels):[]),...(el.getAttribute('aria-labelledby')??'').split(/\s+/).map(id=>el.ownerDocument.getElementById(id))];
 if(labels.some(label=>label&&(label.closest(editable)||label.querySelector(editable))))return false;
 for(let node:Element|null=el;node;node=node.parentElement){
  if(node instanceof HTMLElement&&(node.isContentEditable||node.hidden||node.inert||node.hasAttribute('contenteditable')&&node.getAttribute('contenteditable')!=='false'))return false;
  const style=getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden')return false;
 }
 return true;
}
export function capturePinTarget(collector:Collector,id:string,onInvalidate:()=>void=()=>undefined):PinCapture|null{
 collector.refresh();const item=collector.items().find(entry=>entry.id===id),element=collector.get(id);
 if(!item||!element||!pinEligible(element)||item.danger||uniquePinnedTarget(collector.items(),item.fingerprint)?.id!==id)return null;
 const fingerprint=structuredClone(item.fingerprint),identity=reportSwitchItem(item,element).identity;
 if(fingerprint.framePath.length>0||!PinMutation.safeParse({number:1,expected:[],fingerprint}).success)return null;
 const ancestors=new Set<Node>();for(let node:Node|null=element;node;node=node.parentNode)ancestors.add(node);
 let invalid=false;
 const stop=()=>{observer.disconnect();window.removeEventListener('scroll',viewportChanged,true);window.removeEventListener('resize',viewportChanged);};
 const invalidate=()=>{if(!invalid){invalid=true;stop();onInvalidate();}};
 const matches=()=>{collector.refresh();const current=collector.items().find(entry=>entry.id===id);
  return !!current&&collector.get(id)===element&&pinEligible(element)&&!current.danger&&reportSwitchItem(current,element).identity===identity&&uniquePinnedTarget(collector.items(),fingerprint)?.id===id;
 };
 const changed=(records:MutationRecord[])=>{
  if(!invalid&&(records.some(record=>Array.from(record.removedNodes).some(node=>ancestors.has(node)))||!matches()))invalidate();
 };
 const viewportChanged=()=>{changed([]);};
 window.addEventListener('scroll',viewportChanged,true);window.addEventListener('resize',viewportChanged);
 // External labels and newly ambiguous targets can also invalidate a proposal.
 const observer=new MutationObserver(changed);observer.observe(element.ownerDocument,{childList:true,subtree:true,attributes:true,characterData:true});
 return {fingerprint,label:pinName(fingerprint),dispose:()=>{invalid=true;stop();},valid:()=>{
  changed(observer.takeRecords());return !invalid;
 }};
}
