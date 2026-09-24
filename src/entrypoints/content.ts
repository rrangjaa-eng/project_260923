import { createConfirmGuard, type ConfirmGuard } from '@/core/confirm-guard';
import { createDragTwoPress, type DragTwoPress } from '@/core/drag-two-press';
import { createDwellTimer, type DwellTimer } from '@/core/dwell-timer';
import type { Fingerprint } from '@/core/fingerprint';
import { composeTree, resolveReports, type ComposedItem, type RawFrameReport } from '@/core/frame-tree';
import { createGridIndex } from '@/core/grid-index';
import { orderHints, placeLabels, type HintEntry } from '@/core/hint-order';
import { pickTarget } from '@/core/magnet';
import {
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
import { hideModeIndicator, setHint, setMode, showModeIndicator, showTransientMessage } from '@/page/overlay/mode-indicator';
import { hideHints, showHints, showNextCard } from '@/page/overlay/hints';
import { hideRing, setDwellProgress, showRing } from '@/page/overlay/ring';
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
function sendRecordPress(fingerprint: Fingerprint): void {
  void chrome.runtime.sendMessage({
    type: 'storage/request',
    op: { kind: 'recordPress', origin: window.location.origin, fingerprint },
  });
}

// 모든 프레임(D-02): allFrames + document_start로 사이트 스크립트보다 먼저 등록한다. 읽기는
// 허용, 쓰기는 금지(D-24) — chrome.storage.*.set은 storage-writer.ts에만 있다.
export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  runAt: 'document_start',
  main() {
    const isTopFrame = window.top === window;
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
          pressOrDrag(currentTargetId, el, item.fingerprint, item.danger);
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
        if (item && el) {
          pressOrDrag(message.itemId, el, { ...item.fingerprint, framePath: message.framePath }, item.danger);
        }
        return undefined;
      }

      if (message.type === 'frame/refresh') {
        // T-01-21: 형제 프레임의 iframe 구성이 바뀌어 내 selfPath(부모의 자식 목록에서 내 순번)가
        // 낡았을 수 있다 — 스케줄 대기 없이 바로 다시 모아 새 경로로 보고한다.
        collector.refresh();
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
      if (!currentEnabled) {
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
    const inputPipeline = createInputPipeline({ getSettings: () => currentSettings, signal: pipelineController.signal });

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
        pressOrDrag(item.id, el, item.fingerprint, item.danger);
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
      pressOrDrag(item.id, el, item.fingerprint, item.danger);
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
      const placements = new Map(placeLabels(placementEntries).map((p) => [p.itemId, p]));
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
    // hints/press를 SW에 보내(해당 프레임에 press/request로 돌아간다).
    function pressHintEntry(itemId: string): void {
      const { frameId: targetFrameId, itemId: targetItemId } = parseHintKey(itemId);
      if (targetFrameId === 0) {
        const item = collector.items().find((candidate) => candidate.id === targetItemId);
        const el = collector.get(targetItemId);
        if (item && el) {
          pressOrDrag(targetItemId, el, item.fingerprint, item.danger);
        }
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
      const guard: ConfirmGuard = createConfirmGuard({ openedAt: performance.now(), keymap: currentSettings.data.keymap });

      function finish(result: 'confirm' | 'cancel'): void {
        inputPipeline.setModal(null);
        activeConfirmKeyHandler = null;
        closeConfirm();
        // T-01-26: 자식 프레임에 확인 화면이 닫혔음을 알려 그 프레임의 pipeline.setModal도 풀어준다.
        void chrome.runtime.sendMessage({ type: 'confirm/state', open: false });
        if (result === 'confirm') {
          pressHintEntry(itemId);
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

    async function openHints(): Promise<void> {
      // 맨 위(frameId 0) 몫은 collector에서 바로 다시 만든다 — relay 왕복(비동기)이 아직 끝나지
      // 않았어도 자기 프레임 것만은 항상 최신이도록 한다.
      const entriesForCompose = latestReportEntries.filter((entry) => entry.frameId !== 0);
      entriesForCompose.push({ frameId: 0, report: buildFrameReport(collector.items()) });
      const composed = composeTree(resolveReports(entriesForCompose));
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
  },
});
