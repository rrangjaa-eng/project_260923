---
phase: 01-click-helper-foundation
plan: 15
subsystem: ui
tags: [chrome-extension-mv3, shadow-dom, css-custom-properties, playwright, zoom]

# Dependency graph
requires:
  - phase: 01-click-helper-foundation
    provides: "오버레이 shadow root(ensureOverlayRoot, Plan 01-01)·강조 테두리(Plan 01-03)·번호표(Plan 01-06)·확인 화면(Plan 01-09)·토스트(Plan 01-14) — 모두 tokens.css 변수만 쓰는 컴포넌트"
provides:
  - "zoom/query(content→SW, 답 { zoom })·zoom/changed(SW→탭의 모든 프레임, T-01-47: 0.25~5 범위만) 메시지"
  - "background.ts: chrome.tabs.getZoom으로 zoom/query에 답하고 chrome.tabs.onZoomChange에서 zoom/changed 방송"
  - "mode-indicator.ts: ensureOverlayRoot()가 zoom 구독을 시작하고 shadow host에 --overlay-scale(1/비율)을 두는 생명주기, getOverlayScale() export"
  - "ring.ts·hints.ts·confirm-dialog.ts·toast.ts·mode-indicator.ts의 모든 크기 CSS 값이 calc(토큰 * var(--overlay-scale))"
  - "content.ts openChapter()가 placeLabels()에 28 × 배율을 넘겨 번호표 겹침 판정을 화면 크기로 함"
affects: [overlay, click-helper-ui]

# Actuals (#2632)
actuals:
  tokens: 11313
  tasks: 2
  commits: 4
plan_head_before: 01a8feb2d3ca29ee2e2d5c9dbe4ab63e6f96e85c

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "확대 역보정: SW가 chrome.tabs.getZoom/onZoomChange로 알려 준 비율의 역수를 shadow host의 --overlay-scale 커스텀 프로퍼티에 담고, 모든 오버레이 컴포넌트는 크기 값에만 calc(토큰 * var(--overlay-scale))을 곱한다(위치는 그대로)"
    - "getOverlayScale()은 hostElement.style.getPropertyValue로 읽는다 — 리터럴로 set한 값이라 안전하지만, calc()/var()로 정의된 커스텀 프로퍼티는 getComputedStyle이 되돌려 주지 않는다(브라우저가 미해석 채로 특정 값을 돌려주는 알려진 함정) — 그래서 JS가 위치를 계산할 때 필요한 배율은 반드시 이 방식으로 얻고, 실제 렌더 크기는 실제 CSS 속성(border-width 등)의 calc()에만 맡긴다"

key-files:
  created: []
  modified:
    - src/shared/messages.ts
    - src/entrypoints/background.ts
    - src/entrypoints/content.ts
    - src/page/overlay/mode-indicator.ts
    - src/page/overlay/ring.ts
    - src/page/overlay/hints.ts
    - src/page/overlay/confirm-dialog.ts
    - src/page/overlay/toast.ts
    - src/types/chrome.d.ts
    - tests/e2e/zoom.e2e.ts

key-decisions:
  - "getOverlayScale()은 hostElement의 인라인 style(리터럴 값)에서 읽는다 — 파생 계산값(calc(var(--ring-offset) * var(--overlay-scale)) 같은 커스텀 프로퍼티)을 getComputedStyle로 읽으면 브라우저가 미해석 문자열을 돌려줄 수 있어(널리 알려진 CSS 커스텀 프로퍼티 함정), 위치 계산에 쓰는 배율은 항상 원본 토큰 값(--ring-offset 등, 리터럴) × JS의 getOverlayScale()로 직접 곱한다"
  - "mode-indicator.ts의 zoom/changed 구독은 자체 AbortController를 만들어 destroyOverlayRoot()에서 abort한다 — content.ts의 magnetController/pipelineController를 관통시키지 않고 오버레이 생명주기(ensureOverlayRoot/destroyOverlayRoot)에 직접 묶어 도우미 켜짐/꺼짐마다 자연히 구독·해제된다"
  - "ring.ts의 --ring-offset·--space-2 오프셋 캐시(모듈 전역 변수)를 없애고 showRing() 호출마다 다시 읽는다 — 확대가 바뀌어도(도우미가 계속 켜져 있는 한) 다음 자석 재계산 때 곧바로 새 배율이 반영된다"

requirements-completed: [CLICK-01, CLICK-03]

