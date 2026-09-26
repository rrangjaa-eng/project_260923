import type { SettingsV1 } from '@/core/settings-schema';
import { createTremorFilter, type TremorFilter } from '@/core/tremor-filter';
import {
  currentMode,
  deepActiveElement,
  escapeDocumentEditor,
  isDocumentEditingRoot,
  isEscapedFromDocumentEditor,
  resumeDocumentEditor,
} from '@/page/input/mode';
import { setMode, updateIndicatorProximity } from '@/page/overlay/mode-indicator';

// 입력 파이프라인(D-06, D-09): window capture로 키·포인터 입력을 가장 먼저 받아 떨림을 거르고
// (isTrusted가 아닌 입력은 통과, 도우미 꺼짐이면 통과), 남은 입력만 등록된 처리기에 넘긴다.
// Pattern 1(RESEARCH.md) — document_start에서 등록해야 사이트 스크립트보다 앞선다.

export type KeyHandler = (input: { code: string }) => boolean;
// true를 돌려주면 그 누름 묶음(pointerdown~click)을 삼킨다. 함수를 돌려주면 같은 뜻이면서,
// 묶음의 click 시점에("누름·뗌이 끝난 뒤 누르기") 그 함수를 "실행" 신호로 부른다(D-13, D-17).
export type PressHandler = (input: { x: number; y: number }) => boolean | (() => void);

// 확인 화면 모달(D-09, D-19, Plan 01-09): 모달이 열려 있으면 isTrusted keydown·keyup·keypress를
// 모두 삼키고(사이트로 가지 않음) keydown·keyup만 이 핸들러에 넘긴다 — isTrusted false는
// 삼키지도 넘기지도 않는다(사이트 자기 이벤트, 확인에 쓰이지 않음, T-01-24). 스페이스바를 계속
// 누르고 있어도 브라우저가 반드시 repeat keydown을 다시 보내지는 않으므로(자동화 도구는 특히),
// 100ms마다 'tick'을 함께 보내 guard.tick()으로 누르고 있는 시간을 직접 잰다.
export type ModalEvent = { type: 'keydown' | 'keyup'; code: string; repeat: boolean; t: number } | { type: 'tick'; t: number };
export type ModalHandler = (e: ModalEvent) => void;

// D-04: 마우스 움직임 계산은 1초 60번까지만.
const POINTER_MOVE_MIN_INTERVAL_MS = 1000 / 60;
const MODAL_TICK_INTERVAL_MS = 100;

export interface InputPipeline {
  onKey(handler: KeyHandler): void;
  onPress(handler: PressHandler): void;
  setModal(handler: ModalHandler | null): void;
}

