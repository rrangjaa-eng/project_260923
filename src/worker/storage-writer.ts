import { isSameElement } from '@/core/fingerprint';
import {
  CURRENT_SCHEMA_VERSION,
  MIGRATION_NOTICE_KEY,
  PressesV1,
  SETTINGS_KEY,
  SettingsV1,
  SiteEntryV1,
  defaultSettings,
  migrate,
  pressesKey,
  settingsSpec,
  siteKey,
  syncItemBytes,
  SYNC_ITEM_LIMIT,
  type Fingerprint,
} from '@/core/settings-schema';
import type { UpdateSettingsPatch } from '@/shared/messages';

// 단일 저장자(D-24): chrome.storage.*.set 호출은 이 파일에만 둔다. 요청은 Promise 줄로 순서대로
// 처리해 연타·동시 요청에도 마지막 요청이 최종 상태가 되게 한다.

export type SetEnabledResult = { ok: true } | { ok: false; reason: 'preserved-original' | 'item-too-large' };

export type UpdateSettingsResult =
  | { ok: true }
  | { ok: false; reason: 'preserved-original' | 'invalid-patch' | 'item-too-large' };

export type RecordPressResult = { ok: true } | { ok: false; reason: 'origin-mismatch' | 'invalid-presses' };

export type SetSiteDisabledResult = { ok: true } | { ok: false; reason: 'invalid-site' | 'item-too-large' };

// 사이트별 자주 누른 기록 상한(D-18 성격 — 무한정 커지지 않게, T-01-18).
const MAX_PRESS_ENTRIES = 200;

// storage.sync 분당 쓰기 한도(D-24, RESEARCH.md Pattern 4): 크롬 문서 한도(120/분)의 여유를 두고
// 60초 창에 100번에 닿으면 한도가 풀릴 때까지 다음 실제 쓰기를 미룬다. 모든 storage.sync.set
// 호출이 이 창을 공유한다(쿼터 자체가 전역이므로).
const SYNC_WRITE_WINDOW_MS = 60_000;
const SYNC_WRITE_LIMIT = 100;

export interface StorageWriter {
  setEnabled(enabled: boolean): Promise<SetEnabledResult>;
  updateSettings(patch: UpdateSettingsPatch): Promise<UpdateSettingsResult>;
  ensureDefaultSettings(): Promise<void>;
  // 형식 변환 실패를 미리 찾아 알린다(D-25) — onInstalled·onStartup이 부른다. 값을 바꾸지 않고
  // 읽기만 한다(쓰기는 실패했을 때 notice 기록, migrated일 때 변환된 값 쓰기 뿐).
  checkSettings(): Promise<void>;
  recordPress(requestOrigin: string, senderOrigin: string, fingerprint: Fingerprint): Promise<RecordPressResult>;
  setSiteDisabled(origin: string, disabled: boolean): Promise<SetSiteDisabledResult>;
}