coverage:
  - id: D1
    description: "확대 비율 전달(zoom/query·zoom/changed)과 모드 표시 크기 고정 — 2.0/1.1/0.8배 모두, 500ms 안 반영, 확대 전/후에 연 탭 모두"
    requirement: "CLICK-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/zoom.e2e.ts#확대 2.0배에서 모드 표시 글자 크기·상자 높이가 1배율과 같은 화면 크기다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/zoom.e2e.ts#확대 1.1배·0.8배에서도 모드 표시 글자 크기가 화면에서 18px로 보인다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/zoom.e2e.ts#탭을 열어 둔 채 확대를 바꾸면 500ms 안에 모드 표시가 다시 맞춰진다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/zoom.e2e.ts#확대 전에 연 탭과 확대 뒤에 연 탭(같은 출처) 모두 모드 표시 크기가 맞다"
        status: pass
    human_judgment: false
  - id: D2
    description: "강조 테두리·번호표·확인 화면·알림의 크기가 200%/80%에서도 화면 크기로 유지되고, 테두리·번호표 위치는 요소를 그대로 따라간다"
    requirement: "CLICK-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/zoom.e2e.ts#200%에서 잡힌 요소의 테두리 두께·바깥 간격이 화면 크기로 유지되고 테두리 상자가 요소를 감싼다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/zoom.e2e.ts#200%·80%에서 번호표 너비가 화면 크기로 유지되고 번호표끼리 겹치지 않는다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/zoom.e2e.ts#200%에서 확인 카드 너비·버튼 높이가 화면 크기로 유지된다"
        status: pass
      - kind: e2e
        ref: "tests/e2e/zoom.e2e.ts#200%에서 알림(토스트) 글자 크기가 화면 크기로 유지된다"
        status: pass
    human_judgment: false

duration: (이어진 세션, 정확한 벽시계 시간 미기록)
completed: 2026-09-24
status: complete
---

# Phase 1 Plan 15: 확대·축소와 상관없이 오버레이 크기 고정 Summary

**`chrome.tabs.getZoom`/`onZoomChange`로 SW가 알려 준 확대 비율의 역수를 오버레이 shadow host의 `--overlay-scale` 커스텀 프로퍼티에 담고, 모드 표시·강조 테두리·번호표·확인 화면·토스트의 모든 크기 CSS 값에 `calc(토큰 * var(--overlay-scale))`을 곱해 브라우저 확대·축소와 무관하게 화면에서 항상 같은 크기로 보이게 했다.**

## Performance

- **Tasks:** 2/2 완료
- **Files modified:** 10
- **Commits:** 4 (RED/GREEN × 2 tasks)

## Accomplishments
- `zoom/query`(content → SW, 답 `{ zoom }`)·`zoom/changed`(SW → 탭의 모든 프레임, T-01-47: zod로 0.25~5 범위만) 메시지 추가.
- `background.ts`: `chrome.tabs.getZoom`으로 `zoom/query`에 답하고, `chrome.tabs.onZoomChange`에서 `zoom/changed`를 그 탭의 모든 프레임에 방송(보낼 곳이 없으면 무시).
- `mode-indicator.ts`: `ensureOverlayRoot()`가 호스트 생성 때 자체 `chrome.runtime.onMessage` 구독(`AbortController`로 `destroyOverlayRoot()`에서 해제)을 시작해 `zoom/query`를 보내고 `zoom/changed`를 받아 shadow host에 `--overlay-scale(1/비율)`을 둔다. `getOverlayScale()`을 export해 다른 오버레이 컴포넌트와 `content.ts`가 위치 계산에 쓴다.
- 모드 표시·강조 테두리(후광·radius 포함)·번호표(본체·위험 태그·다음 카드)·확인 화면(카드·버튼·키)·토스트의 모든 크기 CSS 값을 `calc(var(--토큰) * var(--overlay-scale))`로 바꿨다. 위치(요소 사각형 좌표, `transform: translate`)는 그대로 — 강조 테두리의 `--ring-offset`·번호표 위험 태그의 `--space-2` 간격만 JS에서 `getOverlayScale()`을 곱해 화면 크기와 일치시킨다.
- `content.ts`의 `openChapter()`는 `placeLabels(entries, 28 * getOverlayScale())`로 호출해, 번호표 겹침 회피 배치도 실제 화면 크기(28px × 배율) 기준으로 계산한다.
- `tests/e2e/zoom.e2e.ts` 신규(8개): 2.0·1.1·0.8배에서 모드 표시 크기, 500ms 안 반영, 확대 전/후에 연 탭, 200%에서 테두리 두께·간격·감쌈, 200%·80%에서 번호표 너비·겹침, 200%에서 확인 카드·버튼 크기, 200%에서 토스트 글자 크기.

