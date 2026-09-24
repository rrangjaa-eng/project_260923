# Phase 4: 틀 자동화 + 활동 기록 - Research

**Researched:** 2026-09-24
**Domain:** MV3 확장(Phase 1·3 위에 쌓기) — 기록기(단계 목록 합성) · service worker 실행 오케스트레이션(잠듦 내성) · 요소 재탐색(matchScore 임계값) · 제출 확인 + main-world 알림 창 감시(격리) · 막힘/다시 기록 · 활동 기록(일별 청크·14일 보존·마스킹) · 주간 통계
**Confidence:** MEDIUM — 저장소 안 결정(D-01~D-42)과 Phase 1 실제 코드는 이번 세션에 전부 Read(HIGH). Phase 3 코드는 아직 실행 전이라 `git show`로 그 RESEARCH.md만 읽었고(파일 이름·구조는 계획일 뿐 실행 결과 아님, MEDIUM), MV3 API 세부(main-world 타이밍, CDP 강제 정지, storage.session 쿼터)는 이번 세션 WebSearch로 교차 확인했으나 실행 검증은 없음(대부분 MEDIUM, 일부 LOW로 Assumptions Log에 명시)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

전문은 `.planning/phases/04-templates-activity-log/04-CONTEXT.md`(D-01~D-42)를 그대로 잠근다. 이 연구가 다루는 기술 결정 위주로 요약한다(전문 인용은 각 섹션에서 다시 함):

- **D-01~D-05 (구조)**: Phase 1 구조 이어받기(모든 프레임 content script, 자주 일어나는 일은 그 프레임, 명령판·확인 화면·틀 카드·진행 표시는 맨 위 프레임이 모아서, 프레임 간 메시지는 SW 경유), `isTrusted` 입력만, 단일 저장자(SW), 저장 데이터마다 형식 버전, **새 권한·새 의존성 목표 0**(꼭 필요하면 이유 한 줄 + 승인).
- **D-06~D-12 (기록)**: 명령판 "틀 기록"(둘째 장 4)으로 시작/종료, 모든 프레임에서 단계 수집(SW가 storage.session에 이어 적음), 시작 페이지 주소 저장(메뉴 클릭도 단계로), 요소 기억 = Phase 1 지문 + framePath + 프레임 주소, 민감칸은 값 없이 "직접 입력" 단계, "틀 저장" 화면에서 바뀌는 값 후보·이름 후보 카드, **마지막** 제출 성격 버튼 = 제출 단계(이전 제출 성격 단계·위험 버튼도 실행 때 확인).
- **D-13~D-21 (실행)**: 0→틀 실행→번호, 없으면 "틀 기록" 카드, 바뀌는 값 카드(최근 값·오늘 날짜·기록값·직접 입력) 뒤 시작 페이지로 직행 후 단계 실행, **요소 찾기**는 framePath로 프레임 고정 + matchScore 최고점이 기준 넘고 2등과 충분히 차이 날 때만 확실(아니면 멈춤=막힘), 대신 누르기는 Phase 1 `synthesizePress`+Phase 3 `fillValue` 그대로(debugger 금지, 화면 우회 요청 금지), **실행 조정은 SW**(단계마다 storage.session에 실행 상태 기록, 실행 기록은 탭에 매이지 않음=Phase 5용), 같은 틀 동시 1개(실행 잠금), 속도 3단계(←→/Esc), 최대 속도=요소 등장 즉시+같은 화면 일괄 채움.
- **D-22~D-25 (제출)**: 제출 직전 항상 확인 화면(Phase 1 재사용, 1초 보호), **누르기 직전 기록 → 저장 완료 확인 → 누르기**(storage.local), 정해진 시간 안에 페이지 이동 또는 성공 메시지 없으면 재제출 없이 "확인 필요", SW 잠들었다 깨면 저장된 상태에서 이어가고 "누름"만 있고 결과 없으면 "확인 필요"(재시도 없음), `runtime.onUpdateAvailable`로 틀 실행 중 업데이트 미루기(끝나면 적용).
- **D-26~D-27 (알림 창)**: main-world 감시 장치를 **모든 페이지·프레임에 document_start로 미리** 넣고 틀 실행 중에만 동작(평소엔 가로채지 않음), 확인 버튼 누른 뒤 몇 초 안 **첫 확인 창 하나만** "확인", 그 뒤/예상 밖 확인 창은 "취소"+멈춤+글 표시, 안내 창(alert)은 활동 기록만, **main-world 소식은 활동 기록과 멈추기에만 쓰고 성공 판정·진행에는 안 씀**(스푸핑 가능 전제).
- **D-28 (막힘)**: 멈춤 + `--warning` 카드([1 이 단계만 다시 기록][Esc 멈춤]), "이 단계만 다시 기록"은 확인 화면 보호 거친 뒤에만 반영.
- **D-29~D-30 (직접 입력)**: 민감칸 있는 틀은 실행마다 그 칸에서 멈춰 직접 입력(틀·최근 값·기록 어디에도 안 남음), 보안 키패드·CAPTCHA·결제 화면 만나면 자동 진행 금지(대신 누르지도, 풀지도 않음).
- **D-31 (파일)**: 틀 내보내기 전 "고정 값 포함" 경고, 형식 버전+zod 검사, 실패 시 원본 보존, Phase 3 설정 파일과 같은 무권한 방식.
- **D-32~D-35 (활동 기록)**: 2주만 이 PC, 입력 값은 안 남김(칸 이름만), 알림 창 글·보이는 글자 속 주민/계좌/카드/전화 모양은 가려서 저장, 하루 단위 청크(storage.local)+14일 지남 삭제+하루 상한, "기록 내보내기"는 미리보기→확인→파일(빈 경우/실패 케이스 문구 고정), 주간 통계(되돌리기 횟수, 틀 1회당 필터 통과 입력 수).
- **D-36~D-38 (화면)**: SYSTEM.md/tokens.css만, 없는 템플릿(틀 저장 화면·바뀌는 값 카드·틀 목록·진행 표시·알림창 글·기록 미리보기·주간 통계)은 DESIGN.md §4-1로 SYSTEM.md에 먼저 추가.
- **D-39~D-42 (시험)**: 연습 사이트에서만(회사 시스템 금지), 단위 시험 목록(요소 찾기 점수, 바뀌는 값 자동 표시, 제출 버튼 판별, 보안 키패드/CAPTCHA/결제 판별, 실행 이어가기, 알림 창 규칙, 활동 기록 가리기/14일/주간 통계, 파일 형식 검사), 확장 띄운 브라우저 시험(전체 흐름·iframe·속도·알림 창·**SW 강제로 재운 뒤 이어가기**·같은 틀 2회 금지·파일 내보내기/가져오기·기록 미리보기·주간 통계), UI 완료 판정은 저장소 규칙(싼 게이트→독립 DOM 감사→수정→전체 게이트), **외부 입력(가져온 틀 파일, main-world 소식)+되돌릴 수 없는 제출을 다루므로 `/cso` 필수**.

### Claude's Discretion

- 기록 단계의 정확한 모양(단계 종류, 같은 칸 여러 번 입력 시 마지막 값만, 필요 없는 클릭 걸러내기)과 저장 형식.
- 바뀌는 값 모양(날짜·금액·전화번호)의 정확한 규칙과 오늘 날짜를 기록된 모양대로 만드는 방법 — 단위 시험으로 고정.
- 제출 성격 버튼 기본 단어 목록과 사이트별로 고치는 자리(위험 단어 목록과 같은 설정 구조를 쓸지).
- 요소 찾기 점수 기준값과 "충분한 차이"의 크기 — 단위 시험으로 고정.
- 속도별 쉼 길이와 요소 대기 최대 시간(Phase 2 결과 있으면 따름).
- 성공 메시지로 볼 글자와 결과 대기 시간.
- "첫 확인 창" 인정 몇 초, 틀 실행 중임을 main-world가 document_start에 바로 알 방법(연구가 정함).
- `prompt`·`beforeunload` 처리(틀 밖에서는 안 가로챔).
- 보안 키패드·CAPTCHA·결제 화면 판별 신호.
- 바뀌는 값 최근 값 개수·저장 위치(틀별 또는 Phase 3 재사용).
- 활동 기록 하루 상한·항목 모양·파일 형식·파일 이름.
- 주간 통계 자리(D-37 절차).
- 틀 목록 관리(이름 바꾸기·지우기) 자리, 지우기는 확인 필요.
- 메시지 타입 이름, 파일 배치, 형식 버전 올리는 방법.

### Deferred Ideas (OUT OF SCOPE)

- 뒤쪽 탭에서 틀 돌리기·확인 대기 목록(BG-01), 뒤 탭 닫힘·로그아웃 시 멈춤+이유(BG-02), 틀별 이미지·광고 차단(BG-03), 작업판(BORD), 반복 패턴 알림(PATN-01) — Phase 5. Phase 4는 실행 상태를 "탭에 매이지 않는 실행 기록"으로 설계해 Phase 5가 재사용하게만 한다(D-17).
- 화면 정리 AI(AI) — Phase 6.
- AI 틀 복구, 엑셀에서 옮기기, 여러 건 한꺼번에 입력 — 다음 버전.
- 이용자가 고정한 회사 사이트에만 새 창 허용(`contentSettings`) — Phase 1 deferred 그대로.
- 회사 시스템에서 틀 입력이 먹히는지 확인 — 회사 시스템 완성 뒤.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TMPL-01 | "틀 기록" 켜면 누른 요소·입력 값이 단계 목록으로 저장, 끝나면 "틀 저장" 화면 | Pattern 1(기록기), Pattern 2(요소 지문+framePath), Code Example 1 |
| TMPL-02 | "틀 저장" 화면에서 바뀌는 값 후보 자동 표시 + 이용자 확정 + 틀 이름 | Pattern 3(값 모양 판별), Code Example 2 |
| TMPL-03 | 마지막 제출 성격 버튼 = 제출 단계, 이용자가 바꿀 수 있음 | Pattern 4(제출 단어 판별) |
| TMPL-04 | 실행 시 저장된 시작 페이지로 메뉴 없이 직행 | Pattern 5(실행 오케스트레이션) |
| TMPL-05 | 여러 기억 방식으로 요소 찾기, 확실하지 않으면 멈춤 | Pattern 6(matchScore 임계값+margin) |
| TMPL-06 | 0→틀 실행→번호, 바뀌는 값 카드(최근 값/오늘 날짜/기록값/직접 입력) 뒤 실행 | Pattern 3, Pattern 5, Code Example 2 |
| TMPL-07 | 같은 틀 동시 1개(실행 잠금) | Pattern 5, storage.session 실행 상태 스키마 |
| TMPL-08 | 속도 3단계, 틀별 기본값, ←→/Esc | Pattern 5(런루프), Pattern 6(최대 속도 일괄 채움) |
| TMPL-09 | 제출 직전 항상 확인(요약+1초 보호+Enter/Esc) | Pattern 7(제출 파이프라인), 기존 confirm-dialog.ts 재사용 |
| TMPL-10 | 결과 불분명(성공 메시지·이동 없음) → 재제출 없이 "확인 필요" | Pattern 7, Q4(제출 결과 판정) |
| TMPL-11 | 제출 직후 첫 확인 창만 확인, 그 뒤/예상 밖은 취소+멈춤+글 표시, 안내창은 기록만, 틀 밖은 가로채지 않음 | Pattern 8(main-world 감시), Q1~Q3, Code Example 3 |
| TMPL-12 | 막히면 멈춤+알림, "이 단계만 다시 기록"은 확인 뒤에만 반영 | Pattern 9(막힘·다시 기록) |
| TMPL-13 | SW 잠듦→깸에도 이어감, 제출 도중 불분명하면 "확인 필요" | Pattern 5, Q5(SW 수명), Q7(시험 방법) |
| TMPL-14 | 민감칸 있는 틀은 실행마다 그 칸에서 멈춰 직접 입력 | Pattern 10(Phase 3 sensitive.ts 재사용) |
| TMPL-15 | 보안 키패드·CAPTCHA·결제 화면 만나면 자동 진행 금지 | Pattern 11(차단 컨텍스트 판별), Q12 |
| TMPL-16 | 틀 파일 내보내기(경고 먼저)·가져오기 | Pattern 12(파일 I/O, Phase 3 패턴 재사용) |
| LOG-01 | 최근 2주 동작(입력 값 없이) 기록 | Pattern 13(활동 기록 일별 청크) |
| LOG-02 | "기록 내보내기": 미리보기→확인→파일 | Pattern 12, Pattern 13 |
| LOG-03 | 주간 통계(되돌리기 횟수, 틀당 필터 통과 입력 수) | Pattern 14(통계는 로그에서 파생 계산) |

