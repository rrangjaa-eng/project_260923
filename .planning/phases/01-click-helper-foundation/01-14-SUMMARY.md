---
phase: 01-click-helper-foundation
plan: 14
subsystem: storage
tags: [zod, chrome-extension-mv3, chrome-storage, playwright, migration, service-worker-lifecycle]

# Dependency graph
requires:
  - phase: 01-click-helper-foundation
    provides: "storage-writer 단일 저장자 패턴(Plan 01-01), site별 sync 쓰기(Plan 01-13)"
provides:
  - "migrate() 순수 함수 — 저장 형식 버전 검사·차례 변환·실패 판정(no-version/newer-version/invalid/migrate-threw)"
  - "syncItemBytes()/SYNC_ITEM_LIMIT(8192) — sync 쓰기 전 크기 사전 검사"
  - "storage-writer.ts: 변환 실패 시 원본 보존 + notice:migration-failed 기록, 8KB 초과 쓰기 거절"
  - "showToast() — 오른쪽 아래 4초 알림 오버레이"
  - "팝업 메뉴 --warning 경고 카드 + '원래 설정을 지키려고 저장하지 않았어요' 문구"
  - "content.ts: 문서당 tremor-helper-root 호스트 dedup, alive 포트 기반 SW 유휴/무효화 구분"
  - "background.ts: onInstalled(reason:'update')일 때만 이미 열린 탭에 content script 재주입"
affects: [storage, lifecycle, content-script-injection]

# Actuals (#2632)
actuals:
  tokens: 12193
  tasks: 3
  commits: 6
plan_head_before: 3d919265bab8e1ea85465d347450073658b1298b

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "형식 버전 마이그레이션: migrate<T>(raw, spec) — schemaVersion 검사 → 차례 변환 → zod 최종 검증, 실패 시 원본 불변 보장(structuredClone)"
    - "옛 콘텐츠 스크립트 자기 정리: chrome.runtime.connect({name:'alive'}) 포트 + onDisconnect에서 chrome.runtime?.id 유무로 '진짜 무효화'와 'SW 유휴로 재연결'을 구분"
    - "onInstalled(reason) 분기 — 'update'일 때만 이미 열린 탭에 재주입(첫 설치 시 manifest 자연 주입과 경합 방지)"

key-files:
  created:
    - src/page/overlay/toast.ts
  modified:
    - src/core/settings-schema.ts
    - tests/unit/settings-schema.test.ts
    - src/worker/storage-writer.ts
    - src/entrypoints/background.ts
    - src/entrypoints/popup/main.ts
    - src/entrypoints/content.ts
    - src/types/chrome.d.ts
    - tests/e2e/lifecycle.e2e.ts

key-decisions:
  - "onInstalled의 재주입(injectContentScriptIntoOpenTabs)은 reason==='update'일 때만 실행 — 'install'에서도 실행하면 시험 샌드박스처럼 매번 새로 확장을 올리는 환경에서 manifest의 자연 주입과 경합해 같은 문서에 content script가 두 번 들어간다(실제 회귀를 CI 전체 시험에서 재현·확인)"
  - "Task 3 e2e는 원래 계획된 chrome.runtime.reload() 기반 4개 대신, production이 실제로 쓰는 chrome.scripting.executeScript 재주입 API를 시험이 직접 불러 재현하는 2개로 재설계 — 이 샌드박스의 reload()는 재주입이나 컨텍스트 무효화를 관찰 가능하게 재현하지 못해(01-01 실측 한계 연장) 나머지 behavior는 RED/GREEN을 구분할 수 없었다(테스트 자체가 무효)"

requirements-completed: [STOR-02]

