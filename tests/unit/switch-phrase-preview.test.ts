import { expect, it } from 'vitest';
import { phrasePreviewPages } from '../../src/core/switch-phrases';
it('previews old and replacement text in bounded pages without splitting visible characters', () => {
  const pages = phrasePreviewPages('가'.repeat(25), '👨‍👩‍👧‍👦👍🏽새 문구');
  expect(pages).toEqual(['기존 문구 1/2\n' + '가'.repeat(24), '기존 문구 2/2\n가', '바꿀 문장 1/1\n👨‍👩‍👧‍👦👍🏽새 문구']);
});
it('line breaks and tabs are visible markers so a page cannot overflow with blank lines', () => {
  expect(phrasePreviewPages('가\n\n\t나')).toEqual(['기존 문구 1/1\n가↵↵⇥나']);
});
