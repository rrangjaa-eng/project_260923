# Phase 5: 작업판·뒤에서 실행·반복 패턴 알림 - Research

**Researched:** 2026-09-24
**Domain:** Chromium MV3 확장 — 탭/작업판 상태 조정, 세션 규칙 기반 탭별 네트워크 차단, 숨은 탭 실행, 반복 입력 감지
**Confidence:** MEDIUM (API 표면은 Chrome 공식 문서로 교차 확인 — MEDIUM/HIGH. Playwright 기본 인자는 설치된 소스에서 직접 확인 — HIGH. declarativeNetRequest와 Playwright 네트워크 가로채기의 상호작용은 실측하지 못해 LOW/미해결로 남긴다)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
D-01~D-30 전문은 `.planning/phases/05-board-background-patterns/05-CONTEXT.md`에 있다. 핵심만 요약:
- D-01~D-04: 구조·isTrusted·단일 저장자·저장 위치(자주 가는 곳=sync, 실행 상태·확인 대기=session, 반복 패턴 세기·거절=local)는 Phase 1 결정을 그대로 잇는다. 서버로 나가는 요청 없음.
- D-05~D-11 (작업판, BORD-01~04): 명령판 카드 또는 단축키로 열기, 4구획(열린 탭/자주 가는 곳/뒤에서 도는 틀/확인 대기), 1~9+다음 장, 탭 이동·닫기, 자주 가는 곳은 sync 동기화, 진행 표시는 "3/8 단계" 막대, 확인 대기는 값 고르기·제출 확인을 번호로 처리, 확인 대기 칩은 확인 창을 바로 띄우지 않고 모드 표시 옆 칩 + 아이콘 배지로만 알린다.
- D-12~D-16 (뒤에서 실행, BG-01~03): 다른 탭에서 계속 일할 수 있음, 숨은 탭 속도를 측정해 기록(설계 11장 ③), SW 조정 + DOM 이벤트로 진행(content script `setTimeout` 사슬 금지), 뒤 탭 닫힘·로그아웃 시 멈추고 이유 표시, 이미지·광고 차단은 `declarativeNetRequest` **세션 규칙 + `tabIds` 조건**(전역 규칙 금지)으로 그 틀 실행 탭에서만, `declarativeNetRequest` 계열은 **새 권한**이라 승인 뒤에만 manifest에 넣는다(`debugger`·`webNavigation`·`contentSettings`는 이 단계도 금지).
- D-17~D-19 (반복 패턴, PATN-01): 틀 없이 같은 사이트·같은 입력칸 묶음에 3번 이상 입력하면 "이걸 틀로 저장할까요?"를 한 번만 묻고, 거절하면 다시 안 묻는다. 세기는 정체(사이트+칸 묶음)만 쓰고 값은 쓰지도 저장하지도 않는다. 민감칸은 세기에서 뺀다. 틀 실행/기록 중 입력은 세지 않는다.
- D-20~D-23 (화면): SYSTEM.md·tokens.css만 따른다(Shadow DOM, 3열 카드 격자, 카드 radius 12, 선택 시 남색 3px, 누르는 대상 56px+, 번호 카드 22px/700, 새 색·서체 금지). 브라우저 확대와 무관한 고정 크기, `prefers-reduced-motion` 존중.
- D-24~D-27 (Phase 4 가정 — 다르면 이 계획을 먼저 고친다): 실행 상태는 단계마다 `chrome.storage.session`에 기록되고 Phase 5는 이를 그대로 읽는다(복사본 없음). 실행기는 값 고르기·제출 확인에서 멈춰 SW의 답을 기다리는 모양이며, Phase 5는 "다른 탭에서 처리한 답을 실행 탭에 넘기는" 길을 더한다. 실행 잠금 안내는 Phase 4가, "작업판으로 여는 부분"은 Phase 5가 잇는다. 활동 기록 함수는 Phase 4가 한 곳에 두고 Phase 5(멈춤 이유·확인 대기 처리·반복 패턴 질문/거절)도 값 없이 여기 남긴다.
- D-28~D-30 (시험): 로컬 연습 사이트에 로그인/로그아웃 흉내·이미지+"광고" 섞인 페이지·틀 없이 여러 번 채울 양식을 더한다. 단위 시험은 "반복 패턴 세기"를 이름으로 명시. e2e는 `CI=true` Chromium. UI 완료 판정은 싼 게이트 → 독립 DOM 감사 → 수정 → 전체 게이트 1회.

### Claude's Discretion
- 작업판 단축키 기본 키, 명령판 없이 여는 방법(`chrome.commands`), 단 입력칸 안 글자 입력은 가로채지 않는다.
- 도우미가 뜰 수 없는 페이지(`chrome://newtab`, 설정, 웹스토어)에서 작업판을 여는 방법(아이콘 메뉴/확장 페이지).
- 네 구획을 한 장/여러 장으로 나누는 방법과 번호 매김(1~9+다음 장 안에서).
- 탭 닫기 오확인 방지(예: 번호 고른 뒤 "닫기" 한 번 더).
- 열린 탭을 지금 창만/모든 창 보일지, 정렬 순서.
- 자주 가는 곳 고정/풀기 방법·개수 한도·sync 항목 나누기(8KB 안).
- 확인 대기 처리를 지금 탭 위에서 할지 실행 탭으로 옮길지 — 기본 방향: 지금 탭 위에서 처리, 실제 누르기는 실행 탭에서.
- 뒤에서 실행 시작 방법(새 탭을 뒤에 열기/실행 중 탭 이동 시 그대로 뒤에서 계속).
- 탭 버려짐(discard) 방지 여부·방법(`tabs` 권한 안).
- "로그아웃됨" 판정 규칙 — 단위 시험으로 고정, 애매하면 "막힘"으로 멈춤.
- 광고 요청을 가릴 기준(작은 내장 도메인 목록 등, 외부 목록은 새 의존성 승인 필요).
- 배지 숫자와 Phase 1 "없음" 배지 우선순위.
- 반복 패턴 "같은 입력칸 묶음" 식별 규칙·"한 번 입력" 경계·몇 번째/언제 물을지·"예" 선택 시 동작·세기 보관 기간.
- 메시지 타입 이름, 파일 배치, 설정 형식 버전 올리는 방법.

### Deferred Ideas (OUT OF SCOPE)
- 틀 기록·실행·제출 확인·알림 창 가로채기·막힘·활동 기록 자체(TMPL, LOG) — Phase 4.
- 화면 정리 AI — Phase 6.
- 고정된 회사 사이트에만 새 창 허용(`contentSettings`) — Phase 1 deferred. 뒤에서 도는 틀의 결재 팝업도 동일 제약.
- 회사 시스템에서 확인 — 회사 시스템 완성 뒤.
- 여러 건 한꺼번에 입력, 엑셀 옮기기, 윈도우 상주 프로그램, 모바일, AI 틀 복구 — v2.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BORD-01 | 작업판에서 열린 탭을 번호 카드로 보고 번호로 이동·닫기 | `## 작업판: 탭·창 다루기` — `chrome.tabs.query`/`update`/`remove`/`onRemoved` 확인 사실과 코드 예제 |
| BORD-02 | 자주 가는 사이트를 고정하고 번호로 이동 | `## 작업판: 탭·창 다루기` — sync 저장 패턴(`siteKey` 유사), `chrome.tabs.create`/`update` |
| BORD-03 | 뒤에서 도는 틀의 진행 상황 | `## Phase 4 최소 계약` — `storage.session` 실행 상태를 읽어 그리는 법 |
| BORD-04 | 확인 대기 항목을 번호로 불러와 처리 | `## 확인 대기 처리: 탭 간 메시지 라우팅과 위협` |
| BG-01 | 뒤쪽 탭 실행 + 확인 대기 쌓임 | `## 숨은 탭에서의 실행: 타이머 제한과 측정` , `## Phase 4 최소 계약` |
| BG-02 | 뒤 탭 닫힘·로그아웃 시 멈춤 + 이유 | `## 로그아웃 감지 휴리스틱` |
| BG-03 | 틀별 이미지·광고 차단, 그 탭에서만 | `## 탭별 이미지·광고 차단(declarativeNetRequest)` |
| PATN-01 | 틀 없이 3번 입력 시 "틀로 저장할까요?" 한 번, 거절 시 다시 안 물음 | `## 반복 패턴 감지(PATN-01)` |
</phase_requirements>

## Summary

Phase 5는 새 라이브러리를 들이지 않는다 — 전부 `chrome.*` 확장 API와 기존 코드 패턴(단일 저장자, 판별 유니온 메시지, Shadow DOM 오버레이, 순수 함수 `core/`)의 확장이다. 가장 중요한 두 가지 검증된 사실은 (1) Playwright의 기본 실행 인자가 `--disable-background-timer-throttling`·`--disable-renderer-backgrounding`·`--disable-backgrounding-occluded-windows`를 **무조건** 포함한다는 것(설치된 `playwright-core@1.63.0` 소스에서 직접 확인) — 즉 지금 `tests/e2e/fixtures.ts`로는 실제 숨은 탭 타이머 제한이 재현되지 않으므로 11장 ③ 측정 시험은 `ignoreDefaultArgs`로 이 세 인자를 제거하는 별도 launch 옵션이 필요하다는 것, (2) `chrome.declarativeNetRequest`의 `tabIds` 조건은 **세션 규칙에서만** 허용되고 정적/동적 규칙은 전역이라는 것(D-15가 이미 세션 규칙을 지시한 이유)이다.

