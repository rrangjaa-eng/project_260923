# 단일 스위치 웹 활동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. 각 단계는 아래 체크박스로 추적한다. 실행 방식 권고: 현재 클라우드에서 직접 순차 구현·검증.

**Goal:** 스페이스바 한 번 누르고 놓기만으로 새 한글 검색어 작성·수정부터 검색, 결과 읽기, 뒤로, 탭 전환까지 완료한다.

**Architecture:** 순수 상태 엔진이 입력의 소유권과 실행 요청을 결정하고 기존 수집·프레임 중계·클릭 어댑터를 재사용한다. 최상위 작업판만 스캔을 소유한다. 문서 세대와 actionId를 검증해 중복·옛 대상 실행을 막는다.

**Tech Stack:** 기존 WXT·TypeScript strict·zod·Vitest·Playwright, pnpm 10.33.0. 새 의존성·서버·AI 없음.

**진행 기록 (2026-10-01 18:25 KST):** 승인된 단계별 실행을 유지한다. 분리 파일 이름은 일부 통합(`switch-controller`/`switch-relay`)으로 조정했다. 체크는 아래 문장의 전체 계약을 확인한 경우만 표시하며 미검증 세부 항목·PC 시험을 일괄 완료하지 않는다. 실제 증거는 [안전·검증 보고](../../verification/2026-10-01-single-switch-phase1.md)와 현황표에 연결한다.

**Spec:** [승인된 1차 설계](../specs/2026-10-01-single-switch-phase1-design.md). 사용자 승인 전달: 2026-10-01 KST. 이 계획·기존 클라우드 직접 실행 방식은 `진행해`로 승인됐다. [현재 프로젝트 매핑/진행](2026-10-01-single-switch-project-map.md), [현황](../../WORK-STATUS.md), [draft PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15)을 따른다. 아래 체크박스는 전체 계약 기준이며 일부 여정 pass만으로 모든 단계를 완료 처리하지 않는다.

## Global Constraints

- 필수 입력은 스페이스 down/up 한 쌍. 길게 누르기·조합키·숫자·정밀한 마우스 이동을 요구하지 않는다.
- 순환 기본 1500ms, 800~4000ms. 첫 항목 2배 시간. 재입력 보호 300ms, 100~1000ms. 2회 무선택 완주 시 쉬기. 무입력은 동의가 아니다.
- 자석·떨림·dwell 기존 모드를 보존하고 모든 실행을 공통 경계로 통합한다. 자동 스크롤 중 첫 입력은 정지만 한다.
- docs/design/SYSTEM.md·tokens.css 준수. 페이지 밖 전역 정지, 모든 사이트, 실제 운동 사용성 검증 완료를 주장하지 않는다.
- 현재 브라우저 경로 보존, 환경 재생성·설치·인증 복사 금지. cloud Node24.19.0 / CI Node22 차이는 단계 1에서 분리한다.
- 구현 gpt-6.1-sol/medium, 복잡한 디버깅·설계·검토 gpt-6.1-sol/high, 조회·전달 gpt-6-luna/low를 시작 쪽에서 명시한다. 사용 불가 시 보고한다.
- 각 코드 단계는 실패 테스트→최소 구현→통과 순서. 단계별 파일만 커밋하고 docs/WORK-STATUS.md를 갱신한다. push·PR은 개발의 선행조건이 아니다.

## Review Focus

- 포커스가 Shadow DOM·다른 출처 편집기로 이동할 때 상태 표시와 실제 입력 소유권 일치: 단계 1·2.
- keyup 유실·합성 키·composition의 스페이스가 선택/확정으로 변환되지 않음: 단계 2·5.
- 늦게 온 프레임 응답·worker 재시작·DOM 교체가 옛 실행을 되살리지 않음: 단계 3·7.
- 외부에서 입력값이 변경됐거나 민감칸을 선택했을 때 초안 덮어쓰기·저장 방지: 단계 5.
- 탭이 닫히거나 타이머가 지연돼도 재개 입력은 실행으로 재사용되지 않음: 단계 6·7.

## 공통 인터페이스 (단계 2에서 정의)

