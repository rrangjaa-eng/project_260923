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
    // 한글·라틴 유니코드 범위)를 웹 페이지에서 FontFace로 불러올 수 있게 연다. WR-09:
    // use_dynamic_url 없이는 어떤 사이트든 chrome-extension://<고정 ID>/fonts/...를 그대로
    // fetch해 이 확장(손 떨림 도움, 건강 상태를 드러낸다)이 설치돼 있는지 알아낼 수 있다 —
    // 도우미가 꺼져 있어도, 오버레이가 하나도 없어도 마찬가지다. use_dynamic_url: true로 URL을
    // 세션마다 무작위로 바꾼다(chrome.runtime.getURL이 자동으로 그 형태를 돌려준다, 호출부
    // 코드 변경 없음).
    web_accessible_resources: [{ resources: ['fonts/*.woff2'], matches: ['<all_urls>'], use_dynamic_url: true }],
  },
});