</phase_requirements>

## Summary

Phase 4는 새 아키텍처 개념을 도입하지 않는다. Phase 1이 만든 4계층(순수 함수 `src/core/*` · 프레임별 `src/page/*` · 단일 저장자 `src/worker/*` · 판별 유니온 `src/shared/messages.ts`)과 Phase 3가 준비해 둔 `sensitive.ts`(민감칸)·`fill-value.ts`(값 채우기)·`undo-stack.ts`(되돌리기 횟수 원천)·옵션 페이지(무권한 파일 I/O)·palette.ts(명령판 고정 자리, "틀 실행"·"틀 기록"·"기록 내보내기" 카드가 이미 `implemented: false`로 자리를 지키고 있음) 위에 **기록기 → 틀 저장소 → 실행 오케스트레이터(SW) → 제출 파이프라인(확인 화면 + main-world 알림 창 감시) → 활동 기록**을 순서대로 얹는다. 가장 어려운 두 지점은 (1) **SW가 언제든 잠들어도 실행이 재개**되어야 한다는 요구(모든 실행 상태를 단계마다 storage.session에 적고, 제출 "누름"만 storage.local에 적어 재시도 없이 이어가는 이미 설계로 확정된 패턴을 그대로 구현하면 됨 — 새 기법 불필요, 다만 Playwright로 SW를 **진짜로** 재우는 시험 방법이 이 세션의 가장 큰 미해결 리스크다)과 (2) **main-world 알림 창 감시 장치가 동기적으로 `confirm()`에 답해야 하는데, 그 답의 근거("지금 이 탭에서 틀이 돌고 있고 방금 제출을 확인했다")는 isolated world/SW에서 비동기로만 알 수 있다**는 시간차다. 이 둘 다 메시지 왕복 없이 풀 수 있는 동기적 방법(스코프 안 클로저 변수 + `document.dispatchEvent`의 동기 특성)이 있고, 아래 Pattern 8·Code Example 3에서 구체화한다.

새 권한·새 패키지는 **0개**를 목표로 하며, 이번 조사에서 필요하다고 확인된 것도 없다(`storage`/`scripting`/`tabs`/`<all_urls>`로 충분 — main-world 주입은 `scripting` 권한 안의 `world` 옵션, 제출 결과 판정은 `webNavigation` 없이 `tabs.onUpdated` + 프레임 자기 보고로 대체).

**Primary recommendation:** `src/core/`에 순수 함수 5개(기록 단계 합성, 값 모양 판별, 제출 단어 판별, matchScore 임계값 판정, 차단 컨텍스트 판별, 활동 기록 마스킹)를 danger.ts·sensitive.ts와 같은 자리에 신설하고, `src/worker/`에 틀 실행 오케스트레이터(단일 상태 기계, storage.session 기반)를 신설하며, `src/page/`에는 main-world 감시 스크립트(신규 entrypoint, world:'MAIN')와 기존 오버레이 패턴을 확장한 새 화면들(틀 저장·바뀌는 값 카드·틀 목록·진행 표시)을 더한다. **틀 실행 조정 로직은 반드시 SW에 있어야 한다**(D-17) — 페이지 쪽은 "이 프레임에서 이 단계 하기"만 한다.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 기록(단계 수집) | Content script (각 프레임, ISOLATED) | Service worker(이어 적기) | 이벤트 발생 지점은 프레임, 영속화는 단일 저장자(D-07) |
| 틀 저장소(CRUD) | Service worker | — | 단일 저장자(D-03) |
| 실행 오케스트레이션(다음 단계 결정·속도·잠금) | Service worker | — | 페이지 이동·SW 잠듦을 넘나들어야 함(D-17) |
| 요소 재탐색·값 채우기 실행 | Content script(그 프레임) | Service worker(라우팅) | Phase 1 D-02 패턴 그대로(그 프레임에서 바로) |
| 제출 확인 화면 | Content script(맨 위 프레임) | Service worker(상태 방송) | Phase 1 confirm-dialog.ts 재사용(D-01) |
| 브라우저 알림 창 감시 | Content script(MAIN world, 모든 프레임) | Content script(ISOLATED, 중계) → SW(기록) | `window.confirm/alert` 패치는 페이지의 실제 JS 컨텍스트에서만 가능 |
| 활동 기록 영속화 | Service worker | — | 단일 저장자, 일별 청크(D-03) |
| 활동 기록 내보내기·틀 내보내기/가져오기 | Content script 또는 확장 페이지(옵션) | — | `document`가 있어야 Blob+`<a download>` 가능, SW는 불가(Q13) |
| 주간 통계 계산 | Service worker(읽기 시점 집계) 또는 화면을 여는 컨텍스트 | — | 로그를 새 원천으로 이중 기록하지 않고 파생 계산(Pattern 14) |

## Standard Stack

Phase 4는 **새 패키지가 필요 없다**. Phase 1·3이 승인한 스택을 그대로 쓴다.

### Core (기존 유지, 버전 확인)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wxt | 0.21.4 [VERIFIED: package.json:22, 이 세션에 Read] | MV3 빌드·엔트리포인트(main-world content script 포함) | Phase 1부터 채택, main-world 등록 API 보유 |
| typescript | 6.0.3 [VERIFIED: package.json:19] | strict 타입 | 저장소 규칙 |
| zod | 4.6.5 [VERIFIED: package.json:11] | 틀 파일·저장 스키마 검사 | Phase 1·3이 이미 전 저장소에 씀 |
| vitest | 5.0.1 [VERIFIED: package.json:23] | 단위 시험 | 기존 |
| @playwright/test | 1.63.0 [VERIFIED: package.json:14] | 확장 띄운 브라우저 시험 | 기존 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `webNavigation` 권한으로 서브프레임 이동 감지 | 프레임 자기 보고(기존 relay.ts 패턴) + `pagehide` | 새 권한 없이도 충분(Q4) — 권한 승인 절차를 피함 |
| `alarms` 권한으로 14일 로그 정리 스케줄 | 매 쓰기 시점에 "최근 20일 후보 날짜 키" 삭제 시도(존재 안 해도 무해) | 새 권한 없이 opportunistic pruning으로 충분 |
| `chrome.downloads` 권한으로 파일 저장 | `Blob`+`<a download>`(Phase 3가 이미 이 방식 채택) | 그대로 재사용, 새 권한 불필요(Q13) |
| `unlimitedStorage` 권한 | 기본 storage.local 10MB 쿼터 안에서 설계(추정 사용량 수백 KB~1MB대) | 견적상 불필요(Q5) — 실측 뒤 초과 징후 있으면 재검토 |

**Installation:** 없음(새 패키지 설치 불필요).

## Package Legitimacy Audit

이 phase는 새 외부 패키지를 설치하지 않는다. 감사 대상 없음.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| *(없음)* | — | — | — | — | — | 해당 없음 |

**Packages removed due to [SLOP] verdict:** 없음
**Packages flagged as suspicious [SUS]:** 없음

## Architecture Patterns

### System Architecture Diagram

```
[기록 중]                                    [실행 중]
 각 프레임 content script                     각 프레임 content script
  ├ press 훅(합성 누르기 내부 호출 지점,        ├ press/request 받으면 그 프레임에서
  │  isTrusted 이벤트 아님, Q8)                │   matchScore로 재탐색 → synthesizePress/fillValue
  ├ input/change/blur → 값 스냅샷              ├ 없거나 애매하면 "막힘" 보고 → SW
  │  (composition 커밋값만, Q8)                └ 제출 단계 직전: nav-mark처럼 "제출 임박" 신호
  └ 메뉴 클릭도 press 단계로 기록                     → main-world에 CustomEvent로 arm(Q2·Q3)
        │ (모두 SW로, D-07)                              │
        ▼                                                ▼
  ┌──────────────── service worker ────────────────────────────┐
  │ template-store.ts   run-orchestrator.ts   submit-guard.ts   │
  │  (틀 CRUD, zod)      (단계 포인터,          (누름 기록→          │
  │                       storage.session,      storage.local→   │
  │                       실행 잠금)             누르기 허가, D-23)  │
  │                                                               │
  │ activity-log.ts (일별 청크, 마스킹, 14일 정리)                  │
  └───────────────────────────┬───────────────────────────────────┘
                               │ storage.session(실행 상태) / storage.local(틀·누름·기록)
                               ▼
                     [SW 잠듦 → 재개 시 여기서 이어 읽음, Q5]

  main-world watcher (모든 페이지·프레임, document_start, 항상 상주)
   ├ 평소: 원래 window.alert/confirm 그대로 통과(D-27, "틀 밖은 가로채지 않음")
   ├ armed(클로저 변수) === true: 첫 confirm() → true 반환 + disarm + 로그 이벤트 발행
   ├ armed === false 뒤 confirm(): false 반환 + "예상 못한 확인 창" 로그 이벤트
   └ alert(): 항상 통과시키되 내용은 로그 이벤트로만 발행(진행 판정에 안 씀)
        │ CustomEvent('helper:dialog-seen', 동일 document) — 스푸핑 가능 전제
        ▼
  ISOLATED content script (같은 프레임) → SW로 릴레이 → activity-log.ts에만 기록 + "멈추기" 트리거
  (성공 판정·다음 단계 진행에는 이 소식을 절대 쓰지 않음 — D-27 하드 룰)

제출 결과 판정(성공/불분명)은 main-world 소식과 별도 경로:
  top-frame: chrome.tabs.onUpdated(status 'complete', url 변화) → SW
  sub-frame: 새 문서의 content script가 document_start에 frame/report로 "다시 보고"
             → SW가 "이 frameId가 다시 보고했다" = 그 프레임 이동으로 간주(Q4)
  성공 메시지: 맨 위 프레임의 MutationObserver가 누르기 이후 "새로 추가된" 텍스트 노드만 스캔
             (누르기 이전부터 있던 글자는 성공 신호로 안 씀)
```

### Recommended Project Structure

```
src/
├── core/
│   ├── template-schema.ts    # 신규: TemplateV1(단계·바뀌는값·제출단계) zod 스키마 + 파일 포맷
│   ├── record-step.ts        # 신규: 기록 이벤트 → 단계 목록 합성(순수 함수, 같은 칸 병합)
│   ├── value-shape.ts        # 신규: 날짜·금액·전화번호 모양 판별 + "오늘 날짜"를 같은 모양으로 생성
│   ├── submit-word.ts        # 신규: 제출 성격 버튼 판별(danger.ts와 자매, stripSpaces 재사용)
│   ├── template-match.ts     # 신규: 실행 시 요소 재탐색 확신 판정(matchScore 임계값+margin, D-15)
│   ├── blocked-context.ts    # 신규: 보안 키패드·CAPTCHA·결제 화면 판별(스크립트/iframe/DOM 신호)
│   ├── activity-log-schema.ts # 신규: 일별 청크 스키마(ActivityDayV1) + 항목 종류
│   ├── mask-pii.ts           # 신규: 주민/계좌/카드/전화 모양을 자유 텍스트에서 가리기(sensitive.ts 정규식 재사용)
│   ├── run-state.ts          # 신규: 틀 실행 상태 기계(순수 함수, storage.session에 얹힐 값 모양 정의)
│   └── (기존 fingerprint.ts·frame-path.ts·frame-tree.ts·danger.ts·settings-schema.ts 그대로)
├── page/
│   ├── record/
│   │   └── recorder.ts       # 신규: 프레임별 기록 훅(press 내부 호출 지점 + input/change/blur)
│   ├── run/
│   │   └── step-executor.ts  # 신규: press/request 받아 matchScore 재탐색 + synthesizePress/fillValue 실행
│   ├── overlay/
│   │   ├── template-save.ts    # 신규: "틀 저장" 화면
│   │   ├── value-cards.ts      # 신규: 바뀌는 값 카드(최근값/오늘/기록값/직접입력)
│   │   ├── template-list.ts    # 신규: 틀 목록 번호 카드
│   │   ├── run-progress.ts     # 신규: 진행 막대 + "n/m 단계" (모드 표시 자리, D-19)
│   │   └── (confirm-dialog.ts 재사용, hints.ts 자매 패턴)
│   └── mainworld/
│       └── dialog-watcher.ts # 신규: world:'MAIN' 진입점 — alert/confirm/prompt 패치(Pattern 8)
├── worker/
│   ├── template-store.ts     # 신규: 틀 CRUD(zod, 단일 저장자)
│   ├── run-orchestrator.ts   # 신규: 실행 상태 기계(단계 포인터, 잠금, 속도, 탭 라우팅)
│   ├── submit-guard.ts       # 신규: "누름" 기록→허가(D-23), 결과 판정 타이머
│   ├── activity-log.ts       # 신규: 일별 청크 쓰기·pruning·마스킹 호출
│   └── (storage-writer.ts·relay.ts 확장, migrate() 자리에 schemaVersion 3 채움)
└── entrypoints/
    ├── content.ts             # 확장: recorder·step-executor·overlay 새 화면 등록
    ├── background.ts          # 확장: 새 op 라우팅, onUpdateAvailable 리스너(top-level)
    └── dialog-watcher.content.ts # 신규 WXT 엔트리포인트(world:'MAIN', registration:'manifest' 권장)
tests/practice-site/
├── workflow.html        # 신규(D-39): 메뉴→양식→제출→결과 흐름(날짜·금액·전화번호 칸)
├── workflow-frame.html  # 신규: iframe 안 양식(같은 출처·다른 출처)
├── workflow-late.html   # 신규: 늦게 나타나는 입력칸
├── workflow-drift.html  # 신규: 제출 뒤 페이지 구조가 바뀌는 케이스(막힘 재현)
├── workflow-ambiguous.html # 신규: 제출 결과가 불분명(이동도 메시지도 없음)
├── workflow-dialogs.html # 신규: 제출 후 확인창 + 이어지는 두 번째 확인창 + 안내창
├── fake-keypad.html     # 신규: 흉내 낸 보안 키패드(D-30 픽스처, 실제 벤더 미검증이라 자체 마커 사용)
├── fake-captcha.html    # 신규: 흉내 낸 자동입력 방지 문자
└── fake-payment.html    # 신규: 흉내 낸 결제 화면(iframe, PG풍 hostname은 로컬 고정물이라 서빙 불가 — data-fake-pg 속성으로 대체)
```