새 권한은 `declarativeNetRequest` 계열 하나뿐이다. 이미 `host_permissions: ["<all_urls>"]`가 있으므로 `declarativeNetRequestWithHostAccess`를 쓰면 Chrome이 설치 화면에 **추가 경고를 띄우지 않는다**(Chrome 공식 문서) — "가장 덜 놀라운" 선택이지만, 그래도 저장소 규칙(D-16)상 **넣기 전에 사용자 승인**이 필요한 새 권한이라는 사실은 바뀌지 않는다.

Preact는 `.planning/research/STACK.md`가 추천했지만 `package.json`에 없고 Phase 1이 만든 모든 오버레이(`mode-indicator.ts`, `confirm-dialog.ts`, `hints.ts`, `ring.ts`, `popup/main.ts`)는 전부 순수 DOM + `docs/design/tokens.css` 문자열 주입이다. 작업판처럼 상태가 많은 화면도 이 관례를 따르는 것이 "새 의존성은 승인 후"(CLAUDE.md) 원칙과 "surgical changes" 원칙에 맞다 — Preact 도입은 이 계획의 범위 밖으로 보는 것이 안전하다(планner가 다르게 정하면 승인 받아야 함).

**Primary recommendation:** 작업판·확인 대기·차단 규칙·반복 패턴 세기를 모두 기존 3계층(순수 함수 `core/` → `worker/`의 단일 저장자·조정기 → `page/overlay/`의 Shadow DOM 렌더러) 위에 얹고, `declarativeNetRequestWithHostAccess` 권한 추가는 별도 `checkpoint:human-verify` 태스크로 승인부터 받은 뒤 `wxt.config.ts` 한 줄을 바꾼다. 숨은 탭 속도 측정용 e2e는 반드시 `ignoreDefaultArgs`로 Playwright 기본 스로틀링-비활성화 인자를 제거하는 전용 테스트 파일로 분리한다.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 작업판 UI(4구획, 번호 카드) | Content script (맨 위 프레임 Shadow DOM) | Service worker (상태 소스) | D-01: 화면은 맨 위 프레임, 상태 조정은 SW(설계 4장 구조도) |
| 탭 목록·이동·닫기 | Service worker | — | `chrome.tabs.*`는 확장 페이지/SW에서만 호출 가능, content script는 권한 없음 |
| 자주 가는 곳(고정 사이트) | Service worker(저장) + Content script(표시) | `storage.sync` | 단일 저장자 원칙(D-03), 다른 PC 동기화 |
| 틀 실행 상태·진행 표시 | Service worker(Phase 4 실행기가 씀) | Content script(읽어서 그림) | D-24: `storage.session`이 단일 소스, 복사본 금지 |
| 확인 대기 처리(값 고르기·제출 확인) | Content script(지금 탭 위 화면) + Service worker(라우팅) | 실행 탭 content script(실제 누르기) | D-09, discretion: 지금 탭에서 처리, 실행은 실행 탭에서 |
| 탭별 이미지·광고 차단 | Service worker | — | `declarativeNetRequest.updateSessionRules`는 SW/확장 페이지 전용 API |
| 숨은 탭 진행·속도 측정 | Service worker(조정) + Content script(DOM 이벤트 신호) | — | D-13: content script `setTimeout` 사슬 금지, SW가 시각 기준점 |
| 로그아웃/탭 닫힘 감지 | Content script(휴리스틱 판정) + Service worker(탭 이벤트) | — | 로그인 폼 등장은 DOM만 알 수 있음, 탭 제거는 SW만 앎 |
| 반복 패턴 세기(정체만) | Content script(이벤트 훅) | Service worker(단일 저장자에 기록) | 값은 절대 SW로도 보내지 않고 정체만 |

## Standard Stack

### Core (기존 그대로 — 이 단계에서 추가 없음)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| WXT | 0.21.4 | MV3 빌드 | 이미 확정(`package.json`) [VERIFIED: /home/user/project_260923/package.json:31] |
| TypeScript | 6.0.3 | strict, `any` 금지 | 이미 확정 [VERIFIED: /home/user/project_260923/package.json:27] |
| zod | 4.6.5 | 메시지·저장 형식 검사 | 이미 확정, `src/shared/messages.ts` 전부 zod discriminated union [VERIFIED: /home/user/project_260923/package.json:20] |
| @playwright/test | 1.63.0 | e2e | 이미 확정 [VERIFIED: /home/user/project_260923/package.json:24] |
| Vitest | 5.0.1 | 단위 시험(반복 패턴 세기 등) | 이미 확정 [VERIFIED: /home/user/project_260923/package.json:30] |

### Supporting — 이 단계에서 새로 추가하는 것
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| 없음 | — | — | 이 phase는 `chrome.*` API(declarativeNetRequest, tabs, commands, windows, action, storage.session)만 쓴다. 이미 승인 목록에 있는 Preact조차 아직 미설치이며, 이 phase가 새로 설치할 이유는 없다(아래 "화면 렌더링" 참고) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 순수 DOM 작업판 렌더링(Phase 1 관례 그대로) | Preact 도입 | 작업판은 상태 조합이 Phase 1 화면보다 많지만(4구획×번호 카드), `createCard` 팩토리 패턴(popup/main.ts)을 확장하면 순수 DOM으로도 감당 가능. Preact 도입은 "새 의존성 승인" 절차와 모든 프레임 주입 비용이 더해짐 — 이 phase 범위에서 정당화하기 애매하므로 discretion에 남긴다 |
| 내장 광고 도메인 목록(하드코딩 배열) | 외부 필터 리스트(EasyList 등) 라이브러리/구독 | 외부 목록은 새 의존성 + 주기적 갱신 필요 + 승인 필요. 연습 사이트 시험 목적에는 작은 고정 배열(core/classifiers 스타일)로 충분 |
| `chrome.commands`(브라우저 단축키) | 명령판 카드만으로 진입 | discretion 항목이지만, `chrome://newtab` 등에서 명령판 자체가 못 뜨므로 최소 하나의 브라우저 단축키 경로가 필요(설계 11장 ④ 선례) |

**Installation:** 없음 — `pnpm add` 대상 없음.

## Package Legitimacy Audit

이 phase는 새 npm 패키지를 설치하지 않는다(전부 `chrome.*` 런타임 API 확장). **Package Legitimacy Gate 대상 패키지 없음 — 감사 생략.**

**Packages removed due to [SLOP] verdict:** 없음
**Packages flagged as suspicious [SUS]:** 없음

## Architecture Patterns

### System Architecture Diagram

```
[활성 탭 A: 이용자가 계속 일하는 중]                    [뒤쪽 탭 B: 틀이 도는 중]
┌─────────────────────────────┐                    ┌─────────────────────────────┐
│ content.ts (frameId 0)       │                    │ content.ts (frameId 0)       │
│  - 작업판 오버레이(D-01)      │                    │  - Phase 4 실행기(단계 진행)  │
│  - 확인 대기 칩               │                    │  - 로그인 폼/리다이렉트 감지   │
│  - 확인 대기 처리 화면(D-09)   │                    │    (BG-02 휴리스틱)           │
│  - 반복 패턴 입력 훅(PATN-01) │                    │  - DOM 이벤트로 진행 신호 발신  │
└──────────────┬────────────────┘                    └──────────────┬────────────────┘
               │ chrome.runtime.sendMessage                          │ chrome.runtime.sendMessage
               ▼                                                     ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ service worker (background.ts + worker/*)                                        │
│  ┌─────────────┐  ┌───────────────────┐  ┌────────────────────┐  ┌─────────────┐ │
│  │ board.ts     │  │ runner-bridge.ts  │  │ blocking/rules.ts  │  │ storage-    │ │
│  │ (탭 목록 조합,│  │ (Phase4 storage.  │  │ (declarativeNet    │  │ writer.ts   │ │
│  │  chrome.tabs) │  │ session 읽기·답    │  │  Request session   │  │ (단일 저장자,│ │
│  │              │  │  전달)             │  │  rules, tabIds)     │  │  이미 있음)  │ │
│  └─────────────┘  └───────────────────┘  └────────────────────┘  └─────────────┘ │
│  chrome.tabs.onRemoved/onUpdated → 탭 B 닫힘 감지 → runner-bridge에 멈춤 알림      │
│  chrome.action.setBadgeText → 확인 대기 숫자 배지 (탭별 "없음" 배지와 우선순위 조정) │
└──────────────────────────────────────────────────────────────────────────────────┘
               ▲
               │ chrome.tabs.sendMessage(tabId, ..., {frameId:0})  ← 답을 실행 탭(B)으로
               │
        (확인 대기 처리는 탭 A 화면에서 이루어지고, 실제 "누름"은 탭 B에서 실행)
```

