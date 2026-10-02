import { expect, it } from 'vitest';
import { SwitchSettings, defaultSwitchSettings } from '../../src/core/switch-settings';
it('defaults preserve mouse mode and validates scan and protection ranges', () => {
  expect(defaultSwitchSettings()).toEqual({ schemaVersion: 1, mode: 'pointer', intervalMs: 1500, protectionMs: 300 });
  expect(SwitchSettings.safeParse({ ...defaultSwitchSettings(), intervalMs: 799 }).success).toBe(false);
  expect(SwitchSettings.safeParse({ ...defaultSwitchSettings(), protectionMs: 1001 }).success).toBe(false);
  expect(SwitchSettings.safeParse({ ...defaultSwitchSettings(), mode: 'switch', intervalMs: 4000 }).success).toBe(true);
});
