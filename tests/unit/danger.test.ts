import { describe, expect, it } from 'vitest';
import { isDanger } from '../../src/core/danger';
import { defaultSettings } from '../../src/core/settings-schema';

// D-18: 위험한 버튼 판별 — settings.dangerWords 목록에 이름이 포함되는지, 공백은 무시. 순수 함수.

describe('isDanger', () => {
  it('기본 목록에 있는 위험 단어가 든 이름은 true다', () => {
    const words = defaultSettings().data.dangerWords;
    for (const name of ['삭제', '선택 삭제', '취소', '반려', '로그아웃', '결재 취소']) {
      expect(isDanger(name, words)).toBe(true);
    }
  });

  it('공백을 무시하고 판별한다', () => {
    const words = defaultSettings().data.dangerWords;
    expect(isDanger('결재취소', words)).toBe(true);
    expect(isDanger(' 삭 제 ', words)).toBe(true);
  });

  it('위험 단어가 들지 않은 이름은 false다', () => {
    const words = defaultSettings().data.dangerWords;
    for (const name of ['상신', '결재', '임시저장', '저장']) {
      expect(isDanger(name, words)).toBe(false);
    }
  });

  it('빈 이름이나 빈 목록은 false다', () => {
    const words = defaultSettings().data.dangerWords;
    expect(isDanger('', words)).toBe(false);
    expect(isDanger('삭제', [])).toBe(false);
  });

  it('목록을 바꾸면 그 목록만 따른다', () => {
    expect(isDanger('보류', ['보류'])).toBe(true);
    expect(isDanger('삭제', ['보류'])).toBe(false);
  });

  it('기본 목록은 정확히 다섯 단어다', () => {
    expect(defaultSettings().data.dangerWords).toEqual(['삭제', '취소', '반려', '로그아웃', '결재 취소']);
  });
});
