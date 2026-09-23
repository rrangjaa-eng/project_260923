import { defaultSettings, SETTINGS_KEY, SettingsV1 } from '@/core/settings-schema';
import { createInputPipeline } from '@/page/input/pipeline';
import { hideModeIndicator, showModeIndicator } from '@/page/overlay/mode-indicator';

// 모든 프레임(D-02): allFrames + document_start로 사이트 스크립트보다 먼저 등록한다. 읽기는
// 허용, 쓰기는 금지(D-24) — chrome.storage.*.set은 storage-writer.ts에만 있다.
export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  runAt: 'document_start',
  main() {
    let currentEnabled: boolean | undefined;
    let currentSettings: SettingsV1 = defaultSettings();

    function applyEnabled(enabled: boolean): void {
      if (currentEnabled === enabled) {
        return;
      }
      currentEnabled = enabled;

      if (window.top === window) {
        // 맨 위 프레임에서만 모드 표시를 그린다(D-03).
        if (enabled) {
          showModeIndicator();
        } else {
          hideModeIndicator();
        }
      }

      void chrome.runtime.sendMessage({ type: 'frame/state', enabled });
    }

    // 설정을 읽기 전이라도 리스너를 먼저 걸어야 사이트보다 앞선다(D-06, Pattern 1) — 설정이
    // 오기 전에는 defaultSettings()로 판단한다. signal은 Plan 01-14의 자기 정리용이다.
    const pipelineController = new AbortController();
    createInputPipeline({ getSettings: () => currentSettings, signal: pipelineController.signal });

    void chrome.storage.sync.get(SETTINGS_KEY).then((stored) => {
      const parsed = SettingsV1.safeParse(stored[SETTINGS_KEY]);
      if (parsed.success) {
        currentSettings = parsed.data;
        applyEnabled(parsed.data.data.enabled);
      }
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'sync') {
        return;
      }
      const change = changes[SETTINGS_KEY];
      if (!change) {
        return;
      }
      const parsed = SettingsV1.safeParse(change.newValue);
      if (parsed.success) {
        currentSettings = parsed.data;
        applyEnabled(parsed.data.data.enabled);
      }
    });
  },
});
