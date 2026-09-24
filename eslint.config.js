// @ts-check
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    // .claude/는 이 저장소의 GSD/gstack 도구 트리(별도 tsconfig, 우리 확장 프로젝트가 아님) — 린트 대상 아님.
    // eslint.config.js 자신은 타입 인식 프로젝트(tsconfig) 밖이라 strictTypeChecked를 적용하지 않는다.
    ignores: [
      '.output/**',
      '.wxt/**',
      'node_modules/**',
      '.claude/**',
      'test-results/**',
      'playwright-report/**',
      'eslint.config.js',
    ],
  },
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
]);
