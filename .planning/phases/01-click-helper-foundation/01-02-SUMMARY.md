---
phase: 01-click-helper-foundation
plan: 02
subsystem: extension-core
tags: [wxt, chrome-extension, mv3, playwright, zod, shadow-dom, messaging]

# Dependency graph
requires:
  - phase: 01-click-helper-foundation (Plan 01)
    provides: 승인된 도구 세트, SettingsV1 zod 스키마, background.ts onInstalled 기본값 저장, skeleton e2e
provides:
  - "src/shared/messages.ts: storage/request(setEnabled)·frame/state zod 판별 유니온 + parseMessage(D-09)"
  - "src/worker/storage-writer.ts: createStorageWriter — Promise 줄로 순서 처리하는 단일 저장자(D-24), 검사 실패 시 원본 보존(D-25)"
  - "background.ts: sender.id·zod 검사를 통과한 메시지만 처리, frame/state를 globalThis.frameStates(탭·프레임별 마지막 enabled)에 기록"
  - "src/entrypoints/popup/{index.html,main.ts}: SYSTEM.md 번호 카드 하나(1 도우미 끄기/켜기), 키보드 Digit1·Numpad1, open shadow root + tokens.css"
  - "src/entrypoints/content.ts: allFrames+document_start, storage.sync 읽기 + onChanged 구독, 맨 위 프레임에서만 모드 표시(D-02·D-03)"
  - "src/page/overlay/mode-indicator.ts: tremor-helper-root open shadow root 호스트 + tokens.css 변수만 쓰는 '도우미' 모드 표시(D-26), 이후 계획이 이어 쓰는 ensureOverlayRoot/destroyOverlayRoot"
  - "tests/e2e/fixtures.ts: 확장 로드·SW·팝업 열기·practice.test/other.test 라우팅(servePage/serveFramedPracticePage) fixture"
  - "tests/e2e/helper-toggle.e2e.ts: tracer 3개 + 확장 5개(키보드·연타·모든 프레임·동기화 반영·카드 크기), CI=true 8 passed"
affects: [01-03, 01-04, 01-05, 01-13, 01-14]

actuals:
  tokens: 7000
  tasks: 2
  commits: 4
  plan_head_before: f6590d1

tech-stack:
  added: []
  patterns:
    - "단일 저장자(D-24): chrome.storage.*.set 호출은 src/worker/storage-writer.ts에만 두고, Promise 체인 하나로 요청을 순서대로 처리한다(acceptance grep으로 고정)"
    - "확장 내부 메시지(D-09): zod discriminatedUnion + safeParse로 판별하고, sender.id !== chrome.runtime.id나 파싱 실패는 무시한다"
    - "오버레이 = Shadow DOM(open) + tokens.css?inline만(D-26): 새 색·서체·radius 리터럴 금지, hex 리터럴 0개를 acceptance grep으로 고정"
    - "탭·프레임별 상태는 globalThis에 노출한 평범한 중첩 객체(Record<number, Record<number, boolean>>)로 유지 — Playwright serviceWorker.evaluate의 반환값 직렬화가 JS Map을 보존하지 않아 시험에서 읽을 수 있는 구조로 택함"
    - "팝업 카드는 클릭/키보드 시 즉시(optimistic) 다시 그리면서 다음 토글 기준값을 먼저 갱신하고, storage.onChanged가 도착하면 같은 값으로 다시 그려 확정한다 — 연타해도 매 누름이 직전 누름 기준으로 번갈아 계산된다"

key-files:
  created:
    - src/shared/messages.ts
    - src/worker/storage-writer.ts
    - src/entrypoints/popup/index.html
    - src/entrypoints/popup/main.ts
    - src/entrypoints/content.ts
    - src/page/overlay/mode-indicator.ts
    - tests/e2e/fixtures.ts
    - .planning/phases/01-click-helper-foundation/deferred-items.md
  modified:
    - src/entrypoints/background.ts
    - src/types/chrome.d.ts
    - tests/e2e/helper-toggle.e2e.ts

