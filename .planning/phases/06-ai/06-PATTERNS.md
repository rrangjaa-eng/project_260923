# Phase 6: 화면 정리 (AI) - Pattern Map

**Mapped:** 2026-09-24
**Files analyzed:** 12 (신규 8, 기존 파일 확장 4)
**Analogs found:** 12 / 12 (전부 role-match 이상, Phase 1 코드 안에서 발견)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `src/core/ai/mask.ts` | utility | transform | `src/core/danger.ts` | exact (순수 함수, 정규식/문자열 판별, DOM·chrome 없음) |
| `src/core/ai/request-builder.ts` | utility | transform | `src/page/collector/collector.ts`(`Item`) + `src/core/danger.ts` | role-match (Item[] → 압축 페이로드 변환) |
| `src/core/ai/response-schema.ts` | utility/validator | transform | `src/core/fingerprint.ts`(`isSameElement`) | role-match (zod 검사 + "전체 버림" 판별 함수) |
| `src/core/ai/cache-key.ts` | utility | transform | `src/core/settings-schema.ts`(`siteKey`, `pressesKey`) | exact (문자열 열쇠 생성 함수) |
| `src/core/hint-order.ts`(확장) | utility | transform | 자기 자신(기존 `orderHints`) | exact (기존 함수에 옵션 인자 추가) |
| `src/worker/ai/gateway.ts` | service | event-driven / request-response | `src/worker/storage-writer.ts` | exact (단일 진입점, `enqueue` 순차 큐, 검사 실패 시 원본 보존) |
| `src/worker/ai/client.ts` | service | request-response (외부 I/O) | `src/worker/relay.ts`(`chrome.tabs.sendMessage` I/O 래퍼 패턴) | role-match (유일하게 SDK/네트워크를 import하는 얇은 I/O 레이어) |
| `src/worker/ai/usage-store.ts` | service | CRUD | `src/worker/storage-writer.ts`(`recordPress`) | exact (같은 파일의 다른 메서드로 합치거나 같은 큐 패턴을 그대로 복제) |
| `src/core/settings-schema.ts`(확장: `AiResultV1`, `AiUsageV1`, `AiKeySettingsV1`) | model/schema | CRUD | 자기 자신(기존 `SiteEntryV1`, `PressesV1`, `SettingsV1`) | exact |
| `src/shared/messages.ts`(확장: `ai/cleanup-request`, `ai/cleanup-result`, `ai/cleanup-cancel`) | route/message-schema | request-response | 자기 자신(기존 `HintsPressMessage`, `StorageRequestOp`) | exact |
| `src/entrypoints/background.ts`(확장: `sender.id` 확인 뒤 `ai/*` 분기) | controller | event-driven | 자기 자신(기존 `storage/request` 분기, `onMessage` 리스너) | exact |
| 설정 화면 AI 키·한도 칸 | component | request-response | **Phase 3 산출물 — 실행 전 존재 확인**(경로 미확정, 아래 "Phase 3 의존" 참고) | 대기(analog 없음, 아직 코드 없음) |

## Pattern Assignments

### `src/core/ai/mask.ts` (utility, transform)

**Analog:** `src/core/danger.ts` (12줄 전체)

**전체 패턴** (`src/core/danger.ts:1-18`):
```typescript
// 위험한 버튼 판별(D-18): 이름에 위험 단어(settings.dangerWords)가 들어 있으면 위험. 공백은
// 무시(이름·단어 모두 지운 뒤 포함 여부). 순수 함수 — document·window·chrome 참조 없음. 목록
// 자체(기본값·사이트별 편집)는 settings-schema.ts·SAFE-06(Phase 3)에서 온다.

function stripSpaces(text: string): string {
  return text.replace(/\s+/g, '');
}

export function isDanger(name: string, words: readonly string[]): boolean {
  const strippedName = stripSpaces(name);
  if (!strippedName || words.length === 0) {
    return false;
  }
  return words.some((word) => {
    const strippedWord = stripSpaces(word);
    return strippedWord.length > 0 && strippedName.includes(strippedWord);
  });
}
```

