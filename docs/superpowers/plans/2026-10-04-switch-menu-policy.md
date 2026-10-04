# Switch Menu Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 안전 실행과 초안을 유지하며 메뉴 정책을 분리하고 선택 가능한 짧은 고정 진입을 검증한다.

**Architecture:** 순수 정책 함수가 기존 SwitchItem/canonical ID를 생성하고 controller가 기존 승인·실행 경계를 소유한다. 별도 프로필은 배치만 고르며 legacy가 기본이다. 문자 입력 모델과 worker 실행 계약은 바꾸지 않는다.

**Tech Stack:** TypeScript strict, WXT, zod, Vitest, Playwright, pnpm10.33.0; 새 의존성 없음.

**Spec:** [2026-10-04-switch-menu-policy-design.md](../specs/2026-10-04-switch-menu-policy-design.md)

상태: 구현 전 사용자 검토안. 작업 항목은 모두 미실행이다. 권장 방향 승인을 새 명세·실행 계획 승인으로 확대하지 않는다. 직접 실행 후 별도 독립 검토를 권고한다. 문서화 요청에 따라 명세와 계획을 함께 제출하며 검토 응답 전 제품 변경을 하지 않는다.

## Global Constraints

- 실행 권한/대상 동일성/문서 세대/일반 버튼 확인/1초 확인 보호/결과 불명 자동 재시도 금지/초안 보존 유지.
- 고정 메뉴와 한 종류의 짧은 Space, 순환 중 재정렬 금지.
- 첫 비교는 순환1500ms/입력 보호300ms, 첫 항목2배 체류와 기존 확인 보호를 유지한다.
- 기존 경로 기본값과 Space 복귀, 파괴적 설정 전환 없음.
- 새 의존성·권한·서버 없음. 기존 TypeScript strict/WXT/Vitest/Playwright와 pnpm10.33.0 사용.
- 자동예측/자동배치/음성·시선/길게·더블누름 필수화는 범위 밖이다.
- merge·배포·설치 ZIP 교체는 범위 밖이다.

## Review Focus

- 기존 명령과 새 경로의 ID 차이로 action-check가 우회/거절되는 경우: Task1/3에서 실제 승인 요청 trace 검사.
- 프로필 저장/초기 읽기 지연 중 다른 선택·탐색 발생: Task2에서 세대 변경 후 화면 미교체 검사.
- 형제 iframe 조회 불명과 결과 불명 초안: Task2/4에서 전환 거절·데이터 보존 검사.
- 빈/긴 목록·formActive 상태의 복귀: Task3/4에서 Space 도달성·양식 exit·긴 항목 가시성 검사.
- 쉬운 첫 대상만 빠르고 URL·새탭·복구가 악화: Task5에서 경로별 판정과 입력/복구 횟수 포함.

## 파일·순서

Task1 정책 추출 → Task2 프로필 데이터/안전 전환 → Task3 짧은 메뉴 통합 → Task4 안전·접근성 통합 → Task5 승인 후보 성능 판정. Task2에는 legacy만 노출하고 Task3부터 새 배치를 선택 가능하게 한다. Task1은 별도 리뷰 가능한 무동작변경 증분이다. 각 task 끝에 관련 결과를 WORK-STATUS에 기록하고 한 의도 커밋으로 저장한다. 사용자 검토 후 이 순서로 수행하며 병합은 하지 않는다.

기존 제품 기준62577af, 문서·측정 기준2835726. 시작 시 원격 HEAD/dirty/PR 확인, 최신 제품 변경이 있으면 아래 위치·계약을 다시 대조한다. 오래된 main에서 재구현하지 않는다. 기존 release ZIP·관련 없는 PR 보존. 명령은 저장소에서 `source /workspace/.cloud-onboarding/workflow-env.sh` 후 실행한다.

### Task 1: 동작을 유지하는 메뉴 정책 추출

**Files:** Create `src/core/switch-menu-policy.ts`, `tests/unit/switch-menu-policy.test.ts`; Modify `src/page/input/switch-controller.ts`의 groups/readingMenu 및 해당 호출; Test `tests/unit/switch-controller-navigation.test.ts`, `tests/unit/switch-controller-scroll.test.ts`.

**Interfaces:**
- Consumes: 기존 `SwitchItem` (`src/core/switch-engine.ts`).
- Produces: `legacyGroups(): SwitchItem[]`, `legacyReadingItems(): SwitchItem[]`. ID·label은 현재 groups/readingMenu 배열 그대로; utility up/pause는 controller.menu가 계속 소유.

