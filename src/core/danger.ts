// 위험한 버튼 판별(D-18): 이름에 위험 단어(settings.dangerWords)가 들어 있으면 위험. 공백은
// 무시(이름·단어 모두 지운 뒤 포함 여부). 순수 함수 — document·window·chrome 참조 없음. 목록
// 자체(기본값·사이트별 편집)는 settings-schema.ts·SAFE-06(Phase 3)에서 온다.

function stripSpaces(text: string): string {
  return text.replace(/\s+/g, '');
}

export function isDanger(name: string, words: readonly string[]): boolean {
  const strippedName = stripSpaces(name);
  if (!strippedName || words.length === 0) {
    return false;
  }
  return words.some((word) => {
    const strippedWord = stripSpaces(word);
    return strippedWord.length > 0 && strippedName.includes(strippedWord);
  });
}
