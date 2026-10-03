import type { ScanTarget } from './switch-order';
import type { TextDraft } from './text-draft';
import type { TextSelection } from '@/shared/switch-messages';
export interface FormDraft { draft: TextDraft; initial: number|null; medial: number|null; expectedValue: string; capturedSelection?: TextSelection|undefined }
export function sensitiveFieldLabel(label: string): boolean {
  return /비밀번호|주민|계좌|카드번호|보안카드|인증번호|password|ssn|\botp\b|\bpw\b/i.test(label);
}
export function formTargets(targets: ScanTarget[]): ScanTarget[] {
  return targets.filter((target) => (target.editable || target.controlKind) && !target.sensitive && !sensitiveFieldLabel(target.label)).map((target) => structuredClone(target));
}
const fieldKey = (target: ScanTarget) => JSON.stringify([target.target.tabId, target.target.frameId, target.target.documentGeneration, target.target.itemId, target.identity]);
export interface StoredFormDraft { key: string; revision: number; target: ScanTarget; draft: FormDraft }
const unapplied = (value: FormDraft) => value.initial !== null || value.medial !== null || value.draft.text !== value.expectedValue;
export class FormDrafts {
  private drafts = new Map<string, StoredFormDraft>();
  private revision = 0;
  set(target: ScanTarget, draft: FormDraft) {
    const key = fieldKey(target);
    this.drafts.set(key, structuredClone({key, revision: ++this.revision, target, draft}));
  }
  hasUnapplied() { return [...this.drafts.values()].some(value => unapplied(value.draft)); }
  get(target: ScanTarget): FormDraft|null { const entry = this.drafts.get(fieldKey(target)); return entry ? structuredClone(entry.draft) : null; }
  unavailable(fields: ScanTarget[]): StoredFormDraft[] {
    const available = new Set(fields.map(fieldKey));
    return [...this.drafts.values()].filter(entry => unapplied(entry.draft) && !available.has(entry.key)).map(entry => structuredClone(entry));
  }
  discardUnavailable(snapshot: StoredFormDraft, fields: ScanTarget[]): boolean {
    const entry = this.drafts.get(snapshot.key);
    if (!entry || entry.revision !== snapshot.revision || fields.some(field => fieldKey(field) === snapshot.key)) return false;
    return this.drafts.delete(snapshot.key);
  }
}
