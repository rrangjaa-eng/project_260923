import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// deferred-items.md(Plan 01-02): vitest.config.ts가 없으면 `vitest run`이 저장소 전체를
// 스캔해 .claude/skills/**(bun:test 트리)까지 잡는다. 이 프로젝트의 단위 시험만 본다.
export default defineConfig({
  resolve: {
    // F3(/design-review 3회차): collector.test.ts가 처음으로 `@/` import를 쓰는 소스(collector.ts)를
    // 직접 불러온다 — wxt/tsconfig의 같은 별칭(`@` → `src`)을 vitest에도 그대로 맞춘다.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['.claude/**', 'node_modules/**', '.output/**', 'tests/e2e/**'],
  },
});
