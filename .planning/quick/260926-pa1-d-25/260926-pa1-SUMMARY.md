---
phase: quick-260926-pa1
plan: 01
subsystem: storage
tags: [chrome-storage, chrome-extension-mv3, zod, playwright, vitest]

# Dependency graph
requires:
  - phase: 01-click-helper-foundation
    provides: "storage-writer 단일 저장자 패턴, migrate() 기반 원본 보호(D-25), MIGRATION_NOTICE_KEY 알림(Plan 01-14)"
provides:
  - "HELPER_OFF_KEY('override:helper-off')·HelperOffV1 zod 스키마(storage.local 전용 전역 꺼짐 표시)"
  - "storage-writer.ts setEnabled — settings를 못 읽어도 local 표시로 끄기/켜기 모두 항상 성공, sync는 절대 안 건드림"
  - "content.ts — 모든 프레임이 helperOffOverride를 syncEnabled 합성식에 넣어 전역 꺼짐 표시를 enabled보다 우선 적용"
  - "popup/main.ts — sync enabled와 이 PC 꺼짐 표시를 합쳐 '지금:' 줄·도우미 카드를 그리는 renderHelperState()"
affects: [storage, safety, popup-ui]

# Actuals (#2632)
actuals:
  tokens: 8300
  tasks: 2
  commits: 4
plan_head_before: db39b16

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "이 PC 전용 override 저장 키(storage.local): 동기화 저장소(storage.sync)가 원본 보호로 쓰기를 거절해도, 안전에 필수인 동작(전역 끄기)은 로컬 표시로 우회해 항상 성공시킨다 — sync 원본은 절대 안 건드림"
    - "여러 화면(content.ts 모든 프레임, popup/main.ts)이 같은 합성 규칙(sync enabled && !local 표시)을 독립적으로 유지해 화면과 실제가 항상 일치하게 한다"

key-files:
  created: []
  modified:
    - src/core/settings-schema.ts
    - src/worker/storage-writer.ts
    - src/entrypoints/content.ts
    - src/entrypoints/popup/main.ts
    - tests/unit/storage-writer.test.ts
    - tests/e2e/lifecycle.e2e.ts

key-decisions:
  - "켜기(enabled=true)는 설정이 깨져 있어도 원본 보호로 거절하지 않는다 — 표시만 지우고 항상 성공한다. 근거: (1) 잠긴 결정 D-25에 '다시 켜면 표시만 지운다'가 이미 있음 (2) 설정이 깨진 채로도 content.ts는 원래 기본값(enabled true)으로 돌고 있어 sync에 쓰지 않는 켜기는 지킬 원본을 위협하지 않음 (3) 거절하면 화면·실제 불일치(표시를 지운 채 거절) 또는 영구 잠김(표시를 남긴 채 거절) 중 하나가 된다"
  - "꺼짐 표시는 sync가 스스로 고쳐져도 자동으로 지우지 않는다 — 이용자가 '도우미 켜기'를 누를 때만 지운다(자동 해제는 이용자가 끈 도우미를 말없이 다시 켜는 것과 같다)"
  - "SetEnabledResult에서 'preserved-original'을 제거했다(켜기가 더는 그 이유로 실패하지 않으므로) — UpdateSettingsResult는 그대로 둔다(범위 밖)"

requirements-completed: [SAFE-04]