**적용 지침:** `mask.ts`도 이 파일처럼 "왜 이 규칙인지"를 상단 주석에 결정 번호(D-10)로 남기고, `document`·`window`·`chrome` 참조가 전혀 없는 문자열→문자열 함수로 작성한다. `isDanger`가 단어 목록을 인자로 받듯, `maskPii`도 정규식 상수를 모듈 스코프에 두고 함수는 입력 텍스트만 받는다(설정 의존 없음 — D-27이 정규식 경계값을 "단위 시험으로 고정"하라고 명시했으므로 하드코딩 상수로 시작해도 된다).

**에러 처리:** 이 analog는 에러를 던지지 않는다(방어적 조기 반환 `if (!strippedName ...) return false`). `mask.ts`도 입력이 빈 문자열이거나 매치가 없으면 원문을 그대로 반환하는 방식으로 맞춘다 — 예외를 던지지 않는다.

---

### `src/core/ai/request-builder.ts` (utility, transform)

**Analog:** `src/page/collector/collector.ts` (`Item` 인터페이스, 8-19줄) + 변환 스타일은 `hint-order.ts`의 `.filter().map().sort()` 체인(69-86줄)

**Item 타입** (`src/page/collector/collector.ts:8-19`):
```typescript
export interface Item {
  id: string;
  rect: Rect;
  name: string;
  kind: string;
  fingerprint: Fingerprint;
  danger: boolean;
}
```

**변환 체인 스타일** (`src/core/hint-order.ts:69-86`, 참고용 — 그대로 복사하지 않고 스타일만 따른다):
```typescript
const queue = items
  .filter((item) => !usedItemIds.has(item.id))
  .map((item, index) => ({ item, pressCount: pressCountFor(item), distance: distanceToCursor(cursor, item.rect), index }))
  .sort((a, b) => { /* ... */ })
  .map((entry) => entry.item);
```

**적용 지침:** `buildAiPayload(items: Item[], viewport) => { tempId, kind, text, zone }[]`는 `Item[]`을 입력으로 받아 순수 변환한다(RESEARCH.md 코드 예시 341-379줄이 이미 초안을 제공 — 이 초안을 기반으로 하되 `MAX_SENT_ITEMS`·`MAX_TEXT_LEN`은 상수로 파일 상단에 둔다, `collector.ts`의 `NAMED_SELECTOR` 같은 모듈 상수 배치 스타일). `id`는 절대 그대로 내보내지 않고 `t{index}` 임시 id로 치환한다(D-09).

---

### `src/core/ai/response-schema.ts` (utility/validator, transform)

**Analog:** `src/core/fingerprint.ts` (전체, 34줄) — "일치 판정 → boolean/좁힌 타입" 순수 함수 스타일

**전체 패턴** (`src/core/fingerprint.ts:16-33`):
```typescript
export function matchScore(a: Fingerprint, b: Fingerprint): number {
  if (!sameFramePath(a, b)) {
    return 0;
  }
  let score = 0;
  for (const key of COMPARABLE_KEYS) {
    const va = a[key];
    const vb = b[key];
    if (va !== undefined && vb !== undefined && va === vb) {
      score += 1;
    }
  }
  return score;
}

export function isSameElement(a: Fingerprint, b: Fingerprint): boolean {
  return matchScore(a, b) >= 2;
}
```

**적용 지침:** `validateAiResponse(raw: unknown, sentTempIds: readonly string[]): string[] | null`은 이 파일처럼 "부분 매치가 아니라 전부 아니면 전무"의 판정 함수다. RESEARCH.md 230-256줄의 초안(zod `safeParse` → 목록 밖 id 하나라도 있으면 `null`)을 그대로 시작점으로 쓴다. `isSameElement`가 `matchScore >= 2`라는 하나의 임계값 조건으로 boolean을 반환하듯, 이 함수도 실패 사유를 세분화하지 않고 `null | string[]`만 반환한다 — 사유 구분(`invalid-response`)은 호출자인 `gateway.ts`가 붙인다(Pattern 1, RESEARCH.md).

**zod 스키마 선언 위치:** `src/shared/messages.ts`의 스키마 선언 스타일(zod 객체를 모듈 상단에 상수로 선언 후 `z.infer`로 타입 추출)을 따른다.

---

### `src/core/ai/cache-key.ts` (utility, transform)

**Analog:** `src/core/settings-schema.ts` (`siteKey`, `pressesKey`, 67-69줄·97-99줄)

**패턴** (`src/core/settings-schema.ts:67-69, 97-99`):
```typescript
export function siteKey(origin: string): string {
  return `site:${origin}`;
}
// ...
export function pressesKey(origin: string): string {
  return `presses:${origin}`;
}
```