### Recommended Project Structure (기존 `.planning/research/ARCHITECTURE.md` 구조 확장)
```
src/
├── worker/
│   ├── board.ts            # 신규: 탭 목록 조합(chrome.tabs.query), 자주 가는 곳 CRUD
│   ├── runner-bridge.ts     # 신규: Phase4 storage.session 실행 상태 구독, 확인 대기 답 라우팅
│   ├── blocking/
│   │   └── rules.ts         # 신규: declarativeNetRequest 세션 규칙 생성·해제, 탭별 매핑
│   └── badge.ts             # 신규(또는 background.ts 확장): 확인 대기 숫자 배지, "없음"과 우선순위
├── core/
│   ├── ad-domains.ts        # 신규: 내장 광고 도메인 작은 목록(순수 데이터, 단위 시험 가능)
│   ├── logout-heuristic.ts  # 신규: 순수 함수 — URL/폼 신호 → 로그아웃 판정(단위 시험)
│   └── repeat-pattern.ts    # 신규: "반복 패턴 세기" 순수 함수(D-29가 이름으로 지정)
├── page/
│   ├── overlay/
│   │   └── board.ts         # 신규: 작업판 오버레이(mode-indicator.ts와 같은 shadow root 이어씀)
│   └── automation/
│       └── pattern-watch.ts # 신규: submit/pagehide 훅, fingerprint 기반 필드셋 키 계산
tests/practice-site/
├── login.html                # 신규(D-28): 로그인/로그아웃 흉내
├── ads.html                  # 신규(D-28): 이미지 + "광고" 요청 섞인 페이지
└── repeat-form.html          # 신규(D-28): 틀 없이 여러 번 채울 양식
```

### Pattern 1: 작업판은 Phase 4 실행 상태의 "읽기 전용 뷰"다 (D-24)

**What:** 작업판·확인 대기 목록은 `chrome.storage.session`에서 Phase 4가 쓴 실행 레코드를 읽어 그릴 뿐, 별도 복사본을 두지 않는다.
**When to use:** BORD-03·BORD-04 전체.
**Trade-offs:** Phase 4의 실행 상태 스키마가 확정되기 전까지는 이 phase가 가정한 형태(D-24: "어느 틀, 실행 탭, 몇 번째 단계/전체 단계, 받은 값, 상태")로 테스트 더블을 만들어 먼저 개발해야 한다(아래 "테스트 인프라" 참고).

### Pattern 2: 탭별 declarativeNetRequest 세션 규칙 — 생성 시점과 정리 시점을 짝짓는다

**What:** 틀 실행 시작 시 `updateSessionRules({ addRules: [...] })`로 그 탭 ID를 `condition.tabIds`에 넣은 규칙을 추가하고, 아래 네 가지 종료 경로 **모두**에서 `removeRuleIds`로 걷어낸다: (1) 틀 정상 종료, (2) 틀 멈춤(BG-02), (3) `chrome.tabs.onRemoved`(탭이 닫힘), (4) SW 재시작 직후 재조정(살아있지 않은 탭 ID를 가리키는 낡은 규칙 청소).
**Why:** 세션 규칙은 브라우저 세션 동안 메모리에 남고 탭 ID는 탭이 닫히면 재사용된다(Chrome 공식 문서, 아래 "탭별 이미지·광고 차단" 절) — 청소를 빼먹으면 새로 열린 다른 탭이 옛 규칙에 걸려 차단될 수 있다.
```typescript
// Source: https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest (CITED, MEDIUM)
// worker/blocking/rules.ts 예시 — 규칙 id는 tabId 기반으로 고유하게 만든다.
const RULE_ID_BASE = 100000; // 다른 정적/동적 규칙 id와 겹치지 않는 대역

function ruleIdForTab(tabId: number): number {
  return RULE_ID_BASE + tabId;
}

export async function blockImagesAndAdsForTab(tabId: number, adDomains: string[]): Promise<void> {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ruleIdForTab(tabId)],
    addRules: [
      {
        id: ruleIdForTab(tabId),
        priority: 1,
        action: { type: 'block' },
        condition: {
          tabIds: [tabId], // 세션 규칙만 tabIds를 허용한다 — 정적/동적 규칙은 전역(D-15의 근거)
          resourceTypes: ['image', 'media'],
        },
      },
      {
        id: ruleIdForTab(tabId) + 1,
        priority: 1,
        action: { type: 'block' },
        condition: { tabIds: [tabId], requestDomains: adDomains },
      },
    ],
  });
}

export async function unblockTab(tabId: number): Promise<void> {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ruleIdForTab(tabId), ruleIdForTab(tabId) + 1],
  });
}
```
**출처:** `updateSessionRules`/`tabIds`/`resourceTypes`/`requestDomains` 필드명·의미는 Chrome 공식 문서로 교차 확인됨 [CITED: developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest] (MEDIUM). 세션 규칙 상한 5000개(Chrome 120+, 이전엔 동적+세션 합산 5000) — 이 phase는 실행 중인 틀 개수만큼만 쓰므로 상한에 영향 없음 [CITED: MDN — declarativeNetRequest.MAX_NUMBER_OF_SESSION_RULES] (MEDIUM).

### Pattern 3: 숨은 탭 진행은 SW가 시각 기준을 잡고, content script는 DOM 이벤트만 올린다 (D-13)

**What:** `content.ts`의 실행기는 `setTimeout`/`requestAnimationFrame` 사슬로 "다음 단계"를 스스로 예약하지 않는다. 대신 각 단계 완료를 `MutationObserver`/`DOMContentLoaded`/커스텀 이벤트로 감지한 즉시 SW에 메시지를 보내고, **다음 지시(다음 단계 실행 명령)는 SW가 보낸다.** SW의 setTimeout/alarm도 숨은 탭 자체의 타이머는 아니므로 페이지 타이머 스로틀링의 영향을 받지 않는다(SW는 별도 프로세스의 확장 컨텍스트).
**측정 방법(ROADMAP 성공 기준 2):** `performance.now()`를 SW 쪽에서 "명령 보냄" 시각, content script 쪽에서 "완료 신호 받음" 시각으로 남기고 그 차이를 탭이 숨겨진 시간(연속 숨김 경과)별로 버킷 기록한다. 숫자는 계획의 SUMMARY.md에 기록한다(CONTEXT specifics).
**주의:** `MutationObserver` 콜백 자체는 숨은 탭에서도 스로틀링되지 않는다(레이아웃/페인트에 묶인 것이 아니라 마이크로태스크 큐 기반) — 이는 `.planning/research/PITFALLS.md`·`STACK.md`가 이미 전제한 것이며 이번 조사에서 새로 확인한 반례는 없다 [ASSUMED — 이번 세션에서 브라우저 소스나 공식 문서로 재확인하지 않음, 기존 연구 문서의 결론을 이어받음].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 탭별 네트워크 차단 | `webRequest` blocking 리스너로 직접 요청 취소 | `declarativeNetRequest.updateSessionRules` | MV3에서 `webRequest`의 blocking 모드는 제거됐다(비차단 관찰만 가능). DNR이 유일한 차단 수단 |
| 숨은 탭에서 "몇 초 뒤 다음 단계" | content script `setTimeout` 사슬 | SW 메시지 + DOM 이벤트(Pattern 3) | STACK.md "What NOT to Use"가 이미 금지, 실측으로 확인된 스로틀링(Chrome 공식 블로그) 때문 |
| 로그아웃 판정 | 정규식 하나로 "log" 문자열 찾기 | 여러 약한 신호(리다이렉트 origin/path 변화, 비밀번호 필드 등장) 조합 + 애매하면 "막힘" | 오탐이 진행 중인 정상 작업을 멈추면 신뢰를 잃는다(설계 9장 원칙) |
| 반복 패턴 필드셋 식별 | 새 식별자 체계 | Phase 3의 요소 식별 묶음(`Fingerprint`: id/name/labelText/aria/domPath/framePath, `src/core/settings-schema.ts:7-16`)을 값 없이 재사용 | 이미 검증된 동일성 판정(`matchScore`, `src/core/fingerprint.ts:16-29`)이 있다 — 새로 만들면 두 가지 "같은 요소" 정의가 생겨 불일치 위험 |

**Key insight:** 이 phase가 다루는 문제 대부분(탭 조정, 세션 규칙, 스로틀링 대응)은 "MV3 확장이 원래 이렇게 하라고 설계된" 영역이라, 직접 구현할 여지가 적다 — 위험은 라이브러리 부재가 아니라 **정리(cleanup) 누락**(세션 규칙, 탭별 상태 Map, storage.session 항목)이다.

##작업판: 탭·창 다루기 (BORD-01, BORD-02)

