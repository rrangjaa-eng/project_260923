// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Collector, Item } from '../../src/page/collector/collector';
import { executeSwitchAction, reportSwitchItem } from '../../src/page/input/switch-actions';
import { captureControl } from '../../src/page/input/form-control';
import { SwitchTargetAction } from '../../src/shared/switch-messages';
beforeEach(()=>{document.body.innerHTML='';});
afterEach(()=>{vi.unstubAllGlobals();});
function required<T>(value:T|null|undefined):T{if(value==null)throw new Error('Missing test fixture');return value;}
function fixture(){
 document.body.innerHTML='<form id="first"><label><input id="a" type="radio" name="delivery" value="private-a" checked>방문</label><label><input id="b" type="radio" name="delivery" value="private-b">우편</label></form><form id="second"><input id="other" type="radio" name="delivery" checked aria-label="다른 양식"></form>';
 const a=required(document.querySelector<HTMLInputElement>('#a'));const b=required(document.querySelector<HTMLInputElement>('#b'));
 const item:Item={id:'B',name:'우편',kind:'input',danger:false,rect:{x:0,y:0,w:100,h:30},fingerprint:{framePath:[],domPath:'body/form/input',buttonText:'우편'}};
 const collector:Collector={get:()=>b,items:()=>[item],refresh:()=>undefined,onChange:()=>undefined};
 const action=(kind:string,extra:object={})=>SwitchTargetAction.parse({actionId:'once',kind,target:{tabId:1,frameId:0,documentGeneration:'doc',itemId:'B'},expectedIdentity:reportSwitchItem(item,b).identity,authorization:{documentGeneration:'doc',modeGeneration:0,pendingActionId:'pending'},...extra});
 return {a,b,item,collector,action};
}
it('reports a radio field and captures only opaque group identity and its selected state',()=>{
 const f=fixture();expect(reportSwitchItem(f.item,f.b)).toMatchObject({label:'우편',controlKind:'radio'});
 const control=captureControl(f.b);expect(control).toMatchObject({kind:'radio',checked:false});
 expect(JSON.stringify(control)).not.toMatch(/private-|delivery|방문/);expect(captureControl(f.b)).toEqual(control);
});
it('explicitly selects one radio without click or submit and preserves a same-name different form',()=>{
 const f=fixture();const control=captureControl(f.b);expect(control?.kind).toBe('radio');
 const input=vi.fn(),change=vi.fn(),click=vi.fn(),submit=vi.fn();f.b.addEventListener('input',input);f.b.addEventListener('change',change);f.b.addEventListener('click',click);required(f.b.form).addEventListener('submit',submit);
 expect(executeSwitchAction(f.collector,f.action('applyControl',{control,controlChecked:true})).result).toBe('done');
 expect([f.a.checked,f.b.checked,required(document.querySelector<HTMLInputElement>('#other')).checked]).toEqual([false,true,true]);
 expect([input.mock.calls.length,change.mock.calls.length,click.mock.calls.length,submit.mock.calls.length]).toEqual([1,1,0,0]);
 expect(executeSwitchAction(f.collector,f.action('applyControl',{control,controlChecked:true})).result).toBe('refused');
});
it('refuses changed group state, membership, values, meaning and form owner',()=>{
 for(const mutate of [(f:ReturnType<typeof fixture>)=>{f.a.checked=false;},(f:ReturnType<typeof fixture>)=>{f.a.value='changed';},(f:ReturnType<typeof fixture>)=>{f.a.replaceWith(f.a.cloneNode(true));},(f:ReturnType<typeof fixture>)=>{f.b.name='new';},(f:ReturnType<typeof fixture>)=>{f.b.setAttribute('form','second');},(f:ReturnType<typeof fixture>)=>{f.a.setAttribute('aria-label','다른 항목');}]){
  const f=fixture();const control=captureControl(f.b);expect(control?.kind).toBe('radio');mutate(f);
  expect(executeSwitchAction(f.collector,f.action('applyControl',{control,controlChecked:true})).result,mutate.toString()).toBe('refused');expect(f.b.checked).toBe(false);
 }
});
it('rejects unchecked proposals, generic presses and unsupported or sensitive group members',()=>{
 const f=fixture();const control=captureControl(f.b);expect(control?.kind).toBe('radio');
 expect(executeSwitchAction(f.collector,f.action('applyControl',{control,controlChecked:false})).result).toBe('refused');
 const click=vi.fn();expect(executeSwitchAction(f.collector,f.action('press',{confirmed:true}),click).result).toBe('refused');expect(click).not.toHaveBeenCalled();
 for(const attribute of ['hidden','disabled','inert']){const g=fixture();g.a.setAttribute(attribute,'');expect(captureControl(g.b)).toBeNull();}
 const g=fixture();g.a.setAttribute('aria-label','계좌번호');expect(captureControl(g.b)).toBeNull();
 const h=fixture();h.b.name='';expect(captureControl(h.b)).toBeNull();
});
it('does not acknowledge success when a site changes the radio group during application',()=>{
 const f=fixture();const control=captureControl(f.b);expect(control?.kind).toBe('radio');
 f.b.addEventListener('input',()=>{f.a.value='changed-by-site';});
 expect(executeSwitchAction(f.collector,f.action('applyControl',{control,controlChecked:true})).result).toBe('refused');
});
it('invalidates a captured group when a member or its form is removed and reinserted',()=>{
 for(const which of ['member','form']){const f=fixture();const control=captureControl(f.b);expect(control?.kind).toBe('radio');const node=which==='member'?f.a:required(f.a.form);const parent=required(node.parentNode);const next=node.nextSibling;node.remove();parent.insertBefore(node,next);expect(executeSwitchAction(f.collector,f.action('applyControl',{control,controlChecked:true})).result).toBe('refused');expect(f.b.checked).toBe(false);}
});
it('consumes the captured proposal even if a site reverses its effect',()=>{
 const f=fixture();const control=captureControl(f.b);expect(control?.kind).toBe('radio');let changes=0;
 f.b.addEventListener('input',()=>{changes++;f.a.checked=true;});const action=f.action('applyControl',{control,controlChecked:true});
 expect(executeSwitchAction(f.collector,action).result).toBe('refused');expect(executeSwitchAction(f.collector,action).result).toBe('refused');expect(changes).toBe(1);
});
it('includes externally associated radios and refuses disabled fieldsets or hidden ancestors',()=>{
 const f=fixture();const external=document.createElement('input');external.type='radio';external.name='delivery';external.setAttribute('form','first');external.setAttribute('aria-label','방문함');document.body.append(external);
 const control=captureControl(f.b);expect(control?.kind).toBe('radio');external.checked=true;expect(executeSwitchAction(f.collector,f.action('applyControl',{control,controlChecked:true})).result).toBe('refused');
 for(const style of ['display:none','visibility:collapse','opacity:0']){const g=fixture();required(g.a.parentElement).setAttribute('style',style);expect(captureControl(g.b)).toBeNull();}
});
it('refuses removal of an ancestor even if its radio is immediately rescued into the same place',()=>{
 const f=fixture();f.a.setAttribute('aria-label','방문');const control=captureControl(f.b);expect(control?.kind).toBe('radio');const label=required(f.a.parentElement);const form=required(f.a.form);label.remove();form.insertBefore(f.a,form.firstChild);
 expect(executeSwitchAction(f.collector,f.action('applyControl',{control,controlChecked:true})).result).toBe('refused');expect(f.b.checked).toBe(false);
});
it('reads required validity for a supported radio without invoking browser validation UI',()=>{
 const f=fixture();f.a.checked=false;f.b.required=true;const invalid=vi.fn();f.b.addEventListener('invalid',invalid);
 expect(executeSwitchAction(f.collector,f.action('readValidity'))).toMatchObject({result:'done',validation:'필수 입력칸이에요. 값을 입력하세요'});expect(invalid).not.toHaveBeenCalled();
});