coverage:
  - id: D1
    description: "동기화 설정이 깨졌거나 더 새 형식이어도 '도우미 끄기'가 성공하고, 열린 탭의 모든 프레임과 새 탭에서 도우미가 꺼진다 — sync 'settings' 원본은 불변"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tests/unit/storage-writer.test.ts#단위 A: sync settings가 더 새 형식(newer-version)이어도 setEnabled(false)는 {ok:true}이고 sync는 불변, local에 꺼짐 표시가 남는다"
        status: pass
      - kind: unit
        ref: "tests/unit/storage-writer.test.ts#단위 B: sync settings가 잘못된 v1(invalid)이어도 setEnabled(false)는 {ok:true}이고 sync는 불변, local에 꺼짐 표시가 남는다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/lifecycle.e2e.ts#D-25: 설정이 깨져도 도우미 끄기가 된다 — 이 PC의 storage.local에만 꺼짐 표시, sync 원본은 그대로"
        status: pass
    human_judgment: false
  - id: D2
    description: "꺼짐 표시가 있으면 새로 연 탭·새로 고친 페이지도 도우미가 꺼진 채로 시작한다 — 표시는 enabled보다 우선한다"
    requirement: "SAFE-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/lifecycle.e2e.ts#D-25: 설정이 깨져도 도우미 끄기가 된다 — 이 PC의 storage.local에만 꺼짐 표시, sync 원본은 그대로 (탭을 닫고 새 탭으로 다시 여는 구간)"
        status: pass
    human_judgment: false
  - id: D3
    description: "'도우미 켜기'는 꺼짐 표시만 지우고 성공한다 — 설정이 여전히 깨져 있어도 sync 원본은 그대로이고 도우미는 기본 설정으로 다시 켜진다. 팝업은 꺼짐 표시를 반영해 '지금: 꺼짐'·'도우미 켜기'를 보여 준다(다시 열어도 같다)"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tests/unit/storage-writer.test.ts#단위 D: 설정이 깨져 있고 local에 꺼짐 표시가 있을 때 setEnabled(true)는 표시만 지우고 sync는 불변이다"
        status: pass
      - kind: unit
        ref: "tests/unit/storage-writer.test.ts#단위 F: 설정이 깨진 채 끄기 뒤 기다리지 않고 바로 켜기를 불러도(큐 순서) 둘 다 성공하고 최종 local엔 표시가 없다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/lifecycle.e2e.ts#D-25: 깨진 설정에서 끈 뒤 팝업은 지금: 꺼짐을 보이고, 켜기는 꺼짐 표시만 지운다"
        status: pass
    human_judgment: false
  - id: D4
    description: "설정이 멀쩡할 때의 끄기/켜기는 지금처럼 storage.sync enabled를 바꾼다(회귀 방지) — 켜기는 남아 있던 꺼짐 표시도 지운다"
    verification:
      - kind: unit
        ref: "tests/unit/storage-writer.test.ts#단위 C(회귀 방지): sync settings가 멀쩡하면 setEnabled(false)는 지금처럼 sync enabled를 바꾸고 local에 꺼짐 표시를 남기지 않는다"
        status: pass
      - kind: unit
        ref: "tests/unit/storage-writer.test.ts#단위 E: 설정이 멀쩡(enabled:false)하고 local에 꺼짐 표시가 있을 때 setEnabled(true)는 sync enabled를 true로 쓰고 표시도 지운다"
        status: pass
    human_judgment: false

duration: 1개 세션(정확한 벽시계 시간 미기록)
completed: 2026-09-26
status: complete
---

# Quick Task 260926-pa1: D-25 전역 도우미 끄기 로컬 우회 표시 Summary

**storage.sync 'settings'가 깨졌거나 더 새 형식이어도 '도우미 끄기'가 항상 성공하도록, storage.local 전용 override:helper-off 표시를 도입하고 content.ts 모든 프레임·popup이 이를 enabled보다 우선 적용하게 했다.**

## Performance

- **Tasks:** 2/2 완료
- **Files modified:** 6
- **Commits:** 4 (RED/GREEN × 2 tasks)

## Accomplishments
- `HELPER_OFF_KEY = 'override:helper-off'`, `HelperOffV1`(`{schemaVersion:1, data:{at:number}}`) 스키마를 settings-schema.ts에 추가(D-30 규약대로 `{schemaVersion, data}` 포장).
- `storage-writer.ts` setEnabled: settings를 못 읽는 경로(`!read.ok`)에서 끄기는 local에 표시를 쓰고, 켜기는 표시를 지운다 — 두 경우 모두 `chrome.storage.sync.set`을 절대 호출하지 않는다(단위 A·B·D·F가 sync.set 호출 0번·JSON 불변을 직접 단언). 멀쩡한 경로의 켜기도 성공 뒤 남아 있는 표시를 지운다.
- `content.ts`: `helperOffOverride` 상태를 `syncEnabled()`의 합성식(`currentSettings.data.enabled && !siteDisabled && siteState !== 'failed' && !helperOffOverride`)에 더했다. 모든 프레임(isTopFrame 제한 없음)이 시작 시 local을 읽고, `chrome.storage.onChanged`(areaName 'local')로 표시 변화를 실시간 반영한다.
- `popup/main.ts`: `syncSettingsEnabled`·`helperOffOverride` 모듈 상태와 `renderHelperState()`로 '지금:' 줄·도우미 카드가 둘을 합친 값을 보여 준다. `loadInitial()`이 sync와 local을 함께 읽고, local `onChanged` 리스너가 `MIGRATION_NOTICE_KEY`·`HELPER_OFF_KEY` 두 키 변화를 서로 막지 않고 각자 처리한다.
- 도달할 수 없어진 `PRESERVED_ORIGINAL_MESSAGE` 상수·분기를 제거했다(§3.3 고아 정리) — `SetEnabledResult`에서 `'preserved-original'` reason도 뺐다(남은 실패 이유는 `item-too-large` 하나).