coverage:
  - id: D1
    description: "저장 형식 변환 실패 시 원본 보존 + notice:migration-failed 기록(migrate() 순수 함수, 단위 시험 8개)"
    requirement: "STOR-02"
    verification:
      - kind: unit
        ref: "tests/unit/settings-schema.test.ts"
        status: pass
      - kind: e2e
        ref: "tests/e2e/lifecycle.e2e.ts#SW가 settings를 더 높은 형식 버전으로 바꾼 뒤...notice:migration-failed에 newer-version이 남는다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/lifecycle.e2e.ts#enabled: \"yes\"처럼 잘못된 v1 값도 재시작 뒤 그대로 보존되고 notice에 invalid가 남는다"
        status: pass
    human_judgment: false
  - id: D2
    description: "변환 실패 알림 — 페이지 토스트 4초 + 팝업 --warning 경고 카드"
    requirement: "STOR-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/lifecycle.e2e.ts#설정 형식 변환이 실패한 상태에서 연습 사이트를 열면 토스트가 뜨고 4초 뒤 사라지며 기본 설정대로 도우미가 켜진다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/lifecycle.e2e.ts#메뉴에 --warning 경고 카드가 뜨고, 저장이 실패하면 카드 문구가 바뀐다"
        status: pass
    human_judgment: false
  - id: D3
    description: "동기화 항목 8KB 한도 — 초과 쓰기 거절, 저장된 값 보존"
    verification:
      - kind: e2e
        ref: "tests/e2e/lifecycle.e2e.ts#site 항목이 정확히 8192바이트일 때...쓰기가 거절되고 저장된 값이 그대로다"
        status: pass
    human_judgment: false
  - id: D4
    description: "이미 열린 탭에 content script가 다시 들어가도(업데이트) tremor-helper-root 호스트는 정확히 1개(dedup)"
    requirement: "STOR-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/lifecycle.e2e.ts#업데이트로 이미 열린 탭에 content script가 다시 들어가도 tremor-helper-root 호스트는 정확히 1개다"
        status: pass
    human_judgment: false
  - id: D5
    description: "SW가 유휴로 alive 포트가 끊겨도(무효화 아님) 도우미는 걷히지 않는다"
    verification:
      - kind: e2e
        ref: "tests/e2e/lifecycle.e2e.ts#SW 포트가 끊겨도(쉬었다 깬 것 흉내) 확장이 살아 있으면 도우미는 걷히지 않는다"
        status: pass
    human_judgment: false
  - id: D6
    description: "진짜 확장 업데이트로 옛 content script의 chrome.runtime.id가 무효화되어 모든 리스너(AbortController)가 정지되고 새 도우미만 키를 처리한다"
    requirement: "STOR-02"
    verification: []
    human_judgment: true
    rationale: "이 Playwright/CDP 헤드리스 샌드박스는 chrome.runtime.reload()가 예전 SW를 끝내기만 할 뿐 onInstalled를 다시 돌리지 않고, 옛 content script의 chrome.runtime.id도 무효화하지 않는다(01-01·01-14 실측). 수동 chrome.scripting.executeScript 재주입으로도 옛 컨텍스트를 진짜로 무효화할 수 없어, '옛 리스너가 완전히 멎는다'는 이 환경에서 자동 시험으로 끝까지 재현할 수 없다 — 코드 리뷰로 Chrome 공식 문서의 컨텍스트 무효화 동작과 대조해 정합성만 확인했다(connectAlivePort의 onDisconnect + isExtensionContextValid 분기). 실제 Chrome에서 사람이 확장을 업데이트해 확인해야 한다."

duration: (이어진 세션, Task 1부터 정확한 벽시계 시간 미기록)
completed: 2026-09-24
status: complete
---

# Phase 1 Plan 14: 저장 형식 변환 보존·알림, 동기화 크기 한도, 옛 도우미 자기 정리 Summary

**형식 버전 변환 실패 시 원본 데이터를 절대 덮어쓰지 않고 토스트+경고 카드로 알리는 `migrate()` 기반 storage-writer, sync 8KB 사전 검사, 그리고 확장 업데이트 뒤 문서당 도우미 호스트가 정확히 하나만 남도록 하는 content script dedup + alive-포트 기반 SW 유휴/무효화 판별.**

## Performance

- **Tasks:** 3/3 완료
- **Files modified:** 9 (`src/page/overlay/toast.ts` 신규 포함)
- **Commits:** 6 (RED/GREEN × 3 tasks) + 이 문서 커밋

