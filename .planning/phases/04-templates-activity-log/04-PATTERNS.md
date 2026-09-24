# Phase 4: 틀 자동화 + 활동 기록 - Pattern Map

**Mapped:** 2026-09-24
**Files analyzed:** 04-CONTEXT.md(도메인·결정)에서 뽑은 새/수정 파일 전체. 04-RESEARCH.md는 이 작업 시점에 아직 저장소에 없어(병렬 작성 중) 참조하지 못했다 — 파일 목록은 CONTEXT.md의 결정(D-01~D-42)과 Phase 1 실제 코드, Phase 3 가정(PR #9)에서 도출했다. 계획자는 RESEARCH.md가 이 목록과 다른 파일 이름을 쓰면 그쪽을 따른다.
**Analogs found:** 대부분 role-match/exact(Phase 1이 이미 있는 4계층 위에 얹는 작업). 신규 유형(제출 감시·재탐색·활동 기록)은 "no analog(신규 유형)"로 표시하고 가장 가까운 스타일 참고만 남긴다.

이 phase는 Phase 1(실행 중, 12/16 완료, 커밋 `f468b6e`)이 만든 4계층(core/page/worker/shared, entrypoints) 위에 슬롯을 채운다. 분석 대상 파일은 `git ls-files src/`로 추적됨(gitignore 미러 없음) 확인. Phase 3는 이 브랜치에 없으므로(`origin/claude/phase3-plans-ng6f32`에서만 읽음) 그 파일들은 "가정(Phase 3)"으로 표시하고, 실제 analog는 03-PATTERNS.md의 해당 항목 + Phase 1의 대응 파일을 함께 가리킨다.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/core/template-schema.ts` | model/config | CRUD | `src/core/settings-schema.ts`(zod 스키마 + schemaVersion + defaults) | exact |
| `src/core/step-recorder.ts` | utility(순수 상태 누적) | event-driven→transform | `src/core/dwell-timer.ts`(클로저 상태 기계) | role-match |
| `src/core/variable-shape.ts` | utility(순수 판별) | transform | `src/core/danger.ts`(순수 문자열 판별 함수) | role-match |
| `src/core/submit-word.ts` | utility(순수 판별) | transform | `src/core/danger.ts`(단어 목록 매칭, 그대로 구조 복제) | exact |
| `src/core/blocking-screen.ts` (보안 키패드·자동입력 방지 문자·결제 화면 판별) | utility(순수 판별) | transform | `src/core/danger.ts` | role-match |
| `src/core/run-state.ts` | utility(순수 상태 기계) | event-driven→transform | `src/core/dwell-timer.ts` | role-match |
| `src/core/dialog-policy.ts` | utility(순수 정책) | transform | `src/core/danger.ts`(순수 판별) — 신규 유형(시간창 안 첫 창만 통과) | no analog(신규 유형), danger.ts 스타일 참고 |
| `src/core/element-refind.ts` | utility(순수 스코어링) | transform | `src/core/fingerprint.ts`(`matchScore`) | exact |
| `src/core/activity-log.ts` (마스킹·정리·하루 상한) | utility(순수 변환) | transform, batch | `src/core/danger.ts`(마스킹은 신규) + `src/core/settings-schema.ts`(하루 단위 키 구조는 `pressesKey`/`siteKey` 패턴) | role-match |
| `src/core/weekly-stats.ts` | utility(순수 집계) | batch | 없음(신규 집계 유형) — `src/core/activity-log.ts`의 하루 항목 순회 스타일만 참고 | no analog(신규 유형) |
| `src/page/recorder/recorder.ts` | content script 모듈(수집) | event-driven | `src/page/collector/collector.ts`(DOM 이벤트→구조화 항목, MutationObserver rAF 합치기) | role-match |
| `src/page/recorder/step-executor.ts` | content script 모듈(실행) | request-response | `src/page/click/press.ts`(합성 이벤트) + `src/page/input/fill-value.ts`(가정, Phase 3) | role-match |
| `src/page/overlay/template-save.ts` (틀 저장 화면) | component(오버레이) | request-response | `src/page/overlay/confirm-dialog.ts`(전체 화면 모달) | role-match |
| `src/page/overlay/value-cards.ts` (바뀌는 값 후보 카드) | component(오버레이) | event-driven | `src/page/overlay/hints.ts`(번호 카드 격자) | exact |
| `src/page/overlay/template-list.ts` | component(오버레이) | event-driven | `src/page/overlay/hints.ts` | exact |
| `src/page/overlay/run-progress.ts` (진행 막대 + N/M 단계) | component(오버레이) | event-driven | `src/page/overlay/mode-indicator.ts`(상태 표시 갱신 패턴) | role-match |
| `src/page/overlay/blocked-card.ts` (`--warning` 막힘/확인 필요 카드) | component(오버레이) | event-driven | `src/page/overlay/confirm-dialog.ts`(카드+버튼+키 칩 구조, 단 danger 대신 warning 톤) | role-match |
| `src/page/overlay/dialog-text.ts` (알림 창 글 보여주기) | component(오버레이) | event-driven | `src/page/overlay/confirm-dialog.ts` | role-match |
| `src/page/main-world/dialog-watcher.ts` | main-world entrypoint | event-driven | 없음(신규 world) — `src/entrypoints/content.ts`의 등록/필터 스타일만 참고 | no analog(신규 유형) |
| `src/worker/run-orchestrator.ts` | service(SW 조정자) | event-driven, request-response | `src/worker/relay.ts`(SW가 여러 프레임 상태를 모아 조정) | role-match |
| `src/worker/storage-writer.ts`(확장: template CRUD, run-state, press-record, activity-log append/prune) | service | CRUD | 자기 자신(현재 137줄) | exact |
| `src/worker/relay.ts`(확장: template/run 메시지 라우팅) | service(라우팅) | pub-sub | 자기 자신 | exact |
| `src/shared/messages.ts`(확장: template/run/dialog/log 메시지 유니온) | contract | — | 자기 자신 | exact |
| `src/entrypoints/content.ts`(확장: 기록기·실행기 등록, Esc/←→ 우선순위) | controller | event-driven | 자기 자신(핸들러 체인) | exact |
| `src/entrypoints/dialog-watcher.content.ts`(WXT main world, `document_start`, 모든 프레임) | content script entry | event-driven | `src/entrypoints/content.ts`(entrypoint 등록 스타일) — world:'MAIN' + matches 전부인 것은 신규 | role-match |
| `src/entrypoints/background.ts`(확장: run-orchestrator 연결, onUpdateAvailable 지연) | service worker entry | event-driven | 자기 자신 | exact |
| `src/entrypoints/options/`(가정, Phase 3) 확장: 틀 목록 관리, 로그 내보내기 섹션 | extension page | request-response | Phase 3 03-PATTERNS.md `src/entrypoints/options/` 항목(analog: `src/entrypoints/popup/main.ts`) — **가정(Phase 3)** | role-match(가정) |
| `tests/practice-site/workflow.html`, `workflow-result.html` (메뉴→양식→제출→결과) | test fixture | static | `tests/practice-site/input.html`(양식 칸 구성) + `tests/practice-site/frames.html`(흐름 구조) | role-match |
| `tests/practice-site/workflow-frame.html` (iframe 안 양식, 동일/교차 출처) | test fixture | static | `tests/practice-site/frames.html` | exact |
| `tests/practice-site/workflow-slow.html` (늦게 나타나는 입력칸) | test fixture | static | `tests/practice-site/spike.html`(지연·스파이크 시나리오) | role-match |
| `tests/practice-site/workflow-ambiguous.html` (제출 결과 불분명) | test fixture | static | `tests/practice-site/danger.html`(버튼 의미 판별용 픽스처 스타일) | role-match |
| `tests/practice-site/workflow-dialogs.html` (confirm 연쇄 + alert) | test fixture | static | 없음(신규) — `tests/practice-site/danger.html` 구조만 참고 | no analog(신규 유형) |
| `tests/practice-site/blocking-screens.html` (보안 키패드·캡차·결제 흉내) | test fixture | static | 없음(신규) | no analog(신규 유형) |
| `tests/e2e/fixtures.ts`(확장: SW 강제 재우기 헬퍼, extensionId로 SW 얻기) | test fixture(Playwright) | — | 자기 자신 | exact |
| `tests/unit/template-schema.test.ts`, `element-refind.test.ts`, `submit-word.test.ts`, `blocking-screen.test.ts`, `run-state.test.ts`, `dialog-policy.test.ts`, `activity-log.test.ts`, `weekly-stats.test.ts` | test | — | `tests/unit/danger.test.ts`, `tests/unit/dwell-timer.test.ts` 스타일 | role-match |

## Pattern Assignments

### `src/core/template-schema.ts` (model, CRUD)

**Analog:** `src/core/settings-schema.ts`(전체 115줄)

**schemaVersion + zod + defaults 패턴** (`settings-schema.ts:3-4, 38-42, 91-95, 110-114`):
```ts
export const CURRENT_SCHEMA_VERSION = 1;
...
export const SettingsV1 = z.object({
  schemaVersion: z.literal(1),
  data: SettingsDataSchema,
});
export type SettingsV1 = z.infer<typeof SettingsV1>;
```
`TemplateV1`(D-03 저장 데이터에도 형식 버전)도 같은 `z.object({ schemaVersion: z.literal(1), data: ... })` 구조를 쓴다. `PressesV1`(D-16 "누름" 기록, `pressesKey(origin)` 스타일)은 실행 상태·활동 기록 키 생성 함수(`runStateKey`, `logDayKey(date)`)의 정확한 템플릿:
```ts
export function pressesKey(origin: string): string {
  return `presses:${origin}`;
}
```

**Fingerprint 재사용** (`settings-schema.ts:7-16`): `FingerprintSchema`를 그대로 import해 틀 단계의 요소 식별에 쓴다. D-09가 요구하는 `framePath` + 프레임 주소 확장은 `FingerprintSchema.extend({ frameOrigin: z.string() })` 형태로 새 스키마를 만들거나 필드를 더한다(둘 다 Fingerprint를 쓰는 `pins`·`presses`가 깨지지 않게 별도 `TemplateFingerprintSchema`로 분리하는 쪽을 권장 — Fingerprint는 Phase 1이 이미 4곳에서 참조 중).

---

### `src/core/step-recorder.ts` (utility, event-driven→transform)

**Analog:** `src/core/dwell-timer.ts`(전체 50줄) — 클로저로 상태를 갖는 순수 함수형 "기계" 템플릿.

```ts
export function createDwellTimer({ dwellMs }: { dwellMs: number }): DwellTimer {
  let trackedTargetId: string | null = null;
  ...
  return {
    update({ targetId, danger, t }) { ... },
  };
}
```
`createStepRecorder()`도 같은 방식으로 `steps: Step[]`을 클로저에 두고 `addClickStep(fingerprint)`/`addInputStep(fingerprint, valueShape)`/`addNavigateStep(url)`/`toSteps()` 같은 메서드를 반환하는 객체를 만든다. "순수 함수 — document·window·chrome 참조 없음" 원칙(`dwell-timer.ts:4`, `danger.ts:1-3`)을 그대로 지킨다 — DOM에서 값을 뽑는 것은 `page/recorder/recorder.ts`가 맡고, `step-recorder.ts`는 이미 뽑힌 Fingerprint/값을 받아 목록으로만 쌓는다.

D-07(같은 칸에 여러 번 입력하면 마지막 값만)은 `dwell-timer.ts`의 "같은 targetId면 상태를 이어감, 다르면 리셋" 로직과 같은 모양 — `addInputStep`이 마지막 단계의 fingerprint와 같으면 새로 push하지 않고 그 단계의 값만 교체한다.

---

### `src/core/element-refind.ts` (utility, transform)

**Analog:** `src/core/fingerprint.ts`(전체 34줄) — 그대로 위에 얹는다, 신규 판정 로직 없음.

```ts
export function matchScore(a: Fingerprint, b: Fingerprint): number {
  if (!sameFramePath(a, b)) { return 0; }
  let score = 0;
  for (const key of COMPARABLE_KEYS) { ... }
  return score;
}
```
D-15 "가장 높은 점수가 기준을 넘고 두 번째와 충분히 차이 날 때만 확실"은 새 함수 하나로 구현: `pickBestMatch(candidates: Fingerprint[], target: Fingerprint, { minScore, minGap }): Fingerprint | null` — 내부에서 `matchScore`를 후보마다 호출해 정렬하고 1등·2등 차이를 비교한다. `matchScore`/`isSameElement`를 재사용(재구현 금지, D-09가 "한 곳" 원칙을 명시하지는 않지만 04-CONTEXT.md D-15가 `matchScore`를 그대로 지목).

---

### `src/core/submit-word.ts` / `src/core/blocking-screen.ts` (utility, transform)

**Analog:** `src/core/danger.ts`(전체 18줄) — 두 파일 모두 이 구조를 그대로 복제.

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
`isSubmitWord(name, words)`는 이 함수와 동일한 시그니처로 D-12 기본 단어(저장·상신·등록·제출·신청·전송)를 검사한다. `stripSpaces`는 Phase 3가 이미 `danger.ts`에서 export하도록 승격하기로 가정했으므로(03-PATTERNS.md `sensitive.ts` 항목), 세 파일(`danger.ts`, `sensitive.ts`, `submit-word.ts`)이 같은 유틸을 공유하는지 확인하고 중복 정의하지 않는다.

`isBlockingScreen(signals)`(보안 키패드·캡차·결제 판별)은 이름 문자열 하나가 아니라 여러 신호(요소 존재·주소 패턴·보이는 글자)를 받으므로 시그니처는 다르지만, "순수 함수, 목록/신호는 바깥에서 주입" 원칙은 동일하게 지킨다.

---

### `src/core/run-state.ts` (utility, 상태 기계)

**Analog:** `src/core/dwell-timer.ts`(상태 기계 템플릿) — 단, run-state는 단계가 많아(대기→진행→제출확인→누름→결과대기→성공/확인필요/막힘) `switch`문 기반 순수 리듀서로 짜는 편이 dwell-timer의 2-상태 모델보다 적합하다. 스타일(클로저 없이 `(state, event) => nextState` 형태의 순수 리듀서)은 dwell-timer와 danger.ts의 "순수 함수, 전역 참조 없음" 원칙만 계승하고 구조는 새로 만든다(no analog(신규 유형)에 가깝지만 원칙은 role-match).

D-24(SW가 잠들었다 깨면 저장된 상태에서 이어감)를 지키려면 이 리듀서는 직렬화 가능한 평범한 객체만 state로 쓴다(클로저 캡처 금지) — `TemplateRunStateV1`(template-schema.ts 또는 별도 run-schema.ts)로 zod 검사 후 `storage.session`에 저장.

---

### `src/core/activity-log.ts` (utility, transform/batch)

**Analog:** `src/core/danger.ts`(마스킹 판별은 새 패턴) + `src/core/settings-schema.ts`(`pressesKey(origin)` 키 생성 패턴을 `logDayKey(date)`로 재사용, D-33 하루 단위 저장).

```ts
export function pressesKey(origin: string): string {
  return `presses:${origin}`;
}
```
D-32(주민·계좌·카드·전화번호 모양 가리기)는 정규식 매칭 배열을 순회해 `***`로 치환하는 순수 함수 `maskSensitivePatterns(text: string): string` — `variable-shape.ts`의 모양 판별 정규식(날짜·금액·전화번호)과 자매 함수이므로 정규식 정의를 한 곳(`variable-shape.ts` 또는 공유 `shape-patterns.ts`)에 모아 두 파일이 import하게 한다(중복 정의 금지).

`storage-writer.ts`의 `MAX_PRESS_ENTRIES` 상한 패턴(`storage-writer.ts:23, 126-129`)을 그대로 복제해 하루 항목 상한(D-33)을 구현:
```ts
const MAX_PRESS_ENTRIES = 200;
...
if (nextCounts.length > MAX_PRESS_ENTRIES) {
  nextCounts = [...nextCounts].sort((a, b) => b.count - a.count).slice(0, MAX_PRESS_ENTRIES);
}
```

---

### `src/page/recorder/recorder.ts` (content script 모듈, event-driven)

**Analog:** `src/page/collector/collector.ts`(전체 — DOM 후보 수집 + MutationObserver rAF 합치기 구조 참고, 상단 60줄 확인)

```ts
export interface Item {
  id: string;
  rect: Rect;
  name: string;
  kind: string;
  fingerprint: Fingerprint;
  danger: boolean;
}
export interface Collector {
  items(): Item[];
  get(id: string): Element | undefined;
  onChange(cb: () => void): void;
  refresh(): void;
}
```
`recorder.ts`는 `Collector`처럼 DOM을 관찰하지만 목적이 다르다(후보 목록이 아니라 실제 발생한 이벤트를 단계로 변환) — "화면 변화는 rAF 하나로 합쳐 한 번에 처리"라는 스타일만 가져오고, 실제로는 클릭·입력·change 이벤트 리스너가 주 입력이다. `isDanger`/`fingerprint` 조립 부분(`collector.ts` 상단 import 구조: `@/core/danger`, `@/core/fingerprint`, `@/core/frame-path`)을 그대로 재사용해 단계마다 Fingerprint를 만든다.

---

### `src/page/recorder/step-executor.ts` (content script 모듈, request-response)

**Analog:** `src/page/click/press.ts`(전체 95줄, `synthesizePress`) — 클릭 단계 실행에 그대로 재사용.

```ts
export function synthesizePress(el: Element): { picker: PickerResult } { ... }
```
D-16이 명시: "대신 누르기는 Phase 1 방식(`synthesizePress`)을 그대로 쓰고, 입력은 Phase 3 `fillValue`를 쓴다." 입력 단계는 `src/page/input/fill-value.ts`(**가정, Phase 3** — 03-PATTERNS.md에 이 파일이 "no analog(신규 유형)"로 기록돼 있고 실제 코드는 이 브랜치에 없음, `fillValue(el, value)`로 값+입력 이벤트를 함께 낸다는 시그니처만 가정)를 import한다. `step-executor.ts`는 두 함수를 호출만 하고 재구현하지 않는다.

---

### `src/page/overlay/template-save.ts`, `blocked-card.ts`, `dialog-text.ts` (component, request-response/event-driven)

**Analog:** `src/page/overlay/confirm-dialog.ts`(전체 252줄, 위 80줄 확인) — 전체 화면 모달의 유일한 기존 예시.

```ts
import { ensureOverlayRoot } from '@/page/overlay/mode-indicator';

const GUARD_MS = 1000;
...
function ensureStyle(root: ShadowRoot): void {
  if (styleInjected) { return; }
  const style = document.createElement('style');
  style.textContent = `
.${SCRIM_CLASS} { position: fixed; inset: 0; background: var(--scrim); pointer-events: auto; }
.${DIALOG_CLASS} {
  position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: var(--dialog-width); ... opacity: 0; transition: opacity var(--motion-appear);
}
.${DIALOG_CLASS}[data-visible="true"] { opacity: 1; }
`;
  ...
}
```
세 파일 모두 같은 `ensureOverlayRoot()`(`mode-indicator.ts`)를 이어 쓰고, `styleInjected` 불리언 1회 주입 가드를 각자 갖는다(D-36, SYSTEM.md 등대 원칙). `blocked-card.ts`는 `--danger` 대신 `--warning` 테두리를 쓰는 점만 다르다(D-28, D-37 — SYSTEM.md에 아직 없는 템플릿이므로 먼저 SYSTEM.md에 추가한 뒤 구현).

**열기/닫기 수명주기**(`confirm-dialog.ts` 나머지 부분, `openConfirm`/`closeConfirm` 쌍 — 매번 `close*()`부터 호출해 중복 인스턴스 방지, `requestAnimationFrame`으로 `data-visible` 토글): `template-save.ts`도 `openTemplateSave()`/`closeTemplateSave()` 쌍으로 동일 구조.

---

### `src/page/overlay/value-cards.ts`, `template-list.ts` (component, event-driven)

**Analog:** `src/page/overlay/hints.ts`(전체 — 번호 카드 격자, 위 40줄 확인)

```ts
function ensureStyle(root: ShadowRoot): void {
  if (styleInjected) { return; }
  const style = document.createElement('style');
  style.textContent = `
.${HINTS_CLASS} { position: fixed; inset: 0; pointer-events: none; }
.${LABEL_CLASS} { position: fixed; left: 0; top: 0; width: var(--label-size); height: var(--label-size); ... }
`;
  ...
}
```
D-11(값 후보 번호 카드), D-13(틀 목록 1~9 + "다음 장")은 `showHints()`의 "배열 → `container.textContent = ''` → 새로 그리기" 패턴과 `showNextCard()`(우하단 고정, 다음 장 이동)를 그대로 재사용한다. 큰 숫자(22px/700) + 이름 조합(D-36)은 `LABEL_CLASS`의 구조를 그대로 복제하고 tokens.css 값만 참조한다.

---

### `src/page/overlay/run-progress.ts` (component, event-driven)

**Analog:** `src/page/overlay/mode-indicator.ts`(상태 표시 텍스트/아이콘 갱신 패턴 — `ensureOverlayRoot`의 원 소유자, D-19 "모드 표시 자리"를 그대로 확장).

D-19(진행 막대 + "3/8 단계" + 속도를 모드 표시 자리에)는 새 오버레이를 따로 띄우지 않고 `mode-indicator.ts`가 이미 소유한 자리를 갱신하는 함수를 더하는 방식이 맞다(SYSTEM.md "상태 표"가 정한 자리 고정 원칙, D-06과 동일한 "자리는 옮기지 않는다"). `run-progress.ts`는 `mode-indicator.ts`에 진행률 표시 함수를 추가하거나, 그 옆에서 같은 shadow root/같은 DOM 노드를 공유하는 보조 모듈로 만든다 — 계획자가 실제 구현 위치(확장 vs 신규 모듈)를 정할 때 이 자리 고정 원칙을 따른다.

---

### `src/entrypoints/dialog-watcher.content.ts` (main-world content script entry)

**Analog:** 없음(신규 world) — `src/entrypoints/content.ts`(WXT `defineContentScript` 등록 스타일)만 구조 참고.

D-26: "페이지 쪽(main world)에 모든 페이지·모든 프레임에 페이지가 열릴 때(`document_start`) 미리 넣어 두고, 틀이 돌 때만 동작." WXT의 `world: 'MAIN'`, `matches: ['<all_urls>']`, `runAt: 'document_start'`, `allFrames: true` 옵션 조합은 기존 `content.ts`(격리 world, Phase 1 D-01)에 없는 새 설정이므로 `wxt.config.ts` 또는 이 파일의 `defineContentScript({...})` 옵션에서 새로 정의한다. 페이지(isolated world)와의 통신은 `window.postMessage`가 아니라(`messages.ts` 주석이 명시적으로 금지, D-09) **커스텀 DOM 이벤트**(`document.dispatchEvent(new CustomEvent(...))`)로 하는 경우가 많다 — 04-RESEARCH.md가 이 통신 방식을 확정하면 그쪽을 따르고, 여기서는 "격리 world 메시지 경로(`chrome.runtime.sendMessage`)와는 다른 통로가 필요하다"는 제약만 표시한다.

---

### `src/worker/run-orchestrator.ts` (service, event-driven)

**Analog:** `src/worker/relay.ts`(SW가 여러 프레임의 보고를 모아 조정하는 유일한 기존 예시) + `src/worker/storage-writer.ts`(enqueue 순서 보장).

D-17(실행 조정은 SW, 단계마다 `storage.session`에 적음, D-24 재개)은 `relay.ts`의 "여러 프레임 상태를 SW가 모아 판단" 구조와 `storage-writer.ts`의 `enqueue()` 순서 보장 패턴(아래) 둘을 합친 새 모듈이다.
```ts
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task);
  queue = result.then(() => undefined, () => undefined);
  return result;
}
```
D-18(실행 잠금, 같은 틀 한 번에 하나)은 `run-orchestrator.ts`가 실행 중인 틀 id 집합을 들고 있다가 중복 시작 요청을 거부하는 형태로, `background.ts`의 `frameStates`(탭·프레임별 상태를 `globalThis`에 두고 시험이 읽는 패턴, `background.ts:7-8, 29-30`)와 같은 방식으로 시험 가능한 상태를 노출한다.

---

### `src/worker/storage-writer.ts` (service, CRUD) — 확장

**Analog:** 자기 자신(현재 137줄 전체)

**읽기→검사→patch→재검사→쓰기**(`storage-writer.ts:64-83`):
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
새 op(`saveTemplate`, `deleteTemplate`, `recordSubmitPress`, `appendLogEntry`, `writeRunState`)는 전부 이 `enqueue()` 래퍼 안에서 실행해 순서를 보장한다(D-03). D-23(누름 직전 기록, 저장이 끝났다는 답을 받은 뒤에만 누름)은 `step-executor.ts`가 `storage/request`를 보내고 `sendResponse` 완료를 기다린 뒤에만 `synthesizePress`를 호출하는 흐름 — `recordPress`(현재 코드 96-134줄, origin 대조 + MAX 상한)가 정확한 선례.

**origin 검증**(`storage-writer.ts:96-102`, `recordPress`): "요청 origin이 실제로 보낸 프레임의 origin과 같을 때만 기록"하는 패턴을 `recordSubmitPress`(틀 실행 중 제출 누름 기록, D-23)에도 그대로 적용 — 다른 사이트가 가짜 메시지로 "이미 눌렀다"고 속이지 못하게.

---

### `src/worker/relay.ts` / `src/shared/messages.ts` (contract, pub-sub) — 확장

**Analog:** 자기 자신(전체 166줄, `messages.ts`)

**판별 유니온 확장**(`messages.ts:152-165`):
```ts
export const Message = z.discriminatedUnion('type', [
  StorageRequestMessage, FrameStateMessage, FrameReportMessage, FramesReportsMessage,
  HintsPressMessage, PressRequestMessage, HintsStateMessage, FrameRefreshMessage,
  HintsKeyMessage, ModeReportMessage, ConfirmStateMessage, ConfirmKeyMessage,
]);
```
새 메시지(`template/record-start`, `template/record-step`, `template/record-stop`, `run/start`, `run/step-result`, `run/state`, `run/key`, `dialog/seen`, `dialog/answer`)는 각각 기존 `HintsStateMessage`/`ConfirmKeyMessage`와 같은 zod 객체 모양으로 이 배열에 추가한다.

**저장 op 확장**(`messages.ts:97-123`, `SetEnabledOp`/`UpdateSettingsOp`/`RecordPressOp` → `StorageRequestOp` discriminated union): `saveTemplate`, `recordSubmitPress`, `appendLogEntry` op도 `.strict()` zod 객체로 이 union에 추가.

**"맨 위(frameId 0)만" / "해당 프레임으로 라우팅" 두 갈래**(`messages.ts:44-51`, `ConfirmStateMessage:135-140`, `PressRequestMessage:60-64` 주석): 오버레이(값 카드, 틀 목록, 진행 표시, 막힘 카드)는 전부 맨 위 프레임 전용이므로 그 갈래를, 단계 실행 지시(`run/step`, 어느 프레임에서 누를지)는 `PressRequestMessage`처럼 `{ frameId }`로 라우팅하는 갈래를 따른다.

---

### `src/entrypoints/content.ts` (controller, event-driven) — 확장

**Analog:** 자기 자신(기존 핸들러 체인) + `src/page/input/pipeline.ts`의 `keyHandlers` 배열, `setModal` 후킹.

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
D-21(틀이 도는 동안 ←→·Esc를 입력칸 포커스보다 먼저 받음)은 이 핸들러 체인에 실행기 핸들러를 확인 화면과 같은 우선순위(맨 앞)로 등록해서 구현 — 확인 화면이 이미 이 계약(`ModalHandler`/`setModal`, isTrusted keydown·keyup·keypress를 모두 삼킴)을 구현했으므로 실행기도 실행 중일 때 같은 `setModal()` 후킹 포인트를 배타적으로 쓴다(명령판·확인 화면·틀 실행이 동시에 열리지 않게, Phase 3 03-PATTERNS.md "모달 후킹" 공유 패턴과 동일 원칙).

---

### `src/entrypoints/background.ts` (service worker entry) — 확장

**Analog:** 자기 자신(전체 129줄)

```ts
chrome.runtime.onInstalled.addListener(() => {
  void writer.ensureDefaultSettings();
});
chrome.runtime.onMessage.addListener((raw, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) { return undefined; }
  const parsed = parseMessage(raw);
  if (!parsed.success) { return undefined; }
  ...
  if (message.type === 'storage/request') {
    if (message.op.kind === 'setEnabled') {
      void writer.setEnabled(message.op.enabled).then(sendResponse);
      return true;
    }
    ...
  }
});
```
D-25(틀이 도는 동안 `runtime.onUpdateAvailable` 적용을 미룸)는 `chrome.runtime.onUpdateAvailable.addListener(...)`를 새로 등록하고 `run-orchestrator`의 "지금 도는 틀이 있는가" 상태를 확인해 `chrome.runtime.reload()` 호출 여부를 막는 형태 — 기존 `onInstalled` 핸들러 등록 스타일(순수 리스너 추가, 분기 없음)을 그대로 따른다. 새 메시지 타입(`run/*`, `template/*`, `dialog/*`)의 라우팅도 기존 `if (message.type === ...)` 사슬에 가지를 더하는 방식(신규 분기 도입 없음).

---

### `tests/practice-site/*.html`, `tests/e2e/fixtures.ts`

**Analog:** `tests/practice-site/frames.html`(iframe 중첩 구조), `tests/practice-site/spike.html`(지연 시나리오), `tests/e2e/fixtures.ts`(전체 — 확장 로드·컨텍스트 구성)

D-39가 요구하는 각 픽스처는 기존 파일의 구성 패턴을 재사용: 동일/교차 출처 iframe은 `frames.html`의 `frame-same`/`frame-nest`/`frame-cross` 구조, 늦게 나타나는 요소는 `spike.html`의 지연 로직. D-41 "SW를 강제로 재운 뒤 이어가기" 시험은 `fixtures.ts`에 헬퍼(예: `serviceWorker.evaluate(() => ...)`로 SW 컨텍스트를 종료시키거나 idle 유도)를 추가해야 하는데, 이는 신규 유형(no analog) — 04-RESEARCH.md가 MV3 SW를 Playwright로 강제 재우는 구체적 API를 조사해 확정해야 한다.

## Shared Patterns

### 순수 함수 core/ 계층 분리
**Source:** `src/core/danger.ts:1-3`, `src/core/dwell-timer.ts:4`("순수 함수 — document·window·chrome 참조 없음")
**Apply to:** `template-schema.ts`, `step-recorder.ts`, `variable-shape.ts`, `submit-word.ts`, `blocking-screen.ts`, `run-state.ts`, `dialog-policy.ts`, `element-refind.ts`, `activity-log.ts`, `weekly-stats.ts`
DOM/확장 API 참조 금지. 값을 뽑는 어댑터 역할은 `page/recorder/recorder.ts`, `page/recorder/step-executor.ts`가 맡는다.

### Shadow DOM 오버레이 루트 + 1회 스타일 주입
**Source:** `src/page/overlay/mode-indicator.ts`(`ensureOverlayRoot`), `hints.ts:22-26`, `confirm-dialog.ts:38-42`
**Apply to:** `template-save.ts`, `value-cards.ts`, `template-list.ts`, `run-progress.ts`, `blocked-card.ts`, `dialog-text.ts`
새 shadow root를 만들지 않는다. `styleInjected` 불리언 가드로 `<style>`을 한 번만 append, tokens.css 변수만 참조(D-36).

### 단일 저장자 + enqueue
**Source:** `src/worker/storage-writer.ts:32-43`
**Apply to:** 틀 CRUD, 실행 상태, 누름 기록, 활동 기록 append/prune 전부(D-03)
`chrome.storage.*.set` 호출은 `storage-writer.ts`에만 둔다. content script·오버레이는 `storage/request`만 보낸다.

### 메시지 판별 유니온 + origin/sender 검증
**Source:** `src/shared/messages.ts` 전체, `src/worker/relay.ts`
**Apply to:** template/run/dialog/log 메시지 전부
`sender.id === chrome.runtime.id` 확인(background.ts:69), `sender.frameId === 0` 전용 메시지와 `{ frameId }` 라우팅 메시지를 구분, `window.postMessage` 사용 금지(main-world dialog-watcher만 예외 — 통신 방식은 RESEARCH.md 확정 필요).

### 단어 목록 순수 판별
**Source:** `src/core/danger.ts` 전체(18줄)
**Apply to:** `submit-word.ts`, `sensitive.ts`(가정, Phase 3), `blocking-screen.ts`(부분)
`stripSpaces` + `words.some(word => name.includes(word))` 구조를 복제, `stripSpaces`는 공유 유틸로 승격해 중복 정의하지 않는다.

### 확인 화면 보호(1초 가드 + Enter/스페이스 확인 + Esc 취소)
**Source:** `src/page/overlay/confirm-dialog.ts`, `src/core/confirm-guard.ts`
**Apply to:** 제출 확인 화면(D-22), 다시 기록 반영 확인(D-28), 틀 지우기 확인(D-31/Discretion), 위험 버튼 확인
새 확인 UI를 만들지 않고 `confirm-dialog.ts`/`confirm-guard.ts`를 그대로 재사용하거나 같은 패턴으로 복제한다. "확인 버튼에는 클릭 리스너를 달지 않는다"(T-01-25 주석) 원칙 유지.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/core/dialog-policy.ts` | utility | transform | "시간창 안 첫 확인 창만 통과" 같은 시간 기반 정책은 기존 core/ 순수 함수 중 유사 사례 없음(danger.ts 스타일만 참고) |
| `src/core/weekly-stats.ts` | utility | batch | 주 단위 집계 로직은 기존에 없음(activity-log.ts의 순회 스타일만 참고) |
| `src/entrypoints/dialog-watcher.content.ts` | content script(main world) | event-driven | `world: 'MAIN'` + 모든 프레임 + `document_start` 조합과 격리 world와의 통신 방식이 기존 코드에 없음. 04-RESEARCH.md가 통신 방식(CustomEvent 등)을 확정해야 한다 |
| `tests/practice-site/workflow-dialogs.html`, `blocking-screens.html` | test fixture | static | confirm 연쇄·alert·흉내 보안 키패드/캡차/결제 화면 픽스처는 기존에 없음 |
| `tests/e2e/fixtures.ts`의 "SW 강제 재우기" 헬퍼 | test fixture | — | Playwright로 MV3 SW를 강제 idle시키는 기존 헬퍼 없음 — RESEARCH.md 확인 필요 |

## Metadata

**Analog search scope:** `git ls-files src/ tests/`, Phase 1 실제 코드(`src/core`, `src/page`, `src/worker`, `src/shared`, `src/entrypoints`), Phase 3 가정(`origin/claude/phase3-plans-ng6f32:.planning/phases/03-navigation-input-condition/03-PATTERNS.md`)
**Files scanned:** `src/core/*`(11개), `src/page/**`(9개), `src/worker/*`(2개), `src/shared/messages.ts`, `src/entrypoints/*`(3개), `tests/practice-site/*`(9개), `tests/e2e/*`(14개), `tests/unit/*`(11개)
**Pattern extraction date:** 2026-09-24
**주의:** 04-RESEARCH.md가 이 작업 완료 시점까지 저장소에 나타나지 않았다(병렬 작성). 플래너는 RESEARCH.md를 먼저 확인해 이 파일 목록·이름과 다르면 RESEARCH.md를 우선하고, 이 PATTERNS.md의 analog·excerpt는 (파일 이름이 달라도) 역할·데이터 흐름으로 대응시켜 재사용한다.