**적용 지침:** `aiResultKey(origin, pathname, hash)`·`aiUsageKey(yearMonth)` 같은 함수를 같은 접두사(`ai-result:`, `ai-usage:`) 문자열 템플릿 스타일로 `settings-schema.ts`에 같은 파일 내 다른 `*Key` 함수들 옆에 추가하거나(연구가 제안한 대로 `core/ai/cache-key.ts`로 분리해도 무방 — 어느 쪽이든 함수 시그니처는 "여러 문자열 인자 → 접두사 붙은 단일 문자열 키" 패턴을 유지한다). RESEARCH.md Pitfall 4(A3)에 따라 쿼리는 버리고 `origin + pathname + hash`만 쓴다.

---

### `src/core/hint-order.ts` (확장, utility, transform)

**Analog:** 자기 자신 — 기존 `orderHints` 함수 (`src/core/hint-order.ts:38-120`)

**기존 시그니처와 고정 번호 우선 배정 로직** (`src/core/hint-order.ts:38-59`):
```typescript
export function orderHints(opts: {
  items: HintItem[];
  pins: Pin[];
  presses: PressCount[];
  cursor: { x: number; y: number };
}): HintEntry[][] {
  const { items, pins, presses, cursor } = opts;

  const usedItemIds = new Set<string>();
  const pinnedByNumber = new Map<number, string>();
  for (const pin of pins) {
    if (pinnedByNumber.has(pin.number)) {
      continue;
    }
    const match = items.find((item) => !usedItemIds.has(item.id) && isSameElement(item.fingerprint, pin.fingerprint));
    if (match) {
      pinnedByNumber.set(pin.number, match.id);
      usedItemIds.add(match.id);
    }
  }
  // ...
}
```

**적용 지침:** RESEARCH.md Pattern 3(260-280줄)대로 `opts`에 `aiPicks?: Fingerprint[]` **선택 인자**를 추가한다. `pins` 루프 뒤·`queue` 필터링 전에 `aiPicks`를 순회하며 같은 `isSameElement` 매칭 + `usedItemIds` 등록 방식을 그대로 복제해 pins 다음 우선순위로 끼워 넣는다. **회귀 규칙:** `aiPicks` 생략 시 기존 동작과 100% 동일해야 하므로, 새 로직은 `if (opts.aiPicks) { ... }` 블록으로 격리하고 기존 `pins`/`queue`/`chapters` 코드는 한 줄도 건드리지 않는다(Surgical Changes).

---

### `src/worker/ai/gateway.ts` (service, event-driven/request-response)

**Analog:** `src/worker/storage-writer.ts` (전체 137줄) — 단일 저장자·순차 큐·"검사 실패 시 원본 보존" 패턴

**enqueue 순차 큐 패턴** (`src/worker/storage-writer.ts:32-43`):
```typescript
export function createStorageWriter(): StorageWriter {
  let queue: Promise<unknown> = Promise.resolve();

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task);
    // 앞선 작업이 실패해도 뒤에 오는 요청은 계속 처리한다.
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  // ...
}
```

**"검사 실패 시 원본 보존" 반환 타입 패턴** (`src/worker/storage-writer.ts:16-20, 46-61`):
```typescript
export type SetEnabledResult = { ok: true } | { ok: false; reason: 'invalid-settings' };
// ...
setEnabled(enabled) {
  return enqueue(async () => {
    const existing = await chrome.storage.sync.get(SETTINGS_KEY);
    const parsed = SettingsV1.safeParse(existing[SETTINGS_KEY]);
    if (!parsed.success) {
      // 검사 실패 — 아무것도 쓰지 않는다(원본 보존, D-25). 알림은 Plan 01-14.
      return { ok: false, reason: 'invalid-settings' };
    }
    // ...
    await chrome.storage.sync.set({ [SETTINGS_KEY]: next });
    return { ok: true };
  });
},
```

**적용 지침:** `gateway.ts`도 `createAiGateway()` 팩토리 함수로 같은 `enqueue` 클로저 패턴을 재사용(또는 `storage-writer.ts`의 `writer`를 주입받아 그 안의 큐에 합류)해 "캐시 확인 → 키 확인 → 한도 확인 → 호출 → 성공 시 저장" 전체를 하나의 큐 작업으로 직렬화한다(RESEARCH.md Pitfall 5, D-03 "단일 저장자"). 반환 타입은 RESEARCH.md Pattern 1의 `CleanupResult = { kind: 'ai'; tempIdOrder: string[] } | { kind: 'fallback'; reason: FallbackReason }`를 `storage-writer.ts`의 `{ ok, reason }` 유니온과 같은 스타일(판별 유니온 + 문자열 리터럴 사유)로 선언한다.

