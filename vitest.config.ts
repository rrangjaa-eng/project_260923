import { defineConfig } from 'vitest/config';

// deferred-items.md(Plan 01-02): vitest.config.ts가 없으면 `vitest run`이 저장소 전체를
// 스캔해 .claude/skills/**(bun:test 트리)까지 잡는다. 이 프로젝트의 단위 시험만 본다.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['.claude/**', 'node_modules/**', '.output/**', 'tests/e2e/**'],
  },
});
