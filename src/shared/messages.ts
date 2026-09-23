import { z } from 'zod';
import { FingerprintSchema } from '@/core/settings-schema';

// 확장 내부 메시지 통로(D-09): 팝업·content script → service worker. sender.id 확인·zod 검사를
// 통과하지 못한 메시지는 background.ts가 무시한다(window.postMessage는 받지 않는다).

const RectSchema = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
const PointSchema = z.object({ x: z.number(), y: z.number() });

// 프레임 보고(D-03, RESEARCH A2 정정): Chrome에는 chrome.runtime.getFrameId가 없어(Firefox
// 전용이었다) 부모는 자식의 실제 frameId를 알 수 없다. 대신 각 프레임이 스스로 계산한 창 위치
// 경로(selfPath, src/core/frame-path.ts)를 신고하고, 부모는 자식을 상대 순번(index)으로만
// 가리킨다 — relay.ts가 모든 보고의 (selfPath, sender.frameId) 쌍을 모아 resolveReports로
// 실제 frameId를 맞춘다. frameId 필드는 자기 신고값 — relay.ts가 sender.frameId로 덮어써
// 신뢰한다(스푸핑 방지).
const FrameReportSchema = z.object({
  frameId: z.number(),
  selfPath: z.array(z.number()),
  items: z.array(
    z.object({
      id: z.string(),
      rect: RectSchema,
      fingerprint: FingerprintSchema,
      danger: z.boolean().optional(),
    }),
  ),
  children: z.array(
    z.object({
      index: z.number(),
      offset: PointSchema,
      clip: RectSchema,
      pathKey: z.string(),
    }),
  ),
});

export type FrameReportWire = z.infer<typeof FrameReportSchema>;

const FrameReportMessage = z.object({
  type: z.literal('frame/report'),
  report: FrameReportSchema,
});

// SW → 맨 위(frameId 0)로만 보낸다: 탭의 모든 프레임 보고 모음.
const FramesReportsMessage = z.object({
  type: z.literal('frames/reports'),
  reports: z.array(z.object({ frameId: z.number(), report: FrameReportSchema })),
});

// 맨 위 → SW(T-01-19): sender.frameId === 0일 때만 relay가 받는다. framePath는 맨 위가
// composeTree로 합성한 값 — 대상 프레임이 recordPress에 그대로 쓴다.
const HintsPressMessage = z.object({
  type: z.literal('hints/press'),
  frameId: z.number(),
  itemId: z.string(),
  framePath: z.array(z.string()),
});

// SW → 해당 프레임({ frameId } 옵션으로 라우팅)으로만 보낸다.
const PressRequestMessage = z.object({
  type: z.literal('press/request'),
  itemId: z.string(),
  framePath: z.array(z.string()),
});

// 맨 위 → SW → 탭의 모든 프레임(방송). 자식 프레임이 번호표가 떠 있는지 알아야 숫자·0·Esc를
// 삼킬지 판단한다(Plan 이어짐: Task 3).
const HintsStateMessage = z.object({
  type: z.literal('hints/state'),
  visible: z.boolean(),
});

// SW → 탭의 모든 프레임(방송, T-01-21 이어짐): 어떤 프레임의 자식 iframe 구성(순번·개수)이
// 바뀌면 다른 프레임들의 selfPath(부모의 자식 목록에서 몇 번째인지)가 조용히 낡을 수 있다 —
// 형이 지워지면 동생 순번이 당겨진다(relay.ts 주석 참고). 형제 프레임은 이 신호를 받으면 자기
// 경로를 즉시 다시 계산해 새로 보고한다.
const FrameRefreshMessage = z.object({
  type: z.literal('frame/refresh'),
});

// 자식 프레임 → SW → 맨 위(Task 3, D-03, D-09): 초점이 자식 프레임 안에 있으면 F·숫자·Esc·0이
// 그 프레임의 keydown으로 먼저 온다. 자식은 그 키를 삼키고 여기 실어 보낸다 — 번호표를
// 열지/닫을지, 어느 항목을 누를지는 언제나 맨 위(모든 프레임의 보고를 모은 쪽)가 정한다.
const HintsKeyMessage = z.object({
  type: z.literal('hints/key'),
  code: z.string(),
});

// 자식 프레임 → SW → 맨 위(Task 3): 자식 프레임 자신의 입력 모드(초점이 입력칸인지)가 바뀔 때마다
// 보낸다. 맨 위 모드 표시는 초점이 위임된 iframe이 있으면(activeElement가 그 iframe 자신) 가장
// 최근 이 보고를, 없으면 자기 모드를 쓴다(content.ts refreshModeDisplay).
const ModeReportMessage = z.object({
  type: z.literal('mode/report'),
  mode: z.enum(['helper', 'typing']),
});

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

// 맨 위 → SW → 탭의 모든 프레임(방송, Plan 01-09 Task 3, D-09): sender.frameId === 0일 때만
// relay가 받는다(T-01-26) — 자식 프레임은 이 값으로 자기 pipeline.setModal을 켜고 끈다.
const ConfirmStateMessage = z.object({
  type: z.literal('confirm/state'),
  open: z.boolean(),
});

// 자식 프레임 → SW → 맨 위(Plan 01-09 Task 3, D-03, D-09): 초점이 자식 프레임 안에 있을 때 그
// 프레임이 삼킨 keydown·keyup을 실어 보낸다. 시각(t)은 싣지 않는다 — 보호 시간은 언제나 맨 위
// 시계(performance.now(), 메시지가 도착한 시각) 기준이다.
const ConfirmKeyMessage = z.object({
  type: z.literal('confirm/key'),
  kind: z.enum(['keydown', 'keyup']),
  code: z.string(),
  repeat: z.boolean(),
});

export const Message = z.discriminatedUnion('type', [
  StorageRequestMessage,
  FrameStateMessage,
  FrameReportMessage,
  FramesReportsMessage,
  HintsPressMessage,
  PressRequestMessage,
  HintsStateMessage,
  FrameRefreshMessage,
  HintsKeyMessage,
  ModeReportMessage,
  ConfirmStateMessage,
  ConfirmKeyMessage,
]);
export type Message = z.infer<typeof Message>;

export function parseMessage(raw: unknown): z.ZodSafeParseResult<Message> {
  return Message.safeParse(raw);
}
