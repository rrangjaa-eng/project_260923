import { execFileSync } from 'node:child_process';

// CLAUDE.md: "playwright.config.ts가 CI에서만 프로덕션 빌드를 쓴다" — 로컬 dev 통과는 완료 신호가 아니다.
// 워커 프로세스마다 playwright.config.ts를 다시 읽어 들이므로, 빌드는 (설정 로드 때가 아니라)
// Playwright의 전역 setup 하나에서 정확히 한 번만 실행한다.
export default function globalSetup(): void {
  const args = process.env.CI === 'true' ? ['build'] : ['build', '--mode', 'development'];
  execFileSync('pnpm', args, { stdio: 'inherit' });
}