`src/core/switch-engine.ts`에 다음 타입과 함수를 둔다. 상태와 액션 데이터는 JSON 직렬화 가능하며 DOM 참조를 포함하지 않는다.

- `SwitchTarget = { tabId: number; frameId: number; documentGeneration: string; itemId: string }`.
- `SwitchAction = { actionId: string; modeGeneration: number; kind: 'press'|'applyText'|'search'|'scrollStep'|'scrollStart'|'scrollStop'|'back'|'activateTab'; target?: SwitchTarget; text?: string; tabId?: number; direction?: 'up'|'down' }`.
- `SwitchState`: mode는 설계 §5의 9개 상태, scanIndex/cycleCount, draft, resume 위치, modeGeneration, pendingAction을 보유.
- `SwitchEvent`: `start`, `keyDown`, `keyUp`, `tick`, `setItems`, `pause`, `resume`, `invalidate`, `actionResult`, `compose`의 판별 유니온. 시간은 `now: number`, 키는 `code/repeat/trusted/isComposing`를 명시. keyDown 시 선택 ID를 고정한다.
- `createSwitchState(): SwitchState`, `reduceSwitch(state: SwitchState, event: SwitchEvent): { state: SwitchState; actions: SwitchAction[] }`.
- 페이지 어댑터 `executeSwitchAction(action: SwitchAction): Promise<'done'|'refused'|'unknown'>`. 이 함수만 DOM·chrome API 실행으로 연결한다. 위험 요청은 confirming을 거쳐 새 actionId로 확정하며 자동 재전송하지 않는다.

### 단계 1: 기존 입력/조합 실패를 좁혀 해결

**파일:** 기존 `src/page/input/mode.ts`, `pipeline.ts`, `src/page/overlay/mode-indicator.ts`; 재현에 따라 `content.ts`. 검사 `tests/e2e/doc-editor.e2e.ts`, `editor-frames.e2e.ts`, `input-filter.e2e.ts`. 재현 로그는 `/tmp`.

- [ ] systematic-debugging을 읽고 기존 2개 실패 이름으로 `CI=true pnpm exec playwright test tests/e2e/doc-editor.e2e.ts --grep 'frame-cebody|frame-design에서 초점 옮기기' --workers=1` 실행. 실패하면 activeElement·frame·mode·composition 이벤트 순서를 테스트 로그로 수집한다. 여러 전체 E2E를 반복하지 않는다.
- [ ] Node는 현재 환경을 그대로 두고 CI Node22 로그와 같은 좁은 사례를 비교한다. Node22 실행환경이 없으면 그 검증은 미실행으로 표시한다. 승인된 후속 환경 설정에서만 Node22를 고정하는 방향을 기록하고 이번에 설치·PATH 변경은 하지 않는다. 차이만으로 원인을 단정하지 않는다.
- [ ] 증거가 가리키는 경계에 최소 회귀 assertion을 추가한다: 클릭 후 typing, Esc 후 helper, CDP 조합 삽입 0, 캐럿 복원. 먼저 실패를 확인한 뒤 해당 경계만 수정한다. 간헐 통과라면 해결로 표시하지 말고 실행 횟수·관측을 기록한다.
- [ ] 해당 테스트와 editor-frames/input-filter를 통과시킨다. 완료조건: 알려진 2개 재현의 기대 mode 일치와 composition 보호, 신규 실패 0. 미해결이면 편집기 통합 확장을 정지하고 조사 결과를 보고한다.
- [ ] 단계 파일만 `fix: preserve editor input mode ownership` 의도로 커밋. 실제 PC IME 공존 검증은 별도 남긴다.

### 단계 2: 공통 엔진과 한 번 누름 수직 연결

**파일:** 새 `src/core/switch-engine.ts`, `src/page/input/switch-controller.ts`, `tests/unit/switch-engine.test.ts`, `tests/e2e/switch-engine.e2e.ts`; 변경 `pipeline.ts`, `content.ts`.