- [ ] 변경 전에 controller-navigation/scroll fixture의 탭·새탭·자동스크롤 ID/요청/복귀 trace를 저장한다. 기존 groups5개와 reading13개의 전체 `(id,label,action.kind)` 순서를 독립 literal fixture로 고정한다. 새 함수가 없어서 실패하는 정책 시험을 먼저 추가한다. 첫 항목은 `['group:0','찾기','command']`, reading 첫/끝은 `scroll:down`/`double-open`; 함수 자체로 expected를 생성하지 않는다.
- [ ] `pnpm exec vitest run tests/unit/switch-menu-policy.test.ts` → 누락된 함수 때문에 FAIL인지 확인한다.
- [ ] 두 함수를 순수 생성기로 구현하고 controller 두 배열만 교체한다. 객체는 호출마다 새로 생성해 테스트/호출자의 수정이 다음 메뉴에 전파되지 않게 한다.
- [ ] controller-navigation/scroll 기존 fixture에서 탭·새탭·자동스크롤의 pending itemId→요청 kind→최종 승인 trace와 up 복귀 순서를 리팩터 전후 대조한다. 새 허용 ID/worker 분기 없음; 기존 assertion 보존.
- [ ] `pnpm exec vitest run tests/unit/switch-menu-policy.test.ts tests/unit/switch-controller-navigation.test.ts tests/unit/switch-controller-scroll.test.ts` → 전체 PASS. `pnpm typecheck`와 `pnpm lint` → exit0.
- [ ] 정책·controller·시험 및 증거를 명시적으로 stage하고 `refactor: 단일 스위치 메뉴 정의 분리`로 커밋한다. 이 증분만으로 UI·속도 개선 완료를 주장하지 않는다.

### Task 2: 프로필 파싱과 전환 안전 경계

**Files:** Create `src/core/switch-interaction-profile.ts`, `tests/unit/switch-interaction-profile.test.ts`, `tests/unit/switch-controller-profile.test.ts`; Modify controller의 초기 읽기/storageHandler/로컬 메뉴 처리. 기존 `switch-settings.ts`는 수정하지 않는다.

**Interfaces:**
- Produces: `InteractionLayout = 'legacy' | 'short-menu-v1'`; `InteractionProfile = {schemaVersion:1; layout:InteractionLayout}`; `INTERACTION_PROFILE_KEY = 'switchInteractionProfile'`.
- `parseInteractionProfile(raw:unknown): InteractionProfile` — strict schema, 실패 시 새 legacy 값 반환; 저장 부작용 없음.
- `canChangeInteractionProfile(input:{pressed:string|null; externalInFlight:number; unresolved:boolean; otherConfirmation:boolean; pendingControl:boolean}): boolean` — null/0/false만 허용.
- Controller 내부 `changeInteractionProfile(layout:InteractionLayout, startedGeneration:number): Promise<void>` — spec §5 순서 구현. 전환용 자신의 command 외 pending은 거절한다. public 실행 API로 노출하지 않는다.

- [ ] schema tests: undefined/미래버전/추가키→legacy, 정상 short→short; 입력 객체 불변. `expect(canChangeInteractionProfile({pressed:null,externalInFlight:0,unresolved:false,otherConfirmation:false,pendingControl:false})).toBe(true)` 및 각 필드를 하나씩 위험 값으로 바꾸면 false.
- [ ] `pnpm exec vitest run tests/unit/switch-interaction-profile.test.ts` → 새 모듈 누락 FAIL을 확인한다.
- [ ] 순수 schema/guard 구현 후 같은 명령 PASS를 확인한다.
- [ ] controller-profile fixture를 기존 controller-navigation의 실제 controller/collector/fake-clock/transport 패턴으로 만든다. storage get/set을 지연·실패시킬 수 있게 하고 입력은 실제 consume down/up를 통한다. 새 public test-only 실행 우회 API를 만들지 않는다.
- [ ] 전환 거절 중 기존 draft/initial/medial/selection/다른 필드/보관 문장 값 유지, save reject 시 기존 배치 유지, 세대 변경 후 late success 화면 미교체, 읽기 지연 중 active scan 미교체를 failing tests로 추가하고 FAIL 원인을 확인한다.
- [ ] spec §5의 stash→pause/invalidate→안전 재검사→저장→세대 재검사→paused 새 root를 구현한다. Task2에서는 legacy 선택만 노출한다. 외부 변경은 다음 안전한 초기 진입용으로만 읽고 기존 settings applySettings를 호출하지 않는다.
- [ ] `pnpm exec vitest run tests/unit/switch-interaction-profile.test.ts tests/unit/switch-controller-profile.test.ts tests/unit/switch-settings.test.ts tests/unit/switch-controller-draft.test.ts tests/unit/switch-controller-reapply.test.ts` → 모두 PASS. 타입·린트 exit0.
- [ ] `feat: 기존 설정을 보존하는 메뉴 프로필 경계` 커밋. 저장 실패/늦은 응답 실제 검사 결과 기록.