it('captures a radio on insecure HTTP where randomUUID is unavailable',()=>{
 const random=crypto.getRandomValues.bind(crypto);vi.stubGlobal('crypto',{getRandomValues:random});const f=fixture();expect(captureControl(f.b)).toMatchObject({kind:'radio',checked:false});
});
it('does not advertise unnamed or Shadow DOM radios as supported form controls',()=>{
 const f=fixture();f.b.name='';expect(reportSwitchItem(f.item,f.b).controlKind).toBeUndefined();
 f.b.name='delivery';const host=document.createElement('div');document.body.append(host);host.attachShadow({mode:'open'}).append(f.b);expect(reportSwitchItem(f.item,f.b).controlKind).toBeUndefined();
});
it('refuses disabled fieldsets and oversized radio groups',()=>{
 const f=fixture();const fieldset=document.createElement('fieldset');fieldset.disabled=true;f.a.before(fieldset);fieldset.append(f.a);expect(captureControl(f.b)).toBeNull();
 const g=fixture();for(let i=0;i<100;i++){const extra=document.createElement('input');extra.type='radio';extra.name=g.b.name;required(g.b.form).append(extra);}expect(captureControl(g.b)).toBeNull();
});
it('rejects a forged capture token without changing any radio',()=>{
 const f=fixture();const control=required(captureControl(f.b));expect(control.kind).toBe('radio');const forged={...control,signature:(control.signature[0]==='0'?'1':'0')+control.signature.slice(1)};
 expect(executeSwitchAction(f.collector,f.action('applyControl',{control:forged,controlChecked:true})).result).toBe('refused');expect([f.a.checked,f.b.checked]).toEqual([true,false]);
});
it('an already selected radio is a no-op that consumes its capture without dispatching events',()=>{
 const f=fixture();f.b.checked=true;const control=required(captureControl(f.b));expect(control.kind).toBe('radio');const event=vi.fn();f.b.addEventListener('input',event);f.b.addEventListener('change',event);const action=f.action('applyControl',{control,controlChecked:true});
 expect(executeSwitchAction(f.collector,action).result).toBe('done');expect(event).not.toHaveBeenCalled();expect(executeSwitchAction(f.collector,action).result).toBe('refused');
});
