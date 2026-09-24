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

  async function markUnsupported(tabId: number): Promise<void> {
    await chrome.action.setTitle({ tabId, title: UNSUPPORTED_TITLE });
    await chrome.action.setBadgeText({ tabId, text: UNSUPPORTED_BADGE });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: MUTED_COLOR });
  }

  // 맨 위 프레임에 site/ping을 보내 1초 안에 { ok: true }가 오는지 확인한다(RESEARCH.md
  // "Open Questions (RESOLVED)" 6번) — 주소 규칙을 통과해도 content script가 실제로 들어가
  // 있지 않으면(예: CSP: sandbox 최상위 문서) 도울 수 없음으로 본다.
  async function respondsToSitePing(tabId: number): Promise<boolean> {
    try {
      const response = await Promise.race([
        chrome.tabs.sendMessage(tabId, { type: 'site/ping' }, { frameId: 0 }),
        new Promise<undefined>((resolve) => {
          setTimeout(() => {
            resolve(undefined);
          }, 1000);
        }),
      ]);
      return (response as { ok?: boolean } | undefined)?.ok === true;
    } catch {
      return false;
    }
  }

  async function updateActionForTab(tabId: number, url: string | undefined): Promise<void> {
    if (isUnsupportedUrl(url)) {
      await markUnsupported(tabId);
      return;
    }
    if (!(await respondsToSitePing(tabId))) {
      await markUnsupported(tabId);
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

  // 옛 도우미 자기 정리(D-22, RESEARCH.md Pattern 6): content script가 여는 "alive" 포트를
  // 모아 둔다. 포트가 끊기면(SW가 쉬었다 깼거나 탭이 닫혔거나) 목록에서 뺀다 — 우리가 직접
  // disconnect()를 부르는 일은 없다(그건 e2e가 SW 유휴를 흉내 낼 때만 쓰는 시험 훅이다).
  const alivePorts = new Set<chrome.runtime.Port>();
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'alive') {
      return;
    }
    alivePorts.add(port);
    port.onDisconnect.addListener(() => {
      alivePorts.delete(port);
    });
  });
  // e2e 전용 시험 훅(제품 기능 아님): SW가 잠깐 쉬었다 깬 것처럼 모든 alive 포트를 끊는다 —
  // 실제 브라우저는 SW가 유휴(약 30초)에 들면 이렇게 포트가 끊긴다.
  (globalThis as typeof globalThis & { disconnectAlivePorts: () => void }).disconnectAlivePorts = () => {
    for (const port of alivePorts) {
      port.disconnect();
    }
    alivePorts.clear();
  };

  // 업데이트 직후 새 도우미 넣기(D-22, RESEARCH.md Pattern 6): 이미 열려 있는 탭들에 지금
  // content script를 다시 넣는다 — 옛 도우미는 (열려 있었다면) 스스로 정리하고, 새 도우미가
  // 한 번만 들어간다. 도울 수 없는 주소는 건너뛴다(T-01-43).
  async function injectContentScriptIntoOpenTabs(): Promise<void> {
    const manifest = chrome.runtime.getManifest();
    const files = manifest.content_scripts?.[0]?.js ?? [];
    if (files.length === 0) {
      return;
    }
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id === undefined || isUnsupportedUrl(tab.url)) {
        continue;
      }
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files });
      } catch {
        // 실패한 탭은 건너뛴다(오류 기록만, T-01-43) — 예: 방금 닫힌 탭.
      }
    }
  }

  chrome.runtime.onInstalled.addListener((details) => {
    // 없을 때만 기본값(D-06)을 먼저 채운 뒤, 형식 변환 실패를 미리 찾아 알린다(D-22, D-25) —
    // 순서가 뒤집히면 방금 설치한 빈 저장소도 "형식 없음"으로 오판해 알림이 잘못 뜬다.
    void writer.ensureDefaultSettings().then(() => writer.checkSettings());
    // 이미 열린 탭에 다시 넣기는 "업데이트" 때만(D-22) — reason이 'install'(첫 설치)일 때 하면,
    // 방금 새로 연 탭에 manifest가 이미 자연 주입한 것과 경합해 같은 문서에 content script가
    // 두 번 들어간다(리스너·오버레이가 겹쳐 번호표·클릭이 흔들리는 실제 회귀를 시험으로 확인).
    if (details.reason === 'update') {
      void injectContentScriptIntoOpenTabs();
    }
  });

  chrome.runtime.onStartup.addListener(() => {
    // 브라우저 재시작(D-22): 다른 PC가 그사이 storage.sync를 깨진 값으로 바꿨을 수 있다 —
    // 여기서도 확인해 알린다.
    void writer.checkSettings();
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
      if (message.op.kind === 'setSiteDisabled') {
        // T-01-36: 팝업은 확장 페이지라 sender.url로 대상 탭을 알 수 없다 — 요청의 tabId로
        // 실제 탭을 찾아 그 탭 주소의 출처와 요청 origin이 같을 때만 받아들인다.
        void (async () => {
          const op = message.op;
          if (op.kind !== 'setSiteDisabled') {
            return;
          }
          const tab = await chrome.tabs.get(op.tabId).catch(() => undefined);
          const tabOrigin = tab?.url ? new URL(tab.url).origin : undefined;
          if (tabOrigin === undefined || tabOrigin !== op.origin) {
            sendResponse({ ok: false, reason: 'origin-mismatch' });
            return;
          }
          const result = await writer.setSiteDisabled(op.origin, op.disabled);
          sendResponse(result);
        })();
        return true;
      }
      // recordPress(D-11, T-01-16): 보낸 프레임의 실제 origin은 sender.url에서 계산한다 —
      // 요청 안의 origin 문자열은 신뢰하지 않고 storage-writer.ts가 둘을 대조한다.
      const senderOrigin = sender.url ? new URL(sender.url).origin : '';
      void writer.recordPress(message.op.origin, senderOrigin, message.op.fingerprint).then(sendResponse);
      return true;
    }

    if (message.type === 'site/query') {
      // 모든 프레임의 sender.tab.url은 항상 맨 위 문서의 주소와 같다 — 어느 프레임이 물어봐도
      // 같은 답을 준다(D-20 "사이트 = 맨 위 페이지 출처").
      const topOrigin = sender.tab?.url ? new URL(sender.tab.url).origin : '';
      sendResponse({ topOrigin });
      return undefined;
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

    if (
      message.type === 'frames/reports' ||
      message.type === 'press/request' ||
      message.type === 'frame/refresh' ||
      message.type === 'site/ping'
    ) {
      // SW → 프레임 방향 메시지다(site/ping도 SW → 맨 위 프레임). background.ts는 이 방향으로는
      // 받지 않으므로(relay.ts·respondsToSitePing이 chrome.tabs.sendMessage로 직접 보낸다)
      // 받을 일이 없다 — 방어적으로 무시한다.
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
