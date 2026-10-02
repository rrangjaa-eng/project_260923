import { createSwitchState, reduceSwitch, type SwitchEvent, type SwitchItem, type SwitchAction, type SwitchTarget } from '@/core/switch-engine';
import { defaultSwitchSettings, SwitchSettings, SWITCH_SETTINGS_KEY } from '@/core/switch-settings';
import { snapshotTargets, type ScanTarget } from '@/core/switch-order';
import { createActionGate } from '@/core/switch-actions';
import { createDraft, editDraft, draftSelection, type TextDraft, type DraftEdit } from '@/core/text-draft';
import { composeHangul, INITIALS, MEDIALS, FINALS } from '@/core/hangul-compose';
import { PhraseList, phrasePreviewPages, type PhraseMutation } from '@/core/switch-phrases';
import { formTargets, FormDrafts, sensitiveFieldLabel, type FormDraft } from '@/core/form-navigation';
import { characters } from '@/core/text-draft';
import { framePathOf } from '@/core/frame-path';
import { FormControl, SwitchMessage, TextSelection, type SwitchFrameReport, type SwitchTargetAction } from '@/shared/switch-messages';
import type { Collector } from '@/page/collector/collector';
import type { InputPipeline } from './pipeline';
import { createSwitchPanel } from '@/page/overlay/switch-panel';
import { executeSwitchAction, reportSwitchItem, visibleSwitchChild } from './switch-actions';