### Pattern 1: 기록기 — press 내부 호출 지점을 훅, DOM 이벤트를 훅하지 않음

**What:** 설계·Q8이 명시하듯 "도우미가 대신 누른 것도 기록해야" 하는데, `synthesizePress()`가 만드는 이벤트는 전부 `isTrusted:false`이고 Phase 1 입력 파이프라인은 `isTrusted` 아닌 입력을 아예 처리기에 넘기지 않는다[VERIFIED: src/page/input/pipeline.ts:81, 128-131, 150-152, 171, 이 세션에 Read — `if (!event.isTrusted || !isHelperEnabled()) return;`]. 따라서 기록기는 DOM 이벤트 리스너가 아니라 **`content.ts`가 이미 갖고 있는 "도우미가 이 요소를 누르기로 결정했다" 호출 지점**(자석 클릭·번호표·머무르기 각각이 최종적으로 부르는 `pressOrDrag()`류 공통 함수, Phase 1 12 Summary가 언급하는 지점[VERIFIED: .planning/phases/01-click-helper-foundation/01-12-SUMMARY.md:149, 이 세션에 Read — "src/entrypoints/content.ts - `pressOrDrag()` 두 호출부 모두..."])에 `if (recording) recorder.onPress(fingerprint, framePath)`를 끼워 넣는다. **진짜 사람의 직접 클릭**은 pipeline의 `onPress` 핸들러 체인 진입점(트러스트 확인이 이미 끝난 지점)에서 같은 방식으로 기록한다 — 결과적으로 "직접 클릭"과 "도우미가 대신 누른 것"이 recorder 입장에서는 같은 한 번의 `onPress` 콜백으로 통일된다(둘 다 이미 트러스트 검증을 통과했거나 도우미가 결정한 동작이므로 신뢰 경계 문제 없음).

값 변경은 `input`/`change` 리스너를 프레임별로 달되, **매 keystroke가 아니라 blur 시점(또는 다음 단계로 넘어가는 시점) 스냅샷만 기록**(Claude's Discretion 권장 — Phase 3 RESEARCH의 "최근 값 기록 시점" 패턴을 그대로 따름[CITED: 이 세션 git show로 읽은 03-RESEARCH.md Pattern 4, "벗어남(blur) 또는 명령판/카드로 채워 넣은 뒤에만 기록"]). 같은 칸을 여러 번 고쳐도 blur가 한 번뿐이므로 자연히 마지막 값만 남는다(Claude's Discretion "같은 칸 여러 번 입력하면 마지막 값만" 요구를 별도 병합 로직 없이 충족).

**When to use:** `content.ts`의 recording 플래그가 true인 동안, 기존 press·input 경로 모두에.

**Trade-offs:** blur 시점 기록은 "입력했지만 아직 blur 안 한 채 제출 버튼을 누르는" 엣지 케이스를 놓칠 수 있다 — 제출 단계 직전에도 한 번 강제로 현재 활성 요소의 값을 플러시하는 보정이 필요(연습 사이트 `workflow.html`로 e2e 확인 권장).

### Pattern 2: 요소 지문 — Phase 1 그대로 + framePath는 이미 포함되어 있음

**What:** Phase 1의 `Fingerprint`가 이미 `framePath: string[]`를 갖고 있다[VERIFIED: src/core/settings-schema.ts:7-16, 이 세션에 Read — `export const FingerprintSchema = z.object({ id: ..., name: ..., labelText: ..., buttonText: ..., aria: ..., domPath: z.string(), framePath: z.array(z.string()) });`]. D-09가 요구하는 "프레임 경로 + 프레임 주소"의 앞부분(framePath)은 이미 있고, "프레임 주소"만 틀 저장 시 별도 필드(`frameOrigin: string`)로 얹으면 된다(막힘 판정에는 안 쓰고, 활동 기록·디버깅 표시용). **재사용이지 신규 스키마가 아니다** — `template-schema.ts`의 각 단계는 `{ fingerprint: Fingerprint, frameOrigin: string, ... }` 형태로 기존 타입을 감싼다.

**When to use:** 기록 단계 저장, 실행 시 재탐색(Pattern 6) 둘 다.

### Pattern 3: 바뀌는 값 모양 판별 + "오늘 날짜"를 같은 모양으로 생성