## Task Commits

Each task was committed atomically (RED → GREEN):

1. **Task 1: 확대 비율 전달과 오버레이 배율 변수(모드 표시부터)** — `3878d98` (test, RED) → `3c387a3` (feat, GREEN)
2. **Task 2: 테두리·번호표·확인 화면·알림에 배율 적용** — `33c353f` (test, RED) → `6b87bd2` (feat, GREEN)

**Plan metadata:** (이 커밋 자체)

## Files Created/Modified
- `src/shared/messages.ts` - `zoom/query`·`zoom/changed`(zod 0.25~5 범위) 메시지 스키마 추가
- `src/entrypoints/background.ts` - `zoom/query` 응답(`chrome.tabs.getZoom`), `chrome.tabs.onZoomChange` → `zoom/changed` 방송
- `src/entrypoints/content.ts` - `getOverlayScale` import, `openChapter()`의 `placeLabels` 호출에 `28 * getOverlayScale()` 전달
- `src/page/overlay/mode-indicator.ts` - `subscribeToZoom`/`applyOverlayScale`/`getOverlayScale`, `ensureOverlayRoot`/`destroyOverlayRoot`에 zoom 생명주기 연결, 모드 표시 CSS에 `--overlay-scale`
- `src/page/overlay/ring.ts` - 테두리·후광·radius·위험 글자 CSS에 `--overlay-scale`, `showRing`/`setDwellProgress`가 `getOverlayScale()`로 오프셋·두께 재계산
- `src/page/overlay/hints.ts` - 번호표 본체·위험 태그·다음 카드 CSS에 `--overlay-scale`, `showHints`의 `labelSizePx`/`gapPx`에 배율 적용
- `src/page/overlay/confirm-dialog.ts` - 카드·제목·본문·안내줄·버튼·키 CSS에 `--overlay-scale`
- `src/page/overlay/toast.ts` - 여백·글자·테두리·radius CSS에 `--overlay-scale`
- `src/types/chrome.d.ts` - `chrome.tabs.getZoom`/`setZoom`/`onZoomChange`, `chrome.runtime.onMessage.removeListener` 최소 타입 추가
- `tests/e2e/zoom.e2e.ts` (신규) - 확대 무관 크기 e2e 8개

## Decisions Made
- **`getOverlayScale()`은 hostElement의 인라인 style(리터럴 값)에서 읽는다.** `calc(var(--ring-offset) * var(--overlay-scale))` 같은 파생 커스텀 프로퍼티를 `getComputedStyle().getPropertyValue()`로 읽으면 브라우저가 미해석 문자열("calc(...)")을 그대로 돌려줄 뿐 픽셀 값으로 계산해 주지 않는다(CSS 커스텀 프로퍼티의 잘 알려진 함정 — 미등록 커스텀 프로퍼티의 계산값은 지정값 그대로다). 그래서 위치 계산이 필요한 JS 쪽은 항상 원본 토큰(리터럴, `--ring-offset` 등) × `getOverlayScale()`을 직접 곱하고, 실제 렌더 크기(테두리 두께 등)는 실제 CSS 속성의 `calc()`에만 맡긴다 — `magnet.e2e.ts`가 이미 `borderTopWidth`를 이 방식(실제 속성 계산값)으로 검증해 왔다는 사실로 확인.
- **`mode-indicator.ts`의 zoom 구독은 자체 `AbortController`를 쓴다.** `content.ts`의 `magnetController`/`pipelineController`를 관통시키지 않고 `ensureOverlayRoot()`/`destroyOverlayRoot()` 생명주기에 직접 묶었다 — 도우미가 켜지고 꺼질 때마다(호스트가 새로 생기고 사라질 때마다) 자연히 다시 구독·해제되며, 오버레이 관련 상태를 mode-indicator.ts 한 파일 안에 유지한다.
- **`ring.ts`의 `ringOffsetPx`/`labelGapPx` 모듈 전역 캐시를 없앴다.** 기존 코드는 `ensureRingElement()`가 처음 호출될 때 한 번만 읽어 캐시했는데, 확대가 바뀌면 이 캐시가 낡아 위치 계산이 틀어진다. `showRing()`이 호출될 때마다 다시 읽도록 바꿔, 다음 자석 재계산(포인터 이동) 때 곧바로 새 배율이 반영되게 했다.

