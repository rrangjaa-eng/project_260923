import { z, type ZodType } from 'zod';

// 저장하는 모든 데이터에는 형식 버전을 붙인다(D-25).
export const CURRENT_SCHEMA_VERSION = 1;

// 단일 저장자 형식 변환(D-25, D-30, RESEARCH.md Pattern 4): 옛 버전 값을 차례로 변환해 지금
// 스키마로 맞춘다. 실패하면(모르는 형식·잘못된 값·변환 중 예외) 절대 아무것도 쓰지 않고 원본을
// 그대로 둔다 — 그래서 raw는 structuredClone 뒤에만 변환해 입력 객체를 건드리지 않는다.
export interface MigrateSpec<T> {
  schema: ZodType<T>;
  current: number;
  migrations: Record<number, (d: unknown) => unknown>;
}

export type MigrateResult<T> =
  | { ok: true; value: T; migrated: boolean }
  | { ok: false; reason: 'no-version' | 'newer-version' | 'invalid' | 'migrate-threw' };

export function migrate<T>(raw: unknown, spec: MigrateSpec<T>): MigrateResult<T> {
  if (typeof raw !== 'object' || raw === null || !('schemaVersion' in raw) || typeof raw.schemaVersion !== 'number') {
    return { ok: false, reason: 'no-version' };
  }

  let version = raw.schemaVersion;
  if (version > spec.current) {
    return { ok: false, reason: 'newer-version' };
  }

  let data: unknown = structuredClone(raw);
  let migrated = false;
  while (version < spec.current) {
    const migration = spec.migrations[version];
    if (!migration) {
      return { ok: false, reason: 'invalid' };
    }
    try {
      data = migration(data);
    } catch {
      return { ok: false, reason: 'migrate-threw' };
    }
    migrated = true;
    version += 1;
  }

  const parsed = spec.schema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, reason: 'invalid' };
  }

  return { ok: true, value: parsed.data, migrated };
}

// 동기화 항목 크기 한도(D-24): storage.sync 항목 하나는 8KB 미만이어야 한다.
export const SYNC_ITEM_LIMIT = 8192;

export function syncItemBytes(key: string, value: unknown): number {
  return new TextEncoder().encode(key + JSON.stringify(value)).length;
}

// 요소 식별 묶음 — 번호표 고정(pins), 자주 누른 기록(presses)이 함께 쓴다(D-11).
export const FingerprintSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  labelText: z.string().optional(),
  buttonText: z.string().optional(),
  aria: z.string().optional(),
  domPath: z.string(),
  framePath: z.array(z.string()),
});
export type Fingerprint = z.infer<typeof FingerprintSchema>;

export const SETTINGS_KEY = 'settings';

const SettingsDataSchema = z.object({
  enabled: z.boolean(),
  keymap: z.object({
    press: z.string(),
    confirm: z.string(),
    cancel: z.string(),
    toggleHints: z.string(),
  }),
  tremorIntervalMs: z.number(),
  sameSpotPx: z.number(),
  captureMarginPx: z.number(),
  switchHysteresisPx: z.number(),
  dwellEnabled: z.boolean(),
  dwellMs: z.number(),
  dragTwoPress: z.boolean(),
  dangerWords: z.array(z.string()),
});

export const SettingsV1 = z.object({
  schemaVersion: z.literal(1),
  data: SettingsDataSchema,
});
export type SettingsV1 = z.infer<typeof SettingsV1>;

// Phase 1은 v1이 첫 형식이라 migrations는 비어 있다(D-25) — 다음 형식이 생기면 여기에 더한다.
export const settingsSpec: MigrateSpec<SettingsV1> = { schema: SettingsV1, current: CURRENT_SCHEMA_VERSION, migrations: {} };

export function defaultSettings(): SettingsV1 {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    data: {
      enabled: true,
      keymap: {
        press: 'Space',
        confirm: 'Enter',
        cancel: 'Escape',
        toggleHints: 'KeyF',
      },
      tremorIntervalMs: 300,
      sameSpotPx: 16,
      captureMarginPx: 48,
      switchHysteresisPx: 24,
      dwellEnabled: false,
      dwellMs: 800,
      dragTwoPress: false,
      dangerWords: ['삭제', '취소', '반려', '로그아웃', '결재 취소'],
    },
  };
}

export function siteKey(origin: string): string {
  return `site:${origin}`;
}

const SiteEntryDataSchema = z.object({
  disabled: z.boolean(),
  pins: z.array(
    z.object({
      number: z.union([
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
        z.literal(6),
        z.literal(7),
        z.literal(8),
        z.literal(9),
      ]),
      fingerprint: FingerprintSchema,
    }),
  ),
});

export const SiteEntryV1 = z.object({
  schemaVersion: z.literal(1),
  data: SiteEntryDataSchema,
});
export type SiteEntryV1 = z.infer<typeof SiteEntryV1>;

export const siteSpec: MigrateSpec<SiteEntryV1> = { schema: SiteEntryV1, current: CURRENT_SCHEMA_VERSION, migrations: {} };

export function pressesKey(origin: string): string {
  return `presses:${origin}`;
}

const PressesDataSchema = z.object({
  counts: z.array(
    z.object({
      fingerprint: FingerprintSchema,
      count: z.number(),
    }),
  ),
});

export const PressesV1 = z.object({
  schemaVersion: z.literal(1),
  data: PressesDataSchema,
});
export type PressesV1 = z.infer<typeof PressesV1>;

export const pressesSpec: MigrateSpec<PressesV1> = { schema: PressesV1, current: CURRENT_SCHEMA_VERSION, migrations: {} };

// 형식 변환 실패 알림(D-25, storage.local): storage-writer.ts가 settings 읽기가 실패할 때마다
// 기록하고, content.ts·popup/main.ts가 읽기만 해서 토스트·경고 카드를 보여 준다.
export const MIGRATION_NOTICE_KEY = 'notice:migration-failed';

const MigrationNoticeDataSchema = z.object({
  key: z.string(),
  reason: z.string(),
  at: z.number(),
});

export const MigrationNoticeV1 = z.object({
  schemaVersion: z.literal(1),
  data: MigrationNoticeDataSchema,
});
export type MigrationNoticeV1 = z.infer<typeof MigrationNoticeV1>;

// 알림 문구(SYSTEM.md 카피 규칙 "원인. 다음 행동."): content.ts(토스트)·popup/main.ts(경고
// 카드)가 그대로 같이 쓴다 — 한 곳에 두어 두 화면의 문구가 어긋나지 않게 한다.
export const MIGRATION_FAILED_MESSAGE = '설정을 읽지 못해 기본 설정으로 동작해요. 원래 설정은 그대로 두었어요.';

// 전역 도우미 꺼짐 표시(D-25, storage.local 전용): 동기화된 settings가 깨졌거나 더 새 형식이라
// 원본 보호로 쓰기가 막혀도 '도우미 끄기'가 항상 되게 한다. storage-writer.ts만 쓰거나 지우고,
// content.ts·popup/main.ts는 읽기만 해서 enabled보다 우선 적용한다.
export const HELPER_OFF_KEY = 'override:helper-off';

const HelperOffDataSchema = z.object({
  at: z.number(),
});

export const HelperOffV1 = z.object({
  schemaVersion: z.literal(1),
  data: HelperOffDataSchema,
});
export type HelperOffV1 = z.infer<typeof HelperOffV1>;