**What:** 값 문자열에 대해 **어느 모양 하나에 매치**되면 그 모양의 태그(enum)를 저장한다(정규식으로 재추론하지 않고 **선택된 태그를 그대로 보관** — 실행 때 같은 태그로 오늘 날짜를 렌더링해야 왕복이 정확함, Claude's Discretion 확정 권장):

```ts
// src/core/value-shape.ts (신규, 이번 세션 미검증 — 단위 시험으로 고정할 정규식)
export type DateShape = 'yyyy-mm-dd' | 'yyyy.mm.dd' | 'yyyymmdd' | 'mm/dd' | 'yyyy년 m월 d일';
export type ValueShape =
  | { kind: 'date'; shape: DateShape }
  | { kind: 'amount' }      // 12,800 또는 128000원
  | { kind: 'phone' }       // 010-1234-5678, 02-123-4567
  | { kind: 'text' };       // 매치 안 됨 — "직접 입력" 후보로만 표시, 자동 "바뀌는 값" 체크 안 함

const DATE_PATTERNS: Array<{ shape: DateShape; re: RegExp }> = [
  { shape: 'yyyy-mm-dd', re: /^\d{4}-\d{2}-\d{2}$/ },
  { shape: 'yyyy.mm.dd', re: /^\d{4}\.\d{2}\.\d{2}$/ },
  { shape: 'yyyy년 m월 d일', re: /^\d{4}년\s?\d{1,2}월\s?\d{1,2}일$/ },
  { shape: 'mm/dd', re: /^\d{2}\/\d{2}$/ },
  { shape: 'yyyymmdd', re: /^(19|20)\d{6}$/ }, // 순수 8자리 숫자 — 계좌번호 등과 겹칠 위험, 별도 라벨 힌트와 함께 써야 함(Open Questions)
];
const AMOUNT_RE = /^[\d,]{4,}원?$/;
const PHONE_RE = /^(01[016789]-?\d{3,4}-?\d{4}|0\d{1,2}-?\d{3,4}-?\d{4})$/;

export function detectShape(value: string): ValueShape {
  const trimmed = value.trim();
  for (const { shape, re } of DATE_PATTERNS) {
    if (re.test(trimmed)) return { kind: 'date', shape };
  }
  if (PHONE_RE.test(trimmed)) return { kind: 'phone' };
  if (AMOUNT_RE.test(trimmed)) return { kind: 'amount' };
  return { kind: 'text' };
}

export function renderToday(shape: DateShape): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  switch (shape) {
    case 'yyyy-mm-dd': return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    case 'yyyy.mm.dd': return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
    case 'yyyymmdd': return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    case 'mm/dd': return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
    case 'yyyy년 m월 d일': return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  }
}
```

**Trade-offs:** `yyyymmdd`(순수 8자리)는 계좌번호·사번 등과 구분 불가능한 문자열 모양이다 — **라벨 힌트(칸 이름에 "일자"·"날짜" 포함) 없이는 채택하지 말 것을 권장**(Open Questions에 명시, 단위 시험으로 오탐 케이스를 넣어야 함). 금액 정규식(`[\d,]{4,}원?`)도 4자리 이상 순수 숫자를 전부 잡으므로 전화번호·사번과 충돌 여지가 있다 — 우선순위(전화 먼저 검사)로 일부 완화했지만 완전한 방어는 아니다.

### Pattern 4: 제출 성격 버튼 판별 — danger.ts와 대칭 구조

**What:** `src/core/danger.ts`의 `isDanger`/`stripSpaces`와 완전히 같은 모양으로 `isSubmitLike`를 만든다(로직 재사용, 새 개념 없음)[VERIFIED: src/core/danger.ts:5-18, 이 세션에 Read — 전체 인용]:

```ts
// src/core/submit-word.ts (신규)
function stripSpaces(text: string): string { return text.replace(/\s+/g, ''); }
export function isSubmitLike(name: string, words: readonly string[]): boolean {
  const strippedName = stripSpaces(name);
  if (!strippedName || words.length === 0) return false;
  return words.some((word) => {
    const strippedWord = stripSpaces(word);
    return strippedWord.length > 0 && strippedName.includes(strippedWord);
  });
}
export const DEFAULT_SUBMIT_WORDS = ['저장', '상신', '등록', '제출', '신청', '전송']; // 설계 6.8 원문
```

기록 종료 시, 기록된 press 단계들을 순서대로 스캔해 `isSubmitLike(buttonText, words)`가 true인 마지막 단계를 기본 제출 단계로 표시한다(D-12). **그 이전의 제출 성격 단계(예: "임시저장")도 실행 때 확인을 받아야 하므로**, 제출 단계 마킹은 `{ index: number; isFinalSubmit: boolean }[]` 형태로 매치된 단계 전부를 남긴다 — 마지막 것만 `isFinalSubmit: true`(TMPL-09/D-23/D-27의 특수 처리: 누름 기록+main-world arm 대상), 나머지는 실행 시 Phase 1 `confirm-dialog.ts`를 재사용한 일반 확인만(기존 위험 버튼 확인과 동일 컴포넌트, 다른 문구).

사이트별 편집 자리는 위험 단어 목록과 같은 구조(Claude's Discretion 확정 권장) — Phase 3가 SAFE-06용으로 만드는 `siteDangerWords: { site, words }[]`(schemaVersion 2)[VERIFIED: 이 세션 git show로 읽은 03-RESEARCH.md Pattern 9 코드 블록, "siteDangerWords: z.array(z.object({ site: z.string(), words: z.array(z.string()) })), // SAFE-06"] 옆에 `siteSubmitWords`를 같은 모양으로 추가한다(schemaVersion 3로 한 단계 더 올림 — 이유는 Pattern 9 참고).

**Trade-offs:** 제출 단어와 위험 단어는 의미상 겹치지 않게 설계돼 있다(결재·상신을 위험 단어에 안 넣기로 이용자가 이미 거절함, Phase 1 D-18) — 그러나 실행 시 확인 화면 자체(컴포넌트)는 두 판정 모두 같은 `confirm-dialog.ts`를 재사용하므로 문구만 다르게 넘기면 된다(막 새로 만들 필요 없음, Don't Hand-Roll 참고).

### Pattern 5: 실행 오케스트레이션 — SW 단일 상태 기계, storage.session 단계별 기록

**What:** `run-orchestrator.ts`(SW)가 다음 상태 모양을 storage.session에 매 단계 전이마다 쓴다:

```ts
// src/core/run-state.ts (신규)
export interface RunStateV1 {
  schemaVersion: 1;
  templateId: string;
  tabId: number;               // "속성일 뿐 매이지 않음" — Phase 5가 다른 탭에서도 재개 가능하게 tabId는 참고용(D-17)
  stepIndex: number;
  values: Record<string, string>; // 바뀌는 값, 사용자가 이번 실행에 고른 값
  speed: 'slow' | 'normal' | 'max';
  status: 'awaiting-value' | 'running' | 'awaiting-submit-confirm' | 'submit-pressed' | 'awaiting-outcome' | 'blocked' | 'needs-check' | 'done';
  submitPressedAt?: number;     // D-23 "누름" 기록 시각(storage.local의 별도 키에도 중복 기록)
}
```

핵심 흐름은 이미 설계가 확정했으므로(D-17, D-23, D-24) 새 기법이 필요 없다 — **매 상태 전이 직후 즉시 storage.session에 쓰고, SW는 다음 이벤트(프레임의 press 결과 메시지, tabs.onUpdated, 타이머)가 올 때 이 상태를 다시 읽어 이어간다.** SW가 이벤트 사이에 잠들어도 상관없다(이벤트가 오면 자동으로 깨어남 — MV3 표준 동작, 별도 keep-alive 불필요). 유일하게 조심할 지점은 **제출 누르기 직전~결과 확인 사이**인데, 이는 이미 D-23이 "누름"을 `storage.local`(재시작에도 안 지워짐)에 SW→저장 완료 응답을 받은 뒤에만 누르도록 강제해, SW가 그 사이 잠들어도 재개 시 `submit-pressed`만 있고 결과가 없으면 무조건 `needs-check`로 처리하면 그만이다(재시도 금지). **즉 SW 수명 문제는 이미 설계가 "상태 선(先)기록 → 이벤트 유발" 패턴으로 흡수했고, Phase 4가 새로 풀어야 할 문제가 아니라 그 패턴을 정확히 구현하는 문제다.**

실행 잠금(TMPL-07)은 `storage.local`에 `running-templates: { templateId: tabId }[]` 같은 작은 인덱스를 두고, 틀 실행을 시작하기 전 SW가 이 인덱스를 먼저 확인 — 이미 있으면 그 탭으로 `chrome.tabs.update({ active: true })`만 하고 새 실행을 만들지 않는다.

**When to use:** 모든 실행 관련 상태 변경(값 확정, 단계 진행, 제출 확인, 결과 판정, 막힘, 완료).

**Trade-offs:** storage.session 쓰기는 매 단계마다 발생하므로 실행 잠금 인덱스처럼 자주 안 바뀌는 것과 분리해 두 키로 관리하는 편이 낫다(쓰기 경합 최소화, 단일 저장자 큐가 이미 순서를 보장하므로 정합성 문제는 없지만 불필요한 재작성을 줄임).

### Pattern 6: 요소 재탐색 확신 판정 — matchScore + 임계값 + margin

**What:** 기존 `matchScore`(0~6점, framePath 다르면 즉시 0)[VERIFIED: src/core/fingerprint.ts:16-29, 이 세션에 Read, 전체 인용됨]를 그대로 쓰되, 번호표 중복 판정(`isSameElement`, 임계값 2)과는 **다른, 더 엄격한 임계값**을 실행용으로 새로 정의한다(D-15 "확실하다"의 기준은 저장·번호 고정보다 결과가 되돌릴 수 없어 더 보수적이어야 함):

```ts
// src/core/template-match.ts (신규)
import { matchScore } from '@/core/fingerprint';
import type { Fingerprint } from '@/core/fingerprint';

export interface MatchCandidate { fingerprint: Fingerprint; itemId: string; frameId: number }
export interface MatchResult { itemId: string; frameId: number; score: number } | null;

// 단위 시험으로 고정할 두 상수(Claude's Discretion) — 출발값 권장:
// CONFIDENT_MIN(3/6 초과 일치) + MIN_MARGIN(1점 이상 차이). isSameElement의 임계값(2)보다
// 엄격한 이유: 잘못된 재탐색의 대가(엉뚱한 요소를 누름)가 번호 중복(그냥 다시 누름)보다 크다.
export function findConfidentMatch(
  recorded: Fingerprint,
  candidates: readonly MatchCandidate[],
  opts: { confidentMin: number; minMargin: number },
): MatchCandidate | null {
  const scored = candidates
    .map((c) => ({ c, score: matchScore(recorded, c.fingerprint) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  const second = scored[1];
  if (!best || best.score < opts.confidentMin) return null;
  if (second && best.score - second.score < opts.minMargin) return null; // 애매함 = 막힘
  return best.c;
}
```

**요소 대기(느린 등장):** 기존 `collector.ts`의 MutationObserver 배치 갱신[VERIFIED: src/page/collector/collector.ts:8, 453, 이 세션에 Read — `MutationObserver(schedule)`, rAF 코얼레싱]을 그대로 재사용한다 — 매 collector 갱신 틱마다 `findConfidentMatch`를 재호출하고, "천천히/보통"은 관대한 타임아웃(설정값), "최대"는 짧은 타임아웃 뒤 등장 즉시 실행(D-20)으로 튜닝한다. **새 폴링 루프가 필요 없다** — 이미 있는 갱신 스케줄러에 콜백만 얹는다(Don't Hand-Roll).

**같은 화면 일괄 채움(최대 속도):** 연속된 "값 채우기" 단계들의 frameId가 모두 같으면(같은 화면) 단계 사이 인위적 대기 없이 순서대로 재탐색+채움을 실행한다 — 런루프의 최적화일 뿐 새 구조 아님.

**Trade-offs:** `confidentMin`·`minMargin`의 실제 값은 반드시 단위 시험으로 고정해야 한다(D-15, D-40) — 이 연구는 출발값만 제안하고 확정하지 않는다(Assumptions Log A1).

### Pattern 7: 제출 파이프라인 — "누름 기록 → 저장 완료 → 누르기 → 결과 대기"

**What:** D-23을 그대로 코드 경로로 옮긴다:

```
1. content.ts(맨 위): confirm-dialog.ts로 요약 화면 열기(기존 컴포넌트, 문구만 새로 채움)
2. Enter(1초 보호 통과) → SW에 { kind: 'submitConfirmed', templateId, stepIndex } 전송
3. SW(submit-guard.ts): storage.local에 { templateId, stepIndex, pressedAt } 기록(단일 저장자 큐)
   → 쓰기 완료 Promise resolve 확인 후에만 "press/request" 메시지를 그 프레임에 회신
4. content.ts: press/request 받은 뒤에만 synthesizePress(submitButton) 호출
   (그 직전, 같은 동기 호출 스택에서 document.dispatchEvent(new CustomEvent('helper:arm-next-confirm', ...))
    — Pattern 8·Code Example 3 참고)
5. SW: 타이머(설정값, Claude's Discretion) 안에 tabs.onUpdated(complete) 또는
   frame/report 재보고(Q4) 또는 성공 메시지 감지 신호 중 하나가 오면 "성공" → 활동 기록 + 토스트
   못 받으면 "확인 필요"(재시도 절대 없음, run-state.status = 'needs-check')
```

**When to use:** TMPL-09·TMPL-10·TMPL-13 전부 이 파이프라인 하나로 처리된다.

### Pattern 8: main-world 알림 창 감시 — 동기 클로저로 메시지 왕복 회피 (Q1~Q3)

**What:** 세 가지를 분리해서 이해해야 한다 — (a) **어디에 심는가**, (b) **동기적으로 어떻게 "확인 창 하나 기대 중"임을 아는가**, (c) **isolated world와 어떻게 안전하게 통신하는가**.

**(a) 심는 위치:** WXT는 `world: 'MAIN'` 콘텐츠 스크립트를 지원하지만, 공식 가이드는 MV2 호환·크로스 브라우저를 이유로 **`injectScript()` 런타임 주입을 기본 권장**한다[CITED: wxt.dev 문서 요약, WebSearch 2026-09-24 — "WXT recommends injecting a script into the main world manually using its injectScript function... supports both MV2 and MV3 and works across all browsers"]. 이 프로젝트는 **MV3 전용, 크롬 계열만**(D-01 "크롬·엣지·웨일")이라 그 이유가 적용되지 않고, 오히려 `injectScript()`는 isolated 스크립트가 실행된 **뒤에** `<script>` 태그를 만들어 넣는 한 단계를 더 거치므로 페이지의 가장 이른 인라인 스크립트보다 늦게 실행될 위험이 있다. 따라서 **`registration: 'manifest'` + `world: 'MAIN'` + `runAt: 'document_start'`를 직접 선언하는 것을 권장**한다(WXT가 지원하는 옵션[CITED: wxt.dev interfaces 요약, WebSearch — `MainWorldContentScriptEntrypointOptions`, `world: 'ISOLATED' | 'MAIN'`, `registration: 'manifest' | 'runtime'`]) — Chrome의 선언적 `content_scripts`는 **초기 로드뿐 아니라 이후 생성되는 모든 매칭 프레임에도 자동 주입**된다는 것이 표준 동작이므로[CITED: Chrome 공식 문서 요약, WebSearch — "content scripts are injected into any frame created afterwards that matches the script's patterns"] "늦게 나타나는 iframe"(Q1)도 별도 처리 없이 커버된다.

`about:blank`/`srcdoc`/`javascript:` 프레임까지 닿으려면 `matchOriginAsFallback: true`가 필요하고, 이는 **Chrome 119+**부터다[CITED: mv3-extension.com 요약 + Chrome 공식 문서, WebSearch 2026-09-24 — "matchOriginAsFallback... Chrome 119+"]. 더 오래된 `matchAboutBlank`는 `about:blank`/`about:srcdoc`만 커버하고 `data:`/`blob:`은 못 잡는다. **엣지·웨일의 정확한 지원 버전은 이번 세션에 확인하지 못했다**(엣지는 크롬과 메이저 버전이 대체로 동기화되나 웨일은 뒤처질 수 있음) — Open Questions·Assumptions Log에 명시, 폴백으로 `matchAboutBlank: true`(구형)까지는 항상 켜 두고, `matchOriginAsFallback`은 지원 여부와 무관하게 추가로 켜 두면(미지원 브라우저는 그냥 무시) 안전하다[ASSUMED].

**(b) 동기적 "지금 아는가" 문제(Q2):** `window.confirm()`을 패치한 함수는 **동기적으로 boolean을 반환**해야 하므로 SW·isolated world에 물어볼 시간이 없다. 해법은 **main-world 스크립트 자신의 클로저 변수**만으로 판단하게 만드는 것이다 — "틀이 돌고 있는지"를 매번 물을 필요가 없다, "지금 confirm 하나를 기대 중인가(armed)"만 알면 된다(D-27이 실제로 요구하는 것도 그것뿐):

```ts
// src/page/mainworld/dialog-watcher.ts (신규 entrypoint, world: 'MAIN')
let armed = false;
let armedUntil = 0;
const nativeConfirm = window.confirm.bind(window);
const nativeAlert = window.alert.bind(window);

document.addEventListener('helper:arm-next-confirm', (e) => {
  const detail = (e as CustomEvent<{ windowMs: number }>).detail;
  armed = true;
  armedUntil = Date.now() + detail.windowMs; // Claude's Discretion: 몇 초로 할지, 단위 시험 대상
});
document.addEventListener('helper:disarm', () => { armed = false; });

window.confirm = (message?: string) => {
  const isArmedNow = armed && Date.now() < armedUntil;
  if (isArmedNow) {
    armed = false; // 첫 창 하나만(D-27) — 즉시 disarm
    document.dispatchEvent(new CustomEvent('helper:dialog-seen', { detail: { kind: 'expected-confirm', message } }));
    return true;
  }
  // armed가 아니거나 이미 소비됨 = "예상 못한 확인 창"(틀 실행 중이든 아니든 이 함수 자체는 항상
  // 패치돼 있지만, 틀 밖에서는 애초에 armed가 절대 true가 안 되므로 여기로 오면 항상 nativeConfirm 그대로 동작 —
  // D-27 "틀 밖에서는 가로채지 않는다"를 코드로 강제).
  if (armed) {
    // armed였지만 두 번째 확인창 — 예상 밖
    document.dispatchEvent(new CustomEvent('helper:dialog-seen', { detail: { kind: 'unexpected-confirm', message } }));
    return false;
  }
  return nativeConfirm(message); // 틀 밖 평소 사용 — 원래 동작 그대로
};
window.alert = (message?: string) => {
  document.dispatchEvent(new CustomEvent('helper:dialog-seen', { detail: { kind: 'alert', message } }));
  return nativeAlert(message); // alert는 항상 원래대로 보여주고, 내용만 로그용으로 발행(D-27)
};
```

**armed 신호가 어떻게 오는가(cross-origin 내비게이션 이후 프레임도 포함):** 이 스크립트는 **document_start에 모든 매칭 프레임에서 항상 새로 실행**되므로(선언적 content script는 프레임마다 독립 인스턴스), `armed`는 원래 `false`로 시작한다 — 매 페이지/프레임 로드마다 다시 무장해야 한다. isolated world 쪽(`recorder.ts`/`step-executor.ts`)이 제출 버튼을 누르기 **직전**, **같은 동기 호출 스택 안에서** `document.dispatchEvent(new CustomEvent('helper:arm-next-confirm', { detail: { windowMs } }))`를 먼저 호출한 뒤 `synthesizePress(submitButton)`을 호출한다 — `dispatchEvent`는 동기 호출이므로[ASSUMED — DOM 표준 동작, 이번 세션에 실행 검증은 안 함, 다만 CustomEvent 동기성은 웹 플랫폼의 핵심 계약이라 리스크 낮음] main-world 리스너가 `armed = true`를 반영한 **뒤에** 클릭이 디스패치되고, 사이트의 onclick 핸들러가 같은 동기 스택 안에서 `confirm()`을 부르면 이미 무장된 상태를 본다. **탭 이동 자체(같은 탭에서 다른 페이지로 이동하며 그 새 페이지가 곧바로 confirm을 띄우는 경우)는 이 무장 신호가 새 프레임에 전달될 방법이 없다** — 그러나 설계 시나리오(제출 버튼 누른 뒤 같은 페이지에서 뜨는 확인창)에서는 발생하지 않는 케이스이므로 범위 밖으로 둔다(Open Questions에 기록).

**(c) isolated ↔ main 통신:** `CustomEvent`를 `document`에 쏘는 방식을 쓴다(`postMessage`가 아님) — `postMessage`는 iframe·다른 출처에서도 도착해 원치 않는 origin 체크가 추가로 필요하지만, `document`에 쏘는 `CustomEvent`는 **같은 문서 안에서만** 전달되어 그 범위 문제가 없다[CITED: mv3-extension.com 요약, WebSearch 2026-09-24 — "CustomEvent on document stays within the one document... preferable to postMessage because postMessage events also arrive from iframes and other origins"]. `helper:dialog-seen`은 isolated 쪽이 `document.addEventListener`로 받아 SW로 중계 → `activity-log.ts`에 기록 + (unexpected-confirm이면) 즉시 실행 멈춤·경고 카드(TMPL-11). **이 소식은 절대 "성공 판정"이나 "다음 단계 진행"에 쓰지 않는다**(D-27 하드 룰 — 페이지가 `document.dispatchEvent(new CustomEvent('helper:dialog-seen', ...))`를 흉내 내 스푸핑할 수 있기 때문. 코드 리뷰 체크리스트 항목으로 명시할 것).

**Trade-offs:** 이 전체 설계는 **이번 세션에 실제 브라우저 실행으로 검증하지 않았다**(Phase 1의 `showPicker()` 가정이 스파이크 뒤 틀렸던 것과 같은 성격의 리스크) — Phase 4 계획은 Plan 01-12와 같은 **전용 스파이크 작업**(연습 사이트 `workflow-dialogs.html` + e2e)을 초반에 둬서 (1) `world:'MAIN'` document_start 스크립트가 실제로 페이지 인라인 스크립트보다 먼저 실행되는지, (2) `dispatchEvent`의 동기성이 실측에서도 성립하는지, (3) armed 판정이 실제 confirm 호출 시점에 유효한지를 먼저 확인해야 한다.

### Pattern 9: 막힘·다시 기록

**What:** `findConfidentMatch`가 `null`을 돌려주거나, 재탐색된 요소의 부모 화면 구조가 기록 시점과 확연히 다르면(예: 같은 지문의 요소가 여러 개 나타남 — margin 미달) `run-orchestrator.ts`가 `status: 'blocked'`로 전이하고 content.ts가 `--warning` 카드([1 이 단계만 다시 기록][Esc 멈춤])를 띄운다(SYSTEM.md 상태 표 재사용, 신규 컴포넌트 아님). "이 단계만 다시 기록"을 고르면 그 단계 하나만 Pattern 1의 기록 경로를 재사용해 한 번 다시 기록하고, 결과를 Phase 1 확인 화면 보호(1초)를 거친 확인("이 단계를 이렇게 바꿀까요?") 뒤에만 `template-store.ts`에 반영한다(D-28) — 취소하면 틀은 그대로.

**When to use:** `findConfidentMatch` 실패, 타임아웃 초과.

### Pattern 10: 민감칸 — Phase 3 `sensitive.ts` 그대로 재사용(신규 로직 없음)

**What:** Phase 3 RESEARCH가 이미 "한 곳의 판별 함수"로 `src/core/sensitive.ts`를 설계했고 "Phase 4(틀 저장·기록)·Phase 6(AI 전송)이 그대로 import"하도록 명시했다[VERIFIED: 이 세션 git show로 읽은 03-CONTEXT.md D-26 — "같은 판별을 틀 저장(Phase 4)·활동 기록(Phase 4)... 그대로 쓰도록 한 곳의 판별 함수로 만든다"]. Phase 4는 이 함수를 **기록 시점**(민감칸이면 값 대신 "직접 입력" 단계로 표시, D-10)과 **실행 시점**(그 단계에서 멈춰 이용자 입력 대기, TMPL-14)과 **활동 기록 시점**(값 자체는 애초에 로그에 안 남으므로 해당 없음, 그러나 사이트별 이용자 지정 오버라이드는 실행 시점에도 반영해야 함) 세 곳에서 그대로 호출한다. **새로 만들 것이 없다** — Phase 3 실행 결과 파일 경로가 이 연구의 가정과 다르면(D-26 계승 주석대로) 계획 단계에서 실제 경로로 교정.

### Pattern 11: 보안 키패드·CAPTCHA·결제 화면 판별(Q12)

**What:** 세 가지 모두 같은 구조 — 프레임의 `<script src>`/`<iframe src>` 목록과 근접 DOM 신호를 저비용 규칙으로 매치한다. **정확한 벤더별 DOM 마커는 이번 세션에 공식 문서로 확인하지 못했다**(WebSearch로 제품명만 확인 — 라온시큐어 TouchEn nxKey/Transkey가 국내 키보드 보안의 대표 제품이라는 사실만 [CITED: raonsecure.com/raon.com 공식 페이지 제목, WebSearch 2026-09-24], 실제 주입 DOM 구조·전역 변수명은 벤더 SDK 내부 구현이라 접근 불가). 나이스페이 JS SDK 경로 `pay.nicepay.co.kr/v1/js/`만 확인됨[CITED: WebSearch 2026-09-24, nicepay 개발자센터 요약]. 나머지 PG 호스트(이니시스·KCP·토스페이먼츠·카카오페이·네이버페이)는 일반 지식으로 추정한 호스트명 목록이며 **미검증**(Assumptions Log A2):

```ts
// src/core/blocked-context.ts (신규, 정확한 신호는 이번 세션 미검증 — 자체 확장 가능한 목록으로 설계)
export interface BlockedSignals {
  scriptSrcs: readonly string[];   // 그 프레임의 <script src> 전부
  iframeSrcs: readonly string[];   // 그 프레임 안 <iframe src> 전부(결제는 보통 iframe으로 옴)
  nearbyText: readonly string[];   // 대상 입력칸 근처(같은 폼/컨테이너) 텍스트
}
const KEYPAD_HOST_HINTS = ['touchen', 'raonsecure', 'nprotect', 'xecure', 'ahnlab']; // [ASSUMED]
const CAPTCHA_HOST_HINTS = ['recaptcha', 'hcaptcha'];
const CAPTCHA_TEXT_HINTS = ['자동입력방지', '보안문자', 'captcha'];
const PG_HOST_HINTS = ['inicis', 'kcp', 'nicepay', 'tosspayments', 'kakaopay', 'pay.naver', 'npay']; // pay.nicepay.co.kr만 [CITED], 나머지 [ASSUMED]

export type BlockedKind = 'keypad' | 'captcha' | 'payment' | null;
export function detectBlockedContext(signals: BlockedSignals, siteOverrides?: readonly string[]): BlockedKind {
  const all = [...signals.scriptSrcs, ...signals.iframeSrcs].map((s) => s.toLowerCase());
  if (all.some((s) => KEYPAD_HOST_HINTS.some((h) => s.includes(h)))) return 'keypad';
  if (all.some((s) => PG_HOST_HINTS.some((h) => s.includes(h)))) return 'payment';
  if (all.some((s) => CAPTCHA_HOST_HINTS.some((h) => s.includes(h)))) return 'captcha';
  if (signals.nearbyText.some((t) => CAPTCHA_TEXT_HINTS.some((h) => t.includes(h)))) return 'captcha';
  if (siteOverrides?.some((h) => all.some((s) => s.includes(h)))) return 'keypad'; // 이용자 확장 목록
  return null;
}
```

이 판별의 **2차 방어선**: `fillValue()` 호출 뒤 실제로 `.value`가 바뀌었는지 확인 — 안 바뀌었으면(보안 키패드가 readonly로 막았거나 자체 렌더링을 쓰는 경우) 판별 신호가 없어도 "채워지지 않음 = 막힘"으로 자동 폴백(설계가 요구하는 "만나면 멈춘다"의 최후 안전망).

**When to use:** 실행 단계가 값 채우기 또는 누르기 직전, 판별을 매번 재계산(collector가 이미 매 프레임 스캔을 하므로 script/iframe src 목록도 같은 스캔에서 부가 수집하면 비용 추가 거의 없음).

**Trade-offs:** 벤더 화이트리스트는 **필연적으로 불완전**하다(설계 자체가 "cheap testable rules"를 요구하지 완벽한 탐지를 요구하지 않음) — 연습 사이트는 실제 벤더 스크립트를 로드하지 않고 `data-fake-keypad="1"` 같은 자체 마커로 감지 로직을 시험 가능하게 만들어야 한다(D-39, 실제 회사 시스템 시험 금지와도 일치).

### Pattern 12: 파일 내보내기/가져오기 — Phase 3 패턴 재사용 + 위치 정정(Q13)

**What:** Phase 3 연구는 "내보내기 UI는 **반드시 옵션 페이지**"라고 결론 냈지만[CITED: 이 세션 git show로 읽은 03-RESEARCH.md:387], 이는 Phase 3 **자신의 기능 배치 선택**(설정 내보내기를 옵션 페이지 카드로 두기로 한 것)의 결과이지, `Blob`+`<a download>`가 옵션 페이지에서만 동작한다는 기술적 사실이 아니다. `Blob`·`URL.createObjectURL`·`<a download>`는 **`document`가 있는 모든 컨텍스트**(옵션 페이지든 일반 콘텐츠 스크립트든)에서 동작한다 — 콘텐츠 스크립트도 자신만의 격리된 JS 힙을 갖지만 페이지의 실제 `document`를 그대로 참조하므로 `document.createElement('a')`가 정상 동작한다[ASSUMED — 웹 플랫폼 일반 지식, 이번 세션 실행 검증 없음, 근거는 강함(콘텐츠 스크립트는 service worker와 달리 `document`가 실제로 존재)]. **SW만 안 된다**(`document` 없음)[CITED: 이 세션 git show로 읽은 03-RESEARCH.md — "In a service worker, there is no document... URL.createObjectURL on a Blob is unavailable"].

D-34가 "기록 내보내기"를 **명령판 카드**(지금 탭의 오버레이)로 두므로, Phase 4는 이 기능을 **맨 위 프레임의 content script 안에서 직접** Blob+`<a download>`로 구현할 수 있다 — 옵션 페이지로 우회할 필요 없음(더 짧은 구현, D-34 UX와도 자연스럽게 맞음, "명령판에서 눌렀는데 새 탭/페이지로 이동"하지 않아도 됨). 틀 파일 내보내기·가져오기 자리는 Claude's Discretion(옵션 페이지 또는 명령판) — 어느 쪽이든 기술적으로 가능하다는 점이 이번 조사의 정정 사항이다.

**User-activation 주의:** `<a download>`의 `click()` 트리거는 **사용자 제스처 호출 스택 안에서** 실행돼야 팝업/다운로드 차단을 피한다[ASSUMED — 표준 웹 플랫폼 규칙]. "미리보기 → 확인 → 저장"(D-34) 흐름에서, **확인(Enter) 키 입력 처리 함수 안에서 동기적으로** Blob 생성·`a.click()`까지 끝내야 한다 — 그 사이에 `await`로 비동기 저장 요청(SW 왕복)을 끼우면 제스처 컨텍스트가 끊길 수 있으므로, **내보낼 데이터는 확인 화면을 띄우기 전에 미리 SW에서 받아와 두고, Enter 처리 핸들러는 순수하게 동기적으로 Blob+click만 수행**하도록 설계해야 한다.

**When to use:** TMPL-16(틀 내보내기/가져오기), LOG-02(기록 내보내기).

**Trade-offs:** 가져오기는 `<input type="file">`을 열어야 하는데, 이는 Phase 1 스파이크가 이미 "파일 선택은 이용자의 실제 키 입력 처리 안에서 연다"로 확인해 둔 것과 같은 제약(사용자 제스처 필요)이다 — 기존 패턴 재사용.

### Pattern 13: 활동 기록 — 일별 청크(PressesV1과 대칭), 마스킹은 sensitive.ts 정규식 재사용

**What:** 기존 `pressesKey(origin)` 패턴을 그대로 본떠 날짜 키를 쓴다[VERIFIED: src/core/settings-schema.ts:97-99, 이 세션에 Read — `export function pressesKey(origin: string): string { return \`presses:\${origin}\`; }`]:

```ts
// src/core/activity-log-schema.ts (신규)
export function activityLogKey(dateStr: string): string { return `activity:${dateStr}`; } // 'activity:2026-09-24'
export interface ActivityEntry {
  at: number;
  kind: 'press' | 'template-start' | 'template-step' | 'template-end' | 'dialog' | 'blocked' | 'needs-check' | 'undo';
  text: string; // 이미 마스킹된 표시용 문자열(요소 종류+보이는 글자, 또는 칸 이름만 — 절대 입력 값 원문 아님)
}
export const ActivityDayV1 = /* zod: schemaVersion 1 + entries: ActivityEntry[] */;
```

**14일 보존(새 권한 없이):** `alarms` 권한을 새로 받지 않고, **매 쓰기 시점에 opportunistic pruning**을 한다 — 오늘 날짜 기준 15~30일 전 후보 날짜 문자열들에 대해 `chrome.storage.local.remove(activityLogKey(candidateDate))`를 호출(키가 없어도 무해, 존재 검사 없이 그냥 지워도 됨 — `remove`는 없는 키에 대해 에러를 던지지 않음[ASSUMED, storage API 일반 동작]). 이러면 `alarms` 없이도 "매번 쓸 때 자연히 정리"가 된다.

**하루 상한:** `MAX_PRESS_ENTRIES = 200`과 같은 자리에 `MAX_ACTIVITY_PER_DAY`(Claude's Discretion, 예: 500)를 두고 넘으면 가장 오래된 것부터 버린다(기존 `recordPress`의 상한 로직과 동일 패턴, 신규 아님)[VERIFIED: src/worker/storage-writer.ts:126-129, 이 세션에 Read — 같은 패턴의 상한 로직 존재].

**마스킹(D-32):** Phase 3의 `sensitive.ts`는 "이 값이 민감한가"라는 **불리언 판별**이지, "이 자유 텍스트 문자열 안에서 민감한 부분을 찾아 가리기"라는 **치환**이 아니다 — 용도가 다르므로 별도 함수가 필요하지만, **기반 정규식(주민번호·계좌번호·카드번호 모양)은 공유해야 한다**(D-26 "한 곳"의 취지를 정규식 수준에서 지킴). Phase 3가 그 정규식을 export하지 않았다면(불리언 함수 내부에만 있다면) Phase 4 계획에서 **Phase 3 코드를 수정해 정규식 상수를 export로 승격**하는 작업이 필요하다 — 이는 Phase 4의 정당한 선행 작업(기존 동작 변경 없음, export 추가만).

```ts
// src/core/mask-pii.ts (신규) — 개념 예시, 실제 정규식은 sensitive.ts에서 가져와야 함
export function maskPii(text: string, patterns: { re: RegExp; mask: string }[]): string {
  return patterns.reduce((acc, { re, mask }) => acc.replace(re, mask), text);
}
```

**When to use:** 알림 창 글(`helper:dialog-seen`의 `message`), 화면에 보이는 요소 글자(버튼 라벨 등) 모두 `activity-log.ts`에 쓰기 직전 이 함수를 통과시킨다.

### Pattern 14: 주간 통계 — 로그에서 파생 계산(별도 카운터 이중 관리 금지)

**What:** "되돌리기 횟수"와 "틀 1회당 필터 통과 입력 수"는 이미 활동 기록이 `kind: 'undo'`와 `kind: 'template-start'/'template-step'/'template-end'`로 기록하고 있으므로(Pattern 13), **주간 통계는 그 로그를 읽는 시점에 필터링·집계**하면 된다(별도의 "실행 중 누적 카운터"를 storage에 또 쓰지 않음 — 단일 저장자 원칙과 "두 번째 원천 금지" 둘 다 지킴). 다만 활동 기록이 **14일만** 보존되므로(D-33) "주간" 통계가 최근 2주 범위를 넘는 이력은 볼 수 없다는 제약이 생긴다 — 이는 설계 자체의 보존 기간 결정에서 나온 자연스러운 한계이지 Phase 4가 새로 만드는 제약이 아니다(Open Questions에 명시, 필요하면 이용자 결정으로 "통계만 더 오래 보존"을 나중에 고려할 수 있음).

**Trade-offs:** "틀 1회당 필터 통과 입력 수"를 로그에서 재구성하려면 각 `template-step` 엔트리가 그 시점의 "필터 통과 입력 수 증가분"을 함께 실어야 한다(순수 텍스트 로그만으로는 셀 수 없음) — `ActivityEntry`에 선택적 `count?: number` 필드를 추가해 해결(스키마에 이미 반영됨, Code Example 없이 스키마 정의로 충분).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 요소 재탐색 점수 | 새 유사도 알고리즘 | 기존 `matchScore`(fingerprint.ts) + 새 임계값만 | Phase 1이 이미 검증한 로직, framePath 게이트도 이미 있음 |
| 민감칸 판별 | 새 정규식·새 판별 함수 | Phase 3 `sensitive.ts` import | "한 곳의 함수" 설계 원칙(D-26), 이중 유지보수 방지 |
| 값 채우기(네이티브 setter 우회) | 새 fillValue 구현 | Phase 3 `fill-value.ts` import | React 등 controlled input 우회 로직은 Phase 3가 이미 검증 대상으로 설계함 |
| 확인 화면(1초 보호+Enter/Esc) | 새 모달 컴포넌트 | Phase 1 `confirm-dialog.ts`+`confirm-guard.ts` | 포인터로 확인 불가(T-01-25) 같은 보안 속성이 이미 박혀 있음 |
| 요소 늦은 등장 대기 | 새 폴링 setInterval | 기존 `collector.ts`의 MutationObserver+rAF 배치 | 이미 있는 갱신 스케줄러에 콜백만 추가 |
| 프레임 식별·경로 계산 | 새 프레임 트래킹 | `frame-path.ts`(selfPath) + `frame-tree.ts`(resolveReports) | `chrome.runtime.getFrameId`가 Chrome에 없다는 함정을 Phase 1이 이미 겪고 고쳤음 |
| 파일 저장 다이얼로그 | `chrome.downloads` 권한 요청 | `Blob`+`<a download>`(Phase 3 패턴) | 새 권한 승인 절차를 피함 |
| 위험/제출 단어 판별 | 새 문자열 매칭 | `danger.ts`의 `stripSpaces`+`includes` 패턴을 `submit-word.ts`에 복제 | 이미 검증된 단순 규칙, 새 파서 불필요 |
| 상한 있는 배열 관리(활동 기록 하루 상한) | 새 링버퍼 구현 | `storage-writer.ts`의 `MAX_PRESS_ENTRIES` 슬라이스+정렬 패턴 재사용 | 이미 단위 시험 대상인 패턴 |

**Key insight:** Phase 4의 모든 "어려운 부분"은 이미 Phase 1·3이 검증했거나(요소 지문, 값 채우기, 확인 화면) 설계가 명시적 순서로 확정해 둔 것(SW 상태 선기록 패턴)이다. 진짜 신규 리스크는 **main-world 감시의 타이밍**과 **SW를 의도적으로 재우는 시험 방법** 두 가지뿐이다.

## Common Pitfalls

### Pitfall 1: main-world 스크립트가 "너무 늦게" 심겨 페이지 인라인 스크립트를 놓침
**What goes wrong:** `injectScript()` 런타임 주입이나 `registration:'runtime'`을 쓰면 isolated 스크립트 실행 이후에 주입되어, `<head>` 최상단 인라인 스크립트가 이미 `confirm`을 부른 뒤일 수 있다.
**Why it happens:** WXT 가이드의 기본 권장(injectScript)이 이 프로젝트의 타이밍 요구(D-26 "document_start에 미리")보다 느슨한 목적(MV2 호환)으로 최적화돼 있음.
**How to avoid:** `registration: 'manifest'` + `world: 'MAIN'` + `runAt: 'document_start'`를 직접 선언(Pattern 8).
**Warning signs:** e2e에서 "제출 직후 즉시 뜨는 confirm"이 간헐적으로 안 잡힘.

### Pitfall 2: 서브프레임 이동을 `tabs.onUpdated`로 잡으려다 놓침
**What goes wrong:** `tabs.onUpdated`는 탭(최상위 프레임) 수준 이벤트만 보고한다 — iframe만 새로고침/이동해도 이벤트가 안 온다.
**Why it happens:** `webNavigation` 권한 없이 서브프레임 전용 이벤트(`onCommitted`의 frameId!=0 등)에 접근할 수 없음(D-05 목표).
**How to avoid:** 이미 있는 프레임 자기 보고 메커니즘(`frame/report`)을 재사용 — 같은 frameId가 새 `frame/report`를 보내오면 "그 프레임이 새 문서를 로드했다"로 간주(Q4).
**Warning signs:** iframe 안 양식 제출 뒤 결과 판정이 항상 "확인 필요"로만 나옴(성공을 못 잡음).

### Pitfall 3: SW를 "제대로" 재우지 못한 채 재개 시험이 통과한 것처럼 보임
**What goes wrong:** `chrome.runtime.reload()`나 단순 `await new Promise(r => setTimeout(r, 31000))` 대기는 이 프로젝트의 헤드리스 샌드박스에서 새 SW를 Playwright가 관찰 가능하게 깨우지 않는다는 선례가 이미 있다[VERIFIED: .planning/STATE.md — "chrome.runtime.reload()가 이 샌드박스 헤드리스 크로미움에서 새 SW를 관찰 가능하게 깨우지 않아, 재시작 보존 e2e는 같은 user-data-dir로 close+relaunch하는 방식 사용"].
**Why it happens:** 헤드리스 자동화 환경의 SW 라이프사이클 처리가 실제 사용자 크롬과 미묘하게 다름(알려진 Playwright 이슈들, Q7 참고).
**How to avoid:** CDP `Target.getTargets`(session-scoped 아닌 브라우저 스코프 명령)로 `type:'service_worker'` 타겟을 찾아 `Target.closeTarget`으로 강제 종료(Code Example 4) — 그래도 관찰 안 되면, **재개 로직 자체**(storage.session을 읽어 상태 복원하는 함수)를 SW `evaluate()`로 직접 호출해 단위/통합 수준에서 검증하는 우회 전략을 세워야 한다.
**Warning signs:** "SW 재운 뒤 이어가기" 시험이 실제로는 SW를 한 번도 재우지 않은 채 그냥 통과함(거짓 양성 — Phase 1의 select 판정 오류와 같은 성격의 함정).

### Pitfall 4: 활동 기록에 입력 값이 실수로 섞여 들어감
**What goes wrong:** 성공 메시지 판정용 MutationObserver나 알림 창 글 로깅 경로가, 의도치 않게 입력칸의 `value`나 사용자가 입력한 텍스트를 함께 캡처.
**Why it happens:** "화면에 보이는 글자"를 스캔하는 범용 로직이 입력칸 내부 텍스트까지 포함하기 쉬움.
**How to avoid:** 성공 메시지 스캔은 `INPUT`/`TEXTAREA`/`[contenteditable]` 요소를 명시적으로 제외하고, 알림 창 글은 `maskPii()`를 반드시 거친 뒤 저장(Pattern 13).
**Warning signs:** 활동 기록 파일에 금액·이름 같은 값이 그대로 보임(PRIV-01 위반, `/cso` 감사에서 반드시 걸릴 항목).

### Pitfall 5: 제출 단어와 위험 단어 확인 화면이 서로 다른 컴포넌트로 중복 구현됨
**What goes wrong:** "제출 확인"과 "위험 버튼 확인"을 별개 모달로 새로 만들면 1초 보호·포인터 확인 금지 같은 보안 속성이 한쪽에서 누락될 위험이 생김.
**Why it happens:** 요구사항 문서에서 TMPL-09가 별도 항목이라 새 컴포넌트로 착각하기 쉬움.
**How to avoid:** 둘 다 `confirm-dialog.ts`의 `openConfirm({ name, onResult })`를 그대로 호출(Pattern 4·7) — 제목·문구만 다르게.
**Warning signs:** 코드 리뷰에서 `confirm-dialog.ts`를 복붙한 새 파일이 보임.

## Code Examples

### Code Example 1: 기록 훅 삽입 지점(개념)

```ts
// src/entrypoints/content.ts 확장 지점(기존 pressOrDrag 내부, Phase 1 12 Summary가 가리키는 자리)
// [VERIFIED: .planning/phases/01-click-helper-foundation/01-12-SUMMARY.md:149, 이 세션에 Read]
function pressOrDrag(el: Element, fingerprint: Fingerprint, framePath: string[]): void {
  if (recorder.isRecording()) {
    recorder.onStep({ kind: 'press', fingerprint, framePath, buttonText: fingerprint.buttonText });
  }
  const result = synthesizePress(el);
  // ... 기존 picker 처리 그대로
}
```

### Code Example 2: 바뀌는 값 카드 후보 조립(개념)

```ts
// src/page/overlay/value-cards.ts (신규)
interface ValueCandidate { label: string; value: string }
function buildCandidates(step: TemplateStep, recentValues: string[]): ValueCandidate[] {
  const candidates: ValueCandidate[] = [];
  for (const v of recentValues.slice(0, 3)) candidates.push({ label: '최근 값', value: v }); // Phase 3 최근 입력 재사용
  if (step.valueShape?.kind === 'date') {
    candidates.push({ label: '오늘', value: renderToday(step.valueShape.shape) }); // Pattern 3
  }
  candidates.push({ label: '기록된 값', value: step.recordedValue });
  // 마지막 카드는 항상 "직접 입력" — UI 레이어에서 고정 추가
  return candidates.slice(0, 8); // 9번째는 항상 "직접 입력"
}
```

### Code Example 3: CDP로 확장 SW 강제 종료 (Playwright, Q7)

```ts
// tests/e2e/*.e2e.ts — [CITED: developer.chrome.com "Test service worker termination with
// Puppeteer" 요약(WebSearch, 직접 fetch는 egress 차단으로 실패) + Playwright 이슈 스레드 요약,
// Puppeteer 레시피를 이 프로젝트의 launchPersistentContext(Browser 객체 없음, context.browser()
// === null)에 맞게 옮김 — 이번 세션 실행 검증 없음, Phase 4 착수 스파이크로 확인 필요]
async function forceStopServiceWorker(context: BrowserContext, anyPage: Page): Promise<void> {
  // launchPersistentContext는 context.browser()가 null이라 browser.newBrowserCDPSession()을
  // 못 쓴다 — 대신 아무 열린 페이지에 세션을 붙이되, Target 도메인 명령은 세션이 어느 타겟에
  // 붙었든 브라우저 전역으로 동작한다[ASSUMED].
  const cdp = await context.newCDPSession(anyPage);
  const { targetInfos } = await cdp.send('Target.getTargets');
  const sw = targetInfos.find((t) => t.type === 'service_worker');
  if (!sw) throw new Error('service worker target not found');
  await cdp.send('Target.closeTarget', { targetId: sw.targetId });
  // 재기동 관찰: 기존 Worker 객체는 죽는다 — 다음 이벤트가 SW를 깨울 때까지
  // context.waitForEvent('serviceworker') 또는 context.serviceWorkers()[0]을 다시 조회.
  // Chrome이 같은 DevTools host를 재사용해 targetDestroyed가 안 올 수 있다는 보고가 있으므로
  // [CITED: WebSearch 요약] 이 지점이 Phase 4의 첫 스파이크 검증 대상이다.
}
```

### Code Example 4: WXT main-world 엔트리포인트 선언(개념)

```ts
// src/entrypoints/dialog-watcher.content.ts (신규)
// [CITED: wxt.dev interfaces 요약(WebSearch) — world/registration/matchAboutBlank/matchOriginAsFallback
// 옵션 존재는 확인, 정확한 defineContentScript 시그니처는 이번 세션에 wxt.dev 직접 fetch 실패(egress 차단)로
// 미검증 — 계획 단계에서 node_modules/wxt의 타입 정의를 Read해 정확한 필드명을 확정할 것]
export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  world: 'MAIN',
  runAt: 'document_start',
  matchAboutBlank: true,
  matchOriginAsFallback: true, // Chrome 119+에서만 효과, 구버전에선 무시됨[ASSUMED]
  registration: 'manifest',
  main() {
    // Pattern 8의 window.confirm/alert 패치
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `webNavigation` 권한으로 모든 탐색 감지 | 프레임 자기 보고(`frame/report`) 재사용 + `tabs.onUpdated`(최상위만) | 이 프로젝트가 D-05로 "새 권한 0"을 못박음 | 서브프레임 탐색은 정확도가 조금 떨어지지만(추론이지 이벤트가 아님) 권한 승인 절차 회피 |
| `chrome.runtime.getFrameId` | `selfPath`+`resolveReports`(Phase 1이 이미 정정) | Plan 01-07 RESEARCH A2 | Phase 4는 이 정정된 방식을 그대로 상속(재조사 불필요) |
| MV2 `background page`의 무제한 수명 가정 | MV3 SW의 "상태 선기록 → 이벤트로 재개" 패턴 | MV3 도입 이후 업계 표준 | D-17·D-23·D-24가 이미 이 패턴으로 설계됨 — Phase 4는 구현만 하면 됨 |

**Deprecated/outdated:** `document.execCommand`(contenteditable 삽입)는 W3C에서 deprecated 표기이나 Chromium 계열에서 여전히 동작 — Phase 3가 이미 이 트레이드오프를 안고 `fill-value.ts`에 채택[CITED: 이 세션 git show로 읽은 03-RESEARCH.md Pattern 4]. Phase 4는 이를 그대로 상속하며 재평가하지 않는다.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `template-match.ts`의 `confidentMin`/`minMargin` 출발값(3/6 초과, margin 1) | Pattern 6 | 너무 낮으면 잘못된 요소를 눌러 되돌릴 수 없는 결과 위험, 너무 높으면 정상 케이스도 막힘 처리 — 단위 시험(D-15/D-40)으로 반드시 재조정 |
| A2 | 보안 키패드/CAPTCHA/PG 호스트 힌트 목록(`touchen`, `raonsecure`, `inicis`, `kcp`, `tosspayments`, `kakaopay`, `pay.naver`/`npay` 등) | Pattern 11 | `pay.nicepay.co.kr` 외 전부 미검증 — 실제 벤더가 다른 호스트를 쓰면 탐지 실패(단, `fillValue` 무반응 2차 방어선이 있어 완전 무방비는 아님) |
| A3 | `document.dispatchEvent()`가 동기적으로 완료되고, MAIN world의 `document.addEventListener` 리스너가 다음 줄(`synthesizePress`) 실행 전에 반영됨 | Pattern 8, Code Example 4 | 틀리면 "첫 confirm만 자동 확인" 로직 전체가 타이밍 경합에 빠짐 — 전용 스파이크로 최우선 검증 필요 |
| A4 | `world:'MAIN'`+`document_start`+`registration:'manifest'` 콘텐츠 스크립트가 페이지의 가장 이른 인라인 `<script>`보다 먼저 실행됨 | Pattern 8 | 틀리면 아주 이른 시점에 confirm을 부르는 사이트에서 첫 창을 놓침(설계 시나리오상 드묾 — 대개 제출 버튼 클릭 핸들러 안에서 호출되므로 리스크는 낮음) |
| A5 | Chrome 119+가 아닌 엣지·웨일 버전에서 `matchOriginAsFallback`이 무시되거나 에러 없이 무해하게 폴백됨 | Pattern 8 | 틀리면 매니페스트 파싱 자체가 실패할 수 있음(WXT 빌드 단계에서 조기 발견 가능성 높음, 치명적이지 않음) |
| A6 | `chrome.storage.local.remove()`가 존재하지 않는 키에 대해 에러 없이 통과 | Pattern 13 | 틀리면 opportunistic pruning이 예외를 던져 저장 큐를 막음 — 단위 시험으로 조기 확인 가능 |
| A7 | CDP `Target.closeTarget`을 페이지 타겟에 붙은 CDPSession에서 호출해도 브라우저 전역 명령으로 처리됨(session이 붙은 대상과 무관) | Code Example 4 | 틀리면 SW 강제 종료 시험 방법 전체를 다시 설계해야 함 — Phase 1의 close+relaunch 선례가 이미 있는 폴백이지만, close+relaunch는 브라우저 프로세스 자체가 재시작되어 storage.session도 함께 지워지므로(실제로는 D-24가 시험하려는 "SW만 재웠다 깸" 시나리오와 다름) 완전한 대체가 아님 |
| A8 | `<a download>`의 `Blob`/`URL.createObjectURL` 생성·클릭이 콘텐츠 스크립트(옵션 페이지 아님)에서도 동작 | Pattern 12 | 틀리면 "기록 내보내기" 명령판 카드를 옵션 페이지로 우회시켜야 함(Phase 3 방식으로 원복, 구현량 증가) |
| A9 | 8자리 순수 숫자(`yyyymmdd`)를 라벨 힌트 없이 날짜로 자동 판별하면 계좌번호 등과 오탐 | Pattern 3 | 오탐이면 잘못된 "오늘 날짜" 값이 자동 채워져 잘못된 제출로 이어질 수 있음 — 반드시 라벨 힌트 게이트 또는 단위 시험 결과로 제외 여부 재결정 |

## Open Questions (RESOLVED)

1. **엣지·웨일의 `matchOriginAsFallback`/`world:'MAIN'` 실제 지원 버전**
   - What we know: Chrome은 119+에서 `matchOriginAsFallback` 지원[CITED].
   - What's unclear: 엣지·웨일(Chromium 기반이나 버전 동기화 지연 가능)의 정확한 지원 시점.
   - Recommendation: 계획에 "엣지·웨일 수동 확인 목록"(D-41 언급) 항목으로 이 기능의 폴백(`matchAboutBlank`만으로도 대부분 케이스는 커버) 동작을 넣는다.
   - RESOLVED: 04-01이 감시 장치에 `matchAboutBlank: true`와 `matchOriginAsFallback: true`를 함께 켜고(미지원 브라우저는 뒤 키를 무시), 실제 지원 확인은 04-23 Task 3 human-check (1) "MAIN world·document_start 콘텐츠 스크립트와 matchOriginAsFallback이 받아들여진다"로 엣지·웨일에서 수동 확인한다.

2. **"첫 확인 창 인정" 시간 창(windowMs)의 실제 값**
   - What we know: 설계는 "몇 초 안"이라고만 함(Claude's Discretion).
   - What's unclear: 너무 짧으면 느린 사이트에서 확인창을 놓치고, 너무 길면 이용자가 개입할 여지없이 다음 페이지의 무관한 confirm까지 자동 확인할 위험.
   - Recommendation: 단위 시험 + Phase 2/중간 사용자 시험 데이터가 있으면 참고, 없으면 출발값 5초 제안 후 e2e로 조정.
   - RESOLVED: 5초 — 04-01 `src/core/dialog-policy.ts`의 `DEFAULT_ARM_WINDOW_MS = 5000`(단위 시험으로 고정), 04-17이 제출 누르기 직전 `armNextConfirm(DEFAULT_ARM_WINDOW_MS)`로 쓴다. 무장은 누른 프레임에만, 한 번 쓰면 풀린다.

3. **"성공 메시지"로 볼 단어 목록과 대기 시간**
   - What we know: 설계 예시로 "완료", "저장되었습니다"를 듦.
   - What's unclear: 이 목록의 범위와 사이트별 편집 필요 여부(설계엔 명시 없음).
   - Recommendation: 제출 단어 목록과 같은 구조(사이트별 편집 가능)로 확장 가능하게 설계하되 Phase 4 범위에서는 기본 목록만.
   - RESOLVED: 04-10 `src/core/submit-outcome.ts`의 기본 목록 `SUCCESS_WORDS`('완료'는 '완료되었'·'완료했'로 끝맺을 때만)와 `OUTCOME_WAIT_MS = 8000`. Phase 4는 사이트별 편집을 두지 않는다(설계에 없음). 성공 글자는 누른 뒤 새로 나타난 글만 보며, 알림 창 소식은 판정에 넣지 않는다(04-10·04-17).

4. **`yyyymmdd` 8자리 숫자 날짜 판별을 라벨 힌트로 게이트할지 여부**
   - What we know: 라벨 힌트 없이는 계좌번호 등과 구분 불가(A9).
   - What's unclear: 실제 연습 사이트·이용자 업무에서 이 모양이 얼마나 흔한지.
   - Recommendation: 기본은 라벨 힌트 필수로 시작(오탐 방지 우선), 단위 시험에서 과도하게 걸러진다는 신호가 나오면 완화.
   - RESOLVED: 라벨 힌트 필수 — 04-05 `DATE_LABEL_WORDS = ['일자', '날짜', '일시']` 중 하나가 칸 이름에 있을 때만 8자리 숫자를 날짜로 본다(오탐 사례를 단위 시험에 넣음).

5. **주간 통계가 14일 보존 한계를 넘는 장기 추세를 볼 수 없다는 제약을 이용자에게 어떻게 알릴지**
   - What we know: D-33이 로그 보존을 14일로 못박음.
   - What's unclear: 통계 화면에 이 한계를 명시할지 여부는 설계에 없음.
   - Recommendation: 화면 문구에 "최근 2주"임을 명시(카피 규칙 D-38 "같은 행동은 어디서나 같은 단어"와 일관되게).
   - RESOLVED: 화면 문구로 알린다 — 04-16 주간 통계 칸 아래 "최근 2주 기록으로 셉니다", 04-14 미리 보기 제목 "기록 내보내기 · 최근 2주". 통계만 더 오래 보존하는 안은 두지 않는다(D-33).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Chromium(Playwright 번들) | 모든 e2e, CDP 강제 SW 종료 시험 | ✓ | tests/e2e/fixtures.ts가 `PLAYWRIGHT_BROWSERS_PATH` 또는 `channel:'chromium'`로 확보[VERIFIED: tests/e2e/fixtures.ts:17-19, 이 세션에 Read] | — |
| WXT MAIN-world 빌드 산출물 | 알림 창 감시 엔트리포인트 | ✓(설정만 추가하면 wxt build가 처리) | wxt 0.21.4 | — |
| 엣지·웨일 실제 브라우저 | `matchOriginAsFallback` 지원 확인, DIST 수동 확인 목록 | ✗(이 세션·이 샌드박스에 없음) | — | CI는 Chromium만(D-29 기존 결정) — 엣지·웨일은 출시마다 수동 확인 |

**Missing dependencies with no fallback:** 없음(모든 필수 기능이 Chromium+기존 권한으로 구현 가능).
**Missing dependencies with fallback:** 엣지·웨일 실제 브라우저 — Chromium CI + 수동 확인 목록으로 대체(Phase 1부터 이어지는 기존 정책).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V1 Architecture | yes | main-world↔isolated 신뢰 경계를 코드로 강제(D-27 — main-world 소식은 로그·멈추기에만, 절대 성공 판정·진행에 안 씀) |
| V4 Access Control | no | 단일 사용자 로컬 확장, 서버 없음 |
| V5 Input Validation | yes | 가져온 틀 파일 zod 검사(`TemplateSchema`), URL 필드는 `http/https`만 허용(javascript: 등 차단) |
| V8 Data Protection | yes | 민감칸 값 미저장(Phase 3 `sensitive.ts` 재사용), 활동 기록 값 미저장 + PII 모양 마스킹(`mask-pii.ts`) |
| V12 File & Resources | yes | 가져오기 파일 크기 상한(예: 1MB), JSON 파싱 실패·스키마 불일치 시 원본 보존 + 알림 |
| V14 Configuration | yes | 새 권한 0 목표 유지(D-05) — `webNavigation`/`alarms`/`downloads`/`debugger` 전부 회피 |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| 페이지가 `document.dispatchEvent(new CustomEvent('helper:dialog-seen', ...))`를 흉내 내 가짜 "성공" 신호를 보냄 | Spoofing | 이 채널은 로그·멈추기 전용으로만 코드에서 강제(성공 판정 함수는 이 이벤트를 아예 인자로 받지 않도록 타입 설계) |
| 가져온 틀 파일에 `javascript:` 스킴의 시작 페이지 주소가 들어있어 실행 시 위험한 탐색 유발 | Tampering | `template-schema.ts`의 zod가 URL 필드에 `http/https` 스킴만 허용하는 refine 추가, 실행 시(`tabs.update` 직전)도 한 번 더 검사(defense in depth) |
| 제출이 두 번 일어나 중복 상신·중복 등록 | Repudiation/Tampering | run-state의 `submit-pressed` 플래그는 그 실행 인스턴스 내에서 절대 리셋 안 됨(재시도 없음, D-24) |
| 활동 기록 파일에 민감 정보가 새어 들어감 | Information Disclosure | 값은 애초에 기록 안 함(칸 이름만) + 알림 창/버튼 글자는 `mask-pii.ts` 통과 후 저장, 내보내기 전 "미리보기"로 이용자가 직접 확인(D-34) |
| 옵션 페이지·명령판 카드가 확장 ID(`chrome-extension://<id>/...`)를 노출 | Information Disclosure | Phase 1 팝업부터 이미 있는 기존 위협 표면(신규 아님, accept) |

## Sources

### Primary (HIGH confidence)
- `docs/superpowers/specs/2026-09-23-tremor-browser-helper-design.md` — 이 세션에 전체 Read, 특히 4·6.8·6.13·7·8·9·10장
- `.planning/phases/04-templates-activity-log/04-CONTEXT.md` — 이 세션에 전체 Read
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`(Phase 4 절) — 이 세션에 전체/부분 Read
- `src/core/fingerprint.ts`, `frame-path.ts`, `frame-tree.ts`, `danger.ts`, `settings-schema.ts`, `confirm-guard.ts` — 이 세션에 전체 Read
- `src/page/overlay/confirm-dialog.ts`, `src/page/click/press.ts`, `src/page/input/pipeline.ts`, `mode.ts` — 이 세션에 전체 Read
- `src/worker/storage-writer.ts`, `relay.ts`, `src/shared/messages.ts` — 이 세션에 전체 Read
- `.planning/phases/01-click-helper-foundation/01-CONTEXT.md`, `01-12-SUMMARY.md` — 이 세션에 전체 Read
- `origin/claude/phase3-plans-ng6f32:.planning/phases/03-navigation-input-condition/03-CONTEXT.md`, `03-RESEARCH.md` — 이 세션에 `git show`로 전체 Read

### Secondary (MEDIUM confidence)
- Chrome 공식 문서 요약(content scripts, match_origin_as_fallback, storage 쿼터, onUpdateAvailable) — WebSearch 2026-09-24(직접 fetch는 `developer.chrome.com` egress 차단으로 실패, 검색 스니펫만)
- wxt.dev 문서 요약(main-world content script 옵션) — WebSearch 2026-09-24(직접 fetch는 `wxt.dev` egress 차단으로 실패)
- mv3-extension.com 요약(main/isolated world 통신, storage.session vs downloads, SW 테스트) — WebSearch 2026-09-24
- Chrome 공식 "Test service worker termination with Puppeteer" 가이드 요약 — WebSearch 2026-09-24(직접 fetch 실패)

### Tertiary (LOW confidence)
- 국내 보안 키패드/PG 벤더 호스트명 목록(라온시큐어 제품명만 확인, 그 외 대부분 미검증) — WebSearch만, 실행 검증 없음

## Project Constraints (from CLAUDE.md)

이 저장소의 `CLAUDE.md`(프롬프트 캐시 프리픽스)는 이 프로젝트(손 떨림 브라우저 도우미)가 아니라 다른 제품(PLANT8 ERP)의 스택·제품 설명을 담고 있다 — `.planning/STATE.md` "Blockers/Concerns"가 이미 "규칙만 적용"이라고 명시했다[VERIFIED: .planning/STATE.md — "저장소 루트 CLAUDE.md의 제품·스택 설명은 다른 제품(PLANT8 ERP)이지만... 규칙만 적용"]. 아래는 **규칙만** 이 phase 계획에 적용한다(제품·스택 설명은 무시):

- **패키지 매니저:** pnpm만(다른 것 금지) — 이 phase는 새 패키지 설치가 없으므로 직접 해당 없음, 다만 기존 스크립트(`pnpm dev`/`pnpm test`/`pnpm lint`/`pnpm build`)는 그대로 유지.
- **Think Before Coding:** 가정을 명시하고, 여러 해석이 있으면 침묵하지 말고 제시 — 이 연구의 Assumptions Log(A1~A9)가 그 역할.
- **Simplicity First / No 추측성 확장:** 요청 안 된 유연성·설정 옵션 금지 — 예를 들어 `template-match.ts`의 임계값은 설정 가능한 "일반 목적 매처"로 과설계하지 말고 이 phase가 필요로 하는 최소 API만.
- **Surgical Changes:** 기존 파일(특히 Phase 1 `content.ts`, `pipeline.ts`, `storage-writer.ts`, `relay.ts`, `messages.ts`)에 손댈 때 인접 코드 리팩터·포맷 변경 금지, 이 phase의 변경만 추적 가능하게.
- **TDD:** 실패 테스트 → 최소 구현 → 리팩터, 실행 확인 없이 "완료" 금지. **로컬 dev 통과는 완료 신호가 아니다** — `playwright.config.ts`는 CI에서만 프로덕션 빌드를 쓰므로 배포·완료 판정은 `CI=true`로 확인(이미 `tests/e2e/fixtures.ts`가 이 분기를 구현해 둠[VERIFIED: tests/e2e/fixtures.ts:9-14, 이 세션에 Read]).
- **새 의존성·새 권한:** 이유 한 줄 + 승인 후에만. 이 연구는 **0개**를 목표로 확인했다(Standard Stack 절) — 계획 단계에서 이 목표가 깨지면(예: `matchOriginAsFallback` 미지원 브라우저 대응에 `webNavigation`이 필요해지는 경우) 반드시 승인 체크포인트를 계획에 넣을 것.
- **시크릿 금지, `any` 금지:** 신규 파일 전부 strict 타입, 시크릿 없음(이 phase엔 시크릿 대상 자체가 없음 — AI 키는 Phase 6).
- **커밋 규칙:** 한 커밋 한 의도, 제목 영어 접두어(`feat:`/`fix:`/`test:` 등) + 한국어 본문 — GSD 실행자가 이 규칙대로 커밋할 것(연구 문서 자체 커밋도 `docs(04): ...` 형태로 아래에서 수행).
- **요청받지 않은 리팩터 금지:** Phase 3의 미실행 파일(`sensitive.ts` 등)이 이 연구의 가정과 다른 이름/구조로 실제 구현되면, 그 차이를 계획에서 흡수하되 Phase 3 자체를 재작업하지 않는다(D-26 "이어받기" 원칙).
- **Post-build 넷 필수:** 이 phase는 되돌릴 수 없는 제출과 외부 입력(가져온 틀 파일, main-world 소식)을 다루므로 `/review` → `/qa` → `/cso`(필수, 생략 불가) → `/ship`을 실제로 호출해야 한다(D-42가 이미 같은 요구를 명시).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 새 패키지 없음, 버전은 package.json에서 직접 확인
- Architecture: MEDIUM-HIGH — 기존 코드 패턴 재사용은 HIGH(직접 Read), main-world 타이밍·SW 강제 종료는 MEDIUM(WebSearch만, egress 차단으로 1차 문서 직접 확인 실패)
- Pitfalls: MEDIUM — 이 저장소의 실제 선례(STATE.md의 SW 재시작 관찰 실패 사례)에 근거한 것은 HIGH, 나머지는 일반 지식 기반 MEDIUM

**Research date:** 2026-09-24
**Valid until:** 14일(빠르게 움직이는 MV3 API 세부 + 미검증 항목이 많아 짧게 설정)
