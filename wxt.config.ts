import { defineConfig } from 'wxt';

// 손 떨림 브라우저 도우미 (이름 미정) — MV3 확장 뼈대
// 권한은 storage·scripting·tabs, host <all_urls>만. debugger·contentSettings·webNavigation은 넣지 않는다(D-13).
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: '손 떨림 도우미 (가칭)',
    permissions: ['storage', 'scripting', 'tabs'],
    host_permissions: ['<all_urls>'],
    // 오버레이·메뉴 서체(D-26, RESEARCH Pattern 5): IBM Plex Sans KR(public/fonts/, 400·700 ×
    // 한글·라틴 유니코드 범위)를 웹 페이지에서 FontFace로 불러올 수 있게 연다.
    web_accessible_resources: [{ resources: ['fonts/*.woff2'], matches: ['<all_urls>'] }],
  },
});
