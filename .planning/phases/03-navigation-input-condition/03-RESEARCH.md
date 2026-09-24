# Phase 3: 이동·입력·컨디션 - Research

**Researched:** 2026-09-24
**Domain:** MV3 확장(Phase 1 위에 쌓기) — 명령판(모달형 오버레이 상태 기계) · 키 스크롤(프레임 간 라우팅) · 네비게이션 되돌리기(storage.session) · 입력 줄이기·양식 한 장 보기(값 채우기+되돌리기) · 민감칸 판별(공유 순수 함수) · 컨디션 모드·맞춤 설정·키 배치(schemaVersion 2 + 새 옵션 페이지) · 설정 파일 내보내기/가져오기(권한 없이)
**Confidence:** MEDIUM — 저장소 안 결정(D-01~D-41)과 Phase 1 코드는 이번 세션에 직접 Read했음(HIGH). 브라우저 API 세부 동작(스크롤 컨테이너 판정, contenteditable 값 설정, Alt+숫자 충돌, isolated world 내비게이션 API)은 학습 지식 + 이번 세션 WebSearch로 교차 확인(MEDIUM), 계획은 실행 확인 단계(e2e)로 검증해야 함(LOW 항목은 Assumptions Log에 명시)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

전문은 `.planning/phases/03-navigation-input-condition/03-CONTEXT.md`(D-01~D-41)를 그대로 잠근다. 요약(연구가 다루는 것 위주 — 전문 인용은 각 섹션에서):

- **D-01~D-04**: Phase 1 구조 이어받기 — 자주 일어나는 일은 그 프레임에서, 명령판·확인 화면·모드 표시는 맨 위 프레임이 모아서, 프레임 간 메시지는 SW 경유, 입력 필터가 가장 먼저, 저장은 SW 단일 저장자(사이트별 8KB·분당 한도), 조작 설정·컨디션·고정 번호·문구·민감칸 설정·위험 단어·키 배치·명령판 카드 자리 = `chrome.storage.sync`, 최근 입력 값 = `chrome.storage.local`.
- **D-05~D-13**: 명령판·이동 — 0으로 열기(입력칸 안이면 글자), 3열 카드 격자·고정 자리(전문은 아래 §명령판 참조), 키 안내 카드, ↑↓ 80% 부드러운 스크롤(자석 커서 영역 우선), Esc 되돌리기(링크 이동 직후), 번호 고정(Phase 1 식별 묶음 재사용, 1순위), 번호표 9개 초과 시 "0 → 다음 번호", 더블클릭은 명령판에서, "도우미 끄기"는 Phase 1과 같은 설정 공유.
- **D-14~D-16**: 자동 순서 강조 — 번호표 붙은 요소를 순서대로 강조, 아무 키(기본 스페이스바)로 선택, 강조 간격 조절 가능, 위험 버튼 선택 시 기존 확인 화면 재사용, 위험 단어 목록은 사이트별 편집 가능(결재·상신은 기본에 넣지 않음).
- **D-17~D-24**: 입력 줄이기·양식 한 장 보기 — 칸 누르면 최근 값+문구 카드(Alt+1~9, 사이트+칸 이름으로 구분), 값 없으면 "자주 쓰는 문구 추가" 카드, 민감칸이면 카드 없이 "민감칸이라 기록하지 않아요", 문구는 sync, 값 채우기는 입력 이벤트 함께 발생, 양식 한 장 보기는 iframe 포함해 한 화면으로 모으고 제출 버튼 없음(Esc로 원래 화면).
- **D-25~D-28**: 민감칸 — `type=password`/이름·라벨 키워드는 기본 민감, 주민·계좌·카드는 **값 모양**일 때만 민감("법인카드 구분" 등 업무 칸 보호), 판별은 한 곳의 함수로(Phase 4 틀 저장·활동 기록, Phase 6 AI 전송이 재사용), 사이트별로 이용자가 직접 민감함/아님 지정 가능(비밀번호 포함 모두 해제 가능, 해제 시 재확인 + 비밀번호 칸은 "암호화 없이 저장" 경고), 판별 단어 목록도 추가/삭제 가능.
- **D-29~D-32**: 컨디션·맞춤·키 배치 — "좋은 날/힘든 날" 두 묶음(조작 방식·떨림 간격·머무르기 시간·강조 속도·번호표 크기), 표시 크기는 확대와 무관, 처음 설치 3단계 맞춤 설정(키 안내→떨림 간격 재기→머무르기 시간 재기, 단계별 Esc 건너뛰기, 나중에 명령판에서 재실행), 잰 값으로 두 묶음 기본값 결정(힘든 날 묶음에 자동 순서 강조 포함), 키 배치 전부 바꿀 수 있음(Phase 1이 구조만 둠, Phase 3이 화면 제작).
- **D-33~D-35**: 동기화 용량·설정 파일 — 넘기 전 알림 + 문구부터 내보내기 안내, 동기화는 같은 브라우저끼리만(다른 브라우저는 파일 내보내기/가져오기), 파일도 형식 버전 붙임(실패 시 원본 보존), AI 키·최근 입력 값은 동기화 안 함(파일에도 안 담음).
- **D-36~D-38**: 화면 — 모든 오버레이는 SYSTEM.md·tokens.css만, 카피 규칙 준수, SYSTEM.md에 템플릿 없는 화면(설정 화면, 처음 설치 맞춤 설정)은 DESIGN.md §4-1대로 먼저 템플릿 추가.
- **D-39~D-41**: 시험 — 연습 사이트에 스크롤 여러 개·iframe 포함 긴 양식·민감칸 이름/라벨(업무 칸 포함)·더블클릭 필요 요소·다른 페이지 링크 추가, 단위 시험(민감칸 판별·저장 형식 변환), CI=true e2e 목록(명령판·스크롤·뒤로·입력 되돌리기·번호 고정·더블클릭·입력 줄이기·양식 한 장 보기(iframe 포함)·민감칸·컨디션 전환·맞춤 설정·설정 파일 내보내기/가져오기), UI 완료 판정은 저장소 규칙대로(싼 게이트→독립 DOM 감사→수정→전체 게이트 한 번).

### Claude's Discretion

CONTEXT.md 원문 그대로:
- 명령판 카드 중 이 단계에서 아직 동작하지 않는 것(작업판·틀 실행·틀 기록·화면 정리·기록 내보내기 — Phase 4~6)의 표시 방법. 단, **고정된 카드 자리는 비우거나 옮기지 않는다**(D-06).
- "다음 번호" 카드를 명령판 어디에 둘지 — 고정 자리(D-06)를 옮기지 않는 방법으로.
- Esc가 여러 뜻(취소·입력칸 빠져나오기·방금 이동한 페이지에서 뒤로)을 가질 때의 우선순위와 "직후"의 기준. 단, 명령판·확인 화면이 열려 있거나 입력 중일 때 Esc가 뒤로 가기가 되어서는 안 된다.
- "입력 되돌리기"가 몇 단계까지 되돌리는지, 최근 입력 값을 몇 개·언제(바뀜·벗어남·제출) 기록하는지.
- 주민번호·계좌번호·카드번호 "모양"의 정확한 규칙 — 단위 시험으로 고정한다.
- 입력 줄이기 카드와 양식 한 장 보기를 어느 프레임에서 그릴지(D-01 테두리 안에서).
- 설정 화면을 둘 자리(확장 옵션 페이지 또는 팝업 확장)와 처음 설치 맞춤 설정을 띄울 자리 — D-38 절차를 따른다.
- 맞춤 설정에서 잰 값으로 "좋은 날 / 힘든 날" 기본값을 만드는 규칙과 "힘든 날"의 기본 조작 방식.
- 키 배치를 바꿀 때 막을 조합(같은 키를 두 동작에 주기 등)과 검사 방식(zod).
- 동기화 용량 알림을 띄울 기준값, 설정 파일 형식·파일 이름, 가져오기가 덮어쓰기인지 합치기인지.
- 파일 내보내기에 새 권한(`downloads` 등)이 필요하면 새 권한이므로 만들 때 승인받는다. 새 의존성도 이유 한 줄 + 승인 후(저장소 규칙).
- 메시지 타입 이름, 파일 배치, 설정 형식 버전 올리는 방법.

### Deferred Ideas (OUT OF SCOPE)

CONTEXT.md 원문 그대로:
- 틀 기록·실행·제출 확인·알림 창 가로채기·막힘, 틀 안 민감칸에서 멈추기, 활동 기록과 "기록 내보내기"(TMPL, LOG) — Phase 4. 명령판의 "틀 실행"·"틀 기록"·"기록 내보내기" 카드 자리는 Phase 3에서 자리만 지킨다
- 작업판·뒤에서 실행·반복 패턴 알림·자주 가는 곳(BORD, BG, PATN) — Phase 5. "작업판" 카드 자리만 지킨다
- 화면 정리 AI(AI) — Phase 6. "화면 정리" 카드 자리만 지킨다
- 이용자가 고정한 회사 사이트에만 새 창 허용(`contentSettings`) — Phase 2 이후(Phase 1 deferred)
- 회사 시스템에서 확인 — 회사 시스템 완성 뒤(설계 11장 ①, 2026-09-23 사용자 결정)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLICK-05 | 자동 순서 강조 — 조절 가능한 간격으로 하나씩 강조, 아무 키로 선택 | §Pattern 12 (자동 순서 강조), 기존 `dwell-timer.ts`/`confirm-guard.ts` 상태 기계 패턴 재사용 |
| SAFE-06 | 위험 버튼 단어 목록을 사이트마다 고침 | §Pattern 11 (옵션 페이지), `settings-schema.ts`의 `dangerWords`를 전역→사이트별 오버라이드로 확장 |
| STOR-03 | 동기화 용량 초과 전 알림 + 문구 내보내기 안내 | §Pattern 8 (동기화 용량·설정 파일) |
| STOR-04 | 설정 파일 내보내기·가져오기(다른 브라우저) | §Pattern 8 — `downloads` 권한 없이 Blob+`<a download>` |
| NAV-01 | ↑↓ 80% 부드러운 스크롤, 자석 커서 영역 우선 | §Pattern 2 (스크롤 라우팅) |
| NAV-02 | 명령판(0), 키 안내 카드 | §Pattern 1 (명령판) |
| NAV-03 | 링크 이동 직후 Esc로 뒤로 | §Pattern 3 (내비게이션 표시) |
| NAV-04 | 입력 되돌리기 | §Pattern 4 (값 채우기·되돌리기) |
| NAV-05 | 번호 고정 + "다음 번호" | §Pattern 1 (명령판 "번호 고정" 카드) — Phase 1 `hint-order.ts`/`fingerprint.ts` 그대로 재사용 |
| NAV-06 | 명령판 "더블클릭" | §Pattern 12 |
| INPT-01 | 최근 값·문구 카드, Alt+1~9 | §Pattern 4, §Pattern 5 (Alt+숫자) |
| INPT-02 | 문구 저장·수정 | §Pattern 11 (옵션 페이지 또는 카드 안 인라인 편집) |
| INPT-03 | 양식 한 장 보기(iframe 포함) | §Pattern 7 (양식 한 장 보기) |
| PRIV-01 | 민감칸 값 미기록(공유 판별) | §Pattern 6 (민감칸 판별 공유 함수) |
| PRIV-02 | 사이트별 민감함/아님 지정 + 경고 | §Pattern 6, §Pattern 11 |
| PRIV-03 | 판별 단어 목록 추가/삭제 | §Pattern 6, §Pattern 11 |
| PERS-01 | 컨디션 모드 전환(명령판) | §Pattern 9 (컨디션 모드·schemaVersion 2) |
| PERS-02 | 3단계 맞춤 설정 → 기본값 산출 | §Pattern 10 (온보딩 계측) |
| PERS-03 | 키 배치 변경 화면 | §Pattern 11 (옵션 페이지) |
</phase_requirements>

