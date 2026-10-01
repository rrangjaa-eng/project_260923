import type { TextSelection } from '@/shared/switch-messages';
interface DraftPosition { text: string; cursor: number; anchor: number }
export interface TextDraft extends DraftPosition { history: DraftPosition[] }
export type DraftEdit = { type: 'insert'; text: string } | { type: 'left' } | { type: 'right' } | { type: 'delete' } | { type: 'undo' };
const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });
export function characters(text: string): string[] { return Array.from(segmenter.segment(text), (s) => s.segment); }
export function createDraft(text = '', selection?: TextSelection): TextDraft {
  const chars = characters(text);
  const offset = (position: number) => { let end = 0; return chars.filter((char) => { end += char.length; return end <= position; }).length; };
  const start = selection ? offset(selection.start) : chars.length;
  const end = selection ? offset(selection.end) : start;
  return { text, cursor: selection?.direction === 'backward' ? start : end, anchor: selection?.direction === 'backward' ? end : start, history: [] };
}
export function draftSelection(draft: TextDraft): TextSelection {
  const chars = characters(draft.text);
  const offset = (index: number) => chars.slice(0, index).join('').length;
  return { start: offset(Math.min(draft.cursor, draft.anchor)), end: offset(Math.max(draft.cursor, draft.anchor)), direction: draft.cursor < draft.anchor ? 'backward' : draft.cursor > draft.anchor ? 'forward' : 'none' };
}
export function editDraft(draft: TextDraft, edit: DraftEdit): TextDraft {
  const chars = characters(draft.text);
  const start = Math.min(draft.cursor, draft.anchor), end = Math.max(draft.cursor, draft.anchor);
  if (edit.type === 'left' || edit.type === 'right') {
    const cursor = edit.type === 'left' ? (start < end ? start : Math.max(0, start - 1)) : (start < end ? end : Math.min(chars.length, end + 1));
    return { ...draft, cursor, anchor: cursor };
  }
  if (edit.type === 'undo') {
    const previous = draft.history.at(-1);
    return previous ? { ...previous, history: draft.history.slice(0,-1) } : draft;
  }
  if (edit.type === 'delete' && end === 0) return draft;
  const history = [...draft.history.slice(-99), { text: draft.text, cursor: draft.cursor, anchor: draft.anchor }];
  if (edit.type === 'delete') {
    const cursor = start < end ? start : start - 1;
    chars.splice(cursor, start < end ? end - start : 1);
    return { text: chars.join(''), cursor, anchor: cursor, history };
  }
  const inserted = characters(edit.text);
  chars.splice(start, end - start, ...inserted);
  const cursor = start + inserted.length;
  return { text: chars.join(''), cursor, anchor: cursor, history };
}