key-decisions:
  - "frameStates는 계획 문구가 말한 '메모리 Map'을 리터럴 JS Map이 아니라 평범한 중첩 객체(Record<number, Record<number, boolean>>)로 구현했다 — Playwright의 serviceWorker.evaluate는 CDP returnByValue(JSON 기반) 직렬화라 Map을 {}로 지운다. 매핑 의미는 그대로 유지하면서 시험이 실제로 읽을 수 있게 했다."
  - "팝업 카드/키보드 토글은 optimistic 렌더링(클릭 즉시 다음 상태로 다시 그리고 다음 토글 기준값도 그 값으로 갱신) 뒤 storage.onChanged로 재확인하는 방식으로 구현했다 — 버튼을 비활성화하지 않고도 연타 5회가 정확히 번갈아 계산되게 하기 위함(단일 저장자의 순서 보장 자체는 storage-writer.ts가 맡는다)."
  - "servePage/serveFramedPracticePage의 등록 키는 경로만이 아니라 전체 URL(스킴+호스트+경로)이다 — practice.test와 other.test가 같은 경로('/')를 쓸 수 있어 경로만으로는 두 출처가 충돌한다."
  - "TDD RED 확인에 gsd_run check tdd-red-evidence를 쓰지 않았다 — 그 분류기는 node --test의 TAP 출력(# tests/# pass/# fail, ok N - name)만 파싱하는데 Playwright 리포터는 이 형식을 내지 않는다. 그대로 먹이면 매번 zero_tests_discovered(INVALID_RED)로 오분류된다. 대신 tdd.md 절차대로 구현 전에 대상 e2e 파일을 직접 실행해 의도한 시험이 의도한 이유(어서션 실패, 픽스처·문법 오류 아님)로 실패하는지 매 RED마다 눈으로 확인하고 커밋 메시지·이 문서에 근거를 남겼다. Plan 01-01도 같은 방식으로 진행했다(선례)."
  - "tests/e2e/fixtures.ts의 serveFramedPracticePage(같은 출처·다른 출처 iframe 등록 도우미)는 Task 2 action에 쓰여 있었지만 Task 1의 RED 커밋에서 fixtures.ts를 한 번에 작성하며 미리 포함했다 — Task 2가 실제로 쓰기 전까지는 죽은 코드였을 뿐 동작에 영향 없음(사소한 순서 이탈, 문서화)."

requirements-completed: [SAFE-04, STOR-01]