- `chrome.tabs.query({})`는 모든 창의 탭을, `{ currentWindow: true }`는 지금 창만 반환한다 — "지금 창만/모든 창"은 discretion이므로 두 경우 다 구현 비용이 같다.
- 탭 활성화: `chrome.tabs.update(tabId, { active: true })`만으로는 **다른 창에 있는 탭이면 그 창이 포커스되지 않는다.** 다른 창의 탭을 활성화하려면 `chrome.windows.update(windowId, { focused: true })`를 같이 호출해야 한다 [ASSUMED — 이 세션에서 공식 문서로 재확인하지 않은 일반 지식, MV3 확장 개발에서 널리 알려진 동작이지만 이번 조사에서 1차 출처를 열람하지 못했다. 플래너는 e2e에서 실제 검증할 것].
- 탭 닫기: `chrome.tabs.remove(tabId)`.
- "최근 쓴 순서" 정렬: `Tab.lastAccessed`(ms epoch)는 **Chrome 121부터** 제공되고, 112~121에서는 `undefined`, 탭이 discard되면 다시 `undefined`가 된다 [CITED: developer.chrome.com/docs/extensions/reference/api/tabs] (MEDIUM). 순서 정렬 기능을 discretion으로 택한다면 이 필드가 없는 구버전 Chrome 대비 폴백(예: `tabs.onActivated` 이력을 SW가 직접 쌓기)을 권장.
- 탭 닫힘/갱신 감지: `chrome.tabs.onRemoved`(파라미터: `tabId, removeInfo`), `chrome.tabs.onUpdated`(`changeInfo.status`) — 이미 `src/worker/relay.ts:40-47`과 `src/entrypoints/background.ts:44-52`가 같은 이벤트를 쓰고 있다 [VERIFIED: /home/user/project_260923/src/worker/relay.ts:40-47] `chrome.tabs.onRemoved.addListener((tabId) => { reportsByTab.delete(tabId); });` / `chrome.tabs.onUpdated.addListener((tabId, changeInfo) => { if (changeInfo.status === 'loading') { reportsByTab.delete(tabId); } });` — Phase 5의 board.ts·blocking/rules.ts는 이 관례(탭 ID를 키로 한 Map, onRemoved에서 정리)를 그대로 따른다.
- `tabs` 권한은 이미 있고 제목·URL을 이미 볼 수 있다(`src/entrypoints/background.ts`가 `tab.url`을 읽는 것으로 확인). 새 권한 불필요.
- 자주 가는 곳 저장: `SiteEntryV1`(`src/core/settings-schema.ts:71-95`)의 `pins` 배열과 유사한 새 sync 키(예: `favorites`)를 만들되, 한 항목 8KB 제한(D-03)을 넘지 않게 URL을 저장하고 제목은 탭 활성 시점에 `chrome.tabs.query`로 다시 읽는 편이 안전(제목이 바뀌어도 낡지 않음).

## 뒤에서 도는 틀의 진행 상황 (BORD-03) 과 Phase 4 최소 계약

이 phase가 Phase 4에 요구하는 최소 인터페이스(D-24~D-27을 코드 계약으로 구체화):

1. **실행 상태 읽기:** `chrome.storage.session`에 `run:<runId>` 같은 키로 `{ templateId, tabId, stepIndex, totalSteps, status: 'running'|'awaiting-value'|'awaiting-confirm'|'blocked'|'awaiting-verification'|'done'|'stopped', values, stoppedReason? }` 형태의 레코드가 있다고 가정한다. Phase 5는 `chrome.storage.session.get(null)` 또는 프리픽스 스캔으로 모든 `run:*` 키를 읽어 작업판의 "뒤에서 도는 틀" 구획을 그린다.
2. **재개/답 전달 메시지:** 값 고르기·제출 확인에서 실행기가 "멈춰서 SW의 답을 기다리는" 것이 D-25의 전제이므로, Phase 5는 새 메시지 타입(예: `board/answer`, 판별 유니온에 추가)으로 SW에 답을 보내고, SW가 그 답을 **실행 탭**의 content script에 `chrome.tabs.sendMessage(runTabId, { type: 'runner/resume', ... }, { frameId: 0 })`로 전달하는 다리 역할만 한다 — 실제 재개 로직은 Phase 4 것을 그대로 호출.
3. **실행 잠금 안내 확장:** Phase 4가 "이미 도는 틀"을 감지해 안내 메시지를 만들면, Phase 5는 그 안내에 "작업판에서 진행 상황 보기" 딥링크(예: 작업판을 그 실행 항목이 선택된 상태로 열기)를 추가한다(D-26).
4. **활동 기록 호출:** Phase 4가 만드는 한 곳의 로그 함수(가칭 `logActivity(entry)`)를 Phase 5의 멈춤 이유·확인 대기 처리·반복 패턴 질문/거절 지점에서 호출한다(D-27) — 이 phase가 로그 저장 형식을 새로 만들지 않는다.

**리스크:** Phase 4가 아직 계획되지 않았으므로 위 스키마는 CONTEXT.md의 서술(D-24)을 코드 형태로 옮긴 **가정**이다 [ASSUMED — Phase 4 PLAN이 나오기 전]. 플래너는 이 가정을 Phase 4 계획과 대조하는 태스크를 Wave 0에 넣어야 한다(CONTEXT.md "앞선 단계 의존" 문단이 이미 요구함).

## 확인 대기 처리: 탭 간 메시지 라우팅과 위협

D-09·discretion(지금 탭 위에서 처리, 실제 누르기는 실행 탭에서) 기준의 흐름:

```
탭 A(이용자가 지금 보는 화면)                SW                         탭 B(실행 탭)
확인 대기 카드 선택 ──(board/select-queue-item)──▶
                                          storage.session에서 항목 읽음
                                          ◀──(board/queue-item-detail)── (값/요약 내려보냄)
값 고르기·제출 확인 화면 표시(탭 A)
Enter/번호 선택 ──(board/answer, {runId, answer})──▶
                                          sender.tab.id === (작업판을 연 탭)인지 확인
                                          runId → runTabId 조회(storage.session)
                                          ──(runner/resume, {answer})──▶ (frameId 0로만)
                                                                        confirm-guard 재적용,
                                                                        "누름" storage.local 기록,
                                                                        실제 제출
```

### storage.session과 content script

`storage.session`의 기본 `AccessLevel`은 `TRUSTED_CONTEXTS`뿐이라 **content script는 기본적으로 읽지 못한다** — SW 또는 확장 페이지만 읽는다 [CITED: developer.chrome.com/docs/extensions/reference/api/storage] (MEDIUM). `setAccessLevel({accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'})`로 완화할 수 있지만 이는 **확장 전체·모든 사이트**에 적용되는 전역 설정이라, 이 phase는 완화하지 않고 **SW가 항상 중개**하는 D-01 원칙을 그대로 따르는 것을 권장한다(작업판 오버레이는 `chrome.runtime.sendMessage`로 SW에 상태를 요청/구독).

### 위협 모델 (threat_model에 반영)

| 위협 | 설명 | 완화 |
|------|------|------|
| 다른 탭의 content script가 위조한 메시지 | 악성/취약 사이트의 페이지 스크립트가 `chrome.runtime.sendMessage`를 흉내 내 확인 대기를 조작 시도 | `sender.id === chrome.runtime.id` 확인은 이미 관례(`background.ts:69`) — content script만 보낼 수 있고 페이지 JS는 `chrome.runtime` 접근 불가(isolated world). 그래도 `board/answer`의 `runId`가 실제 `storage.session`에 있는 유효한 실행인지 SW가 항상 재검증 |
| 같은 확인 대기 항목이 두 탭에서 동시에 처리됨 | 이용자가 작업판을 두 프레임/탭에서 열었을 때 이중 클릭 유사 상황 | SW가 `board/answer` 처리 시 해당 `runId`의 상태를 `awaiting-*`에서 즉시 다른 상태로 전이시키고, 이미 전이된 뒤 온 두 번째 답은 무시(idempotent) — Phase 4의 "누름" 기록(TMPL-13 패턴)과 동일한 원칙 재사용 |
| SW 재시작 후 낡은 확인 대기 | SW가 잠들었다 깨어난 사이 실행 탭이 이미 닫혀 있었는데 큐 항목이 남아 있음 | 작업판을 그릴 때마다 `runTabId`가 `chrome.tabs.get`으로 실제 존재하는지 확인, 없으면 "뒤 탭이 닫힘" 카드로 전환(BG-02 결과 재사용) |
| 실행 탭이 확인 처리 도중 닫힘 | 탭 A에서 값을 고르는 사이 탭 B가 닫힘 | `board/answer` 전송 직전 `chrome.tabs.get(runTabId)`로 재확인, 실패하면 "뒤 탭이 닫힘" 오류로 되돌리고 값 고르기 화면 닫음 |
| 신뢰되지 않은 입력으로 확인 처리 | 떨림/스크립트가 확인 대기 처리 화면의 Enter를 흉내 | D-02가 이미 요구: 확인 대기 처리 화면도 `isTrusted` + `confirm-guard.ts`(1초 보호, `src/core/confirm-guard.ts:1-80`) 재사용 [VERIFIED: /home/user/project_260923/src/core/confirm-guard.ts:1-80] |

## 숨은 탭에서의 실행: 타이머 제한과 측정 (BG-01, D-13, 설계 11장 ③)

### 브라우저 스로틀링 사실 (CITED, MEDIUM)
- 기본 스로틀링: 숨은 탭 타이머는 1초 단위로 정렬(코얼레싱)됨.
- 집중 스로틀링(intensive throttling): 탭이 5분 넘게 숨겨져 있고, 30초 이상 "조용"(소리 없음)하고, WebRTC 미사용, 연쇄 타이머가 5개 이상이면 타이머 체크가 **분당 1회**로 느려짐.
- `requestAnimationFrame`은 숨은 탭/iframe에서 콜백이 멈춘다.
- 오디오 재생 중이거나 WebSocket/RTC 연결이 활성인 탭은 일반적으로 스로틀링에서 면제된다.
[CITED: developer.chrome.com/blog/timer-throttling-in-chrome-88]

### 스로틀링에서 자유로운 것
- `MutationObserver` 콜백, `message`/DOM 이벤트(예: `input`, `submit`)는 타이머 기반이 아니므로 스로틀링 대상이 아니다 — 이것이 D-13이 "SW 조정 + DOM 이벤트"를 요구하는 근거다 [ASSUMED — 이번 세션에서 1차 출처로 재확인하지 않았으나 `.planning/research/PITFALLS.md`·`STACK.md`가 이미 전제].
- SW 자체의 타이머(`chrome.alarms`, SW 컨텍스트의 `setTimeout`)는 페이지 타이머 스로틀링 대상이 아니다(별도 프로세스) — SW가 "다음 단계 진행"의 시각 기준점 역할을 하기에 적합.