## Summary

Phase 3은 Phase 1이 만든 4계층(순수 함수 `src/core/*` · 프레임별 `src/page/*` · 단일 저장자 `src/worker/*` · 판별 유니온 `src/shared/messages.ts`)을 그대로 확장한다. 새로 짜야 하는 것은 없고, 모두 기존 패턴의 "한 번 더"다: 명령판은 `hints.ts`(카드 렌더링)+`confirm-dialog.ts`(모달 상태 등록: `inputPipeline.setModal`)의 조합이고, 프레임 간 라우팅(스크롤 영역 찾기, 양식 한 장 보기 필드 모으기)은 `frame-tree.ts`의 `composeTree`/`resolveReports`와 `relay.ts`의 프레임별 메시지 패턴을 그대로 쓴다. 저장은 `settings-schema.ts`를 `schemaVersion: 2`로 올리고 `migrate()`의 `migrations[1]` 자리를 처음으로 채운다(Phase 1은 v1이 유일해 이 자리가 비어 있었다). 민감칸 판별은 "한 곳의 판별 함수"(D-26) 요구를 `danger.ts`와 같은 자리에 `sensitive.ts`(순수 함수, `src/core/`)로 새로 만들어 Phase 4·6이 import하게 한다.

가장 중요한 설계 결정 두 가지: (1) **명령판·확인 화면과 마찬가지로 되돌리기·스크롤·양식 모으기도 모두 맨 위 프레임이 조율하고 SW가 라우팅**한다(D-01 그대로) — 새 아키텍처 패턴을 만들지 않는다. (2) **Phase 3은 새 권한도 새 의존성도 필요 없다.** 설정 파일 내보내기는 `downloads` 권한 없이 확장 페이지(옵션 페이지)의 `Blob` + `<a download>`로 되고(콘텐츠 스크립트/확장 페이지처럼 `document`가 있는 컨텍스트에서만 가능 — service worker에서는 불가능, 그래서 이 기능은 **옵션 페이지에서만** 제공해야 한다), 뒤로/앞으로/새로고침/탭 닫기/새 탭은 이미 있는 `tabs` 권한의 `chrome.tabs.goBack/goForward/reload/remove/create`로 된다. Preact는 이번에도 승인하지 않는다 — Phase 1이 순수 DOM을 택한 이유(CLAUDE.md "요청 없는 추상화 금지")가 그대로 적용되고, 명령판·양식 한 장 보기·옵션 페이지 모두 `createCard`류 팩토리 확장으로 충분하다.

**Primary recommendation:** 새 패키지 설치 없음. `src/core/settings-schema.ts`를 `SchemaVersion 2`로 확장(컨디션 모드·명령판 카드 자리·키 배치·문구·민감칸 설정·사이트별 위험 단어를 새 필드로), `src/core/palette.ts`(순수 로직)+`src/page/overlay/palette.ts`(렌더링) 신설, `src/core/sensitive.ts`(민감칸 판별, Luhn 포함) 신설, `src/entrypoints/options/`(WXT 옵션 페이지, 파일 기반 규칙 `options.html`/`options/index.html`) 신설. 모든 새 오버레이는 `docs/design/SYSTEM.md`에 "명령판"·"양식 한 장 보기" 템플릿이 **이미 있음**(D-38 조건 충족 — 새로 추가할 필요 없음), 옵션 페이지·처음 설치 맞춤 설정만 D-38 §4-1 절차(SYSTEM.md에 템플릿 먼저 추가) 대상이다.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 명령판 키 판단·카드 렌더링 | content script — 맨 위 프레임 | 자식 프레임(키 삼켜 전달), SW(중계) | D-01·D-03 그대로, `hints/key`·`confirm/key`와 같은 relay 패턴 |
| ↑↓ 스크롤 대상 프레임 찾기·실행 | content script — 커서(자석 영역) 위치의 그 프레임 | 맨 위(대상 프레임 판정), SW(라우팅) | 스크롤 자체는 그 프레임이 즉시(D-02 "그 프레임에서 바로"와 동일 원칙), 어느 프레임인지 판정은 좌표 변환이 필요해 맨 위가 주도 |
| Esc 뒤로가기 판정·실행 | service worker(`chrome.tabs.goBack`) | 맨 위 content script(Esc 우선순위 판단), SW(내비게이션 발생 기록) | `tabs` 권한은 SW에서만 실질적으로 쓰인다(권한 자체는 매니페스트 전역이지만 API 호출은 SW가 한다) |
| 입력 줄이기 카드(최근 값·문구) | content script — 칸이 있는 그 프레임 | SW(저장 읽기/쓰기), sync(문구)/local(최근 값) | 칸과 카드는 같은 프레임에 그려야 자연스럽다(D-01 "그 프레임에서 바로") |
| 양식 한 장 보기 필드 수집·렌더링 | content script — 맨 위 프레임 | 모든 자식 프레임(필드 보고·값 쓰기 실행) | D-24: "프레임 사이 값 전달은 service worker를 거친다" — hints/press와 완전히 같은 라우팅 |
| 민감칸 판별 | 순수 함수(`src/core/sensitive.ts`) | — | Phase 4(틀 저장·기록)·Phase 6(AI 전송)이 그대로 import(D-26) |
| 컨디션 모드·키 배치·설정 파일 저장/변환 | service worker(`storage-writer.ts`) | — | 단일 저장자(D-24) 원칙 유지 |
| 옵션 페이지(키 배치·민감칸 설정·문구 관리·설정 파일) | 확장 페이지(`entrypoints/options/`) | SW(저장 요청) | `document`가 있어야 `Blob`+`<a download>`가 되고(SW는 불가), 팝업(280px)보다 넓은 화면이 필요 |
| 처음 설치 맞춤 설정(3단계 계측) | 확장 페이지(새 탭, `runtime.onInstalled`가 옴) | SW(계측값 저장) | 페이지 위에 뜰 수 없는 화면(전체 화면 큰 버튼)이라 콘텐츠 스크립트 오버레이가 아니라 확장 자체 페이지 |

## Standard Stack

### Core

Phase 3은 **새 패키지가 필요 없다.** Phase 1이 승인한 스택(wxt 0.21.4, TypeScript 6.0.3, zod 4.6.5, vitest 5.0.1, @playwright/test 1.63.0)을 그대로 쓴다 — 옵션 페이지도 WXT의 파일 기반 엔트리포인트(`entrypoints/options.html` 또는 `entrypoints/options/index.html`)로 자동 매니페스트 등록된다[CITED: wxt.dev/guide/essentials/entrypoints.html — "WXT identifies options entrypoints based on filename patterns"].

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (신규 없음) | — | — | Phase 1 설치분으로 충분. `package.json` 확인 완료(2026-09-24, 이 세션) — `zod@4.6.5`, `wxt@0.21.4`, `typescript@6.0.3`, `vitest@5.0.1`, `@playwright/test@1.63.0`, `@fontsource/ibm-plex-sans-kr@5.3.0` 외 없음[VERIFIED: package.json:1-30, 이 세션에 Read] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 순수 DOM(명령판·옵션 페이지) | Preact 10.x | SYSTEM.md 템플릿을 그대로 옮기는 정적 카드 격자 수준이라 프레임워크 없이도 상태(장 번호, 슬롯 맵)를 순수 함수+얇은 렌더 함수로 충분히 관리(Phase 1 Pattern 5 "요청 없는 추상화 금지"와 동일 논리). 옵션 페이지가 이후 Phase 4~6에서 화면이 더 늘어나 상태가 얽히면 그때 Preact 승인을 재검토(체크포인트) |
| `chrome.downloads` API(파일 내보내기) | `<a download>` + `Blob` (콘텐츠 스크립트/확장 페이지 전용) | `downloads` 권한이 필요 없어 새 권한 승인이 필요 없다. 단 **service worker에서는 안 됨**(`document` 없음)[CITED: mv3-extension.com 요약, WebSearch 2026-09-24] — 그래서 내보내기 UI는 옵션 페이지에 둬야 한다 |
| `chrome.tabs.goBack/goForward` | 콘텐츠 스크립트에서 `history.back()` 직접 호출 | 콘텐츠 스크립트가 isolated world에서 페이지의 `window.history`/`location`에 직접 접근해 내비게이션을 트리거할 수 있는지는 이번 세션 WebSearch로 **확정하지 못했다**(자료가 상충 — 일부는 DOM은 공유하지만 BOM 계열 API는 별도라 함)[ASSUMED, LOW]. `chrome.tabs.*`는 공식 문서에 명시된 안정 API이고 이미 `tabs` 권한이 있으므로 이 경로를 표준으로 채택하고 isolated-world 직접 호출은 쓰지 않는다 |

**Installation:** 없음(신규 패키지 없음). 코드만 추가.

## Package Legitimacy Audit

이 phase는 **새 외부 패키지를 설치하지 않는다.** Package Legitimacy Gate 프로토콜은 신규 패키지가 있을 때만 필요하므로 생략한다.

**Packages removed due to [SLOP] verdict:** 해당 없음(신규 패키지 없음)
**Packages flagged as suspicious [SUS]:** 해당 없음

## Architecture Patterns

### System Architecture Diagram

