---
phase: 01-click-helper-foundation
plan: 01
subsystem: infra
tags: [wxt, vite, typescript, zod, playwright, eslint, mv3, chrome-extension]

# Dependency graph
requires: []
provides:
  - 승인된 의존성(zod, wxt, vite, typescript, vitest, happy-dom, @playwright/test, eslint, typescript-eslint, @fontsource/ibm-plex-sans-kr) 정확한 버전으로 설치
  - pnpm 스크립트: dev, build, typecheck, lint, test:unit, test:e2e, test
  - MV3 wxt.config.ts(권한 storage·scripting·tabs, host <all_urls>, debugger 없음)
  - CI에서만 프로덕션 빌드를 쓰는 playwright.config.ts + globalSetup
  - src/core/settings-schema.ts: 형식 버전 1 zod 스키마(SettingsV1·SiteEntryV1·PressesV1) + defaultSettings()
  - service worker(background.ts)가 형식 버전 1 기본 설정을 storage.sync에 한 번 쓰고 기존 값은 보존
  - tests/e2e/skeleton.e2e.ts (RED→GREEN 확인된 tracer e2e)
affects: [01-02, 01-03, 01-06, 01-13, 01-14]

actuals:
  tokens: 24000
  tasks: 1
  commits: 2

tech-stack:
  added: [wxt@0.21.4, vite@8.3.0, typescript@6.0.3, zod@4.6.5, vitest@5.0.1, happy-dom@20.14.5, "@playwright/test@1.63.0", eslint@10.11.0, typescript-eslint@8.70.1, "@fontsource/ibm-plex-sans-kr@5.3.0"]
  patterns:
    - "단일 저장자 + 형식 버전(Pattern 4): 모든 저장 값은 {schemaVersion, data}, 기존 값은 절대 덮어쓰지 않는다(D-25)"
    - "chrome.* 타입은 승인되지 않은 @types/chrome 대신 계획이 실제로 쓰는 표면만 최소 ambient 선언(src/types/chrome.d.ts)으로 좁힌다"
    - "e2e에서 확장 재시작을 검증할 때는 chrome.runtime.reload()가 아니라 같은 user-data-dir로 컨텍스트를 close+relaunch한다(이 샌드박스 헤드리스 크로미움에서 reload()가 새 SW를 관찰 가능하게 깨우지 않음을 확인)"

key-files:
  created:
    - package.json
    - pnpm-lock.yaml
    - tsconfig.json
    - wxt.config.ts
    - eslint.config.js
    - playwright.config.ts
    - tests/e2e/global-setup.ts
    - tests/e2e/skeleton.e2e.ts
    - src/core/settings-schema.ts
    - src/types/chrome.d.ts
    - src/entrypoints/background.ts
  modified:
    - .gitignore

key-decisions:
  - "Task 1·2 체크포인트는 사용자가 이미 승인(approve-all)·확인(approved)한 상태로 실행자에 전달됨 — 목록 그대로 설치, 서체 패키지 포함"
  - "playwright.config.ts의 빌드 실행은 별도 globalSetup 파일(tests/e2e/global-setup.ts)로 뺐다 — 설정 모듈 안에 인라인으로 두면 워커 프로세스가 config를 다시 import할 때마다 매 시험 전 pnpm build가 반복 실행됐다(관찰함). forbidOnly: !!process.env.CI를 playwright.config.ts에 남겨 'process.env.CI 분기가 이 파일에 있다'는 요구도 그대로 만족시킨다"
  - "chrome.runtime.reload()는 이 샌드박스 헤드리스 크로미움에서 옛 SW를 끝내기만 하고 새 SW를 관찰 가능하게 깨우지 않음을 직접 확인(디버그 스크립트) — 3번째 e2e는 같은 user-data-dir로 컨텍스트를 close+relaunch하는 방식으로 바꿔 '재시작 후 보존'을 실제로 재현했다. RESEARCH.md Assumption A8(재적재 뒤 옛 content script 정리)과는 다른 관찰이라 Plan 01-14/이후 reload 의존 시험에 참고할 사실로 남긴다"
  - "@types/chrome은 승인 목록에 없어 설치하지 않았다 — src/types/chrome.d.ts에 이 계획이 쓰는 chrome.runtime.{onInstalled,reload}·chrome.storage.{sync,local}.{get,set} 표면만 최소 ambient 선언했다"