## Task Commits

Each task was committed atomically (RED → GREEN):

1. **Task 1: 깨진 설정에서 '도우미 끄기' → storage.local 꺼짐 표시 → 모든 프레임 꺼짐(sync 불변)** — `4aab265` (test, RED) → `7e031c0` (fix, GREEN)
2. **Task 2: '도우미 켜기'는 꺼짐 표시만 지우고, 팝업은 이 PC 꺼짐 표시를 반영** — `f518c97` (test, RED) → `3cca741` (fix, GREEN)

**Plan metadata:** (오케스트레이터가 이 문서와 함께 커밋)

## Files Created/Modified
- `src/core/settings-schema.ts` - `HELPER_OFF_KEY`, `HelperOffV1`
- `src/worker/storage-writer.ts` - `setEnabled`가 `!read.ok` 분기에서 local 표시로 끄기/켜기 모두 처리, 멀쩡한 경로 켜기도 표시 정리, `SetEnabledResult`에서 `'preserved-original'` 제거
- `src/entrypoints/content.ts` - `helperOffOverride` 상태, 첫 읽기(`chrome.storage.local.get`), `syncEnabled()` 합성식, `handleSettingsStorageChange`의 local 분기
- `src/entrypoints/popup/main.ts` - `syncSettingsEnabled`·`helperOffOverride`·`renderHelperState()`, `loadInitial()`이 local도 함께 읽음, local `onChanged`가 두 키를 각자 처리, `PRESERVED_ORIGINAL_MESSAGE` 제거
- `tests/unit/storage-writer.test.ts` (신규) - fake `chrome.storage` 기반 단위 시험 6개(A~F)
- `tests/e2e/lifecycle.e2e.ts` - D-25 e2e 신규 2개, 기존 2개(경고 카드 시험·W1) 새 동작에 맞게 갱신

## Decisions Made
- **켜기 동작(objective 참고):** 설정이 깨져 있어도 켜기는 원본 보호로 거절하지 않는다 — D-25 잠긴 결정("다시 켜면 표시만 지운다") + 이미 기본값으로 돌던 실제 동작 + 거절 시 화면·실제 불일치 또는 영구 잠김이라는 세 근거.
- **꺼짐 표시 수명:** sync가 다른 기기 동기화로 스스로 고쳐져도 표시를 자동으로 지우지 않는다 — 이용자가 '도우미 켜기'를 누를 때만 지운다.
- **SetEnabledResult 타입 축소:** `'preserved-original'`을 제거했다(도달 불가) — `UpdateSettingsResult`는 범위 밖이라 그대로 둔다.

## Deviations from Plan

None - plan executed exactly as written(Task 1 action에서 켜기 분기를 Task 1 커밋에 먼저 넣을 뻔했으나, 계획대로 Task 1은 끄기만 처리하도록 되돌려 커밋 전에 바로잡았다 — 최종 diff는 계획 그대로).

## Issues Encountered

None.

## Known Stubs

없음 — 모든 코드 경로가 실제 storage.sync/storage.local을 다룬다.

## Threat Flags

없음 — 이번 변경은 PLAN.md `<threat_model>`에 이미 등록된 다섯 위협(T-pa1-01~05)만 건드렸고 새 신뢰 경계나 새 저장 키·메시지 종류를 추가하지 않았다.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- D-25(01-VERIFICATION.md의 deferred 항목)가 닫혔다 — SAFE-04 "방해되면 즉시 끌 수 있다"가 설정 손상 경계 상태에서도 참이다.
- 오케스트레이터 몫: 전체 게이트 `CI=true pnpm test`(helper-toggle.e2e.ts 등 팝업 도우미 카드를 쓰는 다른 시험의 회귀 확인 포함) → CLAUDE.md §4 Post-build(`/review`→`/qa`→`/cso`→`/ship`) 순서. 팝업 표시 로직이 바뀌었으니 §6 화면 검증(독립 DOM 감사 → `/design-review`) 필요 여부는 오케스트레이터가 판단(새 문구·색·요소는 없음).

---
*Phase: quick-260926-pa1*
*Completed: 2026-09-26*

## Self-Check: PASSED

- All 6 modified files verified present on disk (`src/core/settings-schema.ts`, `src/worker/storage-writer.ts`, `src/entrypoints/content.ts`, `src/entrypoints/popup/main.ts`, `tests/unit/storage-writer.test.ts`, `tests/e2e/lifecycle.e2e.ts`).
- All 4 task commit hashes verified in `git log --oneline --all` (`4aab265`, `7e031c0`, `f518c97`, `3cca741`).