```
 [0] 눌림(도우미 모드) ─────────────────────────────────────────┐
                                                               ▼
                                              ┌── 맨 위 프레임: palette.ts ──┐
                                              │ 장(chapter) 상태 + 고정 슬롯 │
                                              │ inputPipeline.setModal(...)  │◀── 자식 프레임의
                                              │  1~9 선택 · 0 다음 장 · Esc  │    palette/key(hints/key와 동일 relay)
                                              └──────┬───────────────────────┘
                                                     │ 카드 실행(고정 슬롯 → 동작)
              ┌──────────────┬──────────────┬────────┼─────────────┬──────────────┐
              ▼              ▼              ▼        ▼             ▼              ▼
        [뒤로/앞으로/    [번호 고정]   [입력 되돌리기] [컨디션]  [민감칸 설정]  [준비 중 카드]
         새로고침/탭]    hint-order.ts   undo-stack     schema     sensitive.ts   showTransientMessage
              │           (재사용)       (신규,       V2 전환                    (Phase4~6 자리만)
              ▼                          local)
        SW: chrome.tabs.*
        (이미 tabs 권한)

 [↑↓] ─▶ 맨 위: elementFromPoint(lastCursorPos) 로 스크롤 컨테이너의 프레임 판정
              │  같은 프레임이면 그 자리에서 scrollBy(80%, smooth)
              └─ 다른(자식) 프레임이면 SW 경유 scroll/request{frameId, dx,dy} 전달
                 (hints/press와 동일한 frameId 라우팅, D-03)

 [입력칸 포커스] ─▶ 그 프레임: 최근값(local)+문구(sync) 조회 ─▶ 카드(Alt+1~9)
              │        비었으면 "문구 추가" 카드, 민감칸이면 카드 생략(sensitive.ts)
              └─ 카드 선택 시: 네이티브 setter + 'input'+'change' 디스패치(D-20)
                 되돌리기: undo-stack(그 칸의 이전 값, 메모리+local 백업)

 [명령판 "양식 한 장 보기"] ─▶ 맨 위: 모든 프레임에 form/collect 방송(hints 방송과 동일)
              │  각 프레임 응답: 필드 목록(라벨, kind, 현재 값, select면 옵션)
              └─ 맨 위: 한 줄에 한 칸 오버레이 렌더 ─▶ 입력 시 form/fill{frameId,fieldId,value}
                 (hints/press와 동일한 SW 라우팅으로 그 프레임에 되돌려 값 채움)

 [SW: 저장]                                          [SW: 내비게이션 기록]
  storage-writer.ts (D-24 그대로)                     nav/markPress(sender.tab.id) 시 <a href> 눌림
  + migrate() migrations[1]: v1→v2                      → storage.session(navmark:<tabId>, ttl 3s)
  (컨디션·키배치·카드슬롯·문구·                       페이지 이동 뒤 새 top content script가
   민감칸설정·사이트별위험단어)                          시작 시 nav/query 한 번 → true면 다음 Esc = 뒤로
```

### Recommended Project Structure

```
src/
├── core/
│   ├── palette.ts          # 신규: 고정 슬롯 정의 + zod 슬롯 맵 검사 + 장 나누기(순수 함수)
│   ├── sensitive.ts         # 신규: 민감칸 판별(D-26 "한 곳의 함수") — Luhn 포함, danger.ts와 자매 모듈
│   ├── auto-hint-cycle.ts   # 신규: 자동 순서 강조 상태 기계(dwell-timer.ts와 같은 형태)
│   ├── undo-stack.ts        # 신규: "입력 되돌리기" 스택(칸 키 → 이전 값들)
│   ├── settings-schema.ts   # 확장: SchemaVersion 2 필드 추가 + migrations[1] 채움
│   └── (기존 파일 그대로)
├── page/
│   ├── overlay/
│   │   ├── palette.ts        # 신규: 명령판 카드 격자 렌더(SYSTEM.md 템플릿, hints.ts 자매)
│   │   ├── form-overlay.ts   # 신규: 양식 한 장 보기 렌더
│   │   └── input-reduce.ts   # 신규: 입력 줄이기 카드 렌더(칸 옆에 뜨는 작은 카드 그리드)
│   ├── scroll/
│   │   └── scroll-target.ts  # 신규: elementFromPoint로 스크롤 컨테이너 찾기(순수 DOM 유틸)
│   └── (기존 파일 그대로 — content.ts에 새 핸들러 등록)
├── worker/
│   ├── nav-mark.ts           # 신규: storage.session 기반 "방금 헬퍼가 이동시켰다" 기록
│   └── (storage-writer.ts, relay.ts 확장)
├── entrypoints/
│   ├── options/               # 신규: WXT 옵션 페이지(키 배치·민감칸 설정·문구 관리·설정 파일·컨디션 편집)
│   │   ├── index.html
│   │   └── main.ts
│   └── onboarding/             # 신규: 처음 설치 3단계 맞춤 설정(runtime.onInstalled가 새 탭으로 엶)
│       ├── index.html
│       └── main.ts
tests/practice-site/
├── scroll-areas.html   # 신규(D-39): 중첩 스크롤 영역 + iframe 안 스크롤 영역
├── form-long.html      # 신규(D-39): 긴 양식(select 포함) + iframe 안 양식 조각
├── sensitive.html       # 신규(D-39): 민감칸 이름/라벨(비밀번호·인증번호·주민·계좌·카드)
                          #            + 업무 칸("법인카드 구분", "지급계좌 선택")
├── navigate.html        # 신규(D-39): 다른 페이지로 가는 링크(Esc 뒤로 시험용)
└── controlled-input.html # 신규: React류 controlled input 흉내(네이티브 setter 필요성 시험)
```

### Pattern 1: 명령판 (fixed-slot palette, 모달 재사용)

**What:** `hints/state`·`hints/key`와 완전히 같은 relay 모양으로 `palette/state`(방송: 열림/닫힘)·`palette/key`(자식→맨 위, 초점이 자식 프레임에 있을 때 삼킨 키 전달)를 `src/shared/messages.ts`에 추가한다. 맨 위 프레임은 `inputPipeline.setModal(paletteHandler)`로 기존 확인 화면과 같은 후킹 포인트를 재사용한다 — `ModalHandler` 타입은 이미 `tick` 이벤트를 포함하지만 명령판은 `tick`을 무시하면 그만이라 pipeline.ts를 고칠 필요가 없다[VERIFIED: src/page/input/pipeline.ts:20-21, 27-31, 269-280, 이 세션에 Read — `setModal`은 열려 있으면 모든 isTrusted keydown/keyup/keypress를 삼켜 핸들러로 보낸다].

고정 슬롯은 `src/core/palette.ts`에 리터럴 배열로 정의한다:
```ts
// [VERIFIED: docs/design/SYSTEM.md:103-106, 이 세션에 Read — 원문 그대로 인용]
// 첫 장: 1 뒤로 · 2 작업판 · 3 틀 실행 · 4 조작 방식 바꾸기 · 5 입력 되돌리기 · 6 컨디션 모드 · 7 새로고침 · 8 도우미 끄기 · 9 다음 장
// 둘째 장: 1 앞으로 · 2 탭 닫기 · 3 새 탭 · 4 틀 기록 · 5 번호 고정 · 6 양식 한 장 보기 · 7 화면 정리(AI) · 8 더블클릭
// 셋째 장: 1 끌어서 놓기 · 2 민감칸 설정 · 3 기록 내보내기 · 4 맞춤 설정 다시 하기
export const DEFAULT_PALETTE_SLOTS: readonly PaletteSlot[] = [
  { chapter: 1, number: 1, id: 'back',        implemented: true  },
  { chapter: 1, number: 2, id: 'board',       implemented: false }, // Phase 5
  { chapter: 1, number: 3, id: 'template-run',implemented: false }, // Phase 4
  { chapter: 1, number: 4, id: 'mode-switch', implemented: true  },
  { chapter: 1, number: 5, id: 'undo-input',  implemented: true  },
  { chapter: 1, number: 6, id: 'condition',   implemented: true  },
  { chapter: 1, number: 7, id: 'reload',      implemented: true  },
  { chapter: 1, number: 8, id: 'helper-off',  implemented: true  },
  // number 9는 "다음 장" — 카드 목록에는 안 넣고 palette.ts가 항상 고정 렌더
  { chapter: 2, number: 1, id: 'forward',        implemented: true  },
  { chapter: 2, number: 2, id: 'close-tab',      implemented: true  },
  { chapter: 2, number: 3, id: 'new-tab',        implemented: true  },
  { chapter: 2, number: 4, id: 'template-record', implemented: false }, // Phase 4
  { chapter: 2, number: 5, id: 'pin-number',      implemented: true  },
  { chapter: 2, number: 6, id: 'form-view',       implemented: true  },
  { chapter: 2, number: 7, id: 'ai-cleanup',      implemented: false }, // Phase 6
  { chapter: 2, number: 8, id: 'dblclick',        implemented: true  },
  { chapter: 3, number: 1, id: 'drag-drop',       implemented: true  }, // Phase 1 dragTwoPress 설정 노출
  { chapter: 3, number: 2, id: 'sensitive-config',implemented: true  },
  { chapter: 3, number: 3, id: 'export-log',      implemented: false }, // Phase 4
  { chapter: 3, number: 4, id: 're-onboard',      implemented: true  },
];
```
`implemented: false` 카드는 Claude's Discretion에 따라 **자리는 그대로 두고**, 선택 시 기존 `showTransientMessage()`(mode-indicator.ts에 이미 있음, 재사용 — Don't Hand-Roll)로 "아직 준비 중이에요" 2초 표시 후 명령판을 닫지 않는다(D-06 "고정된 카드 자리는 비우거나 옮기지 않는다"). 이용자가 설정에서 슬롯을 바꾼 경우(옵션 페이지, PERS 관련) `SlotMap`을 `chrome.storage.sync`의 `palette-slots` 키(schemaVersion 2)에 zod로 저장한다.

**When to use:** `0` 키가 도우미 모드(입력칸 아님)에서 눌릴 때. 이미 명령판이 열려 있으면 같은 키가 닫기가 아니라 "다음 장"으로 동작하지 않도록 — 열기(`0`, 팔레트 닫힌 상태)와 장 넘기기(팔레트 안에서 `9`, D-06)를 구분해야 한다. 입력칸 안(typing 모드)에서는 `0`이 글자로 들어간다(D-05, 이미 pipeline.ts의 `currentMode() === 'typing'`이면 키 핸들러를 안 부르는 기존 로직으로 자동 충족).

**Trade-offs:** 자식 프레임에 초점이 있을 때 `0`을 명령판 열기로 처리하려면 Phase 1의 `hints/key`와 완전히 같은 두 단계 라우팅이 필요하다(자식이 `0`을 삼켜 `palette/key`로 보내고, 맨 위가 여닫음). 이미 있는 패턴이라 새 개념은 없다.

### Pattern 2: ↑↓ 스크롤 — 자석 커서 영역의 스크롤 컨테이너 찾기

**What:** 맨 위 프레임이 `lastCursorPos`(이미 `content.ts`에 있음, Phase 1 D-04)로 `document.elementFromPoint(x, y)`를 부른다. 결과가 `<iframe>`이면 좌표를 그 프레임의 로컬 좌표로 변환해(이미 `frame-tree.ts`의 `composeTree`가 프레임별 오프셋을 계산해 두므로 역변환 가능) SW를 거쳐 그 프레임에 `scroll/request{dx, dy}`를 보낸다(자식 프레임이 다시 같은 로직을 재귀 실행 — 중첩 iframe 지원). 결과가 일반 요소면 그 요소부터 조상을 거슬러 올라가며 `scrollHeight > clientHeight`이고 `overflow-y`가 `auto`/`scroll`인 첫 조상을 찾아 그 요소에, 없으면 `document.scrollingElement`(대개 `<html>`)에 스크롤한다[ASSUMED — 표준 "가장 가까운 스크롤 가능한 조상 찾기" 관용구, 브라우저 API 자체이나 이번 세션에 실행 검증은 안 함].

스크롤 양은 "한 화면의 80%"를 **스크롤 컨테이너 자신의 `clientHeight`** 기준으로 계산한다(뷰포트 기준이 아니라 — 작은 스크롤 박스 안에서 뷰포트 80%만큼 넘기면 박스 밖으로 넘어가 버린다): `container.scrollBy({ top: sign * container.clientHeight * 0.8, behavior: 'smooth' })`[ASSUMED — `scrollBy`의 `behavior:'smooth'` 사용은 표준 API, 다만 컨디션 모드의 "떨림 간격" 반복 입력과 `smooth` 애니메이션이 겹칠 때(연속 ↑↑↑) 브라우저가 알아서 목표 지점을 누적하는지, 아니면 이전 스크롤 애니메이션을 끊고 새로 시작하는지는 브라우저 구현에 따라 다를 수 있어 e2e로 확인 필요].

