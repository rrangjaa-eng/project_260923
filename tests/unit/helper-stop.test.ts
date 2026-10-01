import { afterEach, expect, it, vi } from 'vitest';
import { createStorageWriter } from '../../src/worker/storage-writer';
import { defaultSettings } from '../../src/core/settings-schema';
import { isHelperSafetyOff } from '../../src/core/helper-safety';

afterEach(() => vi.unstubAllGlobals());
it('missing initial safety key permits the original default; malformed saved values keep stop',()=>{
  expect(isHelperSafetyOff(undefined)).toBe(false);expect(isHelperSafetyOff(false)).toBe(false);
  for(const value of [true,null,'broken',{},0])expect(isHelperSafetyOff(value)).toBe(true);
});

function storage(get: () => Promise<Record<string, unknown>>) {
  const local: Record<string, unknown> = {};
  vi.stubGlobal('chrome', { storage: {
    sync: { get, set: vi.fn(() => Promise.resolve()) },
    local: { get: () => Promise.resolve(local), set: (value: Record<string, unknown>) => { Object.assign(local, value); return Promise.resolve(); }, remove: () => Promise.resolve() },
  } });
  return local;
}

it.each(['corrupt', 'read-failure'] as const)('stop does not depend on %s sync settings', async (kind) => {
  const local = storage(() => {
    if (kind === 'read-failure') return Promise.reject(new Error('read failed'));
    return Promise.resolve({ settings: { broken: true } });
  });
  expect(await createStorageWriter().setEnabled(false)).toEqual({ ok: true });
  expect(local.helperSafetyOff).toBe(true);
});

it('stop overtakes a blocked enable and the late enable cannot clear it', async () => {
  let complete!: (value: Record<string, unknown>) => void;
  const local = storage(() => new Promise((resolve) => { complete = resolve; }));
  const writer = createStorageWriter();
  const enabling = writer.setEnabled(true);
  await Promise.resolve();
  const stopping = writer.setEnabled(false);
  // Allow the independent safety write, without unblocking the settings read.
  await Promise.resolve(); await Promise.resolve();
  expect(local.helperSafetyOff).toBe(true);
  complete({ settings: defaultSettings() });
  expect(await stopping).toEqual({ ok: true });
  expect(await enabling).toMatchObject({ ok: false });
  expect(local.helperSafetyOff).toBe(true);
});

it('stop remains last when the enable local commit itself is delayed', async () => {
  const local = storage(() => Promise.resolve({settings:defaultSettings()}));
  let release!:()=>void;
  let started!:()=>void;
  const writing=new Promise<void>(resolve=>{started=resolve;});
  chrome.storage.local.set=(value)=>{
    if(value.helperSafetyOff===false){started();return new Promise(resolve=>{release=()=>{Object.assign(local,value);resolve();};});}
    Object.assign(local,value);return Promise.resolve();
  };
  const writer=createStorageWriter();const enabling=writer.setEnabled(true);
  await writing;
  const stopping=writer.setEnabled(false);
  await Promise.resolve();await Promise.resolve();
  release();await Promise.all([enabling,stopping]);
  expect(local.helperSafetyOff).toBe(true);
});
