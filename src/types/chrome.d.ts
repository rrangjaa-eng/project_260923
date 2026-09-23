// 최소 chrome 확장 API 타입 — `@types/chrome`는 승인된 의존성 목록에 없어(CLAUDE.md "새 의존성은
// 승인 후") 이 계획들이 실제로 쓰는 표면만 선언한다. 이후 계획이 더 쓰는 API는 여기에 더한다.
declare namespace chrome.runtime {
  const id: string;
  function reload(): void;
  const onInstalled: {
    addListener(callback: () => void): void;
  };

  interface MessageSender {
    id?: string;
    tab?: { id?: number };
    frameId?: number;
  }

  const onMessage: {
    addListener(
      callback: (message: unknown, sender: MessageSender, sendResponse: (response?: unknown) => void) => boolean | undefined,
    ): void;
  };

  function sendMessage(message: unknown): Promise<unknown>;
}

declare namespace chrome.storage {
  interface StorageArea {
    get(key: string): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
  }
  const sync: StorageArea;
  const local: StorageArea;

  interface StorageChange {
    oldValue?: unknown;
    newValue?: unknown;
  }

  const onChanged: {
    addListener(callback: (changes: Record<string, StorageChange>, areaName: string) => void): void;
  };
}

declare namespace chrome.tabs {
  interface Tab {
    id?: number;
    url?: string;
  }

  function query(queryInfo: { url?: string | string[] }): Promise<Tab[]>;
}