- [ ] 단위 테스트 `locks_item_on_keydown`은 A에 down→tick→up 뒤 액션 대상 A·횟수1, `repeat_and_orphan_up_do_nothing`은 액션0, `blur_discards_press`는 down→pause→up 뒤 액션0을 검증한다. 300ms 보호, trusted=false·isComposing=true·조합키도 액션0. 실패 확인.
- [x] 공통 인터페이스와 reducer를 구현한다. tick은 scanIndex만 변경하고 액션을 확정하지 않는다. 목록/모드 변경 때 눌림과 dwell 상태를 초기화한다.
- [x] `switch-controller.ts`가 정규화 이벤트를 reducer에 전달하게 한다. 단일 스위치 모드의 Space는 페이지 keydown/keypress/keyup에 새지 않으며 일반 입력 모드는 기존 composition을 통과시킨다.
- [x] 단위 파일과 E2E에서 연습 링크 하나를 스페이스 한 번으로 실행하고 클릭 카운트1, 기본 스크롤0을 확인한다. 완료조건: 한 개 실제 대상까지 엔진→어댑터 수직 연결 통과.
- [x] `feat: add single switch input engine` 의도로 해당 파일만 커밋.

### 단계 3: 프레임/실행 경계와 중복 방지

**파일:** 새 `src/page/input/switch-actions.ts`, `src/core/switch-actions.ts`, `tests/unit/switch-actions.test.ts`, `tests/e2e/switch-actions.e2e.ts`; 변경 `content.ts`, `src/shared/messages.ts`, `src/worker/relay.ts`, `background.ts`.

- [ ] 테스트 `same_action_once`, `dwell_key_race_once`, `stale_document_refused`, `lost_reply_no_retry`를 실패시킨다. 같은 actionId 수락1, 경쟁 클릭 합계1, 옛 세대 클릭0, unknown 후 재전송0을 단정한다.
- [x] actionId와 세대 검증·처리중 잠금을 순수 실행 가드에 구현한다. 대상 프레임은 실행 직전 연결/활성/세대/위험 의미를 다시 검사한다. 재연결 뒤 pending은 unknown으로 폐기한다.
- [x] zod 판별 메시지에 실행 요청/결과·frame generation을 추가하고 sender tab/frame/id를 검증한다. 기존 `pressOrDrag`, dwell, hint 실행을 공통 어댑터로 연결하되 기존 모드 기능은 보존한다.
- [x] 해당 단위/E2E 및 `press.e2e.ts`, `dwell.e2e.ts`, `frames.e2e.ts` 실행. 완료조건: 프레임 이동 후 옛 실행0, 기존 기능 신규 실패0.
- [x] `feat: unify guarded switch actions` 의도로 커밋.

### 단계 4: 안정된 순환 작업판과 설정

**파일:** 새 `src/core/switch-order.ts`, `switch-settings.ts`, `src/page/overlay/switch-panel.ts`, `tests/unit/switch-order.test.ts`, `switch-settings.test.ts`, `tests/e2e/switch-panel.e2e.ts`; 변경 `content.ts`, `src/worker/storage-writer.ts`, `src/entrypoints/popup/main.ts`, `docs/design/SYSTEM.md`, `DECISIONS.md`.

- [ ] 테스트 `stable_snapshot`에 DOM 삽입·사용빈도·커서 이동 후 기존 순서 불변, 삭제 대상 클릭0을 단정한다. `fixed_groups`에 찾기/페이지 항목/읽기·이동/글쓰기/조절·쉬기 순서와 상위로·쉬기를 확인한다. 실패 확인.
- [ ] 별도 버전1 `switchSettings` 저장키를 기존 단일 저장자로 다룬다. 기존 settings V1 마이그레이션 없이 조작 방식·순환/보호 값 범위를 검증하고 기본은 기존 마우스 모드로 보존한다. 준비 시 선택한 단일 스위치 모드에서는 첫 Space로 ready→groupScan.
- [ ] 프레임 순서+DOM 순서 스냅샷, 6개 묶음과 이전/다음 묶음, 명시적 목록 새로 읽기를 구현한다. 작업판은 기존 Shadow root/토큰을 재사용하며 숫자키 없이 모든 제어 선택 가능.
- [ ] 해당 검사와 `CI=true pnpm exec playwright test tests/e2e/dom-audit.e2e.ts tests/e2e/switch-panel.e2e.ts`를 실행한다. 1500ms·첫 항목3000ms·두 바퀴 무선택 쉬기, 재개 입력 액션0을 검증. 디자인 결정과 단일 스위치 키 안내를 반영한다.
- [ ] `feat: add stable scanning task panel` 의도로 커밋.