## Accomplishments
- `migrate<T>(raw, spec)` 순수 함수: 버전 없음/더 높은 버전/무효 값/변환 중 예외 네 가지 실패를 구분하고, 성공 시 원본을 절대 변형하지 않는다(단위 시험 8개, `settingsSpec`/`siteSpec`/`pressesSpec` export).
- `syncItemBytes(key, value)`/`SYNC_ITEM_LIMIT = 8192` — UTF-8 바이트 기준 sync 항목 크기 사전 검사.
- `storage-writer.ts`: 모든 sync 읽기가 `migrate()`를 거치고, 실패하면 그 키를 절대 쓰지 않은 채 `notice:migration-failed`(storage.local)를 기록한다. sync 쓰기는 `syncItemBytes` 사전 검사를 통과해야만 실제 `chrome.storage.sync.set`을 호출한다.
- `src/page/overlay/toast.ts` 신규: `showToast(text)` — 오른쪽 아래, 4초, `--warning`/`--surface`/`--radius-card` 토큰만 사용.
- 팝업(`popup/main.ts`): 변환 실패 알림이 있으면 `--warning` 경고 카드를 띄우고, 저장 응답이 `preserved-original`이면 낙관적 렌더를 되돌리고 카드 문구를 바꾼다.
- `content.ts`: `main()` 시작 시 문서에 남은 `tremor-helper-root`를 지운 뒤 자기 것을 만든다(호스트 dedup). `chrome.runtime.connect({name:'alive'})` 포트의 `onDisconnect`에서 `chrome.runtime?.id` 유무로 진짜 무효화(→ 모든 `AbortController` abort + 오버레이 제거)와 SW 유휴로 인한 재연결을 구분한다.
- `background.ts`: `onInstalled`의 `details.reason === 'update'`일 때만 이미 열린 탭에 `chrome.scripting.executeScript`로 content script를 다시 넣는다(도울 수 없는 주소는 건너뜀). `onConnect`로 alive 포트를 모아 두고, e2e 전용 `disconnectAlivePorts` 훅으로 SW 유휴를 흉내 낸다.

## Task Commits

Each task was committed atomically (RED → GREEN):

1. **Task 1: 형식 변환 migrate()와 동기화 항목 크기 검사** — `880f1d0` (test, RED) → `bb0d2b8` (feat, GREEN)
2. **Task 2: 변환 실패 시 원본 보존·알림·크기 한도** — `d705542` (test, RED) → `944ee84` (feat, GREEN)
3. **Task 3: 옛 도우미 자기 정리와 업데이트 뒤 새 도우미 재주입** — `797b413` (test, RED) → `463a209` (feat, GREEN)

**Plan metadata:** (이 커밋 자체)

## Files Created/Modified
- `src/core/settings-schema.ts` - `migrate()`, `MigrateSpec`/`MigrateResult`, `settingsSpec`/`siteSpec`/`pressesSpec`, `syncItemBytes()`, `SYNC_ITEM_LIMIT`, `MIGRATION_NOTICE_KEY`, `MigrationNoticeV1`, `MIGRATION_FAILED_MESSAGE`
- `tests/unit/settings-schema.test.ts` - migrate/syncItemBytes 단위 시험 8개
- `src/worker/storage-writer.ts` - `readAndValidateSettings()`(migrate 기반 읽기+보존+알림), `checkSettings()`, `syncSet()` 크기 사전 검사, 결과 타입에 `'preserved-original'`/`'item-too-large'` 추가
- `src/page/overlay/toast.ts` (신규) - `showToast(text)`, 4초 오른쪽 아래 알림
- `src/entrypoints/background.ts` - `onInstalled`/`onStartup`에서 `checkSettings()`, `onInstalled(reason:'update')`에서 `injectContentScriptIntoOpenTabs()`, `onConnect`로 alive 포트 수집, `disconnectAlivePorts` 시험 훅
- `src/entrypoints/popup/main.ts` - 경고 카드, `preserved-original` 시 되돌리기(revert)
- `src/entrypoints/content.ts` - `tremor-helper-root` dedup, `connectAlivePort()`/`cleanupOldHelper()`/`isExtensionContextValid()`, 변환 실패 토스트 표시
- `src/types/chrome.d.ts` - `Port`/`connect`/`onConnect`/`getManifest`/`chrome.scripting.executeScript`/`onInstalled` details.reason 타입 추가
- `tests/e2e/lifecycle.e2e.ts` (신규) - Task 2·3의 e2e 7개 전체

