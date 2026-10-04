import { expect, it } from 'vitest';
import { legacyGroups, legacyReadingItems } from '@/core/switch-menu-policy';

it('preserves legacy group command identity and order', () => {
  expect(legacyGroups().map(({id,label,action}) => [id,label,action?.kind])).toEqual([
    ['group:0','찾기','command'], ['group:1','페이지 항목','command'],
    ['group:2','읽기·이동','command'], ['group:3','글쓰기','command'], ['group:4','조절·쉬기','command'],
  ]);
});
it('preserves all legacy reading commands without adding utility items', () => {
  expect(legacyReadingItems().map(({id,label,action}) => [id,label,action?.kind])).toEqual([
    ['scroll:down','한 화면 아래','command'], ['scroll:up','한 화면 위','command'],
    ['scroll:auto','자동 스크롤','command'], ['scroll-regions','세로 스크롤 영역 선택','command'],
    ['nav:back','뒤로','command'], ['nav:forward','앞으로','command'], ['nav:tabs','열린 탭','command'],
    ['nav:new','새 탭','command'], ['nav:reload','새로고침','command'], ['nav:close-preview','탭 닫기','command'],
    ['pins-list','고정 번호','command'], ['pins-settings','번호 고정 설정','command'], ['double-open','더블클릭 · 제한','command'],
  ]);
});
it.each([legacyGroups, legacyReadingItems])('does not share mutable command objects between menus', build => {
  const first=build(); const second=build();
  expect(first).toEqual(second); expect(first[0]).not.toBe(second[0]);
  expect(first[0]?.action).not.toBe(second[0]?.action);
});
