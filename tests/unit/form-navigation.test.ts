import { expect, it } from 'vitest';
import { formTargets, FormDrafts } from '../../src/core/form-navigation';
import { createDraft } from '../../src/core/text-draft';
import type { ScanTarget } from '../../src/core/switch-order';
const field = (id: string, label = id, extra = {}): ScanTarget => ({ target: { tabId: 1, frameId: 0, documentGeneration: 'doc', itemId: id }, label, kind: 'input', danger: false, editable: true, sensitive: false, identity: id, ...extra });
it('form snapshot includes only non-sensitive editable metadata in existing stable order', () => {
  const all = [field('first'), field('password', '일반', { sensitive: true }), field('pw', 'PW'), field('otp', '인증번호'), field('card', '보안카드'), field('select', '선택', { editable: false }), field('last')];
  const fields = formTargets(all); expect(fields.map((f) => f.target.itemId)).toEqual(['first', 'last']);
  const first = all[0]; if (first) first.target.itemId = 'changed'; expect(fields[0]?.target.itemId).toBe('first');
});
it('field drafts preserve text, backward selection, undo and partial Hangul without cross-field reuse', () => {
  const drafts = new FormDrafts(); const state = { draft: createDraft('가👍🏽나', { start: 1, end: 5, direction: 'backward' }), initial: 2, medial: 0, expectedValue: '가👍🏽나' };
  drafts.set(field('first'), state); state.draft.text = 'mutated';
  expect(drafts.get(field('last'))).toBeNull();
  expect(drafts.get(field('first'))).toMatchObject({ draft: { text: '가👍🏽나', cursor: 1, anchor: 2 }, initial: 2, medial: 0, expectedValue: '가👍🏽나' });
  const copy = drafts.get(field('first')); if (copy) copy.draft.text = 'changed';
  expect(drafts.get(field('first'))?.draft.text).toBe('가👍🏽나');
});
it('same item id in a new document or changed identity cannot reuse old field data', () => {
  const drafts = new FormDrafts(); drafts.set(field('first'), { draft: createDraft('이전 문장'), initial: null, medial: null, expectedValue: '' });
  expect(drafts.get(field('first', 'first', { identity: 'changed' }))).toBeNull();
  const newDocument = field('first'); newDocument.target.documentGeneration = 'new'; expect(drafts.get(newDocument)).toBeNull();
});

it('unavailable dirty drafts remain readable and require an unchanged revision and missing live identity to discard', () => {
  const drafts = new FormDrafts();
  const pending = { draft: createDraft('보존'), initial: 0, medial: null, expectedValue: '' };
  drafts.set(field('first'), pending); drafts.set(field('clean'), {...pending, initial:null, expectedValue:'보존'});
  expect(drafts.unavailable([field('first')])).toEqual([]);
  const saved = drafts.unavailable([field('first','새 이름',{identity:'new'})])[0];
  if(!saved)throw new Error('missing stored draft');
  expect(saved.draft).toEqual(pending);
  expect(drafts.discardUnavailable(saved, [field('first')])).toBe(false);
  drafts.set(field('first'), {...pending, medial:0});
  expect(drafts.discardUnavailable(saved, [])).toBe(false);
  const latest = drafts.unavailable([])[0];
  if(!latest)throw new Error('missing latest draft');
  expect(drafts.discardUnavailable(latest, [])).toBe(true);
  expect(drafts.discardUnavailable(latest, [])).toBe(false);
  expect(drafts.hasUnapplied()).toBe(false);
});
