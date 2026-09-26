import { createConfirmGuard, type ConfirmGuard } from '@/core/confirm-guard';
import { createDragTwoPress, type DragTwoPress } from '@/core/drag-two-press';
import { createDwellTimer, type DwellTimer } from '@/core/dwell-timer';
import type { Fingerprint } from '@/core/fingerprint';
import { composeTree, resolveReports, type ComposedItem, type RawFrameReport } from '@/core/frame-tree';
import { createGridIndex } from '@/core/grid-index';
import { orderHints, placeLabels, type HintEntry } from '@/core/hint-order';
import { pickTarget } from '@/core/magnet';
import {
  MIGRATION_FAILED_MESSAGE,
  MIGRATION_NOTICE_KEY,
  MigrationNoticeV1,
  PressesV1,
  SETTINGS_KEY,
  SettingsV1,
  SiteEntryV1,
  defaultSettings,
  pressesKey,
  siteKey,
} from '@/core/settings-schema';
import { buildFrameReport, createCollector, type Item } from '@/page/collector/collector';
import { synthesizeDrag } from '@/page/click/drag';
import { synthesizePress } from '@/page/click/press';
import { createInputPipeline, type ModalEvent } from '@/page/input/pipeline';
import { currentMode } from '@/page/input/mode';
import { closeConfirm, openConfirm } from '@/page/overlay/confirm-dialog';
import {
  getOverlayScale,
  hideModeIndicator,
  onOverlayScaleChange,
  setHint,
  setMode,
  showModeIndicator,
  showTransientMessage,
} from '@/page/overlay/mode-indicator';
import { hideHints, showHints, showNextCard } from '@/page/overlay/hints';
import { hideRing, setDwellProgress, showRing } from '@/page/overlay/ring';
import { showToast } from '@/page/overlay/toast';
import { parseMessage } from '@/shared/messages';

// 끌어서 놓기 두 번 누르기 힌트 문구(D-08, SYSTEM.md 카피 규칙): 키 이름은 영어 그대로.
const DRAG_ARM_HINT = '놓을 곳을 누르세요 · Esc 취소';

// 선택 목록·파일 등 picker가 막혔을 때 안내(SYSTEM.md 카피 규칙: 원인 없이 다음 행동만
// 짧게, D-13·Plan 01-12 스파이크).
const PICKER_BLOCKED_MESSAGE = '이 칸은 직접 눌러 주세요';

