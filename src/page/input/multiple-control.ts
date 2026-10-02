import type {FormControl} from '@/shared/switch-messages';
import {fieldLabel,sensitiveElement} from './text-target';
type MultipleControl=Extract<FormControl,{kind:'multiple'}>;
interface Snapshot {options:HTMLOptionElement[]; form:HTMLFormElement|null; signature:string; selectedIndices:number[]; labels:{label:string;disabled:boolean}[]}
interface Capture {target:HTMLSelectElement; snapshot:Snapshot; token:string; invalid:boolean; observer:MutationObserver; ancestors:Set<Node>}
const captures=new WeakMap<Document,Capture>();
function snapshot(el:HTMLSelectElement):Snapshot|null {
  if(!el.multiple||!el.isConnected||el.getRootNode()!==el.ownerDocument||el.matches(':disabled,[aria-disabled="true"]')||sensitiveElement(el))return null;
  for(let node:Element|null=el;node;node=node.parentElement){
    const style=getComputedStyle(node);
    if(node instanceof HTMLFieldSetElement&&node.disabled||node instanceof HTMLElement&&(node.hidden||node.inert)||node.getAttribute('aria-hidden')==='true'||style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||style.opacity==='0')return null;
  }
  const options=Array.from(el.options);
  if(!options.length||options.length>100)return null;
  const labels=options.map(option=>({label:(option.getAttribute('label')??option.textContent)||'이름 없는 선택 항목',disabled:option.disabled||option.parentElement instanceof HTMLOptGroupElement&&option.parentElement.disabled}));
  const signature=JSON.stringify([fieldLabel(el),el.name,el.getAttribute('form'),el.required,options.map((option,index)=>[option.value,labels[index],option.parentElement instanceof HTMLOptGroupElement?option.parentElement.label:null])]);
  if(signature.length>64000||labels.some(option=>option.label.length>300))return null;
  return {options,form:el.form,signature,labels,selectedIndices:options.flatMap((option,index)=>option.selected?[index]:[])};
}
function same(a:Snapshot,b:Snapshot):boolean{return a.form===b.form&&a.signature===b.signature&&a.options.length===b.options.length&&a.options.every((option,index)=>option===b.options[index])&&JSON.stringify(a.selectedIndices)===JSON.stringify(b.selectedIndices);}
function removal(entry:Capture,records:MutationRecord[]){
  if(records.some(record=>Array.from(record.removedNodes).some(node=>entry.ancestors.has(node)))){entry.invalid=true;entry.observer.disconnect();}
}
function control(entry:Capture):MultipleControl{return {kind:'multiple',selectedIndices:entry.snapshot.selectedIndices,options:entry.snapshot.labels,signature:entry.token};}
export function captureMultiple(el:HTMLSelectElement):MultipleControl|null {
  const prior=captures.get(el.ownerDocument);if(prior)removal(prior,prior.observer.takeRecords());
  const current=snapshot(el);if(!current){clearMultipleCapture(el.ownerDocument);return null;}
  if(prior&&!prior.invalid&&prior.target===el&&same(prior.snapshot,current))return control(prior);
  prior?.observer.disconnect();
  const observer=new MutationObserver(records=>{removal(entry,records);});const ancestors=new Set<Node>();
  for(const option of [...current.options,...(current.form?[current.form]:[])])for(let node:Node|null=option;node;node=node.parentNode)ancestors.add(node);
  const entry:Capture={target:el,snapshot:current,token:Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16).padStart(8,'0')).join(''),invalid:false,observer,ancestors};
  observer.observe(el.ownerDocument,{childList:true,subtree:true});captures.set(el.ownerDocument,entry);return control(entry);
}
export function applyMultiple(el:HTMLSelectElement,expected:MultipleControl,indices:number[]|undefined):'done'|'refused' {
  const entry=captures.get(el.ownerDocument);
  if(!entry||entry.target!==el||!indices||entry.token!==expected.signature||JSON.stringify(entry.snapshot.selectedIndices)!==JSON.stringify(expected.selectedIndices)||JSON.stringify(entry.snapshot.labels)!==JSON.stringify(expected.options)||indices.length>100||new Set(indices).size!==indices.length||indices.some(index=>!Number.isInteger(index)||index<0||index>=entry.snapshot.options.length))return 'refused';
  removal(entry,entry.observer.takeRecords());const current=snapshot(el);
  if(entry.invalid||!current||!same(entry.snapshot,current)||current.labels.some((option,index)=>option.disabled&&indices.includes(index)!==current.selectedIndices.includes(index)))return 'refused';
  captures.delete(el.ownerDocument);
  try {
    const selectedIndices=[...indices].sort((a,b)=>a-b);
    if(JSON.stringify(selectedIndices)===JSON.stringify(current.selectedIndices))return 'done';
    const descriptor=Object.getOwnPropertyDescriptor(HTMLOptionElement.prototype,'selected');if(!descriptor?.set)return 'refused';
    current.options.forEach((option,index)=>{if(!current.labels[index]?.disabled&&option.selected!==indices.includes(index))descriptor.set?.call(option,indices.includes(index));});
    el.dispatchEvent(new Event('input',{bubbles:true,composed:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
    const unremoved=()=>{removal(entry,entry.observer.takeRecords());return !entry.invalid;};const after=snapshot(el);
    return unremoved()&&after&&same({...current,selectedIndices},after)?'done':'refused';
  }finally{entry.observer.disconnect();}
}
export function clearMultipleCapture(doc:Document){captures.get(doc)?.observer.disconnect();captures.delete(doc);}
