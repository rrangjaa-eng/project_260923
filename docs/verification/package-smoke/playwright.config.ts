import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'package.spec.ts',
  workers: 1,
  outputDir: '/tmp/single-switch-package-smoke-results',
});