// 끌 수 있는 요소 판정(D-08 RESOLVED): 요소 자신이나 조상이 draggable="true"다.
function isDraggableElement(el: Element): boolean {
  let node: Element | null = el;
  while (node) {
    if (node instanceof HTMLElement && node.draggable) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

const DIGIT_TO_NUMBER: Record<string, number> = {
  Digit1: 1,
  Digit2: 2,
  Digit3: 3,
  Digit4: 4,
  Digit5: 5,
  Digit6: 6,
  Digit7: 7,
  Digit8: 8,
  Digit9: 9,
  Numpad1: 1,
  Numpad2: 2,
  Numpad3: 3,
  Numpad4: 4,
  Numpad5: 5,
  Numpad6: 6,
  Numpad7: 7,
  Numpad8: 8,
  Numpad9: 9,
};

function pointInRect(x: number, y: number, rect: { x: number; y: number; w: number; h: number }): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

// 번호표 항목 키(D-03): 각 프레임의 collector가 매기는 id(el-0, el-1 …)는 프레임마다 독립이라
// 서로 다른 프레임에서 우연히 같을 수 있다 — 맨 위가 하나로 합칠 때 frameId를 붙여 구분한다.
function hintKey(frameId: number, itemId: string): string {
  return `${frameId.toString()}:${itemId}`;
}

function parseHintKey(key: string): { frameId: number; itemId: string } {
  const sep = key.indexOf(':');
  return { frameId: Number(key.slice(0, sep)), itemId: key.slice(sep + 1) };
}

// 자주 누른 기록(D-11, D-23): 번호표·자석 커서로 요소를 누를 때마다 SW에 부탁만 한다(쓰기는
// storage-writer.ts에서만, D-24). 응답을 기다리지 않는다.
//
// WR-05: 사이트 = 맨 위 페이지 출처(D-20) — 자식 프레임(특히 다른 출처)이 자기 window.location
// .origin으로 기록하면 맨 위의 readPinsAndPresses()(항상 자기 출처만 읽는다)가 그 기록을 영영
// 못 본다. site/query 응답으로 한 번 배운 맨 위 출처를 여기 저장해 모든 프레임이 같은 키에
// 기록하게 한다(응답이 아직 없으면 자기 출처로 대체 — D-06과 같은 완화, 맨 위 프레임 자신은
// 늘 자기 출처 = 맨 위 출처라 이 대체값도 옳다).
let cachedTopOrigin: string | null = null;

function sendRecordPress(fingerprint: Fingerprint): void {
  void chrome.runtime.sendMessage({
    type: 'storage/request',
    op: { kind: 'recordPress', origin: cachedTopOrigin ?? window.location.origin, fingerprint },
  });
}

// 모든 프레임(D-02): allFrames + document_start로 사이트 스크립트보다 먼저 등록한다. 읽기는
// 허용, 쓰기는 금지(D-24) — chrome.storage.*.set은 storage-writer.ts에만 있다.
export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  matchAboutBlank: true,
  runAt: 'document_start',
  main() {
    // 새로 시작할 때 문서에 이미 tremor-helper-root가 있으면 지운다(D-22): 옛 도우미가 미처
    // 스스로 지우지 못했을 수 있다 — 호스트는 늘 1개여야 하므로, 이 새 인스턴스가 자기 것을
    // 만들기 전에 남아 있는 옛 것부터 없앤다(mode-indicator.ts의 shadowRoot는 이 실행 컨텍스트
    // 안의 모듈 상태라 옛 인스턴스의 호스트를 스스로는 모른다).
    document.querySelectorAll('tremor-helper-root').forEach((el) => {
      el.remove();
    });

    const isTopFrame = window.top === window;
    // WR-05: 자석·머무르기·스페이스바로 이 프레임 안에서 곧바로 누른 것은 진짜 합성 framePath
    // (composeTree가 맨 위에서 트리를 내려가며 계산하는 값, 이 프레임 혼자서는 모른다)를 대신할
    // 수 없다. item.fingerprint.framePath를 그대로([]) 두면 "맨 위 자신의 항목"과 자리 표시가
    // 같아져, 여러 프레임에 반복되는 흔한 템플릿(같은 domPath+글자)이 서로 다른 요소인데도 같은
    // 기록으로 잘못 합쳐질 수 있다. 정확한 경로까지는 아니어도(번호표를 거친 누르기는 이미
    // press/request의 message.framePath로 정확하다) 최소한 "맨 위가 아니다"와 "어느 문서인지"는
    // 구분해 서로 다른 프레임끼리도, 맨 위와도 섞이지 않게 한다.
    const localPressFramePath = isTopFrame ? [] : [`local:${window.location.href}`];
    let currentEnabled: boolean | undefined;
    let currentSettings: SettingsV1 = defaultSettings();
    // 지금 사이트에서만 끄기(Plan 01-13, D-20): 사이트 = 맨 위 페이지 출처. 전역 enabled와 합쳐
    // applyEnabled에 넘긴다(syncEnabled) — 둘 중 하나라도 꺼지면 도우미는 꺼진다.
    let siteDisabled = false;
    // 맨 위만 쓴다: relay.ts가 그대로 넘겨주는 탭의 모든 프레임 원본 보고(selfPath + 자식의
    // 상대 순번, D-03). 실제 frameId는 openHints 때 resolveReports로 맞춘다 — 자기 프레임(0)
    // 것은 최신성을 보장하려고 그때 collector에서 직접 다시 만들어 덮어쓴다(비동기 왕복 경합 방지).
    let latestReportEntries: Array<{ frameId: number; report: RawFrameReport }> = [];
    let composedItemsCache: ComposedItem[] = [];

    // Task 3(D-03): 자식 프레임만 쓴다 — 번호표가 떠 있는지(맨 위가 방송) 알아야 숫자·0·Esc를
    // 삼킬지 판단한다. 맨 위만 쓴다: 초점이 위임된 iframe이 있을 때 보여 줄, 가장 최근 자식의
    // mode/report(refreshModeDisplay).
    let childHintsVisible = false;
    let lastChildMode: 'helper' | 'typing' | null = null;

    // 확인 화면(Plan 01-09 Task 3, D-03, D-09): 맨 위만 쓴다 — 현재 열린 확인의 guard로 보내는
    // 함수(confirm/key로 자식이 전달한 키도 이 함수를 부른다, t는 맨 위 시계로 다시 잰다).
    let activeConfirmKeyHandler: ((e: ModalEvent) => void) | null = null;

    // 자석 커서(D-10, D-04): 이 프레임에서 바로 계산한다(D-02) — collector가 모은 요소를 grid로
    // 색인하고, pointermove마다 가장 가까운 요소를 잡아 테두리를 보여 준다.
    const magnetController = new AbortController();
    const collector = createCollector({
      signal: magnetController.signal,
      getDangerWords: () => currentSettings.data.dangerWords,
    });
    const grid = createGridIndex<Item>();
    let currentTargetId: string | null = null;
    let lastCursorPos: { x: number; y: number } | null = null;

    function rebuildGrid(): void {
      grid.build(collector.items());
    }
    rebuildGrid();

    // 끌어서 놓기 두 번 누르기(D-08, FILT-04): 이 프레임 안의 모든 누르기 경로(자석 클릭·
    // 스페이스바·번호표 숫자·머무르기)가 공유하는 상태 기계 하나. id는 이 프레임의 collector
    // 로컬 id — 끌기는 같은 프레임 안만 다룬다(가정 문단).
    const dragTwoPress: DragTwoPress = createDragTwoPress();

    // 위험한 버튼은 끌기 대상이 아니다(T-01-32) — dragTwoPress가 꺼져 있거나 위험한 버튼이면
    // 그냥 누른다. 켜져 있으면 상태 기계 결과(arm/drop/cancel/pass)에 따라 힌트를 보여 주거나
    // synthesizeDrag로 대신 끌어서 놓는다.
    function pressOrDrag(id: string, el: Element, fingerprint: Fingerprint, danger: boolean): void {
      if (!currentSettings.data.dragTwoPress || danger) {
        const { picker } = synthesizePress(el);
        if (picker === 'blocked') {
          showTransientMessage(PICKER_BLOCKED_MESSAGE, 2000);
        }
        sendRecordPress(fingerprint);
        return;
      }
      const result = dragTwoPress.press({ id, draggable: isDraggableElement(el) });
      if (result.action === 'pass') {
        const { picker } = synthesizePress(el);
        if (picker === 'blocked') {
          showTransientMessage(PICKER_BLOCKED_MESSAGE, 2000);
        }
        sendRecordPress(fingerprint);
        return;
      }
      if (result.action === 'arm') {
        setHint(DRAG_ARM_HINT);
        return;
      }
      if (result.action === 'cancel') {
        setHint(null);
        return;
      }
      setHint(null);
      const sourceEl = collector.get(result.sourceId);
      if (sourceEl) {
        synthesizeDrag(sourceEl, el);
      }
    }

    // 머무르기 클릭(D-12, CLICK-04): dwellEnabled일 때 잡힌 요소가 있는 동안만 rAF 루프를
    // 돌린다. dwellMs가 바뀌면(settings 갱신) 새 타이머로 바꿔 새 시간으로 다시 잰다.
    let dwellTimer: DwellTimer = createDwellTimer({ dwellMs: currentSettings.data.dwellMs });
    let dwellLoopActive = false;

    function stopDwellLoopIfRunning(): void {
      // 잡힘이 풀렸다고 타이머에도 알려야 한다 — 루프를 멈추기만 하면 타이머 내부의
      // trackedTargetId·fired가 옛 대상에 그대로 남아, 같은 대상으로 돌아왔을 때 "떠났다
      // 돌아옴"으로 인식하지 못해 재발사가 막힌 채로 남는다(D-12).
      dwellTimer.update({ targetId: null, danger: false, t: performance.now() });
      if (dwellLoopActive) {
        dwellLoopActive = false;
        setDwellProgress(null);
      }
    }

    function dwellTick(): void {
      if (!dwellLoopActive) {
        return;
      }
      const item = currentTargetId ? collector.items().find((candidate) => candidate.id === currentTargetId) : undefined;
      if (!item || currentTargetId === null) {
        stopDwellLoopIfRunning();
        return;
      }
      const result = dwellTimer.update({ targetId: currentTargetId, danger: item.danger, t: performance.now() });
      setDwellProgress(item.danger ? null : result.progress);
      if (result.fire) {
        const el = collector.get(currentTargetId);
        if (el) {
          pressOrDrag(currentTargetId, el, { ...item.fingerprint, framePath: localPressFramePath }, item.danger);
        }
      }
      requestAnimationFrame(dwellTick);
    }

    function syncDwellLoop(): void {
      const shouldRun = currentEnabled === true && currentSettings.data.dwellEnabled && currentTargetId !== null;
      if (shouldRun && !dwellLoopActive) {
        dwellLoopActive = true;
        requestAnimationFrame(dwellTick);
      } else if (!shouldRun) {
        stopDwellLoopIfRunning();
      }
    }

    // 프레임 메시지(D-03, D-09): 맨 위는 frames/reports(전체 보고 모음)를 받고, 모든 프레임은
    // press/request(SW가 이 프레임에 누르기를 부탁)를 받는다.
    chrome.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
      const parsed = parseMessage(raw);
      if (!parsed.success) {
        return undefined;
      }
      const message = parsed.data;

      if (message.type === 'site/ping' && isTopFrame) {
        // background.ts의 "도울 수 없음" 응답 없음 판정(D-21) — 맨 위 프레임만 답한다. 도우미가
        // 전역·사이트로 꺼져 있어도 content script 자신은 살아 있으니 답한다(currentEnabled와 무관).
        sendResponse({ ok: true });
        return undefined;
      }

      if (message.type === 'frames/reports' && isTopFrame) {
        latestReportEntries = message.reports;
        return undefined;
      }

      if (message.type === 'press/request') {
        const item = collector.items().find((candidate) => candidate.id === message.itemId);
        const el = collector.get(message.itemId);
        if (!item || !el) {
          return undefined;
        }
        if (item.danger && !message.confirmed) {
          // WR-02: 번호표를 연 뒤(맨 위의 스냅샷을 만든 뒤) 이 프레임 안 요소가 위험해졌다 —
          // 누르지 않고 맨 위에 알려 확인 화면을 열게 한다. frameId는 relay가 실제 sender.frameId로
          // 채운다(신뢰할 필요 없어 0을 그대로 둔다).
          void chrome.runtime.sendMessage({ type: 'press/refused', frameId: 0, itemId: message.itemId });
          return undefined;
        }
        pressOrDrag(message.itemId, el, { ...item.fingerprint, framePath: message.framePath }, item.danger);
        return undefined;
      }

      if (message.type === 'press/refused' && isTopFrame) {
        // WR-02: 자식 프레임이 누르기를 거절했다 — 갖고 있는 스냅샷으로 확인 화면을 연다(그
        // 사이 번호표가 닫혔으면 스냅샷이 없을 수 있다 — 그때는 조용히 무시한다. 아무것도 눌리지
        // 않았으니 안전하다).
        const composed = composedItemsCache.find((c) => c.frameId === message.frameId && c.itemId === message.itemId);
        if (composed) {
          openDangerConfirm(composed, hintKey(composed.frameId, composed.itemId));
        }
        return undefined;
      }

      if (message.type === 'frame/refresh') {
        // T-01-21: 형제 프레임의 iframe 구성이 바뀌어 내 selfPath(부모의 자식 목록에서 내 순번)가
        // 낡았을 수 있다 — 스케줄 대기 없이 바로 다시 모아 새 경로로 보고한다. CR-08: relay.ts가
        // 이 메시지를 보내는 상황 자체가 relay 쪽 상태가 막 바뀐 참이라(형제 구성 변화) 강제로
        // 다시 보고한다 — 내용이 이전과 같아 보여도 relay.ts의 기억이 방금 사라졌을 수 있다.
        collector.refresh(true);
        return undefined;
      }

      if (message.type === 'hints/state') {
        // Task 3: 자식 프레임이 숫자·0·Esc를 삼킬지 판단하는 데 쓴다(맨 위는 hintsActive를
        // 직접 관리하므로 이 값이 따로 필요 없지만 받아도 무해하다).
        childHintsVisible = message.visible;
        return undefined;
      }

      if (message.type === 'hints/key' && isTopFrame) {
        // Task 3: 초점이 자식 프레임 안에 있어 그 프레임이 삼켜 보낸 키 — 판단은 여기(맨 위)서.
        if (currentEnabled) {
          handleTopHintKey(message.code);
        }
        return undefined;
      }

      if (message.type === 'mode/report' && isTopFrame) {
        // Task 3: 자식 프레임 자신의 입력 모드 — 초점이 그 프레임에 위임돼 있을 때만 화면에 쓴다.
        lastChildMode = message.mode;
        refreshModeDisplay();
        return undefined;
      }

      if (message.type === 'confirm/state' && !isTopFrame) {
        // Task 3(D-09, T-01-24): 맨 위가 확인 화면을 열고 닫을 때 자식 프레임에 방송한다 — 이
        // 프레임도 자기 isTrusted 키를 모두 삼켜 confirm/key로 맨 위에 보낸다(직접 판단하지 않음).
        if (message.open) {
          inputPipeline.setModal((e) => {
            if (e.type === 'tick') {
              // 보호·누르고 있기 시간은 언제나 맨 위 시계 기준(맨 위가 잰다) — 여기선 무시.
              return;
            }
            void chrome.runtime.sendMessage({ type: 'confirm/key', kind: e.type, code: e.code, repeat: e.repeat });
          });
        } else {
          inputPipeline.setModal(null);
        }
        return undefined;
      }

      if (message.type === 'confirm/key' && isTopFrame) {
        // Task 3(D-03, D-09): 자식 프레임이 삼켜 보낸 키 — 판단은 맨 위에서, 시각은 맨 위 시계로
        // 다시 잰다(보호 시간이 어느 프레임의 시계를 신뢰하는지 뒤섞이지 않게).
        activeConfirmKeyHandler?.({ type: message.kind, code: message.code, repeat: message.repeat, t: performance.now() });
        return undefined;
      }

      return undefined;
    });

    // Task 3(D-03): 자식 프레임의 입력 모드를 맨 위에 알린다 — 맨 위 모드 표시가 초점이 위임된
    // iframe이 있으면 이 값을, 없으면 자기 모드를 쓴다(refreshModeDisplay, 맨 위 쪽에서 정의).
    function sendModeReport(): void {
      if (!currentEnabled) {
        return;
      }
      void chrome.runtime.sendMessage({ type: 'mode/report', mode: currentMode() });
    }

    // 맨 위 모드 표시 갱신(Task 3): document.activeElement가 iframe 자신이면(그 프레임 안에
    // 초점이 있다는 뜻, 교차 출처라도 이 검사는 늘 가능) 가장 최근 자식의 mode/report를,
    // 아니면(초점이 맨 위 자기 문서 안) 맨 위 자신의 모드를 쓴다.
    function refreshModeDisplay(): void {
      if (!isTopFrame || !currentEnabled) {
        return;
      }
      const delegatedToChild = document.activeElement instanceof HTMLIFrameElement;
      setMode(delegatedToChild && lastChildMode !== null ? lastChildMode : currentMode());
    }

    if (!isTopFrame) {
      window.addEventListener('focusin', sendModeReport, { capture: true, signal: magnetController.signal });
      window.addEventListener('focusout', sendModeReport, { capture: true, signal: magnetController.signal });
    } else {
      window.addEventListener('focusin', refreshModeDisplay, { capture: true, signal: magnetController.signal });
      window.addEventListener('focusout', refreshModeDisplay, { capture: true, signal: magnetController.signal });
    }

    function evaluateMagnet(cursor: { x: number; y: number }): void {
      // CR-01: 확인 화면이 떠 있는 동안 자석이 스크림 밑 페이지 요소를 다시 잡지 못하게 한다 —
      // openDangerConfirm이 이미 currentTargetId를 비우고 테두리·머무르기를 껐어도, 이후
      // pointermove가 evaluateMagnet을 다시 부르면 되돌아온다.
      if (!currentEnabled || activeConfirmKeyHandler) {
        return;
      }
      const candidates = grid.nearby(cursor, currentSettings.data.captureMarginPx);
      currentTargetId = pickTarget({
        cursor,
        candidates,
        currentId: currentTargetId,
        captureMarginPx: currentSettings.data.captureMarginPx,
        switchHysteresisPx: currentSettings.data.switchHysteresisPx,
      });
      if (currentTargetId === null) {
        hideRing();
        syncDwellLoop();
        return;
      }
      const item = collector.items().find((candidate) => candidate.id === currentTargetId);
      if (item) {
        showRing(item.rect, { danger: item.danger });
      } else {
        hideRing();
      }
      syncDwellLoop();
    }

    collector.onChange(() => {
      rebuildGrid();
      if (hintsActive) {
        // WR-03: 열려 있는 번호표는 openHints() 시점 스냅샷 자리에 머물러 있었다 — 스크롤·크기
        // 변경(collector.onChange, D-04)마다 새로 합성해 지금 화면 자리로 다시 그린다. 번호→항목
        // 배정(hintChapters)은 그대로 두고 자리만 다시 계산한다.
        composedItemsCache = composeCurrentItems();
        openChapter(hintChapterIndex);
      }
      if (currentTargetId !== null) {
        // 잡힌 요소가 화면 변화로 사라졌으면 놓고, 남아 있으면 새 사각형으로 테두리를 옮긴다.
        const stillThere = collector.items().find((item) => item.id === currentTargetId);
        if (!stillThere) {
          currentTargetId = null;
          hideRing();
          syncDwellLoop();
        } else if (currentEnabled) {
          showRing(stillThere.rect, { danger: stillThere.danger });
        }
      } else if (lastCursorPos) {
        // 늦게 나타난 요소도 마지막 커서 위치 기준으로 곧바로 잡아 본다(추가 pointermove 없이).
        evaluateMagnet(lastCursorPos);
      }
    });

    // fix(01-15 known gap, 01-16): 확대가 바뀌면(--overlay-scale 갱신 직후, mode-indicator.ts가
    // 부른다) 테두리 오프셋과 열려 있는 번호표 자리도 추가 포인터 이동·다시 열기 없이 새 배율로
    // 다시 계산한다. 크기(border-width·label 너비 등)는 순수 CSS calc(var(--overlay-scale))라
    // 스스로 다시 그려지지만, 위치는 showRing()·openChapter() 호출 시점에만 계산되므로 이 신호가
    // 없으면 다음 자석 재계산(포인터 이동)까지 옛 배율 그대로 남는다.
    onOverlayScaleChange(() => {
      if (currentTargetId !== null && lastCursorPos) {
        evaluateMagnet(lastCursorPos);
      }
      if (hintsActive) {
        openChapter(hintChapterIndex);
      }
    });

    // D-04: 마우스 움직임 계산은 1초 60번까지만 — collector.ts와 같은 requestAnimationFrame
    // 코얼레싱으로 화면 주사율만큼만 계산한다. 타임스탬프 기준 스로틀(간격 안 이벤트는 버림)은
    // 마지막 자리를 영영 놓칠 수 있어(간격 안에 여러 pointermove가 몰리면 마지막 것이 버려짐,
    // 재현 확인됨) 쓰지 않는다.
    let magnetEvalScheduled = false;
    function scheduleMagnetEvaluate(): void {
      if (magnetEvalScheduled) {
        return;
      }
      magnetEvalScheduled = true;
      requestAnimationFrame(() => {
        magnetEvalScheduled = false;
        if (lastCursorPos) {
          evaluateMagnet(lastCursorPos);
        }
      });
    }

    window.addEventListener(
      'pointermove',
      (event) => {
        if (!event.isTrusted) {
          return;
        }
        lastCursorPos = { x: event.clientX, y: event.clientY };
        scheduleMagnetEvaluate();
      },
      { capture: true, signal: magnetController.signal },
    );

    function applyEnabled(enabled: boolean): void {
      if (currentEnabled === enabled) {
        return;
      }
      currentEnabled = enabled;

      if (!enabled) {
        // 도우미가 꺼지면 테두리·번호표·머무르기 진행·끌기 시작 상태도 지운다(D-27) — 그렇지
        // 않으면 다시 켰을 때 옛 끌기 시작 상태가 남아 다음 누름이 뜬금없이 drop이 된다.
        currentTargetId = null;
        hideRing();
        closeHints();
        syncDwellLoop();
        dragTwoPress.cancel();
        setHint(null);
        // CR-02: 열려 있던 확인도 함께 취소한다 — 안 그러면 화면(destroyOverlayRoot로 이미 지워짐)
        // 없이 activeConfirmKeyHandler·pipeline.setModal만 남아, 다시 켰을 때 다음 평범한 Enter가
        // 옛 확인의 "예"로 처리돼 위험한 버튼이 조용히 눌린다.
        if (activeConfirmKeyHandler) {
          inputPipeline.setModal(null);
          activeConfirmKeyHandler = null;
          closeConfirm();
          void chrome.runtime.sendMessage({ type: 'confirm/state', open: false });
        }
      }

      if (window.top === window) {
        // 맨 위 프레임에서만 모드 표시를 그린다(D-03).
        if (enabled) {
          showModeIndicator();
        } else {
          hideModeIndicator();
        }
      }

      void chrome.runtime.sendMessage({ type: 'frame/state', enabled });
    }

    // 전역 enabled와 지금 사이트에서만 끄기를 합친다(D-20) — 둘 중 하나라도 꺼지면 도우미는 꺼진다.
    function syncEnabled(): void {
      applyEnabled(currentSettings.data.enabled && !siteDisabled);
    }

    // 설정을 읽기 전이라도 리스너를 먼저 걸어야 사이트보다 앞선다(D-06, Pattern 1) — 설정이
    // 오기 전에는 defaultSettings()로 판단한다. signal은 Plan 01-14의 자기 정리용이다.
    const pipelineController = new AbortController();
    // CR-03: 전역 enabled와 이 사이트에서만 끄기(siteDisabled)를 합친 값을 준다 — 파이프라인이
    // 전역 enabled만 보면 사이트별 끄기 뒤에도 떨림 필터·자동 반복 삼킴이 계속 돈다.
    const inputPipeline = createInputPipeline({
      getSettings: () => currentSettings,
      // 설정이 아직 안 왔으면(currentEnabled === undefined) defaultSettings()의 enabled(true)로
      // 판단한다(D-06 Pattern 1, 위 pipelineController 주석과 같은 규칙) — currentEnabled는 실제
      // 전역·사이트별 상태가 합쳐진 뒤에만 값이 채워진다(syncEnabled → applyEnabled).
      isEnabled: () => currentEnabled ?? true,
      signal: pipelineController.signal,
    });

    // 끌기 시작 상태에서 Esc(D-08, D-15 keymap.cancel): 도우미가 끌기를 취소한다. 끌기 시작이
    // 아니면(armed() === null) 통과해 사이트·다른 기능(번호표 닫기 등)이 그대로 Esc를 쓰게 둔다.
    inputPipeline.onKey(({ code }) => {
      if (!currentEnabled || code !== currentSettings.data.keymap.cancel || dragTwoPress.armed() === null) {
        return false;
      }
      dragTwoPress.cancel();
      setHint(null);
      return true;
    });

    // 대신 누르기(D-10, D-13): 커서가 잡힌 요소 밖이면 삼키고 click 시점에 대신 누른다. 커서가
    // 이미 잡힌 요소 안이면 원래 클릭을 그대로 통과시킨다(isTrusted 클릭이 호환성이 가장 좋다).
    // 잡힌 것이 없으면 통과(D-27 "잡힌 것 없음 = 원래대로"). dragTwoPress가 켜져 있고 끌기
    // 시작 중이거나 대상이 끌 수 있는 요소면, 커서가 요소 위라도 삼켜 pressOrDrag로 보낸다 —
    // 그렇지 않으면 끌기 시작·놓기가 그냥 사이트의 원래 클릭이 되어 버린다(D-08).
    inputPipeline.onPress(({ x, y }) => {
      if (!currentEnabled) {
        return false;
      }
      // pointermove의 자석 재계산은 requestAnimationFrame으로 미뤄지므로(D-04), 이동 직후
      // 곧바로 누르면 currentTargetId가 아직 이전 자리 값일 수 있다(재현: 클릭 사이 100ms
      // 간격 e2e에서 이전 요소가 대신 눌리는 경합, Rule 1). 누름 좌표로 즉시 다시 계산해
      // 실제 누른 자리와 항상 맞춘다.
      evaluateMagnet({ x, y });
      if (currentTargetId === null) {
        return false;
      }
      const item = collector.items().find((candidate) => candidate.id === currentTargetId);
      const el = collector.get(currentTargetId);
      if (!item || !el) {
        return false;
      }
      const needsDragIntercept =
        currentSettings.data.dragTwoPress && !item.danger && (dragTwoPress.armed() !== null || isDraggableElement(el));
      if (pointInRect(x, y, item.rect) && !needsDragIntercept) {
        return false;
      }
      return () => {
        pressOrDrag(item.id, el, { ...item.fingerprint, framePath: localPressFramePath }, item.danger);
      };
    });

    // 스페이스바로 잡힌 요소 누르기(D-17, KEY-02): 잡힌 것이 없으면 통과해 사이트·브라우저
    // 기본 동작(스크롤 등)을 그대로 둔다.
    inputPipeline.onKey(({ code }) => {
      if (!currentEnabled || code !== currentSettings.data.keymap.press || currentTargetId === null) {
        return false;
      }
      const item = collector.items().find((candidate) => candidate.id === currentTargetId);
      const el = collector.get(currentTargetId);
      if (!item || !el) {
        return false;
      }
      pressOrDrag(item.id, el, { ...item.fingerprint, framePath: localPressFramePath }, item.danger);
      return true;
    });

    // 번호표(D-11, D-15, CLICK-03): keymap.toggleHints(기본 F)로 켜고 끈다. 번호 순서는 이
    // 계획에서는 고정 번호·누른 횟수 없이 커서 근처만(Task 3이 pins·presses를 채운다). 떠 있을
    // 때만 숫자·0(다음 장)·Esc를 도우미가 쓴다.
    let hintChapters: HintEntry[][] = [];
    let hintChapterIndex = 0;
    let hintsActive = false;

    function closeHints(): void {
      hintsActive = false;
      hintChapters = [];
      hintChapterIndex = 0;
      hideHints();
      if (isTopFrame) {
        void chrome.runtime.sendMessage({ type: 'hints/state', visible: false });
      }
    }

    function openChapter(index: number): void {
      const chapter = hintChapters[index];
      if (!chapter) {
        return;
      }
      const rectByKey = new Map(composedItemsCache.map((c) => [hintKey(c.frameId, c.itemId), c.rect]));
      const dangerByKey = new Map(composedItemsCache.map((c) => [hintKey(c.frameId, c.itemId), c.danger === true]));
      const placementEntries = chapter
        .map((entry) => {
          const rect = rectByKey.get(entry.itemId);
          return rect ? { itemId: entry.itemId, rect } : null;
        })
        .filter((entry): entry is { itemId: string; rect: Item['rect'] } => entry !== null);
      // 확대 역보정(Plan 01-15, D-26): 번호표 실제 화면 크기(28px × 배율)로 겹침 판정을 해야
      // 확대·축소해도 배치가 화면과 맞는다.
      const placements = new Map(placeLabels(placementEntries, 28 * getOverlayScale()).map((p) => [p.itemId, p]));
      const labels = chapter
        .map((entry) => {
          const placement = placements.get(entry.itemId);
          return placement
            ? { number: entry.number, x: placement.x, y: placement.y, danger: dangerByKey.get(entry.itemId) === true }
            : null;
        })
        .filter((label): label is { number: number; x: number; y: number; danger: boolean } => label !== null);

      hideHints();
      showHints(labels);
      if (hintChapters.length > index + 1) {
        showNextCard();
      }
    }

    // 번호 순서에 반영할 고정 번호·자주 누른 기록을 읽기만 한다(D-11, D-24) — 쓰기는 항상
    // storage-writer.ts에서만.
    async function readPinsAndPresses(): Promise<{ pins: SiteEntryV1['data']['pins']; presses: PressesV1['data']['counts'] }> {
      const origin = window.location.origin;
      const [siteStored, pressesStored] = await Promise.all([
        chrome.storage.sync.get(siteKey(origin)),
        chrome.storage.local.get(pressesKey(origin)),
      ]);
      const siteParsed = SiteEntryV1.safeParse(siteStored[siteKey(origin)]);
      const pressesParsed = PressesV1.safeParse(pressesStored[pressesKey(origin)]);
      return {
        pins: siteParsed.success ? siteParsed.data.data.pins : [],
        presses: pressesParsed.success ? pressesParsed.data.data.counts : [],
      };
    }

    // 번호를 눌렀을 때(D-03): 항목이 맨 위 자신의 것이면 바로 누르고, 다른 프레임의 것이면
    // hints/press를 SW에 보내(해당 프레임에 press/request로 돌아간다). confirmed는 WR-02: 이미
    // 확인 화면을 거쳐 온 호출인지(finish('confirm')) 번호표에서 바로 온 호출인지 — false일 때만
    // 최신 danger를 다시 확인해, 번호표를 연 뒤 위험해진 요소를 확인 없이 곧바로 누르지 않는다.
    function pressHintEntry(itemId: string, confirmed = false): void {
      const { frameId: targetFrameId, itemId: targetItemId } = parseHintKey(itemId);
      if (targetFrameId === 0) {
        const item = collector.items().find((candidate) => candidate.id === targetItemId);
        const el = collector.get(targetItemId);
        if (!item || !el) {
          return;
        }
        if (item.danger && !confirmed) {
          openDangerConfirm({ frameId: 0, itemId: targetItemId, rect: item.rect, fingerprint: item.fingerprint, danger: true }, itemId);
          return;
        }
        pressOrDrag(targetItemId, el, item.fingerprint, item.danger);
        return;
      }
      const composed = composedItemsCache.find((c) => c.frameId === targetFrameId && c.itemId === targetItemId);
      if (!composed) {
        return;
      }
      void chrome.runtime.sendMessage({
        type: 'hints/press',
        frameId: targetFrameId,
        itemId: targetItemId,
        framePath: composed.fingerprint.framePath,
        confirmed,
      });
    }

    // 확인 화면 카피(D-26 카피 규칙, "확인" 대신 실제 동작 단어): 맨 위 자신의 항목은
    // collector.items()의 name(계산된 화면 글자)을 그대로 쓰고, 다른 프레임 것은 와이어로 오지
    // 않는 name 대신 fingerprint의 버튼 글자·라벨 글자·aria 중 있는 것으로 대신한다.
    function displayNameFor(composed: ComposedItem): string {
      if (composed.frameId === 0) {
        const local = collector.items().find((candidate) => candidate.id === composed.itemId);
        if (local) {
          return local.name;
        }
      }
      return (
        composed.fingerprint.buttonText ?? composed.fingerprint.labelText ?? composed.fingerprint.aria ?? composed.fingerprint.id ?? ''
      );
    }

    // 위험한 버튼 확인 화면(D-18, D-19, SAFE-02, SAFE-03): 확인 화면을 열고 guard를 만들어
    // pipeline.setModal로 모든 isTrusted 키를 guard에만 보낸다. confirm이면 누르고(맨 위 요소는
    // 바로, 자식 프레임은 hints/press — pressHintEntry가 이미 이 분기를 안다), cancel이면 닫기만.
    function openDangerConfirm(composed: ComposedItem, itemId: string): void {
      // CR-01: 확인 화면이 뜨는 순간 자석이 잡고 있던 것·테두리·머무르기 진행을 모두 놓는다 —
      // 그대로 두면 스크림 밑 페이지 요소가 여전히 잡힌 채로 남는다.
      currentTargetId = null;
      hideRing();
      stopDwellLoopIfRunning();

      const guard: ConfirmGuard = createConfirmGuard({ openedAt: performance.now(), keymap: currentSettings.data.keymap });

      function finish(result: 'confirm' | 'cancel'): void {
        inputPipeline.setModal(null);
        activeConfirmKeyHandler = null;
        closeConfirm();
        // T-01-26: 자식 프레임에 확인 화면이 닫혔음을 알려 그 프레임의 pipeline.setModal도 풀어준다.
        void chrome.runtime.sendMessage({ type: 'confirm/state', open: false });
        if (result === 'confirm') {
          pressHintEntry(itemId, true);
        }
      }

      openConfirm({
        name: displayNameFor(composed),
        onResult: () => {
          finish('cancel');
        },
      });
      void chrome.runtime.sendMessage({ type: 'confirm/state', open: true });

      activeConfirmKeyHandler = (e) => {
        const result = e.type === 'tick' ? guard.tick(e.t) : guard.handle(e);
        if (result === 'confirm' || result === 'cancel') {
          finish(result);
        }
      };
      inputPipeline.setModal(activeConfirmKeyHandler);
    }

    // 맨 위(frameId 0) 몫은 collector에서 바로 다시 만든다 — relay 왕복(비동기)이 아직 끝나지
    // 않았어도 자기 프레임 것만은 항상 최신이도록 한다(openHints()·WR-03 재구성이 함께 쓴다).
    function composeCurrentItems(): ComposedItem[] {
      const entriesForCompose = latestReportEntries.filter((entry) => entry.frameId !== 0);
      entriesForCompose.push({ frameId: 0, report: buildFrameReport(collector.items()) });
      return composeTree(resolveReports(entriesForCompose));
    }

    async function openHints(): Promise<void> {
      const composed = composeCurrentItems();
      composedItemsCache = composed;

      if (composed.length === 0) {
        showTransientMessage('누를 곳이 없어요', 2000);
        return;
      }
      const items = composed.map((c) => ({ id: hintKey(c.frameId, c.itemId), rect: c.rect, fingerprint: c.fingerprint }));
      const { pins, presses } = await readPinsAndPresses();
      hintChapters = orderHints({ items, pins, presses, cursor: lastCursorPos ?? { x: 0, y: 0 } });
      hintChapterIndex = 0;
      hintsActive = true;
      void chrome.runtime.sendMessage({ type: 'hints/state', visible: true });
      openChapter(0);
    }

    // 번호표 키 판단은 언제나 맨 위에서만 한다 — inputPipeline.onKey(맨 위 자신의 keydown)와
    // hints/key 메시지(Task 3: 초점이 자식 프레임 안에 있을 때 그 프레임이 삼켜 보낸 키) 둘 다
    // 이 함수를 부른다.
    function handleTopHintKey(code: string): boolean {
      if (code === currentSettings.data.keymap.toggleHints) {
        if (hintsActive) {
          closeHints();
        } else {
          void openHints();
        }
        return true;
      }

      if (!hintsActive) {
        return false;
      }

      if (code === currentSettings.data.keymap.cancel) {
        closeHints();
        return true;
      }

      if (code === 'Digit0') {
        if (hintChapterIndex + 1 < hintChapters.length) {
          hintChapterIndex += 1;
          openChapter(hintChapterIndex);
        }
        return true;
      }

      const number = DIGIT_TO_NUMBER[code];
      if (number !== undefined) {
        const chapter = hintChapters[hintChapterIndex];
        const entry = chapter?.find((candidate) => candidate.number === number);
        if (entry) {
          const composed = composedItemsCache.find((c) => hintKey(c.frameId, c.itemId) === entry.itemId);
          if (composed?.danger) {
            // D-18, D-19, T-01-23 완화(Plan 01-09): 위험한 버튼은 번호로 바로 누르지 않고 번호표를
            // 닫은 뒤 확인 화면을 연다 — confirm이어야만 누른다.
            closeHints();
            openDangerConfirm(composed, entry.itemId);
            return true;
          }
          pressHintEntry(entry.itemId);
        }
        closeHints();
        return true;
      }

      return false;
    }

    inputPipeline.onKey(({ code }) => {
      if (!currentEnabled || !isTopFrame) {
        return false;
      }
      return handleTopHintKey(code);
    });

    // 자식 프레임에서 번호표 키 삼키기(Task 3, D-03, D-09): 초점이 자식 프레임 안에 있으면 F는
    // 언제나(맨 위가 번호표를 열지 닫을지 정한다), 숫자·0·Esc는 번호표가 떠 있을 때만 삼켜
    // hints/key로 맨 위에 보낸다. 번호표가 안 떠 있으면 그 프레임의 페이지에 그대로 보낸다.
    inputPipeline.onKey(({ code }) => {
      if (isTopFrame || !currentEnabled) {
        return false;
      }

      if (code === currentSettings.data.keymap.toggleHints) {
        void chrome.runtime.sendMessage({ type: 'hints/key', code });
        return true;
      }

      if (!childHintsVisible) {
        return false;
      }

      if (code === currentSettings.data.keymap.cancel || code === 'Digit0' || DIGIT_TO_NUMBER[code] !== undefined) {
        void chrome.runtime.sendMessage({ type: 'hints/key', code });
        return true;
      }

      return false;
    });

    // 형식 변환 실패 알림(D-25, Plan 01-14): 맨 위 프레임이 페이지를 열 때 한 번 확인만 한다
    // (쓰지 않는다) — notice:migration-failed가 있으면 토스트를 띄운다. settings 자체가
    // 깨졌으면 아래 safeParse가 실패해 currentSettings는 이미 만든 기본값(defaultSettings())
    // 그대로 남는다.
    if (isTopFrame) {
      void chrome.storage.local.get(MIGRATION_NOTICE_KEY).then((stored) => {
        const parsed = MigrationNoticeV1.safeParse(stored[MIGRATION_NOTICE_KEY]);
        if (parsed.success) {
          showToast(MIGRATION_FAILED_MESSAGE);
        }
      });
    }

    void chrome.storage.sync.get(SETTINGS_KEY).then((stored) => {
      const parsed = SettingsV1.safeParse(stored[SETTINGS_KEY]);
      if (parsed.success) {
        if (parsed.data.data.dwellMs !== currentSettings.data.dwellMs) {
          dwellTimer = createDwellTimer({ dwellMs: parsed.data.data.dwellMs });
        }
        currentSettings = parsed.data;
        syncEnabled();
        // D-18: dangerWords가 기본값과 다를 수 있다 — 이미 모은 항목의 danger를 다시 계산한다.
        collector.refresh();
        syncDwellLoop();
      }
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'sync') {
        return;
      }
      const change = changes[SETTINGS_KEY];
      if (!change) {
        return;
      }
      const parsed = SettingsV1.safeParse(change.newValue);
      if (parsed.success) {
        if (parsed.data.data.dwellMs !== currentSettings.data.dwellMs) {
          dwellTimer = createDwellTimer({ dwellMs: parsed.data.data.dwellMs });
        }
        currentSettings = parsed.data;
        syncEnabled();
        // D-18: dangerWords가 바뀌면 곧바로 반영한다 — 다시 모아 danger를 새로 계산한다.
        collector.refresh();
        syncDwellLoop();
      }
    });

    // 지금 사이트에서만 끄기(Plan 01-13, D-20): 사이트 = 맨 위 페이지 출처 — background.ts에
    // site/query로 물어본다(모든 프레임의 tab.url이 맨 위 문서 주소와 같으므로 어느 프레임이
    // 물어봐도 같은 답을 받는다, T-01-38: 읽을 때 SiteEntryV1 검사, 실패하면 기본값 켜짐).
    void chrome.runtime.sendMessage({ type: 'site/query' }).then((raw) => {
      const topOrigin = (raw as { topOrigin?: string } | undefined)?.topOrigin;
      if (!topOrigin) {
        return;
      }
      cachedTopOrigin = topOrigin; // WR-05: sendRecordPress가 이 값을 쓴다.
      const key = siteKey(topOrigin);

      void chrome.storage.sync.get(key).then((stored) => {
        const parsed = SiteEntryV1.safeParse(stored[key]);
        siteDisabled = parsed.success ? parsed.data.data.disabled : false;
        syncEnabled();
      });

      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'sync') {
          return;
        }
        const change = changes[key];
        if (!change) {
          return;
        }
        const parsed = SiteEntryV1.safeParse(change.newValue);
        siteDisabled = parsed.success ? parsed.data.data.disabled : false;
        syncEnabled();
      });
    });

    // 옛 도우미 자기 정리(D-22, RESEARCH.md Pattern 6): 확장이 업데이트·다시 불러오기·제거되면
    // 이 컨텍스트는 무효화되지만 문서 안 JS는 그대로 남는다 — 방치하면 window capture 리스너가
    // 계속 키를 가로챈다. "alive" 포트를 열어 두고 onDisconnect가 오면 chrome.runtime?.id로
    // 실제 무효화인지(확장 제거·업데이트) 아니면 SW가 잠깐 쉬었다 끊긴 것뿐인지 구분한다.
    let cleanedUp = false;
    function cleanupOldHelper(): void {
      if (cleanedUp) {
        return;
      }
      cleanedUp = true;
      magnetController.abort();
      pipelineController.abort();
      stopDwellLoopIfRunning();
      dragTwoPress.cancel();
      // CR-02: 도우미 꺼짐과 같은 정리 — 열려 있던 확인의 보호 타이머(confirm-dialog.ts 내부
      // setTimeout)도 함께 멈춘다.
      if (activeConfirmKeyHandler) {
        activeConfirmKeyHandler = null;
        closeConfirm();
      }
      // 도우미 꺼짐과 같은 정리(hideModeIndicator = destroyOverlayRoot) — 테두리·번호표·토스트를
      // 모두 포함한 호스트 하나를 통째로 지운다(호스트는 늘 1개).
      hideModeIndicator();
    }

    function isExtensionContextValid(): boolean {
      try {
        // 우리 ambient 타입(src/types/chrome.d.ts)은 chrome.runtime을 항상 있는 것으로 단순화해
        // 둬 `?.`가 정적으로는 불필요해 보이지만, 실제 크롬은 확장이 무효화되면 이 읽기 자체가
        // 던질 수 있다 — 그래서 옵셔널 체이닝과 바깥 try/catch를 함께 둔다.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        return typeof chrome.runtime?.id === 'string';
      } catch {
        return false;
      }
    }

    function connectAlivePort(isReconnect = false): void {
      let port: chrome.runtime.Port;
      try {
        port = chrome.runtime.connect({ name: 'alive' });
      } catch {
        // 연결 자체가 던진다 — 이미 무효화된 컨텍스트다.
        cleanupOldHelper();
        return;
      }
      if (isReconnect) {
        // CR-08: 끊긴 뒤 다시 연결됐다는 것은 SW가 잠깐 쉬었다 다시 시작했다는 뜻이다 —
        // relay.ts의 기억(reportsByTab)이 사라졌을 수 있으니, 보고 내용이 이전과 같아 보여도
        // 강제로 다시 보고해 relay.ts가 이 프레임을 다시 알게 한다.
        collector.refresh(true);
      }
      port.onDisconnect.addListener(() => {
        if (!isExtensionContextValid()) {
          cleanupOldHelper();
          return;
        }
        // 확장은 살아 있다 — SW가 잠깐 쉬었다 끊긴 것뿐이니 다시 연결한다(RESEARCH.md Pattern 6).
        connectAlivePort(true);
      });
    }
    connectAlivePort();
  },
});
