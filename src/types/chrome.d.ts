// 최소 chrome 확장 API 타입 — `@types/chrome`는 승인된 의존성 목록에 없어(CLAUDE.md "새 의존성은
// 승인 후") 이 계획들이 실제로 쓰는 표면만 선언한다. 이후 계획이 더 쓰는 API는 여기에 더한다.
declare namespace chrome.runtime {
  const id: string;
  function reload(): void;
  interface InstalledDetails {
    reason: 'install' | 'update' | 'chrome_update' | 'shared_module_update';
  }
  const onInstalled: {
    addListener(callback: (details: InstalledDetails) => void): void;
  };
  const onStartup: {
    addListener(callback: () => void): void;
  };

  interface MessageSender {
    id?: string;
    tab?: { id?: number; url?: string };
    frameId?: number;
    url?: string;
  }

  const onMessage: {
    addListener(
      callback: (message: unknown, sender: MessageSender, sendResponse: (response?: unknown) => void) => boolean | undefined,
    ): void;
    removeListener(
      callback: (message: unknown, sender: MessageSender, sendResponse: (response?: unknown) => void) => boolean | undefined,
    ): void;
  };

  function sendMessage(message: unknown): Promise<unknown>;

  // 옛 도우미 자기 정리(D-22, Plan 01-14): "alive" 포트가 끊기면(onDisconnect) chrome.runtime?.id로
  // 실제 무효화(확장 업데이트·제거)인지 SW가 잠깐 쉬었다 끊긴 것뿐인지 구분한다(RESEARCH.md Pattern 6).
  interface Port {
    name: string;
    onDisconnect: { addListener(callback: () => void): void };
    disconnect(): void;
  }
  function connect(connectInfo?: { name?: string }): Port;
  const onConnect: {
    addListener(callback: (port: Port) => void): void;
  };

  function getManifest(): { content_scripts?: Array<{ js?: string[] }> };

  // 오버레이·메뉴 서체(D-26, Plan 01-16): web_accessible_resources로 연 fonts/*.woff2를
  // FontFace가 fetch할 수 있는 chrome-extension:// URL로 바꾼다.
  function getURL(path: string): string;
}

declare namespace chrome.storage {
  interface StorageArea {
    get(key: string): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
    // WR-08: notice:migration-failed를 지울 때 쓴다(storage-writer.ts).
    remove(keys: string | string[]): Promise<void>;
  }
  const sync: StorageArea;
  const local: StorageArea;

  interface StorageChange {
    oldValue?: unknown;
    newValue?: unknown;
  }

  const onChanged: {
    addListener(callback: (changes: Record<string, StorageChange>, areaName: string) => void): void;
    // 옛 도우미 자기 정리(01-17 Task 2, D-22 문서 다시 쓰기 대응): cleanupOldHelper()가 이 인스턴스가
    // 건 리스너를 뗀다 — addListener와 같은 콜백 모양이어야 뗄 수 있다.
    removeListener(callback: (changes: Record<string, StorageChange>, areaName: string) => void): void;
  };
}

declare namespace chrome.tabs {
  interface Tab {
    id?: number;
    url?: string;
  }

  function query(queryInfo: { url?: string | string[]; active?: boolean; currentWindow?: boolean }): Promise<Tab[]>;
  function get(tabId: number): Promise<Tab>;

  // 확대 역보정(Plan 01-15, D-26, RESEARCH Pattern 5): SW가 탭의 확대 비율을 읽고(getZoom)
  // 바뀔 때 알려 준다(onZoomChange). e2e는 setZoom으로 확대를 직접 바꾼다.
  function getZoom(tabId: number): Promise<number>;
  function setZoom(tabId: number, zoomFactor: number): Promise<void>;
  interface ZoomChangeInfo {
    tabId: number;
    oldZoomFactor: number;
    newZoomFactor: number;
  }
  const onZoomChange: {
    addListener(callback: (info: ZoomChangeInfo) => void): void;
  };

  // frameId를 생략하면 그 탭의 모든 프레임에 보낸다(hints/state 방송에 씀).
  function sendMessage(tabId: number, message: unknown, options?: { frameId?: number }): Promise<unknown>;

  interface TabChangeInfo {
    status?: string;
  }

  const onRemoved: {
    addListener(callback: (tabId: number, removeInfo: unknown) => void): void;
  };

  const onUpdated: {
    addListener(callback: (tabId: number, changeInfo: TabChangeInfo, tab: Tab) => void): void;
  };

  const onActivated: {
    addListener(callback: (activeInfo: { tabId: number; windowId: number }) => void): void;
  };
}

// 업데이트 직후 새 도우미 넣기(D-22, Plan 01-14): manifest의 scripting 권한으로 이미 열린
// 탭에 content script를 다시 넣는다.
declare namespace chrome.scripting {
  // frameIds(01-17 Task 2, D-22 문서 다시 쓰기 대응): 보낸 프레임 하나에만 새 content script를
  // 다시 넣는다 — allFrames(업데이트 직후 전체 재주입)와는 다른 좁은 대상.
  function executeScript(details: {
    target: { tabId: number; allFrames?: boolean; frameIds?: number[] };
    files: string[];
  }): Promise<unknown>;
}

// 확장 아이콘(D-21): 제목·배지로 "도울 수 없음"을 알린다. tabId를 생략하면 기본값에 적용된다
// (이 계획들은 항상 tabId를 명시해서 쓴다).
declare namespace chrome.action {
  function setTitle(details: { tabId?: number; title: string }): Promise<void>;
  function getTitle(details: { tabId?: number }): Promise<string>;
  function setBadgeText(details: { tabId?: number; text: string }): Promise<void>;
  function getBadgeText(details: { tabId?: number }): Promise<string>;
  function setBadgeBackgroundColor(details: { tabId?: number; color: string }): Promise<void>;
}