### Playwright로 측정하기 — 결정적 발견

**설치된 `@playwright/test@1.63.0`은 기본적으로 다음 Chromium 인자를 항상 붙인다** (headless/headed와 무관, `chromiumSwitches` 함수 안, 조건문 없이 배열 리터럴의 일부):
```
--disable-background-timer-throttling
--disable-backgrounding-occluded-windows
--disable-renderer-backgrounding
```
[VERIFIED: node_modules/.pnpm/playwright-core@1.63.0/node_modules/playwright-core/lib/coreBundle.js — `chromiumSwitches = (options) => [...]` 배열 안에 조건 없이 포함, 직접 grep/read로 확인]

즉 **지금 `tests/e2e/fixtures.ts`의 `chromium.launchPersistentContext('', { args: [...] })`(파일 57~60행)로 뜨는 모든 e2e는 숨은 탭 타이머 제한이 꺼진 상태**다 [VERIFIED: /home/user/project_260923/tests/e2e/fixtures.ts:57-60] — `const context = await chromium.launchPersistentContext('', { ...(executablePath ? { executablePath } : { channel: 'chromium' }), args: [...] });`. 11장 ③ 측정 시험을 이 픽스처로 그대로 돌리면 실제 이용자가 겪는 스로틀링보다 훨씬 빠른(스로틀링 없는) 숫자가 기록되어 **의미 없는 측정**이 된다.

**권장 조치:** 측정 전용 테스트 파일(예: `tests/e2e/background-speed.e2e.ts`)에서 `context`를 새로 만들 때 `ignoreDefaultArgs`로 이 세 인자만 제거한다:
```typescript
// Source: 위 VERIFIED 발견 + Playwright 공식 launchPersistentContext 옵션(ignoreDefaultArgs: string[])
const context = await chromium.launchPersistentContext('', {
  args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  ignoreDefaultArgs: [
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
  ],
});
```
`ignoreDefaultArgs`를 배열로 주면 나열한 인자만 기본 목록에서 빠지고 나머지 기본 인자(`--disable-extensions` 등 확장 로딩에 필요한 값)는 유지된다 — `ignoreDefaultArgs: true`(전체 무시)는 쓰지 않는다 [ASSUMED — Playwright 공식 API 문서(`BrowserType.launchPersistentContext`)의 일반 동작으로 알려져 있으나 이번 세션에 1차 문서 페이지를 직접 열람하지 않았다. 플래너는 실제로 이 옵션을 넣고 실행해 인자가 빠졌는지(`chrome://version` 등으로) 확인하는 검증 스텝을 넣을 것].

측정 방법 제안: 뒤쪽 탭을 만들고(`context.newPage()` 후 활성 탭을 다른 페이지로 전환해 숨김 처리), SW가 "단계 N 시작" 메시지를 보낸 시각과 content script가 "단계 N 완료" 신호를 올린 시각의 차이를 여러 단계에 걸쳐 기록, 숨김 지속 시간(0~5분/5분 이상) 구간별 평균 지연을 숫자로 SUMMARY.md에 남긴다.

**헤드리스 관련 참고:** `launchPersistentContext('', {...})`는 `headless` 옵션을 명시하지 않으므로 Playwright 기본값(`headless: true`)을 쓴다 — `devices['Desktop Chrome']`는 `playwright.config.ts`의 `projects[0].use`에만 적용되고 `fixtures.ts`가 `chromium.launchPersistentContext`를 직접 호출하는 경로에는 적용되지 않는다(즉 `use` 옵션과 무관하게 독자적으로 launch함) [VERIFIED: /home/user/project_260923/tests/e2e/fixtures.ts:56-60, /home/user/project_260923/playwright.config.ts:12-17 — 두 파일을 비교]. "탭 숨김"은 headless 자체와는 별개 개념(page visibility API 기준)이므로 headless 모드에서도 `document.visibilityState`가 `'visible'`인 활성 탭과 `'hidden'`인 비활성 탭을 구별해서 시험할 수 있다.

## 탭별 이미지·광고 차단(declarativeNetRequest) (BG-03, D-15, D-16)

### 권한 선택
| 권한 | 설치 시 경고 | 이 phase에 맞는 이유 |
|------|-------------|----------------------|
| `declarativeNetRequest` | 설치 시 경고 뜸 | host_permissions가 이미 `<all_urls>`라 중복 경고 |
| `declarativeNetRequestWithHostAccess` | **설치 시 별도 경고 없음**(호스트 권한만 있으면 됨) | 이미 `<all_urls>` 보유 — 추가 브라우저 경고 없이 동작 [CITED: developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest] |

**권장:** `declarativeNetRequestWithHostAccess`. 단, D-16의 "새 권한은 승인 뒤에만 manifest에 넣는다"는 **저장소 규칙**이지 Chrome의 경고 여부와 무관하므로, Chrome이 경고를 안 띄운다는 사실이 승인 절차 자체를 건너뛰는 이유가 되지 않는다 — 플래너는 여전히 `checkpoint:human-verify`를 이 권한 추가 태스크 앞에 넣어야 한다.

`wxt.config.ts`에 추가할 정확한 변경(현재 3~12행):
```typescript
// wxt.config.ts — 변경 전
permissions: ['storage', 'scripting', 'tabs'],
host_permissions: ['<all_urls>'],
```
```typescript
// wxt.config.ts — 변경 후(승인 뒤에만)
permissions: ['storage', 'scripting', 'tabs', 'declarativeNetRequestWithHostAccess'],
host_permissions: ['<all_urls>'],
```
[VERIFIED: /home/user/project_260923/wxt.config.ts:9-11 — 현재 `permissions: ['storage', 'scripting', 'tabs'], host_permissions: ['<all_urls>'],`]

### API 형태 (CITED, MEDIUM)
- `chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds, addRules })` — 단일 원자적 호출, 세션 동안만 메모리에 유지(재시작 시 사라짐).
- `condition.tabIds`는 **세션 규칙 전용** — 정적/동적 규칙에 쓰면 검증 오류. 이것이 D-15가 "전역 규칙 금지, 세션 규칙 + tabIds"를 명시한 근거.
- `resourceTypes`: 이미지 차단은 `'image'`(추가로 `'media'` 고려 — 비디오 썸네일 등). 전부 소문자 열거형.
- 광고 차단은 별도 리소스 목록이 없으므로 `requestDomains`(광고 도메인 배열)로 구현 — 외부 필터 리스트 의존성 없이 작은 내장 배열(`core/ad-domains.ts`)로 시작(discretion).
- 세션 규칙 상한 5000개(Chrome 120+) — 이 phase는 실행 중 틀 수만큼(보통 한 자릿수)만 쓰므로 문제 없음.

### 정리(cleanup) 필요 시점 — Pattern 2 참고. 틀 종료·멈춤·탭 onRemoved·SW 재시작 후 재조정 네 가지 모두.

### 미해결 위험: Playwright 네트워크 가로채기와 DNR의 상호작용 순서

`tests/e2e/fixtures.ts`는 `context.route('**/*', ...)`로 **모든** 요청을 Playwright(CDP) 레벨에서 가로채 `practice.test`/`other.test`만 인라인으로 응답하고 나머지는 `route.abort()`한다(파일 66~104행) [VERIFIED: /home/user/project_260923/tests/e2e/fixtures.ts:66-104]. `declarativeNetRequest`는 Chrome 네트워크 서비스 레이어에서 요청을 차단하고, Playwright의 CDP 기반 라우팅은 그와 **다른 개입 지점**일 가능성이 있다 — 어느 쪽이 먼저 적용되는지(즉 DNR이 막은 요청이 Playwright의 `route` 콜백에 아예 도달하지 않는지, 혹은 Playwright가 먼저 가로채 DNR이 절대 평가되지 않는지)를 이번 세션에서 실측하지 못했다. **[ASSUMED — 확인 안 됨, 이 phase의 e2e 설계 전에 반드시 먼저 확인이 필요한 스파이크 대상]**

**권장 검증 스텝(플래너가 Wave 0에 넣을 것):** 연습 사이트에 `<img>` 태그로 `http://other.test/some-image.png` 같은, 기존 fixtures가 이미 `route.fulfill`로 응답 가능한 경로를 가리키게 하고, DNR 세션 규칙으로 그 탭에서 `image` 리소스 타입을 차단한 뒤 `page.on('requestfailed')` 또는 `<img>`의 `naturalWidth === 0`으로 실제 차단 여부를 관찰한다. 만약 Playwright의 `route.abort()`/`route.fulfill()`이 DNR보다 먼저 요청을 처리해버려 DNR 효과가 전혀 관찰되지 않는다면, 이 phase의 e2e는 `context.route`를 이 시나리오에서만 우회하는 대안(예: 실제 로컬 HTTP 서버를 띄워 CDP 라우팅 없이 순수 브라우저 요청으로 만들기)이 필요할 수 있다.

## 로그아웃 감지 휴리스틱 (BG-02)

순위(오탐 위험이 낮은 것부터, discretion이 요구한 "애매하면 막힘"과 결합):

