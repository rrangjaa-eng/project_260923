// 최소 chrome 확장 API 타입 — `@types/chrome`는 승인된 의존성 목록에 없어(CLAUDE.md "새 의존성은
// 승인 후") 이 계획(01-01)이 실제로 쓰는 표면만 선언한다. 이후 계획이 더 쓰는 API는 여기에 더한다.
declare namespace chrome.runtime {
  function reload(): void;
  const onInstalled: {
    addListener(callback: () => void): void;
  };
}

declare namespace chrome.storage {
  interface StorageArea {
    get(key: string): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
  }
  const sync: StorageArea;
  const local: StorageArea;
}