coverage:
  - id: D1
    description: "팝업 '1 도우미 끄기/켜기' 카드 → storage.sync(settings.enabled) → 맨 위 프레임 모드 표시, 1초 안 반영(tracer)"
    requirement: SAFE-04
    verification:
      - kind: e2e
        ref: "tests/e2e/helper-toggle.e2e.ts#연습 사이트에 가면 맨 위 프레임에 모드 표시(\"도우미\")가 뜬다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/helper-toggle.e2e.ts#팝업에서 \"도우미 끄기\"를 누르면 storage.sync가 바뀌고 모드 표시가 1초 안에 사라진다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/helper-toggle.e2e.ts#다시 \"도우미 켜기\"를 누르면 모드 표시가 1초 안에 돌아온다"
        status: pass
    human_judgment: false
  - id: D2
    description: "단일 저장자(storage-writer.ts) — chrome.storage.*.set 호출이 이 파일에만 있고, 검사 실패 시 원본을 보존한다"
    requirement: STOR-01
    verification:
      - kind: other
        ref: "grep -rn \"storage\\.\\(sync\\|local\\)\\.set\" src/ | grep -v storage-writer.ts (빈 출력)"
        status: pass
    human_judgment: false
  - id: D3
    description: "메뉴 카드가 키보드 숫자 1(Digit1·Numpad1)로도 눌리고, 5회 빠르게 눌러도 storage.sync 최종값이 마지막 누름과 같다"
    requirement: SAFE-04
    verification:
      - kind: e2e
        ref: "tests/e2e/helper-toggle.e2e.ts#팝업에 포커스가 있을 때 숫자 1(Digit1·Numpad1)을 누르면 카드를 누른 것과 같다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/helper-toggle.e2e.ts#카드를 빠르게 5번 누르면 storage.sync의 최종 상태가 마지막 누름과 같다"
        status: pass
    human_judgment: false
  - id: D4
    description: "같은 출처·다른 출처(other.test) iframe 모두 도우미 켜짐/꺼짐 상태를 SW에 보고하고 반영한다"
    requirement: STOR-01
    verification:
      - kind: e2e
        ref: "tests/e2e/helper-toggle.e2e.ts#같은 출처·다른 출처 iframe 모두 도우미 켜짐/꺼짐을 SW에 보고한다"
        status: pass
    human_judgment: false
  - id: D5
    description: "SW가 chrome.storage.sync.set으로 값을 바꾸면(다른 PC 동기화 도착 흉내) 열린 탭의 모드 표시가 1초 안에 따라온다"
    requirement: STOR-01
    verification:
      - kind: e2e
        ref: "tests/e2e/helper-toggle.e2e.ts#SW에서 storage.sync.set으로 값을 바꾸면(다른 PC 동기화 흉내) 모드 표시가 1초 안에 따른다"
        status: pass
    human_judgment: false
  - id: D6
    description: "메뉴 카드가 SYSTEM.md 번호 카드 규칙(높이 56px 이상, radius-card, 키 칩)을 따르고 hex 색 리터럴을 쓰지 않는다"
    verification:
      - kind: e2e
        ref: "tests/e2e/helper-toggle.e2e.ts#메뉴 카드 높이가 56px 이상이고 카드 안에 키 칩 \"1\"이 있다"
        status: pass
      - kind: other
        ref: "grep -cE \"#[0-9a-fA-F]{3,6}\\b\" src/entrypoints/popup/main.ts src/page/overlay/mode-indicator.ts (둘 다 0)"
        status: pass
    human_judgment: false
  - id: D7
    description: "같은 브라우저 계정으로 로그인한 다른 PC에서 도우미 끄기 설정이 그대로 적용된다(실제 다른 PC 확인)"
    verification: []
    human_judgment: true
    rationale: "plan 자신이 backstop truth로 표시(설계 10장 '계정 동기화·다른 PC는 수동', D-29) — 실제 다른 PC 환경이 없어 자동 시험 불가. D5(SW의 storage.sync.set 흉내)로 메커니즘은 증명했지만 실제 기기 간 동기화는 사람 확인이 필요하다."

duration: 12min
completed: 2026-09-23
status: complete
---

# Phase 1 Plan 2: Click Helper Foundation — Toggle Tracer Summary

**팝업 "1 도우미 끄기/켜기" 카드 → 단일 저장자(storage-writer.ts) → storage.sync → 모든 프레임 content script → 맨 위 프레임 Shadow DOM 모드 표시까지 이어지는 걷기 뼈대를 CI=true Playwright e2e 8개로 증명(키보드·연타·다중 출처 프레임·동기화 반영 포함)**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-23T15:16:00Z (approx, 커밋 로그 기준)
- **Completed:** 2026-09-23T15:27:52Z
- **Tasks:** 2 (각 tdd="true", RED→GREEN 두 커밋씩)
- **Files modified:** 11 (8 created, 3 modified)

## Accomplishments