| 신호 | 오탐 위험 | 비고 |
|------|-----------|------|
| 리다이렉트로 origin이 실행 시작 origin과 달라짐 | 낮음 | 회사 시스템이 SSO 제공자로 리다이렉트하는 정상 흐름과 구별 필요 — "로그인 페이지로 보이는 경로 패턴"(예: `/login`, `/signin`)과 결합해야 신뢰도 상승 |
| 같은 origin 안에서 비밀번호 입력 필드(`input[type=password]`)가 새로 나타남 | 중간 | 2단계 인증·비밀번호 변경 화면과 구별 어려움 — 단독으로는 "막힘"으로만 취급, 자동으로 "로그아웃"이라 단정하지 않는 편이 안전 |
| HTTP 상태 401/403을 반환하는 페이지로 전환 | 낮음(감지 어려움) | content script는 최상위 문서의 응답 상태를 직접 알기 어렵다 — 실무적으로는 `webNavigation`(이 phase에서 금지, D-16) 없이는 정확한 상태 코드를 못 읽는다. `fetch`/`XHR` 가로채기 없이는 신뢰도 낮음 → 우선순위 낮게 |
| 페이지 제목/문구에 "로그인"·"세션 만료" 등 텍스트 포함 | 낮음~중간 | 사이트마다 문구가 달라 일반화 어려움, 사이트별 설정으로 보완 여지(v2) |

**권장:** origin 변화 + 로그인스러운 경로 패턴을 기본 신호로 삼고, 단독 신호이거나 애매하면 "로그아웃"으로 단정하지 말고 D-14가 이미 요구하는 "막힘"(다시 제출하지 않음, 이유 표시)으로 처리한다. 이 규칙 자체는 순수 함수(`core/logout-heuristic.ts`)로 만들어 단위 시험 대상으로 삼을 것 — 연습 사이트 `login.html`이 origin 리다이렉트와 비밀번호 필드 등장을 둘 다 흉내 낼 수 있어야 한다(D-28).

## 반복 패턴 감지 (PATN-01, D-17~D-19)

