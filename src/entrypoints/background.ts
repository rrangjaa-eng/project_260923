import { parseMessage } from '@/shared/messages';
import { createStorageWriter } from '@/worker/storage-writer';

// 탭·프레임별 마지막 enabled 보고(D-03) — 시험이 globalThis.frameStates로 읽는다.
type FrameStates = Record<number, Record<number, boolean>>;

export default defineBackground(() => {
  const writer = createStorageWriter();
  const frameStates: FrameStates = {};
  (globalThis as typeof globalThis & { frameStates: FrameStates }).frameStates = frameStates;

  chrome.runtime.onInstalled.addListener(() => {
    void writer.ensureDefaultSettings();
  });

  chrome.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    // 확장 내부 메시지만 받는다(D-09) — externally_connectable 없음, window.postMessage는 받지 않는다.
    if (sender.id !== chrome.runtime.id) {
      return undefined;
    }

    const parsed = parseMessage(raw);
    if (!parsed.success) {
      return undefined;
    }

    const message = parsed.data;

    if (message.type === 'storage/request') {
      void writer.setEnabled(message.op.enabled).then(sendResponse);
      return true; // 비동기 응답을 위해 메시지 채널을 열어 둔다.
    }

    // message.type === 'frame/state'
    const tabId = sender.tab?.id;
    const frameId = sender.frameId;
    if (tabId !== undefined && frameId !== undefined) {
      let tabFrames = frameStates[tabId];
      if (!tabFrames) {
        tabFrames = {};
        frameStates[tabId] = tabFrames;
      }
      tabFrames[frameId] = message.enabled;
    }
    return undefined;
  });
});
