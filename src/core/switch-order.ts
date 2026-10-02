import type { SwitchFrameReport } from '@/shared/switch-messages';
import type { SwitchTarget } from './switch-engine';
export interface ScanTarget { target: SwitchTarget; label: string; kind: string; danger: boolean; editable: boolean; sensitive: boolean; identity: string; controlKind?:'select'|'checkbox'|'radio'|undefined }
export function snapshotTargets(tabId: number, frames: SwitchFrameReport[]): ScanTarget[] {
  return frames.slice().sort((a,b) => {
    for (let i=0; i<Math.max(a.path.length,b.path.length); i++) {
      if (a.path[i] === undefined) return -1;
      if (b.path[i] === undefined) return 1;
      if (a.path[i] !== b.path[i]) return (a.path[i] ?? 0) - (b.path[i] ?? 0);
    }
    return a.frameId-b.frameId;
  }).flatMap((frame) => frame.items.map((item) => ({ ...item, target: { tabId, frameId: frame.frameId, documentGeneration: frame.documentGeneration, itemId: item.itemId } })));
}
