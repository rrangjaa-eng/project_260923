import { parseMessage } from '@/shared/messages';
import { createRelay } from '@/worker/relay';
import { createStorageWriter } from '@/worker/storage-writer';

// 탭·프레임별 마지막 enabled 보고(D-03) — 시험이 globalThis.frameStates로 읽는다.
type FrameStates = Record<number, Record<number, boolean>>;

export default defineBackground(() => {
  const writer = createStorageWriter();
  const relay = createRelay();
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
      if (message.op.kind === 'setEnabled') {
        void writer.setEnabled(message.op.enabled).then(sendResponse);
        return true; // 비동기 응답을 위해 메시지 채널을 열어 둔다.
      }
      // recordPress(D-11, T-01-16): 보낸 프레임의 실제 origin은 sender.url에서 계산한다 —
      // 요청 안의 origin 문자열은 신뢰하지 않고 storage-writer.ts가 둘을 대조한다.
      const senderOrigin = sender.url ? new URL(sender.url).origin : '';
      void writer.recordPress(message.op.origin, senderOrigin, message.op.fingerprint).then(sendResponse);
      return true;
    }

    if (
      message.type === 'frame/report' ||
      message.type === 'hints/press' ||
      message.type === 'hints/state'
    ) {
      relay.handle(message, sender);
      return undefined;
    }

    if (message.type === 'frames/reports' || message.type === 'press/request' || message.type === 'frame/refresh') {
      // SW → 프레임 방향 메시지다. background.ts는 이 방향으로는 보내지 않으므로(relay.ts가
      // chrome.tabs.sendMessage로 직접 보낸다) 받을 일이 없다 — 방어적으로 무시한다.
      return undefined;
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