### 단계 5: 한글 조합·편집·문구와 안전한 적용

**파일:** 새 `src/core/hangul-compose.ts`, `text-draft.ts`, `src/page/input/text-target.ts`, `src/page/overlay/switch-editor.ts`, `tests/unit/hangul-compose.test.ts`, `text-draft.test.ts`, `tests/e2e/switch-text.e2e.ts`; 변경 engine/panel/storage-writer/messages.

- [ ] 테스트 `compose_new_sentence`에서 초성/중성/없음 포함 종성으로 `안녕하세요` 생성, `edit_middle`, `space_is_command`에서 중간 수정·공백 선택·물리 Space의 직접 삽입0을 검증하고 실패 확인. 쌍자음·겹모음·겹받침도 포함한다.
- [x] `composeHangul(initial: number, medial: number, final: number): string`과 draft reducer를 구현한다. 완성 음절의 Unicode 조합, 미완성 단계 취소, 보이는 문자 단위 이동/삭제/되돌리기/문구 삽입을 제공한다.
- [ ] `captureTextTarget(target: SwitchTarget)`은 input/textarea의 값·선택을 snapshot으로 잡고, `applyDraft(snapshot, text): 'done'|'refused'`는 세대·연결·원래 값 검증 후 input 이벤트로 적용한다. 일반 검색 입력만 첫 지원; rich editor 자동 적용은 거절하고 초안 보존.
- [x] E2E `external_value_change_refuses`, `pause_keeps_partial_syllable`, `sensitive_never_saved`를 실행한다. 세션 초안은 탭별 chrome.storage.session, 저장 문구는 명시적 저장만 local. password/민감칸은 초안 저장·문구 수집 제외. 타이핑 composition Space는 선택0. 완료조건: 저장 문구에 없는 한글 문장 작성·수정·적용이 Space만으로 성공.
- [ ] `feat: add switch based Korean text editing` 의도로 커밋.

### 단계 6: 검색·읽기·스크롤·뒤로·탭 전환

**파일:** 새 `src/page/input/switch-navigation.ts`, `tests/practice-site/switch-search.html`, `switch-results.html`, `switch-article.html`, `tests/e2e/switch-journey.e2e.ts`; 변경 switch-actions/panel/relay/background 및 `src/types/chrome.d.ts`의 필요한 tabs API 선언.

- [ ] 테스트 `space_only_search_read_back_tab`에 검색어 적용→명시적 검색 동작→결과 링크 선택→본문 확인→한 화면 이동→뒤로→열린 지원 탭 이동을 정의한다. 입력 드라이버는 `page.keyboard.press('Space')`만 사용하고 마우스/Enter/직접 DOM 클릭 없이 실패 확인한다.
- [x] 검색은 대상 사이트의 실제 form/requestSubmit 또는 검증된 검색 버튼을 어댑터로 실행한다. Enter 합성·사이트 요청 직접 호출은 사용하지 않는다. 결과는 page collector 대상 목록에서 선택한다.
- [x] 읽기 단계·자동 스크롤, history.back, sender 탭 검증을 거친 chrome.tabs.update 활성화를 구현한다. 지원 여부를 확인하며 탭 닫힘 시 refused, 새 탭은 paused에서 시작한다.
- [ ] 여정 및 `scroll_stop_consumes_first_press`, `closed_tab_refused`, `background_timer_does_not_advance_work`를 검증한다. 자동 스크롤 중 첫 Space는 정지1/클릭0. 완료조건: 최초 기본 웹 활동 전체 여정 통과.
- [x] `feat: complete switch search and reading journey` 의도로 커밋.

### 단계 7: 위험 확인·쉬기·복구 완성

**파일:** 새 `src/core/switch-confirm.ts`, `tests/unit/switch-confirm.test.ts`, `tests/e2e/switch-recovery.e2e.ts`; 변경 engine/actions/panel/messages/relay 및 기존 confirm 연결. 기존 confirm-guard의 마우스 모드 계약은 보존.