requirements-completed: [STOR-02]

coverage:
  - id: D1
    description: "승인된 정확한 버전으로 도구 세트(wxt·vite·typescript·zod·vitest·happy-dom·playwright·eslint·typescript-eslint·폰트)를 설치하고 pnpm 스크립트를 구성했다"
    requirement: STOR-02
    verification:
      - kind: unit
        ref: "package.json dependencies/devDependencies exact-version check (manual grep, see below)"
        status: pass
    human_judgment: false
  - id: D2
    description: "service worker가 설치 시 형식 버전 1의 기본 설정을 storage.sync에 쓰고, 이미 값이 있으면 보존한다"
    requirement: STOR-02
    verification:
      - kind: e2e
        ref: "tests/e2e/skeleton.e2e.ts (3 tests, CI=true pnpm exec playwright test tests/e2e/skeleton.e2e.ts)"
        status: pass
    human_judgment: false
  - id: D3
    description: "빌드된 MV3 manifest가 storage·scripting·tabs·<all_urls>만 요구하고 debugger 권한이 없다"
    verification:
      - kind: other
        ref: "node -e manifest check (see Task Commits / verify commands below)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-23
status: complete
---

# Phase 1 Plan 1: Click Helper Foundation Summary

**WXT+TypeScript-strict MV3 확장 뼈대: 승인된 도구 세트 설치, zod 형식-버전-1 설정 스키마, service worker가 storage.sync에 기본 설정을 쓰고 보존하는 tracer를 CI=true Playwright e2e로 증명**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-23T14:40:58Z (phase execution start, STATE.md)
- **Completed:** 2026-09-23T15:02:17Z
- **Tasks:** 3 (Task 1·2 체크포인트는 사전 승인된 상태로 수신, Task 3부터 실행)
- **Files modified:** 12 (11 created, 1 modified)

## Accomplishments

- Task 1(의존성 승인)·Task 2(패키지 진위 확인) 체크포인트는 프롬프트에서 이미 resolved(approve-all / approved)로 전달되어 그대로 반영 — 서체 패키지 포함 10개 전부, 정확히 승인된 버전으로 설치
- 도구 세트 구성: `tsconfig.json`(strict·noUncheckedIndexedAccess·exactOptionalPropertyTypes), `eslint.config.js`(typescript-eslint strictTypeChecked + `no-explicit-any: error`, `.claude/` 등 이 프로젝트 밖 트리 제외), `wxt.config.ts`(권한 storage·scripting·tabs, host `<all_urls>`, `debugger` 없음), `playwright.config.ts` + `tests/e2e/global-setup.ts`(CI=true면 프로덕션 빌드, 아니면 개발 모드 빌드)
- `src/core/settings-schema.ts`: `CURRENT_SCHEMA_VERSION`, `SETTINGS_KEY`, `SettingsV1`, `defaultSettings()`, `siteKey`/`SiteEntryV1`, `pressesKey`/`PressesV1`, `Fingerprint` — 모두 형식 버전 1(D-25)
- `src/entrypoints/background.ts`: `runtime.onInstalled`에서 `storage.sync`에 `settings`가 없을 때만 `defaultSettings()`를 쓰고, 있으면 손대지 않음(원본 보존)
- `tests/e2e/skeleton.e2e.ts`: RED(`test(01-01)`, background.ts 스텁으로 의도한 이유로 실패 확인) → GREEN(`feat(01-01)`, 3 passed) 커밋 순서로 tracer 완성

## Task Commits

TDD tracer이므로 RED→GREEN 두 커밋으로 구성(Task 1·2는 체크포인트로 코드 변경 없음):

