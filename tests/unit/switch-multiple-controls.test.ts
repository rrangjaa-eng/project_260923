// @vitest-environment happy-dom
import {beforeEach,expect,it,vi} from 'vitest';
import type {Collector,Item} from '../../src/page/collector/collector';
import {captureControl} from '../../src/page/input/form-control';
import {executeSwitchAction,reportSwitchItem} from '../../src/page/input/switch-actions';
import {SwitchTargetAction} from '../../src/shared/switch-messages';
beforeEach(()=>{document.body.innerHTML='';});
function required<T>(value:T|null|undefined):T{if(value==null)throw new Error('missing fixture');return value;}
function fixture(){
 document.body.innerHTML='<form><select multiple aria-label="관심 주제"><option value="private-a" selected>가</option><option value="private-b">나</option><optgroup label="고정" disabled><option selected>다</option></optgroup></select></form>';
 const el=required(document.querySelector('select'));const item:Item={id:'M',name:'관심 주제',kind:'select',danger:false,rect:{x:0,y:0,w:100,h:80},fingerprint:{framePath:[],domPath:'body/select',buttonText:'관심 주제'}};
 const collector:Collector={get:()=>el,items:()=>[item],refresh:()=>undefined,onChange:()=>undefined};
 const action=(extra:object={})=>SwitchTargetAction.parse({actionId:'once',kind:'applyControl',target:{tabId:1,frameId:0,documentGeneration:'doc',itemId:'M'},expectedIdentity:reportSwitchItem(item,el).identity,authorization:{documentGeneration:'doc',modeGeneration:0,pendingActionId:'pending'},...extra});
 const indices=()=>Array.from(el.options).flatMap((option,index)=>option.selected?[index]:[]);
 return {el,item,collector,action,indices};
}
it('reports multiple and captures selected indices and disabled labels without raw values',()=>{
 const f=fixture();expect(reportSwitchItem(f.item,f.el).controlKind).toBe('multiple');const control=captureControl(f.el);
 expect(control).toMatchObject({kind:'multiple',selectedIndices:[0,2],options:[{label:'가',disabled:false},{label:'나',disabled:false},{label:'다',disabled:true}]});expect(JSON.stringify(control)).not.toContain('private-');expect(captureControl(f.el)).toEqual(control);
});
it('sets the whole explicit proposal once, preserves disabled selection and returns a fresh capture',()=>{
 const f=fixture();const control=required(captureControl(f.el));const input=vi.fn(),change=vi.fn(),click=vi.fn(),submit=vi.fn();f.el.addEventListener('input',input);f.el.addEventListener('change',change);f.el.addEventListener('click',click);required(f.el.form).addEventListener('submit',submit);
 const a=f.action({control,controlIndices:[1,2]});const result=executeSwitchAction(f.collector,a);expect(result).toMatchObject({result:'done',control:{kind:'multiple',selectedIndices:[1,2]}});expect(result.control?.signature).not.toBe(control.signature);expect(f.indices()).toEqual([1,2]);expect([input.mock.calls.length,change.mock.calls.length,click.mock.calls.length,submit.mock.calls.length]).toEqual([1,1,0,0]);expect(executeSwitchAction(f.collector,a).result).toBe('refused');
});
it('validates disabled proposals before changing any enabled option',()=>{
 for(const indices of [[],[1],[0,1,2,3]]){const f=fixture();const control=required(captureControl(f.el));const input=vi.fn();f.el.addEventListener('input',input);expect(executeSwitchAction(f.collector,f.action({control,controlIndices:indices})).result).toBe('refused');expect(f.indices()).toEqual([0,2]);expect(input).not.toHaveBeenCalled();}
});
it('distinguishes an explicit empty selection from a missing proposal',()=>{
 const f=fixture();required(f.el.querySelector('optgroup')).disabled=false;const control=required(captureControl(f.el));expect(executeSwitchAction(f.collector,f.action({control})).result).toBe('refused');expect(executeSwitchAction(f.collector,f.action({control,controlIndices:[]}))).toMatchObject({result:'done',control:{selectedIndices:[]}});expect(f.indices()).toEqual([]);
});
it('refuses changed mode, values, labels, selection, ownership and option order',()=>{
 const changes:((el:HTMLSelectElement)=>void)[]=[el=>{el.multiple=false;},el=>{required(el.options[1]).value='changed';},el=>{required(el.options[1]).text='changed';},el=>{required(el.options[1]).selected=true;},el=>{el.setAttribute('form','other');},el=>{el.append(required(el.options[0]));},el=>{required(el.querySelector('optgroup')).disabled=false;},el=>{el.name='different';}];
 for(const change of changes){const f=fixture();const control=required(captureControl(f.el));change(f.el);const before=f.indices();expect(executeSwitchAction(f.collector,f.action({control,controlIndices:[1,2]})).result,change.toString()).toBe('refused');expect(f.indices()).toEqual(before);}
});
it('refuses removed and reinserted options and ancestors',()=>{
 for(const kind of ['option','form']){const f=fixture();const control=required(captureControl(f.el));const node=kind==='option'?required(f.el.options[1]):required(f.el.form);const parent=required(node.parentNode),next=node.nextSibling;node.remove();parent.insertBefore(node,next);expect(executeSwitchAction(f.collector,f.action({control,controlIndices:[1,2]})).result).toBe('refused');expect(f.indices()).toEqual([0,2]);}
});
it('consumes a proposal even when the site reverses the full selection',()=>{
 const f=fixture();const control=required(captureControl(f.el));const input=vi.fn(()=>{required(f.el.options[0]).selected=true;required(f.el.options[1]).selected=false;});f.el.addEventListener('input',input);const a=f.action({control,controlIndices:[1,2]});expect(executeSwitchAction(f.collector,a).result).toBe('refused');expect(executeSwitchAction(f.collector,a).result).toBe('refused');expect(input).toHaveBeenCalledTimes(1);
});
it('does not acknowledge option metadata changes during events',()=>{
 const f=fixture();const control=required(captureControl(f.el));f.el.addEventListener('change',()=>{required(f.el.options[2]).value='changed';});expect(executeSwitchAction(f.collector,f.action({control,controlIndices:[1,2]})).result).toBe('refused');
});
it('a no-op emits no events and consumes its capture',()=>{
 const f=fixture();const control=required(captureControl(f.el));const input=vi.fn();f.el.addEventListener('input',input);f.el.addEventListener('change',input);const a=f.action({control,controlIndices:[0,2]});expect(executeSwitchAction(f.collector,a).result).toBe('done');expect(input).not.toHaveBeenCalled();expect(executeSwitchAction(f.collector,a).result).toBe('refused');
});
it('rejects malformed indices at the message boundary',()=>{
 const f=fixture();for(const indices of [[1,1],[-1],[100],[0.5],Array(101).fill(0)])expect(()=>f.action({controlIndices:indices})).toThrow();
});
it('rejects oversized, sensitive, hidden and disabled controls',()=>{
 for(const modify of [(el:HTMLSelectElement)=>{el.setAttribute('aria-label','계좌');},(el:HTMLSelectElement)=>{el.hidden=true;},(el:HTMLSelectElement)=>{el.disabled=true;},(el:HTMLSelectElement)=>{required(el.options[0]).setAttribute('label','a'.repeat(301));},(el:HTMLSelectElement)=>{el.innerHTML='<option>A</option>'.repeat(101);}]){const f=fixture();modify(f.el);expect(captureControl(f.el),modify.toString()).toBeNull();}
});
it('invalidates removal and reinsertion of an externally associated form',()=>{
 const f=fixture();const form=required(f.el.form);form.id='external';f.el.setAttribute('form','external');document.body.append(f.el);const control=required(captureControl(f.el));form.remove();document.body.prepend(form);const input=vi.fn();f.el.addEventListener('input',input);expect(executeSwitchAction(f.collector,f.action({control,controlIndices:[1,2]})).result).toBe('refused');expect(f.indices()).toEqual([0,2]);expect(input).not.toHaveBeenCalled();
});
it('never invokes the setter on disabled or unchanged options',()=>{
 const f=fixture();const control=required(captureControl(f.el));const native=Object.getOwnPropertyDescriptor(HTMLOptionElement.prototype,'selected');if(!native?.set)throw new Error('missing setter');const touched:HTMLOptionElement[]=[];const setter=vi.spyOn(HTMLOptionElement.prototype,'selected','set').mockImplementation(function(this:HTMLOptionElement,value:boolean){touched.push(this);native.set?.call(this,value);});
 try{expect(executeSwitchAction(f.collector,f.action({control,controlIndices:[0,1,2]})).result).toBe('done');expect(touched).toEqual([f.el.options[1]]);}finally{setter.mockRestore();}
});
it('rejects forged captures and a token replaced by another multiple field capture',()=>{
 const f=fixture();const control=required(captureControl(f.el));const forged={...control,signature:(control.signature[0]==='0'?'1':'0')+control.signature.slice(1)};expect(executeSwitchAction(f.collector,f.action({control:forged,controlIndices:[1,2]})).result).toBe('refused');const other=f.el.cloneNode(true) as HTMLSelectElement;document.body.append(other);expect(captureControl(other)?.kind).toBe('multiple');expect(executeSwitchAction(f.collector,f.action({control,controlIndices:[1,2]})).result).toBe('refused');expect(f.indices()).toEqual([0,2]);
});
it('excludes Shadow multiple metadata and refuses disabled fieldsets',()=>{
 const f=fixture();const host=document.createElement('div');document.body.append(host);host.attachShadow({mode:'open'}).append(f.el);expect(reportSwitchItem(f.item,f.el).controlKind).toBeUndefined();expect(captureControl(f.el)).toBeNull();const g=fixture();const fieldset=document.createElement('fieldset');fieldset.disabled=true;g.el.before(fieldset);fieldset.append(g.el);expect(captureControl(g.el)).toBeNull();
});
it('does not report success when site events change the field label',()=>{
 const f=fixture();const control=required(captureControl(f.el));f.el.addEventListener('input',()=>{f.el.setAttribute('aria-label','다른 목적');});expect(executeSwitchAction(f.collector,f.action({control,controlIndices:[1,2]})).result).toBe('refused');
});
