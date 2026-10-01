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