- `src/shared/messages.ts`: `storage/request`(op: `setEnabled`)·`frame/state` zod 판별 유니온 + `parseMessage`(D-09) — 확장 내부 메시지만 받는다
- `src/worker/storage-writer.ts`: `createStorageWriter()` — Promise 줄 하나로 요청을 순서대로 처리하는 단일 저장자(D-24), `SettingsV1` 검사 실패 시 아무것도 쓰지 않고 원본 보존(D-25)
- `background.ts`: onInstalled 기본값 저장도 writer를 거치도록 옮기고, `sender.id`·zod 검사를 통과한 메시지만 처리. `frame/state`는 탭·프레임별 마지막 `enabled`를 `globalThis.frameStates`에 기록(시험용)
- `src/entrypoints/popup/{index.html,main.ts}`: SYSTEM.md 번호 카드 하나("1 도우미 끄기"/"1 도우미 켜기"), 키보드 `Digit1`·`Numpad1` 지원, open shadow root + `tokens.css?inline`만 사용
- `src/entrypoints/content.ts`: `allFrames: true`+`runAt: 'document_start'`, `storage.sync` 읽기 + `onChanged` 구독으로 다른 PC 동기화 변경도 같은 경로로 반영(STOR-01), 맨 위 프레임에서만 모드 표시(D-02·D-03)
- `src/page/overlay/mode-indicator.ts`: `tremor-helper-root` open shadow root 호스트 + `tokens.css` 변수만 쓰는 "도우미" 모드 표시(D-26), `ensureOverlayRoot`/`destroyOverlayRoot`/`showModeIndicator`/`hideModeIndicator` export — 이후 계획(테두리·번호표·확인 화면)이 같은 shadow root를 이어 쓴다
- `tests/e2e/fixtures.ts`: 확장 로드·SW·팝업 열기·`practice.test`/`other.test` 라우팅(`servePage`/`serveFramedPracticePage`) — 연습 사이트는 로컬 고정물(D-28)
- `tests/e2e/helper-toggle.e2e.ts`: tracer 3개 + 확장 5개(키보드·연타 5회·같은/다른 출처 iframe·동기화 반영 흉내·카드 크기) — `CI=true pnpm exec playwright test tests/e2e/helper-toggle.e2e.ts` 8 passed

## Task Commits

TDD tracer/auto 두 작업 모두 RED→GREEN 두 커밋씩, 총 4개:

1. **Task 1 RED: 도우미 끄기 tracer 실패 e2e** - `f0bd57e` (test)
2. **Task 1 GREEN: 팝업→단일 저장자→모든 프레임→모드 표시 tracer** - `171c891` (feat)
3. **Task 2 RED: 키보드·연타·모든 프레임·동기화 반영 e2e 추가** - `8d1c37c` (test)
4. **Task 2 GREEN: 메뉴 카드 키보드(1) 처리** - `1a8f375` (feat)

**Plan metadata:** (이 커밋 직후 별도 `docs(01-02): ...` 커밋으로 기록)

## Files Created/Modified

- `src/shared/messages.ts` - 메시지 판별 유니온 + `parseMessage`
- `src/worker/storage-writer.ts` - 단일 저장자(`createStorageWriter`)
- `src/entrypoints/background.ts` - 메시지 라우팅(`sender.id` 확인, `storage/request`→writer, `frame/state`→`frameStates`), onInstalled이 writer 경유
- `src/types/chrome.d.ts` - `runtime.id`·`onMessage`·`sendMessage`, `storage.onChanged`, `tabs.query` 표면 추가
- `src/entrypoints/popup/index.html` - 팝업 진입점(`#app` + `main.ts`)
- `src/entrypoints/popup/main.ts` - 번호 카드 UI, 클릭/키보드 토글, `storage.onChanged` 반영
- `src/entrypoints/content.ts` - 모든 프레임 content script, 모드 표시 제어
- `src/page/overlay/mode-indicator.ts` - Shadow DOM 모드 표시
- `tests/e2e/fixtures.ts` - Playwright 확장 fixture
- `tests/e2e/helper-toggle.e2e.ts` - tracer + 확장 e2e 8개
- `.planning/phases/01-click-helper-foundation/deferred-items.md` - 범위 밖 발견(단위 시험 인프라) 기록

## Decisions Made