type SyncSetResult = { ok: true } | { ok: false; reason: 'item-too-large'; key: string };

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

  const writeTimestamps: number[] = [];

  async function waitForSyncWriteSlot(): Promise<void> {
    for (;;) {
      const now = Date.now();
      while (writeTimestamps.length > 0 && now - (writeTimestamps[0] ?? now) >= SYNC_WRITE_WINDOW_MS) {
        writeTimestamps.shift();
      }
      if (writeTimestamps.length < SYNC_WRITE_LIMIT) {
        writeTimestamps.push(now);
        return;
      }
      const oldest = writeTimestamps[0] ?? now;
      const waitMs = SYNC_WRITE_WINDOW_MS - (now - oldest) + 1;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  async function syncSet(items: Record<string, unknown>): Promise<SyncSetResult> {
    // 동기화 항목 크기 한도(D-24, T-01-41): 실제 chrome.storage.sync도 항목당 8KB를 넘으면
    // 거절하지만, 우리가 먼저 걸러 정해진 이유로 응답한다(브라우저 자체 거절은 값을 하나도
    // 쓰지 않은 채 Promise를 던져 올바르게 처리하지 않으면 응답이 영영 오지 않는다).
    for (const [key, value] of Object.entries(items)) {
      if (syncItemBytes(key, value) > SYNC_ITEM_LIMIT) {
        return { ok: false, reason: 'item-too-large', key };
      }
    }
    await waitForSyncWriteSlot();
    await chrome.storage.sync.set(items);
    return { ok: true };
  }

  // settings 읽기(D-25, Pattern 4): migrate()로 검사하고, 실패하면 절대 쓰지 않고(원본 보존)
  // notice:migration-failed를 한 번 기록한다. 변환됐으면(migrated) 변환된 값을 다시 쓴다.
  async function readAndValidateSettings(): Promise<{ ok: true; value: SettingsV1 } | { ok: false }> {
    const existing = await chrome.storage.sync.get(SETTINGS_KEY);
    const result = migrate(existing[SETTINGS_KEY], settingsSpec);
    if (!result.ok) {
      await chrome.storage.local.set({
        [MIGRATION_NOTICE_KEY]: {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          data: { key: SETTINGS_KEY, reason: result.reason, at: Date.now() },
        },
      });
      return { ok: false };
    }
    if (result.migrated) {
      await syncSet({ [SETTINGS_KEY]: result.value });
    }
    return { ok: true, value: result.value };
  }

  // 같은 저장 키(site:<origin>) 쓰기 합치기(D-24): 앞 쓰기가 끝나기 전에 여럿 쌓이면 마지막 값
  // 하나로 합쳐 한 번만 쓴다. 대기 중이던 모든 요청은 그 한 번의 결과를 함께 받는다.
  interface SiteWriteQueue {
    pending: boolean | null;
    writing: boolean;
    waiters: Array<(result: SetSiteDisabledResult) => void>;
  }
  const siteWriteQueues = new Map<string, SiteWriteQueue>();

  async function writeSiteDisabledOnce(key: string, disabled: boolean): Promise<SetSiteDisabledResult> {
    const existing = await chrome.storage.sync.get(key);
    const raw = existing[key];

    let base: SiteEntryV1;
    if (raw === undefined) {
      base = { schemaVersion: CURRENT_SCHEMA_VERSION, data: { disabled: false, pins: [] } };
    } else {
      const parsed = SiteEntryV1.safeParse(raw);
      if (!parsed.success) {
        // 검사 실패 — 아무것도 쓰지 않는다(원본 보존, D-25).
        return { ok: false, reason: 'invalid-site' };
      }
      base = parsed.data;
    }

    const next: SiteEntryV1 = { ...base, data: { ...base.data, disabled } };
    const writeResult = await syncSet({ [key]: next });
    if (!writeResult.ok) {
      return { ok: false, reason: 'item-too-large' };
    }
    return { ok: true };
  }

  async function runSiteWriteQueue(key: string, state: SiteWriteQueue): Promise<void> {
    state.writing = true;
    while (state.pending !== null) {
      const value = state.pending;
      state.pending = null;
      const waiters = state.waiters.splice(0, state.waiters.length);
      // 실제 쓰기는 여전히 단일 저장자 큐를 거친다(D-24 — 다른 키 쓰기와도 순서를 지킨다).
      const result = await enqueue(() => writeSiteDisabledOnce(key, value));
      for (const resolve of waiters) {
        resolve(result);
      }
    }
    state.writing = false;
  }

  return {
    setEnabled(enabled) {
      return enqueue(async () => {
        const read = await readAndValidateSettings();
        if (!read.ok) {
          return { ok: false, reason: 'preserved-original' };
        }

        const next: SettingsV1 = {
          ...read.value,
          data: { ...read.value.data, enabled },
        };
        const writeResult = await syncSet({ [SETTINGS_KEY]: next });
        if (!writeResult.ok) {
          return { ok: false, reason: 'item-too-large' };
        }
        return { ok: true };
      });
    },

    updateSettings(patch) {
      return enqueue(async () => {
        const read = await readAndValidateSettings();
        if (!read.ok) {
          return { ok: false, reason: 'preserved-original' };
        }

        const next = { ...read.value, data: { ...read.value.data, ...patch } };
        const nextParsed = SettingsV1.safeParse(next);
        if (!nextParsed.success) {
          // patch를 합친 결과가 SettingsV1을 어기면 쓰지 않는다(D-25).
          return { ok: false, reason: 'invalid-patch' };
        }

        const writeResult = await syncSet({ [SETTINGS_KEY]: nextParsed.data });
        if (!writeResult.ok) {
          return { ok: false, reason: 'item-too-large' };
        }
        return { ok: true };
      });
    },

    checkSettings() {
      return enqueue(async () => {
        await readAndValidateSettings();
      });
    },

    ensureDefaultSettings() {
      return enqueue(async () => {
        const existing = await chrome.storage.sync.get(SETTINGS_KEY);
        if (existing[SETTINGS_KEY] !== undefined) {
          // 이미 있는 값은 덮어쓰지 않는다 — 원본 보존(D-25).
          return;
        }
        await syncSet({ [SETTINGS_KEY]: defaultSettings() });
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
          // 사이트별 상한(T-01-18) — 가장 적게 누른 것부터 뺀다. WR-04: Array.prototype.sort는
          // 안정 정렬이라 count가 같으면(대부분 1) 원래 순서가 유지되고, 방금 추가한 새 항목은
          // 항상 배열 맨 뒤(동점 중 가장 나중)에 있다 — 그대로 정렬해 자르면 방금 누른 요소가
          // 상한에 걸릴 때마다 곧바로 잘려나간다. 방금 추가된 항목(있다면)은 제외하고 나머지만
          // 정렬·상한을 적용한 뒤 다시 붙인다.
          const justInserted = matchIndex < 0 ? nextCounts[nextCounts.length - 1] : undefined;
          const rest = justInserted ? nextCounts.slice(0, -1) : nextCounts;
          const restLimit = MAX_PRESS_ENTRIES - (justInserted ? 1 : 0);
          const trimmedRest = [...rest].sort((a, b) => b.count - a.count).slice(0, restLimit);
          nextCounts = justInserted ? [...trimmedRest, justInserted] : trimmedRest;
        }

        const next: PressesV1 = { ...base, data: { counts: nextCounts } };
        await chrome.storage.local.set({ [key]: next });
        return { ok: true };
      });
    },

    setSiteDisabled(origin, disabled) {
      const key = siteKey(origin);
      return new Promise((resolve) => {
        let state = siteWriteQueues.get(key);
        if (!state) {
          state = { pending: disabled, writing: false, waiters: [] };
          siteWriteQueues.set(key, state);
        } else {
          // 쓰기 합치기: 앞 쓰기가 끝나기 전이면 최신 값으로 덮어쓴다.
          state.pending = disabled;
        }
        state.waiters.push(resolve);
        if (!state.writing) {
          void runSiteWriteQueue(key, state);
        }
      });
    },
  };
}
