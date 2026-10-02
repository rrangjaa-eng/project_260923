import type { FormControl, SwitchTargetAction } from '@/shared/switch-messages';
import {captureMultiple,applyMultiple} from './multiple-control';
import { captureRadio, applyRadio } from './radio-control';
import { sensitiveElement, typingElement } from './text-target';
export function controlElement(el:Element|undefined):el is HTMLSelectElement|HTMLInputElement {
  return el instanceof HTMLSelectElement||el instanceof HTMLInputElement&&(el.type==='checkbox'||el.type==='radio');
}
export function captureControl(el:Element):FormControl|null {
  if(!controlElement(el)||!el.isConnected||el.disabled||sensitiveElement(el))return null;
  if(el instanceof HTMLInputElement&&el.type==='radio')return captureRadio(el);
  if(el instanceof HTMLSelectElement&&el.multiple)return captureMultiple(el);
  if(el instanceof HTMLInputElement)return el.indeterminate||el.value.length>4000?null:{kind:'checkbox',checked:el.checked,signature:el.value};
  if(el.options.length===0||el.options.length>100)return null;
  const signature=JSON.stringify(Array.from(el.options,option=>[option.value,(option.getAttribute('label')??option.textContent),option.disabled,option.parentElement instanceof HTMLOptGroupElement&&option.parentElement.disabled]));
  if(signature.length>64000||Array.from(el.options).some(option=>(option.getAttribute('label')??option.textContent).length>300))return null;
  return {kind:'select',selectedIndex:el.selectedIndex,signature,options:Array.from(el.options,option=>({label:(option.getAttribute('label')??option.textContent)||'이름 없는 선택 항목',disabled:option.disabled||option.parentElement instanceof HTMLOptGroupElement&&option.parentElement.disabled}))};
}
export function applyControl(el:Element,action:SwitchTargetAction):'done'|'refused' {
  if(el instanceof HTMLSelectElement&&el.multiple)return action.control?.kind==='multiple'&&action.controlIndex===undefined&&action.controlChecked===undefined?applyMultiple(el,action.control,action.controlIndices):'refused';
  if(action.controlIndices!==undefined)return 'refused';
  if(el instanceof HTMLInputElement&&el.type==='radio')return action.control?.kind==='radio'&&action.controlIndex===undefined?applyRadio(el,action.control,action.controlChecked):'refused';
  const current=captureControl(el);
  if(!current||!action.control||JSON.stringify(current)!==JSON.stringify(action.control))return 'refused';
  if(current.kind==='select'&&el instanceof HTMLSelectElement){
    const index=action.controlIndex;
    if(index===undefined||!current.options[index]||current.options[index].disabled)return 'refused';
    if(index===current.selectedIndex)return 'done';
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'selectedIndex')?.set?.call(el,index);
  }else if(current.kind==='checkbox'&&el instanceof HTMLInputElement){
    if(action.controlChecked===undefined)return 'refused';
    if(action.controlChecked===current.checked)return 'done';
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'checked')?.set?.call(el,action.controlChecked);
  }else return 'refused';
  el.dispatchEvent(new Event('input',{bubbles:true,composed:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
  const after=captureControl(el);
  return after&&after.kind!=='radio'&&after.kind!=='multiple'&&(after.kind==='checkbox'?after.checked===action.controlChecked&&after.signature===(current.kind==='checkbox'?current.signature:''):after.selectedIndex===action.controlIndex&&after.signature===(current.kind==='select'?current.signature:''))?'done':'refused';
}
export function readValidity(el:Element):string|null {
  if(!(typingElement(el)||controlElement(el))||!el.isConnected||el.disabled||sensitiveElement(el))return null;
  const validity=el.validity;
  if(validity.valid)return el.getAttribute('aria-invalid')==='true'?'사이트가 입력 오류를 표시했어요. 원래 화면의 안내를 확인하세요': '입력 오류가 없어요';
  if(validity.valueMissing)return '필수 입력칸이에요. 값을 입력하세요';
  if(validity.typeMismatch)return '입력 형식이 맞지 않아요. 값을 확인하세요';
  if(validity.patternMismatch)return '사이트가 요구하는 형식에 맞지 않아요. 값을 확인하세요';
  if(validity.tooLong||validity.tooShort)return '입력 길이가 맞지 않아요. 길이를 확인하세요';
  if(validity.rangeOverflow||validity.rangeUnderflow||validity.stepMismatch)return '허용되는 범위에 맞지 않아요. 값을 확인하세요';
  return '사이트가 입력 오류를 표시했어요. 원래 화면의 안내를 확인하세요';
}
