import { expect, it } from 'vitest';
import { createDraft, editDraft } from '../../src/core/text-draft';
it('edits a visible character, whitespace and undo without losing the draft on pause', () => {
  let draft = editDraft(createDraft('안녕'), { type: 'left' });
  draft = editDraft(draft, { type: 'insert', text: ' ' });
  expect(draft.text).toBe('안 녕');
  draft = editDraft(draft, { type: 'delete' });
  expect(draft.text).toBe('안녕');
  expect(editDraft(draft, { type: 'undo' }).text).toBe('안 녕');
  expect(editDraft(createDraft('👍🏽가'), { type: 'left' }).cursor).toBe(1);
  expect(editDraft(editDraft(createDraft('👍🏽가'), { type: 'left' }), { type: 'delete' }).text).toBe('가');
});

it('replaces a captured grapheme selection and undo restores its range', () => {
  const selected = createDraft('가👍🏽나', { start: 1, end: 5, direction: 'backward' });
  const inserted = editDraft(selected, { type: 'insert', text: '라' });
  expect(inserted.text).toBe('가라나');
  expect(inserted.cursor).toBe(2);
  expect(editDraft(inserted, { type: 'undo' })).toEqual(selected);
  expect(editDraft(selected, { type: 'delete' }).text).toBe('가나');
  expect(editDraft(selected, { type: 'left' }).cursor).toBe(1);
  expect(editDraft(selected, { type: 'right' }).cursor).toBe(2);
});