### Task 3: 짧은 고정 첫 메뉴와 명시 복귀

**Files:** Modify policy/controller/profile tests; Create `tests/e2e/switch-short-menu.e2e.ts`; Modify `docs/design/DECISIONS.md`, phase1 설계에 새 선택 프로필 계약 링크만 추가.

**Interfaces:**
- Consumes: Task1 배열 함수, Task2 InteractionLayout/안전 전환.
- Produces policy `shortRootItems(): SwitchItem[]`, `shortScrollItems(): SwitchItem[]`; 전자는 spec §3의7항목(쉬기 포함), 후자는4개 실제 scroll 명령만 반환. controller.menu가 scroll up/pause를 추가한다. more는 legacyGroups를 menu로 감싼다.
- Root canonical IDs: `['group:1','form-open','pins-list','menu:scroll','nav:tabs','menu:more','pause']`. 새 로컬 ID는 `menu:scroll`, `menu:more`, `profile-open`, `profile-preview:legacy`, `profile-preview:short-menu-v1`, `profile-apply:legacy`, `profile-apply:short-menu-v1`; 기존 실행 ID를 대신하지 않는다.

- [ ] 정책 tests에 위 정확한 ID/label 순서, scroll4순서, 호출 간 객체 독립성을 추가하고 FAIL 확인.
- [ ] 두 함수를 구현하고 초기/current/root의 프로필별 배열을 연결한다. scroll 진입 때 기존 group2와 동일하게 page 영역을 초기화한다. more는 기존 그룹 handler를 그대로 사용한다.
- [ ] legacy 조절 메뉴의 기존 항목 뒤/자동 추가 쉬기 앞에 `메뉴 배치`를 추가한다. profile 미리보기·취소·1초 보호·paused 재개를 구현하고 short 선택을 노출한다. 확인은 새 Space만 허용.
- [ ] controller tests에 root→tabs에서 pending itemId가 `nav:tabs`, root→pins가 `pins-list`임을 고정한다. tab/back/new/close 권한 거절·확인 검사를 새 별칭으로 완화하지 않는다. 메뉴 ID만 선택했을 때 사이트 실행/탭 생성0회 검사.
- [ ] E2E는 legacy 기본/short 명시 선택/재시작 복원/Space-only legacy 복귀/한 field 초안과 partial Hangul round-trip을 검증한다. root/formActive에서 form-exit 없이 작업홈으로 탈출하지 않음도 검사한다. 프로필 설정에 마우스 조작을 사용하지 않는다.
- [ ] `pnpm exec vitest run tests/unit/switch-menu-policy.test.ts tests/unit/switch-controller-profile.test.ts tests/unit/switch-controller-navigation.test.ts tests/unit/switch-controller-scroll.test.ts` → PASS. `CI=true pnpm exec playwright test tests/e2e/switch-short-menu.e2e.ts --workers=1` → 프로덕션 build·전 항목 PASS.
- [ ] `feat: 선택 가능한 짧은 고정 메뉴 진입` 커밋. 기존 키보드/확인/목록 위치가 그대로임을 diff로 확인하고 B1 시간 모델을 따로 산출한다.

### Task 4: 안전·복귀·접근성 통합 검사

**Files:** Extend `tests/e2e/switch-short-menu.e2e.ts`, controller-profile tests; 필요하면 `tests/e2e/switch-helpers.ts`에 프로필 선택 helper만 추가. 기존 legacy helpers/assertion은 그대로 유지. 증거 `docs/verification/switch-menu-policy/`에 생성.

**Interfaces:** Task1–3 제품 API 그대로. helper가 제품 보호시간을 줄이거나 direct execute를 호출하지 않는다.

