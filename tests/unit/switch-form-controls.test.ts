// @vitest-environment happy-dom
import { beforeEach, expect, it } from 'vitest';
import type { Collector, Item } from '../../src/page/collector/collector';
import { executeSwitchAction, reportSwitchItem } from '../../src/page/input/switch-actions';
import { SwitchTargetAction } from '../../src/shared/switch-messages';
beforeEach(() => { document.body.innerHTML = ''; });
function fixture(html: string) {
  document.body.innerHTML = html;
  const el = document.querySelector('select,input,textarea');
  if(!el)throw new Error('missing control');
  const item: Item = { id:'A', name:el.textContent, kind:el.tagName.toLowerCase(), danger:false, rect:{x:0,y:0,w:100,h:30}, fingerprint:{framePath:[],domPath:'body/control',buttonText:el.textContent} };
  const collector: Collector = {get:()=>el,items:()=>[item],refresh:()=>undefined,onChange:()=>undefined};
  const action = (kind: string, extra: object = {}) => SwitchTargetAction.parse({actionId:'once',kind,target:{tabId:1,frameId:0,documentGeneration:'doc',itemId:'A'},expectedIdentity:reportSwitchItem(item,el).identity,authorization:{documentGeneration:'doc',modeGeneration:0,pendingActionId:'pending'},...extra});
  return {el, collector, action};
}
it('reports only the select field name and explicitly captures its options', () => {
  const f=fixture('<label>분류<select><option value="secret">내부 값</option><option>다른 값</option></select></label>');
  const item=reportSwitchItem(f.collector.items()[0] as Item,f.el);
  expect(item.label).toBe('분류'); expect(item.identity).not.toContain('내부 값'); expect(item.controlKind).toBe('select');
  const result=executeSwitchAction(f.collector,f.action('captureControl'));
  expect(result).toMatchObject({result:'done',control:{kind:'select',selectedIndex:0,options:[{label:'내부 값',disabled:false},{label:'다른 값',disabled:false}]}});
});
it('applies only an unchanged option snapshot without clicking or submitting', () => {
  const f=fixture('<form><select aria-label="분류"><option>A</option><option>B</option><option disabled>C</option></select></form>');
  const control=executeSwitchAction(f.collector,f.action('captureControl')).control;
  let inputs=0,changes=0,clicks=0,submits=0;
  document.addEventListener('input',()=>inputs++); document.addEventListener('change',()=>changes++);
  document.addEventListener('click',()=>clicks++); document.addEventListener('submit',()=>submits++);
  const apply=f.action('applyControl',{control,controlIndex:1});
  expect(executeSwitchAction(f.collector,apply).result).toBe('done');
  expect((f.el as HTMLSelectElement).selectedIndex).toBe(1); expect([inputs,changes,clicks,submits]).toEqual([1,1,0,0]);
  expect(executeSwitchAction(f.collector,apply).result).toBe('refused');
});
it('rejects changed option values, disabled options and unsupported controls', () => {
  for(const change of ['value','label','disabled','current']) {
    const f=fixture('<select aria-label="분류"><option>A</option><option>B</option></select>');
    const control=executeSwitchAction(f.collector,f.action('captureControl')).control;
    const el=f.el as HTMLSelectElement;
    const option=el.options[1];if(!option)throw new Error('missing option');
    if(change==='value')option.value='changed'; if(change==='label')option.text='changed';
    if(change==='disabled')option.disabled=true; if(change==='current')el.selectedIndex=1;
    expect(executeSwitchAction(f.collector,f.action('applyControl',{control,controlIndex:1})).result).toBe('refused');
  }
  for(const html of ['<select multiple><option>A</option></select>','<input type="radio">','<input type="checkbox" aria-label="계좌 정보">']) {
    const f=fixture(html); expect(executeSwitchAction(f.collector,f.action('captureControl')).result).toBe('refused');
  }
});
it('sets an explicit checkbox state once and refuses indeterminate or externally changed state', () => {
  const f=fixture('<input type="checkbox" aria-label="알림 받기">');
  const control=executeSwitchAction(f.collector,f.action('captureControl')).control;
  const apply=f.action('applyControl',{control,controlChecked:true});
  expect(executeSwitchAction(f.collector,apply).result).toBe('done'); expect((f.el as HTMLInputElement).checked).toBe(true);
  expect(executeSwitchAction(f.collector,apply).result).toBe('refused');
  (f.el as HTMLInputElement).indeterminate=true;
  expect(executeSwitchAction(f.collector,f.action('captureControl')).result).toBe('refused');
});
it('reads validity without dispatching invalid events or exposing custom messages containing values', () => {
  const f=fixture('<input aria-label="이메일" type="email" required>'); let invalid=0;
  f.el.addEventListener('invalid',()=>invalid++);
  expect(executeSwitchAction(f.collector,f.action('readValidity'))).toMatchObject({result:'done',validation:'필수 입력칸이에요. 값을 입력하세요'});
  (f.el as HTMLInputElement).setCustomValidity('secret-user-value');
  expect(executeSwitchAction(f.collector,f.action('readValidity')).validation).not.toContain('secret-user-value'); expect(invalid).toBe(0);
});
it('refuses changed checkbox submission value and excludes unsupported controls from form metadata',()=>{
 const f=fixture('<input type="checkbox" aria-label="알림" value="old">');const control=executeSwitchAction(f.collector,f.action('captureControl')).control;(f.el as HTMLInputElement).value='new';
 expect(executeSwitchAction(f.collector,f.action('applyControl',{control,controlChecked:true})).result).toBe('refused');expect((f.el as HTMLInputElement).checked).toBe(false);
 for(const html of ['<select aria-label="빈 목록"></select>',`<select aria-label="많은 목록">${'<option>A</option>'.repeat(101)}</select>`,'<input type="checkbox" aria-label="미정 상태">']){
  const f=fixture(html);if(f.el instanceof HTMLInputElement)f.el.indeterminate=true;
  expect(reportSwitchItem(f.collector.items()[0] as Item,f.el).controlKind).toBeUndefined();
 }
});
it('never falls back to clicking a checkbox through page-item press, including indeterminate states',()=>{
 for(const indeterminate of [false,true]){
  const f=fixture('<input type="checkbox" aria-label="알림">');(f.el as HTMLInputElement).indeterminate=indeterminate;
  expect(executeSwitchAction(f.collector,f.action('press',{confirmed:true})).result).toBe('refused');expect((f.el as HTMLInputElement).checked).toBe(false);
 }
});
it('does not acknowledge success when a site handler changes checkbox meaning during application',()=>{
 const f=fixture('<input type="checkbox" aria-label="알림" value="old">');const control=executeSwitchAction(f.collector,f.action('captureControl')).control;
 f.el.addEventListener('input',()=>{(f.el as HTMLInputElement).value='new';});
 expect(executeSwitchAction(f.collector,f.action('applyControl',{control,controlChecked:true})).result).toBe('refused');
});