- **훅 지점:** `submit` 이벤트(폼이 있는 경우)와 "제출 성격 버튼" 클릭(Phase 4가 정의할 판별기 재사용 가능성, 폼이 없는 SPA 대응) 둘 다 필요 — `pagehide`/`beforeunload`는 "한 번 입력"의 경계(제출/페이지 벗어남)를 잡는 보조 신호로 discretion이 이미 언급.
- **필드셋 키:** `Fingerprint`(`src/core/settings-schema.ts:7-16`)의 `id`·`name`·`labelText`·`domPath`·`framePath` 조합에서 **값은 빼고 정체만** 모아 그 페이지의 입력칸 묶음을 대표하는 키를 만든다. 순서·일부 차이를 얼마나 허용할지는 discretion — 기존 `matchScore`(문턱 2 이상 일치, `src/core/fingerprint.ts:31-33`)의 완화판을 재사용하는 것을 권장(완전히 새 유사도 함수를 만들지 않는다 — Don't Hand-Roll).
- **민감칸 제외:** Phase 3의 한 곳 판별 함수(PRIV-01, 아직 코드 없음 — Phase 3와 동시 진행 중)가 "민감함"이라 판정한 칸은 필드셋 계산에서 완전히 뺀다. Phase 3 함수의 정확한 시그니처는 이 세션에서 읽을 수 없었으므로(다른 브랜치 `claude/phase3-plans-ng6f32`), **플래너는 Phase 3 산출물이 합쳐진 뒤 시그니처를 다시 확인하는 태스크**를 넣어야 한다 [ASSUMED — 함수가 "칸 하나를 받아 민감함/아님을 반환하는 순수 함수"라는 서술(CONTEXT D-18)만 확인, 실제 export 이름·타입은 미확인].
- **세기 저장:** `storage.local`, D-04. `PressesV1`(`src/core/settings-schema.ts:100-114`)과 유사하게 `{ schemaVersion, data: { counts: [{ patternKey, count }], declined: [patternKey] } }` 형태를 제안 — "거절한 패턴은 다시 안 묻는다"(D-17)를 위해 `declined` 배열이 반드시 필요.
- **틀 실행/기록 중 제외:** Phase 4의 실행기·기록기가 동작 중인지 신호(예: `mode/report`류 메시지 또는 별도 플래그)를 content script가 확인해 그 동안의 입력은 세지 않는다 — Phase 4와의 또 다른 접점이므로 Phase 4 계획과 대조 필요.
- **단위 시험(D-29 "반복 패턴 세기"):** 순수 함수로 `(existingCounts, patternKey) => nextCounts`, `(declined, patternKey) => boolean`, "3번째에서 물음, 4번째부터 안 물음(거절 시)/계속 실행(수락 시 틀 기록 시작)" 상태 전이를 표로 시험.

## UI: 작업판 템플릿을 먼저 SYSTEM.md에 (D-21)

`docs/design/SYSTEM.md`(126행 부근)는 현재 "명령판·작업판 (가운데 큰 카드 격자)"만 있고 4구획 배치는 없다 [VERIFIED: /home/user/project_260923/docs/design/SYSTEM.md:94-107 — "**명령판·작업판** (가운데 큰 카드 격자)" 아래 명령판 템플릿만 있고 작업판 전용 배치는 없음]. DESIGN.md §4-1 절차대로, 플래너는 실제 화면 구현 전에 **SYSTEM.md에 작업판 템플릿을 추가하는 태스크**를 먼저 넣어야 한다. 그 템플릿이 최소한 명시해야 할 것:
- 4구획(열린 탭/자주 가는 곳/뒤에서 도는 틀/확인 대기)을 한 장에 나눌지 장을 나눌지, 그리고 각 구획 안에서 1~9+"다음 장" 번호 매김 규칙(기존 명령판 규칙 `docs/design/SYSTEM.md:103` "자주 쓰는 8개를 첫 장 1~8에... 9는 다음 장"과 일관되게).
- 진행 막대 + "3/8 단계"(D-08)를 표시할 카드 안 레이아웃(기존 상태 표 "틀 실행" 행의 문구를 그대로 재사용, `docs/design/SYSTEM.md:139`).
- 확인 대기 카드의 "막힘·확인 필요" 스타일(`--warning` 테두리, 이미 정의된 컴포넌트 규칙 `docs/design/SYSTEM.md:123`).
- 탭 닫기 오확인 방지 UI(번호 선택 → "닫기" 재확인 카드 등, discretion).

렌더링은 위 "화면 렌더링" 절에서 밝혔듯 Preact 없이 순수 DOM(`popup/main.ts`의 `createCard` 팩토리, `overlay/confirm-dialog.ts`의 style-string-inject 패턴)을 그대로 확장하는 것을 권장.

## 배지 (D-10)

- `chrome.action.setBadgeText({ tabId, text })`/`setBadgeBackgroundColor({ tabId, color })`는 이미 `background.ts:35-41`에서 탭별로 쓰이고 있다("없음" 배지, `MUTED_COLOR`는 `tokens.css`의 `--muted`를 런타임에 추출) [VERIFIED: /home/user/project_260923/src/entrypoints/background.ts:16-24,33-42].
- 확인 대기 숫자 배지는 **탭별이 아니라 전역**(확장 아이콘 전체)이어야 한다 — `tabId`를 생략하고 호출.
- 우선순위 충돌(discretion): 지금 탭이 "도울 수 없음"(`isUnsupportedUrl`)이면 D-21 원칙("도울 수 없음"은 그 탭에서 도우미가 전혀 동작 안 한다는 뜻)을 살려 그 탭에서는 "없음" 배지를 유지하는 편이 자연스럽다 — 확인 대기 숫자는 그 탭에서 처리할 수 없는 정보가 아니라(작업판은 다른 탭에서도 확인 대기를 볼 수 있음) **탭에 종속되지 않는 전역 배지**이므로 애초에 "없음"(탭별)과 배지 슬롯이 겹치지 않는다 — 단, `chrome.action.setBadgeText`는 탭별 값이 없으면 전역값이 보이므로, "없음"을 설정한 탭에서도 전역 확인 대기 숫자가 가려지는 문제가 생긴다. **권장:** "없음" 탭에서는 탭별 배지를 유지하되, 그 탭에서만 확인 대기 숫자를 함께 보여주고 싶다면 문자열을 합쳐야 한다("없음 · 2" 같은 조합은 배지 폭 제약상 비현실적) — 가장 단순한 방향은 "없음" 탭에서는 확인 대기 숫자를 배지에 표시하지 않고(작업판을 열면 어차피 보인다), "도울 수 있는" 탭에서만 전역 확인 대기 숫자를 배지로 보여주는 것. 이 절충은 discretion이므로 플래너가 확정.
- 색상은 `tokens.css`의 `--accent`(남색) 사용 권장(D-10 "남색 테두리, 숫자 굵게" 칩과 통일감) — 단 아이콘 배지 배경은 흰 글자 대비가 필요하므로 `--accent`(#1B2B4B) 배경 + 기본 흰 글자(Chrome 배지 기본 글자색은 흰색).

## 테스트 인프라 (D-28, D-29)

- **연습 사이트 추가 페이지:** `login.html`(로그인/로그아웃 흉내 — origin 리다이렉트 + 비밀번호 필드 등장 두 신호 모두 재현 가능하게), `ads.html`(이미지 태그 다수 + "광고"로 취급할 도메인의 리소스), `repeat-form.html`(같은 필드셋을 가진 폼을 여러 번 제출 가능하게, 제출해도 페이지가 리로드되지 않아 반복 입력을 쉽게 시험).
- **광고 도메인 시험:** `tests/e2e/fixtures.ts`의 `context.route`가 `practice.test`/`other.test` 두 origin만 인라인/정적 파일로 응답하므로(66~69행), "광고" 리소스는 새 origin을 추가하지 않고 `other.test`를 광고 도메인으로 간주해 재사용하는 것이 가장 적은 변경이다 — `blockedRequests` 배열(기존 목적: 외부 유출 감시)과 헷갈리지 않도록 별도의 `expectImageBlocked` 류 헬퍼를 새로 추가할 것을 권장.
- **DNR과 Playwright 상호작용의 불확실성**은 위 "미해결 위험" 절 참고 — 이 phase의 e2e 설계 전에 반드시 스파이크로 선확인.
- **Phase 4 없이 Phase 5 테스트하기:** Phase 4가 아직 계획되지 않은 상태이므로, 이 phase의 e2e(진행 표시, 확인 대기 처리)는 Phase 4의 실제 실행기 대신 **테스트 더블**(SW가 이해하는 `storage.session` 레코드를 Playwright의 `serviceWorker.evaluate()`로 직접 주입 — 기존 `frameStates` 조작 패턴과 동일선상, `tests/e2e/fixtures.ts`의 `serviceWorker.evaluate` 사용 관례 재사용)을 권장한다. Phase 4가 합쳐진 뒤에는 실제 실행기로 교체하는 후속 태스크를 남긴다. 하드 의존(Phase 4 코드가 있어야만 Phase 5 e2e가 통과)은 두 phase의 병렬 계획 작성이라는 현재 상황과 맞지 않는다.
- **단위 시험 대상(순수 함수):** `core/repeat-pattern.ts`(D-29 "반복 패턴 세기" 지정), `core/logout-heuristic.ts`, `core/ad-domains.ts`(매칭 로직이 있다면).

## Common Pitfalls

### Pitfall 1: Playwright 기본 인자가 스로틀링을 꺼버려 측정이 무의미해짐
**What goes wrong:** 11장 ③ 측정 e2e를 기존 `fixtures.ts` 그대로 돌리면 숨은 탭 타이머 제한이 애초에 적용되지 않아 "빠르다"는 잘못된 숫자가 기록된다.
**Why it happens:** Playwright가 테스트 재현성을 위해 기본으로 백그라운드 스로틀링을 끈다(VERIFIED, 위 참고).
**How to avoid:** 측정 전용 테스트 파일에서 `ignoreDefaultArgs`로 세 인자만 제거.
**Warning signs:** 측정된 지연이 1초 미만으로 일관되게 나옴(스로틀링이 있었다면 최소 1초 단위 코얼레싱이 보여야 함).

### Pitfall 2: 세션 규칙 정리 누락으로 다른 탭이 오차단됨
**What goes wrong:** 틀이 비정상 종료(SW 강제 재시작 등)됐을 때 `removeRuleIds`가 호출되지 않고, 탭 ID가 재사용되면서 새 탭이 옛 이미지 차단 규칙에 걸림.
**How to avoid:** SW 시작 시(`onInstalled`/서비스워커 재시작 감지) 살아있는 실행(`storage.session`의 `run:*`)과 대조해 대응하는 탭이 없는 세션 규칙을 모두 걷어내는 재조정 루틴을 둔다.
**Warning signs:** 관련 없는 탭에서 이미지가 갑자기 안 뜸.

### Pitfall 3: storage.session을 content script가 직접 읽으려다 실패
**What goes wrong:** 작업판 오버레이(content script)가 `chrome.storage.session.get(...)`을 직접 호출해 항상 빈 값을 받는다.
**Why it happens:** 기본 AccessLevel이 `TRUSTED_CONTEXTS`뿐(CITED).
**How to avoid:** SW를 항상 경유(메시지 요청/응답 또는 SW가 밀어주는 상태 갱신) — D-01 구조 원칙과도 일치.

### Pitfall 4: 로그아웃 오탐으로 정상 작업을 멈춤
**What goes wrong:** SSO 리다이렉트 같은 정상 흐름을 로그아웃으로 오판해 진행 중인 틀을 불필요하게 멈춤.
**How to avoid:** 단일 신호로 단정하지 않고, 애매하면 "로그아웃"이 아니라 "막힘"(다시 제출 안 함, 이유 표시)으로 처리 — 사용자가 직접 판단.

### Pitfall 5: 반복 패턴 세기가 틀 실행/기록 중 입력까지 세어버림
**What goes wrong:** "틀 없이 3번"이라는 조건(D-17)을 어기고 틀 실행 중 자동 입력까지 카운트해 잘못된 시점에 질문이 뜬다.
**How to avoid:** 세기 훅이 Phase 4의 실행/기록 상태를 확인하고 그 동안은 완전히 건너뛴다.

## Code Examples

### 확인 대기 답을 실행 탭으로 전달 (Pattern, D-25 확장)
```typescript
// Source: 기존 relay.ts 관례(src/worker/relay.ts:99-104 hints/press와 같은 라우팅 방식)를
// 그대로 확장한 예시 — 실제 메시지 타입 이름은 플래너의 discretion.
if (message.type === 'board/answer') {
  const run = await getSessionRun(message.runId); // Phase 4 계약(가정)
  if (!run || run.tabId === undefined) {
    return; // 낡은 큐 항목 — Pitfall 2류 방어
  }
  const stillOpen = await chrome.tabs.get(run.tabId).catch(() => undefined);
  if (!stillOpen) {
    // BG-02와 같은 "뒤 탭이 닫힘" 처리로 되돌림
    return;
  }
  void chrome.tabs.sendMessage(
    run.tabId,
    { type: 'runner/resume', runId: message.runId, answer: message.answer },
    { frameId: 0 },
  );
}
```

### 세션 규칙 정리 — SW 시작 시 재조정
```typescript
// Source: Pattern 2 확장 — declarativeNetRequest.getSessionRules로 현재 규칙을 읽고
// (Chrome 공식 API, CITED) storage.session의 살아있는 실행과 대조한다.
async function reconcileBlockingRules(): Promise<void> {
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  const activeRunTabIds = await getActiveRunTabIds(); // Phase 4 storage.session 스캔
  const staleIds = rules
    .filter((r) => !r.condition.tabIds?.some((id) => activeRunTabIds.has(id)))
    .map((r) => r.id);
  if (staleIds.length > 0) {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: staleIds });
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `webRequest` blocking으로 이미지/광고 차단 | `declarativeNetRequest` (block/allow 규칙) | MV3 전환(Chrome 확장 전반) | 이 프로젝트는 처음부터 MV3이므로 "이전 방식"을 쓸 일이 없다 — 참고용 |
| `chrome.tabs.executeScript` 콜백형 | `chrome.scripting.executeScript` Promise형 | MV3 | 이미 `scripting` 권한 보유, Phase 5는 직접 쓸 일 적음(참고) |

**Deprecated/outdated:** 없음 — 이 phase가 쓰는 API는 전부 현재 MV3 권장 방식.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `chrome.tabs.update({active:true})`만으로는 다른 창의 탭 포커스가 안 되고 `windows.update({focused:true})`가 추가로 필요 | 작업판: 탭·창 다루기 | 잘못이면 불필요한 추가 호출이 생길 뿐(안전한 방향의 가정) — e2e로 쉽게 검증 가능 |
| A2 | MutationObserver/DOM 이벤트는 숨은 탭에서 스로틀링되지 않는다 | 숨은 탭에서의 실행 | 만약 실제로 지연된다면 D-13 설계 전제 자체가 흔들림 — 11장 ③ 측정 e2e가 이를 실측으로 검증하므로 계획 단계에서 이미 검증 계획이 포함됨 |
| A3 | Playwright `ignoreDefaultArgs`를 배열로 주면 나열한 인자만 제거되고 나머지 기본 인자는 유지 | 숨은 탭에서의 실행 | 잘못이면 확장 로딩 자체가 깨질 수 있음 — 플래너는 이 옵션 적용 직후 기존 skeleton e2e(확장 로딩 확인)가 여전히 통과하는지 먼저 확인해야 함 |
| A4 | declarativeNetRequest 세션 규칙이 Playwright의 `context.route` CDP 가로채기와 공존하며 관찰 가능하다 | 미해결 위험 (declarativeNetRequest 절) | 잘못이면 이 phase의 차단 e2e 전체를 다른 방식(실제 로컬 서버)으로 다시 설계해야 함 — **가장 리스크 큰 가정, Wave 0 스파이크 필수** |
| A5 | Phase 3의 민감칸 판별 함수가 "칸 하나 → 민감함/아님" 형태의 순수 함수로 존재할 것 | 반복 패턴 감지 | 실제 시그니처가 다르면(예: 요소가 아니라 필드셋 전체를 받음) 통합 코드를 다시 써야 함 — Phase 3 산출물 합류 후 재확인 필요(이미 CONTEXT.md가 명시) |
| A6 | Phase 4 실행 상태 스키마가 D-24 서술대로 `{templateId, tabId, stepIndex, totalSteps, status, values}` 형태일 것 | Phase 4 최소 계약 | Phase 4 계획이 다르게 나오면 board.ts/runner-bridge.ts 인터페이스 전체를 다시 씀 — CONTEXT.md가 이미 "다르면 이 계획을 먼저 고친다"고 명시 |
| A7 | 확장 아이콘 배지 기본 글자색이 흰색이라 `--accent` 배경과 대비가 충분 | 배지 | 대비가 부족하면 디자인 검토 단계에서 발견될 가능성 높음, 낮은 리스크 |

## Open Questions

1. **declarativeNetRequest 세션 규칙과 Playwright CDP 요청 가로채기의 상호작용 순서**
   - What we know: 둘 다 "요청이 나가기 전"에 개입하는 메커니즘이지만 서로 다른 레이어(Chrome 네트워크 서비스 vs CDP)라는 것.
   - What's unclear: 어느 쪽이 먼저 적용되는지, `context.route`가 이미 모든 요청을 가로채는 현재 `fixtures.ts` 구조에서 DNR 차단 효과를 e2e로 관찰할 수 있는지.
   - Recommendation: 이 phase 착수 전 Wave 0 스파이크로 먼저 확인. 안 되면 실제 로컬 HTTP 서버(정적 파일 서빙)로 전환하는 대안을 준비.

2. **`chrome.commands` 단축키가 `chrome://newtab` 등 확장이 주입되지 않는 페이지에서도 발동하는지**
   - What we know: 기본(비-global) 커맨드는 "브라우저가 포커스를 가지고 있을 때" 발동한다고 공식 문서가 설명하나, `chrome://` 시스템 페이지에 포커스가 있을 때도 포함되는지는 명시적으로 확인하지 못함.
   - What's unclear: discretion 항목("도우미가 뜰 수 없는 페이지에서 작업판을 어떻게 열지")의 답이 이 사실에 달려 있음.
   - Recommendation: 플래너가 실측(연습이 아닌 실제 `chrome://newtab` 탭에서 단축키 시험, 수동 확인 목록 또는 e2e `page.goto('chrome://newtab')` 가능 여부 확인)으로 조기에 검증. 안 되면 discretion이 이미 제시한 대안(아이콘 메뉴/확장 자체 페이지)으로 대체.

3. **웨일·엣지에서 `declarativeNetRequestWithHostAccess`·`chrome.storage.session`·`tabs.lastAccessed` 동작 차이**
   - What we know: Phase 1 D-29 선례대로 이 phase도 엣지·웨일은 수동 확인 목록으로 미룬다.
   - What's unclear: 크로미움 기반이라 대체로 동일할 것으로 보이나 확인된 바 없음(STACK.md가 이미 웨일 sync 동작을 LOW로 표시한 것과 같은 성격의 불확실성).
   - Recommendation: 이 phase 범위에서는 크롬만 자동 시험, 수동 확인 목록에 declarativeNetRequest 차단·작업판 단축키 항목 추가.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Chromium(Playwright 번들) | e2e 전체 | ✓ | @playwright/test 1.63.0 대응 빌드 [VERIFIED: /home/user/project_260923/package.json:24] | — |
| `chrome.declarativeNetRequest*` API | BG-03 | ✓(Chromium 계열은 MV3부터 기본 제공) | 브라우저 내장, 별도 설치 불필요 | 없음 — 필수 |
| Preact | 작업판 UI(만약 채택 시) | ✗(미설치) [VERIFIED: /home/user/project_260923/package.json — dependencies/devDependencies에 preact 없음] | — | 순수 DOM(기존 관례) 사용 — 이 phase는 이 폴백을 기본으로 삼는다 |
| `@types/chrome` | 타입 체크 | ✗(미승인, ambient 선언 사용) [VERIFIED: /home/user/project_260923/src/types/chrome.d.ts:1-2 — "`@types/chrome`는 승인된 의존성 목록에 없어..."] | — | `src/types/chrome.d.ts`에 `declarativeNetRequest`·`windows`·`commands`·`storage.session` 등 이 phase가 쓰는 표면을 추가 — 새 패키지 아님, 편집만 |

**Missing dependencies with no fallback:** 없음.
**Missing dependencies with fallback:** Preact(순수 DOM으로 대체, discretion에서 재확인).

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | 아니오(확장 자체는 인증 시스템을 운영하지 않음) | — |
| V3 Session Management | 예(느슨한 의미) | `chrome.storage.session` 실행 상태의 신뢰 경계는 SW뿐 — content script는 직접 접근 못 함(위 Pitfall 3) |
| V4 Access Control | 예 | `board/answer` 등 SW 메시지는 `sender.id === chrome.runtime.id` 확인(기존 관례 재사용), `runId` 유효성 SW가 항상 재검증 |
| V5 Input Validation | 예 | 새 메시지 타입은 기존 관례대로 `src/shared/messages.ts`에 zod discriminated union으로 추가, `storage.local`에 새로 쓰는 반복 패턴 세기 레코드도 zod 스키마 + `schemaVersion`(D-03) |
| V6 Cryptography | 아니오 | 이 phase는 암호화 대상 데이터 없음(값을 저장하지 않음, PATN-01 D-18) |

### Known Threat Patterns for 이 phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| 페이지 스크립트가 확장 메시지를 위조해 확인 대기를 조작 | Spoofing | isolated world라 페이지 JS는 `chrome.runtime.sendMessage` 자체를 호출 못 함 + `sender.id` 확인(기존 관례) |
| 낡은/탈취된 `runId`로 임의 탭에 `runner/resume` 유도 | Elevation of Privilege | SW가 `runId`→`storage.session` 레코드 존재·상태(`awaiting-*`)를 매번 재검증, 없으면 무시 |
| 반복 패턴 세기가 실수로 값(입력한 문자열)을 저장 | Information Disclosure | 단위 시험으로 "정체 키에 원본 값이 전혀 포함되지 않음"을 직접 검증(fingerprint 필드는 라벨/이름/경로일 뿐 입력값 아님을 재확인) |
| declarativeNetRequest 규칙이 다른 탭까지 실수로 차단 | Tampering(가용성 저하) | `tabIds` 조건 필수화 + 정리 루틴(Pattern 2) — 코드 리뷰 체크리스트 항목으로 남길 것 |
| SW 재시작 중 확인 대기 항목이 두 번 처리됨(중복 제출) | Repudiation/Tampering | 상태 전이 idempotent 설계(위 위협 모델 표), Phase 4의 "누름" 기록 재사용 |

## Sources

### Primary (HIGH confidence)
- 설치된 소스 코드 직접 열람: `playwright-core@1.63.0` `lib/coreBundle.js`(`chromiumSwitches` 함수), 저장소 내 `src/**`, `tests/e2e/fixtures.ts`, `playwright.config.ts`, `wxt.config.ts`, `package.json`, `docs/design/SYSTEM.md`, `docs/design/tokens.css`, `.planning/research/{ARCHITECTURE,PITFALLS,STACK}.md`, `.planning/phases/05-board-background-patterns/05-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/config.json`

### Secondary (MEDIUM confidence — WebSearch, 교차 확인됨, developer.chrome.com/MDN 인용)
- [chrome.declarativeNetRequest — updateSessionRules, tabIds, resourceTypes, requestDomains](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
- [declarativeNetRequest vs declarativeNetRequestWithHostAccess 설치 경고 차이](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
- [MAX_NUMBER_OF_SESSION_RULES = 5000 (Chrome 120+)](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/declarativeNetRequest/MAX_NUMBER_OF_SESSION_RULES)
- [chrome.storage — session AccessLevel 기본값 TRUSTED_CONTEXTS](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [chrome.tabs — lastAccessed (Chrome 121+)](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- [chrome.commands — suggested_key 4개 제한, global 커맨드는 Ctrl+Shift+[0-9]만](https://developer.chrome.com/docs/extensions/reference/api/commands)
- [chrome.action.openPopup() — 사용자 제스처 요구, Chrome 127+ 컨텍스트 확대](https://oliverdunk.com/2022/11/13/extensions-open-popup)
- [Chrome 백그라운드 타이머 스로틀링(기본 1초 코얼레싱, 집중 스로틀링 5분/분당 1회 조건)](https://developer.chrome.com/blog/timer-throttling-in-chrome-88)
- [tabs.update autoDiscardable](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/update)

### Tertiary (LOW confidence — 확인되지 않음, 이번 세션에서 1차 문서 미열람)
- `chrome.tabs.update({active:true})` + `windows.update({focused:true})` 조합 필요성(A1)
- declarativeNetRequest 세션 규칙과 Playwright CDP 라우팅의 상호작용 순서(A4, 가장 중요한 미해결 항목)
- Playwright `ignoreDefaultArgs` 배열 동작의 정확한 의미론(A3) — Playwright 공식 API 레퍼런스 페이지를 직접 열람하지 않음

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 새 라이브러리 없음, 기존 `package.json`을 그대로 읽음
- Architecture(작업판/차단/확인대기 라우팅): MEDIUM — Chrome API 표면은 공식 문서 교차 확인, Phase 4 접점은 CONTEXT.md 서술에 근거한 가정
- Playwright 스로틀링 발견: HIGH — 설치된 패키지 소스를 직접 읽어 확인
- declarativeNetRequest × Playwright 상호작용: LOW — 실측하지 못함, Wave 0 스파이크 필수로 남김
- Pitfalls: MEDIUM — 대부분 기존 `.planning/research/PITFALLS.md`의 결론을 이 phase 맥락에 적용

**Research date:** 2026-09-24
**Valid until:** Phase 4·Phase 3 계획이 합쳐지는 시점(둘 다 이 phase의 가정 대상) — 그 전까지는 30일 이내에도 A5·A6 가정이 무효화될 수 있음
