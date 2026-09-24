import { describe, expect, it } from 'vitest';
import { isUnsupportedUrl } from '../../src/core/unsupported-url';

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