---

### `src/worker/ai/client.ts` (service, request-response, 외부 I/O)

**Analog:** `src/worker/relay.ts` — "이 파일만 특정 I/O API를 import하는 얇은 래퍼" 역할 분리 원칙

**역할 분리 예** (`src/worker/relay.ts:1-13` 주석 + export 형태):
```typescript
import type { FrameReportWire } from '@/shared/messages';
import type { Message } from '@/shared/messages';

export interface Relay {
  handle(message: Message, sender: chrome.runtime.MessageSender): void;
}

export function createRelay(): Relay {
  // ... chrome.tabs.* API만 이 파일 안에서 호출
}
```

**적용 지침:** `relay.ts`가 `chrome.tabs.*` API 호출을 이 파일 하나로 가두듯, `client.ts`는 `@anthropic-ai/sdk`(또는 승인 안 되면 `fetch`)를 import하는 유일한 파일이 된다. `requestCleanupPicks(payload, signal): Promise<unknown>` 형태의 좁은 함수 하나만 export하고(RESEARCH.md 384-416줄 초안), `gateway.ts`는 이 함수의 반환값(raw unknown)을 `response-schema.ts`로 넘겨 검사한다 — `client.ts` 안에서 zod 검사를 하지 않는다(관심사 분리, `relay.ts`가 메시지 라우팅만 하고 파싱은 `messages.ts`에 맡기는 것과 같은 원칙).

---

### `src/worker/ai/usage-store.ts` (service, CRUD)

**Analog:** `src/worker/storage-writer.ts`의 `recordPress` 메서드 (96-135줄)

**월별 카운트 증가 + 상한 정리 패턴** (`src/worker/storage-writer.ts:96-134`, 발췌):
```typescript
recordPress(requestOrigin, senderOrigin, fingerprint) {
  return enqueue(async () => {
    if (requestOrigin !== senderOrigin) {
      return { ok: false, reason: 'origin-mismatch' };
    }
    const key = pressesKey(requestOrigin);
    const existing = await chrome.storage.local.get(key);
    const raw = existing[key];

    let base: PressesV1;
    if (raw === undefined) {
      base = { schemaVersion: CURRENT_SCHEMA_VERSION, data: { counts: [] } };
    } else {
      const parsed = PressesV1.safeParse(raw);
      if (!parsed.success) {
        return { ok: false, reason: 'invalid-presses' };
      }
      base = parsed.data;
    }
    // ... 증가·상한 처리 ...
    await chrome.storage.local.set({ [key]: next });
    return { ok: true };
  });
},
```

**적용 지침:** `usage-store.ts`는 `chrome.storage.local`에서 `AiUsageV1`(월 열쇠, 예 `ai-usage:2026-09`)을 읽어 `safeParse` → 없으면 0에서 시작 → 성공 호출 시에만 `+1` → 다시 쓰는 동일한 "읽기-검사-없으면 초기값-쓰기" 3단계를 복제한다. `recordPress`가 `requestOrigin !== senderOrigin`으로 조작을 막듯, `usage-store.ts`는 gateway.ts 내부에서만 호출되므로 별도 origin 검사는 불필요하지만 **월 경계 계산은 `new Date().getFullYear()/getMonth()`(로컬 타임존, UTC 변환 없음)**로 통일한다(RESEARCH.md Pitfall 5).

---

### `src/core/settings-schema.ts` (확장 — 신규 스키마 3종)

**Analog:** 자기 자신 — 기존 `SiteEntryV1`, `PressesV1` 선언 스타일 (71-114줄)

**형식 버전 + data 래핑 패턴** (`src/core/settings-schema.ts:91-95, 110-114`):
```typescript
export const SiteEntryV1 = z.object({
  schemaVersion: z.literal(1),
  data: SiteEntryDataSchema,
});
export type SiteEntryV1 = z.infer<typeof SiteEntryV1>;
// ...
export const PressesV1 = z.object({
  schemaVersion: z.literal(1),
  data: PressesDataSchema,
});
export type PressesV1 = z.infer<typeof PressesV1>;
```

