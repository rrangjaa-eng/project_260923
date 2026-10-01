import { z } from 'zod';
import { SwitchSettings } from '@/core/switch-settings';
const Target = z.object({ tabId: z.number().int(), frameId: z.number().int().nonnegative(), documentGeneration: z.string().max(100), itemId: z.string().max(100) }).strict();
export const SwitchTargetAction = z.object({
  actionId: z.string().max(150), target: Target,
  kind: z.enum(['capture', 'press', 'applyText', 'search']), text: z.string().max(4000).optional(), expectedValue: z.string().max(4000).optional(),
}).strict();
export type SwitchTargetAction = z.infer<typeof SwitchTargetAction>;
export const SwitchReportItem = z.object({ itemId: z.string(), label: z.string().max(300), kind: z.string(), danger: z.boolean(), editable: z.boolean(), sensitive: z.boolean() });
export type SwitchReportItem = z.infer<typeof SwitchReportItem>;
export interface SwitchFrameReport { frameId: number; documentGeneration: string; path: number[]; items: SwitchReportItem[] }
export const SwitchMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('switch/report'), documentGeneration: z.string().max(100), path: z.array(z.number().int().nonnegative()), items: z.array(SwitchReportItem).max(5000) }),
  z.object({ type: z.literal('switch/list') }),
  z.object({ type: z.literal('switch/execute'), action: SwitchTargetAction }),
  z.object({ type: z.literal('switch/key'), kind: z.enum(['keyDown', 'keyUp']), repeat: z.boolean(), isComposing: z.boolean(), modified: z.boolean() }),
  z.object({ type: z.literal('switch/pause') }),
  z.object({ type: z.literal('switch/navigation'), kind: z.enum(['tabs', 'back', 'activate']), tabId: z.number().int().optional() }),
  z.object({ type: z.literal('switch/settings'), value: SwitchSettings }),
  z.object({ type: z.literal('switch/draft'), text: z.string().max(4000) }),
  z.object({ type: z.literal('switch/draft/read') }),
  z.object({ type: z.literal('switch/phrase'), text: z.string().min(1).max(1000) }),
]);
export type SwitchMessage = z.infer<typeof SwitchMessage>;