- [ ] 일반 type=button 확인 전 사이트 click0회,1초 안 Space0회, 새 보호 후 확인1회; repeat/held/composition/blur 후 새메뉴 실행0회 검사 추가. 필요 결함만 RED→fix→PASS로 수정.
- [ ] inFlight/unknown 응답 중 profile 거절과 늦은 응답의 다음 메뉴 실행0회, 외부 값 변경 재적용 확인, frame unknown 초안 보존, 취소 후 원래 선택 범위/문장 보존을 검사한다.
- [ ] 빈 목록·긴 한글 이름·많은 탭·잘못 선택한 more/scroll의 복귀를 짧은 Space로 검사한다. 동적 삭제/삽입은 기존 snapshot 위치 유지 및 명시 새로읽기로만 반영됨을 확인한다.
- [ ] 타입·린트·`pnpm test:unit` PASS 확인. 관련 E2E: `CI=true pnpm exec playwright test tests/e2e/switch-short-menu.e2e.ts tests/e2e/switch-pending.e2e.ts tests/e2e/switch-reapply.e2e.ts tests/e2e/switch-orphan-drafts.e2e.ts tests/e2e/switch-navigation-cancel.e2e.ts tests/e2e/switch-form-navigation.e2e.ts --workers=1` → 전 항목 PASS, 실패/flaky/skip 별도 기록.
- [ ] 저장소 ui-review 절차와 design-review/QA로 실제 DOM 360–1440px, 긴 label, 강조 가시성, focus/명암·색 외 표시를 검사한다. controller 권한 diff는 review/cso 관점으로 독립 검토하고 실제 지적/처분을 저장한다. 자동화 합격을 사용자 운동 사용성으로 기록하지 않는다.
- [ ] 안정 후보에서 기존 전체 통합 CI(type/lint/unit/E2E)1회 결과와 해당 SHA를 확인한다. 문서 후속 커밋마다 동일 제품 전체CI를 반복하지 않는다. 새 제품 변경이면 영향 검사와 최종 근거를 갱신한다.
- [ ] 안전 회귀가 있으면 후보 채택 중단·pause·데이터 보존 후 Task2 복귀 사용. `test: 짧은 메뉴 안전 복귀 검증` 커밋. assertion 완화로 통과시키지 않는다.

### Task 5: 안정된 승인 후보의 성능 판정

**Files:** Create `docs/verification/browser-speed/menu-policy.e2e.ts`, `menu-policy.config.ts`, `menu-policy-results.md`, 원본 JSONL/집계 JSON; 기존 baseline raw와 harness는 보존한다. 제품 코드 수정은 별도 증분이다.

**Interfaces:** 새 config는 기존 browser-speed config/fixture의 실제 프로덕션 실행 방식을 따른다. 결과 각 행 `{candidateCommit, baselineCommit, task, pairIndex, layout, order, initialState, setupMs, totalMs, spaceCount, recoverySpaceCount, result, exclusionReason}`. task와 문자열/선택 범위를 사전 고정하고 결과 본 뒤 바꾸지 않는다.

