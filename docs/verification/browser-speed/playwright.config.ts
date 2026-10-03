import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'benchmark.e2e.ts',workers:1,timeout:1800000,globalSetup:'../../../tests/e2e/global-setup.ts',reporter:'line',use:{viewport:{width:1280,height:800}},outputDir:'/tmp/browser-speed-artifacts'});
