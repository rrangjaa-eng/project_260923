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
// composeTree로 합성한 값 — 대상 프레임이 recordPress에 그대로 쓴다. confirmed는 WR-02: 이미
// 확인 화면을 거쳐 온 누르기인지(true) 번호표에서 바로 온 누르기인지(false) — 대상 프레임이
// 최신 danger를 다시 볼 때 이 값으로 "이미 승인됨"과 "아직 승인 전"을 가른다.
const HintsPressMessage = z.object({
  type: z.literal('hints/press'),
  frameId: z.number(),
  itemId: z.string(),
  framePath: z.array(z.string()),
  confirmed: z.boolean(),
});

// SW → 해당 프레임({ frameId } 옵션으로 라우팅)으로만 보낸다.
const PressRequestMessage = z.object({
  type: z.literal('press/request'),
  itemId: z.string(),
  framePath: z.array(z.string()),
  confirmed: z.boolean(),
});

// 자식 프레임 → SW → 맨 위(WR-02): press/request로 눌러 달라고 부탁받았는데, 그 사이 요소가
// 위험해졌고(item.danger) 아직 확인을 거치지 않았다(!confirmed) — 누르지 않고 거절한다. frameId는
// 자식이 채운 값을 신뢰하지 않고 relay가 sender.frameId로 덮어쓴다(frame/report와 같은 방식).
const PressRefusedMessage = z.object({
  type: z.literal('press/refused'),
  frameId: z.number(),
  itemId: z.string(),
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

// 일반 설정 변경(Plan 01-10, D-24, D-25, T-01-28): 팝업 메뉴 카드 → SW. 허용 키만
// strict로 받는다 — writer가 settings를 읽어 patch만 합친 뒤 SettingsV1로 다시 검사하고 쓴다.
const UpdateSettingsOp = z.object({
  kind: z.literal('updateSettings'),
  patch: z
    .object({
      dwellEnabled: z.boolean().optional(),
      dragTwoPress: z.boolean().optional(),
    })
    .strict(),
});
export type UpdateSettingsPatch = z.infer<typeof UpdateSettingsOp>['patch'];

// 자주 누른 기록(D-11, D-23): 요소를 누를 때마다 보낸다. origin은 보내는 프레임의 origin —
// storage-writer.ts가 sender.url의 origin과 같은지 확인한 뒤에만 기록한다(T-01-16).
const RecordPressOp = z.object({
  kind: z.literal('recordPress'),
  origin: z.string(),
  fingerprint: FingerprintSchema,
});

// 지금 사이트에서만 끄기(Plan 01-13, D-20, T-01-36): 팝업은 확장 페이지라 sender.url로 대상
// 탭을 알 수 없다 — tabId를 실어 보내면 background.ts가 chrome.tabs.get(tabId)의 출처와
// origin이 같을 때만 받아들인다(요청 origin은 대상 탭 주소의 출처여야 한다).
const SetSiteDisabledOp = z.object({
  kind: z.literal('setSiteDisabled'),
  origin: z.string(),
  disabled: z.boolean(),
  tabId: z.number(),
});

const StorageRequestOp = z.discriminatedUnion('kind', [SetEnabledOp, RecordPressOp, UpdateSettingsOp, SetSiteDisabledOp]);

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

// 지금 사이트에서만 끄기(Plan 01-13, D-20): background.ts → 맨 위 프레임. 맨 위가 응답하면
// 확장이 동작하는 페이지다(응답 없음 판정, RESEARCH.md "Open Questions (RESOLVED)" 6번).
const SitePingMessage = z.object({
  type: z.literal('site/ping'),
});

// content script → background.ts: 맨 위 페이지의 출처를 물어본다. background.ts가
// sender.tab.url에서 계산해 답한다(모든 프레임의 tab.url이 항상 맨 위 문서의 주소와 같다).
const SiteQueryMessage = z.object({
  type: z.literal('site/query'),
});

// 확대 역보정(Plan 01-15, D-26, RESEARCH Pattern 5): content → SW, 답 { zoom }.
// background.ts가 sender.tab.id로 chrome.tabs.getZoom을 불러 답한다.
const ZoomQueryMessage = z.object({
  type: z.literal('zoom/query'),
});

// content script(각 프레임) → SW(01-17 Task 2, D-22 문서 다시 쓰기 대응): 필드 없음 — 대상은
// Chrome이 채운 sender.tab.id·sender.frameId뿐이다(스푸핑 방지, T-01-49). document.write로 문서를
// 다시 쓴 프레임이 옛 인스턴스를 스스로 정리한 뒤 보낸다 — background.ts가 그 프레임 하나에만
// content script를 다시 넣는다.
const FrameReinjectMessage = z.object({
  type: z.literal('frame/reinject'),
});

// SW → 탭의 모든 프레임(방송, T-01-47): chrome.tabs.onZoomChange가 오면 새 비율을 알린다.
// zoom은 0.25~5 범위만 받는다(스푸핑·오류 값 방지) — 이 범위 밖 값은 parseMessage가 버린다.
const ZoomChangedMessage = z.object({
  type: z.literal('zoom/changed'),
  zoom: z.number().min(0.25).max(5),
});

export const Message = z.discriminatedUnion('type', [
  StorageRequestMessage,
  FrameStateMessage,
  FrameReportMessage,
  FramesReportsMessage,
  HintsPressMessage,
  PressRequestMessage,
  PressRefusedMessage,
  HintsStateMessage,
  FrameRefreshMessage,
  HintsKeyMessage,
  ModeReportMessage,
  ConfirmStateMessage,
  ConfirmKeyMessage,
  SitePingMessage,
  SiteQueryMessage,
  ZoomQueryMessage,
  ZoomChangedMessage,
  FrameReinjectMessage,
]);
export type Message = z.infer<typeof Message>;

export function parseMessage(raw: unknown): z.ZodSafeParseResult<Message> {
  return Message.safeParse(raw);
}
