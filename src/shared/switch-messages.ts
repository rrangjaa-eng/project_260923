import { z } from 'zod';
import { SwitchSettings } from '@/core/switch-settings';
import { PhraseMutation } from '@/core/switch-phrases';
const Target = z.object({ tabId: z.number().int(), frameId: z.number().int().nonnegative(), documentGeneration: z.string().max(100), itemId: z.string().max(100) }).strict();
const Authorization = z.object({ documentGeneration: z.string().max(100), modeGeneration: z.number().int().nonnegative(), pendingActionId: z.string().max(150) });
const Navigation = z.object({kind:z.enum(['tabs','back','forward','activate']),tabId:z.number().int().optional()}).strict();
export const TextSelection = z.object({ start: z.number().int().nonnegative().max(4000), end: z.number().int().nonnegative().max(4000), direction: z.enum(['forward', 'backward', 'none']) }).strict().refine((selection) => selection.end >= selection.start);
export type TextSelection = z.infer<typeof TextSelection>;
export const FormControl = z.discriminatedUnion('kind', [
  z.object({kind:z.literal('select'),selectedIndex:z.number().int().min(-1).max(99),signature:z.string().max(64000),options:z.array(z.object({label:z.string().max(300),disabled:z.boolean()}).strict()).min(1).max(100)}).strict(),
  z.object({kind:z.literal('radio'),checked:z.boolean(),signature:z.string().regex(/^[a-f0-9]{32}$/)}).strict(),
  z.object({kind:z.literal('checkbox'),checked:z.boolean(),signature:z.string().max(4000)}).strict(),
]);
export type FormControl = z.infer<typeof FormControl>;
export const SwitchTargetAction = z.object({
  actionId: z.string().max(150), target: Target,
  kind: z.enum(['capture', 'press', 'applyText', 'restoreText', 'search', 'captureControl', 'applyControl', 'readValidity']), text: z.string().max(4000).optional(), expectedValue: z.string().max(4000).optional(),
  selection: TextSelection.optional(), control: FormControl.optional(), controlIndex:z.number().int().min(0).max(99).optional(), controlChecked:z.boolean().optional(),
  expectedIdentity: z.string(), confirmed: z.boolean().optional(),
  authorization: Authorization,
}).strict();
export type SwitchTargetAction = z.infer<typeof SwitchTargetAction>;
export const SwitchReportItem = z.object({ itemId: z.string(), label: z.string().max(300), kind: z.string(), danger: z.boolean(), editable: z.boolean(), sensitive: z.boolean(), identity: z.string(), controlKind:z.enum(['select','checkbox','radio']).optional() });
export type SwitchReportItem = z.infer<typeof SwitchReportItem>;
export interface SwitchFrameReport { frameId: number; documentGeneration: string; path: number[]; items: SwitchReportItem[] }
export const SwitchMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('switch/connect'), tabId: z.number().int(), url: z.string().max(10000) }).strict(),
  z.object({ type: z.literal('switch/begin'), url: z.string().max(10000) }).strict(),
  z.object({ type: z.literal('switch/report'), documentGeneration: z.string().max(100), path: z.array(z.number().int().nonnegative()), items: z.array(SwitchReportItem).max(5000) }),
  z.object({ type: z.literal('switch/list') }),
  z.object({ type: z.literal('switch/refresh') }),
  z.object({ type: z.literal('switch/frame-check'), childIndex: z.number().int().nonnegative(), documentGeneration: z.string().max(100) }),
  z.object({ type: z.literal('switch/action-check'), authorization: Authorization, navigation: Navigation.optional() }),
  z.object({ type: z.literal('switch/execute'), action: SwitchTargetAction }),
  z.object({ type: z.literal('switch/key'), kind: z.enum(['keyDown', 'keyUp']), repeat: z.boolean(), isComposing: z.boolean(), modified: z.boolean() }),
  z.object({ type: z.literal('switch/pause'), invalidate: z.boolean().optional() }),
  z.object({ type: z.literal('switch/cancel-peers') }),
  Navigation.extend({type:z.literal('switch/navigation'),authorization:Authorization.strict()}).strict(),
  z.object({ type: z.literal('switch/settings'), value: SwitchSettings }),
  z.object({ type: z.literal('switch/draft'), text: z.string().max(4000) }),
  z.object({ type: z.literal('switch/draft/read') }),
  z.object({ type: z.literal('switch/phrase'), text: z.string().min(1).max(1000), authorization: Authorization.strict() }).strict(),
  z.object({ type: z.literal('switch/phrase/update'), mutation: PhraseMutation, authorization: Authorization.strict() }).strict(),
]);
export type SwitchMessage = z.infer<typeof SwitchMessage>;