**적용 지침:** `AiResultV1`(사이트+페이지별 캐시된 tempIdOrder → `Fingerprint[]`), `AiUsageV1`(월별 호출 횟수), AI 키·월 한도는 기존 `SettingsDataSchema`(20-36줄)에 필드를 추가하는 대신 **`chrome.storage.local` 전용 새 스키마**로 분리한다(D-18: 동기화 금지 — 기존 `SettingsV1`은 `chrome.storage.sync`용이므로 섞으면 안 된다). 모든 신규 스키마는 `schemaVersion: z.literal(1)` + `data: {...}` 래핑 규칙을 그대로 따른다(D-03).

---

### `src/shared/messages.ts` (확장 — `ai/cleanup-request`, `ai/cleanup-result`, `ai/cleanup-cancel`)

**Analog:** 자기 자신 — 기존 `HintsPressMessage`(52-57줄), `StorageRequestOp`(97-123줄) 판별 유니온 스타일

**단순 요청 메시지 패턴** (`src/shared/messages.ts:52-57`):
```typescript
const HintsPressMessage = z.object({
  type: z.literal('hints/press'),
  frameId: z.number(),
  itemId: z.string(),
  framePath: z.array(z.string()),
});
```

**kind별 op 판별 유니온 패턴** (`src/shared/messages.ts:97-123`):
```typescript
const SetEnabledOp = z.object({ kind: z.literal('setEnabled'), enabled: z.boolean() });
const UpdateSettingsOp = z.object({ kind: z.literal('updateSettings'), patch: z.object({ /* ... */ }).strict() });
const RecordPressOp = z.object({ kind: z.literal('recordPress'), origin: z.string(), fingerprint: FingerprintSchema });
const StorageRequestOp = z.discriminatedUnion('kind', [SetEnabledOp, RecordPressOp, UpdateSettingsOp]);
```

**최종 판별 유니온에 추가하는 지점** (`src/shared/messages.ts:152-166`):
```typescript
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
```

**적용 지침:** `CleanupRequestMessage`(`type: 'ai/cleanup-request'`, 맨 위 프레임이 보내는 `items` 원본 — 가림 전, D-01)와 `CleanupResultMessage`(`type: 'ai/cleanup-result'`, gateway.ts → 맨 위, RESEARCH.md의 `CleanupResult` 유니온을 그대로 실어보냄)를 이 파일에 같은 방식으로 추가하고, `Message` 판별 유니온 배열 끝에 등록한다. 취소는 `ai/cleanup-cancel`(`type` literal + 상관관계 id) 메시지로 별도 선언한다.

---

### `src/entrypoints/background.ts` (확장 — `ai/*` 메시지 분기)

**Analog:** 자기 자신 — 기존 `sender.id` 확인 + `storage/request` 분기 (67-90줄)

**sender.id 검사 + 비동기 응답 패턴** (`src/entrypoints/background.ts:67-90`, 발췌):
```typescript
chrome.runtime.onMessage.addListener((raw, sender, sendResponse) => {
  // 확장 내부 메시지만 받는다(D-09) — externally_connectable 없음, window.postMessage는 받지 않는다.
  if (sender.id !== chrome.runtime.id) {
    return undefined;
  }

  const parsed = parseMessage(raw);
  if (!parsed.success) {
    return undefined;
  }

  const message = parsed.data;

  if (message.type === 'storage/request') {
    if (message.op.kind === 'setEnabled') {
      void writer.setEnabled(message.op.enabled).then(sendResponse);
      return true; // 비동기 응답을 위해 메시지 채널을 열어 둔다.
    }
    // ...
  }
```

**적용 지침:** `message.type === 'ai/cleanup-request'` 분기를 같은 `onMessage` 리스너 안에 추가하고, `gateway.handleCleanupRequest(...).then(sendResponse)` + `return true`로 비동기 응답 패턴을 그대로 복제한다(RESEARCH.md Security Domain "V4 Access Control" — 새 메시지에도 동일한 `sender.id` 검사가 이미 리스너 진입점에서 적용됨, 별도 추가 불필요).

---

## Shared Patterns

