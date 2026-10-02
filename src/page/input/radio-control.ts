import type { FormControl } from '@/shared/switch-messages';
import { fieldLabel, sensitiveElement } from './text-target';

type RadioControl = Extract<FormControl, {kind:'radio'}>;
interface RadioGroup {
  members: HTMLInputElement[];
  form: HTMLFormElement|null;
  name: string;
  states: {value:string; label:string; checked:boolean; required:boolean; formAttribute:string|null}[];
}
interface Capture { target:HTMLInputElement; group:RadioGroup; token:string; invalid:boolean; observer:MutationObserver; ancestors:Set<Node> }
// 값과 DOM 참조는 선택한 문서 안에만 두고, 메시지에는 임의 토큰만 보낸다.
const captures = new WeakMap<Document, Capture>();

function available(el:HTMLInputElement):boolean {
  if(!el.isConnected||el.matches(':disabled,[aria-disabled="true"]')||sensitiveElement(el))return false;
  for(let node:Element|null=el;node;node=node.parentElement){
    const style=getComputedStyle(node);
    if(node instanceof HTMLFieldSetElement&&node.disabled||node instanceof HTMLElement&&(node.hidden||node.inert)||node.getAttribute('aria-hidden')==='true'
      ||style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||style.opacity==='0')return false;
  }
  return true;
}
function groupOf(el:HTMLInputElement):RadioGroup|null {
  if(el.type!=='radio'||!el.name||el.getRootNode()!==el.ownerDocument)return null;
  const members=Array.from(el.ownerDocument.querySelectorAll<HTMLInputElement>('input')).filter(member=>member.type==='radio'&&member.name===el.name&&member.form===el.form);
  if(!members.includes(el)||members.length>100||members.some(member=>!available(member)||member.value.length>4000||fieldLabel(member).length>300))return null;
  return {members,form:el.form,name:el.name,states:members.map(member=>({value:member.value,label:fieldLabel(member),checked:member.checked,required:member.required,formAttribute:member.getAttribute('form')}))};
}
function sameGroup(a:RadioGroup,b:RadioGroup):boolean {
  return a.form===b.form&&a.name===b.name&&a.members.length===b.members.length
    &&a.members.every((member,index)=>member===b.members[index])&&JSON.stringify(a.states)===JSON.stringify(b.states);
}
function observeRemoval(entry:Capture,records:MutationRecord[]){
  if(records.some(record=>Array.from(record.removedNodes).some(node=>entry.ancestors.has(node)||entry.group.members.some(member=>node===member||node.contains(member))||!!entry.group.form&&(node===entry.group.form||node.contains(entry.group.form))))){
    entry.invalid=true;entry.observer.disconnect();
  }
}
export function captureRadio(el:HTMLInputElement):RadioControl|null {
  const prior=captures.get(el.ownerDocument);
  if(prior)observeRemoval(prior,prior.observer.takeRecords());
  const group=groupOf(el);
  if(!group){prior?.observer.disconnect();captures.delete(el.ownerDocument);return null;}
  if(prior&&!prior.invalid&&prior.target===el&&sameGroup(prior.group,group))return {kind:'radio',checked:el.checked,signature:prior.token};
  prior?.observer.disconnect();
  const observer=new MutationObserver(records=>{observeRemoval(entry,records);});
  const ancestors=new Set<Node>();
  for(const member of group.members)for(let node:Node|null=member;node;node=node.parentNode)ancestors.add(node);
  const entry:Capture={target:el,group,token:Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16).padStart(8,'0')).join(''),invalid:false,observer,ancestors};
  observer.observe(el.ownerDocument,{childList:true,subtree:true});captures.set(el.ownerDocument,entry);
  return {kind:'radio',checked:el.checked,signature:entry.token};
}
export function applyRadio(el:HTMLInputElement,control:RadioControl,checked:boolean|undefined):'done'|'refused' {
  const entry=captures.get(el.ownerDocument);
  if(!entry||entry.target!==el||entry.token!==control.signature||checked!==true)return 'refused';
  observeRemoval(entry,entry.observer.takeRecords());
  const current=groupOf(el);
  if(entry.invalid||!current||control.checked!==el.checked||!sameGroup(entry.group,current))return 'refused';
  // 값이 이벤트 처리 중 원복되어도 같은 승인으로 다시 실행하지 않는다.
  captures.delete(el.ownerDocument);
  try {
    if(el.checked)return 'done';
    const descriptor=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'checked');
    if(!descriptor?.set)return 'refused';
    descriptor.set.call(el,true);
    el.dispatchEvent(new Event('input',{bubbles:true,composed:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
    const unremoved=()=>{observeRemoval(entry,entry.observer.takeRecords());return !entry.invalid;};
    const after=groupOf(el);
    const expected={...current,states:current.states.map((state,index)=>({...state,checked:current.members[index]===el}))};
    return unremoved()&&after&&sameGroup(expected,after)?'done':'refused';
  } finally {entry.observer.disconnect();}
}

export function clearRadioCapture(doc:Document){
  captures.get(doc)?.observer.disconnect();captures.delete(doc);
}
