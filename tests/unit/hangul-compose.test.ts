import { expect, it } from 'vitest';
import { composeHangul } from '../../src/core/hangul-compose';
it('composes Hangul including doubled consonants, diphthongs and compound finals', () => {
  expect(composeHangul(11, 0, 4)).toBe('안');
  expect(composeHangul(2, 6, 21)).toBe('녕');
  expect(composeHangul(18, 0, 0) + composeHangul(9, 5, 0) + composeHangul(11, 12, 0)).toBe('하세요');
  expect(composeHangul(1, 9, 3)).toBe('꽋');
  expect(() => composeHangul(19, 0, 0)).toThrow();
});
