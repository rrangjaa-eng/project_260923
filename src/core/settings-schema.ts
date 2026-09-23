import { z } from 'zod';

// 저장하는 모든 데이터에는 형식 버전을 붙인다(D-25).
export const CURRENT_SCHEMA_VERSION = 1;

// 요소 식별 묶음 — 번호표 고정(pins), 자주 누른 기록(presses)이 함께 쓴다(D-11).
const FingerprintSchema = z.object({
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