- [ ] 후보 채택 판정 시작 전에 작업 데이터·첫/연속·등록/재사용·실패 분류를 문서로 고정한다. 한국어 `오늘은 창문을 열고 맑은 공기를 마시며 내일 약속을 확인합니다`(공백 포함20~50자), 숫자 `202610041234567890`, URL `https://Example.com/a-b?q=Hi2&x=9`, 중간삽입/삭제/undo/조합취소. `가a1`은 기존 회귀용으로 별도 유지한다.
- [ ] 실행 전 표본표를 고정한다: B1 클릭·탭전환·고정 재사용·스크롤 각각20쌍(총80쌍); 새탭·문구·`가a1` 직접 입력칸·`가a1` 더보기 경로 각각3쌍(총12쌍); 위 긴 한글·숫자·URL·수정 각각1쌍. 첫 세 긴 과제의 충분한20쌍 반복은 B1에서 하지 않는다. legacy/short를 AB/BA 교차하고3쌍의 남는 순서는 task별 반대로 배정,1쌍도 task별 교대한다. 같은 제품·페이지·데이터·1500/300·paused 출발·30ms Space 유지. 측정 중 빌드/린트/다른 브라우저 작업 병렬 실행 금지.
- [ ] 수정 과제는 `가나`의 두 글자 사이에 `다` 삽입→`가다나`, 앞 글자 삭제→`가나`, undo→`가다나`, 끝으로 이동해 `ㄱ/ㅏ` 조합 후 한 단계 취소→`ㄱ`, 다시 취소→미완성 없음, 명시 적용→`가다나`로 고정한다. 해당 입력 칸의 초기 caret·selection을 기록한다.
- [ ] 전체 기존 명령의 경로 index/Space/dwell 모델과 Space 도달성 검사를 먼저 기록한다. 다음으로3쌍 경로 회귀를 수행하고 손실이 채택 기준을 위반하면 후보 전체 채택을 중단한다. 나머지 성능 비교는 미실행과 이유를 보고하며 Task4 안전 검사는 축소하지 않는다. 실패 경로를 삭제한 선택적 합격·측정 후 과제 교체는 금지한다. 새 후보는 수정 이유와 새 사전 표본표를 기록한 후 평가한다.
- [ ] 기존3회 원본과 직접20쌍으로 비교하지 않는다. 동일 후보의 legacy를 대조로 재측정하고 기준 제품과 legacy 동등성을 Task1/4 trace로 연결한다. 준비·페이지 로딩 비용과 첫/연속·등록/재사용 시간을 별도 저장한다.
- [ ] `CI=true pnpm exec playwright test --config docs/verification/browser-speed/menu-policy.config.ts --workers=1`을 해당 task별로 나눠 실행한다. 실패/timeout은 원본에 남기며 성공 표본20개를 얻으려 삭제/대체하지 않는다. 긴 글쓰기 timeout은 사전 경로 dwell 계산과 복구1회 여유로 정하고 측정 전 기록한다.
- [ ] 주평가4경로는 paired ratio/중앙값/범위·성공률·Space·복구 횟수를 보고한다. 경로별30% 단축 AND 총 누름 비증가가 목표 가설이며 안전 회귀0이 선행 조건. 회귀 과제는 모든 표본·모델 차이·손실·한계를 공개하고1/3쌍을 통계적 동등/개선 합격으로 해석하지 않는다. 미달 경로는 미달로 기록하고 평균으로 합격 처리하지 않는다.
- [ ] K1 안정 후 별도 명세에서 위 긴 한글·숫자·URL·수정4과제 각각20쌍을 한 번 수행하도록 인계한다. B1 표본을 섞지 않으며, K1 후보의 legacy 대조를 같은 조건으로 다시 잰다. K1 전이라도 기존 안전 회귀·문자 도달성 시험은 유지한다.
- [ ] B1로 충분한 경로는 추가 재설계 중지. 문구/새탭/글쓰기 미달은 B2/K1 별도 명세 검토로 넘긴다. 실제 사용자 피로·오선택·복구 악화면 채택 중단. 실제 Windows/실사이트 검증 전 기존 기본값은 legacy 유지.
- [ ] `docs: 고정 메뉴 후보 비교와 채택 판단` 커밋. draft PR/검사 URL·제품 SHA·실제 검증과 미검증을 WORK-STATUS에 갱신한다.

**예상 실행비용:** spec §6의 현재 자판 모델에서34자 한글15.80분·숫자18자8.71분·URL33자12.08분. 이 세 과제를 B1에서도20쌍씩 하면 약24.40시간(준비/IPC/복구 제외)이므로 각각1쌍 약73.2분으로 제한한다. 주평가80쌍 약36.5분+짧은 회귀12쌍 약23.9분을 합쳐 B1 약133.6분+수정 과제/환경 비용을 예상한다. 모두 수행할 경우의 추산이며 실제 측정 아님.3쌍 경로 회귀에서 후보 채택을 중단하면 나머지는 실행하지 않는다. K1에서도 legacy 대조만 약12.20시간이므로 긴 비교는 안정 후보에서 한 번 계획 실행하고 동일 제품으로 반복하지 않는다. 기존 Task4 안전·접근성·전체CI는 그대로다.

## 검토 결과와 실행 인계

자가 검토 및 engineering/design 계획 검토에서 범위를 축소했다: 공통 menu의 상위로 제거는 제외, 탭 별칭은 canonical nav:tabs 유지, 프로필 전환은 자신의 로컬 command와 외부 pending을 구분, 초기 storage 지연은 스캔을 재배치하지 않음, 기존 예측52.74초는 B1 목표치로 재사용하지 않음. 문구·키보드 동시 구현으로 효과를 섞지 않는다.

Task1–4는 작은 독립 커밋으로 직접 실행하고 안정 시점에 독립 검토하는 방식을 권고한다. 이번 단계에서는 계획 검토만 완료했으며 체크박스 실행·제품 검사 통과를 의미하지 않는다. 사용자에게 명세/계획과 실행 방식 검토를 전달한 뒤 대기한다. 필요한 결정은 B1 범위·고정 배치 채택과 실행 방식이며, 실제 PC 평가 일정은 후속 채택 단계에서 정한다.
