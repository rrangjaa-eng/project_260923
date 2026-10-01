import { SwitchMessage, type SwitchFrameReport } from '@/shared/switch-messages';
import type { StorageWriter } from './storage-writer';
import { isUnsupportedUrl } from '@/core/unsupported-url';

export function createSwitchRelay(writer: StorageWriter) {
  const frames = new Map<number, Map<number, SwitchFrameReport>>();
  chrome.tabs.onRemoved.addListener((id) => { frames.delete(id); void writer.writeSwitchData(`switchDraft:${String(id)}`, '', 'session'); });
  chrome.tabs.onUpdated.addListener((id, change) => { if (change.status === 'loading') frames.delete(id); });
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    for (const id of frames.keys()) if (id !== tabId) void chrome.tabs.sendMessage(id, { type: 'switch/pause' }).catch(() => undefined);
  });
  async function handle(raw: unknown, sender: chrome.runtime.MessageSender): Promise<unknown> {
    const parsed = SwitchMessage.safeParse(raw);
    if (!parsed.success || sender.id !== chrome.runtime.id) return undefined;
    const message = parsed.data;
    if (message.type === 'switch/settings') return writer.writeSwitchData('switchSettings', message.value, 'local');
    const tabId = sender.tab?.id, frameId = sender.frameId;
    if (tabId === undefined || frameId === undefined) return { result: 'refused' };
    if (message.type === 'switch/report') {
      const reports = frames.get(tabId) ?? new Map<number, SwitchFrameReport>();
      const old = reports.get(frameId);
      reports.set(frameId, { frameId, documentGeneration: message.documentGeneration, path: message.path, items: message.items }); frames.set(tabId, reports);
      if (old && old.documentGeneration !== message.documentGeneration) void chrome.tabs.sendMessage(tabId, { type: 'switch/pause' }, { frameId: 0 }).catch(() => undefined);
      void chrome.tabs.sendMessage(tabId, { type: 'switch/refresh' }, { frameId: 0 }).catch(() => undefined);
      return { tabId, frameId };
    }
    if (message.type === 'switch/key') {
      if (frameId !== 0 && frames.get(tabId)?.has(frameId)) await chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
      return {};
    }
    if (message.type === 'switch/pause') {
      await chrome.tabs.sendMessage(tabId, message, { frameId: 0 }); return {};
    }
    if (frameId !== 0) return { result: 'refused' };
    if (message.type === 'switch/refresh') return { result: 'refused' };
    if (message.type === 'switch/list') return { tabId, frames: Array.from(frames.get(tabId)?.values() ?? []) };
    if (message.type === 'switch/draft') return writer.writeSwitchData(`switchDraft:${String(tabId)}`, message.text, 'session');
    if (message.type === 'switch/draft/read') {
      const stored=await chrome.storage.session.get(`switchDraft:${String(tabId)}`);
      return {text:stored[`switchDraft:${String(tabId)}`]};
    }
    if (message.type === 'switch/phrase') {
      const stored = await chrome.storage.local.get('switchPhrases');
      const phrases = Array.isArray(stored.switchPhrases) ? stored.switchPhrases.filter((v): v is string => typeof v === 'string').slice(-19) : [];
      return writer.writeSwitchData('switchPhrases', [...new Set([...phrases, message.text])], 'local');
    }
    if (message.type === 'switch/execute') {
      const action = message.action;
      const report = frames.get(tabId)?.get(action.target.frameId);
      if (action.target.tabId !== tabId || !report || report.documentGeneration !== action.target.documentGeneration
          || !report.items.some((item) => item.itemId === action.target.itemId && !item.sensitive && item.identity === action.expectedIdentity)) return { result: 'refused' };
      try { return await chrome.tabs.sendMessage(tabId, message, { frameId: action.target.frameId }); }
      catch { return { result: 'unknown' }; }
    }
    {
      const tabs = await chrome.tabs.query({});
      const supported = tabs.filter((tab) => tab.id !== undefined && !isUnsupportedUrl(tab.url) && /^https?:/.test(tab.url ?? ''));
      if (message.kind === 'tabs') return { tabs: supported.map((tab) => ({ id: tab.id, title: tab.title ?? tab.url })) };
      if (message.kind === 'back') { await chrome.tabs.goBack(tabId); return { result: 'done' }; }
      if (!supported.some((tab) => tab.id === message.tabId) || message.tabId === undefined) return { result: 'refused' };
      try {
        await chrome.tabs.sendMessage(message.tabId, { type: 'site/ping' }, { frameId: 0 });
        await chrome.tabs.sendMessage(message.tabId, { type: 'switch/pause' }, { frameId: 0 });
        await chrome.tabs.update(message.tabId, { active: true });
        return { result: 'done' };
      }
      catch { return { result: 'refused' }; }
    }
    return undefined;
  }
  return { handle };
}
