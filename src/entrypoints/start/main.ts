import tokens from '../../../docs/design/tokens.css?inline';
import {createCollector} from '@/page/collector/collector';
import {createInputPipeline} from '@/page/input/pipeline';
import {createSwitchController,type SwitchListener} from '@/page/input/switch-controller';
import {createPortRpc} from '@/shared/port-rpc';
import {SettingsV1,defaultSettings,SETTINGS_KEY} from '@/core/settings-schema';
import {HELPER_SAFETY_OFF_KEY,isHelperSafetyOff} from '@/core/helper-safety';
const style=document.createElement('style');style.textContent=`${tokens.replaceAll(':host',':root')}\nbody{margin:var(--space-4);font-family:var(--font);font-size:var(--text-body);line-height:var(--leading);color:var(--fg);background:var(--bg)}main{max-width:40rem}h1{font-size:var(--text-title)}form{margin-block:var(--space-4)}label{display:block}input,button{font:inherit;min-height:var(--target-min);box-sizing:border-box;max-width:100%;border:var(--border-strong) solid var(--accent);border-radius:var(--radius-button);padding:var(--space-2);background:var(--surface);color:var(--fg)}input{width:100%;margin-bottom:var(--space-2)}:focus-visible{outline:var(--border-strong) solid var(--accent);outline-offset:var(--space-1)}`;document.head.append(style);
const abort=new AbortController();let settings=defaultSettings(),ready=false,safetyOff=true,connected=true;let listener:SwitchListener|undefined;
function required<T extends Element>(element:T|null):T{if(!element)throw Error('시작 화면 요소 없음');return element;}
const status=required(document.querySelector<HTMLElement>('#status'));
const enabled=()=>ready&&connected&&!safetyOff&&settings.data.enabled;
const port=chrome.runtime.connect({name:'switch-start'});
const rpc=createPortRpc(port,async raw=>{
 if(typeof raw==='object'&&raw!==null&&'type' in raw){
  if(raw.type==='helper/safety'){safetyOff=!('off' in raw)||raw.off!==false;controller.enabledChanged();return {result:'done'};}
  if(raw.type==='site/ping')return {ok:true};
 }
 return new Promise(resolve=>{const asynchronous=listener?.(raw,{id:chrome.runtime.id},resolve);if(asynchronous!==true)resolve({result:'refused'});});
});
const collector=createCollector({signal:abort.signal,getDangerWords:()=>settings.data.dangerWords});
const pipeline=createInputPipeline({signal:abort.signal,getSettings:()=>settings,isEnabled:enabled});
const controller=createSwitchController({helperPage:true,collector,pipeline,signal:abort.signal,enabled,onExclusive:()=>{},transport:{request:rpc.request,subscribe:handler=>{listener=handler;return ()=>{listener=undefined;};}}});
port.onDisconnect.addListener(()=>{connected=false;controller.connectionLost();controller.enabledChanged();status.textContent='연결이 끊겼어요. 이 시작 화면을 다시 열어 주세요';});
void Promise.all([chrome.storage.sync.get(SETTINGS_KEY),rpc.request({type:'helper/state'})]).then(([stored,state])=>{
 const parsed=SettingsV1.safeParse(stored[SETTINGS_KEY]);settings=parsed.success?parsed.data:defaultSettings();safetyOff=typeof state!=='object'||state===null||!('off' in state)||state.off!==false;ready=true;controller.enabledChanged();
});
chrome.storage.onChanged.addListener((changes,area)=>{
 if(area==='sync'&&changes[SETTINGS_KEY]){const parsed=SettingsV1.safeParse(changes[SETTINGS_KEY].newValue);if(parsed.success)settings=parsed.data;controller.enabledChanged();}
 if(area==='local'&&changes[HELPER_SAFETY_OFF_KEY]){safetyOff=isHelperSafetyOff(changes[HELPER_SAFETY_OFF_KEY].newValue);controller.enabledChanged();}
});
required(document.querySelector('#address-form')).addEventListener('submit',event=>{
 event.preventDefault();const text=required(document.querySelector<HTMLInputElement>('#address')).value;
 try{const url=new URL(text);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('unsupported');location.assign(url.href);}catch{status.textContent='http 또는 https 페이지 주소를 입력하세요';}
});
window.addEventListener('pagehide',()=>{abort.abort();rpc.close();},{once:true});
