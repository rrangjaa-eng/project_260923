import { SETTINGS_KEY, defaultSettings } from '@/core/settings-schema';

// 이 phase의 단일 저장자가 들어갈 자리(Plan 01-02가 src/worker/storage-writer.ts로 옮긴다, D-24).
export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    void chrome.storage.sync.get(SETTINGS_KEY).then((existing) => {
      if (existing[SETTINGS_KEY] !== undefined) {
        // 이미 있는 값은 덮어쓰지 않는다 — 원본 보존(D-25).
        return;
      }
      return chrome.storage.sync.set({ [SETTINGS_KEY]: defaultSettings() });
    });
  });
});
