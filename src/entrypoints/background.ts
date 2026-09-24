import tokensCssRaw from '../../docs/design/tokens.css?raw';
import { isUnsupportedUrl } from '@/core/unsupported-url';
import { parseMessage } from '@/shared/messages';
import { createRelay } from '@/worker/relay';
import { createStorageWriter } from '@/worker/storage-writer';

// 탭·프레임별 마지막 enabled 보고(D-03) — 시험이 globalThis.frameStates로 읽는다.
type FrameStates = Record<number, Record<number, boolean>>;

// 확장 아이콘 "도울 수 없음"(D-21, RESEARCH.md "Open Questions (RESOLVED)" 6번): 배지 배경색은
// tokens.css의 --muted를 그대로 읽어 쓴다(D-26 — 새 색 금지, 값 복제 금지).
const UNSUPPORTED_TITLE = '도울 수 없음';
const UNSUPPORTED_BADGE = '없음';
const SUPPORTED_TITLE = '손 떨림 도우미';

function extractMutedColor(css: string): string {
  const match = /--muted:\s*(#[0-9a-fA-F]+)/.exec(css);
  if (!match?.[1]) {
    throw new Error('tokens.css에 --muted가 없다');
  }
  return match[1];
}

const MUTED_COLOR = extractMutedColor(tokensCssRaw);

export default defineBackground(() => {
  const writer = createStorageWriter();
  const relay = createRelay();
  const frameStates: FrameStates = {};
  (globalThis as typeof globalThis & { frameStates: FrameStates }).frameStates = frameStates;

  // URL 규칙만으로 판정(Task 2) — content script 응답 없음 판정은 Task 3에서 더한다.
  async function updateActionForTab(tabId: number, url: string | undefined): Promise<void> {
    if (isUnsupportedUrl(url)) {
      await chrome.action.setTitle({ tabId, title: UNSUPPORTED_TITLE });
      await chrome.action.setBadgeText({ tabId, text: UNSUPPORTED_BADGE });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: MUTED_COLOR });
      return;
    }
    await chrome.action.setTitle({ tabId, title: SUPPORTED_TITLE });
    await chrome.action.setBadgeText({ tabId, text: '' });
  }

  chrome.tabs.onActivated.addListener(({ tabId }) => {
    void chrome.tabs.get(tabId).then((tab) => updateActionForTab(tabId, tab.url));
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      void updateActionForTab(tabId, tab.url);
    }
  });

  // 시작 때(SW가 막 깨어났을 때): 이미 열려 있는 활성 탭들에도 바로 반영한다.
  void chrome.tabs.query({ active: true }).then((tabs) => {
    for (const tab of tabs) {
      if (tab.id !== undefined) {
        void updateActionForTab(tab.id, tab.url);
      }
    }
  });

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
      if (message.op.kind === 'updateSettings') {
        void writer.updateSettings(message.op.patch).then(sendResponse);
        return true;
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
      message.type === 'hints/state' ||
      message.type === 'hints/key' ||
      message.type === 'mode/report' ||
      message.type === 'confirm/state' ||
      message.type === 'confirm/key'
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
