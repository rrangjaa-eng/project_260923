import { z } from 'zod';
import { FingerprintSchema } from '@/core/settings-schema';

// 확장 내부 메시지 통로(D-09): 팝업·content script → service worker. sender.id 확인·zod 검사를
// 통과하지 못한 메시지는 background.ts가 무시한다(window.postMessage는 받지 않는다).

const SetEnabledOp = z.object({
  kind: z.literal('setEnabled'),
  enabled: z.boolean(),
});

// 자주 누른 기록(D-11, D-23): 요소를 누를 때마다 보낸다. origin은 보내는 프레임의 origin —
// storage-writer.ts가 sender.url의 origin과 같은지 확인한 뒤에만 기록한다(T-01-16).
const RecordPressOp = z.object({
  kind: z.literal('recordPress'),
  origin: z.string(),
  fingerprint: FingerprintSchema,
});

const StorageRequestOp = z.discriminatedUnion('kind', [SetEnabledOp, RecordPressOp]);

const StorageRequestMessage = z.object({
  type: z.literal('storage/request'),
  op: StorageRequestOp,
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
