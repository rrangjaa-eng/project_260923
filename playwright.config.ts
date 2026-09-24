import { defineConfig, devices } from '@playwright/test';

// D-29: CI는 크롬(Chromium)으로만 돈다. workers: 1 — 확장 persistent context를 하나씩만 띄운다.
// globalSetup(process.env.CI 분기)이 .output/chrome-mv3를 만든다 — CI=true면 프로덕션 빌드,
// 아니면 개발 모드 빌드(CLAUDE.md "이 파일이 CI에서만 프로덕션 빌드를 쓴다"를 지킨다).
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.e2e.ts',
  workers: 1,
  globalSetup: './tests/e2e/global-setup.ts',
  forbidOnly: !!process.env.CI,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