const now=()=>performance.now();
const newSwitchId=()=>Array.from(crypto.getRandomValues(new Uint32Array(4)),(n)=>n.toString(16)).join('-');
const command=(id:string,label:string):SwitchItem=>({id,label,action:{kind:'command'}});
const groups=()=>['찾기','페이지 항목','읽기·이동','글쓰기','조절·쉬기'].map((label,i)=>command(`group:${String(i)}`,label));
async function request(message: unknown):Promise<unknown>{
  let timeout:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([chrome.runtime.sendMessage(message),new Promise((_,reject)=>{timeout=setTimeout(()=> { reject(new Error('response-timeout')); },3000);})]);}
  finally{if(timeout)clearTimeout(timeout);}
}
type PageResult={result:'done'|'refused'|'unknown';value?:string;selection?:TextSelection;control?:FormControl;validation?:string};
function resultOf(raw:unknown):PageResult{
  if(typeof raw==='object'&&raw!==null&&'result' in raw&&['done','refused','unknown'].includes(String(raw.result)))return raw as PageResult;
  return {result:'unknown'};
}
interface Menu { title:string;items:SwitchItem[];mode:'groupScan'|'itemScan'|'composing'|'confirming' }
export function createSwitchController(opts:{collector:Collector;pipeline:InputPipeline;signal:AbortSignal;enabled:()=>boolean;onExclusive:()=>void}) {
  const top=window===window.top;
  const generation=newSwitchId();
  const gate=createActionGate(generation);
  let settings=defaultSwitchSettings();
  let settingsLoaded=false;
  let state=createSwitchState();
  state.items=groups();
  let panel:ReturnType<typeof createSwitchPanel>|null=null;
  let title='스페이스바 작업판',notice='';
  let unknownNotice='';
  let current:Menu={title,items:groups(),mode:'groupScan'};
  let stack:Menu[]=[];
  let targets:ScanTarget[]=[];
  let selected:ScanTarget|null=null;
  let expectedValue='';
  let capturedSelection:TextSelection|undefined;
  let draft:TextDraft=createDraft();
  let initial:number|null=null,medial:number|null=null;
  let preservedDraft=false;
  let selectedControl:FormControl|null=null;
  let pendingControlIndex:number|undefined;
  let pendingControlChecked:boolean|undefined;
  let controlPage=0,controlPreviewIndex=0;
  let formFields:ScanTarget[]=[];
  const formDrafts=new FormDrafts();
  let formActive=false,formOverview=false,formRecovering=false;
  let formIndex:number|null=null;
  let formRecovery:FormDraft|null=null;
  let formOrigin:(FormDraft & {selected:ScanTarget|null;preservedDraft:boolean;current:Menu;stack:Menu[]})|null=null;
  const workspace=():FormDraft=>({draft,initial,medial,expectedValue,capturedSelection});
  function loadWorkspace(value:FormDraft){({draft,initial,medial,expectedValue,capturedSelection}=structuredClone(value));}
  function stashField(){if(formActive&&formRecovering)formRecovery=structuredClone(workspace());const field=formIndex===null?undefined:formFields[formIndex];if(formActive&&field&&!field.controlKind)formDrafts.set(field,workspace());}
  const shortLabel=(label:string)=>{const chars=characters(label);return chars.slice(0,24).join('')+(chars.length>24?'…':'');};
  let confirmAction:SwitchTargetAction|null=null;
  let confirmOpenedAt=0;
  let phraseSnapshot:string[]=[];
  let phraseIndex:number|null=null;
  let phraseChange:Exclude<PhraseMutation,{kind:'add'}>|null=null;
  let phrasePreviewIndex=0;
  let scrollTimer:ReturnType<typeof setInterval>|null=null;
  let disposed=false;
  let beginOnFocus=false;
  const exclusive=()=>!disposed&&settings.mode==='switch'&&opts.enabled();
  const active=(generation:number)=>exclusive()&&state.modeGeneration===generation;
  const authorization=()=>({documentGeneration:generation,modeGeneration:state.modeGeneration,pendingActionId:state.pendingAction?.actionId??''});
  const cancelPeers=()=>{if(top)void request({type:'switch/cancel-peers'}).catch(()=>undefined);};
  const stopScroll=()=>{if(scrollTimer)clearInterval(scrollTimer);scrollTimer=null;};
  function render(){if(!top||!exclusive())return;
    panel??=createSwitchPanel();
    const preview=phraseChange?phrasePreviewPages(phraseChange.expected[phraseChange.index]??'',phraseChange.kind==='replace'?phraseChange.text:undefined)[phrasePreviewIndex]??'':null;
    const context=formActive&&formIndex!==null?`양식 ${String(formIndex+1)}/${String(formFields.length)} · ${shortLabel(formFields[formIndex]?.label??'입력칸')} · `:'';
    panel.render(state,context+title,selectedControl?controlPreview():formActive&&formOverview?'':preview??draft.text+(initial!==null?` [${INITIALS[initial] ?? ""}${medial!==null?(MEDIALS[medial] ?? ""):""}]`:''),[notice,unknownNotice].filter(Boolean).join(' · '),preview===null&&!selectedControl?draftSelection(draft):undefined);
  }
  function dispatch(event:SwitchEvent){
    const previousMode=state.mode;
    const output=reduceSwitch(state,event);state=output.state;
    if(previousMode!=='paused'&&state.mode==='paused'&&selectedControl){
      pendingControlIndex=undefined;pendingControlChecked=undefined;controlPreviewIndex=0;
      state.items=[command('up','상위로'),...controlChoices(),command('pause','쉬기')];current={...current,items:state.items};
    }
    if(previousMode==='confirming'&&state.mode==='paused'){
      confirmAction=null;root();pause();return;
    }
    if(event.type==='actionResult'&&event.result==='unknown'){unknownNotice='이전 실행 결과를 확인하세요. 자동 재시도하지 않아요';cancelPeers();}
    if(output.actions.length>0){notice='';unknownNotice='';}
    render();
    for(const action of output.actions)void execute(action);
  }
  function menu(items:SwitchItem[],heading:string,mode:Menu['mode']='itemScan',push=true,includeUp=true){
    if(push)stack.push(current);
    current={title:heading,items:[...(includeUp?[command('up','상위로')]:[]),...items,command('pause','쉬기')],mode};title=heading;
    dispatch({type:'setItems',now:now(),items:current.items,mode});
  }
  function root(){phraseChange=null;if(formActive){stashField();showForm();return;}stack=[];title='스페이스바 작업판';current={title,items:groups(),mode:'groupScan'};
    dispatch({type:'setItems',now:now(),items:current.items,mode:'groupScan'});
  }
  function up(){phraseChange=null;const previous=stack.pop();if(!previous){root();return;}current=previous;title=previous.title;
    dispatch({type:'setItems',now:now(),items:previous.items,mode:previous.mode});}
  function pause(reason=''){
    phraseChange=null;
    beginOnFocus=false;
    stopScroll();confirmAction=null;cancelPeers();
    if(state.mode==='confirming'||state.resumeMode==='confirming'){root();}
    notice=reason;dispatch({type:'pause',now:now()});
  }
  function phraseConfirmation(push=true){
    if(!phraseChange)return;
    const count=phrasePreviewPages(phraseChange.expected[phraseChange.index]??'',phraseChange.kind==='replace'?phraseChange.text:undefined).length;
    menu([command('phrase-cancel','취소'),...(phrasePreviewIndex>0?[command('phrase-preview-prev','이전 미리보기')]:[]),...(phrasePreviewIndex<count-1?[command('phrase-preview-next','다음 미리보기')]:[]),command('phrase-commit',phraseChange.kind==='replace'?'확인 · 저장 문구 바꾸기':'확인 · 저장 문구 삭제')],phraseChange.kind==='replace'?'저장 문구를 바꿀까요?':'저장 문구를 삭제할까요?','confirming',push,false);
  }
  function invalidate(reason:string){
    if(formActive){stashField();formRecovery=structuredClone(workspace());if(formOrigin){loadWorkspace(formOrigin);preservedDraft=formOrigin.preservedDraft;}}
    preservedDraft ||= selected!==null || draft.text!=='' || initial!==null;
    selectedControl=null;controlPreviewIndex=0;formActive=false;formRecovering=false;formOrigin=null;formFields=[];formIndex=null;
    selected=null;capturedSelection=undefined;targets=[];confirmAction=null;
    root();pause(reason);
  }
  async function publish(){
    if(disposed)return;
    const items=opts.collector.items().map((item)=>reportSwitchItem(item,opts.collector.get(item.id)));
    const identity=await request({type:'switch/report',documentGeneration:generation,path:framePathOf(window),items}) as {tabId?:number};
    if(top&&identity.tabId!==undefined&&canRestoreDraft()){
      const readGeneration=state.modeGeneration;
      const stored=await request({type:'switch/draft/read'}) as {text?:unknown};
      if(readGeneration===state.modeGeneration&&canRestoreDraft())restoreDraft(stored.text);
    }
  }
  function canRestoreDraft(){return !disposed&&!formActive&&draft.text===''&&!preservedDraft&&selected===null&&initial===null;}
  function restoreDraft(text:unknown){if(typeof text==='string'&&text&&draft.text===''){draft=createDraft(text);preservedDraft=true;render();}}
  async function refreshTargets(startedGeneration:number){
    await publish();
    if(!active(startedGeneration))return false;
    const raw=await request({type:'switch/list'}) as {tabId:number;frames:SwitchFrameReport[]};
    if(!active(startedGeneration))return false;
    if(!Array.isArray(raw.frames))throw new Error('대상 목록을 읽지 못했어요');
    targets=snapshotTargets(raw.tabId,raw.frames);
    return true;
  }
  async function refreshAvailability(){
    if(!top||!exclusive()||targets.length===0)return;
    const startedGeneration=state.modeGeneration;
    const raw=await request({type:'switch/list'}) as {frames:SwitchFrameReport[]};
    if(disposed||startedGeneration!==state.modeGeneration||!Array.isArray(raw.frames))return;
    const items=state.items.map((item)=>{
      const isForm=item.id.startsWith('form-field:');
      if(!isForm&&!item.id.startsWith('target:'))return item;
      const snapshot=(isForm?formFields:targets).at(Number(item.id.slice(isForm?11:7)));
      const frame=raw.frames.find((entry)=>entry.frameId===snapshot?.target.frameId&&entry.documentGeneration===snapshot.target.documentGeneration);
      const live=frame?.items.find((entry)=>entry.itemId===snapshot?.target.itemId);
      const disabled=!snapshot||!live||live.identity!==snapshot.identity||live.sensitive||(isForm&&sensitiveFieldLabel(live.label));
      if(disabled===!!item.disabled)return item;
      return {...item,disabled};
    });
    if(items.some((item,index)=>item!==state.items[index])){state={...state,items};current={...current,items};notice='대상이 바뀌었어요. 목록을 새로 읽으세요';render();}
  }
  function pageMenu(page=0,onlyInputs=false){
    const all=targets.filter((t)=>!onlyInputs||t.editable);
    const start=page*6;
    const items=all.slice(start,start+6).map((t)=>command(`target:${String(targets.indexOf(t))}`,t.label+(t.sensitive?' · 민감칸':'')));
    if(page>0)items.push(command(`page:${String(page-1)}:${onlyInputs?'input':'all'}`,'이전 묶음'));
    if(start+6<all.length)items.push(command(`page:${String(page+1)}:${onlyInputs?'input':'all'}`,'다음 묶음'));
    items.push(command(`refresh:${onlyInputs?'input':'all'}`,'목록 새로 읽기'));
    menu(items,onlyInputs?'입력칸 선택':'페이지 항목','itemScan',false);
  }
  function editor(){
    if(formActive){
      formOverview=false;stack=[formMenu()];
      menu([command('hangul:initial','한글 쓰기'),command('edit:space','띄어쓰기'),command('edit:menu','수정'),command('phrases','문구'),command('apply','입력칸에 적용'),command('validity','입력 오류 읽기'),...(formIndex!==null&&formIndex>0?[command('form-prev','이전 칸')]:[]),...(formIndex!==null&&formIndex<formFields.length-1?[command('form-next','다음 칸')]:[]),command('form-list','양식 목록'),command('form-exit','원래 화면으로')],'글쓰기','composing',false);return;
    }
    stack=[{title:'스페이스바 작업판',items:groups(),mode:'groupScan'}];
    menu([command('hangul:initial','한글 쓰기'),command('edit:space','띄어쓰기'),command('edit:menu','수정'),command('phrases','문구'),command('apply','입력칸에 적용'),command('validity','입력 오류 읽기'),command('search','검색'),command('form-open','양식 한 장 보기'),...(formRecovery?[command('form-recover','양식 작성 문장 복구')]:[]),command('restore','원래 입력칸으로')],'글쓰기','composing',false);
  }
  function characterGroups(stage:'initial'|'medial'|'final'){
    const chars=stage==='initial'?INITIALS:stage==='medial'?MEDIALS:FINALS;
    menu(Array.from({length:Math.ceil(chars.length/6)},(_,i)=>command(`chars:${stage}:${String(i)}`,chars.slice(i*6,i*6+6).join(' '))),'한글 '+(stage==='initial'?'초성':stage==='medial'?'중성':'종성'),'composing');
  }
  async function saveDraft(){if(formActive)return;await request({type:'switch/draft',text:draft.text});}
  async function targetRequest(kind:SwitchTargetAction['kind'],target:SwitchTarget,extra:Partial<SwitchTargetAction>={}):Promise<PageResult>{
    const expectedIdentity=extra.expectedIdentity??targets.find((entry)=>entry.target.itemId===target.itemId&&entry.target.frameId===target.frameId)?.identity;
    if(expectedIdentity===undefined)return {result:'refused'};
    try{return resultOf(await request({type:'switch/execute',action:{actionId:newSwitchId(),kind,target,expectedIdentity,...extra,authorization:authorization()}}));}
    catch{return {result:'unknown'};}
  }
  function formMenu(page=0):Menu{
    const start=page*6;
    const items=formFields.slice(start,start+6).map((field,index)=>command(`form-field:${String(start+index)}`,field.label));
    if(page>0)items.push(command(`form-page:${String(page-1)}`,'이전 묶음'));
    if(start+6<formFields.length)items.push(command(`form-page:${String(page+1)}`,'다음 묶음'));
    items.push(command('form-refresh','양식 목록 새로 읽기'),command('form-exit','원래 화면으로'),command('pause','쉬기'));
    return {title:formFields.length?'양식 한 장 보기':'지원하는 입력칸이 없어요',items,mode:'itemScan'};
  }
  function showForm(page=0){
    selectedControl=null;controlPreviewIndex=0;pendingControlIndex=undefined;pendingControlChecked=undefined;formIndex=null;selected=null;formOverview=true;stack=[];current=formMenu(page);title=current.title;
    dispatch({type:'setItems',now:now(),items:current.items,mode:current.mode});
  }
  async function openForm(startedGeneration:number){
    if(!await refreshTargets(startedGeneration))return;
    formOrigin={...structuredClone(workspace()),selected,preservedDraft,current,stack:[...stack]};
    formActive=true;formRecovering=false;formIndex=null;selected=null;
    formFields=formTargets(targets);showForm();
  }
  function exitForm(){
    stashField();selectedControl=null;const origin=formOrigin;formActive=false;formRecovering=false;formOverview=false;formOrigin=null;formIndex=null;
    if(!origin){root();return;}
    loadWorkspace(origin);selected=origin.selected;preservedDraft=origin.preservedDraft;current=origin.current;stack=origin.stack;title=current.title;
    dispatch({type:'setItems',now:now(),items:current.items,mode:current.mode});
  }
  async function chooseField(index:number,startedGeneration:number):Promise<PageResult['result']|undefined>{
    const field=formFields[index];if(!formActive||!field)return;
    stashField();
    if(field.controlKind){
      const capture=await targetRequest('captureControl',field.target,{expectedIdentity:field.identity});
      if(!active(startedGeneration))return capture.result;
      const parsed=FormControl.safeParse(capture.control);
      if(capture.result!=='done'||!parsed.success){notice='선택칸을 다시 확인하세요';return capture.result;}
      selectedControl=parsed.data;pendingControlIndex=undefined;pendingControlChecked=undefined;controlPage=0;controlPreviewIndex=0;
      formIndex=index;selected=field;formOverview=false;stack=[formMenu()];controlMenu();return;
    }
    const capture=await targetRequest('capture',field.target,{expectedIdentity:field.identity});
    if(!active(startedGeneration))return capture.result;
    if(capture.result!=='done'||typeof capture.value!=='string'||capture.value.length>4000){notice='입력칸을 다시 확인하세요. 작성 문장은 보존했어요';return capture.result;}
    const selection=TextSelection.safeParse(capture.selection);
    const stored=formDrafts.get(field);
    loadWorkspace(stored??{draft:createDraft(capture.value,selection.success?selection.data:undefined),initial:null,medial:null,expectedValue:capture.value,capturedSelection:selection.success?selection.data:undefined});
    selectedControl=null;formRecovering=false;formIndex=index;selected=field;preservedDraft=false;editor();return;
  }
  function controlPreviewPages():string[]{
    if(selectedControl?.kind!=='select')return [];
    return phrasePreviewPages(selectedControl.options[selectedControl.selectedIndex]?.label??'고르지 않음',pendingControlIndex===undefined?undefined:selectedControl.options[pendingControlIndex]?.label).map(page=>page.replace(/^기존 문구/,'현재 선택').replace(/^바꿀 문장/,'변경안'));
  }
  function controlPreview():string{
    if(!selectedControl)return '';
    if(selectedControl.kind==='checkbox')return `현재: ${selectedControl.checked?'체크됨':'체크 안 됨'} · 변경안: ${pendingControlChecked===undefined?'고르지 않음':pendingControlChecked?'체크하기':'체크 해제하기'}`;
    return controlPreviewPages()[controlPreviewIndex]??controlPreviewPages()[0]??'';
  }
  function controlChoices():SwitchItem[]{
    if(!selectedControl)return [];
    const choices=selectedControl.kind==='select'?selectedControl.options.slice(controlPage*6,controlPage*6+6).flatMap((option,index)=>option.disabled?[]:[command(`control-option:${String(controlPage*6+index)}`,characters(option.label).length>24?`${String(controlPage*6+index+1)}. ${shortLabel(option.label)}`:option.label)]):[command('control-check','체크하기'),command('control-uncheck','체크 해제하기')];
    if(selectedControl.kind==='select'){
      if(controlPage>0)choices.push(command('control-prev-page','이전 선택 묶음'));
      if((controlPage+1)*6<selectedControl.options.length)choices.push(command('control-next-page','다음 선택 묶음'));
    }
    const previewPages=controlPreviewPages();
    if(controlPreviewIndex>0)choices.push(command('control-preview-prev','이전 항목 읽기'));
    if(controlPreviewIndex<previewPages.length-1)choices.push(command('control-preview-next','다음 항목 읽기'));
    if(pendingControlIndex!==undefined||pendingControlChecked!==undefined)choices.push(command('control-apply',selectedControl.kind==='select'?'선택값 적용':'체크 상태 적용'));
    choices.push(command('validity','입력 오류 읽기'),...(formIndex!==null&&formIndex>0?[command('form-prev','이전 칸')]:[]),...(formIndex!==null&&formIndex<formFields.length-1?[command('form-next','다음 칸')]:[]),command('form-list','양식 목록'),command('form-exit','원래 화면으로'));
    return choices;
  }
  function controlMenu(){
    if(selectedControl)menu(controlChoices(),selectedControl.kind==='select'?'선택 목록':'체크 항목','itemScan',false);
  }
  async function chooseTarget(index:number,startedGeneration:number):Promise<PageResult['result']|undefined>{
    const target=targets[index];if(!target||target.sensitive){notice='민감칸은 단일 스위치 입력을 지원하지 않아요';return;}
    if(target.controlKind){
      formOrigin={...structuredClone(workspace()),selected,preservedDraft,current,stack:[...stack]};
      formActive=true;formRecovering=false;formIndex=null;selected=null;formFields=formTargets(targets);
      return chooseField(formFields.findIndex(field=>field.target.itemId===target.target.itemId&&field.target.frameId===target.target.frameId),startedGeneration);
    }
    if(target.editable){
      const capture=await targetRequest('capture',target.target);
      if(!active(startedGeneration))return capture.result;
      if(capture.result!=='done'||typeof capture.value!=='string'){notice='입력칸을 다시 선택하세요';return capture.result;}
      selected=target;expectedValue=capture.value;
      const selection=TextSelection.safeParse(capture.selection);capturedSelection=selection.success?selection.data:undefined;
      if(!preservedDraft)draft=createDraft(capture.value,capturedSelection);
      preservedDraft=false;editor();return;
    }
    const action:SwitchTargetAction={actionId:newSwitchId(),kind:'press',target:target.target,expectedIdentity:target.identity,confirmed:true,authorization:authorization()};
    if(target.danger||!['a','link'].includes(target.kind)){
      confirmAction=action;confirmOpenedAt=now();
      menu([command('confirm:cancel','취소'),command('confirm:run',target.label)],`${target.label}할까요?`,'confirming');
      return;
    }
    const result=await targetRequest('press',target.target);
    if(!active(startedGeneration))return result.result;
    if(result.result!=='done')notice=result.result==='unknown'?'실행 결과를 확인하세요. 자동 재시도하지 않아요':'대상이 바뀌었어요. 목록을 새로 읽으세요';
    return result.result;
  }
  async function handleCommand(id:string,startedGeneration:number):Promise<PageResult['result']|undefined>{
    if(id==='up'){if(state.resumeMode==='confirming')confirmAction=null;if(formActive&&stack.length===1){stashField();showForm();}else up();return;}
    if(id==='pause'){pause();return;}
    if(id==='helper-off'){
      pause('도우미를 끄는 중이에요');
      try {
        const result=await request({type:'storage/request',op:{kind:'setEnabled',enabled:false}}) as {ok?:boolean};
        if(result.ok!==true) notice='끄지 못했어요. 브라우저 확장 관리에서 도우미를 끄고 페이지를 새로고침하세요';
      } catch { notice='끄지 못했어요. 브라우저 확장 관리에서 도우미를 끄고 페이지를 새로고침하세요'; }
      render();return;
    }
    if(id.startsWith('group:')){
      const group=Number(id.split(':')[1]);
      if(group===0||group===1){stack.push(current);if(await refreshTargets(startedGeneration))pageMenu(0,group===0);}
      if(group===2)menu([command('scroll:down','한 화면 아래'),command('scroll:up','한 화면 위'),command('scroll:auto','자동 스크롤'),command('nav:back','뒤로'),command('nav:tabs','열린 탭')],'읽기·이동');
      if(group===3){if(selected||draft.text||initial!==null)editor();else menu([command('choose-input','입력칸 선택'),command('draft:new','새 문장'),command('form-open','양식 한 장 보기'),...(formRecovery?[command('form-recover','양식 작성 문장 복구')]:[])],'글쓰기');}
      if(group===4)menu([command('helper-off','도우미 끄기 · 페이지 입력 돌려주기'),command('speed','순환 속도'),command('protection','입력 간격 보호'),command('pause','쉬기'),command('pointer','마우스 조작으로 전환 · 스페이스바 작업판 종료')],'조절·쉬기');
      return;
    }
    if(id==='form-recover'){
      if(formRecovery){formOrigin={...structuredClone(workspace()),selected,preservedDraft,current,stack:[...stack]};formActive=true;formRecovering=true;formFields=[];formIndex=null;selected=null;loadWorkspace(formRecovery);preservedDraft=true;editor();}return;
    }
    if(id.startsWith('control-option:')){if(selectedControl?.kind==='select'){const index=Number(id.slice(15));if(selectedControl.options[index]&&!selectedControl.options[index].disabled){pendingControlIndex=index;controlPreviewIndex=phrasePreviewPages(selectedControl.options[selectedControl.selectedIndex]?.label??'고르지 않음').length;controlMenu();}}return;}
    if(id==='control-preview-prev'||id==='control-preview-next'){controlPreviewIndex=Math.max(0,Math.min(controlPreviewPages().length-1,controlPreviewIndex+(id==='control-preview-next'?1:-1)));controlMenu();return;}
    if(id==='control-check'||id==='control-uncheck'){if(selectedControl?.kind==='checkbox'){pendingControlChecked=id==='control-check';controlMenu();}return;}
    if(id==='control-prev-page'||id==='control-next-page'){controlPage+=id==='control-next-page'?1:-1;controlMenu();return;}
    if(id==='control-apply'){
      if(!selected||!selectedControl)return;
      const result=await targetRequest('applyControl',selected.target,{expectedIdentity:selected.identity,control:selectedControl,...(pendingControlIndex!==undefined?{controlIndex:pendingControlIndex}:{}),...(pendingControlChecked!==undefined?{controlChecked:pendingControlChecked}:{})});
      if(!active(startedGeneration))return result.result;
      if(result.result==='unknown'){showForm();unknownNotice='이전 실행 결과를 확인하세요. 자동 재시도하지 않아요';pause();return 'unknown';}
      if(result.result!=='done'){pendingControlIndex=undefined;pendingControlChecked=undefined;controlPreviewIndex=0;controlMenu();notice='선택칸이 바뀌었어요. 목록에서 다시 선택하세요';return result.result;}
      if(selectedControl.kind==='select'&&pendingControlIndex!==undefined)selectedControl={...selectedControl,selectedIndex:pendingControlIndex};
      if(selectedControl.kind==='checkbox'&&pendingControlChecked!==undefined)selectedControl={...selectedControl,checked:pendingControlChecked};
      pendingControlIndex=undefined;pendingControlChecked=undefined;controlPreviewIndex=0;controlMenu();notice='적용했어요';return;
    }
    if(id==='validity'){
      if(!selected){notice='입력칸을 먼저 선택하세요';return;}
      const result=await targetRequest('readValidity',selected.target,{expectedIdentity:selected.identity});
      if(!active(startedGeneration))return result.result;
      notice=result.result==='done'&&typeof result.validation==='string'?result.validation.slice(0,300):'입력칸을 다시 선택하세요';return result.result;
    }
    if(id==='form-open'){await openForm(startedGeneration);return;}
    if(id==='form-exit'){exitForm();return;}
    if(id==='form-list'){stashField();showForm();return;}
    if(id==='form-prev'||id==='form-next'){if(formIndex!==null)return chooseField(formIndex+(id==='form-next'?1:-1),startedGeneration);return;}
    if(id.startsWith('form-field:'))return chooseField(Number(id.slice(11)),startedGeneration);
    if(id.startsWith('form-page:')){showForm(Number(id.slice(10)));return;}
    if(id==='form-refresh'){
      stashField();if(await refreshTargets(startedGeneration)){formFields=formTargets(targets);formIndex=null;selected=null;showForm();}return;
    }
    if(id==='choose-input'){stack.push(current);if(await refreshTargets(startedGeneration))pageMenu(0,true);return;}
    if(id.startsWith('target:'))return chooseTarget(Number(id.split(':')[1]),startedGeneration);
    if(id.startsWith('page:')){const parts=id.split(':');pageMenu(Number(parts[1]),parts[2]==='input');return;}
    if(id.startsWith('refresh:')){if(await refreshTargets(startedGeneration))pageMenu(0,id.endsWith('input'));return;}
    if(id==='draft:new'){draft=createDraft();initial=null;medial=null;preservedDraft=true;editor();await saveDraft();return;}
    if(id.startsWith('hangul:')){characterGroups(medial!==null?'final':initial!==null?'medial':'initial');return;}
    if(id.startsWith('chars:')){const [,stage,page]=id.split(':');const chars=stage==='initial'?INITIALS:stage==='medial'?MEDIALS:FINALS;
      menu(chars.slice(Number(page)*6,Number(page)*6+6).map((label,i)=>command(`char:${stage ?? "initial"}:${String(Number(page)*6+i)}`,label)),'한글 선택','composing');return;}
    if(id.startsWith('char:')){const [,stage,index]=id.split(':');
      if(stage==='initial'){initial=Number(index);characterGroups('medial');}
      else if(stage==='medial'){medial=Number(index);characterGroups('final');}
      else if(initial!==null&&medial!==null){draft=editDraft(draft,{type:'insert',text:composeHangul(initial,medial,Number(index))});initial=null;medial=null;editor();await saveDraft();}return;}
    if(id==='edit:menu'){menu([command('edit:left','앞 글자'),command('edit:right','뒤 글자'),command('edit:delete','앞 글자 삭제'),command('edit:undo','입력 되돌리기'),command('compose:cancel','조합 한 단계 취소'),command('draft:discard','문장 버리기')],'수정','composing');return;}
    if(id==='compose:cancel'){if(medial!==null)medial=null;else initial=null;editor();return;}
    if(id==='draft:discard'){menu([command('up','취소'),command('discard:run','문장 버리기')],'문장을 버릴까요?','composing');return;}
    if(id==='discard:run'){draft=createDraft();initial=null;medial=null;editor();await saveDraft();return;}
    if(id==='edit:delete'&&(initial!==null||medial!==null)){if(medial!==null)medial=null;else initial=null;return;}
    if(id.startsWith('edit:')){const kind=id.slice(5);const edit:DraftEdit=kind==='space'?{type:'insert',text:' '}:{type:kind as 'left'|'right'|'delete'|'undo'};draft=editDraft(draft,edit);await saveDraft();return;}
    if(id==='phrases'){const data=await chrome.storage.local.get('switchPhrases');const parsed=PhraseList.safeParse(data.switchPhrases??[]);
      if(!active(startedGeneration))return;
      if(!parsed.success){notice='문구 목록을 읽지 못했어요. 저장된 값을 보존했어요';return;}
      phraseSnapshot=parsed.data;
      menu([...phraseSnapshot.map((text,i)=>command(`phrase:${String(i)}`,text)),command('phrase:save','문구 저장'),command('phrase-manage','문구 관리')],'문구','composing');return;}
    if(id==='phrase:save'){
      if(!draft.text||draft.text.length>1000){notice='문구는 1~1000자로 저장하세요. 문장은 보존했어요';return;}
      const result=await request({type:'switch/phrase',text:draft.text,authorization:authorization()}) as {ok?:boolean};
      if(active(startedGeneration))notice=result.ok===true?'문구를 저장했어요':'저장하지 않았어요. 문구 목록을 다시 여세요';return;
    }
    if(id==='phrase-manage'){menu(phraseSnapshot.map((text,i)=>command(`phrase-target:${String(i)}`,text)),'저장 문구 관리','composing');return;}
    if(id.startsWith('phrase-target:')){phraseIndex=Number(id.split(':')[1]);if(phraseSnapshot[phraseIndex]!==undefined)menu([command('phrase-replace','현재 문장으로 바꾸기'),command('phrase-remove','저장 문구 삭제')],'문구 관리 · 문장 보존','composing');return;}
    if(id==='phrase-replace'||id==='phrase-remove'){
      if(phraseIndex===null||phraseSnapshot[phraseIndex]===undefined)return;
      if(id==='phrase-replace'&&(!draft.text||draft.text.length>1000||initial!==null||medial!==null)){notice='완성된 1~1000자 문장으로 바꾸세요. 작성 문장은 보존했어요';return;}
      phraseChange=id==='phrase-replace'?{kind:'replace',expected:[...phraseSnapshot],index:phraseIndex,text:draft.text}:{kind:'remove',expected:[...phraseSnapshot],index:phraseIndex};
      phrasePreviewIndex=0;confirmOpenedAt=now();phraseConfirmation();return;
    }
    if(id==='phrase-preview-next'||id==='phrase-preview-prev'){if(phraseChange){phrasePreviewIndex+=id==='phrase-preview-next'?1:-1;phraseConfirmation(false);}return;}
    if(id==='phrase-cancel'){up();return;}
    if(id==='phrase-commit'){
      const mutation=phraseChange;phraseChange=null;if(!mutation)return;
      const result=await request({type:'switch/phrase/update',mutation,authorization:authorization()}) as {ok?:boolean};
      if(!active(startedGeneration))return;
      editor();notice=result.ok===true?'저장 문구를 변경했어요':'저장하지 않았어요. 문구 목록을 다시 여세요';return;
    }
    if(id.startsWith('phrase:')){const text=phraseSnapshot[Number(id.split(':')[1])];if(typeof text==='string'){draft=editDraft(draft,{type:'insert',text});editor();await saveDraft();}return;}
    if(id==='restore'){
      if(!selected){notice='입력칸을 먼저 선택하세요';return;}
      const result=await targetRequest('restoreText',selected.target,{expectedValue,selection:capturedSelection,expectedIdentity:selected.identity});
      if(!active(startedGeneration))return result.result;
      if(result.result!=='done'){notice='입력칸이 바뀌었어요. 초안을 보존했으니 다시 선택하세요';preservedDraft=true;selected=null;}
      return result.result;
    }
    if(id==='apply'||id==='search'){
      if(!selected){notice='입력칸을 먼저 선택하세요';return;}
      const result=await targetRequest('applyText',selected.target,{text:draft.text,expectedValue,selection:draftSelection(draft),expectedIdentity:selected.identity});
      if(!active(startedGeneration))return result.result;
      if(result.result!=='done'){notice='입력칸이 바뀌었어요. 초안을 보존했으니 다시 선택하세요';preservedDraft=true;selected=null;return result.result;}
      expectedValue=draft.text;capturedSelection=draftSelection(draft);notice='입력했어요';
      if(id==='search'){await saveDraft();if(!active(startedGeneration))return;const result=await targetRequest('search',selected.target,{expectedValue});if(!active(startedGeneration))return;if(result.result!=='done')notice='이 입력칸의 검색 동작을 지원하지 않아요';return result.result;}return;
    }
    if(id.startsWith('scroll:')){if(id==='scroll:auto'){state.mode='scrolling';scrollTimer=setInterval(()=> { window.scrollBy(0,2); },30);}else window.scrollBy(0,(id.endsWith('up')?-1:1)*window.innerHeight*0.8);return;}
    if(id==='nav:back'){await saveDraft();if(!active(startedGeneration))return;return resultOf(await request({type:'switch/navigation',kind:'back'})).result;}
    if(id==='nav:tabs'){const raw=await request({type:'switch/navigation',kind:'tabs'}) as {tabs:Array<{id:number;title:string}>};if(active(startedGeneration))menu(raw.tabs.map((tab)=>command(`tab:${String(tab.id)}`,tab.title)),'열린 탭');return;}
    if(id.startsWith('tab:')){await saveDraft();if(!active(startedGeneration))return;pause();const result=resultOf(await request({type:'switch/navigation',kind:'activate',tabId:Number(id.split(':')[1])}));if(result.result!=='done')notice='탭을 다시 선택하세요';return;}
    if(id==='speed'){menu([800,1500,2500,4000].map((ms)=>command(`speed:${String(ms)}`,`${String(ms/1000)}초`)),'순환 속도');return;}
    if(id==='protection'){menu([100,300,600,1000].map((ms)=>command(`protection:${String(ms)}`,`${String(ms/1000)}초`)),'입력 간격 보호');return;}
    if(id.startsWith('speed:')||id.startsWith('protection:')){const ms=Number(id.split(':')[1]);const value={...settings,...(id.startsWith('speed:')?{intervalMs:ms}:{protectionMs:ms})};await request({type:'switch/settings',value});up();return;}
    if(id==='pointer'){await request({type:'switch/settings',value:{...settings,mode:'pointer'}});return;}
    if(id==='confirm:cancel'){confirmAction=null;up();return;}
    if(id==='confirm:run'){const action=confirmAction;confirmAction=null;if(action){const result=resultOf(await request({type:'switch/execute',action:{...action,authorization:authorization()}}));if(!active(startedGeneration))return;if(result.result!=='done'){notice='결과를 확인하세요. 자동 재시도하지 않아요';return result.result;}up();}return;}
  }
  async function execute(action:SwitchAction){
    const startedGeneration=state.modeGeneration;
    try{
      if(action.kind==='scrollStop'){stopScroll();state.mode='itemScan';state.pendingAction=null;state.changedAt=now();render();return;}
      const result=action.kind==='command'?await handleCommand(action.itemId??'',startedGeneration):'refused';
      if(disposed)return;
      if(state.modeGeneration!==startedGeneration){
        if(result==='unknown'&&state.mode==='paused'){unknownNotice='이전 실행 결과를 확인하세요. 자동 재시도하지 않아요';render();}
        return;
      }
      if(!scrollTimer)dispatch({type:'actionResult',now:now(),actionId:action.actionId,result:result??'done'});
      else state.pendingAction=null;
    }catch(error){console.error('Switch action failed',error instanceof Error?error.message:String(error));if(!disposed&&state.modeGeneration===startedGeneration){notice='처리 결과를 확인하세요. 자동 재시도하지 않아요';dispatch({type:'actionResult',now:now(),actionId:action.actionId,result:'unknown'});}}
  }
  function consume(kind:'keyDown'|'keyUp',event:KeyboardEvent){
    if(!exclusive()||event.code!=='Space'||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return false;
    const modified=false;
    if(top){
      if(state.mode==='confirming'&&now()-confirmOpenedAt<1000)return true;
      dispatch({type:kind,now:now(),code:'Space',trusted:event.isTrusted,repeat:event.repeat,isComposing:event.isComposing,modified});
    }else void request({type:'switch/key',kind,repeat:event.repeat,isComposing:event.isComposing,modified}).catch(()=>undefined);
    return true;
  }
  const messageHandler=(raw:unknown,sender:chrome.runtime.MessageSender,sendResponse:(response?:unknown)=>void):boolean|undefined=>{
    if(sender.id!==chrome.runtime.id)return undefined;
    const parsed=SwitchMessage.safeParse(raw);if(!parsed.success)return undefined;const message=parsed.data;
    if(message.type==='switch/begin'){
      if(!top||!exclusive()||message.url!==location.href){sendResponse({result:'refused'});return undefined;}
      // 팝업을 닫아 페이지 초점이 돌아왔을 때 그룹 순환만 시작한다. 사이트 동작은 선택하지 않는다.
      invalidate('');beginOnFocus=true;
      if(document.hasFocus()&&!document.hidden){beginOnFocus=false;root();}
      sendResponse({result:'done'});return undefined;
    }
    if(message.type==='switch/action-check'){
      sendResponse({result:top&&exclusive()&&state.mode==='executing'&&state.pendingAction!==null&&message.authorization.documentGeneration===generation&&message.authorization.modeGeneration===state.modeGeneration&&message.authorization.pendingActionId===state.pendingAction.actionId?'done':'refused'});return undefined;
    }
    if(message.type==='switch/frame-check'){
      sendResponse({result:exclusive()&&message.documentGeneration===generation&&visibleSwitchChild(message.childIndex)?'done':'refused'});return undefined;
    }
    if(message.type==='switch/key'&&top&&exclusive()){
      if(state.mode!=='confirming'||now()-confirmOpenedAt>=1000)dispatch({type:message.kind,now:now(),code:'Space',trusted:true,repeat:message.repeat,isComposing:message.isComposing,modified:message.modified});return undefined;
    }
    if(message.type==='switch/pause'){if(exclusive()){if(top&&message.invalidate)invalidate('페이지가 바뀌었어요. 대상을 다시 선택하세요');else pause();}sendResponse({result:'done'});return undefined;}
    if(message.type==='switch/refresh'&&top){void refreshAvailability().catch(()=>undefined);return undefined;}
    if(message.type==='switch/execute'){
      const action=message.action;
      if(!exclusive()||!gate.accept(action.actionId,action.target.documentGeneration)){sendResponse({result:'refused'});return undefined;}
      const authorized=()=>exclusive()&&state.mode==='executing'&&state.pendingAction!==null&&action.authorization.documentGeneration===generation&&action.authorization.modeGeneration===state.modeGeneration&&action.authorization.pendingActionId===state.pendingAction.actionId;
      if(!top){
        const localGeneration=state.modeGeneration;
        void request({type:'switch/action-check',authorization:action.authorization}).then((raw)=>{
          const result=resultOf(raw).result==='done'&&exclusive()&&localGeneration===state.modeGeneration?executeSwitchAction(opts.collector,action):{result:'refused'};
          sendResponse(result);
        }).catch(()=>{sendResponse({result:'unknown'});}).finally(()=>{gate.finish(action.actionId);});
        return true;
      }
      let result:PageResult={result:'unknown'};
      try{result=authorized()?executeSwitchAction(opts.collector,action):{result:'refused'};}
      catch{result={result:'unknown'};}
      finally{gate.finish(action.actionId);}
      sendResponse(result);return undefined;
    }
    return undefined;
  };
  function applySettings(value:unknown){
    if(settingsLoaded)pause();
    settingsLoaded=true;
    const parsed=SwitchSettings.safeParse(value);settings=parsed.success?parsed.data:defaultSwitchSettings();
    state.intervalMs=settings.intervalMs;state.protectionMs=settings.protectionMs;
    stopScroll();state.pressed=null;state.pendingAction=null;state.modeGeneration++;
    if(exclusive()){opts.onExclusive();render();void publish().catch(()=>undefined);}else{panel?.destroy();panel=null;}
  }
  const storageHandler=(changes:Record<string,chrome.storage.StorageChange>,area:string)=>{if(area==='local'&&changes[SWITCH_SETTINGS_KEY])applySettings(changes[SWITCH_SETTINGS_KEY].newValue);};
  opts.pipeline.setSwitchHandler(consume);opts.pipeline.setSwitchExclusive(exclusive);
  chrome.runtime.onMessage.addListener(messageHandler);chrome.storage.onChanged.addListener(storageHandler);
  void chrome.storage.local.get(SWITCH_SETTINGS_KEY).then((stored)=> { applySettings(stored[SWITCH_SETTINGS_KEY]); });
  opts.collector.onChange(()=>{void publish().catch(()=>undefined);});
  const timer=setInterval(()=>{if(top&&exclusive())dispatch({type:'tick',now:now()});},100);
  window.addEventListener('blur',()=>{if(exclusive()){if(top)pause();else {pause();void request({type:'switch/pause'}).catch(()=>undefined);}}},{signal:opts.signal});
  window.addEventListener('focus',()=>{if(beginOnFocus&&top&&exclusive()&&!document.hidden){beginOnFocus=false;root();}},{signal:opts.signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&exclusive())pause();},{signal:opts.signal});
  const frameObserver=new MutationObserver((records)=>{
    if(!exclusive())return;
    const hasFrame=(node:Node)=>node instanceof Element&&(node.matches('iframe')||node.querySelector('iframe')!==null);
    if(records.some((record)=>record.type==='attributes'&&hasFrame(record.target)
        ||Array.from(record.addedNodes).some(hasFrame)||Array.from(record.removedNodes).some(hasFrame))){
      if(top)invalidate('페이지가 바뀌었어요. 대상을 다시 선택하세요');
      else void request({type:'switch/pause'}).catch(()=>undefined);
    }
  });
  frameObserver.observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['src','srcdoc','hidden','inert','style','class']});
  opts.signal.addEventListener('abort',()=>{disposed=true;stopScroll();clearInterval(timer);frameObserver.disconnect();panel?.destroy();chrome.runtime.onMessage.removeListener(messageHandler);chrome.storage.onChanged.removeListener(storageHandler);});
  return {exclusive,pause,
    enabledChanged:()=>{invalidate('조작을 쉬고 있어요. 스페이스바로 다시 선택하세요');panel?.destroy();panel=null;if(exclusive()){opts.onExclusive();render();void publish().catch(()=>undefined);}},
    connectionLost:()=>{if(exclusive())invalidate('연결이 바뀌었어요. 실행 결과를 확인하고 다시 선택하세요');}};
}
