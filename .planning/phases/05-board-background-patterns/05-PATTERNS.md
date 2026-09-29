# Phase 5: 작업판·뒤에서 실행·반복 패턴 알림 - Pattern Map

**Mapped:** 2026-09-24
**Files analyzed:** RESEARCH.md "Recommended Project Structure"가 제안한 신규 파일 전부 + 확장 대상 기존 파일
**Analogs found:** 대부분 role-match/exact(Phase 1이 만든 4계층 위에 쌓는 구조). Phase 3(`core/sensitive.ts` 등)·Phase 4(틀 실행기·저장소)는 아직 이 저장소 브랜치에 없어 "No Analog Found"로 남긴다 — CONTEXT.md D-24~D-27, RESEARCH.md "Phase 4 최소 계약"의 가정을 그대로 인용.

이 phase는 greenfield가 아니다. `git ls-files src/`로 확인: Phase 1이 만든 4계층(`core/`·`worker/`·`page/`·`entrypoints/`)과 판별 유니온 메시지(`shared/messages.ts`), 단일 저장자(`worker/storage-writer.ts`), 프레임 중계(`worker/relay.ts`), Shadow DOM 오버레이(`page/overlay/*`)가 이미 코드로 존재한다. Phase 3·4는 다른 브랜치(`origin/claude/phase3-plans-ng6f32`)/동시 작성 중이라 이 저장소에는 없다(`git ls-files | grep -i sensitive`, `palette`, `board` 확인 — 없음).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/worker/board.ts` (탭 목록 조합, 자주 가는 곳 CRUD) | service(SW) | CRUD + event-driven | `src/worker/relay.ts`(탭 ID를 키로 한 Map, `onRemoved`에서 정리) + `src/worker/storage-writer.ts`(단일 저장자 enqueue) | role-match |
| `src/worker/runner-bridge.ts` (실행 상태 구독, 확인 대기 답 라우팅) | service(SW, 라우팅) | pub-sub + request-response | `src/worker/relay.ts`(전체 파일 — `sender.frameId`/`tabId` 검증, `chrome.tabs.sendMessage(tabId, ..., {frameId:0})` 패턴) | exact |
| `src/worker/blocking/rules.ts` (declarativeNetRequest 세션 규칙) | service(SW) | CRUD | 없음(신규 유형, `chrome.declarativeNetRequest` 첫 사용) — 정리(cleanup) 스타일은 `src/worker/relay.ts:40-47`의 `onRemoved` Map 정리 관례 재사용 | no analog(신규 API 표면), 관례는 role-match |
| `src/worker/badge.ts` (또는 `background.ts` 확장, 확인 대기 숫자 배지) | service(SW) | event-driven | `src/entrypoints/background.ts:33-42`(`updateActionForTab`, `setBadgeText`/`setBadgeBackgroundColor` 패턴) | exact |
| `src/core/ad-domains.ts` (내장 광고 도메인 목록) | utility(순수 데이터/판별) | transform | `src/core/danger.ts`(단어 목록 매칭, 순수 함수) | exact |
| `src/core/logout-heuristic.ts` (순수 함수: URL/폼 신호 → 로그아웃 판정) | utility(순수 판별) | transform | `src/core/danger.ts`(순수 함수, `document`/`chrome` 미참조 원칙) | exact |
| `src/core/repeat-pattern.ts` (반복 패턴 세기, D-29가 이름으로 지정) | utility(상태 전이) | transform | `src/core/dwell-timer.ts`(클로저 없는 순수 상태 전이 함수 — 여긴 저장된 카운트 배열을 받아 다음 카운트 배열을 반환하는 형태라 `dwell-timer.ts`보다도 `src/core/fingerprint.ts`의 "두 Fingerprint 비교" 스타일에 더 가깝다) | role-match |
| `src/page/overlay/board.ts` (작업판 오버레이, 4구획 번호 카드) | component(오버레이 렌더) | event-driven | `src/page/overlay/hints.ts`(카드 격자 렌더링) + `src/page/overlay/mode-indicator.ts`(`ensureOverlayRoot()` 재사용, shadow root 스타일 1회 주입) + `src/entrypoints/popup/main.ts`(`createCard` 팩토리, 숫자 키 → 클릭 동시 처리) | exact |
| `src/page/overlay/board.ts` 내 확인 대기 처리 화면(값 고르기·제출 확인) | component(모달형 오버레이) | request-response | `src/page/overlay/confirm-dialog.ts`(전체 파일 — scrim + 중앙 카드, 확인 화면 보호 1초, Enter만 확인) | exact |
| `src/page/automation/pattern-watch.ts` (submit/pagehide 훅, 필드셋 키 계산) | component(이벤트 훅) | event-driven | 없음(신규 유형) — 필드셋 동일성 판정은 `src/core/fingerprint.ts`의 `matchScore`/`isSameElement`를 그대로 재사용(Don't Hand-Roll) | no analog(훅 자체), 식별 로직은 exact |
| `src/shared/messages.ts` (확장: `board/*`, `blocking/*` 메시지 추가) | contract | — | 자기 자신(`FrameReportMessage`~`ConfirmKeyMessage`까지의 판별 유니온 패턴) | exact |
| `src/worker/storage-writer.ts` (확장: 자주 가는 곳 CRUD, 반복 패턴 세기 저장) | service | CRUD | 자기 자신(`enqueue` 단일 순서 처리, `schemaVersion` + `safeParse` 실패 시 원본 보존) | exact |
| `src/worker/relay.ts` / `background.ts` (확장: `board/*` 메시지 라우팅 등록) | service worker entry | event-driven | 자기 자신 | exact |
| `src/core/settings-schema.ts` (확장: `FavoritesV1`, `RepeatPatternsV1` 스키마) | model/config | CRUD | 자기 자신(`SiteEntryV1`, `PressesV1` — `schemaVersion` 리터럴 + `data` 객체 패턴) | exact |
| `tests/practice-site/login.html`, `ads.html`, `repeat-form.html` | test fixture | static | `tests/practice-site/frames.html`(중첩 구조), `tests/practice-site/danger.html`(단어 매칭용 정적 페이지) | exact |
| `tests/unit/repeat-pattern.test.ts`, `logout-heuristic.test.ts`, `ad-domains.test.ts` | test | — | `tests/unit/danger.test.ts`, `tests/unit/dwell-timer.test.ts`(순수 함수 단위 시험 스타일) | exact |
| `tests/e2e/background-speed.e2e.ts` (숨은 탭 속도 측정, `ignoreDefaultArgs` 전용 컨텍스트) | test | — | `tests/e2e/fixtures.ts`(`chromium.launchPersistentContext` 호출부, 56~60행) — 단 이 파일은 `ignoreDefaultArgs`를 새로 쓰는 전용 launch가 필요해 기존 `fixtures.ts`를 그대로 재사용하지 않고 별도 컨텍스트를 만든다 | role-match(launch 골격만 재사용) |
| `wxt.config.ts` (권한 추가: `declarativeNetRequestWithHostAccess`) | config | — | 자기 자신(현재 3~12행 `permissions`/`host_permissions` 배열) | exact |

## Pattern Assignments

### `src/worker/board.ts` (service, CRUD + event-driven)

**Analog:** `src/worker/relay.ts`(탭 ID 키 Map + `onRemoved` 정리) · `src/worker/storage-writer.ts`(enqueue 단일 저장자)

**탭 ID를 키로 한 Map, onRemoved에서 정리** (`src/worker/relay.ts:28-47`):
```typescript
const reportsByTab = new Map<number, Map<number, FrameReportWire>>();
chrome.tabs.onRemoved.addListener((tabId) => {
  reportsByTab.delete(tabId);
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    reportsByTab.delete(tabId);
  }
});
```
`board.ts`가 탭 목록/뒤에서 도는 틀의 SW 쪽 상태(있다면)를 이 방식으로 관리한다. `chrome.tabs.query({})`(모든 창)/`{ currentWindow: true }`(지금 창)로 목록을 얻고, `chrome.tabs.update(tabId, { active: true })` + 다른 창이면 `chrome.windows.update(windowId, { focused: true })`(RESEARCH A1, LOW confidence — e2e로 검증), `chrome.tabs.remove(tabId)`로 닫기.

**자주 가는 곳 CRUD** — `src/worker/storage-writer.ts:45-62`(`setEnabled`)의 `enqueue(async () => { ... safeParse ... storage.sync.set })` 골격을 그대로 복제한다. 저장 위치는 `chrome.storage.sync`(D-04), 8KB 제한(D-03)은 `MAX_PRESS_ENTRIES = 200` 같은 상한 상수(`storage-writer.ts:23`) 패턴을 참고해 URL 개수 상한을 둔다.

---

### `src/worker/runner-bridge.ts` (service, pub-sub + request-response)

**Analog:** `src/worker/relay.ts` 전체(144줄)

**sender 검증 + frameId 라우팅** (`src/worker/relay.ts:94-104`, `hints/press` 처리):
```typescript
if (message.type === 'hints/press') {
  if (senderFrameId !== 0) {
    // T-01-19: 맨 위 content script만 누르기 요청을 시작할 수 있다.
    return;
  }
  void chrome.tabs.sendMessage(
    tabId,
    { type: 'press/request', itemId: message.itemId, framePath: message.framePath },
    { frameId: message.frameId },
  );
  return;
}
```
`board/answer` 라우팅(RESEARCH.md "확인 대기 답을 실행 탭으로 전달" 예시)도 같은 형태 — `runId → runTabId` 조회 후 `chrome.tabs.get(runTabId)`로 살아있는지 재확인(Pitfall 2류 방어), `{ frameId: 0 }`로만 실행 탭에 보낸다.

**낡은 상태 방어**는 `background.ts:96-107`의 `if (message.type === 'frames/reports' || ...) { return undefined; }` 같은 "이 방향으로는 올 일 없는 메시지 방어적 무시" 관례를 참고.

---

### `src/page/overlay/board.ts` (component, event-driven + 모달)

**Analog:** `src/page/overlay/hints.ts`(카드 격자) + `src/page/overlay/mode-indicator.ts`(shadow root) + `src/entrypoints/popup/main.ts`(`createCard`)

**shadow root 재사용, 스타일 1회 주입** (`src/page/overlay/mode-indicator.ts:27-36`):
```typescript
export function ensureOverlayRoot(): ShadowRoot {
  if (shadowRoot) {
    return shadowRoot;
  }
  hostElement = document.createElement(HOST_TAG);
  hostElement.style.cssText = 'all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;';
  document.documentElement.append(hostElement);
  shadowRoot = hostElement.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `${tokensCss} ...`;
  shadowRoot.append(style);
  return shadowRoot;
}
```
작업판도 이 shadow root를 이어 쓴다(등대 원칙, D-20) — 별도 host 태그를 새로 만들지 않는다.

**번호 카드 팩토리 + 숫자 키 동시 처리** (`src/entrypoints/popup/main.ts:112-145`):
```typescript
function createCard(config: CardConfig): { element: HTMLButtonElement; render: (enabled: boolean) => void } {
  const card = document.createElement('button');
  ...
  card.addEventListener('click', toggle);
  document.addEventListener('keydown', (event) => {
    if (config.digitCodes.includes(event.code)) {
      event.preventDefault();
      toggle();
    }
  });
  return { element: card, render };
}
```
작업판의 1~9 번호 카드(D-05)는 이 팩토리를 확장한다 — 단, popup은 확장 페이지라 `isTrusted` 필터가 없지만 작업판은 content script 오버레이이므로 Phase 1의 입력 파이프라인(`src/page/input/pipeline.ts`)에 등록해 `isTrusted` + 떨림 필터를 먼저 거치게 해야 한다(D-02).

**모달형 확인 대기 처리(값 고르기·제출 확인)**는 `src/page/overlay/confirm-dialog.ts` 전체를 analog로 삼는다 — 특히:
- scrim + 중앙 카드 레이아웃(44~65행)
- 열 때마다 `closeConfirm()`부터 호출해 중복 방지, `requestAnimationFrame`으로 `data-visible` 토글(147~233행)
- 확인 버튼에 클릭 리스너를 달지 않고 Enter/스페이스바만 받는 원칙(191, 212~220행)

제출 확인 화면은 D-02가 요구하는 `confirm-guard.ts`(1초 보호)를 그대로 재사용한다:
```typescript
// src/core/confirm-guard.ts:1-14
// 확인 화면이 뜬 뒤 guardMs(1000ms) 동안은 모든 입력을 무시하고, 그 뒤에는 진짜 Enter
// (keymap.confirm, repeat 없음) 또는 스페이스바(keymap.press)를 holdMs(1000ms) 동안 keyup 없이
// 누르고 있어야 confirm, Esc(keymap.cancel)는 곧바로 cancel이다.
export type ConfirmGuardResult = 'confirm' | 'cancel' | 'ignore';
```

---

### `src/core/ad-domains.ts`, `src/core/logout-heuristic.ts` (utility, transform)

**Analog:** `src/core/danger.ts` 전체(18줄, Phase 3 PATTERNS.md가 이미 같은 analog를 씀)

```typescript
// 순수 함수 — document·window·chrome 참조 없음(danger.ts 관례)
function stripSpaces(text: string): string {
  return text.replace(/\s+/g, '');
}
export function isDanger(name: string, words: readonly string[]): boolean {
  const strippedName = stripSpaces(name);
  if (!strippedName || words.length === 0) { return false; }
  return words.some((word) => strippedName.includes(stripSpaces(word)));
}
```
`ad-domains.ts`의 도메인 매칭, `logout-heuristic.ts`의 origin/경로 패턴 판정은 이 "단어(또는 문자열) 목록 대조, 순수 함수" 틀을 그대로 따른다. `logout-heuristic.ts`는 RESEARCH.md 권고대로 단일 신호로 단정하지 않고 여러 신호를 조합해 반환값을 `'logout' | 'blocked' | 'ok'` 같은 유니온으로 만든다(danger.ts의 boolean 반환보다 한 단계 더 richer — `src/core/confirm-guard.ts`의 유니온 반환 스타일 참고).

---

### `src/core/repeat-pattern.ts` (utility, transform, D-29 지정)

**Analog:** `src/core/fingerprint.ts`(순수 비교 함수) + `src/worker/storage-writer.ts:120-129`(카운트 배열 갱신 로직)

**정체만 비교, 값 없음** (`src/core/fingerprint.ts:16-29`):
```typescript
export function matchScore(a: Fingerprint, b: Fingerprint): number {
  if (!sameFramePath(a, b)) { return 0; }
  let score = 0;
  for (const key of COMPARABLE_KEYS) {
    const va = a[key]; const vb = b[key];
    if (va !== undefined && vb !== undefined && va === vb) { score += 1; }
  }
  return score;
}
```
반복 패턴의 "필드셋 키" 동일성 판정(D-18, "순서·일부 차이 허용")은 이 `matchScore` 완화판을 재사용한다(RESEARCH.md Don't Hand-Roll 표가 명시).

**카운트 배열 갱신** (`src/worker/storage-writer.ts:120-129`):
```typescript
const matchIndex = base.data.counts.findIndex((entry) => isSameElement(entry.fingerprint, fingerprint));
let nextCounts =
  matchIndex >= 0
    ? base.data.counts.map((entry, i) => (i === matchIndex ? { ...entry, count: entry.count + 1 } : entry))
    : [...base.data.counts, { fingerprint, count: 1 }];
```
`repeat-pattern.ts`의 `(existingCounts, patternKey) => nextCounts` 순수 함수(D-29 요구)는 이 갱신 로직을 SW 밖으로 뽑아낸 형태 — SW(`storage-writer.ts` 확장)가 이 순수 함수를 호출하고 저장만 담당한다. `declined` 배열(거절 시 다시 안 물음, D-17)도 같은 파일에 순수 함수로 추가.

---

### `src/worker/blocking/rules.ts` (service, CRUD, 신규 API 표면)

**Analog:** 코드 analog 없음(첫 `declarativeNetRequest` 사용) — 정리(cleanup) 관례만 `src/worker/relay.ts:40-47`(탭 ID 키 Map, `onRemoved`에서 지우기)를 재사용. 실제 구현은 RESEARCH.md Pattern 2·"탭별 이미지·광고 차단" 절의 코드 예시(`updateSessionRules`, `ruleIdForTab`, 4가지 정리 시점)를 1차 기준으로 삼는다. `wxt.config.ts`의 권한 추가(`declarativeNetRequestWithHostAccess`, D-16)는 반드시 `checkpoint:human-verify` 승인 후.

---

## Shared Patterns

### 단일 저장자
**Source:** `src/worker/storage-writer.ts` (전체) — `enqueue` 순서 처리, `safeParse` 실패 시 원본 보존, `schemaVersion` 필수.
**Apply to:** `board.ts`(자주 가는 곳), `repeat-pattern.ts`가 쓰는 세기·거절 저장. `chrome.storage.*.set` 호출은 이 파일에만 있어야 한다 — Phase 5의 새 저장 로직도 이 파일을 확장하거나 같은 `enqueue` 패턴을 새 writer 함수로 추가한다.

### 메시지 규약(판별 유니온)
**Source:** `src/shared/messages.ts`(전체) — `type` 리터럴 + zod, `sender.id === chrome.runtime.id` 확인(`background.ts:69`), `frameId: 0` 명시적 라우팅.
**Apply to:** `board/*`, `blocking/*` 등 이 phase가 추가하는 모든 메시지 타입.

### Shadow DOM 오버레이 + 토큰만
**Source:** `docs/design/tokens.css`, `src/page/overlay/mode-indicator.ts:27-87`(root 생성), `src/page/overlay/confirm-dialog.ts:38-138`(스타일 1회 주입).
**Apply to:** `src/page/overlay/board.ts` 전체(4구획 카드 + 확인 대기 처리 화면). 새 색·서체·radius 금지(D-20), 기존 `ensureOverlayRoot()` 재사용.

### 확인 화면 보호
**Source:** `src/core/confirm-guard.ts`(전체, 순수 상태 기계) + `src/page/overlay/confirm-dialog.ts`(렌더링 측).
**Apply to:** 작업판의 제출 확인 처리(D-09), 반복 패턴 "이걸 틀로 저장할까요?" 질문에는 적용하지 않는다(D-19 — 일반 카드 선택이지 위험 확인이 아님, 다만 하던 입력을 끊지 않는 원칙은 같음).

### 탭 ID 키 Map + onRemoved 정리
**Source:** `src/worker/relay.ts:28-47`.
**Apply to:** `board.ts`(뒤에서 도는 틀 진행 캐시가 있다면), `blocking/rules.ts`(세션 규칙 ↔ tabId 매핑), `runner-bridge.ts`.

### 순수 함수 원칙(core/)
**Source:** `src/core/danger.ts`, `src/core/fingerprint.ts`, `src/core/confirm-guard.ts` — "document·window·chrome 참조 없음" 주석 관례.
**Apply to:** `ad-domains.ts`, `logout-heuristic.ts`, `repeat-pattern.ts`. 단위 시험이 이 순수성에 의존한다(D-29).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/worker/blocking/rules.ts`의 `declarativeNetRequest` 호출부 | service | CRUD | 이 저장소에 `declarativeNetRequest` 사용 사례가 전혀 없다(첫 도입, 새 권한 D-16) — RESEARCH.md Pattern 2 코드 예시를 1차 기준으로 삼는다 |
| `src/page/automation/pattern-watch.ts`의 `submit`/`pagehide` 훅 자체 | component | event-driven | Phase 1·3에 폼 제출/페이지 이탈 훅 analog가 없다(Phase 3의 `form-overlay.ts`가 가장 가깝지만 아직 이 브랜치에 없음) — 필드셋 식별 로직만 `fingerprint.ts` 재사용, 훅 배선은 새로 설계 |
| Phase 4 실행 상태 읽기(`board.ts`가 읽을 `run:<runId>` storage.session 레코드) | — | — | Phase 4 코드가 아직 이 저장소에 없다(`git ls-files` 확인). CONTEXT.md D-24와 RESEARCH.md "Phase 4 최소 계약" 절의 가정 스키마를 코드 계약으로 쓰고, 플래너는 Wave 0에 "Phase 4 PLAN과 대조" 태스크를 넣어야 한다 |
| Phase 3 민감칸 판별 함수(`core/sensitive.ts` 추정) | — | — | 다른 브랜치(`origin/claude/phase3-plans-ng6f32`)에만 계획으로 존재, 이 저장소엔 코드 없음. Phase 3 PATTERNS.md는 `src/core/danger.ts`를 analog로 지목했다 — Phase 5의 `repeat-pattern.ts`는 그 함수가 합쳐진 뒤 정확한 export 이름/시그니처를 다시 확인해야 한다(RESEARCH.md A5) |
| Phase 4 확인 화면(값 고르기 카드, 제출 확인 카드)의 정확한 컴포넌트 파일 | — | — | Phase 4가 아직 계획되지 않음 — Phase 5는 `confirm-dialog.ts`를 유사 analog로 쓰되, Phase 4가 실제로 만드는 컴포넌트가 합쳐지면 그것을 직접 analog로 교체해야 한다 |

## Metadata

**Analog search scope:** `git ls-files src/ tests/`(이 저장소, Phase 1 실행 완료분), `origin/claude/phase3-plans-ng6f32`의 `03-PATTERNS.md`(참고, 코드 아님), RESEARCH.md 코드 예시(Phase 4/declarativeNetRequest처럼 이 저장소에 analog가 없는 영역)
**Files scanned:** `src/` 전체(24개 추적 파일), `tests/` 전체(38개 추적 파일)
**Pattern extraction date:** 2026-09-24
