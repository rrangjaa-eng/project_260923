// "도울 수 없음" 주소 판정(D-21, RESEARCH.md "Open Questions (RESOLVED)" 6번). 순수 함수 —
// document·window·chrome을 참조하지 않는다.

interface StoreRule {
  host: string;
  pathPrefix?: string;
}

// 확장이 동작하지 않는 확장 스토어 주소.
const STORE_RULES: StoreRule[] = [
  { host: 'chromewebstore.google.com' },
  { host: 'chrome.google.com', pathPrefix: '/webstore' },
  { host: 'microsoftedge.microsoft.com', pathPrefix: '/addons' },
  { host: 'store.whale.naver.com' },
];

export function isUnsupportedUrl(url: string | undefined): boolean {
  if (!url) {
    return true;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // 판정할 수 없으면 도울 수 없음으로 본다.
    return true;
  }

  // http:·https: 이외의 모든 스킴(chrome:·edge:·whale:·chrome-extension:·about:·view-source:·
  // devtools:·chrome-search:·data:·file: 등)은 도울 수 없음이다. WHATWG URL이 스킴을 항상
  // 소문자로 정규화해 대소문자가 섞인 스킴(CHROME://)도 여기서 걸린다.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return true;
  }

  return STORE_RULES.some((rule) => parsed.host === rule.host && (!rule.pathPrefix || parsed.pathname.startsWith(rule.pathPrefix)));
}
