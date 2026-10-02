import tokens from '../../../docs/design/tokens.css?inline';
import {createCollector} from '@/page/collector/collector';
import {createInputPipeline} from '@/page/input/pipeline';
import {createSwitchController,type SwitchListener} from '@/page/input/switch-controller';
import {createPortRpc} from '@/shared/port-rpc';
import {SettingsV1,defaultSettings,SETTINGS_KEY} from '@/core/settings-schema';
import {HELPER_SAFETY_OFF_KEY,isHelperSafetyOff} from '@/core/helper-safety';
import {ensureHelperFontsRegistered} from '@/page/overlay/mode-indicator';

const style=document.createElement('style');
style.textContent=`${tokens.replaceAll(':host',':root')}\nbody{margin:var(--space-4);font-family:var(--font);font-size:var(--text-body);line-height:var(--leading);color:var(--fg);background:var(--bg)}main{max-width:40rem}h1{font-size:var(--text-title)}form{margin-block:var(--space-4)}label{display:block}input,button{font:inherit;min-height:var(--target-min);box-sizing:border-box;max-width:100%;border:var(--border-strong) solid var(--accent);border-radius:var(--radius-button);padding:var(--space-2);background:var(--surface);color:var(--fg)}input{width:100%;margin-bottom:var(--space-2)}:focus-visible{outline:var(--border-strong) solid var(--accent);outline-offset:var(--space-1)}`;
document.head.append(style);
void ensureHelperFontsRegistered();
function required<T extends Element>(element:T|null):T{if(!element)throw Error('시작 화면 요소 없음');return element;}
const status=required(document.querySelector<HTMLElement>('#status'));
const abort=new AbortController();
let settings=defaultSettings(),ready=false,safetyOff=true,connected=false;
let safetyVersion=0,settingsVersion=0;
let listener:SwitchListener|undefined;
let rpc:ReturnType<typeof createPortRpc>|null=null;
const enabled=()=>ready&&connected&&!safetyOff&&settings.data.enabled;
const collector=createCollector({signal:abort.signal,getDangerWords:()=>settings.data.dangerWords});
// 연결 복구용 누름은 작업판의 선택 누름과 분리한다.
window.addEventListener('keydown',event=>{
 if(connected||event.code!=='Space'||!event.isTrusted||event.repeat||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
 event.preventDefault();event.stopImmediatePropagation();connect();
},{capture:true,signal:abort.signal});
const pipeline=createInputPipeline({signal:abort.signal,getSettings:()=>settings,isEnabled:enabled});
const controller=createSwitchController({helperPage:true,collector,pipeline,signal:abort.signal,enabled,onExclusive:()=>{},transport:{
 request:message=>rpc?.request(message)??Promise.resolve({result:'unknown'}),
 subscribe:handler=>{listener=handler;return ()=>{listener=undefined;};},
}});
function readSafety(state:unknown){return typeof state!=='object'||state===null||!('off' in state)||state.off!==false;}
function connect(){
 if(connected||abort.signal.aborted)return;
 connected=true;ready=false;safetyOff=true;
 const safetyRead=safetyVersion,settingsRead=settingsVersion;
 try{
  const port=chrome.runtime.connect({name:'switch-start'});
  const current=createPortRpc(port,async raw=>{
   if(rpc!==current)return {result:'refused'};
   if(typeof raw==='object'&&raw!==null&&'type' in raw){
    if(raw.type==='helper/safety'){safetyVersion++;safetyOff=readSafety(raw);controller.enabledChanged();return {result:'done'};}
    if(raw.type==='site/ping')return {ok:true};
   }
   return new Promise(resolve=>{const asynchronous=listener?.(raw,{id:chrome.runtime.id},resolve);if(asynchronous!==true)resolve({result:'refused'});});
  });
  rpc=current;
  port.onDisconnect.addListener(()=>{
   if(rpc!==current)return;
   rpc=null;connected=false;ready=false;controller.enabledChanged();
   status.textContent='연결이 끊겼어요. 스페이스바로 다시 연결하세요. 이전 실행 결과도 확인하세요';
  });
  void Promise.all([chrome.storage.sync.get(SETTINGS_KEY),current.request({type:'helper/state'}),chrome.storage.local.get(HELPER_SAFETY_OFF_KEY)]).then(([stored,state,local])=>{
   if(rpc!==current)return;
   if(settingsRead===settingsVersion){const parsed=SettingsV1.safeParse(stored[SETTINGS_KEY]);ready=parsed.success;if(parsed.success)settings=parsed.data;}
   if(safetyRead===safetyVersion)safetyOff=readSafety(state)||isHelperSafetyOff(local[HELPER_SAFETY_OFF_KEY]);
   controller.enabledChanged();
   status.textContent=enabled()?'스페이스바로 시작하세요. 찾기에서 검색어나 주소를 쓰고 적용한 뒤 이동하세요':'도우미가 꺼져 있거나 설정을 읽지 못했어요. 확장 아이콘에서 상태를 확인하세요';
  }).catch(()=>{if(rpc===current){ready=false;controller.enabledChanged();status.textContent='설정을 읽지 못했어요. 확장 아이콘에서 상태를 확인하세요';}});
 }catch{connected=false;ready=false;status.textContent='연결하지 못했어요. 확장 아이콘에서 상태를 확인하세요';}
}
chrome.storage.onChanged.addListener((changes,area)=>{
 if(area==='sync'&&changes[SETTINGS_KEY]){
  settingsVersion++;const parsed=SettingsV1.safeParse(changes[SETTINGS_KEY].newValue);ready=parsed.success;if(parsed.success)settings=parsed.data;controller.enabledChanged();
 }
 if(area==='local'&&changes[HELPER_SAFETY_OFF_KEY]){
  const version=++safetyVersion,current=rpc;
  if(isHelperSafetyOff(changes[HELPER_SAFETY_OFF_KEY].newValue)){safetyOff=true;controller.enabledChanged();}
  else if(current)void current.request({type:'helper/state'}).then(state=>{if(version!==safetyVersion||rpc!==current)return;safetyOff=readSafety(state);controller.enabledChanged();});
 }
});
required(document.querySelector('#address-form')).addEventListener('submit',event=>{
 event.preventDefault();const text=required(document.querySelector<HTMLInputElement>('#address')).value;
 try{const url=new URL(text);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('unsupported');location.assign(url.href);}catch{status.textContent='http 또는 https 페이지 주소를 입력하세요';}
});
window.addEventListener('pagehide',()=>{abort.abort();rpc?.close();},{once:true});
connect();