1. **Task 3 RED: 실패하는 e2e + 도구 세트/스키마 스캐폴딩** - `e017fde` (test)
2. **Task 3 GREEN: background.ts가 형식 버전 1 기본 설정을 storage.sync에 쓴다** - `3992521` (feat)

**Plan metadata:** (이 커밋 직후 별도 `docs(01-01): ...` 커밋으로 기록)

## Files Created/Modified

- `package.json` - pnpm 스크립트(dev/build/typecheck/lint/test:unit/test:e2e/test) + 승인된 의존성 정확한 버전
- `pnpm-lock.yaml` - 잠금 파일(재현 가능한 설치)
- `tsconfig.json` - `.wxt/tsconfig.json` 확장, strict·noUncheckedIndexedAccess·exactOptionalPropertyTypes
- `eslint.config.js` - typescript-eslint strictTypeChecked + `no-explicit-any: error`, `.output/`·`.wxt/`·`node_modules/`·`.claude/`·`test-results/`·`playwright-report/` 제외
- `wxt.config.ts` - MV3 manifest(이름·권한·host_permissions)
- `playwright.config.ts` - testDir/testMatch/workers/projects/globalSetup 참조, `forbidOnly: !!process.env.CI`
- `tests/e2e/global-setup.ts` - CI 분기로 `.output/chrome-mv3`를 정확히 한 번 빌드(계획 파일 목록엔 없던 추가 파일 — 아래 Deviations 참고)
- `src/core/settings-schema.ts` - 형식 버전 1 zod 스키마 + 기본값
- `src/types/chrome.d.ts` - 이 계획이 쓰는 chrome.* 표면만 최소 ambient 선언(계획 파일 목록엔 없던 추가 파일 — 아래 Deviations 참고)
- `src/entrypoints/background.ts` - onInstalled 단일 쓰기(원본 보존)
- `tests/e2e/skeleton.e2e.ts` - SW 기동·기본 설정 저장·재시작 보존 3개 e2e
- `.gitignore` - `.output/`, `.wxt/`, `test-results/`, `playwright-report/` 추가

## Decisions Made

- playwright.config.ts에 빌드를 인라인으로 두지 않고 별도 `globalSetup` 파일로 뺐다(정확히 1회 실행 보장). `process.env.CI` 분기는 `forbidOnly: !!process.env.CI`로 playwright.config.ts 자신에도 남겨 두 곳(설정 파일·globalSetup)이 각자의 이유로 `process.env.CI`를 쓰게 했다.
- `chrome.runtime.reload()`가 이 샌드박스 헤드리스 크로미움에서 새 service worker를 관찰 가능하게 깨우지 않음을 실측으로 확인 — "이미 값이 있으면 보존" e2e는 같은 user-data-dir로 컨텍스트를 close 후 relaunch하는 방식으로 실제 재시작을 재현했다(behavior 의미는 그대로, 메커니즘만 계획의 제안과 다름).
- `@types/chrome`은 승인 목록 밖이라 설치하지 않고, 이 계획이 쓰는 최소 표면만 `src/types/chrome.d.ts`에 직접 선언했다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] eslint.config.js의 ignore 목록이 이 저장소의 GSD/gstack 도구 트리(`.claude/`)까지 린트하려 해 1600여 건의 파싱 에러로 `pnpm lint`가 실패**
- **Found during:** Task 3 (도구 세트 구성 검증)
- **Issue:** 계획이 지시한 ignore(`.output/`·`.wxt/`·`node_modules/`)만으로는 `eslint .`가 이 프로젝트가 아닌 `.claude/skills/...` 등 수천 개 파일까지 타입 인식 린트를 시도해 전부 "was not found by the project service" 에러로 실패했다
- **Fix:** `eslint.config.js`의 ignore에 `.claude/**`, `test-results/**`, `playwright-report/**`를 추가. 또한 `eslint.config.js` 자기 자신이 tsconfig 프로젝트 밖이라 발생하는 타입 인식 에러(`no-deprecated`, `no-unsafe-assignment`)를 해결하려 `tseslint.config()` 대신 ESLint 자체의 `defineConfig`(`eslint/config`)를 쓰고 `eslint.config.js`를 ignore에도 추가
- **Files modified:** eslint.config.js
- **Verification:** `pnpm lint` exit 0, 출력 없음
- **Committed in:** e017fde (RED 커밋에 포함)