frontmatter `key-decisions` 참고. 요약: frameStates는 평범한 중첩 객체로(Map 아님, Playwright 직렬화 제약), 카드 토글은 optimistic 렌더링으로 연타 순서 보장, servePage는 전체 URL 키로 두 출처 충돌 방지, TDD RED 확인은 `check tdd-red-evidence`가 Playwright 출력을 파싱하지 못해(TAP 전용) 수동으로 수행.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] zod v4의 SafeParse 반환 타입 이름이 `SafeParseReturnType`이 아니다**
- **Found during:** Task 1 GREEN (`pnpm typecheck`)
- **Issue:** `messages.ts`에서 `z.SafeParseReturnType<unknown, Message>`를 썼더니 TS2694(해당 이름이 zod v4 네임스페이스에 없음)로 실패
- **Fix:** zod v4의 실제 타입 이름 `z.ZodSafeParseResult<Message>`로 교체(단일 타입 인자, output 타입만 받음)
- **Files modified:** src/shared/messages.ts
- **Verification:** `pnpm typecheck` exit 0
- **Committed in:** 171c891 (Task 1 GREEN)

**2. [Rule 3 - Blocking] ambient 타입의 `boolean | void` 유니온이 eslint `no-invalid-void-type`에 걸림**
- **Found during:** Task 1 GREEN (`pnpm lint`)
- **Issue:** `chrome.runtime.onMessage` 콜백 반환 타입을 `boolean | void`로 선언했더니 "void is not valid as a constituent in a union type"
- **Fix:** `boolean | undefined`로 교체(chrome 실제 동작과도 일치 — 응답을 미룰 때 `true`, 아니면 아무것도 반환하지 않음)
- **Files modified:** src/types/chrome.d.ts
- **Verification:** `pnpm lint` exit 0
- **Committed in:** 171c891 (Task 1 GREEN)

**3. [Rule 3 - Blocking] `v === true`/`v === false` 비교가 eslint `no-unnecessary-boolean-literal-compare`에 걸림**
- **Found during:** Task 2 RED (`pnpm lint`)
- **Issue:** iframe 프레임 상태 배열을 `states.every((v) => v === true)`로 검사했더니 3곳에서 lint 실패
- **Fix:** `states.every((v) => v)` / `states.every((v) => !v)`로 교체(동작 동일)
- **Files modified:** tests/e2e/helper-toggle.e2e.ts
- **Verification:** `pnpm lint` exit 0
- **Committed in:** 8d1c37c (Task 2 RED)

**4. [Rule 3 - Blocking] acceptance 기준의 리터럴 grep("other.test iframe 시험이 있다")이 도우미 함수로 추상화된 코드에서 통과하지 않음**
- **Found during:** Task 2 GREEN 검증
- **Issue:** iframe 시험이 `serveFramedPracticePage` fixture 뒤로 숨어 있어 `helper-toggle.e2e.ts` 파일 자체에 "other.test" 문자열이 없었다
- **Fix:** 해당 시험에 "other.test"를 언급하는 한국어 주석을 추가해 기존 로직은 그대로 두고 grep 대상만 만족시켰다
- **Files modified:** tests/e2e/helper-toggle.e2e.ts
- **Verification:** `grep -n "other.test" tests/e2e/helper-toggle.e2e.ts` 출력 확인
- **Committed in:** 1a8f375 (Task 2 GREEN)

---

**Total deviations:** 4 auto-fixed (모두 Rule 3 - blocking, 전부 타입체크·lint·acceptance grep을 통과시키기 위한 수정)
**Impact on plan:** 모두 도구·검사 통과를 위한 최소 수정이며 동작·설계 의도는 바뀌지 않았다. 범위를 벗어난 추가 기능은 없다. `pnpm test:unit`의 저장소 전체 스캔 문제는 이 계획과 무관한 사전 문제라 고치지 않고 `deferred-items.md`에 기록했다(아래 Issues Encountered).

## Issues Encountered