export function createInputPipeline(opts: {
  getSettings: () => SettingsV1;
  // CR-03: 전역 enabled만으로는 "이 사이트에서 끄기"를 반영하지 못한다 — content.ts가 전역·사이트별
  // 상태를 합친 값을 준다(생략하면 전역 enabled만 본다, 기존 호출부·시험 호환).
  isEnabled?: () => boolean;
  signal: AbortSignal;
  // Task 3(01-18, KEY-01): 문서 전체 편집기의 Esc 나옴·되돌아옴은 focus를 옮기지 않아 focusin·
  // focusout이 뜨지 않는다 — 모드가 바뀔 때마다 호출자(content.ts)에 알려 모드 표시를 갱신하게
  // 한다(생략 가능, 기존 호출부·시험 호환).
  onModeChange?: () => void;
}): InputPipeline {
  const { getSettings, signal, isEnabled: isEnabledOpt, onModeChange } = opts;

  let filter: TremorFilter | null = null;
  let filterIntervalMs = -1;
  let filterSameSpotPx = -1;
  const swallowedKeyCodes = new Set<string>();
  let pressSwallowed = false;
  let pendingPressExecute: (() => void) | null = null;
  let lastPointerMoveAt = 0;
  const keyHandlers: KeyHandler[] = [];
  const pressHandlers: PressHandler[] = [];
  let modalHandler: ModalHandler | null = null;
  let modalTickInterval: ReturnType<typeof setInterval> | null = null;

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
    return isEnabledOpt ? isEnabledOpt() : getSettings().data.enabled;
  }

  function updateModeFromFocus(): void {
    if (!isHelperEnabled()) {
      return;
    }
    setMode(currentMode());
  }

  // Task 3(01-18, KEY-01): 초점이 다른 요소로 옮겨 가면(focusin) "나옴" 상태를 되돌린다 — 새
  // 대상이 여전히 같은 문서 전체 편집기가 아닐 때만(예: 편집기 안 다른 프레임으로 옮겨간 경우
  // 등은 그 프레임 자신의 escapedFromDocumentEditor로 따로 다룬다).
  window.addEventListener(
    'focusin',
    () => {
      if (isHelperEnabled() && isEscapedFromDocumentEditor() && !isDocumentEditingRoot(deepActiveElement())) {
        resumeDocumentEditor();
      }
      updateModeFromFocus();
    },
    { capture: true, signal },
  );
  window.addEventListener('focusout', updateModeFromFocus, { capture: true, signal });

  // WR-01: 확인 화면의 스페이스바 "누르고 있기"는 keyup으로만 풀린다(D-19). alt-tab·다른 창
  // 클릭으로 포커스가 떠나면 keyup이 아예 오지 않을 수 있어, 그대로 두면 tick()이 keydown
  // 시각 기준으로 계속 시간을 세다 holdMs 뒤 저절로 confirm된다 — 잠깐의 떨림 탭과 구분이
  // 안 된다. blur·visibilitychange를 keyup(release)으로 취급해 guard의 hold를 끊는다.
  function releaseModalHold(): void {
    if (!modalHandler) {
      return;
    }
    modalHandler({ type: 'keyup', code: getSettings().data.keymap.press, repeat: false, t: performance.now() });
  }
  window.addEventListener('blur', releaseModalHold, { signal });
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        releaseModalHold();
      }
    },
    { signal },
  );

  window.addEventListener(
    'keydown',
    (event) => {
      if (!event.isTrusted || !isHelperEnabled()) {
        return;
      }
      if (modalHandler) {
        event.preventDefault();
        event.stopImmediatePropagation();
        modalHandler({ type: 'keydown', code: event.code, repeat: event.repeat, t: event.timeStamp });
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
        if (isDocumentEditingRoot(active)) {
          // Task 3(01-18, KEY-01): 문서 전체 편집기는 blur() 대신 "나옴" 표시만 한다 — blur가
          // 캐럿을 지워 편집기가 이후 키를 받지 못하게 만들기 때문(probe evidence).
          escapeDocumentEditor();
        } else if (active instanceof HTMLElement) {
          active.blur();
        }
        setMode('helper');
        onModeChange?.();
        return;
      }

      if (currentMode() === 'typing') {
        // 입력 모드에서는 도우미 키 처리기를 부르지 않는다(숫자·스페이스바가 글자로 들어가게).
        return;
      }

      for (const handler of keyHandlers) {
        if (handler({ code: event.code })) {
          // 도우미가 이 키를 썼다(D-17) — 같은 code의 뒤따르는 keypress·keyup도 삼켜야
          // 사이트 단축키(keydown 대신 keypress·keyup을 쓰는 것 포함)보다 도우미가 앞선다.
          swallowedKeyCodes.add(event.code);
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
      }
    },
    { capture: true, signal },
  );

  window.addEventListener(
    'keypress',
    (event) => {
      if (!event.isTrusted || !isHelperEnabled()) {
        return;
      }
      if (modalHandler) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (swallowedKeyCodes.has(event.code)) {
        event.preventDefault();
        event.stopImmediatePropagation();
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
      if (modalHandler) {
        event.preventDefault();
        event.stopImmediatePropagation();
        modalHandler({ type: 'keyup', code: event.code, repeat: event.repeat, t: event.timeStamp });
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
      // Task 3(01-18, KEY-01): 문서 전체 편집기를 "나옴" 상태에서 주 버튼으로 다시 누르면 곧바로
      // 입력으로 돌아간다 — 모달·자석 판단보다 먼저 두어 누르기 경로 자체는 바꾸지 않는다.
      if (isEscapedFromDocumentEditor() && event.button === 0 && event.isPrimary) {
        resumeDocumentEditor();
        setMode(currentMode());
        onModeChange?.();
      }
      if (modalHandler) {
        // CR-01: 확인 화면이 떠 있으면 포인터는 자석·떨림 필터를 거치지 않고 그대로 통과한다 —
        // 스크림·그림자 DOM 대화상자가 직접 받는다(취소 버튼의 실제 클릭이 여기서 막히면 안 된다).
        // 이전 묶음이 남긴 상태도 지워 모달이 닫힌 뒤 엉뚱한 대신 누르기가 이어지지 않게 한다.
        pressSwallowed = false;
        pendingPressExecute = null;
        return;
      }
      // CR-07: 새 묶음이 시작될 때마다 옛 예약부터 지운다 — 오른쪽·가운데 클릭처럼 click 대신
      // auxclick이 뜨는 묶음은 아래 click 리스너가 예약을 지울 기회가 없어, 지우지 않으면 다음
      // 왼쪽 클릭(전혀 다른 자리)에서 옛 요소가 되살아나 눌린다.
      pendingPressExecute = null;
      if (event.button !== 0 || !event.isPrimary) {
        // 왼쪽 버튼·주 포인터가 아니면 도우미는 관여하지 않는다 — 사이트 자신의 오른쪽 클릭
        // 메뉴·가운데 클릭 등을 그대로 둔다(삼키면 그 기능이 깨진다).
        pressSwallowed = false;
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
        const result = handler({ x: event.clientX, y: event.clientY });
        if (result) {
          pressSwallowed = true;
          pendingPressExecute = typeof result === 'function' ? result : null;
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
  // CR-07: 터치·펜 묶음이 click 없이 pointercancel로 끝나는 경우(스크롤로 취소되는 등)도 옛
  // 예약을 남기지 않는다.
  window.addEventListener(
    'pointercancel',
    (event) => {
      if (!event.isTrusted || !isHelperEnabled()) {
        return;
      }
      pendingPressExecute = null;
    },
    { capture: true, signal },
  );
  window.addEventListener(
    'click',
    (event) => {
      swallowIfPressRejected(event);
      // 누름 묶음이 끝났다(뗌 뒤 누르기, D-13) — 도우미가 대신 누르기로 받아들인 경우에만
      // 처리기에 "실행" 신호를 준다(필터가 거절한 묶음은 실행하지 않는다).
      if (event.isTrusted && isHelperEnabled() && pendingPressExecute) {
        const execute = pendingPressExecute;
        pendingPressExecute = null;
        execute();
      }
    },
    { capture: true, signal },
  );

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

  // Task 3(01-18, KEY-01): 한글 조합 입력 시작은 "나옴" 상태에서도 입력으로 돌아가는 신호로
  // 본다 — beforeinput 취소로는 조합 입력을 막을 수 없어(IME가 텍스트를 직접 넣는다), 표시와
  // 실제 입력이 어긋나지 않게 그 전에 되돌린다.
  window.addEventListener(
    'compositionstart',
    (event) => {
      if (!event.isTrusted || !isHelperEnabled()) {
        return;
      }
      if (isEscapedFromDocumentEditor()) {
        resumeDocumentEditor();
        setMode(currentMode());
        onModeChange?.();
      }
    },
    { capture: true, signal },
  );

  // Task 3(01-18, KEY-01): "나옴" 상태인 동안 문서 전체 편집기의 실제 편집(글자·삭제·줄바꿈·
  // 붙여넣기 등)을 막는다 — 모드 표시가 도우미인데 글자가 조용히 들어가는 일이 없게 한다.
  window.addEventListener(
    'beforeinput',
    (event) => {
      if (!event.isTrusted || !isHelperEnabled()) {
        return;
      }
      if (isEscapedFromDocumentEditor()) {
        event.preventDefault();
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

  signal.addEventListener('abort', () => {
    if (modalTickInterval !== null) {
      clearInterval(modalTickInterval);
      modalTickInterval = null;
    }
  });

  return {
    onKey(handler) {
      keyHandlers.push(handler);
    },
    onPress(handler) {
      pressHandlers.push(handler);
    },
    setModal(handler) {
      modalHandler = handler;
      if (modalTickInterval !== null) {
        clearInterval(modalTickInterval);
        modalTickInterval = null;
      }
      if (handler) {
        modalTickInterval = setInterval(() => {
          handler({ type: 'tick', t: performance.now() });
        }, MODAL_TICK_INTERVAL_MS);
      }
    },
  };
}
