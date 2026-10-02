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
export class FormDrafts {
  private drafts = new Map<string, FormDraft>();
  set(target: ScanTarget, draft: FormDraft) { this.drafts.set(fieldKey(target), structuredClone(draft)); }
  get(target: ScanTarget): FormDraft|null { const draft = this.drafts.get(fieldKey(target)); return draft ? structuredClone(draft) : null; }
}