**2. [Rule 3 - Blocking] `chrome.*` 전역 타입이 없어 `pnpm typecheck`가 실패(TS2304 Cannot find name 'chrome')**
- **Found during:** Task 3 (background.ts·e2e 작성)
- **Issue:** `@types/chrome`은 승인된 의존성 목록에 없고(WXT의 `@wxt-dev/browser`는 `browser` API만 노출, `chrome` 전역은 선언하지 않음), 계획은 명시적으로 `chrome.storage`/`chrome.runtime`을 쓰라고 지시
- **Fix:** 새 의존성을 추가하는 대신 `src/types/chrome.d.ts`에 이 계획이 실제로 쓰는 표면(`chrome.runtime.onInstalled`/`reload`, `chrome.storage.sync`/`local`의 `get`/`set`)만 최소 ambient 선언
- **Files modified:** src/types/chrome.d.ts (신규)
- **Verification:** `pnpm typecheck` exit 0
- **Committed in:** e017fde (RED 커밋에 포함)

**3. [Rule 1 - Bug] playwright.config.ts에 빌드를 인라인으로 두면 워커가 config를 재-import할 때마다 `pnpm build`가 반복 실행됨**
- **Found during:** Task 3 (RED 확인 중 첫 실행에서 build 로그가 3번 찍힘을 관찰)
- **Issue:** playwright.config.ts 모듈 최상단에서 동기적으로 빌드를 실행하도록 처음 작성했더니, 워커 프로세스가 설정 파일을 다시 import할 때마다(대략 시험마다) 빌드가 다시 실행됐다 — 낭비이고, 실행 중인 컨텍스트가 참조하는 `.output` 디렉터리를 시험 도중 덮어쓸 위험이 있었다
- **Fix:** 빌드 실행을 Playwright의 실제 `globalSetup`(전체 실행에 정확히 1회) 훅으로 분리(`tests/e2e/global-setup.ts` 신규 파일). `process.env.CI` 분기는 이 새 파일과 playwright.config.ts의 `forbidOnly: !!process.env.CI` 양쪽에 남아 있다
- **Files modified:** playwright.config.ts, tests/e2e/global-setup.ts(신규)
- **Verification:** 재실행 시 빌드 로그가 시험 전 정확히 1번만 출력됨
- **Committed in:** e017fde (RED 커밋에 포함)

**4. [Rule 1 - Bug] `chrome.runtime.reload()`가 이 샌드박스 헤드리스 크로미움에서 새 service worker를 관찰 가능하게 깨우지 않아 3번째 e2e가 30초 타임아웃**
- **Found during:** Task 3 (RED 확인 실행)
- **Issue:** 계획이 제안한 `chrome.runtime.reload()` 뒤 `context.waitForEvent('serviceworker')` 패턴이 이 환경에서는 옛 SW를 종료만 시키고(`close` 이벤트는 발생) 새 SW를 절대 재등록하지 않음을 별도 디버그 스크립트로 직접 확인(RESEARCH.md Assumption A8과 다른 관찰 — 확장에 SW를 깨울 이벤트 리스너/트리거가 없으면 재적재만으로는 서비스워커가 다시 깨어나지 않는다)
- **Fix:** 같은 `userDataDir`로 `context.close()` 후 `chromium.launchPersistentContext(userDataDir, ...)`를 다시 호출하는 방식으로 바꿔, 실제 브라우저 재시작을 재현하고 storage.sync 보존을 확인했다(동작 의미는 계획의 의도와 동일 — "재시작 후 기존 값 보존")
- **Files modified:** tests/e2e/skeleton.e2e.ts
- **Verification:** 재실행 시 3번째 시험 통과(4.1초, 타임아웃 없음)
- **Committed in:** e017fde (RED 커밋에 포함)

