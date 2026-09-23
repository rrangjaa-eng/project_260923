import { z } from 'zod';

// 확장 내부 메시지 통로(D-09): 팝업·content script → service worker. sender.id 확인·zod 검사를
// 통과하지 못한 메시지는 background.ts가 무시한다(window.postMessage는 받지 않는다).

const SetEnabledOp = z.object({
  kind: z.literal('setEnabled'),
  enabled: z.boolean(),
});

const StorageRequestMessage = z.object({
  type: z.literal('storage/request'),
  op: SetEnabledOp,
});

const FrameStateMessage = z.object({
  type: z.literal('frame/state'),
  enabled: z.boolean(),
});

export const Message = z.discriminatedUnion('type', [StorageRequestMessage, FrameStateMessage]);
export type Message = z.infer<typeof Message>;

export function parseMessage(raw: unknown): z.ZodSafeParseResult<Message> {
  return Message.safeParse(raw);
}