## Decisions Made
- **`onInstalled` reason 분기(Rule 1, 버그 수정):** 재주입을 `reason === 'update'`로만 제한했다. 처음엔 reason을 가리지 않고 매번 `injectContentScriptIntoOpenTabs()`를 불렀는데, 시험이 매번 새 확장 컨텍스트를 여는 환경에서는 이 호출이 **매 시험마다 `reason: 'install'`로도 실행**되어 방금 연 탭에 manifest가 이미 자연 주입한 content script와 경합해 같은 문서에 두 번 들어갔다(자세한 근본 원인은 아래 Deviations 참고).
- **Task 3 e2e 재설계:** 계획된 4개 behavior(reload 기반) 대신, production이 실제로 쓰는 `chrome.scripting.executeScript` 재주입 API를 시험이 직접 호출하는 2개로 줄였다. 근거는 Deviations의 Known Gap 참고.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `onInstalled`이 reason을 가리지 않고 매번 이미 열린 탭에 재주입 → 같은 문서에 content script 이중 주입**
- **Found during:** Task 3 GREEN 구현 뒤 전체 회귀 확인(CI 전체 132개 시험, 별도 백그라운드 실행)에서 `confirm.e2e.ts`·`frames.e2e.ts`가 간헐적으로(최대 8개) 실패
- **원인 조사(systematic-debugging):** 실패 로그가 매번 "번호표 개수 0" 또는 "번호를 찾지 못함"을 가리켰다. `git stash`로 Task 3 production diff를 걷어내고 같은 시험을 3회 반복해 베이스라인이 완전히 깨끗함을 확인 → Task 3 코드가 원인임을 확정. `connectAlivePort`/dedup 각각을 끄고 이분(bisection) 3세트(dedup만/connect만/둘 다 끔)로 재현했으나 **둘 다 꺼도 여전히 간헐적 실패**가 남아, 두 코드 모두 무죄임을 확인. 남은 차이는 `background.ts`의 `injectContentScriptIntoOpenTabs()`뿐이었다 — `chrome.tabs.query({})`가 비동기로 실행되는 동안 시험이 막 연 탭이 이미 manifest의 자연 주입(`document_start`)을 받은 상태에서, `onInstalled`가 그 탭에 **다시** `chrome.scripting.executeScript`를 실행해 같은 문서에 두 번째 content script 인스턴스가 들어갔다(리스너·오버레이 중복으로 번호표·모드 표시가 흔들림).
- **Fix:** `chrome.runtime.onInstalled`의 콜백 인자 `details.reason`을 타입에 추가하고, `reason === 'update'`일 때만 `injectContentScriptIntoOpenTabs()`를 부르도록 제한(신규 설치에서는 애초에 재주입이 불필요 — manifest가 새로 열리는 문서에 자연히 들어간다).
- **Files modified:** `src/entrypoints/background.ts`, `src/types/chrome.d.ts`
- **Verification:** 수정 뒤 `confirm.e2e.ts` + `frames.e2e.ts`를 3회 연속 22/22 통과 확인, `CI=true` 전체 스위트(132개) 1회 통과 확인, `lifecycle.e2e.ts` dev 3회·CI 3회 연속 통과 확인.
- **Committed in:** `463a209` (Task 3 GREEN 커밋에 포함, 커밋 본문에 근본 원인 상세 기록)

---

**Total deviations:** 1 auto-fixed (Rule 1 - 버그)
**Impact on plan:** 계획에 없던 실제 회귀를 배포 전에 잡았다. 범위를 벗어난 추가 작업 없음.

## Issues Encountered

**Task 3 e2e 설계 재검토 (TDD 무결성 문제, 계획 변경 아님):** 계획된 Task 3 behavior 4개는 모두 `chrome.runtime.reload()`로 "재시작"을 재현하는 것을 전제했다. RED를 만들려고 구현 전 상태에서 이 4개를 그대로 실행했더니 **전부 그대로 통과**했다 — 원인은 이 Playwright/CDP 헤드리스 샌드박스의 `chrome.runtime.reload()`가 예전 SW를 끝내기만 할 뿐(01-01에서 이미 실측된 한계) 새 SW를 관찰 가능하게 깨우지도, `onInstalled`를 다시 돌리지도, 옛 content script의 `chrome.runtime.id`를 무효화하지도 않기 때문이다. 즉 이 환경에서는 reload() 뒤에도 옛 인스턴스가 아무 손상 없이 계속 살아 있어서, dedup·자기 정리 코드가 있든 없든 시험이 똑같이 통과했다(구현 전에도 실패하지 않음 = RED가 아님, `test-driven-development` 스킬의 "Test passes? You're testing existing behavior" 위반).

