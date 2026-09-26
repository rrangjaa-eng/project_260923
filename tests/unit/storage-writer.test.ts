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
    get(key) {
      if (key === null) {
        const result: Record<string, unknown> = {};
        for (const [k, v] of store) {
          result[k] = structuredClone(v);
        }
        return Promise.resolve(result);
      }
      const value = store.get(key);
      return Promise.resolve(value === undefined ? {} : { [key]: structuredClone(value) });
    },
    set(items) {
      setCalls.push(structuredClone(items));
      for (const [k, v] of Object.entries(items)) {
        store.set(k, structuredClone(v));
      }
      return Promise.resolve();
    },
    remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) {
        store.delete(k);
      }
      return Promise.resolve();
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

  it('단위 D: 설정이 깨져 있고 local에 꺼짐 표시가 있을 때 setEnabled(true)는 표시만 지우고 sync는 불변이다', async () => {
    const corrupted = { schemaVersion: 99, data: { corrupted: true } };
    await sync.set({ [SETTINGS_KEY]: corrupted });
    await local.set({ [HELPER_OFF_KEY]: { schemaVersion: 1, data: { at: 1 } } });
    sync.setCalls.length = 0;

    const writer = createStorageWriter();
    const result = await writer.setEnabled(true);

    expect(result).toEqual({ ok: true });
    const storedFlag = (await local.get(HELPER_OFF_KEY))[HELPER_OFF_KEY];
    expect(storedFlag).toBeUndefined();
    const storedSettings = (await sync.get(SETTINGS_KEY))[SETTINGS_KEY];
    expect(JSON.stringify(storedSettings)).toBe(JSON.stringify(corrupted));
    expect(sync.setCalls.length).toBe(0);
  });

  it('단위 E: 설정이 멀쩡(enabled:false)하고 local에 꺼짐 표시가 있을 때 setEnabled(true)는 sync enabled를 true로 쓰고 표시도 지운다', async () => {
    const base = defaultSettings();
    await sync.set({ [SETTINGS_KEY]: { ...base, data: { ...base.data, enabled: false } } });
    await local.set({ [HELPER_OFF_KEY]: { schemaVersion: 1, data: { at: 1 } } });

    const writer = createStorageWriter();
    const result = await writer.setEnabled(true);

    expect(result).toEqual({ ok: true });
    const storedSettings = (await sync.get(SETTINGS_KEY))[SETTINGS_KEY] as { data: { enabled: boolean } };
    expect(storedSettings.data.enabled).toBe(true);
    const storedFlag = (await local.get(HELPER_OFF_KEY))[HELPER_OFF_KEY];
    expect(storedFlag).toBeUndefined();
  });

  it('단위 F: 설정이 깨진 채 끄기 뒤 기다리지 않고 바로 켜기를 불러도(큐 순서) 둘 다 성공하고 최종 local엔 표시가 없다', async () => {
    const corrupted = { schemaVersion: 99, data: { corrupted: true } };
    await sync.set({ [SETTINGS_KEY]: corrupted });
    sync.setCalls.length = 0;

    const writer = createStorageWriter();
    const offPromise = writer.setEnabled(false);
    const onPromise = writer.setEnabled(true);

    expect(await offPromise).toEqual({ ok: true });
    expect(await onPromise).toEqual({ ok: true });

    const storedFlag = (await local.get(HELPER_OFF_KEY))[HELPER_OFF_KEY];
    expect(storedFlag).toBeUndefined();
    const storedSettings = (await sync.get(SETTINGS_KEY))[SETTINGS_KEY];
    expect(JSON.stringify(storedSettings)).toBe(JSON.stringify(corrupted));
    expect(sync.setCalls.length).toBe(0);
  });
});
