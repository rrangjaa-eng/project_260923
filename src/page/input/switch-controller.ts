import { createSwitchState, reduceSwitch, type SwitchEvent, type SwitchItem, type SwitchAction, type SwitchTarget } from '@/core/switch-engine';
import { defaultSwitchSettings, SwitchSettings, SWITCH_SETTINGS_KEY } from '@/core/switch-settings';
import { snapshotTargets, type ScanTarget } from '@/core/switch-order';
import { createActionGate } from '@/core/switch-actions';
import { createDraft, editDraft, type TextDraft, type DraftEdit } from '@/core/text-draft';
import { composeHangul, INITIALS, MEDIALS, FINALS } from '@/core/hangul-compose';
import { framePathOf } from '@/core/frame-path';
import { SwitchMessage, type SwitchFrameReport, type SwitchTargetAction } from '@/shared/switch-messages';
import type { Collector } from '@/page/collector/collector';
import type { InputPipeline } from './pipeline';
import { createSwitchPanel } from '@/page/overlay/switch-panel';
import { captureTextTarget, applyDraft, typingElement, sensitiveElement } from './text-target';
import { synthesizePress } from '@/page/click/press';

const now=()=>performance.now();
const newSwitchId=()=>Array.from(crypto.getRandomValues(new Uint32Array(4)),(n)=>n.toString(16)).join('-');
const command=(id:string,label:string):SwitchItem=>({id,label,action:{kind:'command'}});
const groups=()=>['찾기','페이지 항목','읽기·이동','글쓰기','조절·쉬기'].map((label,i)=>command(`group:${String(i)}`,label));
async function request(message: unknown):Promise<unknown>{
  let timeout:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([chrome.runtime.sendMessage(message),new Promise((_,reject)=>{timeout=setTimeout(()=> { reject(new Error('response-timeout')); },3000);})]);}
  finally{if(timeout)clearTimeout(timeout);}
}
type PageResult={result:'done'|'refused'|'unknown';value?:string};
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
  let state=createSwitchState();
  state.items=groups();
  let panel:ReturnType<typeof createSwitchPanel>|null=null;
  let title='스페이스바 작업판',notice='';
  let current:Menu={title,items:groups(),mode:'groupScan'};
  let stack:Menu[]=[];
  let targets:ScanTarget[]=[];
  let selected:ScanTarget|null=null;
  let expectedValue='';
  let draft:TextDraft=createDraft();
  let initial:number|null=null,medial:number|null=null;
  let preservedDraft=false;
  let confirmAction:SwitchTargetAction|null=null;
  let confirmOpenedAt=0;
  let scrollTimer:ReturnType<typeof setInterval>|null=null;
  let disposed=false;
  const exclusive=()=>!disposed&&settings.mode==='switch'&&opts.enabled();
  const stopScroll=()=>{if(scrollTimer)clearInterval(scrollTimer);scrollTimer=null;};
  function render(){if(!top||!exclusive())return;
    panel??=createSwitchPanel();
    panel.render(state,title,draft.text+(initial!==null?` [${INITIALS[initial] ?? ""}${medial!==null?(MEDIALS[medial] ?? ""):""}]`:''),notice);
  }
  function dispatch(event:SwitchEvent){
    const output=reduceSwitch(state,event);state=output.state;render();
    for(const action of output.actions)void execute(action);
  }
  function menu(items:SwitchItem[],heading:string,mode:Menu['mode']='itemScan',push=true){
    if(push)stack.push(current);
    current={title:heading,items:[command('up','상위로'),...items,command('pause','쉬기')],mode};title=heading;
    dispatch({type:'setItems',now:now(),items:current.items,mode});
  }
  function root(){stack=[];title='스페이스바 작업판';current={title,items:groups(),mode:'groupScan'};
    dispatch({type:'setItems',now:now(),items:current.items,mode:'groupScan'});
  }
  function up(){const previous=stack.pop();if(!previous){root();return;}current=previous;title=previous.title;
    dispatch({type:'setItems',now:now(),items:previous.items,mode:previous.mode});}
  function pause(reason=''){
    stopScroll();confirmAction=null;
    if(state.mode==='confirming'){root();}
    notice=reason;dispatch({type:'pause',now:now()});
  }
  async function publish(){
    if(disposed)return;
    const items=opts.collector.items().map((item)=>{
      const el=opts.collector.get(item.id);
      return {itemId:item.id,label:(item.name||item.fingerprint.buttonText||item.kind).slice(0,300),kind:item.kind,danger:item.danger,
        editable:typingElement(el),sensitive:!!el&&sensitiveElement(el)};
    });
    const identity=await request({type:'switch/report',documentGeneration:generation,path:framePathOf(window),items}) as {tabId?:number};
    if(top&&identity.tabId!==undefined&&draft.text===''){
      const stored=await request({type:'switch/draft/read'}) as {text?:unknown};
      const text=stored.text;
      restoreDraft(text);
    }
  }
  function restoreDraft(text:unknown){if(typeof text==='string'&&text&&draft.text===''){draft=createDraft(text);preservedDraft=true;render();}}
  async function refreshTargets(){
    await publish();
    const raw=await request({type:'switch/list'}) as {tabId:number;frames:SwitchFrameReport[]};
    if(!Array.isArray(raw.frames))throw new Error('대상 목록을 읽지 못했어요');
    targets=snapshotTargets(raw.tabId,raw.frames);
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
  function editor(){menu([command('hangul:initial','한글 쓰기'),command('edit:space','띄어쓰기'),command('edit:menu','수정'),command('phrases','문구'),command('apply','입력칸에 적용'),command('search','검색')],'글쓰기','composing',false);}
  function characterGroups(stage:'initial'|'medial'|'final'){
    const chars=stage==='initial'?INITIALS:stage==='medial'?MEDIALS:FINALS;
    menu(Array.from({length:Math.ceil(chars.length/6)},(_,i)=>command(`chars:${stage}:${String(i)}`,chars.slice(i*6,i*6+6).join(' '))),'한글 '+(stage==='initial'?'초성':stage==='medial'?'중성':'종성'),'composing');
  }
  async function saveDraft(){await request({type:'switch/draft',text:draft.text});}
  async function targetRequest(kind:SwitchTargetAction['kind'],target:SwitchTarget,extra:Partial<SwitchTargetAction>={}):Promise<PageResult>{
    try{return resultOf(await request({type:'switch/execute',action:{actionId:newSwitchId(),kind,target,...extra}}));}
    catch{return {result:'unknown'};}
  }
  async function chooseTarget(index:number){
    const target=targets[index];if(!target||target.sensitive){notice='민감칸은 단일 스위치 입력을 지원하지 않아요';return;}
    if(target.editable){
      const capture=await targetRequest('capture',target.target);
      if(capture.result!=='done'||typeof capture.value!=='string'){notice='입력칸을 다시 선택하세요';return;}
      selected=target;expectedValue=capture.value;
      if(!preservedDraft)draft=createDraft(capture.value);
      preservedDraft=false;editor();return;
    }
    const action:SwitchTargetAction={actionId:newSwitchId(),kind:'press',target:target.target};
    if(target.danger||!['a','link'].includes(target.kind)){
      confirmAction=action;confirmOpenedAt=now();
      menu([command('confirm:cancel','취소'),command('confirm:run',target.label)],`${target.label}할까요?`,'confirming');
      return;
    }
    const result=await targetRequest('press',target.target);
    if(result.result!=='done')notice=result.result==='unknown'?'실행 결과를 확인하세요. 자동 재시도하지 않아요':'대상이 바뀌었어요. 목록을 새로 읽으세요';
  }
  async function handleCommand(id:string){
    if(id==='up'){if(state.resumeMode==='confirming')confirmAction=null;up();return;}
    if(id==='pause'){pause();return;}
    if(id.startsWith('group:')){
      const group=Number(id.split(':')[1]);
      if(group===0||group===1){stack.push(current);await refreshTargets();pageMenu(0,group===0);}
      if(group===2)menu([command('scroll:down','한 화면 아래'),command('scroll:up','한 화면 위'),command('scroll:auto','자동 스크롤'),command('nav:back','뒤로'),command('nav:tabs','열린 탭')],'읽기·이동');
      if(group===3){if(selected)editor();else menu([command('choose-input','입력칸 선택'),command('draft:new','새 문장')],'글쓰기');}
      if(group===4)menu([command('speed','순환 속도'),command('protection','입력 간격 보호'),command('pause','쉬기'),command('pointer','마우스 조작으로 전환')],'조절·쉬기');
      return;
    }
    if(id==='choose-input'){stack.push(current);await refreshTargets();pageMenu(0,true);return;}
    if(id.startsWith('target:')){await chooseTarget(Number(id.split(':')[1]));return;}
    if(id.startsWith('page:')){const parts=id.split(':');pageMenu(Number(parts[1]),parts[2]==='input');return;}
    if(id.startsWith('refresh:')){await refreshTargets();pageMenu(0,id.endsWith('input'));return;}
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
    if(id.startsWith('edit:')){const kind=id.slice(5);const edit:DraftEdit=kind==='space'?{type:'insert',text:' '}:{type:kind as 'left'|'right'|'delete'|'undo'};draft=editDraft(draft,edit);await saveDraft();return;}
    if(id==='phrases'){const data=await chrome.storage.local.get('switchPhrases');const phrases=Array.isArray(data.switchPhrases)?data.switchPhrases.filter((p):p is string=>typeof p==='string'):[];
      menu([...phrases.map((text,i)=>command(`phrase:${String(i)}`,text)),command('phrase:save','문구 저장')],'문구','composing');return;}
    if(id==='phrase:save'){if(draft.text)await request({type:'switch/phrase',text:draft.text.slice(0,1000)});notice='문구를 저장했어요';return;}
    if(id.startsWith('phrase:')){const data=await chrome.storage.local.get('switchPhrases');const text=(data.switchPhrases as string[]|undefined)?.[Number(id.split(':')[1])];if(typeof text==='string'){draft=editDraft(draft,{type:'insert',text});editor();await saveDraft();}return;}
    if(id==='apply'||id==='search'){
      if(!selected){notice='입력칸을 먼저 선택하세요';return;}
      const result=await targetRequest('applyText',selected.target,{text:draft.text,expectedValue});
      if(result.result!=='done'){notice='입력칸이 바뀌었어요. 초안을 보존했으니 다시 선택하세요';preservedDraft=true;selected=null;return;}
      expectedValue=draft.text;notice='입력했어요';
      if(id==='search'){await saveDraft();const result=await targetRequest('search',selected.target,{expectedValue});if(result.result!=='done')notice='이 입력칸의 검색 동작을 지원하지 않아요';}return;
    }
    if(id.startsWith('scroll:')){if(id==='scroll:auto'){state.mode='scrolling';scrollTimer=setInterval(()=> { window.scrollBy(0,2); },30);}else window.scrollBy(0,(id.endsWith('up')?-1:1)*window.innerHeight*0.8);return;}
    if(id==='nav:back'){await saveDraft();await request({type:'switch/navigation',kind:'back'});return;}
    if(id==='nav:tabs'){const raw=await request({type:'switch/navigation',kind:'tabs'}) as {tabs:Array<{id:number;title:string}>};menu(raw.tabs.map((tab)=>command(`tab:${String(tab.id)}`,tab.title)),'열린 탭');return;}
    if(id.startsWith('tab:')){await saveDraft();pause();const result=resultOf(await request({type:'switch/navigation',kind:'activate',tabId:Number(id.split(':')[1])}));if(result.result!=='done')notice='탭을 다시 선택하세요';return;}
    if(id==='speed'){menu([800,1500,2500,4000].map((ms)=>command(`speed:${String(ms)}`,`${String(ms/1000)}초`)),'순환 속도');return;}
    if(id==='protection'){menu([100,300,600,1000].map((ms)=>command(`protection:${String(ms)}`,`${String(ms/1000)}초`)),'입력 간격 보호');return;}
    if(id.startsWith('speed:')||id.startsWith('protection:')){const ms=Number(id.split(':')[1]);const value={...settings,...(id.startsWith('speed:')?{intervalMs:ms}:{protectionMs:ms})};await request({type:'switch/settings',value});up();return;}
    if(id==='pointer'){await request({type:'switch/settings',value:{...settings,mode:'pointer'}});return;}
    if(id==='confirm:cancel'){confirmAction=null;up();return;}
    if(id==='confirm:run'){const action=confirmAction;confirmAction=null;if(action){const result=resultOf(await request({type:'switch/execute',action}));if(result.result!=='done'){notice='결과를 확인하세요. 자동 재시도하지 않아요';pause(notice);}else up();}return;}
  }
  async function execute(action:SwitchAction){
    const startedGeneration=state.modeGeneration;
    try{
      if(action.kind==='scrollStop'){stopScroll();state.mode='itemScan';state.pendingAction=null;state.changedAt=now();render();return;}
      if(action.kind==='command')await handleCommand(action.itemId??'');
      if(disposed||state.modeGeneration!==startedGeneration)return;
      if(!scrollTimer)dispatch({type:'actionResult',now:now(),actionId:action.actionId,result:'done'});
      else state.pendingAction=null;
    }catch(error){console.error('Switch action failed',error instanceof Error?error.message:String(error));if(!disposed&&state.modeGeneration===startedGeneration){notice='처리 결과를 확인하세요. 자동 재시도하지 않아요';dispatch({type:'actionResult',now:now(),actionId:action.actionId,result:'unknown'});}}
  }
  function consume(kind:'keyDown'|'keyUp',event:KeyboardEvent){
    if(!exclusive()||event.code!=='Space'||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return false;
    const modified=false;
    if(top){
      if(state.mode==='confirming'&&now()-confirmOpenedAt<1000)return true;
      notice='';dispatch({type:kind,now:now(),code:'Space',trusted:event.isTrusted,repeat:event.repeat,isComposing:event.isComposing,modified});
    }else void request({type:'switch/key',kind,repeat:event.repeat,isComposing:event.isComposing,modified}).catch(()=>undefined);
    return true;
  }
  const messageHandler=(raw:unknown,sender:chrome.runtime.MessageSender,sendResponse:(response?:unknown)=>void):boolean|undefined=>{
    if(sender.id!==chrome.runtime.id)return undefined;
    const parsed=SwitchMessage.safeParse(raw);if(!parsed.success)return undefined;const message=parsed.data;
    if(message.type==='switch/key'&&top&&exclusive()){
      if(state.mode!=='confirming'||now()-confirmOpenedAt>=1000)dispatch({type:message.kind,now:now(),code:'Space',trusted:true,repeat:message.repeat,isComposing:message.isComposing,modified:message.modified});return undefined;
    }
    if(message.type==='switch/pause'){if(top&&exclusive())pause();return undefined;}
    if(message.type==='switch/execute'){
      const action=message.action;
      if(!exclusive()||!gate.accept(action.actionId,action.target.documentGeneration)){sendResponse({result:'refused'});return undefined;}
      const el=opts.collector.get(action.target.itemId);let result:PageResult={result:'refused'};
      if(el?.isConnected&&opts.collector.items().some((item)=>item.id===action.target.itemId)&&!sensitiveElement(el)){
        if(action.kind==='capture'){const snapshot=captureTextTarget(opts.collector,action.target.itemId);if(snapshot)result={result:'done',value:snapshot.value};}
        if(action.kind==='applyText'&&typeof action.expectedValue==='string'&&typeof action.text==='string')result={result:applyDraft(opts.collector,action.target.itemId,action.expectedValue,action.text)};
        if(action.kind==='press'&&!typingElement(el)&&!el.matches('input[type=file],select,input[type=date],input[type=color],input[type=time]')){synthesizePress(el);result={result:'done'};}
        if(action.kind==='search'&&el instanceof HTMLInputElement&&el.type==='search'&&el.form?.method.toLowerCase()==='get'&&el.value===action.expectedValue){el.form.requestSubmit();result={result:'done'};}
      }
      gate.finish(action.actionId);sendResponse(result);return undefined;
    }
    return undefined;
  };
  function applySettings(value:unknown){const parsed=SwitchSettings.safeParse(value);settings=parsed.success?parsed.data:defaultSwitchSettings();
    state.intervalMs=settings.intervalMs;state.protectionMs=settings.protectionMs;
    stopScroll();state.pressed=null;state.pendingAction=null;state.modeGeneration++;
    if(exclusive()){opts.onExclusive();render();void publish().catch(()=>undefined);}else{panel?.destroy();panel=null;}
  }
  const storageHandler=(changes:Record<string,chrome.storage.StorageChange>,area:string)=>{if(area==='local'&&changes[SWITCH_SETTINGS_KEY])applySettings(changes[SWITCH_SETTINGS_KEY].newValue);};
  opts.pipeline.setSwitchHandler(consume);opts.pipeline.setSwitchExclusive(exclusive);
  chrome.runtime.onMessage.addListener(messageHandler);chrome.storage.onChanged.addListener(storageHandler);
  void chrome.storage.local.get(SWITCH_SETTINGS_KEY).then((stored)=> { applySettings(stored[SWITCH_SETTINGS_KEY]); });
  opts.collector.onChange(()=>{void publish().catch(()=>undefined);});
  const timer=setInterval(()=>{if(top&&exclusive()){if(!opts.enabled()){pause();return;}dispatch({type:'tick',now:now()});}},100);
  window.addEventListener('blur',()=>{if(exclusive()){if(top)pause();else void request({type:'switch/pause'}).catch(()=>undefined);}},{signal:opts.signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&exclusive())pause();},{signal:opts.signal});
  opts.signal.addEventListener('abort',()=>{disposed=true;stopScroll();clearInterval(timer);panel?.destroy();chrome.runtime.onMessage.removeListener(messageHandler);chrome.storage.onChanged.removeListener(storageHandler);});
  return {exclusive,pause};
}