**When to use:** ↑↓ 키가 도우미 모드에서 눌릴 때(입력칸 밖). `frames.html`에 이미 `#scroll-box`(중첩 스크롤 영역)가 있다[VERIFIED: tests/practice-site/frames.html:45-53, 이 세션에 Read — `scrollBox.style.cssText = 'width:280px;height:150px;overflow:auto;...'`로 `frame-same` iframe을 감쌈]. Phase 3은 이 픽스처를 확장해 "스크롤 영역이 여러 개"인 케이스(D-08)를 두껍게 만들어야 한다(D-39).

**Trade-offs:** `elementFromPoint`는 커서가 마지막으로 움직인 자리를 쓰므로, 자석 커서가 실제로 "잡은" 요소와 다를 수 있다(D-08 "자석 커서가 있는 영역" — 잡힌 요소가 없으면 커서 위치 자체를 쓴다는 뜻으로 해석. Claude's Discretion 항목은 아니지만 CONTEXT에 명시 안 된 세부라 계획에서 "잡힌 요소 우선, 없으면 커서 위치"로 확정 권장).

### Pattern 3: Esc 되돌리기 — 헬퍼발 내비게이션 기록 (새 권한 없이)

**What:** 콘텐츠 스크립트가 페이지를 이동시키는 원인은 두 가지뿐이다 — (a) 도우미가 대신 누른 `<a href>`(또는 제출형 버튼)의 클릭이 실제 내비게이션을 일으킨 경우, (b) 이용자가 직접 마우스로 링크를 눌러도 그건 "도우미가 이동시킨" 것이 아니므로 대상이 아니다. `pressOrDrag()`가 대상 요소를 누르기 직전, 요소가 `<a href>`(같은 탭 내비게이션이 예상되는 — `target` 속성이 없거나 `_self`)이면 `chrome.runtime.sendMessage({ type: 'nav/markPress' })`를 보낸다. Background는 `sender.tab.id`로 `chrome.storage.session.set({ [\`navmark:\${tabId}\`]: { at: Date.now() } })`를 쓴다(D-04의 저장 위치 표 밖 항목이지만 storage.session은 이미 `storage` 권한 안에 포함되고 새 권한이 아니다[CITED: developer.chrome.com/docs/extensions/reference/api/storage — `storage.session`은 `storage` API의 일부, MV3 도입]).

새 문서의 맨 위 content script가 시작할 때(`document_start`, D-02) `nav/query` 메시지를 한 번 보낸다. Background는 `navmark:<tabId>`를 읽어 "최근 3초 안"이면 `{ justNavigated: true }`를 응답하고 **그 기록을 지운다**(한 번 소비 — 두 번째 페이지 이동에서 재사용 방지). 맨 위 content script는 이 값을 `let justNavigatedViaHelper = true`로 들고 있다가, **처음 눌리는 Esc 하나에만** 소비한다(그 뒤에는 false로 되돌림 — "직후"의 기준을 "새 문서의 첫 Esc"로 확정 권장, 시간 기준보다 결정적이라 e2e로 고정하기 쉽다).

Esc 우선순위(맨 위 content script, Claude's Discretion 항목의 확정 권장안):
1. 확인 화면(`activeConfirmKeyHandler`)이 열려 있으면 → 그쪽(guard.handle)이 처리(기존 D-19 동작 그대로, 바뀌지 않음)
2. 명령판이 열려 있으면 → 이전 장 또는 닫기(D-05)
3. 입력칸 모드(`currentMode() === 'typing'`)면 → 기존 D-16 그대로(입력칸 빠져나오기)
4. 끌기 시작 상태(`dragTwoPress.armed()`)면 → 기존 D-08 그대로(취소)
5. 번호표가 열려 있으면 → 기존 동작(닫기)
6. 위 다섯 다 아니고 `justNavigatedViaHelper === true`면 → `chrome.runtime.sendMessage({ type: 'nav/goBack' })`(SW가 `chrome.tabs.goBack(tabId)` 실행), 소비 후 false로
7. 그 외 → 아무 것도 안 함(사이트로 통과 — 사이트 자신의 Esc 처리를 막지 않음)

**When to use:** `content.ts`의 Esc 관련 `inputPipeline.onKey` 핸들러들 사이에 삽입 — 기존 핸들러들이 이미 "처리했으면 true, 아니면 false 반환 후 다음 핸들러로" 체인 방식이므로(D-핸들러 등록 순서 = 우선순위) 위 순서대로 `onKey`를 등록하면 그대로 우선순위가 된다[VERIFIED: src/entrypoints/content.ts:439-446, 704-709, 이 세션에 Read — 기존 핸들러 체인 패턴].

**Trade-offs:** `history.back()`을 콘텐츠 스크립트에서 직접 부르는 대안은 isolated world에서 페이지의 내비게이션 BOM에 실제로 접근 가능한지가 이번 세션 WebSearch로 **확정되지 않았다**(자료 상충)[ASSUMED, LOW — Alternatives Considered 표 참고]. `chrome.tabs.goBack`(SW 경유)이 문서화된 안정 API라 이 경로를 표준으로 채택.

### Pattern 4: 값 채우기(네이티브 setter) + 입력 줄이기 카드 + 되돌리기

**What:** React/Vue 같은 controlled 컴포넌트는 `el.value = x` 대입을 가로채지 못하게 하려고 자신의 change 핸들러만 신뢰하는 경우가 있다 — 표준 우회는 프로토타입의 네이티브 setter를 직접 호출한 뒤 `input`/`change` 이벤트를 디스패치하는 것이다[ASSUMED — 널리 알려진 React 테스트 유틸리티 관용구, 이번 세션에 브라우저 실행으로 검증하지 않음. Phase 1의 `synthesizePress`가 `showPicker()`에 `[ASSUMED — Plan 01-12 스파이크로 확인]` 태그를 단 것과 같은 성격의 미검증 API 가정이므로 Phase 3도 같은 방식(연습 사이트에 controlled-input 흉내 페이지, D-39)으로 e2e 확인해야 한다]:
```ts
// src/page/input/fill-value.ts (신규, 가정 — 이번 세션 미검증)
function nativeSetter(el: HTMLInputElement | HTMLTextAreaElement): (v: string) => void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  return (v: string) => setter?.call(el, v);
}
export function fillValue(el: Element, value: string): void {
  if (el instanceof HTMLSelectElement) {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(el, value);
  } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    nativeSetter(el)(value);
  } else if (el instanceof HTMLElement && el.isContentEditable) {
    // execCommand는 deprecated지만 Chromium 계열에서 여전히 동작(contenteditable 삽입 표준 대안 부재)
    el.focus();
    document.execCommand('selectAll', false);
    document.execCommand('insertText', false, value); // [ASSUMED]
  } else {
    return;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
```
**되돌리기(NAV-04, D-09 후반):** `src/core/undo-stack.ts`(순수 함수)가 칸 키(`site + 칸 이름` 지문, D-17과 동일 키)별로 "채우기 직전 값" 1개를 스택에 쌓는다(Claude's Discretion — 몇 단계 되돌릴지: **1단계(가장 최근 채움 직전 값만)**를 권장 — 명령판 "입력 되돌리기"는 한 칸당 한 번 누르는 단발 동작으로 설계돼 있고(D-09 "명령판 '입력 되돌리기'로 되돌린다"), 여러 단계 되돌리기는 표준 편집기의 Ctrl+Z와 헷갈릴 위험이 있다). 스택은 메모리(그 프레임의 `content.ts` 안 `Map`)로 충분 — 페이지 이동 시 사라지는 것이 오히려 안전(다른 페이지의 옛 값이 실수로 되돌아오지 않음).

**최근 값 기록 시점**(Claude's Discretion): "바뀜(input)" 이벤트마다 기록하면 타이핑 한 글자마다 저장 요청이 폭주한다(D-24 사이트별 8KB·분당 한도). **"벗어남(blur)" 또는 "명령판/카드로 채워 넣은 뒤"**에만 기록을 권장 — Phase 1의 `recordPress`(눌릴 때마다 SW에 보내되 SW가 debounce 없이 큐로 순서 처리)와 달리, 최근 값은 `blur` 이벤트에 붙여 `storage-writer.ts`에 `recordRecentValue` op로 보낸다. 보관 개수는 **칸당 3개**(SYSTEM.md 카드 격자가 "최근 값 + 문구"를 합쳐 Alt+1~9(9칸)에 넣어야 하므로 최근 값에 너무 많은 자리를 안 씀 — 나머지는 문구).

**When to use:** 입력 줄이기 카드에서 값을 고를 때(INPT-01), 양식 한 장 보기에서 원래 칸에 값을 반영할 때(INPT-03, D-22 "입력 이벤트를 함께 발생시켜"), 명령판 "입력 되돌리기"에서.

**Trade-offs:** `document.execCommand`는 W3C에서 deprecated이지만 대체 표준(`InputEvent`의 `insertReplacementText` 등)은 Chromium 지원이 불완전해 실무에서는 여전히 `execCommand`가 쓰인다 — 계획에서 e2e로 직접 확인(연습 사이트 contenteditable 칸)해야 하고, 실패 시 대안은 `textContent` 직접 대입 + `input` 디스패치(더 거칠지만 안전).

### Pattern 5: Alt+1~9 (입력칸 안 카드 선택)

**What:** Windows Chrome/Edge/Whale에서 탭 전환 단축키는 **Ctrl+1~8, Ctrl+9**이지 **Alt**가 아니다[CITED: Google Chrome 공식 도움말 요약, WebSearch 2026-09-24 — "Chrome uses Ctrl+1 through Ctrl+8 ... Ctrl+9"]. Alt+1~9는 Windows에서 메뉴 니모닉(accesskey)과 겹칠 수 있지만, 브라우저 자체가 소비하는 예약 단축키는 아니므로 `keydown`에서 `event.altKey && DIGIT_TO_NUMBER[event.code] !== undefined`일 때 `preventDefault()`+`stopImmediatePropagation()`이 통할 가능성이 높다[ASSUMED — 사이트 자신이 `accesskey` 속성으로 같은 조합을 예약했을 가능성은 남아 있고, HTML accesskey는 Windows Chrome에서 기본적으로 **Alt+Shift+키**를 쓰므로(Alt 단독이 아님) 충돌 가능성은 낮다]. Phase 1의 입력 파이프라인이 이미 keydown을 `document_start` window capture로 먼저 받으므로(D-06, Pattern 1) 새 핸들러를 추가하기만 하면 된다 — 다만 이 핸들러는 **`currentMode() === 'typing'`일 때만** 활성화해야 한다(도우미 모드에서는 1~9가 이미 번호표 용도).

**When to use:** 입력 줄이기 카드가 떠 있고(`currentMode() === 'typing'`) Alt+1~9가 눌릴 때만. 카드가 안 떠 있으면 통과(사이트의 Alt+숫자 단축키를 막지 않음 — 예: 일부 사이트의 accesskey 네비게이션).

**Trade-offs:** 회사 시스템(그룹웨어/ERP)이 자체적으로 Alt+숫자 메뉴 단축키를 쓸 가능성은 배제할 수 없다 — 이번 phase는 연습 사이트에서만 시험하므로(D-14 계승) 회사 시스템 충돌 여부는 여전히 미확인 상태로 남는다(Phase 1 KEY-02와 같은 패턴의 잔여 리스크, Open Questions 참고).

### Pattern 6: 민감칸 판별 (공유 순수 함수)

**What:** `src/core/danger.ts`(위험 버튼 판별)와 나란히 `src/core/sensitive.ts`를 새로 만든다. 판별 로직 3단(설계 8장 원문[VERIFIED: docs/superpowers/specs/2026-09-23-tremor-browser-helper-design.md:206-207, 이 세션에 Read — "type=password 칸, 이름·라벨에 비밀번호·비번·PW·인증번호·OTP·보안카드가 들어간 칸: 기본으로 민감하다. 이름·라벨에 주민·계좌·카드가 들어간 칸: 입력된 값이 주민번호·계좌번호·카드번호 모양일 때만 민감하다"]):

```ts
export interface SensitiveInput {
  type: string;                 // el.type (password 포함)
  nameOrLabel: string;          // name 속성 + label 텍스트 + aria 합친 것
  value: string;                // 현재 값(모양 검사용, 빈 문자열 가능)
  override?: 'sensitive' | 'not-sensitive'; // 사이트별 이용자 지정(D-27)
  wordLists: { alwaysSensitive: readonly string[]; shapeSensitive: readonly string[] };
}

export function isSensitive(input: SensitiveInput): boolean {
  if (input.override) return input.override === 'sensitive';
  if (input.type === 'password') return true;
  const stripped = stripSpaces(input.nameOrLabel); // danger.ts와 같은 방식(공백 무시 포함 검사)
  if (input.wordLists.alwaysSensitive.some((w) => stripped.includes(stripSpaces(w)))) return true;
  if (input.wordLists.shapeSensitive.some((w) => stripped.includes(stripSpaces(w)))) {
    return looksLikeSensitiveValue(input.value); // 아래
  }
  return false;
}
```

**"모양" 판정(Claude's Discretion — 단위 시험으로 고정할 후보 규칙, 설계는 규칙을 명시하지 않음):**
- 주민등록번호 모양: 숫자만 추출해 13자리(`\d{6}-?\d{7}`) — 생년월일 유효 범위(월 01~12) 검사까지 넣을지는 과설계 위험(SAFE-06 원칙과 유사하게 "너무 똑똑하면 오탐"). **13자리 숫자(하이픈 선택)** 정도의 단순 규칙 권장.
- 계좌번호 모양: 은행마다 자릿수가 10~14자리로 다양해 정확한 패턴이 없다 — **숫자만 10~16자리**(하이픈/공백 무시)로 넓게 잡는 것을 권장, 오탐(false positive)이 있어도 D-27로 이용자가 사이트별로 해제 가능하므로 과도하게 좁히지 않는다.
- 카드번호 모양: **숫자만 15~16자리 + Luhn 체크섬 통과** — Luhn은 결정적 알고리즘(표준, 검색 불필요)이라 오탐률을 크게 낮출 수 있다[ASSUMED — Luhn 통과 여부와 무관하게 카드번호"처럼 보이는" 값을 Luhn으로 걸러내는 것 자체는 업계 표준이지만, 이 프로젝트에 맞는 정확한 정책은 사용자 확인 필요 — Assumptions Log A-S1].
- "법인카드 구분", "지급계좌 선택" 같은 **select/라디오 계열 업무 칸은 값이 문자열 옵션 텍스트("법인카드", "개인카드" 등)이지 숫자 모양이 아니므로** 위 규칙에서 자연히 비민감으로 걸러진다(D-25 설계 의도와 일치) — 다만 select의 `value` 속성이 내부 코드(예: `"1"`, `"2"`)일 수 있어 짧은 숫자는 애초에 자리수 하한(10자리 이상)으로 걸러진다.

**When to use:** `page/collector/collector.ts`의 `computeFingerprint`/`computeName`과 같은 자리에서 입력칸(`Item.kind === 'input'`) 계산 시 `sensitive` 필드를 추가(danger 필드와 나란히, D-18의 `isDanger` 패턴 그대로 재사용). 값은 `input` 이벤트마다 재평가(디바운스 없이 — 민감 판정은 저장을 트리거하지 않으므로 비용이 낮다).

**Trade-offs:** Phase 4(틀 저장)·Phase 6(AI 전송)이 이 함수를 그대로 import해야 하므로(D-26), 이 phase에서 시그니처를 안정적으로 확정해야 한다 — `SensitiveInput`이 DOM 요소가 아니라 순수 값 객체인 것이 핵심(collector.ts가 DOM에서 값을 뽑아 이 함수에 넘기는 어댑터 역할).

### Pattern 7: 양식 한 장 보기 (프레임 넘어 필드 모으기)

**What:** hints.ts의 "맨 위가 모든 프레임의 요소를 모아 번호를 매기는" 패턴을 그대로 필드 수집에 적용한다. `form/collect` 메시지를 방송(`hints/state`와 같은 SW 방송 패턴)하면 각 프레임이 자기 문서의 입력칸(`input:not([type=hidden]):not([type=submit])`, `textarea`, `select`, `contenteditable`)을 라벨과 함께 `form/fields`로 응답한다. 맨 위는 `frame-tree.ts`의 `composeTree`가 이미 하는 프레임 경로 합성을 재사용해 "어느 프레임의 어느 필드"인지 키(`hintKey`와 동일한 `frameId:itemId` 패턴)를 만든다. 렌더는 한 줄에 한 칸(SYSTEM.md 템플릿 그대로[VERIFIED: docs/design/SYSTEM.md:109-116, 이 세션에 Read]).

입력 시 값은 `form/fill{frameId, fieldId, value}`를 SW 경유로 그 프레임에 보내 `fillValue()`(Pattern 4)로 원래 칸에 반영한다. **제출 버�name 없음**(D-22) — Esc만 "원래 화면으로"(오버레이 닫기, 원래 페이지 값은 이미 채워진 채 유지).

**옮길 수 없는 칸**(D-23 "못 옮긴 칸은 목록 끝에"): `type=file`, `type=range`, `type=color`처럼 큰 칸 레이아웃으로 표현하기 어색한 종류이거나, 민감칸(Pattern 6)이라 애초에 원본 화면에서만 입력해야 하는 칸을 후보로 권장 — 목록 끝에 "원래 화면에서 입력하세요: 칸 이름"으로 표시(SYSTEM.md 상태 표 그대로 인용).

**When to use:** 명령판 "양식 한 장 보기"(둘째 장 6번, D-06). `iframe 안 양식`은 D-24가 명시 — `frames.html`의 `frame-nest`(중첩)/`frame-cross`(다른 출처) 구조를 재사용해 D-39용 `form-long.html`을 만든다.

**Trade-offs:** 다른 출처(cross-origin) iframe은 부모가 내부 DOM을 못 읽으므로, 그 프레임 **자신**이 `form/fields`에 응답해야 한다(Phase 1이 이미 이 문제를 프레임 자기 보고 방식으로 풀어 둠 — 새 문제 아님).

### Pattern 8: 동기화 용량 알림 + 설정 파일 내보내기/가져오기 (권한 없이)

**What:** `chrome.storage.sync` 공식 한도[CITED: developer.chrome.com/docs/extensions/reference/api/storage, WebSearch 2026-09-24]:
- `QUOTA_BYTES` = 102,400 (전체)
- `QUOTA_BYTES_PER_ITEM` = 8,192 (항목당, Phase 1 D-24가 이미 8KB로 채택한 값과 일치[VERIFIED: src/core/settings-schema.ts는 아직 이 상수를 안 갖지만 01-14-PLAN.md가 `SYNC_ITEM_LIMIT = 8192`로 도입 예정, 이 세션에 Read])
- `MAX_ITEMS` = 512
- `MAX_WRITE_OPERATIONS_PER_MINUTE` = 120 (Phase 1 RESEARCH.md의 A6 가정과 일치, 이번 세션에 공식 문서로 [VERIFIED] 격상)

`storage-writer.ts`가 매 sync 쓰기 전 `chrome.storage.sync.getBytesInUse()`(콜백/Promise 형태, 이미 쓰는 `chrome.storage.sync.get`과 같은 레벨의 API)로 총량을 확인해, **`QUOTA_BYTES`의 90%**(Claude's Discretion 권장 기준값 — "넘기 전에" 알려야 하므로 여유를 둠) 이상이면 `notice:storage-near-limit`(local)을 기록하고 content script가 다음 페이지에서 토스트(Pattern은 Phase 1의 `toast.ts` 그대로 재사용, 01-14가 이미 만들어 둠) + "자주 쓰는 문구부터 파일로 내보내기" 안내 카드를 보여준다(D-33).

**설정 파일 내보내기(STOR-04, 새 권한 없이):** 옵션 페이지(`document`가 있음)에서 `chrome.storage.sync.get(null)`으로 전체 동기화 데이터를 읽어(AI 키·최근 입력 값은 sync에 없으므로 자동으로 제외됨, D-35) `{ fileVersion: 1, exportedAt, data }` JSON을 만들고:
```ts
const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `tremor-helper-settings-${dateStamp}.json`;
a.click();
URL.revokeObjectURL(url);
```
이 방식은 `downloads` 권한이 필요 없다 — **단, 콘텐츠 스크립트/확장 페이지(`document` 보유)에서만 되고 service worker에서는 안 된다**[CITED: WebSearch 요약, mv3-extension.com — "In a service worker, there is no document, so URL.createObjectURL on a Blob is unavailable... chrome.downloads.download is the API that works from a worker"]. 따라서 내보내기 버튼은 **반드시 옵션 페이지**(또는 팝업)에 둬야 하고 SW에서 트리거할 수 없다.

**가져오기:** `<input type="file" accept="application/json">` + `FileReader`로 읽은 뒤 `settings-schema.ts`의 `migrate()`(Pattern 9에서 v2로 확장)로 검사 — 실패하면 **지금 설정을 그대로 두고** 알림(D-34 그대로, storage 실패 처리와 동일 원칙). 가져오기가 "덮어쓰기"인지 "합치기"인지는 Claude's Discretion — **덮어쓰기를 권장**: 문구·고정 번호 등은 사이트별 키가 겹칠 수 있어 "합치기" 의미가 모호하고(어느 쪽 값이 이기는지), 다른 브라우저로 옮기는 시나리오(D-34 "크롬↔엣지↔웨일")는 대개 "이 브라우저 전체를 저 설정으로 맞추고 싶다"는 의도이므로 덮어쓰기가 자연스럽다.

**Trade-offs:** `getBytesInUse()`는 개별 키 인자도 받지만 전체 합계(`getBytesInUse(null)`)가 필요 — Phase 1 storage-writer.ts에 아직 이 호출이 없으므로 신규 추가.

### Pattern 9: 컨디션 모드 + `settings-schema.ts` v2

**What:** `SettingsDataSchema`(v1)에 새 필드를 추가하고 `schemaVersion: 2`로 올린다. 기존 시그니처 `migrate<T>(raw, { schema, current, migrations })`가 이미 `migrations: Record<number, (d: unknown) => unknown>` 구조를 갖고 있고 Phase 1은 "지금은 v1이 첫 형식이라 migrations가 비어 있다"고 명시했다[VERIFIED: 01-14-PLAN.md:112, 이 세션에 Read] — Phase 3이 **처음으로 `migrations[1]`을 채운다**(v1 데이터를 v2 모양으로 변환: 기존 최상위 필드들을 `conditions.good`/`conditions.hard` 두 묶음에 복제하고 새 필드에는 기본값을 채움).

```ts
const ConditionBundleSchema = z.object({
  mode: z.enum(['magnet', 'hints', 'auto-cycle']),
  tremorIntervalMs: z.number(),
  dwellMs: z.number(),
  autoCycleMs: z.number(),      // CLICK-05 강조 간격
  displayScale: z.number(),      // 번호표·테두리 크기(확대와 무관, D-29)
});
const SettingsDataSchemaV2 = SettingsDataSchema.extend({
  conditions: z.object({ good: ConditionBundleSchema, hard: ConditionBundleSchema }),
  activeCondition: z.enum(['good', 'hard']),
  paletteSlots: z.array(PaletteSlotOverrideSchema),
  phrases: z.array(z.object({ site: z.string(), fieldKey: z.string(), text: z.string() })),
  sensitiveOverrides: z.array(z.object({ site: z.string(), fieldFingerprint: FingerprintSchema, sensitive: z.boolean() })),
  sensitiveWordLists: z.object({ alwaysSensitive: z.array(z.string()), shapeSensitive: z.array(z.string()) }),
  siteDangerWords: z.array(z.object({ site: z.string(), words: z.array(z.string()) })), // SAFE-06
});
```
`migrations[1] = (raw) => { /* v1 shape -> v2 shape, 두 컨디션 묶음 모두 기존 최상위 값으로 초기화 */ }`.

**컨디션 전환:** 명령판 "6 컨디션 모드" → `updateSettings` op 확장(`activeCondition` 토글) — `content.ts`의 `currentSettings.data`를 그대로 UI가 아니라 **활성 컨디션의 값**으로 읽도록 `activeSettings()` 헬퍼를 추가(자석 커서·머무르기·강조 속도·표시 크기 모두 이 헬퍼를 거치게 리팩터).

**표시 크기(displayScale)와 01-15의 `--overlay-scale`:** 01-15는 `--overlay-scale = 1/줌비율`(확대 역보정)만 넣는다[VERIFIED: 01-15-PLAN.md:103, 이 세션에 Read — `--overlay-scale: <1/비율>`]. Phase 3의 "표시 크기"는 **여기에 곱하는 두 번째 배율**로 설계해야 한다: `--overlay-scale = (1/줌비율) * displayScale`. 01-15가 이미 CSS 변수 하나로 모든 오버레이 크기를 제어하는 구조를 만들어 뒀으므로(ring.ts·hints.ts·confirm-dialog.ts·toast.ts 전부 이 변수를 곱함), Phase 3은 이 변수의 **값을 계산하는 곳**(`ensureOverlayRoot`의 `zoom/changed` 핸들러)만 고치면 된다 — 새 CSS 배관이 필요 없다.

**When to use:** 온보딩(Pattern 10)이 계측값으로 두 묶음의 기본값을 채운 뒤, 명령판·설정 화면이 이 스키마를 읽고 쓴다.

**Trade-offs:** `migrations[1]`을 실제 실행 경로로 처음 타는 것이므로, 01-14가 만든 "변환 실패 시 원본 보존" e2e 패턴(newer-version, invalid 케이스)에 **"v1→v2 정상 변환" 케이스**를 새로 추가해야 한다(D-40 "저장 형식 변환" 단위 시험 대상).

### Pattern 10: 처음 설치 3단계 맞춤 설정

**What:** `runtime.onInstalled`(reason === 'install')에서 `chrome.tabs.create({ url: 'onboarding.html' })`을 연다(01-13/01-14가 이미 `onInstalled`를 쓰고 있으므로 기존 리스너에 분기 추가). 이 페이지는 콘텐츠 스크립트 오버레이가 아니라 **확장 자체 페이지**(SYSTEM.md 템플릿 없음 → D-38 §4-1 절차: 먼저 SYSTEM.md에 "전체 화면 계측" 템플릿 추가 필요 — 큰 버튼 하나, 카운터, "Esc 건너뛰기").

- **1단계 키 안내:** 정적 카드(설계 원문 그대로, D-30).
- **2단계 떨림 간격 재기:** 큰 버튼을 여러 번(예: 10회) 누르게 하고, 매 클릭의 `timeStamp` 간격을 기록 — 의도치 않은 재클릭(같은 버튼을 아주 짧은 간격으로 다시 누른 경우, 즉 사람이 "한 번 누르려다 두 번 눌린" 경우)의 간격 분포에서 **중앙값보다 큰 값**을 새 `tremorIntervalMs`로 제안(Claude's Discretion — 정확한 통계식은 실행자가 확정, 여기서는 "짧은 재입력 간격들의 최댓값 또는 상위 백분위" 방향을 권장 — 극단값에 휘둘리지 않게 p90 정도).
- **3단계 머무르기 시간 재기:** 버튼 위에 커서를 올려 "편한" 시점에 스페이스바를 누르게 해 `pointerenter`~`keydown` 시간을 `dwellMs` 후보로.

계측이 끝나면 두 묶음(good/hard)의 기본값을 계산해 `updateSettings`(v2, `conditions` 전체 patch)로 저장한다. **"힘든 날" 기본 조작 방식은 자동 순서 강조**(ROADMAP 성공 기준 4 "자동 순서 강조 포함 조작 방식"[VERIFIED: .planning/ROADMAP.md:134, 이 세션에 Read — "'좋은 날 / 힘든 날' 묶음(자동 순서 강조 포함 조작 방식)이 정해지고"]) — Claude's Discretion에서 이 부분만은 **ROADMAP 문구로 사실상 확정**되어 있음을 계획에 명시 권장. "좋은 날"은 자석 커서(D-29 열거 순서상 기본값), 떨림 간격·머무르기 시간은 계측값 그대로, "힘든 날"은 계측값의 여유를 더 크게(예: ×1.5) 두는 것을 권장(손이 더 힘든 날은 간격을 더 넓혀야 함).

각 단계 "Esc 건너뛰기"는 그 단계만 건너뛰고 기본값(defaultSettings()의 기존 v1 기본값)을 그대로 쓴다.

**When to use:** 설치 시 1회, 이후 명령판 "맞춤 설정 다시 하기"(셋째 장 4번)에서 같은 페이지를 다시 연다(재실행 시에는 `runtime.onInstalled`가 아니라 명령판에서 `chrome.tabs.create` 직접 호출).

**Trade-offs:** 온보딩 페이지는 콘텐츠 스크립트 없이 순수 확장 페이지 JS로 시간을 재므로 `performance.now()`/`event.timeStamp`만으로 충분하고 Phase 1의 입력 파이프라인(떨림 필터)을 거치지 않는다 — 오히려 **거치면 안 된다**(떨림 자체를 측정하려는 목적이므로 필터가 이미 걸러내면 측정이 왜곡됨).

### Pattern 11: 옵션 페이지 (키 배치·민감칸 설정·문구 관리·설정 파일)

**What:** WXT의 파일 기반 규칙(`entrypoints/options.html` 또는 `entrypoints/options/index.html`)으로 옵션 페이지를 만든다[CITED: wxt.dev/guide/essentials/entrypoints.html, WebSearch 2026-09-24 — "WXT identifies options entrypoints based on filename patterns: options.html or options/index.html"]. 매니페스트 `options_ui`/`options_page`는 WXT가 자동 생성한다(Phase 1의 `popup/index.html` 패턴과 동일하게 `main.ts` + Shadow DOM 없이 — **옵션 페이지는 사이트 위에 뜨는 오버레이가 아니라 자체 탭이므로 Shadow DOM이 필요 없다.** 다만 SYSTEM.md 토큰은 여전히 `tokens.css?inline`으로 가져와 `:root`에 적용해야 함(D-36 "SYSTEM.md·tokens.css만 따른다"는 원칙은 오버레이가 아닌 화면에도 적용).

옵션 페이지가 다루는 화면(모두 SYSTEM.md에 없는 템플릿 → D-38 §4-1 대상, Claude's Discretion "먼저 템플릿 추가"):
- **키 배치 변경(PERS-03):** 각 동작 옆에 "지금 키" 칩(SYSTEM.md 키 칩 컴포넌트 재사용) + "바꾸기" 버튼 → 누르면 다음 `keydown`(실제 트러스티드 입력만, D-09 원칙 재사용)을 캡처해 새 키로 저장. 충돌 검사(Claude's Discretion): zod `refine()`으로 "같은 code가 keymap 안에서 2개 이상의 동작에 쓰이면 실패" 규칙 — Phase 1의 `SettingsDataSchema.keymap`이 이미 개별 필드(`press`, `confirm`, `cancel`, `toggleHints`)로 있으므로 v2에서 필드가 늘어나면(스크롤, 명령판 열기 등) 같은 `.refine()`을 객체 전체에 건다.
- **민감칸 설정(PRIV-02, PRIV-03):** 사이트별 오버라이드 목록(추가/삭제) + 판별 단어 목록 편집(두 리스트: 항상 민감 / 모양 검사). 비밀번호 칸 해제 시 확인 화면(D-27 경고 문구, Phase 1의 `confirm-dialog.ts` 컴포넌트를 옵션 페이지용으로 이식하거나 — Shadow DOM이 없는 확장 페이지이므로 `<dialog>` 네이티브 엘리먼트로 단순화 권장).
- **문구 관리(INPT-02):** 사이트+칸 이름별 문구 목록 CRUD.
- **사이트별 위험 단어(SAFE-06):** 사이트 선택 + 단어 추가/삭제(기존 `dangerWords` 전역 목록과 별개로 v2 `siteDangerWords` 배열).
- **설정 파일 내보내기/가져오기(STOR-04):** Pattern 8.
- **컨디션 묶음 수동 편집(PERS-01 보조):** 명령판에서는 전환만, 세부값 조정은 옵션 페이지에서.

**When to use:** 명령판 "번호 고정"·"민감칸 설정"·"맞춤 설정 다시 하기" 등 일부는 **콘텐츠 스크립트 오버레이**(그 사이트 위에서 바로, 번호 고정처럼 지금 화면의 요소를 가리켜야 하는 기능)로, 키 배치·문구 전체 관리·설정 파일처럼 "사이트 맥락이 필요 없는" 기능은 **옵션 페이지**로 나누는 것을 권장(Claude's Discretion "설정 화면을 둘 자리" 확정안). 예: "민감칸 설정"은 명령판에서 **지금 페이지의 칸을 가리켜 지정**하는 콘텐츠 스크립트 UI가 필요(사이트 맥락 필수)하지만, 그 뒤 "단어 목록 편집"은 옵션 페이지가 맡는 분업.

**Trade-offs:** 화면이 둘로 나뉘면(콘텐츠 스크립트 UI + 옵션 페이지) 상태 동기화가 필요하지만, 이미 `storage.onChanged` 구독 패턴(Phase 1 popup/main.ts·content.ts 둘 다 구현)이 있어 새로운 문제는 아니다.

### Pattern 12: 자동 순서 강조(CLICK-05) + 명령판 "더블클릭"(NAV-06)

**What:** `src/core/auto-hint-cycle.ts`(신규, `dwell-timer.ts`와 판박이 구조 — 순수 함수, "현재 강조 인덱스, 다음 전환 시각"을 들고 `update(t)`가 진행 여부를 돌려줌): 번호표가 붙은 요소 목록을 순서대로 하나씩 강조(기존 `ring.ts`의 `showRing`을 재사용, danger는 여전히 확인 화면행). 간격(`autoCycleMs`, Pattern 9 컨디션 묶음 필드)마다 다음 요소로. **아무 키**(기본 스페이스바, `currentSettings.data.keymap.press`)가 눌리면 지금 강조된 요소를 선택 — 이는 `dwellTimer`가 아니라 `inputPipeline.onKey`에 새 핸들러를 추가하는 형태로, 위험한 버튼이면 기존 `openDangerConfirm` 그대로 재사용(D-15, 이미 번호표 선택 시 쓰는 경로와 완전히 같은 함수).

**더블클릭(NAV-06):** 명령판 카드 선택 시 "다음 번호표/자석 선택 1회를 더블클릭으로 처리"하는 1회성 플래그를 content.ts에 둔다 — `pressOrDrag()` 실행 시 이 플래그가 있으면 `synthesizePress`가 기존 클릭 시퀀스 뒤에 `dblclick` 이벤트까지 디스패치(또는 click 시퀀스를 두 번 반복)하도록 `src/page/click/press.ts`에 `synthesizeDoublePress()` 변형을 추가. Phase 1의 `tremor-filter.ts`가 `shouldSuppressDblclick()`으로 **의도치 않은** 더블클릭만 억제하는 것이지 도우미가 **의도적으로** 만드는 더블클릭과는 경로가 다르므로 충돌 없음(D-12 "떨림 걸러내기가 의도치 않은 더블클릭을 한 번으로 줄이므로, 더블클릭이 필요한 곳은 명령판 '더블클릭'으로 한다"는 원문이 이 분리를 이미 전제).

**When to use:** CLICK-05는 컨디션 묶음의 `mode: 'auto-cycle'`일 때 자석 커서·번호표 대신 항상 켜져 있는 셋째 조작 방식(D-29 "조작 방식(자석 커서 / 번호표 / 자동 순서 강조)" — 세 방식 중 하나를 배타적으로 선택). `content.ts`의 자석 계산(`evaluateMagnet`)과 번호표 로직은 `mode !== 'auto-cycle'`일 때만 돌게 분기해야 한다.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 명령판 모달 키 가로채기 | 새 window capture 리스너 세트 | `inputPipeline.setModal()`(이미 있음) | confirm-dialog.ts가 이미 이 계약으로 "모든 isTrusted 키 삼키기"를 구현해 둠 — 중복 리스너는 두 모달이 동시에 열렸을 때 경합 위험 |
| 프레임 간 필드/스크롤 좌표 변환 | 새 좌표 합성 로직 | `frame-tree.ts`(`composeTree`, `resolveReports`) | 이미 iframe 오프셋·clip·selfPath 문제를 전부 풀어 둠(RESEARCH A2 정정 포함) |
| 위험 요소 확인 화면(자동 순서 강조·더블클릭에서도) | 새 확인 다이얼로그 | `openDangerConfirm()`(content.ts, 기존) | 확인 화면은 한 군데(맨 위 프레임)에서만 열려야 한다는 D-19 원칙 — 두 번째 구현은 그 원칙을 깨기 쉽다 |
| 설정 파일 형식 검사 | 손으로 만든 JSON 스키마 검사 | `zod`(Phase 1 스택에 이미 있음) + `settings-schema.ts`의 `migrate()` 재사용 | STOR-04도 "형식 버전 + 실패 시 원본 보존"(D-34) 요구가 저장소 값과 완전히 같은 규칙 |
| 사이트별 위험 단어·민감 단어 저장 | 새 저장 키 체계 | `siteKey(origin)`(Phase 1 `settings-schema.ts`, 이미 사이트별 sync 항목 8KB 분할 구현) | Phase 1 D-24가 "사이트별로 나눠 8KB"를 이미 만족하는 유일한 구조 |
| Luhn/주민번호 자릿수 검사 | 정규식 미세조정 시행착오 | 표준 Luhn 알고리즘(결정적) + 단순 자릿수 정규식 | Luhn은 널리 검증된 알고리즘이라 재발명할 이유가 없다 |

**Key insight:** Phase 3의 모든 새 기능은 Phase 1이 이미 증명한 "순수 함수 + 프레임별 렌더 + SW 라우팅 + 단일 저장자" 4계층 중 하나에 슬롯처럼 들어간다. 새 아키텍처 패턴이 필요한 항목은 하나도 없다 — 이것이 이번 연구의 핵심 결론이다.

## Common Pitfalls

### Pitfall 1: 명령판이 열려 있을 때 번호표·자석 커서 키와 충돌
**What goes wrong:** 명령판이 열린 채로 사이트 화면의 번호표도 함께 떠 있으면 숫자 키가 어느 쪽으로 가는지 모호해진다.
**Why it happens:** `hintsActive`와 새 `paletteActive`가 별개의 불리언 플래그로 관리되면 동시에 true가 될 수 있다.
**How to avoid:** 명령판을 열 때 기존 번호표를 반드시 먼저 닫는다(`closeHints()` 호출), 반대도 마찬가지 — 상호 배타 상태로 관리.
**Warning signs:** e2e에서 번호표를 켠 채 `0`을 눌렀을 때의 동작을 반드시 시험 목록에 포함(D-40에 명시되지 않은 조합이므로 계획에서 추가해야 함).

### Pitfall 2: storage.session 기록이 SW 재시작으로 사라짐
**What goes wrong:** Pattern 3의 `navmark:<tabId>`가 SW가 잠들었다 깨어나는 사이 사라지면 Esc 되돌리기가 조용히 실패한다.
**Why it happens:** `storage.session`은 **브라우저 세션 동안**은 유지되지만(SW 재시작에도 살아남음 — 이것이 `session` 스토리지 영역이 존재하는 이유), 브라우저 자체를 완전히 재시작하면 사라진다.
**How to avoid:** 이 phase에서는 문제 아님(같은 세션 안에서만 필요한 짧은 TTL 3초 기록이므로) — 다만 `chrome.storage.session`을 코드에서 처음 쓰는 것이므로 e2e에서 "SW를 강제로 재운 뒤(Phase 1 lifecycle.e2e.ts의 `disconnect()` 흉내 기법 재사용) 되돌리기가 여전히 되는지"를 확인 필요.

### Pitfall 3: 네이티브 setter가 최신 프레임워크와 안 맞음
**What goes wrong:** 일부 최신 프레임워크(Vue 3 등)는 `value` setter가 아니라 다른 내부 상태 갱신 경로를 쓸 수 있어 값은 바뀌지만 프레임워크가 인식 못 하는 경우가 있다.
**Why it happens:** 프레임워크마다 controlled input 구현이 다르다.
**How to avoid:** 연습 사이트에 실제 controlled-input 흉내 페이지(D-39 확장 권장, React 스타일: `value` 속성을 매 렌더마다 state로 강제 리셋하는 최소 스크립트)를 두고 e2e로 "네이티브 setter + input 이벤트"가 이 흉내에서 실제로 값을 유지하는지 확인. 실제 회사 시스템(다른 프레임워크일 가능성)에서는 이번 phase에서 시험하지 않는다(D-14 원칙 계승).

### Pitfall 4: 민감칸 판별이 값 입력 전(빈 문자열)에 오탐/누락
**What goes wrong:** 계좌·카드 칸은 값이 비어 있을 때 "모양 검사 대상"이지만 아직 값이 없으므로 `looksLikeSensitiveValue('')`가 false를 반환 — 이 시점의 입력 줄이기 카드가 "민감칸 아님"으로 잘못 표시될 수 있다.
**How to avoid:** 값이 비어 있고 `shapeSensitive` 단어에 걸리는 칸은 **입력 완료(blur) 시점에 재평가**해서 최근 값 기록 여부를 결정 — 카드 표시 시점(포커스 시)에는 "혹시 모르니 일단 카드 숨김, blur 후 비민감으로 확정되면 다음 포커스부터 카드 노출"처럼 보수적으로 가는 방안도 있으나 과설계 위험. **권장:** INPT-01 카드는 포커스 시점 판정(그 시점 값 기준, 대개 비어 있으므로 대부분 카드가 뜸)으로 충분하고, **기록 여부(NAV-04/최근 값 저장)만 blur 시점 최종 값으로 재판정**하면 "값이 채워지고 나서 민감으로 확정된" 케이스도 저장을 피할 수 있다.

## Code Examples

### 옵션 페이지 기본 골격(WXT 파일 기반 규칙)
```ts
// src/entrypoints/options/index.html + main.ts
// [CITED: wxt.dev/guide/essentials/entrypoints.html — 파일명 패턴이 options.html 또는 options/index.html이면
// WXT가 매니페스트에 옵션 페이지로 자동 등록. defineOptionsUI 같은 별도 API 필요 여부는
// 공식 문서에서 확인 못함 — Plan 실행자가 `wxt build` 결과 manifest.json의 options_ui/options_page
// 필드로 확인해야 함 [ASSUMED, 계획에서 검증]]
```

### chrome.storage.sync 용량 확인
```ts
// [CITED: developer.chrome.com/docs/extensions/reference/api/storage]
const used = await chrome.storage.sync.getBytesInUse(null); // 전체 합계
const QUOTA_BYTES = 102_400;
if (used > QUOTA_BYTES * 0.9) {
  // notice:storage-near-limit 기록(local) → 다음 페이지에서 toast.ts 재사용
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Phase 1: `SchemaVersion 1`, `migrations`는 빈 객체(변환 경로 미사용) | Phase 3: `SchemaVersion 2`, `migrations[1]`을 실제로 채움 | Phase 3 | 01-14가 만든 "변환 실패 시 원본 보존" 인프라가 **처음으로** 정상 변환 경로도 함께 시험받는다 |
| Phase 1: 오버레이 크기 = `1/줌비율`만(01-15) | Phase 3: `1/줌비율 * displayScale`(컨디션 묶음) | Phase 3 | CSS 배관은 그대로, 배율 계산 지점만 확장 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 네이티브 value setter + `input`/`change` 디스패치가 controlled 컴포넌트에서도 통한다 | Pattern 4 | 값 반영 실패 → 연습 사이트 controlled-input 흉내 e2e로 계획 단계에서 잡힘 |
| A2 | `document.execCommand('insertText', ...)`가 Chromium에서 여전히 contenteditable 입력을 반영한다 | Pattern 4 | 양식 한 장 보기·입력 줄이기가 contenteditable 칸에서 실패 → e2e로 확인, 대안은 `textContent` 직접 대입 |
| A3 | 가장 가까운 스크롤 가능한 조상 탐색(`overflow: auto/scroll` + `scrollHeight > clientHeight`)이 표준적으로 동작한다 | Pattern 2 | 스크롤이 엉뚱한 컨테이너에 적용 → `scroll-areas.html` e2e로 확인 |
| A4 | Alt+1~9가 Windows Chrome/Edge/Whale에서 브라우저 예약 단축키와 충돌하지 않는다(탭 전환은 Ctrl 계열) | Pattern 5 | INPT-01 카드 선택 실패 → e2e(연습 사이트)로 확인. 회사 시스템 자체 Alt 단축키와의 충돌은 이번 phase 범위 밖(D-14 계승) |
| A5 | isolated world 콘텐츠 스크립트에서 `history.back()`/`location.reload()`가 페이지 내비게이션에 직접 작용하는지는 불확실 — 이 phase는 확실한 `chrome.tabs.*` 경로를 채택해 이 가정 자체를 회피 | Pattern 3, Standard Stack | 채택하지 않았으므로 리스크 낮음(대안 경로가 이미 있음) |
| A6 | Luhn 체크섬 + 15~16자리를 카드번호 "모양" 판정에 쓰는 것이 이 프로젝트의 기대와 맞다 | Pattern 6 | 오탐/누락 → 단위 시험으로 고정(D-40), discuss-phase나 실행 중 사용자 확인 권장 |
| A7 | `getBytesInUse(null)`(인자 없이 전체 합계)가 90% 기준값 알림에 적절한 방식이다 | Pattern 8 | 알림 시점이 부적절 → 실사용 데이터로 조정 필요, STOR-03은 정확한 %를 명시하지 않음(Claude's Discretion) |
| A8 | WXT 0.21의 옵션 페이지 파일 규칙이 `options.html`/`options/index.html`이고 별도 `defineOptionsUI` 호출이 필요 없다 | Pattern 11, Code Examples | 빌드 후 manifest.json에 `options_ui`가 안 잡히면 계획에서 WXT 설정(`wxt.config.ts`의 `manifest.options_ui`) 수동 지정으로 대체 |

**참고:** 위 A1·A2·A3·A4는 모두 "표준 브라우저 동작에 대한 학습 지식"이며 이번 세션에 실제 브라우저 실행으로 검증하지 않았다 — Phase 1이 `showPicker()`(A3, Phase 1 RESEARCH.md) 같은 항목을 스파이크 e2e로 검증한 것과 동일한 방식으로, Phase 3 계획도 각 항목에 대응하는 최소 스파이크/e2e를 Wave 초반에 배치할 것을 권장한다.

## Open Questions

1. **회사 시스템의 Alt+1~9 충돌 여부**
   - What we know: 연습 사이트·브라우저 자체 예약 단축키(Ctrl 계열)와는 충돌 가능성이 낮다.
   - What's unclear: 실제 그룹웨어/ERP가 Alt+숫자를 메뉴 단축키로 쓰는지는 회사 시스템이 아직 완성되지 않아 확인할 수 없다(D-14 계승 제약).
   - Recommendation: 이 phase는 연습 사이트 확인까지만 하고, 회사 시스템 확인은 Phase 1의 "회사 시스템 완성 후" 항목과 함께 미룬다(deferred 목록에 이미 있는 원칙의 연장).

2. **동기화 용량 90% 기준값의 근거**
   - What we know: `QUOTA_BYTES` = 102,400(공식), STOR-03은 "넘기 전에"만 명시.
   - What's unclear: 정확한 임계값(%)은 설계·CONTEXT 어디에도 없다(Claude's Discretion 목록에 명시된 항목).
   - Recommendation: 90%로 시작하고, 실사용(문구·고정 번호가 실제로 얼마나 쌓이는지) 데이터가 쌓이면 조정 — discuss-phase에서 사용자 확인 후보.

3. **가져오기 "덮어쓰기 vs 합치기" 최종 결정**
   - What we know: 덮어쓰기가 더 단순하고 "다른 브라우저로 옮기기" 시나리오에 자연스럽다.
   - What's unclear: 이용자가 두 브라우저를 각기 다른 용도로 쓰다가 부분적으로 합치고 싶어할 가능성.
   - Recommendation: 덮어쓰기를 기본으로 구현하고, 가져오기 전 "지금 설정을 덮어씁니다"라는 명확한 확인 화면(D-19 확인 화면 보호 패턴 재사용)을 반드시 넣는다.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 빌드·시험 | ✓ | 22.22.2(Phase 1 확인값) | — |
| pnpm | 패키지 | ✓ | 10.33.0(Phase 1 확인값) | — |
| Playwright Chromium 바이너리 | e2e | Phase 1 RESEARCH 기준 미설치(승인 후 설치 예정) | — | Phase 1과 동일 절차 |
| `node_modules` | 이번 세션 | ✗(컨테이너에 미설치, 이 세션은 소스만 Read) | — | 계획·실행 세션에서 `pnpm install`(이미 승인된 패키지, 새 승인 불필요) |
| chrome.storage.session | Pattern 3 | 이미 `storage` 권한에 포함(MV3 표준) | — | 새 권한 불필요 |
| chrome.tabs.goBack/goForward/reload/remove/create | Pattern 3 | 이미 `tabs` 권한(Phase 1이 선언) | — | 새 권한 불필요 |

**Missing dependencies with no fallback:** 없음
**Missing dependencies with fallback:** Playwright 브라우저 바이너리(Phase 1과 동일하게 계획 실행 세션에서 설치)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 인증 없음 |
| V3 Session Management | no(브라우저 세션 스토리지는 인증 세션이 아님) | — |
| V4 Access Control | yes(확장 내부) | 새 메시지 타입(`palette/*`, `form/*`, `nav/*`, `scroll/*`)도 Phase 1과 동일하게 `sender.id === chrome.runtime.id` 확인 + zod discriminated union에 추가 |
| V5 Input Validation | yes | 설정 파일 가져오기는 **외부 파일 입력**(이용자가 다른 PC에서 만든 파일일 수 있음)이므로 저장소 값과 동일하게 zod 전체 검사 + 실패 시 원본 보존(D-34) — 파일 내용은 절대 `eval`/`Function` 없이 `JSON.parse`만 |
| V6 Cryptography | no(D-27의 "암호화 없이 저장" 경고가 이미 이 사실을 명시) | 비밀번호 칸 값을 sync/local에 평문 저장하는 것은 **설계가 명시적으로 받아들인 트레이드오프**(사용자 결정) — 새 암호화를 도입하지 않는다 |
| V14 Configuration | yes | Phase 3는 **새 권한을 추가하지 않는다**(Standard Stack "Alternatives Considered" 참고) — `downloads` 권한을 요청하면 이 원칙 위반이므로 계획은 반드시 `<a download>` 경로를 채택해야 한다 |

### Known Threat Patterns for Phase 3

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 가져온 설정 파일이 조작되어 스키마를 벗어난 값을 주입 | Tampering | `migrate()`(zod) 전체 검사, 실패 시 원본 보존(기존 D-25 패턴 재사용) |
| `nav/markPress`를 사이트가 흉내 내 임의 시점에 Esc를 "뒤로가기"로 오작동시키려 함 | Spoofing | 메시지는 `chrome.runtime` 경유만(D-09), 페이지는 이 경로에 닿을 수 없다 — 사이트가 흉내 낼 방법이 없음(기존 원칙 그대로 적용, 새 취약점 아님) |
| 민감칸 판별 우회(사이트가 라벨을 동적으로 숨겨 판별을 피함) | Information Disclosure | `sensitive.ts`는 매 `input` 이벤트마다 재평가하므로 라벨이 늦게 나타나도 다음 재계산에서 잡힌다 — 완전한 방어는 아니며(사이트가 값을 읽는 시점과 판별 시점 사이의 경합은 이 확장의 근본 한계, Phase 1과 동일한 신뢰 경계) |
| 옵션 페이지가 `web_accessible_resources` 없이도 URL을 안다면(확장 ID 노출) | Information Disclosure | 옵션 페이지는 `chrome-extension://<id>/options.html`로 확장 ID가 이미 노출되는 것은 Phase 1 팝업과 동일한 기존 위협 표면(accept, 새로 늘어나지 않음) |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/03-navigation-input-condition/03-CONTEXT.md`(D-01~D-41), `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/config.json` — 이 세션에 Read
- `docs/superpowers/specs/2026-09-23-tremor-browser-helper-design.md`(전체, 5~11장) — 이 세션에 Read
- `docs/design/SYSTEM.md`, `docs/design/tokens.css`, `docs/DESIGN.md` — 이 세션에 Read
- Phase 1 소스 전체: `src/core/*.ts`(settings-schema, fingerprint, hint-order, confirm-guard, tremor-filter, danger, magnet, frame-path, frame-tree, grid-index, dwell-timer, drag-two-press), `src/page/**`(input/pipeline.ts·mode.ts, collector/collector.ts, click/press.ts, overlay/*), `src/worker/*.ts`(storage-writer, relay), `src/entrypoints/*`(content.ts, background.ts, popup/main.ts), `src/shared/messages.ts`, `tests/e2e/fixtures.ts`, `tests/practice-site/*.html`, `package.json` — 이 세션에 Read
- `.planning/phases/01-click-helper-foundation/01-CONTEXT.md`, `01-RESEARCH.md`, `01-PATTERNS.md`, `01-13-PLAN.md`~`01-16-PLAN.md` — 이 세션에 Read

### Secondary (MEDIUM confidence)
- developer.chrome.com/docs/extensions/reference/api/storage — chrome.storage.sync/session 한도(WebSearch, 2026-09-24)
- wxt.dev/guide/essentials/entrypoints.html — 옵션 페이지 파일 규칙(WebSearch, 2026-09-24)
- Google Chrome 공식 도움말 요약(Ctrl+1~9 탭 전환) — WebSearch, 2026-09-24
- mv3-extension.com 요약(다운로드 API vs Blob+anchor, service worker 제약) — WebSearch, 2026-09-24

### Tertiary (LOW confidence)
- 네이티브 value setter로 controlled input 우회, contenteditable `execCommand`, isolated world의 `history`/`location` 접근 가능 여부 — 학습 지식, 이번 세션 WebSearch로 명확히 확정되지 않음(A5는 자료 상충으로 대안 경로 채택), Assumptions Log 참고

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 신규 패키지 없음, 기존 `package.json`을 이 세션에 직접 확인
- Architecture: HIGH — 모든 패턴이 Phase 1의 이미 구현·검증된 코드 패턴의 확장이고, 이번 세션에 해당 소스를 전부 Read
- 브라우저 API 세부(네이티브 setter, execCommand, 스크롤 조상 탐색, Alt+숫자, isolated world 내비게이션) — MEDIUM~LOW, WebSearch로 부분 교차 확인, 최종 확정은 계획의 e2e 스파이크

**Research date:** 2026-09-24
**Valid until:** 2026-10-08(Phase 1 plans 13~16과 Phase 2 결과에 의존 — 그 결과가 이 연구의 가정과 다르면 재조정 필요, 03-CONTEXT.md "앞선 단계 의존" 참고)