**5. [Rule 1 - Bug] GREEN 구현 직후 첫 재실행에서도 2번째 e2e가 `value` undefined로 실패**
- **Found during:** Task 3 (GREEN 확인 실행)
- **Issue:** `background.ts`의 `onInstalled` 리스너가 `storage.sync.get().then(...set())`으로 비동기라, service worker가 뜬 직후 곧바로 읽으면 아직 쓰기 전일 수 있었다(경합)
- **Fix:** 단발성 읽기 대신 `expect.poll`로 값이 나타날 때까지 기다린 뒤 스키마·형식 버전을 확인하도록 시험을 고쳤다(동작 검증 내용 자체는 바뀌지 않음, 관찰 시점만 조건 기반 대기로 교체 — `systematic-debugging`의 condition-based-waiting 패턴)
- **Files modified:** tests/e2e/skeleton.e2e.ts
- **Verification:** 재실행 시 3 passed
- **Committed in:** 3992521 (GREEN 커밋에 포함)

---

**Total deviations:** 5 auto-fixed (3 Rule 3 - blocking, 2 Rule 1 - bug)
**Impact on plan:** 모두 이 환경(샌드박스 헤드리스 크로미움, 이 저장소의 `.claude/` 도구 트리 존재, 승인 목록에 없는 `@types/chrome`)에서 계획을 문자 그대로 실행하면 막히는 지점을 고친 것이다. 저장 형식·권한·검증 기준(schemaVersion 1, `<all_urls>`, `debugger` 없음, CI=true 3 passed)은 계획 그대로 지켰다. 범위를 벗어난 추가 기능은 없다.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-02가 이어받을 것: 단일 저장자를 `src/worker/storage-writer.ts`로 옮기고, 팝업 + 모든 프레임 content script + Shadow DOM 모드 표시를 추가해 SKELETON.md의 걷기 뼈대(끄기 → storage.sync 저장 → content script 반영)를 완성한다.
- `src/types/chrome.d.ts`는 지금 최소 표면만 선언돼 있다 — 이후 계획이 `chrome.scripting`·`chrome.tabs`·`chrome.action`·`chrome.storage.onChanged` 등을 쓰면 그 표면을 이 파일에 추가해야 한다(새 의존성 없이).
- `chrome.runtime.reload()`가 이 환경에서 SW를 관찰 가능하게 재기동하지 않는다는 관찰은 Plan 01-14(재적재 자기 정리, D-22)에 영향을 줄 수 있다 — content script의 `onDisconnect` 감지는 별도 메커니즘(포트 연결 끊김)이라 이 관찰과 직접 충돌하진 않지만, 재적재 뒤 SW 쪽 검증이 필요하면 같은 close+relaunch 패턴을 참고할 것.
- 블로커 없음.

## Self-Check: PASSED

- All 11 created/modified source files confirmed present on disk (`[ -f ]`).
- Both commits (`e017fde` test, `3992521` feat) confirmed in `git log --oneline --all`.
- Re-ran all four plan-level `<verification>` commands fresh in this session: `pnpm typecheck` (exit 0), `pnpm lint` (exit 0, no output), `CI=true pnpm exec playwright test tests/e2e/skeleton.e2e.ts` (exit 0, "3 passed"), manifest check script (exit 0).
- Re-verified acceptance criteria: exact approved versions in package.json, required scripts present, `tsconfig.json` has `"strict": true`, `eslint.config.js` has `no-explicit-any: "error"`, `playwright.config.ts`/`tests/e2e/global-setup.ts` branch on `process.env.CI` and `testMatch` matches `.e2e.ts`, `settings-schema.ts` exports all six required symbols, `defaultSettings().data.dangerWords` equals `['삭제','취소','반려','로그아웃','결재 취소']` exactly, manifest is MV3 with `<all_urls>` and no `debugger` permission.

---
*Phase: 01-click-helper-foundation*
*Completed: 2026-09-23*
