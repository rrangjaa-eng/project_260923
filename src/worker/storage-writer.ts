import { isSameElement } from '@/core/fingerprint';
import {
  CURRENT_SCHEMA_VERSION,
  PressesV1,
  SETTINGS_KEY,
  SettingsV1,
  defaultSettings,
  pressesKey,
  type Fingerprint,
} from '@/core/settings-schema';
import type { UpdateSettingsPatch } from '@/shared/messages';

// 단일 저장자(D-24): chrome.storage.*.set 호출은 이 파일에만 둔다. 요청은 Promise 줄로 순서대로
// 처리해 연타·동시 요청에도 마지막 요청이 최종 상태가 되게 한다.

export type SetEnabledResult = { ok: true } | { ok: false; reason: 'invalid-settings' };

export type UpdateSettingsResult = { ok: true } | { ok: false; reason: 'invalid-settings' | 'invalid-patch' };

export type RecordPressResult = { ok: true } | { ok: false; reason: 'origin-mismatch' | 'invalid-presses' };

// 사이트별 자주 누른 기록 상한(D-18 성격 — 무한정 커지지 않게, T-01-18).
const MAX_PRESS_ENTRIES = 200;

export interface StorageWriter {
  setEnabled(enabled: boolean): Promise<SetEnabledResult>;
  updateSettings(patch: UpdateSettingsPatch): Promise<UpdateSettingsResult>;
  ensureDefaultSettings(): Promise<void>;
  recordPress(requestOrigin: string, senderOrigin: string, fingerprint: Fingerprint): Promise<RecordPressResult>;
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

    updateSettings(patch) {
      return enqueue(async () => {
        const existing = await chrome.storage.sync.get(SETTINGS_KEY);
        const parsed = SettingsV1.safeParse(existing[SETTINGS_KEY]);
        if (!parsed.success) {
          // 검사 실패 — 아무것도 쓰지 않는다(원본 보존, D-25).
          return { ok: false, reason: 'invalid-settings' };
        }

        const next = { ...parsed.data, data: { ...parsed.data.data, ...patch } };
        const nextParsed = SettingsV1.safeParse(next);
        if (!nextParsed.success) {
          // patch를 합친 결과가 SettingsV1을 어기면 쓰지 않는다(D-25).
          return { ok: false, reason: 'invalid-patch' };
        }

        await chrome.storage.sync.set({ [SETTINGS_KEY]: nextParsed.data });
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

    recordPress(requestOrigin, senderOrigin, fingerprint) {
      return enqueue(async () => {
        // 요청 origin이 실제로 보낸 프레임의 origin과 같을 때만 기록한다(T-01-16 — 다른 사이트
        // 기록 조작 방지).
        if (requestOrigin !== senderOrigin) {
          return { ok: false, reason: 'origin-mismatch' };
        }

        const key = pressesKey(requestOrigin);
        const existing = await chrome.storage.local.get(key);
        const raw = existing[key];

        let base: PressesV1;
        if (raw === undefined) {
          base = { schemaVersion: CURRENT_SCHEMA_VERSION, data: { counts: [] } };
        } else {
          const parsed = PressesV1.safeParse(raw);
          if (!parsed.success) {
            // 검사 실패 — 아무것도 쓰지 않는다(원본 보존, D-25).
            return { ok: false, reason: 'invalid-presses' };
          }
          base = parsed.data;
        }

        const matchIndex = base.data.counts.findIndex((entry) => isSameElement(entry.fingerprint, fingerprint));
        let nextCounts =
          matchIndex >= 0
            ? base.data.counts.map((entry, i) => (i === matchIndex ? { ...entry, count: entry.count + 1 } : entry))
            : [...base.data.counts, { fingerprint, count: 1 }];

        if (nextCounts.length > MAX_PRESS_ENTRIES) {
          // 사이트별 상한(T-01-18) — 가장 적게 누른 것부터 뺀다.
          nextCounts = [...nextCounts].sort((a, b) => b.count - a.count).slice(0, MAX_PRESS_ENTRIES);
        }

        const next: PressesV1 = { ...base, data: { counts: nextCounts } };
        await chrome.storage.local.set({ [key]: next });
        return { ok: true };
      });
    },
  };
}