### 단일 저장자 + 순차 큐 (D-03, D-04)
**Source:** `src/worker/storage-writer.ts:32-43` (`enqueue` 클로저)
**Apply to:** `src/worker/ai/gateway.ts`, `src/worker/ai/usage-store.ts`
캐시 조회·한도 확인·AI 호출·성공 시 저장을 하나의 `enqueue` 작업으로 직렬화해 레이스(Pitfall 5)를 막는다.

### 판별 유니온 + "검사 실패 시 원본 보존" (D-03, D-19)
**Source:** `src/core/settings-schema.ts`(스키마 버전 래핑), `src/worker/storage-writer.ts`(안전한 실패 반환)
**Apply to:** `AiResultV1`/`AiUsageV1` 저장, `validateAiResponse`의 전체 버림 규칙
zod `safeParse` 실패 시 항상 `{ ok: false, reason: '...' }` 또는 `null`을 반환하고 기존 데이터를 건드리지 않는다.

### sender.id 확인 (Access Control)
**Source:** `src/entrypoints/background.ts:69-71`
**Apply to:** `ai/cleanup-request`·`ai/cleanup-cancel` 처리 — 이미 리스너 최상단에서 한 번 걸리므로 `ai/*` 분기에 별도 코드 불필요, 단 **새로 추가하는 코드가 이 검사를 우회하는 다른 진입점(예: 별도 `onMessageExternal` 리스너)을 만들지 않도록 주의**.

### zod 스키마 선언 스타일
**Source:** `src/shared/messages.ts` 전체(모듈 상단에 `const XxxSchema = z.object(...)` 선언 후 `z.discriminatedUnion`으로 묶고 `z.infer`로 타입 추출)
**Apply to:** `response-schema.ts`의 AI 응답 스키마, `messages.ts`의 신규 `ai/*` 메시지 3종

### 순수 함수(core/) vs I/O(worker/) 분리
**Source:** `src/core/*`(danger.ts, fingerprint.ts, hint-order.ts — 전부 `document`·`window`·`chrome` 참조 없음) vs `src/worker/*`(relay.ts, storage-writer.ts — `chrome.*` API만 여기서 호출)
**Apply to:** `mask.ts`/`request-builder.ts`/`response-schema.ts`/`cache-key.ts`는 core/, `gateway.ts`/`client.ts`/`usage-store.ts`는 worker/ — 이 경계를 넘는 import(예: `core/ai/mask.ts`가 `chrome.storage`를 직접 호출)가 생기면 안 된다.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| 설정 화면 "AI 키 넣기"·"한 달 사용 한도" 칸 | component | request-response | Phase 3이 아직 실행 전이라 설정 화면 자체(경로·템플릿)가 코드로 존재하지 않는다. **Phase 3 산출물 — 실행 전 존재 확인.** Phase 3 D-38(설정 화면은 확장 옵션 페이지 또는 팝업 확장 중 Phase 3이 정한 자리, SYSTEM.md에 템플릿 없으면 DESIGN.md §4-1대로 먼저 템플릿 추가)을 그대로 따르고, Phase 3이 실제로 만든 설정 화면 파일에 두 칸을 추가하는 방식으로 계획한다. 명령판 카드 자리(둘째 장 7번)도 마찬가지로 Phase 3 D-06이 지켜 둔 고정 자리를 그대로 쓴다 — Phase 3 산출물의 실제 파일 경로(예: `src/entrypoints/options/...`)는 이 phase 계획 실행 전에 Phase 3 브랜치가 머지됐는지, 어떤 경로를 썼는지 직접 확인해야 한다. |
| Phase 3 "민감칸 판별 한 곳의 함수" 호출부 | utility(재사용) | transform | D-11이 요구하는 함수 자체는 Phase 3 산출물이라 이 phase가 만들지 않는다. `mask.ts`/`request-builder.ts`에서 이 함수를 import하는 지점은 Phase 3이 정할 실제 파일 경로(현재 미확정)를 실행 전에 확인 후 연결한다. |

## Metadata

**Analog search scope:** `src/core/`, `src/worker/`, `src/shared/`, `src/entrypoints/`, `src/page/collector/` (Phase 1 산출물 전체)
**Files scanned:** `src/worker/storage-writer.ts`, `src/shared/messages.ts`, `src/core/hint-order.ts`, `src/core/fingerprint.ts`, `src/core/settings-schema.ts`, `src/worker/relay.ts`, `src/core/danger.ts`, `src/page/collector/collector.ts`, `src/entrypoints/background.ts`
**Pattern extraction date:** 2026-09-24
