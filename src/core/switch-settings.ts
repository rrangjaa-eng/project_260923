import { z } from 'zod';
export const SWITCH_SETTINGS_KEY = 'switchSettings';
export const SwitchSettings = z.object({
  schemaVersion: z.literal(1), mode: z.enum(['pointer', 'switch']),
  intervalMs: z.number().int().min(800).max(4000), protectionMs: z.number().int().min(100).max(1000),
}).strict();
export type SwitchSettings = z.infer<typeof SwitchSettings>;
export function defaultSwitchSettings(): SwitchSettings {
  return { schemaVersion: 1, mode: 'pointer', intervalMs: 1500, protectionMs: 300 };
}
