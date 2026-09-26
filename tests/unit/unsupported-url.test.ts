import { describe, expect, it } from 'vitest';
import { inheritedSiteOrigin, isUnsupportedUrl } from '../../src/core/unsupported-url';

// D-21, RESEARCH.md "Open Questions (RESOLVED)" 6번: 확장이 동작하지 않는 페이지를 주소만으로
// 판정하는 순수 함수. content script 응답 없음 판정은 Task 3(background.ts)에서 더한다.

describe('isUnsupportedUrl', () => {
  it('chrome:·edge:·whale:·chrome-extension:·about:·view-source:·devtools:·chrome-search:·data:는 true다', () => {
    expect(isUnsupportedUrl('chrome://version')).toBe(true);
    expect(isUnsupportedUrl('edge://settings')).toBe(true);
    expect(isUnsupportedUrl('whale://settings')).toBe(true);
    expect(isUnsupportedUrl('chrome-extension://abcdefg/popup.html')).toBe(true);
    expect(isUnsupportedUrl('about:blank')).toBe(true);
    expect(isUnsupportedUrl('view-source:http://practice.test/')).toBe(true);
    expect(isUnsupportedUrl('devtools://devtools/bundled/x')).toBe(true);
    expect(isUnsupportedUrl('chrome-search://local-ntp/x')).toBe(true);
    expect(isUnsupportedUrl('data:text/plain,hi')).toBe(true);
  });

  it('크롬 웹스토어·엣지 추가 기능·웨일 스토어 주소는 true다', () => {
    expect(isUnsupportedUrl('https://chromewebstore.google.com/detail/x')).toBe(true);
    expect(isUnsupportedUrl('https://chrome.google.com/webstore/detail/x')).toBe(true);
    expect(isUnsupportedUrl('https://microsoftedge.microsoft.com/addons/detail/x')).toBe(true);
    expect(isUnsupportedUrl('https://store.whale.naver.com/detail/x')).toBe(true);
  });

  it('보통의 http·https 주소는 false다', () => {
    expect(isUnsupportedUrl('http://practice.test/')).toBe(false);
    expect(isUnsupportedUrl('https://example.com/a')).toBe(false);
  });

  it('file:// 주소는 true다(파일 주소 권한을 요청하지 않음)', () => {
    expect(isUnsupportedUrl('file:///etc/passwd')).toBe(true);
  });

  it('빈 문자열·잘못된 주소·undefined는 true다(판정할 수 없으면 도울 수 없음)', () => {
    expect(isUnsupportedUrl('')).toBe(true);
    expect(isUnsupportedUrl('not a url')).toBe(true);
    expect(isUnsupportedUrl(undefined)).toBe(true);
  });

  it('스토어가 아닌 같은 호스트 경로는 false다', () => {
    expect(isUnsupportedUrl('https://chrome.google.com/search')).toBe(false);
  });

  it('대소문자가 섞인 스킴도 true다', () => {
    expect(isUnsupportedUrl('CHROME://settings')).toBe(true);
  });
});

// 01-19 Task 1(ELEM-02, SAFE-04, SAFE-05): 주소 없는 새 창(about: 문서)이 물려받은 http(s) 출처만
// 사이트로 인정하는 순수 함수. 불투명 출처·about: 아닌 주소·스토어 출처는 null이다.
describe('inheritedSiteOrigin', () => {
  it('about:blank 문서가 http(s) 출처를 물려받았으면 그 출처를 돌려준다', () => {
    expect(inheritedSiteOrigin('about:blank', 'http://practice.test')).toBe('http://practice.test');
  });

  it('about:srcdoc 문서도 물려받은 https 출처를 돌려준다', () => {
    expect(inheritedSiteOrigin('about:srcdoc', 'https://x.test')).toBe('https://x.test');
  });

  it('물려받은 출처가 불투명("null" 문자열)이면 null이다', () => {
    expect(inheritedSiteOrigin('about:blank', 'null')).toBe(null);
  });

  it('물려받은 출처가 없으면(undefined) null이다', () => {
    expect(inheritedSiteOrigin('about:blank', undefined)).toBe(null);
  });

  it('물려받은 출처가 확장 스토어면 null이다(스토어는 물려받아도 도울 수 없음)', () => {
    expect(inheritedSiteOrigin('about:blank', 'https://chromewebstore.google.com')).toBe(null);
  });

  it('about: 문서가 아니면(chrome: 등) null이다', () => {
    expect(inheritedSiteOrigin('chrome://version', 'http://practice.test')).toBe(null);
  });

  it('맨 위 주소가 이미 http(s)면(about: 문서에만 쓰는 함수) null이다', () => {
    expect(inheritedSiteOrigin('http://practice.test/a', 'http://other.test')).toBe(null);
  });
});
