import { SwitchMessage, type SwitchFrameReport } from '@/shared/switch-messages';
import type { StorageWriter } from './storage-writer';
import { isUnsupportedUrl } from '@/core/unsupported-url';

export function createSwitchRelay(writer: StorageWriter) {
  const frames = new Map<number, Map<number, SwitchFrameReport>>();
  const cancellations = new Map<number, number>();
  const cancel = (id: number) => { cancellations.set(id, (cancellations.get(id) ?? 0) + 1); };
  chrome.tabs.onRemoved.addListener((id) => { frames.delete(id); cancellations.delete(id); void writer.writeSwitchData(`switchDraft:${String(id)}`, '', 'session'); });
  chrome.tabs.onUpdated.addListener((id, change) => {
    if (change.status === 'loading') {
      cancel(id);
      const hadReports = frames.has(id);
      frames.delete(id);
      if (hadReports) void chrome.tabs.sendMessage(id, { type: 'switch/pause', invalidate: true }, { frameId: 0 }).catch(() => undefined);
    }
  });
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    for (const id of frames.keys()) if (id !== tabId) { cancel(id); void chrome.tabs.sendMessage(id, { type: 'switch/pause' }).catch(() => undefined); }
  });
  async function visibleReport(tabId: number, report: SwitchFrameReport): Promise<boolean> {
    const reports = frames.get(tabId);
    if (!reports || (report.frameId === 0) !== (report.path.length === 0)) return false;
    for (let depth = 0; depth < report.path.length; depth++) {
      const prefix = JSON.stringify(report.path.slice(0, depth));
      const parent = Array.from(reports.values()).find((entry) => JSON.stringify(entry.path) === prefix);
      if (!parent) return false;
      try {
        const response: unknown = await chrome.tabs.sendMessage(tabId, { type: 'switch/frame-check', childIndex: report.path[depth], documentGeneration: parent.documentGeneration }, { frameId: parent.frameId });
        if (typeof response !== 'object' || response === null || !('result' in response) || response.result !== 'done') return false;
      } catch { return false; }
    }
    return frames.get(tabId)?.get(report.frameId) === report;
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
      if (replaced) void chrome.tabs.sendMessage(tabId, { type: 'switch/pause', invalidate: true }, { frameId: 0 }).catch(() => undefined);
      void chrome.tabs.sendMessage(tabId, { type: 'switch/refresh' }, { frameId: 0 }).catch(() => undefined);
      return { tabId, frameId };
    }
    if (message.type === 'switch/key') {
      if (frameId !== 0 && frames.get(tabId)?.has(frameId)) await chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
      return {};
    }
    if (message.type === 'switch/pause') {
      cancel(tabId);
      await chrome.tabs.sendMessage(tabId, message, { frameId: 0 }); return {};
    }
    if (message.type === 'switch/action-check') return chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
    if (frameId !== 0) return { result: 'refused' };
    if (message.type === 'switch/cancel-peers') {
      cancel(tabId);
      await Promise.all(Array.from(frames.get(tabId)?.keys() ?? []).filter((id) => id !== 0).map((id) => chrome.tabs.sendMessage(tabId, { type: 'switch/pause' }, { frameId: id }).catch(() => undefined)));
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
    if (message.type === 'switch/phrase' || message.type === 'switch/phrase/update') {
      return writer.changeSwitchPhrases(message.type === 'switch/phrase' ? { kind: 'add', text: message.text } : message.mutation, async () => {
        const report = frames.get(tabId)?.get(0);
        const cancellation = cancellations.get(tabId) ?? 0;
        if (!report || report.documentGeneration !== message.authorization.documentGeneration) return false;
        try {
          const reply: unknown = await chrome.tabs.sendMessage(tabId, { type: 'switch/action-check', authorization: message.authorization }, { frameId: 0 });
          return (cancellations.get(tabId) ?? 0) === cancellation && frames.get(tabId)?.get(0) === report && typeof reply === 'object' && reply !== null && 'result' in reply && reply.result === 'done';
        } catch { return false; }
      });
    }
    if (message.type === 'switch/execute') {
      const action = message.action;
      const report = frames.get(tabId)?.get(action.target.frameId);
      if (action.target.tabId !== tabId || !report || report.documentGeneration !== action.target.documentGeneration
          || !report.items.some((item) => item.itemId === action.target.itemId && !item.sensitive && item.identity === action.expectedIdentity)
          || !await visibleReport(tabId, report)) return { result: 'refused' };
      try {
        const authorization: unknown = await chrome.tabs.sendMessage(tabId, { type: 'switch/action-check', authorization: action.authorization }, { frameId: 0 });
        if (typeof authorization !== 'object' || authorization === null || !('result' in authorization) || authorization.result !== 'done') return { result: 'refused' };
        return await chrome.tabs.sendMessage(tabId, message, { frameId: action.target.frameId });
      }
      catch { return { result: 'unknown' }; }
    }
    {
      const cancellation = cancellations.get(tabId) ?? 0;
      cancellations.set(tabId, cancellation);
      const cancelled = () => cancellations.get(tabId) !== cancellation;
      const tabs = await chrome.tabs.query({});
      if (cancelled()) return { result: 'refused' };
      const supported = tabs.filter((tab) => tab.id !== undefined && !isUnsupportedUrl(tab.url) && /^https?:/.test(tab.url ?? ''));
      if (message.kind === 'tabs') return { tabs: supported.map((tab) => ({ id: tab.id, title: tab.title ?? tab.url })) };
      if (message.kind === 'back') { await chrome.tabs.goBack(tabId); return { result: 'done' }; }
      if (!supported.some((tab) => tab.id === message.tabId) || message.tabId === undefined) return { result: 'refused' };
      try {
        await chrome.tabs.sendMessage(message.tabId, { type: 'site/ping' }, { frameId: 0 });
        if (cancelled()) return { result: 'refused' };
        await chrome.tabs.sendMessage(message.tabId, { type: 'switch/pause' }, { frameId: 0 });
        if (cancelled()) return { result: 'refused' };
        await chrome.tabs.update(message.tabId, { active: true });
        return { result: 'done' };
      }
      catch { return { result: 'refused' }; }
    }
    return undefined;
  }
  return { handle };
}