체계적으로 재설계했다:
1. **`업데이트로 이미 열린 탭에 content script가 다시 들어가도 호스트는 1개다`**: production이 실제 업데이트 때 쓰는 `chrome.scripting.executeScript` 재주입 API를 시험이 SW에서 직접 호출해 재현한다(reload()가 아니라). dedup 줄을 지운 상태로 실행해 "호스트 2개"로 실제 RED가 나는 것을 확인한 뒤 복원해 GREEN을 확인했다.
2. **`SW 포트가 끊겨도...도우미는 걷히지 않는다`**: 기존 시험이 `disconnectAlivePorts?.()`로 optional chaining을 써서, 훅이 없어도(구현 전) 조용히 아무 일도 안 하고 통과해 버렸다(가짜 통과). `?.`를 없애 훅이 없으면 `evaluate()` 자체가 던지도록 고쳐 RED를 확인한 뒤 구현을 복원해 GREEN을 확인했다.
3. 나머지 2개(스페이스바로 카운터 정확히 1 증가, F로 번호표 재등장)는 **삭제**했다 — reload()도, 수동 재주입도 옛 content script의 `chrome.runtime.id`를 진짜로 무효화하지 못해(둘 다 확장을 실제로 종료·교체하지 않는다), "옛 리스너가 완전히 멎었다"를 구현 전/후로 구분해 보여줄 방법이 이 샌드박스에 없었다(둘 다 항상 통과 — 무효한 시험).

결과적으로 Task 3 e2e는 계획된 4개가 아니라 **2개**로 마무리했고, `lifecycle.e2e.ts` 전체는 계획의 "9 passed"가 아니라 **7 passed**(Task 2의 5개 + Task 3의 2개)다. 이는 plan의 문자 그대로의 `<verify>` 통과 조건과 다르다 — 근본 원인은 이 실행 코드의 결함이 아니라 01-01에서 이미 발견된, 이 특정 샌드박스의 `chrome.runtime.reload()` 관찰 가능성 한계가 Task 3의 시험 시나리오(같은 탭을 열어 둔 채 재시작)에 정면으로 걸리는 경우였다. production 코드(`connectAlivePort`/`isExtensionContextValid`/`AbortController`)는 Chrome 공식 문서의 실제 컨텍스트 무효화 동작(확장 업데이트 시 옛 콘텐츠 스크립트의 확장 API 접근이 예외를 던짐)에 맞춰 작성했고 코드 리뷰로 정합성을 확인했다 — 다만 그 마지막 절반은 이 환경에서 자동 e2e로 끝까지 증명할 수 없다(위 coverage D6, human_judgment: true로 기록).

## Known Stubs

없음 — 모든 코드 경로가 실제 데이터를 다룬다.

## Known Gaps

**D6 (coverage 참고): "진짜 확장 업데이트 → 옛 도우미의 모든 리스너 정지" 전체 왕복은 이 샌드박스에서 자동 e2e로 검증 불가.** `chrome.runtime.reload()`도, 수동 `chrome.scripting.executeScript` 재주입도 옛 content script의 `chrome.runtime.id`를 실제로 무효화하지 못한다(이 CDP 기반 헤드리스 환경의 한계, 01-01·01-14 두 차례 실측). production 코드는 Chrome 공식 문서의 컨텍스트 무효화 동작에 맞춰 작성되었고 정적 코드 리뷰로 확인했지만, 실제 Chrome에서 확장을 업데이트해 사람이 최종 확인해야 한다. 확인 방법: 임시로 로드한 확장을 `chrome://extensions`에서 "새로고침"한 뒤, 이미 열려 있던 탭에서 F를 눌러 번호표가 정상 동작하는지, DevTools 콘솔에 "Extension context invalidated" 관련 에러가 반복 출력되지 않는지 확인.

## Next Phase Readiness
- 저장 형식 변환·크기 한도·옛 도우미 정리는 Phase 1의 나머지 계획(있다면)이나 이후 phase가 새 저장 키를 추가할 때 `migrate()`/`syncItemBytes()`를 그대로 재사용할 수 있다.
- Known Gap(D6)은 차단 요소가 아니다 — production 코드는 스펙에 맞게 작성되었고, 다음 실사용/QA 단계에서 실제 Chrome 업데이트로 한 번 확인하면 된다.

---
*Phase: 01-click-helper-foundation*
*Completed: 2026-09-24*

## Self-Check: PASSED

- All 9 created/modified files verified present on disk (`src/core/settings-schema.ts`, `tests/unit/settings-schema.test.ts`, `src/worker/storage-writer.ts`, `src/page/overlay/toast.ts`, `src/entrypoints/background.ts`, `src/entrypoints/popup/main.ts`, `src/entrypoints/content.ts`, `src/types/chrome.d.ts`, `tests/e2e/lifecycle.e2e.ts`).
- All 6 task commit hashes verified in `git log --oneline --all` (`880f1d0`, `bb0d2b8`, `d705542`, `944ee84`, `797b413`, `463a209`).
