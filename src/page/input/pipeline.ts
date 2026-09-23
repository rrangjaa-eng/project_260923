import type { SettingsV1 } from '@/core/settings-schema';
import { createTremorFilter, type TremorFilter } from '@/core/tremor-filter';
import { currentMode, deepActiveElement } from '@/page/input/mode';
import { setMode, updateIndicatorProximity } from '@/page/overlay/mode-indicator';

// 입력 파이프라인(D-06, D-09): window capture로 키·포인터 입력을 가장 먼저 받아 떨림을 거르고
// (isTrusted가 아닌 입력은 통과, 도우미 꺼짐이면 통과), 남은 입력만 등록된 처리기에 넘긴다.
// Pattern 1(RESEARCH.md) — document_start에서 등록해야 사이트 스크립트보다 앞선다.

export type KeyHandler = (input: { code: string }) => boolean;
export type PressHandler = (input: { x: number; y: number }) => boolean;

// D-04: 마우스 움직임 계산은 1초 60번까지만.
const POINTER_MOVE_MIN_INTERVAL_MS = 1000 / 60;

export interface InputPipeline {
  onKey(handler: KeyHandler): void;
  onPress(handler: PressHandler): void;
}

export function createInputPipeline(opts: { getSettings: () => SettingsV1; signal: AbortSignal }): InputPipeline {
  const { getSettings, signal } = opts;

  let filter: TremorFilter | null = null;
  let filterIntervalMs = -1;
  let filterSameSpotPx = -1;
  const swallowedKeyCodes = new Set<string>();
  let pressSwallowed = false;
  let lastPointerMoveAt = 0;
  const keyHandlers: KeyHandler[] = [];
  const pressHandlers: PressHandler[] = [];

  // 설정이 바뀌면(interval·sameSpot) 새 값으로 필터를 다시 만든다. 그 외엔 상태(마지막 받아들인
  // 시각·자리)를 그대로 유지해야 하므로 매 이벤트마다 새로 만들지 않는다.
  function activeFilter(): TremorFilter {
    const settings = getSettings();
    if (
      filter === null ||
      settings.data.tremorIntervalMs !== filterIntervalMs ||
      settings.data.sameSpotPx !== filterSameSpotPx
    ) {
      filterIntervalMs = settings.data.tremorIntervalMs;
      filterSameSpotPx = settings.data.sameSpotPx;
      filter = createTremorFilter({ intervalMs: filterIntervalMs, sameSpotPx: filterSameSpotPx });
    }
    return filter;
  }

  function isHelperEnabled(): boolean {
    return getSettings().data.enabled;
  }

  function updateModeFromFocus(): void {
    if (!isHelperEnabled()) {
      return;
    }
    setMode(currentMode());
  }

  window.addEventListener('focusin', updateModeFromFocus, { capture: true, signal });
  window.addEventListener('focusout', updateModeFromFocus, { capture: true, signal });

  window.addEventListener(
    'keydown',
    (event) => {
      if (!event.isTrusted || !isHelperEnabled()) {
        return;
      }
      const accepted = activeFilter().accept({ kind: 'key', code: event.code, repeat: event.repeat, t: event.timeStamp });
      if (!accepted) {
        swallowedKeyCodes.add(event.code);
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      swallowedKeyCodes.delete(event.code);

      if (event.code === 'Escape' && currentMode() === 'typing') {
        // 입력칸을 빠져나온다(D-16) — 사이트의 Esc 처리(자동완성 닫기 등)는 막지 않는다.
        const active = deepActiveElement();
        if (active instanceof HTMLElement) {
          active.blur();
        }
        setMode('helper');
        return;
      }

      if (currentMode() === 'typing') {
        // 입력 모드에서는 도우미 키 처리기를 부르지 않는다(숫자·스페이스바가 글자로 들어가게).
        return;
      }

      for (const handler of keyHandlers) {
        if (handler({ code: event.code })) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
      }
    },
    { capture: true, signal },
  );

  window.addEventListener(
    'keyup',
    (event) => {
      if (!event.isTrusted || !isHelperEnabled()) {
        return;
      }
      if (swallowedKeyCodes.has(event.code)) {
        swallowedKeyCodes.delete(event.code);
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    { capture: true, signal },
  );

  window.addEventListener(
    'pointerdown',
    (event) => {
      if (!event.isTrusted || !isHelperEnabled()) {
        return;
      }
      const accepted = activeFilter().accept({ kind: 'press', x: event.clientX, y: event.clientY, t: event.timeStamp });
      pressSwallowed = !accepted;
      if (pressSwallowed) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      for (const handler of pressHandlers) {
        if (handler({ x: event.clientX, y: event.clientY })) {
          pressSwallowed = true;
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
      }
    },
    { capture: true, signal },
  );

  // pointerdown→mousedown→pointerup→mouseup→click 묶음: pointerdown에서 거절되면 다음
  // pointerdown까지 나머지도 모두 삼킨다.
  function swallowIfPressRejected(event: Event): void {
    if (!event.isTrusted || !isHelperEnabled()) {
      return;
    }
    if (pressSwallowed) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  window.addEventListener('mousedown', swallowIfPressRejected, { capture: true, signal });
  window.addEventListener('pointerup', swallowIfPressRejected, { capture: true, signal });
  window.addEventListener('mouseup', swallowIfPressRejected, { capture: true, signal });
  window.addEventListener('click', swallowIfPressRejected, { capture: true, signal });

  window.addEventListener(
    'dblclick',
    (event) => {
      if (!event.isTrusted || !isHelperEnabled()) {
        return;
      }
      if (activeFilter().shouldSuppressDblclick()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    { capture: true, signal },
  );

  // 맨 위 프레임의 커서 위치만 모드 표시 비키기 판정에 넘긴다(iframe 안 커서 반영은 Plan 01-07).
  window.addEventListener(
    'pointermove',
    (event) => {
      if (window.top !== window) {
        return;
      }
      if (event.timeStamp - lastPointerMoveAt < POINTER_MOVE_MIN_INTERVAL_MS) {
        return;
      }
      lastPointerMoveAt = event.timeStamp;
      updateIndicatorProximity(event.clientX, event.clientY);
    },
    { capture: true, signal },
  );

  return {
    onKey(handler) {
      keyHandlers.push(handler);
    },
    onPress(handler) {
      pressHandlers.push(handler);
    },
  };
}
