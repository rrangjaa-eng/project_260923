import type { Collector } from '@/page/collector/collector';
import type { SwitchTargetAction, TextSelection } from '@/shared/switch-messages';
import { applyDraft, captureTextTarget, typingElement } from './text-target';

interface AppliedText {
  element: HTMLInputElement | HTMLTextAreaElement;
  target: string;
  identity: string;
  token: string;
  before: string;
  after: string;
  selection?: TextSelection;
  observer: MutationObserver;
  ancestors: Set<Node>;
  invalid: boolean;
}
const records = new WeakMap<Collector, AppliedText>();
export function clearAppliedText(collector: Collector): void { records.get(collector)?.observer.disconnect(); records.delete(collector); }
function removed(record: AppliedText, mutations: MutationRecord[]): void {
  if (mutations.some(mutation => Array.from(mutation.removedNodes).some(node => record.ancestors.has(node)))) {
    record.invalid = true; record.observer.disconnect();
  }
}

export function applyWithUndo(collector: Collector, action: SwitchTargetAction) {
  clearAppliedText(collector);
  const element = collector.get(action.target.itemId);
  const before = captureTextTarget(collector, action.target.itemId);
  if (!typingElement(element) || !before || action.expectedValue !== before.value || typeof action.text !== 'string') return { result: 'refused' as const };
  const ancestors = new Set<Node>();
  for (let node: Node | null = element; node; node = node.parentNode) ancestors.add(node);
  const observer = new MutationObserver(mutations => { removed(record, mutations); });
  const record: AppliedText = { element, target: JSON.stringify(action.target), identity: action.expectedIdentity, token: action.actionId,
    before: before.value, after: action.text, ...(before.selection ? { selection: before.selection } : {}), observer, ancestors, invalid: false };
  observer.observe(element.ownerDocument, { childList: true, subtree: true });
  try {
    const result = applyDraft(collector, action.target.itemId, before.value, action.text, action.selection);
    removed(record, observer.takeRecords());
    if (result !== 'done' || record.invalid || before.value === action.text || collector.get(action.target.itemId) !== element) return { result };
    records.set(collector, record);
    return { result, undoToken: action.actionId };
  } finally { if (records.get(collector) !== record) observer.disconnect(); }
}

export function appliedTextUndo(collector: Collector, action: SwitchTargetAction) {
  const record = records.get(collector);
  if (record) removed(record, record.observer.takeRecords());
  const current = captureTextTarget(collector, action.target.itemId);
  if (!record || record.invalid || record.token !== action.undoToken || record.target !== JSON.stringify(action.target)
      || record.identity !== action.expectedIdentity || collector.get(action.target.itemId) !== record.element
      || !current || current.value !== record.after) {
    clearAppliedText(collector); return { result: 'refused' as const };
  }
  if (action.kind === 'previewUndo') return { result: 'done' as const, value: record.before, appliedValue: record.after };
  if (!action.confirmed) { clearAppliedText(collector); return { result: 'refused' as const }; }
  records.delete(collector);
  // Consume before dispatching site events: a repeated or ambiguous result is never replayed.
  try {
    const result = applyDraft(collector, action.target.itemId, record.after, record.before, record.selection);
    const unremoved = () => { removed(record, record.observer.takeRecords()); return !record.invalid; };
    return result === 'done' && unremoved() ? { result, value: record.before, ...(record.selection ? { selection: record.selection } : {}) } : { result: 'unknown' as const };
  } finally { record.observer.disconnect(); }
}
