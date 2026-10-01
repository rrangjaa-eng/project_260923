export interface TextDraft { text: string; cursor: number; history: Array<{text: string; cursor: number}> }
export type DraftEdit = { type: 'insert'; text: string } | { type: 'left' } | { type: 'right' } | { type: 'delete' } | { type: 'undo' };
const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });
export function characters(text: string): string[] { return Array.from(segmenter.segment(text), (s) => s.segment); }
export function createDraft(text = ''): TextDraft { return { text, cursor: characters(text).length, history: [] }; }
export function editDraft(draft: TextDraft, edit: DraftEdit): TextDraft {
  const chars = characters(draft.text);
  if (edit.type === 'left') return { ...draft, cursor: Math.max(0, draft.cursor-1) };
  if (edit.type === 'right') return { ...draft, cursor: Math.min(chars.length, draft.cursor+1) };
  if (edit.type === 'undo') {
    const previous = draft.history.at(-1);
    return previous ? { ...previous, history: draft.history.slice(0,-1) } : draft;
  }
  if (edit.type === 'delete' && draft.cursor === 0) return draft;
  const history = [...draft.history.slice(-99), { text: draft.text, cursor: draft.cursor }];
  if (edit.type === 'delete') { chars.splice(draft.cursor-1,1); return { text: chars.join(''), cursor: draft.cursor-1, history }; }
  const inserted = characters(edit.text);
  chars.splice(draft.cursor,0,...inserted);
  return { text: chars.join(''), cursor: draft.cursor+inserted.length, history };
}
