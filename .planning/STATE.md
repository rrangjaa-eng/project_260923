---
gsd_state_version: "1.0"
current_phase: 1
current_phase_name: 클릭 도우미 기반
status: executing
stopped_at: Completed 01-12-PLAN.md
last_updated: "2026-09-23T23:43:19.188Z"
last_activity: 2026-09-23
last_activity_desc: Phase 1 execution started
state_head: a7f404108e739231ecd98e727dad673c5d963da9
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 16
  completed_plans: 12
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-23)

**Core value:** 어느 사이트에서든 원하는 요소를 키 한두 번 또는 마우스를 대충 가져가는 것만으로 누를 수 있다. 되돌릴 수 없는 제출은 항상 이용자 확인 뒤에만 일어난다.
**Current focus:** Phase 1 — 클릭 도우미 기반

## Current Position

Phase: 1 (클릭 도우미 기반) — EXECUTING
Plan: 13 of 16
Status: Ready to execute
Last activity: 2026-09-23 — Phase 1 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 25min | 3 tasks | 12 files |
| Phase 01 P02 | 12min | 2 tasks | 11 files |
| Phase 01 P03 | 11min | 3 tasks | 9 files |
| Phase 01 P04 | 40min | 2 tasks | 11 files |
| Phase 01 P05 | 26min | 2 tasks | 8 files |
| Phase 1 P06 | 36min | 3 tasks | 14 files |
| Phase 01 P07 | 75min | 3 tasks | 15 files |
| Phase 01 P08 | 24min | 2 tasks | 9 files |
| Phase 01 P09 | 31min | 3 tasks | 11 files |
| Phase 01 P10 | 22min | 2 tasks | 10 files |
| Phase 01 P11 | 25min | 2 tasks | 8 files |
| Phase 01 P12 | 68min | 2 tasks | 6 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: 로드맵은 설계 10-1 만드는 순서를 그대로 따른다. 중간 이용자 시험은 Phase 2 체크포인트
- [Init]: granularity Coarse지만 승인된 순서 때문에 6개 phase
- [Phase 1]: playwright.config.ts 빌드는 별도 globalSetup 파일로(워커 재-import당 반복 빌드 방지), process.env.CI 분기는 forbidOnly로 config 자신에도 유지
- [Phase 1]: chrome.runtime.reload()가 이 샌드박스 헤드리스 크로미움에서 새 SW를 관찰 가능하게 깨우지 않아, 재시작 보존 e2e는 같은 user-data-dir로 close+relaunch하는 방식 사용
- [Phase 1]: @types/chrome 미승인 — src/types/chrome.d.ts에 이 계획이 쓰는 chrome.runtime/storage 표면만 최소 ambient 선언
- [Phase 1]: frameStates는 Map이 아니라 평범한 중첩 객체로 구현 — Playwright serviceWorker.evaluate 직렬화가 Map을 보존하지 않음
- [Phase 1]: TDD RED 확인은 check tdd-red-evidence 대신 수동 확인 — 그 도구는 node --test TAP 출력만 파싱해 Playwright e2e에는 적용 불가
- [Phase 1]: 떨림 필터·입력 파이프라인·모드 판정을 순수 함수/window capture로 구현, vitest.config.ts 신설(첫 단위 시험 추가 계획)
- [Phase 1]: Task 3 behavior 목록의 모드 표시 비키기 60px은 같은 계획의 다른 근거(must_haves·action·SYSTEM.md·D-26)와 모순되는 오타로 판단, 80px로 구현
- [Phase 1]: collector.ts는 NAMED_SELECTOR(항상 후보)와 CURSOR_TAGS(cursor:pointer 필요)를 분리해 role=button div가 pointer 스타일 없이도 잡히게 했다
- [Phase 1]: ring.ts는 --ring-offset을 하드코딩하지 않고 계산된 스타일에서 읽어 tokens.css와 항상 같은 값을 쓰게 했다
- [Phase 1]: content.ts의 자석 pointermove 처리는 타임스탬프 스로틀 대신 rAF 코얼레싱으로 바꿨다 — 스로틀은 간격 안 여러 이벤트 중 마지막 자리를 영영 놓치는 실제 버그가 있었다(Rule 1)
- [Phase 1]: 선행 조치: skeleton.e2e.ts 재시작 보존 시험의 간헐적 실패 두 근본 원인(서비스워커 API 바인딩 경쟁, onInstalled 기본값 쓰기 경쟁)을 systematic-debugging으로 찾아 고쳤다(fix(01-01))
- [Phase 1]: [Phase 1] shortcuts.html은 keydown을 window capture 한 곳에만 등록(도우미 꺼짐 시 카운터 이중 계수를 피하려는 설계 재량, plan '가정' 문단 범위 안)
- [Phase 1]: [Phase 1] onPress는 pointerdown 좌표로 evaluateMagnet()을 동기 재호출해, rAF로 미뤄진 자석 재계산 지연 경합(이동 직후 클릭 시 이전 요소가 대신 눌림)을 고쳤다(Rule 1)
- [Phase 1]: 핑거프린트 매치스코어(6키 중 2+ 일치, framePath 불일치시 0)로 요소 동일성 판정
- [Phase 1]: 힌트 순서: 핀 번호 우선 → 누른 횟수 내림차순 → 커서 거리 오름차순, 9개씩 페이지네이션
- [Phase 1]: recordPress는 sender.url 기반 origin과 요청 origin을 대조해 위조 방지(T-01-16), press 기록은 200건 상한
- [Phase 1]: RESEARCH A2 정정: chrome.runtime.getFrameId는 Chrome에 없다(Firefox 전용) — 각 프레임이 스스로 계산하는 창 위치 경로(selfPath)와 부모의 상대 순번(index)을 relay.ts가 맞추는 방식으로 프레임 식별을 재설계
- [Phase 1]: relay.ts: 형제 iframe이 지워져 순번이 당겨지면 옛 경로의 보고를 지우고 frame/refresh를 방송해 모든 프레임이 즉시 다시 계산·보고하게 한다
- [Phase 1]: 번호표 키 판단은 항상 맨 위 프레임에서만 — 자식 프레임은 hints/key로 전달만 한다
- [Phase 1]: danger 후보 우선순위: 범위 안 일반 후보가 있으면 항상 그것을 먼저 잡는다 — danger는 일반 후보가 전혀 없을 때만, 거리 0(커서가 사각형 안)에서만, 히스테리시스 없이 본다
- [Phase 1]: 배경 없는 오버레이 글자('! 위험')의 흰 후광은 box-shadow 대신 text-shadow 네 방향 오프셋으로 흉내낸다
- [Phase 1]: 스페이스바 '누르고 있기' 판정은 native repeat에 기대지 않고, guard가 keydown 시각만 기록하고 pipeline이 모달 중 100ms tick으로 holdMs 경과를 직접 폴링한다
- [Phase 1]: 확인 버튼에는 클릭 리스너를 아예 달지 않아 포인터로는 절대 확인되지 않게 했다(T-01-25) — 취소 버튼만 isTrusted+보호 시간 통과 뒤 클릭을 받는다
- [Phase 1]: 다른 프레임 항목의 확인 화면 이름은 frame/report에 name이 실리지 않아 fingerprint(buttonText→labelText→aria→id) 순으로 최선 추정한다
- [Phase 1]: 확인 화면은 항상 맨 위 프레임에서 열리고 보호·누르고 있기 시간도 맨 위 시계로만 잰다 — 자식 프레임은 confirm/state·confirm/key로 판단 없이 중계만 한다
- [Phase 1]: rAF 루프 정지 시 dwellTimer.update({targetId:null,...})를 명시적으로 먹여 재무장 보장(Rule 1 버그 수정)
- [Phase 1]: updateSettings patch는 dwellEnabled·dragTwoPress만 허용하는 zod strict — dwellMs 등 수치 설정은 이 op 범위 밖
- [Phase 1]: popup 카드 생성 로직을 createCard 팩토리로 추출해 카드 2개 이상에서 재사용
- [Phase 1]: 자석 클릭은 dragTwoPress 대상(끌 수 있거나 끌기 시작 중)이면 '요소 위 클릭 통과' 예외를 건너뛰고 삼킨다 — 안 그러면 두 번 누르기가 동작하지 않는다
- [Phase 1]: 연습 사이트 #drop을 role=button+cursor:pointer로 만들어 collector 후보 조건을 만족시켰다(놓을 곳도 기존 누르기 경로로 잡혀야 함)
- [Phase 1]: 도우미 전체 꺼짐에서 끌기 시작 상태(dragTwoPress.cancel)와 힌트도 함께 정리한다 — 상태 누수 방지
- [Phase 1]: select 판정 기준을 ArrowDown·Enter 값 변경에서 focus 이동+차단 메시지 없음으로 변경 — 헤드리스 select 팝업 키보드 탐색 한계
- [Phase 1]: showPicker()는 트리거(스페이스바·머무르기)와 무관하게 이 샌드박스에서 항상 성공 — RESEARCH.md 가정과 다름
- [Phase 1]: 네이티브 팝업 간섭 완화: page.close()+명시적 팝업 닫기+타임아웃 확대+spike.e2e.ts 파일 범위 retries:1

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1 착수 전: 이용자 회사 PC가 확장 설치를 막는지 확인 필요(설계 11장 ②)
- Phase 1 첫 스파이크: 회사 시스템이 확장이 만든 클릭(isTrusted=false)을 받는지(11장 ①), 사이트 단축키보다 도우미 키가 먼저 받는지(11장 ④)
- GSTACK REVIEW REPORT에서 디자인 리뷰·엔지니어링 리뷰가 PENDING — UI가 있는 Phase 1 계획 전에 저장소 워크플로대로 처리
- 웨일의 `chrome.storage.sync` 동작 미확인 — 파일 내보내기·가져오기를 기본 수단으로
- 저장소 루트 CLAUDE.md의 제품·스택 설명은 다른 제품(PLANT8 ERP) — 규칙만 적용

### Roadmap Evolution

- Phase 1 edited: edited fields: success_criteria (4: 11장 ① 스파이크는 Phase 1에서 로컬 연습 사이트만, 회사 시스템 확인은 Phase 2 — 엔지니어링 검토 7번 = B)

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-09-23T23:43:19.139Z
Stopped at: Completed 01-12-PLAN.md
Resume file: None