- `pnpm test:unit`(vitest)이 `vitest.config.ts` 부재로 저장소 전체(`.claude/skills/**`의 `bun:test` 트리 포함)를 스캔해 938개 파일이 전부 실패로 잡힌다. Plan 01-01부터 있던 사전 상태이고 이 계획의 파일과 무관해 고치지 않았다 — `.planning/phases/01-click-helper-foundation/deferred-items.md`에 기록. 다음에 실제 단위 시험을 추가하는 계획이 `vitest.config.ts`(`test.include`를 `src/`·`tests/` 자체로 좁히고 `.claude/**` 제외)를 만들어야 한다.
- `gsd_run check tdd-red-evidence`는 `node --test`의 TAP 출력만 파싱해 Playwright e2e RED 확인에는 쓸 수 없다(먹이면 항상 `zero_tests_discovered`로 오분류). 두 Task 모두 tdd.md 절차대로 RED 실행 결과를 직접 읽어 의도한 시험이 의도한 이유로 실패했음을 확인했다(위 Task Commits 절 및 각 RED 커밋 메시지 참고). Plan 01-01도 같은 방식이었다.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-03 이후가 이어받을 것: `messages.ts`의 판별 유니온에 `op.kind`·`type`을 더 추가(사이트별 끄기 등), `frameStates`·프레임 좌표 보고(Pattern 2), `ensureOverlayRoot`가 만든 shadow root에 테두리·번호표·확인 화면을 이어 그린다.
- `src/types/chrome.d.ts`는 지금 이 계획이 쓰는 표면(`runtime.onMessage`/`sendMessage`, `storage.onChanged`, `tabs.query`)까지 선언돼 있다 — 이후 계획이 `chrome.scripting`·`chrome.action`·`tabs.onZoomChange` 등을 쓰면 여기에 표면을 추가해야 한다.
- D7(다른 PC 실제 동기화 확인)은 backstop truth로, 사람 확인 없이는 human_needed로 남는다 — end-of-phase UAT에서 다뤄야 한다.
- `pnpm test:unit` 저장소 전체 스캔 문제는 실제 단위 시험을 처음 추가하는 계획이 `vitest.config.ts`로 해결해야 한다(deferred-items.md).
- 블로커 없음.

## Self-Check: PASSED

- 모든 생성/수정 파일 확인(`[ -f ]`): `src/shared/messages.ts`, `src/worker/storage-writer.ts`, `src/entrypoints/popup/index.html`, `src/entrypoints/popup/main.ts`, `src/entrypoints/content.ts`, `src/page/overlay/mode-indicator.ts`, `tests/e2e/fixtures.ts`, `tests/e2e/helper-toggle.e2e.ts`, `.planning/phases/01-click-helper-foundation/deferred-items.md` — 전부 존재.
- 4개 커밋(`f0bd57e` test, `171c891` feat, `8d1c37c` test, `1a8f375` feat) `git log --oneline --all`에서 확인.
- 이 세션에서 plan-level `<verification>` 3개를 새로 재실행: `CI=true pnpm exec playwright test tests/e2e/helper-toggle.e2e.ts`(8 passed), `pnpm typecheck && pnpm lint`(둘 다 exit 0), 단일 저장자 grep(빈 출력).
- acceptance_criteria 재확인: Task 1(`allFrames: true`/`runAt: 'document_start'` 존재, 단일 저장자 grep 통과, `sender.id` 확인 존재, mode-indicator.ts에 `attachShadow`·`tokens.css` 존재하고 hex 리터럴 0개, e2e 3 passed) · Task 2(`Digit1`·`Numpad1` 존재, `--target-min`·`--radius-card` 사용하고 hex 리터럴 0개, `other.test` 언급 존재, e2e 8 passed) — 모두 통과.
- `tests/e2e/skeleton.e2e.ts`(Plan 01-01)를 재실행해 회귀 없음을 확인(3 passed).

---
*Phase: 01-click-helper-foundation*
*Completed: 2026-09-23*
