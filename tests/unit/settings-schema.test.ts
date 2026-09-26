import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { migrate, syncItemBytes, SYNC_ITEM_LIMIT, settingsSpec, defaultSettings } from '../../src/core/settings-schema';

// D-25, D-30, RESEARCH.md Pattern 4: 저장 형식 변환 migrate()는 순수 함수 — 실패하면 원본을
// 절대 바꾸지 않고 이유만 돌려준다. syncItemBytes/SYNC_ITEM_LIMIT는 동기화 항목 8KB 한도(D-24).

describe('migrate', () => {
  it('올바른 v1 값은 { ok: true, value, migrated: false }다', () => {
    const value = defaultSettings();
    const result = migrate(value, settingsSpec);
    expect(result).toEqual({ ok: true, value, migrated: false });
  });

  it('schemaVersion이 없거나 숫자가 아니면 { ok: false, reason: "no-version" }다', () => {
    expect(migrate({ data: {} }, settingsSpec)).toEqual({ ok: false, reason: 'no-version' });
    expect(migrate({ schemaVersion: '1', data: {} }, settingsSpec)).toEqual({ ok: false, reason: 'no-version' });
    expect(migrate(undefined, settingsSpec)).toEqual({ ok: false, reason: 'no-version' });
  });

  it('지금보다 높은 버전은 { ok: false, reason: "newer-version" }다', () => {
    const value = defaultSettings();
    const result = migrate({ ...value, schemaVersion: 99 }, settingsSpec);
    expect(result).toEqual({ ok: false, reason: 'newer-version' });
  });

  it('v1인데 data가 스키마에 맞지 않으면 { ok: false, reason: "invalid" }다', () => {
    const value = defaultSettings();
    const broken = { ...value, data: { ...value.data, enabled: 'yes' } };
    const result = migrate(broken, settingsSpec);
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('주입한 변환 목록(v0→v1)이 있으면 차례로 적용해 { ok: true, migrated: true }다', () => {
    const schema = z.object({ schemaVersion: z.literal(1), data: z.object({ foo: z.string() }) });
    const spec = {
      schema,
      current: 1,
      migrations: {
        0: (d: unknown) => ({ schemaVersion: 1, data: { foo: (d as { data: { oldFoo: string } }).data.oldFoo } }),
      },
    };
    const raw = { schemaVersion: 0, data: { oldFoo: 'hello' } };
    const result = migrate(raw, spec);
    expect(result).toEqual({ ok: true, value: { schemaVersion: 1, data: { foo: 'hello' } }, migrated: true });
  });

  it('변환 함수가 예외를 던지면 { ok: false, reason: "migrate-threw" }이고 입력 객체는 바뀌지 않는다', () => {
    const schema = z.object({ schemaVersion: z.literal(1), data: z.object({ foo: z.string() }) });
    const spec = {
      schema,
      current: 1,
      migrations: {
        0: (): unknown => {
          throw new Error('boom');
        },
      },
    };
    const raw = { schemaVersion: 0, data: { oldFoo: 'hello' } };
    const rawCopy = structuredClone(raw);
    const result = migrate(raw, spec);
    expect(result).toEqual({ ok: false, reason: 'migrate-threw' });
    expect(raw).toEqual(rawCopy);
  });
});

describe('syncItemBytes / SYNC_ITEM_LIMIT', () => {
  it('SYNC_ITEM_LIMIT은 8192다', () => {
    expect(SYNC_ITEM_LIMIT).toBe(8192);
  });

  it('키 + JSON.stringify(value)의 UTF-8 바이트 수를 센다(한글 1자 3바이트)', () => {
    expect(syncItemBytes('a', 1)).toBe(new TextEncoder().encode('a1').length);
    // '가'는 UTF-8로 3바이트 — key(1) + `"가"`(문자열 리터럴 5바이트: 따옴표 2 + 3바이트 글자) = 6
    expect(syncItemBytes('k', '가')).toBe(1 + 2 + 3);
  });
});
