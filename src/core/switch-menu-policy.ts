import type { SwitchItem } from './switch-engine';

const command=(id:string,label:string):SwitchItem=>({id,label,action:{kind:'command'}});

export function legacyGroups(): SwitchItem[] {
  return ['찾기','페이지 항목','읽기·이동','글쓰기','조절·쉬기'].map((label,i)=>command(`group:${String(i)}`,label));
}

export function legacyReadingItems(): SwitchItem[] {
  return [command('scroll:down','한 화면 아래'),command('scroll:up','한 화면 위'),command('scroll:auto','자동 스크롤'),command('scroll-regions','세로 스크롤 영역 선택'),command('nav:back','뒤로'),command('nav:forward','앞으로'),command('nav:tabs','열린 탭'),command('nav:new','새 탭'),command('nav:reload','새로고침'),command('nav:close-preview','탭 닫기'),command('pins-list','고정 번호'),command('pins-settings','번호 고정 설정'),command('double-open','더블클릭 · 제한')];
}