- [ ] `release_then_guard_then_new_press`에서 진입 입력·1초 이내 입력·hold·dwell 확정0, 보호 뒤 새 한 번만 확정1을 단정한다. `two_cycles_cancel`은 무입력 제출0/쉬기, 실패 확인.
- [x] 단일 스위치 confirming에서 취소→실제 동작명 순환과 위험 요약을 구현한다. 알 수 없는 버튼 의미는 확인 대상으로 하고 링크/읽기 등 알려진 안전 동작은 바로 실행한다.
- [x] blur/hidden/tab change/frame replacement/worker reconnect 시 pause 또는 invalidate. pending 폐기·초안 보존·재개 입력은 선택으로 재사용 금지. 사이트 외 포커스에서 전역 키 처리는 추가하지 않는다.
- [x] 해당 검사와 confirm/lifecycle/helper-toggle E2E를 실행한다. 테스트 `late_reply_after_navigation_ignored`, `restart_unknown_not_replayed`에 옛 실행0·자동 재시도0 확인. 완료조건: 위험한 동작은 새 명시 입력 뒤에만 1회.
- [x] `feat: guard switch confirmation and recovery` 의도로 커밋.

### 단계 8: 최종 회귀·사용자 검증 인계

**파일:** 위 테스트들과 현황표, 디자인/검증 보고 문서. 제품 범위 추가 없음.

- [ ] typecheck→lint→build를 실행하고 싼 게이트 실패부터 해결한다. 브라우저 자체 실패면 정확한 exit/로그를 보고하고 전체 E2E를 재실행하지 않는다.
- [ ] 단위 전체와 CI smoke3, 새 여정/입력/확인/복구 E2E를 통과시킨 뒤 독립 DOM·접근성 감사와 UI review를 수행한다. 리뷰 범위와 모델을 명시한다.
- [ ] 전체 CI E2E를 한 번 수행해 기존/새 실패를 구분한다. review→qa→외부 입력 변경 cso, UI design-review를 준비된 스킬로 실행하고 결과를 기록한다. 필요 시 근거 있는 수정 뒤 영향 검사만 먼저 재검증한다.
- [ ] 실제 PC에서 OS IME 공존과 사용자 속도·피로·오선택을 검증하도록 인계한다. 클라우드 합격과 사용자 합격을 따로 표시하고 지원 실사이트 한 곳의 검색/읽기 결과를 기록한다.
- [ ] 완료조건: 설계 §8의 자동 수용조건 전부 충족, 미해결 안전 실패0, PC 시험 미실행은 명시. 2차/파일 선택창 구현으로 자동 넘어가지 않는다. 결과를 현황표에 반영하고 후속 결정을 제시한다.

## 실행 인계와 GSD 연결

권고는 **이 기존 클라우드에서 직접 단계별 구현·테스트**다. 입력·프레임·편집 인터페이스가 서로 의존하므로 단계마다 실제 결과를 보고하고 다음 단계로 진행한다. 새 환경·별도 중복 checkout은 만들지 않는다.

이 문서는 writing-plans로 작성한 실행 가능한 계획이며 GSD plan-phase의 planner/checker 게이트 통과를 주장하지 않는다. 실행 전 공식 GSD 스킬로 승인된 새 범위를 기존 로드맵에 연결하고 필요 계획/검증 상태를 생성한다. 기존 Phase1(19계획 실행)과 이번 1차 기능을 같은 것으로 처리하지 않는다. GSD 제공자 모델명이 현재 지정 모델과 다르면 운영규칙에 따라 명시하고, 지원 불가면 해당 단계만 보고한다. `.planning/`를 수동 편집하거나 규칙 PR 게시를 선행조건으로 삼지 않는다.

자체 검토: 설계 §1~9를 단계2~8에 연결했고 기존 실패/Node 차이는 단계1에 둔다. 5개 Review Focus에 각 단계의 검사를 배정했다. 제품 코드 구현·새 테스트 실행은 이 계획 작성 중 수행하지 않았다.
