import { z } from 'zod';
import { SwitchSettings } from '@/core/switch-settings';
import { PhraseMutation } from '@/core/switch-phrases';
const Target = z.object({ tabId: z.number().int(), frameId: z.number().int().nonnegative(), documentGeneration: z.string().max(100), itemId: z.string().max(100) }).strict();
const Authorization = z.object({ documentGeneration: z.string().max(100), modeGeneration: z.number().int().nonnegative(), pendingActionId: z.string().max(150) });
export const TextSelection = z.object({ start: z.number().int().nonnegative().max(4000), end: z.number().int().nonnegative().max(4000), direction: z.enum(['forward', 'backward', 'none']) }).strict().refine((selection) => selection.end >= selection.start);
export type TextSelection = z.infer<typeof TextSelection>;
export const SwitchTargetAction = z.object({
  actionId: z.string().max(150), target: Target,
  kind: z.enum(['capture', 'press', 'applyText', 'restoreText', 'search']), text: z.string().max(4000).optional(), expectedValue: z.string().max(4000).optional(),
  selection: TextSelection.optional(),
  expectedIdentity: z.string(), confirmed: z.boolean().optional(),
  authorization: Authorization,
}).strict();
export type SwitchTargetAction = z.infer<typeof SwitchTargetAction>;
export const SwitchReportItem = z.object({ itemId: z.string(), label: z.string().max(300), kind: z.string(), danger: z.boolean(), editable: z.boolean(), sensitive: z.boolean(), identity: z.string() });
export type SwitchReportItem = z.infer<typeof SwitchReportItem>;
export interface SwitchFrameReport { frameId: number; documentGeneration: string; path: number[]; items: SwitchReportItem[] }
export const SwitchMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('switch/connect'), tabId: z.number().int(), url: z.string().max(10000) }).strict(),
  z.object({ type: z.literal('switch/begin'), url: z.string().max(10000) }).strict(),
  z.object({ type: z.literal('switch/report'), documentGeneration: z.string().max(100), path: z.array(z.number().int().nonnegative()), items: z.array(SwitchReportItem).max(5000) }),
  z.object({ type: z.literal('switch/list') }),
  z.object({ type: z.literal('switch/refresh') }),
  z.object({ type: z.literal('switch/frame-check'), childIndex: z.number().int().nonnegative(), documentGeneration: z.string().max(100) }),
  z.object({ type: z.literal('switch/action-check'), authorization: Authorization }),
  z.object({ type: z.literal('switch/execute'), action: SwitchTargetAction }),
  z.object({ type: z.literal('switch/key'), kind: z.enum(['keyDown', 'keyUp']), repeat: z.boolean(), isComposing: z.boolean(), modified: z.boolean() }),
  z.object({ type: z.literal('switch/pause'), invalidate: z.boolean().optional() }),
  z.object({ type: z.literal('switch/cancel-peers') }),
  z.object({ type: z.literal('switch/navigation'), kind: z.enum(['tabs', 'back', 'activate']), tabId: z.number().int().optional() }),
  z.object({ type: z.literal('switch/settings'), value: SwitchSettings }),
  z.object({ type: z.literal('switch/draft'), text: z.string().max(4000) }),
  z.object({ type: z.literal('switch/draft/read') }),
  z.object({ type: z.literal('switch/phrase'), text: z.string().min(1).max(1000), authorization: Authorization.strict() }).strict(),
  z.object({ type: z.literal('switch/phrase/update'), mutation: PhraseMutation, authorization: Authorization.strict() }).strict(),
]);
export type SwitchMessage = z.infer<typeof SwitchMessage>;
