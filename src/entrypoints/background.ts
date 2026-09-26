import tokensCssRaw from '../../docs/design/tokens.css?raw';
import { inheritedSiteOrigin, isUnsupportedUrl } from '@/core/unsupported-url';
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

  // 탭별 맨 위 문서 출처 기록(01-19 Task 2, T-01-59): frameId 0이 보낸 메시지의 Chrome
  // sender.origin — 주소 없는 새 창(about: 탭)의 사이트 정체를 이 값으로만 정한다. 페이지나
  // 메시지 본문이 준 문자열은 신뢰하지 않는다. Map — 동적 delete가 인덱스 시그니처보다 안전하다.
  const topDocOrigins = new Map<number, string>();

  // about: 탭은 물려받은 출처(topDocOrigins)로, 그 밖은 지금처럼 tab.url의 출처로 사이트를
  // 정한다. topDocOrigins에 아직 없으면(맨 위의 첫 보고 전) undefined — 호출부가 실패로 다룬다.
  function siteOriginOfTab(tabId: number | undefined, tabUrl: string | undefined): string | undefined {
    if (tabUrl?.startsWith('about:')) {
      return tabId !== undefined ? (inheritedSiteOrigin(tabUrl, topDocOrigins.get(tabId)) ?? undefined) : undefined;
    }
    return tabUrl ? new URL(tabUrl).origin : undefined;
  }

  async function markUnsupported(tabId: number): Promise<void> {
    await chrome.action.setTitle({ tabId, title: UNSUPPORTED_TITLE });
    await chrome.action.setBadgeText({ tabId, text: UNSUPPORTED_BADGE });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: MUTED_COLOR });
  }

  // 맨 위 프레임에 site/ping을 보내 1초 안에 { ok: true }가 오는지 확인한다(RESEARCH.md
  // "Open Questions (RESOLVED)" 6번) — 주소 규칙을 통과해도 content script가 실제로 들어가
  // 있지 않으면(예: CSP: sandbox 최상위 문서) 도울 수 없음으로 본다.
  // WR-06: document.write 새 창·맨 위 다시 쓰기는 옛 인스턴스 정리 → frame/reinject →
  // executeScript 왕복을 거쳐야 새 인스턴스가 답한다 — 한 번만 물으면 그 왕복과 경쟁해 수신자
  // 없음으로 실패할 수 있다. 짧은 간격으로 다시 확인한다.
  const SITE_PING_RETRY_DELAYS_MS = [250, 250];
  async function respondsToSitePing(tabId: number): Promise<boolean> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        const response = await Promise.race([
          chrome.tabs.sendMessage(tabId, { type: 'site/ping' }, { frameId: 0 }),
          new Promise<undefined>((resolve) => {
            setTimeout(() => {
              resolve(undefined);
            }, 1000);
          }),
        ]);
        if ((response as { ok?: boolean } | undefined)?.ok === true) {
          return true;
        }
      } catch {
        // 수신자 없음 등 — 아래에서 재시도하거나 포기한다.
      }
      const delay = SITE_PING_RETRY_DELAYS_MS[attempt];
      if (delay === undefined) {
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // WR-06: 겹친 updateActionForTab 호출(onUpdated·onActivated가 거의 동시에 도는 등) 중 늦게
  // 끝난 옛 호출이 나중에 끝난 새 호출의 결과를 덮어쓰지 않게, 탭별 세대 번호로 옛 결과를 버린다.
  const actionGenerationByTab = new Map<number, number>();

  async function updateActionForTab(tabId: number, url: string | undefined): Promise<void> {
    const generation = (actionGenerationByTab.get(tabId) ?? 0) + 1;
    actionGenerationByTab.set(tabId, generation);
    const isCurrent = (): boolean => actionGenerationByTab.get(tabId) === generation;

    // Task 2(01-19): about: 탭(주소 없는 새 창)은 주소만으로 판정하지 않는다 — content script는
    // Task 1의 맨 위 가드 때문에 물려받은 http(s) 출처가 있을 때만 시작하므로, ping 응답 여부가
    // 곧 도울 수 있는지다. 그 밖의 주소(브라우저 내부·스토어)는 지금 규칙 그대로다.
    if (!url?.startsWith('about:') && isUnsupportedUrl(url)) {
      if (isCurrent()) {
        await markUnsupported(tabId);
      }
      return;
    }
    const supported = await respondsToSitePing(tabId);
    if (!isCurrent()) {
      return;
    }
    if (!supported) {
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
    if (changeInfo.status === 'loading') {
      // Task 2(01-19): 새 이동이 시작됐다 — 옛 문서의 물려받은 출처 기록을 지운다(다음 about:
      // 문서가 다른 출처를 물려받을 수 있다).
      topDocOrigins.delete(tabId);
    }
    if (changeInfo.status === 'complete') {
      void updateActionForTab(tabId, tab.url);
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    topDocOrigins.delete(tabId);
    actionGenerationByTab.delete(tabId);
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
  // CR-08 e2e 전용 시험 훅(제품 기능 아님, 위 disconnectAlivePorts와 같은 이유): SW가 유휴에서
  // 다시 시작하면 relay.ts의 메모리 상태가 통째로 사라진다 — 실제 재시작은 새 createRelay()를
  // 만들 뿐이라 이 훅으로 직접 흉내 낸다.
  (globalThis as typeof globalThis & { resetRelayForE2E: () => void }).resetRelayForE2E = () => {
    relay.resetForE2E();
  };

  // e2e 전용 시험 훅(제품 기능 아님, 위 disconnectAlivePorts·resetRelayForE2E와 같은 이유,
  // IN-02): site/query가 남은 횟수만큼 빈 답을 주게 한다 — 페이지·content script는 닿지 못하고
  // (SW 전역, 개발자 도구·CDP에서만) 실제 site/query 실패(예: sender.tab.url 계산 불가)를 결정적
  // 으로 재현한다(01-18 Task 2).
  let siteQueryFailuresLeftForE2E = 0;
  (globalThis as typeof globalThis & { failSiteQueryForE2E: (count: number) => void }).failSiteQueryForE2E = (count) => {
    siteQueryFailuresLeftForE2E = Math.max(0, Math.trunc(count));
  };

  // e2e 전용 시험 훅(제품 기능 아님, 위 훅들과 같은 이유, WR-03): storage/request 응답을 남은
  // 횟수만큼 보류한다(sendResponse를 아예 부르지 않는다) — 팝업 쪽 클라이언트 타임아웃(popup/
  // main.ts sendWithRevert)을 실제 SW 무응답과 구분 없이 재현한다.
  let holdStorageResponseLeftForE2E = 0;
  (globalThis as typeof globalThis & { holdStorageResponseForE2E: (count: number) => void }).holdStorageResponseForE2E = (
    count,
  ) => {
    holdStorageResponseLeftForE2E = Math.max(0, Math.trunc(count));
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

  // 확대 역보정(Plan 01-15, D-26, RESEARCH Pattern 5): 확대가 바뀌면 그 탭의 모든 프레임에
  // 새 비율을 방송한다(frameId 생략 = 모든 프레임). 탭이 이미 닫혔을 수 있어 실패는 무시한다.
  chrome.tabs.onZoomChange.addListener((info) => {
    void chrome.tabs.sendMessage(info.tabId, { type: 'zoom/changed', zoom: info.newZoomFactor }).catch(() => {
      // 보낼 곳이 없다(닫힌 탭 등) — 무시.
    });
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

    // Task 2(01-19, T-01-59): 맨 위(frameId 0)가 보낸 메시지라면 어떤 종류든 그 탭의 물려받은
    // 출처를 기록한다 — 다음 site/query·recordPress·setSiteDisabled 대조가 이 값을 쓴다.
    // WR-03: sender.tab.url(Chrome이 메시지 처리 시점에 채운, 커밋된 탭 주소)이 about:일 때만
    // 기록한다 — 그렇지 않으면 이동이 막 시작돼(status: loading) 지운 뒤에도 아직 살아 있는
    // 옛 https 문서가 보낸 메시지가 새 about: 문서의 사이트 정체를 덮어쓸 수 있다.
    if (sender.frameId === 0 && sender.tab?.id !== undefined && sender.origin && sender.tab.url?.startsWith('about:')) {
      topDocOrigins.set(sender.tab.id, sender.origin);
    }

    if (message.type === 'storage/request') {
      // WR-03 e2e 전용 훅: 남은 보류 횟수가 있으면 sendResponse를 부르지 않고 그대로 둔다(응답
      // 없음을 재현). 채널은 열어 둔다(return true) — 팝업의 클라이언트 타임아웃이 실제로 뜨는지
      // 시험한다.
      if (holdStorageResponseLeftForE2E > 0) {
        holdStorageResponseLeftForE2E -= 1;
        return true;
      }
      // WR-07: writer.*()가 예기치 않게 거부되면(원래 storage-writer.ts 안에서 다 잡아야 하지만,
      // 메시지 경계에서도 한 번 더 막아 둔다) .then(sendResponse)만으로는 sendResponse가 영영
      // 불리지 않아 요청 쪽(팝업 등)이 응답 없이 멈춘다 — .catch로 반드시 한 번은 답한다.
      if (message.op.kind === 'setEnabled') {
        void writer
          .setEnabled(message.op.enabled)
          .then(sendResponse)
          .catch(() => {
            sendResponse({ ok: false });
          });
        return true; // 비동기 응답을 위해 메시지 채널을 열어 둔다.
      }
      if (message.op.kind === 'updateSettings') {
        void writer
          .updateSettings(message.op.patch)
          .then(sendResponse)
          .catch(() => {
            sendResponse({ ok: false });
          });
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
          const tabOrigin = siteOriginOfTab(op.tabId, tab?.url);
          if (tabOrigin === undefined || tabOrigin !== op.origin) {
            sendResponse({ ok: false, reason: 'origin-mismatch' });
            return;
          }
          const result = await writer.setSiteDisabled(op.origin, op.disabled);
          sendResponse(result);
        })().catch(() => {
          sendResponse({ ok: false });
        });
        return true;
      }
      // recordPress(D-11, T-01-16): 보낸 프레임의 실제 origin은 sender.url에서 계산한다 —
      // 요청 안의 origin 문자열은 신뢰하지 않고 storage-writer.ts가 둘을 대조한다. WR-05: 자식
      // 프레임도 이제 "사이트 = 맨 위 페이지 출처"(D-20)로 기록한다 — 요청 origin이 자기 프레임
      // 출처 또는(그 프레임이 속한 탭의) 맨 위 문서 출처와 같으면 받아들인다(site/query와 같은
      // "모든 프레임의 sender.tab.url은 항상 맨 위 문서의 주소와 같다" 전제).
      const frameOrigin = sender.url ? new URL(sender.url).origin : '';
      const tabOrigin = siteOriginOfTab(sender.tab?.id, sender.tab?.url);
      const senderOrigin = message.op.origin === tabOrigin ? tabOrigin : frameOrigin;
      void writer
        .recordPress(message.op.origin, senderOrigin, message.op.fingerprint)
        .then(sendResponse)
        .catch(() => {
          sendResponse({ ok: false });
        });
      return true;
    }

    if (message.type === 'frame/reinject') {
      // 01-17 Task 2(D-22 문서 다시 쓰기 대응, T-01-49): 대상은 Chrome이 채운 sender.tab.id·
      // sender.frameId뿐이다 — 메시지 본문의 값은 없다(스푸핑 방지, 위 sender.id 확인·parseMessage
      // 검사를 이미 지났다). 보낸 프레임 하나에만 새 content script를 넣는다.
      const tabId = sender.tab?.id;
      const frameId = sender.frameId;
      if (tabId === undefined || frameId === undefined) {
        return undefined;
      }
      const manifest = chrome.runtime.getManifest();
      const files = manifest.content_scripts?.[0]?.js ?? [];
      if (files.length === 0) {
        return undefined;
      }
      void chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files }).catch(() => {
        // 프레임이 그사이 사라졌을 수 있다(예: iframe 제거) — 무시.
      });
      return undefined;
    }

    if (message.type === 'site/query') {
      // e2e 전용 훅(01-18 Task 2): 남은 횟수가 있으면 빈 답으로 실패를 흉내 낸다.
      if (siteQueryFailuresLeftForE2E > 0) {
        siteQueryFailuresLeftForE2E -= 1;
        sendResponse({});
        return undefined;
      }
      // 모든 프레임의 sender.tab.url은 항상 맨 위 문서의 주소와 같다 — 어느 프레임이 물어봐도
      // 같은 답을 준다(D-20 "사이트 = 맨 위 페이지 출처"). about: 탭(01-19 Task 2)은
      // siteOriginOfTab이 topDocOrigins로 풀어준다 — 아직 없으면(맨 위의 첫 보고 전) 빈 답을
      // 주고, 자식은 01-18의 재시도로 기록이 채워질 때까지 기다린다.
      const topOrigin = siteOriginOfTab(sender.tab?.id, sender.tab?.url) ?? '';
      sendResponse({ topOrigin });
      return undefined;
    }

    if (message.type === 'zoom/query') {
      // 확대 역보정(Plan 01-15): 이 프레임이 속한 탭의 지금 확대 비율을 답한다.
      const tabId = sender.tab?.id;
      if (tabId === undefined) {
        sendResponse({ zoom: 1 });
        return undefined;
      }
      void chrome.tabs.getZoom(tabId).then((zoom) => {
        sendResponse({ zoom });
      });
      return true;
    }

    if (
      message.type === 'frame/report' ||
      message.type === 'hints/press' ||
      message.type === 'press/refused' ||
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
      message.type === 'site/ping' ||
      message.type === 'zoom/changed'
    ) {
      // SW → 프레임 방향 메시지다(site/ping도 SW → 맨 위 프레임, zoom/changed도 위
      // onZoomChange가 chrome.tabs.sendMessage로 직접 보낸다). background.ts는 이 방향으로는
      // 받지 않으므로 받을 일이 없다 — 방어적으로 무시한다.
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
