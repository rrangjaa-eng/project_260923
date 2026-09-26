import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStorageWriter } from '../../src/worker/storage-writer';
import { HELPER_OFF_KEY, HelperOffV1, SETTINGS_KEY, defaultSettings } from '../../src/core/settings-schema';

// D-25: 동기화된 settings가 깨졌거나 더 새 형식이어도 setEnabled(false)는 원본 보호로 거절하지
// 않고 storage.local에만 꺼짐 표시를 쓴다. storage.sync는 절대 건드리지 않는다(sync.set 호출
// 0번, JSON 불변). 설정이 멀쩡할 때는 지금처럼 sync enabled를 바꾼다(회귀 방지, 단위 C).

interface FakeStorageArea {
  get(key: string | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  setCalls: Array<Record<string, unknown>>;
}

function createFakeArea(): FakeStorageArea {
  const store = new Map<string, unknown>();
  const setCalls: Array<Record<string, unknown>> = [];
  return {
    setCalls,
    async get(key) {
      if (key === null) {
        const result: Record<string, unknown> = {};
        for (const [k, v] of store) {
          result[k] = structuredClone(v);
        }
        return result;
      }
      const value = store.get(key);
      return value === undefined ? {} : { [key]: structuredClone(value) };
    },
    async set(items) {
      setCalls.push(structuredClone(items));
      for (const [k, v] of Object.entries(items)) {
        store.set(k, structuredClone(v));
      }
    },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) {
        store.delete(k);
      }
    },
  };
}

describe('createStorageWriter setEnabled — D-25', () => {
  let sync: FakeStorageArea;
  let local: FakeStorageArea;

  beforeEach(() => {
    sync = createFakeArea();
    local = createFakeArea();
    vi.stubGlobal('chrome', { storage: { sync, local } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('단위 A: sync settings가 더 새 형식(newer-version)이어도 setEnabled(false)는 {ok:true}이고 sync는 불변, local에 꺼짐 표시가 남는다', async () => {
    const corrupted = { schemaVersion: 99, data: { corrupted: true } };
    await sync.set({ [SETTINGS_KEY]: corrupted });
    sync.setCalls.length = 0; // 이 시험 준비용 set은 셈에서 뺀다.

    const writer = createStorageWriter();
    const result = await writer.setEnabled(false);

    expect(result).toEqual({ ok: true });
    const storedSettings = (await sync.get(SETTINGS_KEY))[SETTINGS_KEY];
    expect(JSON.stringify(storedSettings)).toBe(JSON.stringify(corrupted));
    expect(sync.setCalls.length).toBe(0);

    const storedFlag = (await local.get(HELPER_OFF_KEY))[HELPER_OFF_KEY];
    expect(HelperOffV1.safeParse(storedFlag).success).toBe(true);
  });

  it('단위 B: sync settings가 잘못된 v1(invalid)이어도 setEnabled(false)는 {ok:true}이고 sync는 불변, local에 꺼짐 표시가 남는다', async () => {
    const base = defaultSettings();
    const corrupted = { ...base, data: { ...base.data, enabled: 'yes' } };
    await sync.set({ [SETTINGS_KEY]: corrupted });
    sync.setCalls.length = 0;

    const writer = createStorageWriter();
    const result = await writer.setEnabled(false);

    expect(result).toEqual({ ok: true });
    const storedSettings = (await sync.get(SETTINGS_KEY))[SETTINGS_KEY];
    expect(JSON.stringify(storedSettings)).toBe(JSON.stringify(corrupted));
    expect(sync.setCalls.length).toBe(0);

    const storedFlag = (await local.get(HELPER_OFF_KEY))[HELPER_OFF_KEY];
    expect(HelperOffV1.safeParse(storedFlag).success).toBe(true);
  });

  it('단위 C(회귀 방지): sync settings가 멀쩡하면 setEnabled(false)는 지금처럼 sync enabled를 바꾸고 local에 꺼짐 표시를 남기지 않는다', async () => {
    await sync.set({ [SETTINGS_KEY]: defaultSettings() });

    const writer = createStorageWriter();
    const result = await writer.setEnabled(false);

    expect(result).toEqual({ ok: true });
    const storedSettings = (await sync.get(SETTINGS_KEY))[SETTINGS_KEY] as { data: { enabled: boolean } };
    expect(storedSettings.data.enabled).toBe(false);

    const storedFlag = (await local.get(HELPER_OFF_KEY))[HELPER_OFF_KEY];
    expect(storedFlag).toBeUndefined();
  });
});