## Deviations from Plan

### Auto-fixed Issues

없음 — 계획대로 실행했다. `src/types/chrome.d.ts`는 이 계획의 `files_modified` 목록에 명시되지 않았지만, Plan 01-01 이후 계속 지켜 온 관행("이 계획들이 실제로 쓰는 표면만 선언")대로 `chrome.tabs.getZoom`/`setZoom`/`onZoomChange`, `chrome.runtime.onMessage.removeListener` 최소 타입을 추가했다 — `@types/chrome`가 승인 목록에 없어 이 파일이 유일한 타입 출처이고, background.ts·mode-indicator.ts 구현에 반드시 필요했다(Rule 3, blocking).

---

**Total deviations:** 0 (Rule 4 architectural 없음, chrome.d.ts 확장은 기존 관행의 연장)
**Impact on plan:** 없음.

## Issues Encountered

**RED 테스트 설계 실수 하나 발견·수정(TDD 무결성).** Task 1의 "500ms 안에 다시 맞춰진다" e2e를 처음 `toBeGreaterThanOrEqual(17.5)`만으로 썼더니, 구현 전 상태(글자 크기가 확대와 무관하게 18px 고정)에서도 `18 * 2 = 36 >= 17.5`라 그대로 **통과**해 버렸다(가짜 RED, `learned_after_01_14`의 "구현 전후로 똑같이 통과하면 안 된다" 위반). 상한(`<= 18.5`)도 함께 검사하도록 `expect.poll`의 조건을 불리언 판정으로 고쳐 실제로 실패하는 것을 확인한 뒤 진행했다.

**강조 테두리 위치(offset)는 확대가 바뀐 직후 자동으로 다시 그려지지 않는다(설계 범위 안, 알아 둘 점).** 테두리 두께·후광 등은 순수 CSS `calc(var(--overlay-scale))`라 확대가 바뀌면 브라우저가 스스로 다시 그리지만, `showRing()`이 계산하는 위치(`transform: translate`, `--ring-offset` 오프셋)는 자석 재계산이 다시 돌 때(다음 포인터 이동)만 새 배율을 반영한다. 계획의 Task 2 behavior는 이를 "확대 상태에서" 정적으로만 요구했고(Task 1의 "0.5초 안"은 모드 표시에만 해당) 커서가 멈춰 있는 채로 확대만 바뀌는 극히 드문 경우에만 테두리가 아주 잠깐(다음 포인터 이동 전까지) 두께만 바뀌고 위치는 옛 배율 그대로일 수 있다 — 기능 결함이 아니라 실사용에서 거의 발생하지 않는 타이밍 특성이라 판단해 범위를 넓히지 않았다.

## Known Stubs

없음 — 모든 코드 경로가 실제 확대 비율·실제 요소 좌표를 다룬다.

## Known Gaps

없음 — CLICK-01·CLICK-03의 "확대와 상관없이 크기 고정" 요구는 e2e 8개로 자동 검증했다(RESEARCH.md A5 [ASSUMED]를 이 계획의 e2e로 확인 완료).

## Next Phase Readiness
- `getOverlayScale()`은 이후 계획이 오버레이에 새 부품을 추가할 때 그대로 재사용할 수 있다(같은 `calc(토큰 * var(--overlay-scale))` 패턴).
- Phase 3의 "표시 크기" 설정(SYSTEM.md)은 이 계획이 만든 `--overlay-scale`과는 별개 축(확대 보정 vs 이용자가 고른 크기)이므로, 그때 값을 곱해 합성하는 자리가 이미 정해져 있다(`--overlay-scale` 계산에 이용자 배율을 추가로 곱하면 된다).

---
*Phase: 01-click-helper-foundation*
*Completed: 2026-09-24*

## Self-Check: PASSED

- All 10 created/modified files verified present on disk (`src/shared/messages.ts`, `src/entrypoints/background.ts`, `src/entrypoints/content.ts`, `src/page/overlay/mode-indicator.ts`, `src/page/overlay/ring.ts`, `src/page/overlay/hints.ts`, `src/page/overlay/confirm-dialog.ts`, `src/page/overlay/toast.ts`, `src/types/chrome.d.ts`, `tests/e2e/zoom.e2e.ts`).
- All 4 task commit hashes verified in `git log --oneline --all` (`3878d98`, `3c387a3`, `33c353f`, `6b87bd2`).
