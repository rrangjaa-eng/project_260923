import { SwitchMessage, type SwitchFrameReport } from '@/shared/switch-messages';
import type { StorageWriter } from './storage-writer';
import { isUnsupportedUrl } from '@/core/unsupported-url';

export function createSwitchRelay(writer: StorageWriter,send:typeof chrome.tabs.sendMessage=(...args)=>chrome.tabs.sendMessage(...args)) {
  const frames = new Map<number, Map<number, SwitchFrameReport>>();
  const closePreviews=new Map<number,{token:string;sourceUrl:string;windowId:number;documentGeneration:string;targetId:number;targetUrl:string;targetTitle:string;targetDocument:string;targetLocation:number}>();
  const locationChanges=new Map<number,number>();
  const cancellations = new Map<number, number>();
  const navigationActions=new Map<number,{documentGeneration:string;seen:Set<string>}>();
  const cancel = (id: number) => { closePreviews.delete(id); cancellations.set(id, (cancellations.get(id) ?? 0) + 1); };
  chrome.tabs.onDetached.addListener(id=>{locationChanges.set(id,(locationChanges.get(id)??0)+1);cancel(id);});
  chrome.tabs.onRemoved.addListener((id) => { frames.delete(id); locationChanges.delete(id); closePreviews.delete(id); cancellations.delete(id); navigationActions.delete(id); void writer.writeSwitchData(`switchDraft:${String(id)}`, '', 'session'); });
  chrome.tabs.onUpdated.addListener((id, change) => {
    if (change.status === 'loading') {
      cancel(id);
      closePreviews.delete(id);
      const hadReports = frames.has(id);
      frames.delete(id);
      if (hadReports) void send(id, { type: 'switch/pause', invalidate: true }, { frameId: 0 }).catch(() => undefined);
    }
  });
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    for (const id of frames.keys()) if (id !== tabId) { cancel(id); void send(id, { type: 'switch/pause' }).catch(() => undefined); }
  });
  async function visibleReport(tabId: number, report: SwitchFrameReport, allowRefreshedReport=false): Promise<boolean> {
    const reports = frames.get(tabId);
    if (!reports || (report.frameId === 0) !== (report.path.length === 0)) return false;
    for (let depth = 0; depth < report.path.length; depth++) {
      const prefix = JSON.stringify(report.path.slice(0, depth));
      const parent = Array.from(reports.values()).find((entry) => JSON.stringify(entry.path) === prefix);
      if (!parent) return false;
      try {
        const response: unknown = await send(tabId, { type: 'switch/frame-check', childIndex: report.path[depth], documentGeneration: parent.documentGeneration }, { frameId: parent.frameId });
        if (typeof response !== 'object' || response === null || !('result' in response) || response.result !== 'done') return false;
      } catch { return false; }
    }
    const latest=frames.get(tabId)?.get(report.frameId);
    return latest===report||allowRefreshedReport&&latest?.documentGeneration===report.documentGeneration&&JSON.stringify(latest.path)===JSON.stringify(report.path);
  }
  async function handle(raw: unknown, sender: chrome.runtime.MessageSender): Promise<unknown> {
    const parsed = SwitchMessage.safeParse(raw);
    if (!parsed.success || sender.id !== chrome.runtime.id) return undefined;
    const message = parsed.data;
    if (message.type === 'switch/connect' || message.type === 'switch/begin') return { result: 'refused' };
    if (message.type === 'switch/settings') return writer.writeSwitchData('switchSettings', message.value, 'local');
    const tabId = sender.tab?.id, frameId = sender.frameId;
    if (tabId === undefined || frameId === undefined) return { result: 'refused' };
    if (message.type === 'switch/report') {
      const reports = frames.get(tabId) ?? new Map<number, SwitchFrameReport>();
      const old = reports.get(frameId);
      let replaced=!!old&&old.documentGeneration!==message.documentGeneration;
      for(const [id,report] of reports){
        if(id!==frameId&&JSON.stringify(report.path)===JSON.stringify(message.path)){reports.delete(id);replaced=true;}
      }
      reports.set(frameId, { frameId, documentGeneration: message.documentGeneration, path: message.path, items: message.items }); frames.set(tabId, reports);
      if (replaced) void send(tabId, { type: 'switch/pause', invalidate: true }, { frameId: 0 }).catch(() => undefined);
      void send(tabId, { type: 'switch/refresh' }, { frameId: 0 }).catch(() => undefined);
      return { tabId, frameId };
    }
    if (message.type === 'switch/key') {
      if (frameId !== 0 && frames.get(tabId)?.has(frameId)) await send(tabId, message, { frameId: 0 });
      return {};
    }
    if (message.type === 'switch/pause') {
      cancel(tabId);
      await send(tabId, message, { frameId: 0 }); return {};
    }
    if (message.type === 'switch/action-check') {
      if(frameId===0)return send(tabId,message,{frameId:0});
      const report=frames.get(tabId)?.get(frameId);
      if(!report)return {result:'refused'};
      const cancellation=cancellations.get(tabId)??0;
      cancellations.set(tabId,cancellation);
      const current=()=>{
        const child=frames.get(tabId)?.get(frameId);
        return cancellations.get(tabId)===cancellation&&frames.get(tabId)?.get(0)?.documentGeneration===message.authorization.documentGeneration
          &&child?.documentGeneration===report.documentGeneration&&JSON.stringify(child.path)===JSON.stringify(report.path);
      };
      if(!current()||!await visibleReport(tabId,report,true)||!current())return {result:'refused'};
      const reply:unknown=await send(tabId,message,{frameId:0});
      const latest=frames.get(tabId)?.get(frameId);
      // 승인 응답이 지연되는 동안 부모가 이동하거나 문서/실행이 바뀔 수 있다.
      if(!current()||!latest||!await visibleReport(tabId,latest,true)||!current())return {result:'refused'};
      return reply;
    }
    if (frameId !== 0) return { result: 'refused' };
    if (message.type === 'switch/cancel-peers') {
      cancel(tabId);
      await Promise.all(Array.from(frames.get(tabId)?.keys() ?? []).filter((id) => id !== 0).map((id) => send(tabId, { type: 'switch/pause' }, { frameId: id }).catch(() => undefined)));
      return { result: 'done' };
    }
    if (message.type === 'switch/refresh' || message.type === 'switch/frame-check') return { result: 'refused' };
    if (message.type === 'switch/list') {
      const reports = Array.from(frames.get(tabId)?.values() ?? []);
      const visible = await Promise.all(reports.map(async (report) => await visibleReport(tabId, report) ? report : null));
      return { tabId, frames: visible.filter((report) => report !== null) };
    }
    if (message.type === 'switch/draft') return writer.writeSwitchData(`switchDraft:${String(tabId)}`, message.text, 'session');
    if (message.type === 'switch/draft/read') {
      const stored=await chrome.storage.session.get(`switchDraft:${String(tabId)}`);
      return {text:stored[`switchDraft:${String(tabId)}`]};
    }
    if(message.type==='switch/pin/update'){
      const source=sender.url,report=frames.get(tabId)?.get(0),cancellation=cancellations.get(tabId)??0;
      if(!source||!report||report.documentGeneration!==message.authorization.documentGeneration)return {result:'refused'};
      let origin:string;try{const url=new URL(source);if(!['http:','https:'].includes(url.protocol))return {result:'refused'};origin=url.origin;}catch{return {result:'refused'};}
      const current=()=>frames.get(tabId)?.get(0)?.documentGeneration===report.documentGeneration&&(cancellations.get(tabId)??0)===cancellation;
      return writer.changePins(origin,message.mutation,async()=>{
        if(!current())return false;
        try{
          if((await chrome.tabs.get(tabId)).url!==source||!current())return false;
          const reply:unknown=await send(tabId,{type:'switch/action-check',authorization:message.authorization,pin:message.mutation},{frameId:0});
          return current()&&typeof reply==='object'&&reply!==null&&'result' in reply&&reply.result==='done';
        }catch{return false;}
      });
    }
    if (message.type === 'switch/phrase' || message.type === 'switch/phrase/update') {
      return writer.changeSwitchPhrases(message.type === 'switch/phrase' ? { kind: 'add', text: message.text } : message.mutation, async () => {
        const report = frames.get(tabId)?.get(0);
        const cancellation = cancellations.get(tabId) ?? 0;
        if (!report || report.documentGeneration !== message.authorization.documentGeneration) return false;
        try {
          const reply: unknown = await send(tabId, { type: 'switch/action-check', authorization: message.authorization }, { frameId: 0 });
          return (cancellations.get(tabId) ?? 0) === cancellation && frames.get(tabId)?.get(0) === report && typeof reply === 'object' && reply !== null && 'result' in reply && reply.result === 'done';
        } catch { return false; }
      });
    }
    if (message.type === 'switch/execute') {
      const action = message.action;
      if(action.kind==='doubleClick'&&(action.target.frameId!==0||!action.confirmed))return {result:'refused'};
      const cancellation=cancellations.get(tabId)??0;
      const report = frames.get(tabId)?.get(action.target.frameId);
      if (action.target.tabId !== tabId || !report || report.documentGeneration !== action.target.documentGeneration
          || !report.items.some((item) => item.itemId === action.target.itemId && !item.sensitive && item.identity === action.expectedIdentity)
          || !await visibleReport(tabId, report)) return { result: 'refused' };
      try {
        const authorization: unknown = await send(tabId, { type: 'switch/action-check', authorization: action.authorization, ...(action.kind==='doubleClick'?{doubleClick:action}:{}) }, { frameId: 0 });
        if (typeof authorization !== 'object' || authorization === null || !('result' in authorization) || authorization.result !== 'done') return { result: 'refused' };
        if(action.kind==='doubleClick'&&((cancellations.get(tabId)??0)!==cancellation||frames.get(tabId)?.get(0)?.documentGeneration!==report.documentGeneration))return {result:'refused'};
        return await send(tabId, message, { frameId: action.target.frameId });
      }
      catch { return { result: 'unknown' }; }
    }
    {
      const cancellation = cancellations.get(tabId) ?? 0;
      cancellations.set(tabId, cancellation);
      const cancelled = () => cancellations.get(tabId) !== cancellation;
      const report=frames.get(tabId)?.get(0);
      const navigation={kind:message.kind,...(message.tabId!==undefined?{tabId:message.tabId}:{}),...(message.token!==undefined?{token:message.token}:{})};
      const authorized=async()=>{
        if(cancelled()||!report||report.documentGeneration!==message.authorization.documentGeneration||frames.get(tabId)?.get(0)?.documentGeneration!==report.documentGeneration)return false;
        try{
          const reply:unknown=await send(tabId,{type:'switch/action-check',authorization:message.authorization,navigation},{frameId:0});
          return !cancelled()&&frames.get(tabId)?.get(0)?.documentGeneration===report.documentGeneration&&typeof reply==='object'&&reply!==null&&'result' in reply&&reply.result==='done';
        }catch{return false;}
      };
      if(!await authorized())return {result:'refused'};
      const prior=navigationActions.get(tabId);
      const consumed=prior?.documentGeneration===message.authorization.documentGeneration?prior:{documentGeneration:message.authorization.documentGeneration,seen:new Set<string>()};
      const actionKey=JSON.stringify([message.authorization.modeGeneration,message.authorization.pendingActionId]);
      if(consumed.seen.has(actionKey))return {result:'refused'};
      consumed.seen.add(actionKey);navigationActions.set(tabId,consumed);
      const tabs = await chrome.tabs.query({});
      if (!await authorized()) return { result: 'refused' };
      const supported = tabs.filter((tab) => tab.id !== undefined && (!isUnsupportedUrl(tab.url) && /^https?:/.test(tab.url ?? '') || tab.url===chrome.runtime.getURL('start.html')));
      if (message.kind === 'tabs') return { tabs: supported.map((tab) => ({ id: tab.id, title: tab.title ?? tab.url })) };
      if(message.kind==='new'){
        const source=tabs.find(tab=>tab.id===tabId);
        if(!source?.active||source.windowId===undefined)return {result:'refused'};
        try{await chrome.tabs.create({windowId:source.windowId,url:chrome.runtime.getURL('start.html'),active:true});return {result:'done'};}catch{return {result:'unknown'};}
      }
      if(message.kind==='reload'||message.kind==='close-preview'||message.kind==='close'){
        const source=tabs.find(tab=>tab.id===tabId);
        if(!source?.active||source.windowId===undefined||!source.url)return {result:'refused'};
        if(message.kind==='reload'){
          try{await chrome.tabs.reload(tabId);return {result:'done'};}catch{return {result:'unknown'};}
        }
        const preview=closePreviews.get(tabId);
        closePreviews.delete(tabId);
        const siblings=tabs.filter(tab=>tab.windowId===source.windowId&&tab.id!==tabId);
        if(siblings.length===0)return {result:'refused',reason:'last-tab'};
        if(message.kind==='close-preview'){
          const target=supported.filter(tab=>tab.windowId===source.windowId&&tab.id!==tabId&&tab.id!==undefined&&frames.get(tab.id)?.get(0)).sort((a,b)=>(a.index??0)-(b.index??0))[0];
          const targetReport=target?.id===undefined?undefined:frames.get(target.id)?.get(0);
          if(target?.id===undefined||!target.url||!targetReport||!report)return {result:'refused',reason:'no-return-tab'};
          const token=crypto.randomUUID();
          closePreviews.set(tabId,{token,sourceUrl:source.url,windowId:source.windowId,documentGeneration:report.documentGeneration,targetId:target.id,targetUrl:target.url,targetTitle:target.title??target.url,targetDocument:targetReport.documentGeneration,targetLocation:locationChanges.get(target.id)??0});
          return {result:'done',token,title:target.title??target.url};
        }
        if(!preview||preview.token!==message.token||preview.sourceUrl!==source.url||preview.windowId!==source.windowId||preview.documentGeneration!==report?.documentGeneration)return {result:'refused'};
        const target=supported.find(tab=>tab.id===preview.targetId&&tab.windowId===preview.windowId&&tab.url===preview.targetUrl&&(tab.title??tab.url)===preview.targetTitle);
        if(!target||(locationChanges.get(preview.targetId)??0)!==preview.targetLocation||frames.get(preview.targetId)?.get(0)?.documentGeneration!==preview.targetDocument)return {result:'refused'};
        try{
          const paused:unknown=await send(preview.targetId,{type:'switch/pause',reason:'return-after-close'},{frameId:0});
          if(typeof paused!=='object'||paused===null||!('result' in paused)||paused.result!=='done')return {result:'refused'};
          if(!await authorized())return {result:'refused'};
          const latest=await chrome.tabs.query({});
          if(!await authorized())return {result:'refused'};
          const current=latest.find(tab=>tab.id===tabId),back=latest.find(tab=>tab.id===preview.targetId);
          if(!current?.active||current.windowId!==preview.windowId||current.url!==preview.sourceUrl||back?.windowId!==preview.windowId||back.url!==preview.targetUrl||(back.title??back.url)!==preview.targetTitle||(locationChanges.get(preview.targetId)??0)!==preview.targetLocation||frames.get(preview.targetId)?.get(0)?.documentGeneration!==preview.targetDocument)return {result:'refused'};
          await chrome.tabs.remove(tabId);
          const returning=await chrome.tabs.get(preview.targetId);
          if(returning.windowId!==preview.windowId||returning.url!==preview.targetUrl||(locationChanges.get(preview.targetId)??0)!==preview.targetLocation||frames.get(preview.targetId)?.get(0)?.documentGeneration!==preview.targetDocument)return {result:'unknown'};
          await chrome.tabs.update(preview.targetId,{active:true});
          return {result:'done'};
        }catch{return {result:'unknown'};}
      }

      if (message.kind === 'back'||message.kind==='forward') {
        try{if(message.kind==='back')await chrome.tabs.goBack(tabId);else await chrome.tabs.goForward(tabId);return {result:'done'};}
        catch{return {result:'refused',reason:'unavailable'};}
      }
      if (!supported.some((tab) => tab.id === message.tabId) || message.tabId === undefined) return { result: 'refused' };
      try {
        await send(message.tabId, { type: 'site/ping' }, { frameId: 0 });
        if (!await authorized()) return { result: 'refused' };
        await send(message.tabId, { type: 'switch/pause' }, { frameId: 0 });
        if (!await authorized()) return { result: 'refused' };
        await chrome.tabs.update(message.tabId, { active: true });
        return { result: 'done' };
      }
      catch { return { result: 'refused' }; }
    }
    return undefined;
  }
  return { handle,disconnect:(id:number)=>{cancel(id);frames.delete(id);navigationActions.delete(id);} };
}
