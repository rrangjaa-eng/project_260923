import type { Fingerprint } from '@/core/fingerprint';
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
import { createCollector, type Item } from '@/page/collector/collector';
import { synthesizePress } from '@/page/click/press';
import { createInputPipeline } from '@/page/input/pipeline';
import { hideModeIndicator, showModeIndicator, showTransientMessage } from '@/page/overlay/mode-indicator';
import { hideHints, showHints, showNextCard } from '@/page/overlay/hints';
import { hideRing, showRing } from '@/page/overlay/ring';

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
    let currentEnabled: boolean | undefined;
    let currentSettings: SettingsV1 = defaultSettings();

    // 자석 커서(D-10, D-04): 이 프레임에서 바로 계산한다(D-02) — collector가 모은 요소를 grid로
    // 색인하고, pointermove마다 가장 가까운 요소를 잡아 테두리를 보여 준다.
    const magnetController = new AbortController();
    const collector = createCollector({ signal: magnetController.signal });
    const grid = createGridIndex<Item>();
    let currentTargetId: string | null = null;
    let lastCursorPos: { x: number; y: number } | null = null;

    function rebuildGrid(): void {
      grid.build(collector.items());
    }
    rebuildGrid();

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
        return;
      }
      const item = collector.items().find((candidate) => candidate.id === currentTargetId);
      if (item) {
        showRing(item.rect);
      } else {
        hideRing();
      }
    }

    collector.onChange(() => {
      rebuildGrid();
      if (currentTargetId !== null) {
        // 잡힌 요소가 화면 변화로 사라졌으면 놓고, 남아 있으면 새 사각형으로 테두리를 옮긴다.
        const stillThere = collector.items().find((item) => item.id === currentTargetId);
        if (!stillThere) {
          currentTargetId = null;
          hideRing();
        } else if (currentEnabled) {
          showRing(stillThere.rect);
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
        // 도우미가 꺼지면 테두리·번호표도 지운다(D-27).
        currentTargetId = null;
        hideRing();
        closeHints();
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

    // 설정을 읽기 전이라도 리스너를 먼저 걸어야 사이트보다 앞선다(D-06, Pattern 1) — 설정이
    // 오기 전에는 defaultSettings()로 판단한다. signal은 Plan 01-14의 자기 정리용이다.
    const pipelineController = new AbortController();
    const inputPipeline = createInputPipeline({ getSettings: () => currentSettings, signal: pipelineController.signal });

    // 대신 누르기(D-10, D-13): 커서가 잡힌 요소 밖이면 삼키고 click 시점에 대신 누른다. 커서가
    // 이미 잡힌 요소 안이면 원래 클릭을 그대로 통과시킨다(isTrusted 클릭이 호환성이 가장 좋다).
    // 잡힌 것이 없으면 통과(D-27 "잡힌 것 없음 = 원래대로").
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
      if (pointInRect(x, y, item.rect)) {
        return false;
      }
      return () => {
        synthesizePress(el);
        sendRecordPress(item.fingerprint);
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
      synthesizePress(el);
      sendRecordPress(item.fingerprint);
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
    }

    function openChapter(index: number): void {
      const chapter = hintChapters[index];
      if (!chapter) {
        return;
      }
      const rectByItemId = new Map(collector.items().map((item) => [item.id, item.rect]));
      const placementEntries = chapter
        .map((entry) => {
          const rect = rectByItemId.get(entry.itemId);
          return rect ? { itemId: entry.itemId, rect } : null;
        })
        .filter((entry): entry is { itemId: string; rect: Item['rect'] } => entry !== null);
      const placements = new Map(placeLabels(placementEntries).map((p) => [p.itemId, p]));
      const labels = chapter
        .map((entry) => {
          const placement = placements.get(entry.itemId);
          return placement ? { number: entry.number, x: placement.x, y: placement.y } : null;
        })
        .filter((label): label is { number: number; x: number; y: number } => label !== null);

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

    async function openHints(): Promise<void> {
      const items = collector.items();
      if (items.length === 0) {
        showTransientMessage('누를 곳이 없어요', 2000);
        return;
      }
      const { pins, presses } = await readPinsAndPresses();
      hintChapters = orderHints({ items, pins, presses, cursor: lastCursorPos ?? { x: 0, y: 0 } });
      hintChapterIndex = 0;
      hintsActive = true;
      openChapter(0);
    }

    inputPipeline.onKey(({ code }) => {
      if (!currentEnabled) {
        return false;
      }

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
        const item = entry ? collector.items().find((candidate) => candidate.id === entry.itemId) : undefined;
        const el = entry ? collector.get(entry.itemId) : undefined;
        if (item && el) {
          synthesizePress(el);
          sendRecordPress(item.fingerprint);
        }
        closeHints();
        return true;
      }

      return false;
    });

    void chrome.storage.sync.get(SETTINGS_KEY).then((stored) => {
      const parsed = SettingsV1.safeParse(stored[SETTINGS_KEY]);
      if (parsed.success) {
        currentSettings = parsed.data;
        applyEnabled(parsed.data.data.enabled);
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
        currentSettings = parsed.data;
        applyEnabled(parsed.data.data.enabled);
      }
    });
  },
});
