import { SETTINGS_KEY, SettingsV1, defaultSettings } from '@/core/settings-schema';

// 단일 저장자(D-24): chrome.storage.*.set 호출은 이 파일에만 둔다. 요청은 Promise 줄로 순서대로
// 처리해 연타·동시 요청에도 마지막 요청이 최종 상태가 되게 한다.

export type SetEnabledResult = { ok: true } | { ok: false; reason: 'invalid-settings' };

export interface StorageWriter {
  setEnabled(enabled: boolean): Promise<SetEnabledResult>;
  ensureDefaultSettings(): Promise<void>;
}

export function createStorageWriter(): StorageWriter {
  let queue: Promise<unknown> = Promise.resolve();

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task);
    // 앞선 작업이 실패해도 뒤에 오는 요청은 계속 처리한다.
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return {
    setEnabled(enabled) {
      return enqueue(async () => {
        const existing = await chrome.storage.sync.get(SETTINGS_KEY);
        const parsed = SettingsV1.safeParse(existing[SETTINGS_KEY]);
        if (!parsed.success) {
          // 검사 실패 — 아무것도 쓰지 않는다(원본 보존, D-25). 알림은 Plan 01-14.
          return { ok: false, reason: 'invalid-settings' };
        }

        const next: SettingsV1 = {
          ...parsed.data,
          data: { ...parsed.data.data, enabled },
        };
        await chrome.storage.sync.set({ [SETTINGS_KEY]: next });
        return { ok: true };
      });
    },

    ensureDefaultSettings() {
      return enqueue(async () => {
        const existing = await chrome.storage.sync.get(SETTINGS_KEY);
        if (existing[SETTINGS_KEY] !== undefined) {
          // 이미 있는 값은 덮어쓰지 않는다 — 원본 보존(D-25).
          return;
        }
        await chrome.storage.sync.set({ [SETTINGS_KEY]: defaultSettings() });
      });
    },
  };
}
