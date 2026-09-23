import { defineConfig } from 'wxt';

// 손 떨림 브라우저 도우미 (이름 미정) — MV3 확장 뼈대
// 권한은 storage·scripting·tabs, host <all_urls>만. debugger·contentSettings·webNavigation은 넣지 않는다(D-13).
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: '손 떨림 도우미 (가칭)',
    permissions: ['storage', 'scripting', 'tabs'],
    host_permissions: ['<all_urls>'],
  },
});
