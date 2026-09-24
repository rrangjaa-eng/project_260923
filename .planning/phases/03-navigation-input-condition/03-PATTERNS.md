# Phase 3: 이동·입력·컨디션 - Pattern Map

**Mapped:** 2026-09-24
**Files analyzed:** RESEARCH.md "Recommended Project Structure" 전체(신규 파일) + `settings-schema.ts`(확장 대상)
**Analogs found:** 전부 있음(Phase 1이 이미 실행됨) — 새 아키텍처 패턴 없음, 전부 기존 파일의 "한 번 더"

이 phase는 Phase 1(01-01~01-12 실행 완료, `git ls-files src/` 확인)이 만든 4계층 위에 슬롯을 채우는 작업이다. 모든 분석 대상 파일이 `git ls-files`로 추적됨(gitignore 미러 없음). Phase 1 계획 13~16(01-13~01-16-PLAN.md)은 아직 실행 전이므로, 그 계획들이 만들 파일(사이트별 disabled, 8KB 제한, migrate() 골격, --overlay-scale)은 코드가 아니라 해당 PLAN.md를 analog로 인용한다.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/core/palette.ts` | utility(순수 로직) | transform | `src/core/settings-schema.ts`(리터럴 슬롯 정의) + `src/core/danger.ts`(순수 판별 함수 스타일) | role-match |
| `src/page/overlay/palette.ts` | component(오버레이 렌더) | event-driven | `src/page/overlay/hints.ts`(카드 격자) | exact |
| `src/core/auto-hint-cycle.ts` | utility(상태 기계) | transform | `src/core/dwell-timer.ts` | exact |
| `src/core/undo-stack.ts` | utility(순수 스택) | transform | `src/core/dwell-timer.ts`(순수 상태 보관 구조 스타일) | role-match |
| `src/core/sensitive.ts` | utility(순수 판별) | transform | `src/core/danger.ts` | exact |
| `src/core/settings-schema.ts`(확장, v2) | model/config | CRUD | 자기 자신(v1) | exact |
| `src/page/scroll/scroll-target.ts` | utility(DOM 탐색) | transform | `src/core/frame-tree.ts`(좌표·트리 순회 스타일, 단 이건 DOM 직접 탐색이라 실제로는 `src/page/collector/collector.ts`가 더 가까운 "DOM 순회 유틸") | role-match |
| `src/page/overlay/form-overlay.ts` | component(오버레이 렌더) | request-response | `src/page/overlay/confirm-dialog.ts`(모달형 전체 화면 오버레이) | role-match |
| `src/page/overlay/input-reduce.ts` | component(오버레이 렌더) | event-driven | `src/page/overlay/hints.ts`(칸 옆 카드 격자) | exact |
| `src/page/input/fill-value.ts` | utility(DOM 조작) | transform | 없음(신규 유형) — `src/page/click/press.ts`의 "합성 이벤트 디스패치" 스타일만 참고 | no analog(신규 유형) |
| `src/worker/nav-mark.ts` | service(SW 저장) | event-driven | `src/worker/storage-writer.ts`(enqueue 패턴은 아니지만 SW 단일 소유 저장) | role-match |
| `src/worker/storage-writer.ts`(확장) | service | CRUD | 자기 자신 | exact |
| `src/worker/relay.ts`(확장, palette/form/scroll/nav 메시지 추가) | service(라우팅) | pub-sub | 자기 자신(hints/confirm 라우팅 부분) | exact |
| `src/shared/messages.ts`(확장) | contract | — | 자기 자신 | exact |
| `src/entrypoints/content.ts`(확장: Esc 우선순위, ↑↓, Alt+1~9 등록) | controller | event-driven | 자기 자신(기존 핸들러 체인) | exact |
| `src/entrypoints/background.ts`(확장: onInstalled 분기, nav/goBack) | service worker entry | event-driven | 자기 자신 | exact |
| `src/entrypoints/options/index.html`, `main.ts` | extension page | request-response | `src/entrypoints/popup/index.html`, `main.ts` | role-match |
| `src/entrypoints/onboarding/index.html`, `main.ts` | extension page | request-response | `src/entrypoints/popup/main.ts`(storage.onChanged 구독 구조) | role-match |
| `tests/practice-site/scroll-areas.html`, `form-long.html`, `sensitive.html`, `navigate.html`, `controlled-input.html` | test fixture | static | `tests/practice-site/frames.html`(중첩 iframe·스크롤 박스 구조) | exact |
| `tests/unit/sensitive.spec.ts` | test | — | 기존 `tests/unit/danger.spec.ts` 스타일(파일 미확인이나 `core/danger.ts` 대응 단위 시험 관례) | role-match |
| `tests/unit/settings-schema-migrate.spec.ts` | test | — | 01-14-PLAN.md가 정의한 migrate() 실패 보존 시험 패턴 | role-match(계획 참조) |

## Pattern Assignments

### `src/core/palette.ts` (utility, transform)

**Analog:** `src/core/settings-schema.ts`(리터럴 유니온 정의 스타일) + `src/core/danger.ts`(순수 함수, document/chrome 미참조 원칙)

**리터럴 정의 패턴** (`src/core/settings-schema.ts:71-89`, pins의 `number` 리터럴 유니온):
```ts
number: z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
  z.literal(6), z.literal(7), z.literal(8), z.literal(9),
]),
```
명령판 고정 슬롯(D-06)도 같은 방식으로 1~9 리터럴을 쓴다(RESEARCH.md Pattern 1의 `DEFAULT_PALETTE_SLOTS` 예시가 이미 이 스타일을 따름).

**순수 함수 원칙** (`src/core/danger.ts:1-3` 주석 그대로):
```ts
// 순수 함수 — document·window·chrome 참조 없음.
```
`palette.ts`도 이 원칙을 지킨다: 슬롯 맵 zod 검사, 장(chapter) 나누기, "다음 슬롯 계산"은 전부 순수 함수로 만들고 렌더링은 `page/overlay/palette.ts`에 둔다(core/page 분리는 Phase 1 4계층의 핵심 규약).

---

### `src/page/overlay/palette.ts` (component, event-driven)

**Analog:** `src/page/overlay/hints.ts` (전체 파일, 174줄)

**Shadow root 재사용 패턴** (`src/page/overlay/hints.ts:1, 110-119`):
```ts
import { ensureOverlayRoot } from '@/page/overlay/mode-indicator';
...
function ensureHintsElement(): HTMLDivElement {
  const root = ensureOverlayRoot();
  ensureStyle(root);
  if (!hintsElement?.isConnected) {
    hintsElement = document.createElement('div');
    hintsElement.className = HINTS_CLASS;
    root.append(hintsElement);
  }
  return hintsElement;
}
```
명령판도 같은 `ensureOverlayRoot()`를 이어 쓴다(SYSTEM.md 등대 원칙 — 오버레이 루트가 여러 개면 z-index 경합).

**스타일 1회 주입 패턴** (`hints.ts:22-26`, `confirm-dialog.ts:38-42`): `styleInjected` 불리언 가드로 `<style>` 태그를 root에 한 번만 append. 토큰만 참조(`var(--accent)`, `var(--radius-label)` 등) — 새 색상 리터럴 금지(D-36).

**카드 격자 렌더 패턴** (`hints.ts:121-147`, `showHints`): 배열을 받아 `container.textContent = ''`로 지운 뒤 매번 새로 그린다. 명령판 카드 격자(3열, D-05)도 이 방식을 그대로 따라 "장(chapter) 배열 → DOM 재생성"으로 구현.

**"다음 번호" 류 고정 카드** (`hints.ts:156-174`, `showNextCard`): 우하단 고정 카드 + 키 칩(`NEXT_CARD_KEY_CLASS`) 패턴. 명령판의 "다음 장(9)"·"9개 넘으면 0→다음 번호"(D-11) 카드가 이 패턴의 재사용 대상.

---

### `src/page/overlay/form-overlay.ts` (component, request-response)

**Analog:** `src/page/overlay/confirm-dialog.ts` (전체 파일, 252줄) — 전체 화면을 덮는 모달형 오버레이의 유일한 기존 예시.

**전체 화면 덮기 + 카드 레이아웃** (`confirm-dialog.ts:44-65`):
```css
.confirm-scrim { position: fixed; inset: 0; background: var(--scrim); pointer-events: auto; }
.confirm-dialog {
  position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: var(--dialog-width); ... opacity: 0; transition: opacity var(--motion-appear);
}
.confirm-dialog[data-visible="true"] { opacity: 1; }
```
양식 한 장 보기는 중앙 카드가 아니라 전체 화면 스크롤 목록이므로 `position: fixed; inset: 0;`에 `overflow-y: auto`를 더한 변형으로 이 구조를 따른다.

**열기/닫기 수명주기 패턴** (`confirm-dialog.ts:147-252`, `openConfirm`/`closeConfirm`): 매 open 시 `closeConfirm()`부터 호출해 중복 인스턴스를 막고, `requestAnimationFrame`으로 `data-visible` 토글해 트랜지션을 보장. `form-overlay.ts`도 `openFormOverlay()`/`closeFormOverlay()` 쌍으로 동일 구조를 쓴다.

**Esc만으로 닫기, 클릭 리스너 없음** (`confirm-dialog.ts:191, 212-220` 주석 "T-01-25: 확인 버튼에는 클릭 리스너를 달지 않는다"): 양식 한 장 보기도 D-22("제출 버튼은 이 화면에 두지 않는다")를 지키려면 이 원칙(포인터가 아니라 트러스티드 키로만 상태 전이)을 그대로 가져와 Esc 키 핸들러만 등록한다.

---

### `src/page/overlay/input-reduce.ts` (component, event-driven)

**Analog:** `src/page/overlay/hints.ts`(카드 격자 렌더링 그대로 재사용 가능한 가장 가까운 예시)

입력 줄이기 카드(최근 값+문구, Alt+1~9)는 `showHints()`와 동일하게 "숫자 라벨 배열 → 절대 위치 카드"로 그리되, 위치 기준이 화면 좌표가 아니라 포커스된 입력칸 근처(요소의 `getBoundingClientRect()` 기준 상대 배치)라는 점만 다르다. 스타일 주입·1회 가드 패턴은 `hints.ts:22-26`과 동일하게 따른다.

---

### `src/core/auto-hint-cycle.ts` (utility, transform)

**Analog:** `src/core/dwell-timer.ts` (전체 파일, 50줄) — 상태 기계 순수 함수의 정확한 템플릿.

```ts
export function createDwellTimer({ dwellMs }: { dwellMs: number }): DwellTimer {
  let trackedTargetId: string | null = null;
  let startedAt = 0;
  let fired = false;
  return {
    update({ targetId, danger, t }) {
      if (targetId !== trackedTargetId) { trackedTargetId = targetId; startedAt = t; fired = false; }
      if (targetId === null || danger) { return { progress: 0, fire: false }; }
      ...
    },
  };
}
```
`createAutoHintCycle({ autoCycleMs })`도 같은 클로저 상태(현재 인덱스, 다음 전환 시각) + `update(t)` 시그니처를 그대로 복제한다. "danger 대상은 발사하지 않는다"는 원칙(`dwell-timer.ts:4`)도 재사용 — 자동 순서 강조가 위험 요소에 멈췄을 때 아무 키나 눌러도 즉시 선택되지 않고 확인 화면으로 가야 하므로, `fire` 신호를 danger 여부와 분리해서 다루는 이 파일의 설계를 그대로 따른다.

---

### `src/core/sensitive.ts` (utility, transform)

**Analog:** `src/core/danger.ts` (전체 파일, 18줄) — 이름·라벨 텍스트에 단어 목록을 매칭하는 순수 함수의 정확한 템플릿.

```ts
function stripSpaces(text: string): string {
  return text.replace(/\s+/g, '');
}
export function isDanger(name: string, words: readonly string[]): boolean {
  const strippedName = stripSpaces(name);
  if (!strippedName || words.length === 0) { return false; }
  return words.some((word) => {
    const strippedWord = stripSpaces(word);
    return strippedWord.length > 0 && strippedName.includes(strippedWord);
  });
}
```
`isSensitive()`는 `stripSpaces`를 그대로 import(중복 정의 금지 — `danger.ts`에서 export하도록 확장하거나 공유 유틸로 승격)해 같은 "공백 무시 포함 검사"를 쓴다. "한 곳의 판별 함수"(D-26) 요구는 이 파일이 `danger.ts`와 나란히 `src/core/`에 있어야 Phase 4·6이 같은 계층에서 import할 수 있다는 뜻 — `page/`나 `worker/`에 두지 않는다.

---

### `src/core/settings-schema.ts` (model, CRUD) — v1 → v2 확장

**Analog:** 자기 자신(현재 v1, 114줄 전체)

**현재 v1 골격**:
```ts
export const CURRENT_SCHEMA_VERSION = 1;
...
const SettingsDataSchema = z.object({
  enabled: z.boolean(),
  keymap: z.object({ press: z.string(), confirm: z.string(), cancel: z.string(), toggleHints: z.string() }),
  tremorIntervalMs: z.number(),
  ...
  dangerWords: z.array(z.string()),
});
export const SettingsV1 = z.object({ schemaVersion: z.literal(1), data: SettingsDataSchema });
export function defaultSettings(): SettingsV1 { ... }
```
v2는 `SettingsDataSchema.extend({...})`로 `conditions`(good/hard), `paletteSlots`, `phrases`, `sensitiveOverrides`, `sensitiveWordLists`, `siteDangerWords`를 추가하고 `SettingsV2`, `CURRENT_SCHEMA_VERSION = 2`로 올린다(RESEARCH.md Pattern 9 코드 예시 그대로). **주의:** 01-14-PLAN.md가 `migrate()` 함수와 `migrations: Record<number, ...>` 골격을 처음 도입하는 계획이므로(아직 미실행), Phase 3 플랜은 이 파일의 **현재 코드가 아니라 01-14-PLAN.md의 `migrate()` 시그니처**를 analog로 삼아 `migrations[1]`을 채워야 한다.

`siteKey()` 헬퍼(`settings-schema.ts:67-69`)와 `SiteEntryV1`(71-95, 사이트별 sync 항목 8KB 분할 구조)은 Phase 3의 `paletteSlots`(사이트마다 다를 수 있는지는 D-06상 전역으로 보임 — 단, `sensitiveOverrides`·`siteDangerWords`·`phrases`는 사이트별이므로 이 구조를 그대로 재사용해야 한다).

---

### `src/worker/storage-writer.ts` (service, CRUD) — 확장

**Analog:** 자기 자신(현재 137줄 전체)

**단일 저장자 + enqueue 순서 보장 패턴** (`storage-writer.ts:32-43`):
```ts
export function createStorageWriter(): StorageWriter {
  let queue: Promise<unknown> = Promise.resolve();
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task);
    queue = result.then(() => undefined, () => undefined);
    return result;
  }
  return { ... };
}
```
새 op(`updateCondition`, `savePhrase`, `setSensitiveOverride`, `importSettingsFile` 등)는 전부 이 `enqueue()` 래퍼 안에서 실행해야 순서가 보장된다(D-03 "단일 저장자가 순서대로").

**읽기→검사→patch→재검사→쓰기 패턴** (`storage-writer.ts:64-83`, `updateSettings`):
```ts
updateSettings(patch) {
  return enqueue(async () => {
    const existing = await chrome.storage.sync.get(SETTINGS_KEY);
    const parsed = SettingsV1.safeParse(existing[SETTINGS_KEY]);
    if (!parsed.success) { return { ok: false, reason: 'invalid-settings' }; }
    const next = { ...parsed.data, data: { ...parsed.data.data, ...patch } };
    const nextParsed = SettingsV1.safeParse(next);
    if (!nextParsed.success) { return { ok: false, reason: 'invalid-patch' }; }
    await chrome.storage.sync.set({ [SETTINGS_KEY]: nextParsed.data });
    return { ok: true };
  });
},
```
컨디션 전환·키 배치 변경·민감칸 오버라이드 저장 모두 이 "실패 시 원본 보존"(D-25/D-33 계승) 패턴을 그대로 복제한다 — `SettingsV1`을 `SettingsV2`로 바꾸는 것 외에 구조 변경 없음.

**origin 검증 패턴** (`storage-writer.ts:96-102`, `recordPress`): "요청 origin이 실제로 보낸 프레임의 origin과 같을 때만 기록"하는 이 패턴이 최근 입력 값 기록(`undo-stack`/최근값 storage op)에도 그대로 적용되어야 한다(사이트+칸 이름 키가 다른 사이트에서 위조되지 않도록).

---

### `src/worker/relay.ts` / `src/shared/messages.ts` (contract, pub-sub) — 확장

**Analog:** 자기 자신의 hints/confirm 메시지 쌍

**판별 유니온 확장 패턴** (`messages.ts:152-166`):
```ts
export const Message = z.discriminatedUnion('type', [
  StorageRequestMessage, FrameStateMessage, FrameReportMessage, FramesReportsMessage,
  HintsPressMessage, PressRequestMessage, HintsStateMessage, FrameRefreshMessage,
  HintsKeyMessage, ModeReportMessage, ConfirmStateMessage, ConfirmKeyMessage,
]);
```
새 메시지(`palette/state`, `palette/key`, `scroll/request`, `form/collect`, `form/fields`, `form/fill`, `nav/markPress`, `nav/query`, `nav/goBack`)는 각각 `HintsStateMessage`/`HintsKeyMessage`/`ConfirmKeyMessage`와 완전히 같은 zod 객체 모양으로 이 유니온 배열에 추가한다.

**"맨 위(frameId 0)만 허용" 라우팅 규약** (`messages.ts:44-51` 주석, `ConfirmStateMessage:135-140` 주석): `sender.frameId === 0`일 때만 relay가 받는 메시지(`palette/state`가 이 규약), 프레임별 라우팅이 필요한 메시지(`{ frameId }` 옵션, `PressRequestMessage:60-64`)의 두 갈래를 그대로 따른다 — 새 라우팅 방식을 만들지 않는다.

**저장 op 확장 패턴** (`messages.ts:97-123`, `SetEnabledOp`/`UpdateSettingsOp`/`RecordPressOp` → `StorageRequestOp` discriminated union): 새 storage op(`updateCondition`, `savePhrase`, `setSensitiveOverride`)도 이 union에 `.strict()` zod 객체로 추가.

---

### `src/entrypoints/content.ts` (controller, event-driven) — Esc 우선순위 삽입

**Analog:** 자기 자신(기존 핸들러 체인, pipeline.ts의 keyHandlers 배열 소비자)

**핸들러 체인 = 등록 순서가 우선순위** (`pipeline.ts:114-123`):
```ts
for (const handler of keyHandlers) {
  if (handler({ code: event.code })) {
    swallowedKeyCodes.add(event.code);
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
}
```
`content.ts`가 `inputPipeline.onKey(...)`를 부르는 순서 그대로 RESEARCH.md Pattern 3의 Esc 우선순위 7단계(확인 화면 → 명령판 → 입력칸 → 끌기 → 번호표 → 헬퍼발 되돌리기 → 통과)가 정해진다. 새 핸들러(명령판, 되돌리기)는 기존 등록 순서 앞뒤 중 어디에 넣을지가 곧 우선순위 결정이므로, 계획에서 "몇 번째 `onKey` 호출로 등록하는지"를 명시해야 한다.

**모달 재사용** (`pipeline.ts:15-21, 269-280`, `ModalHandler`/`setModal`): 확인 화면이 이미 이 계약을 구현했으므로(주석 "확인 화면 모달... isTrusted keydown·keyup·keypress를 모두 삼키고") 명령판도 같은 `setModal()` 후킹 포인트를 쓴다 — `tick` 이벤트(100ms마다, `MODAL_TICK_INTERVAL_MS`)는 명령판이 필요 없으면 핸들러에서 무시하면 된다.

---

### `src/entrypoints/popup/main.ts` → `src/entrypoints/options/`, `src/entrypoints/onboarding/` (extension page)

**Analog:** `src/entrypoints/popup/index.html`, `src/entrypoints/popup/main.ts` (전체 218줄)

옵션 페이지·온보딩 페이지는 popup과 마찬가지로 **Shadow DOM 없이** 확장 자체 페이지이므로, `main.ts`가 `chrome.storage.onChanged`를 구독해 화면을 갱신하는 구조(popup이 이미 구현)를 그대로 이식한다. WXT 파일 기반 라우팅 규칙도 `popup/index.html` 배치와 동일한 방식(`entrypoints/options/index.html`, `entrypoints/onboarding/index.html`)을 따른다.

---

### `tests/practice-site/*.html` (신규 5개)

**Analog:** `tests/practice-site/frames.html`(존재 확인, `#scroll-box` 중첩 스크롤 영역 포함 — RESEARCH.md Pattern 2가 이 파일의 45-53행을 인용)

새 픽스처(`scroll-areas.html`, `form-long.html`, `sensitive.html`, `navigate.html`, `controlled-input.html`)는 `frames.html`의 iframe 중첩 구성(`frame-same`/`frame-nest`/`frame-cross`)을 그대로 재사용하거나 참조해 만든다(D-39가 iframe 안 양식·스크롤 영역을 요구).

## Shared Patterns

### Shadow DOM 오버레이 루트
**Source:** `src/page/overlay/mode-indicator.ts:27`(`ensureOverlayRoot`)
**Apply to:** `palette.ts`, `form-overlay.ts`, `input-reduce.ts` (오버레이 렌더링 전부)
모든 새 오버레이는 새 shadow root를 만들지 않고 이 함수가 반환하는 root에 append한다. 스타일 1회 주입 가드(`styleInjected` 불리언)도 각 렌더 모듈이 독립적으로 갖되 패턴은 동일하게 복제한다(hints.ts, confirm-dialog.ts 모두 이 방식).

### 순수 함수 4계층 분리
**Source:** `src/core/danger.ts`, `src/core/dwell-timer.ts`(둘 다 "document·window·chrome 참조 없음" 명시)
**Apply to:** `core/palette.ts`, `core/sensitive.ts`, `core/auto-hint-cycle.ts`, `core/undo-stack.ts`
core/ 계층은 DOM·확장 API를 참조하지 않는다. DOM에서 값을 뽑아 core 함수에 넘기는 "어댑터" 역할은 page/ 계층(`collector.ts`류)이 맡는다 — RESEARCH.md Pattern 6의 `SensitiveInput`이 DOM 요소가 아니라 순수 값 객체인 이유가 이 분리 원칙.

### 모달 후킹(`inputPipeline.setModal`)
**Source:** `src/page/input/pipeline.ts:27-31, 269-280`, 사용례 `confirm-dialog.ts`
**Apply to:** 명령판(`palette.ts`), 위험 확인(자동 순서 강조에서도 재사용)
새 window capture 리스너 세트를 만들지 않는다. 모달이 하나만 열릴 수 있다는 전제(D-19 "확인 화면은 한 군데에서만")가 이미 구현돼 있으므로, 명령판과 확인 화면이 동시에 열리지 않도록 상태를 배타적으로 관리해야 한다(RESEARCH.md Pitfall 1).

### 단일 저장자 + enqueue
**Source:** `src/worker/storage-writer.ts:32-43`
**Apply to:** 컨디션 저장, 문구 CRUD, 민감칸 오버라이드, 설정 파일 가져오기, nav-mark
`chrome.storage.*.set` 호출은 `storage-writer.ts`(및 신설 `nav-mark.ts`, 단 이건 `storage.session`이라 별도 소유자를 둘 수 있음 — RESEARCH.md는 nav-mark를 별 파일로 분리했으므로 이 부분만 단일 저장자 원칙의 예외적 분리 대상)에만 둔다.

### 메시지 판별 유니온 + sender 검증
**Source:** `src/shared/messages.ts` 전체, `src/worker/relay.ts`(frameId 0 검증)
**Apply to:** palette/*, form/*, scroll/*, nav/* 신규 메시지 전부
`z.discriminatedUnion('type', [...])`에 추가하고, `sender.id === chrome.runtime.id` 확인은 기존 background.ts 로직을 그대로 통과시킨다(새 검증 로직 추가 불필요).

### 실패 시 원본 보존
**Source:** `src/worker/storage-writer.ts:48-53, 68-71, 75-78, 87-91`("검사 실패 — 아무것도 쓰지 않는다")
**Apply to:** 설정 파일 가져오기(STOR-04), migrations[1](v1→v2 변환), 사이트별 오버라이드 저장
zod `safeParse` 실패 시 항상 `{ ok: false, reason: ... }`를 반환하고 `chrome.storage.*.set`을 호출하지 않는다 — 새 실패 처리 방식을 발명하지 않는다.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/page/input/fill-value.ts` | utility | transform | Phase 1에 "네이티브 setter로 값 채우기" 계열 코드가 없음(Phase 1은 도우미가 값을 채우는 기능 자체가 없었음, INPT는 Phase 3 신규 요구). RESEARCH.md Pattern 4의 코드 예시(`nativeSetter`, `fillValue`)를 기준으로 신규 작성 — `src/page/click/press.ts`의 "합성 이벤트 디스패치" 스타일(트러스티드 아닌 이벤트를 직접 만들어 디스패치하는 관례)만 참고 |
| `src/worker/nav-mark.ts` | service | event-driven | `chrome.storage.session`을 코드에서 처음 쓴다(Pitfall 2에 명시) — `storage-writer.ts`의 enqueue 패턴과는 다른, TTL 기반 1회 소비 저장이라 새 파일로 분리 권장. RESEARCH.md Pattern 3의 의사코드가 유일한 참고 자료 |

## Metadata

**Analog search scope:** `git ls-files src/` 전체(28개 추적 파일), `tests/practice-site/frames.html`, `.planning/phases/01-click-helper-foundation/01-13-PLAN.md`~`01-16-PLAN.md`(미실행분 참조)
**Files scanned:** `src/core/{settings-schema,danger,dwell-timer}.ts`, `src/page/overlay/{hints,confirm-dialog,mode-indicator}.ts`, `src/page/input/pipeline.ts`, `src/worker/{storage-writer,relay}.ts`, `src/shared/messages.ts`, `src/entrypoints/{content,popup/main}.ts`, `src/core/frame-tree.ts`
**Pattern extraction date:** 2026-09-24
