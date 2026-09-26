# Project Research Summary

**Project:** 손 떨림 브라우저 도우미 (이름 미정)
**Domain:** 운동 장애 이용자 한 사람을 위한 Chromium MV3 확장 — 클릭 보조 + 업무 양식 자동화
**Researched:** 2026-09-23
**Confidence:** MEDIUM

## Executive Summary

이 제품은 Vimium식 번호 힌트, Steady Clicks식 클릭 필터, Automa식 기록·재생을 한 이용자의 손 떨림에 맞춰 묶고, 여기에 "되돌릴 수 없는 제출은 항상 확인 뒤에만"이라는 안전장치를 얹은 크롬·엣지·웨일용 MV3 확장이다. 서버는 없고, AI는 "화면 정리" 한 곳에서 키를 누를 때만 쓴다.

추천 접근은 WXT(Vite 기반) + TypeScript strict + Preact(Shadow DOM 오버레이) + zod(저장 형식·외부 입력 검사)이다. 판별·필터·점수 같은 핵심 로직은 `core/` 순수 함수로 떼어 Vitest로 TDD하고, 흐름 전체는 Playwright로 확장을 띄워 로컬 연습 사이트에서 시험한다. 모든 입력은 window capture 단계에서 한 번만 받아 "필터 → 모드 판정 → 기능"으로 흘린다. 오버레이는 맨 위 프레임 하나가 모든 프레임의 요소를 모아서 그린다.

가장 큰 위험은 ① 사이트가 확장이 만든 클릭(`isTrusted=false`)을 무시하는 경우, ② 떨림 필터 기본값이 실제 이용자에게 맞지 않는 경우, ③ 틀 실행 중 제출 중복이다. ①은 첫 단계의 첫 스파이크로, ②는 중간 이용자 시험으로, ③은 단계별 체크포인트와 "재시도 경로 자체를 만들지 않기"로 막는다.

## Key Findings

### Recommended Stack

WXT 0.21.4가 MV3 manifest, `all_frames`, `world: "MAIN"` 스크립트, Shadow DOM UI, 크롬/엣지 zip을 한 번에 해결한다. TypeScript는 7.0.2가 latest지만 네이티브 컴파일러 첫 메이저라 도구 호환을 확인하고, 막히면 6.x로 고정한다. 새 의존성은 저장소 규칙대로 승인 후 들인다.

**Core technologies:**
- WXT 0.21 (Vite 8): 확장 빌드 — main world·Shadow DOM·HMR 내장
- TypeScript strict: 저장소 규칙, `any` 금지
- Preact 10: 가벼운 오버레이 UI — 모든 프레임 주입 부담 최소
- zod 4: 저장 형식 버전 변환, 틀 파일·AI 답 검사
- Vitest 5 + Playwright 1.63: 단위 + 확장 로드 e2e(SW 강제 종료 재현 포함)
- `claude-haiku-4-5` via @anthropic-ai/sdk: 화면 정리 — 가장 작고 저렴($1/$5 per 1M)

### Expected Features

**Must have (table stakes):**
- 요소 수집기(모든 프레임), 떨림 걸러내기, 자석 커서, 번호표, 도우미 끄기, 입력 모드 표시
- 확인 화면 보호, 위험한 버튼 보호
- 키 스크롤·명령판·Esc 되돌리기

**Should have (differentiators):**
- 틀 자동화 + 제출 안전장치 + 알림 창 처리 + 막힘·다시 기록
- 양식 한 장 보기, 입력 줄이기, 컨디션 모드, 맞춤 설정
- 작업판·뒤에서 실행·확인 대기, 반복 패턴 알림, 활동 기록·주간 통계
- 화면 정리(AI)

**Defer (v2+):**
- 윈도우 상주 프로그램, 엑셀·다른 사이트 정보 옮기기, 안드로이드·아이폰, AI 글쓰기·AI 틀 복구

### Architecture Approach

content script(각 프레임, isolated world)가 입력 필터·요소 수집·클릭 도우미·기록기·실행기를 맡고, 맨 위 프레임만 Shadow DOM 오버레이를 그린다. main world 스크립트는 틀 실행 중에만 alert/confirm을 가로챈다. service worker는 저장소(sync/local/session), 실행 조정(단계마다 체크포인트·실행 잠금), 탭별 차단 규칙, AI 창구, 활동 기록을 맡는다. 부분끼리는 타입 있는 메시지로만 대화한다.

**Major components:**
1. 입력 파이프라인(capture → 필터 → 모드 판정) — 모든 기능의 앞단
2. 요소 수집기 + 프레임 통합 + 공간 색인 — 모든 클릭 기능의 바탕
3. 오버레이 UI(맨 위 프레임, Shadow DOM) — 강조·번호표·카드·확인 화면
4. 판별기(민감칸·위험 버튼·제출 버튼) — 순수 함수 + 사이트별 설정
5. 틀 기록기·요소 찾기 점수·실행 조정기 — 체크포인트 기반, 재시도 없음
6. 저장소 계층(형식 버전, 안전한 변환) · AI 창구

### Critical Pitfalls

1. **합성 클릭 거부** — ①의 첫 스파이크로 확인, 전체 이벤트 순서 헬퍼, 예비로 `chrome.debugger` CDP 입력
2. **떨림 필터 기본값 불일치** — 모두 설정값, 중간 이용자 시험에서 맞춤
3. **제출 중복** — 시작 전/누름/결과를 먼저 기록, 불분명하면 "확인 필요", 재시도 경로 없음
4. **확인 화면 통과** — 1초 입력 무시, 선택 키와 확인 키 분리
5. **iframe 좌표·번호 꼬임** — 맨 위 프레임 통합, 연습 사이트에 중첩·cross-origin iframe

## Implications for Roadmap

설계 10-1 "만드는 순서"(승인된 결정)를 그대로 따른다. 연구 결과도 같은 의존 순서를 지지한다.

### Phase 1: 클릭 도우미 기반
**Rationale:** 모든 기능이 요소 수집기와 입력 필터 위에 선다. 핵심 가치(속도)를 가장 먼저 검증.
**Delivers:** 요소 수집기(모든 프레임), 떨림 걸러내기, 자석 커서, 번호표, 입력 모드 표시, 위험 버튼 보호·확인 화면 보호, 도우미 끄기, 연습 사이트, 저장 형식 버전 기반
**Addresses:** table stakes 대부분
**Avoids:** 합성 클릭 거부(스파이크), iframe 꼬임, 확인 화면 통과, 사이트 단축키 충돌

### Phase 2: 중간 이용자 시험 (체크포인트)
**Rationale:** 설계 10장·10-1 ②. 기본값을 실제 이용자로 맞추고 이후 순서를 조정.
**Delivers:** 이용자 시험 기록, 조정된 기본값(떨림 간격·잡는 범위·머무르기 시간), 이후 단계 조정 결정
**Avoids:** 필터 기본값 불일치

### Phase 3: 이동·입력
**Rationale:** 명령판이 이후 모든 기능의 입구. 민감칸 판별기가 입력 줄이기 전에 필요.
**Delivers:** 키 스크롤, 명령판, 되돌리기, 민감칸 판별, 입력 줄이기, 양식 한 장 보기, 컨디션 모드, 맞춤 설정, 자동 순서 강조·머무르기 클릭

### Phase 4: 틀 자동화 + 활동 기록
**Rationale:** 두 번째 목표(반복 업무 자동화). 활동 기록이 잠듦 복구에 필요해 함께.
**Delivers:** 기록, 요소 찾기 점수, 실행(속도 3단계·잠금), 제출 확인, 알림 창, 막힘·다시 기록, 활동 기록·통계, 설정·틀 파일 내보내기·가져오기

### Phase 5: 작업판·뒤에서 실행·반복 패턴 알림
**Rationale:** 틀 실행 위에 선다. 뒤쪽 탭 속도 제한 측정 필요.
**Delivers:** 작업판(탭 카드·자주 가는 곳·진행·확인 대기), 뒤에서 실행, 탭별 이미지·광고 차단, 반복 패턴 알림

### Phase 6: 화면 정리(AI)
**Rationale:** 선택 기능, 외부 전송·비용이 있어 마지막. 번호표만 있으면 된다.
**Delivers:** AI 창구, 개인정보 가림, 한도, 답 검사, 결과 저장, 실패 시 자주 누른 순서 대체

### Phase Ordering Rationale

- 의존: 요소 수집기·필터 → 클릭 도우미 → 명령판 → 틀 → 작업판, AI는 번호표 위에 독립
- 검증: 핵심 가치를 먼저 만들고 실제 이용자로 기본값을 맞춘 뒤 나머지를 쌓는다
- 위험: 가장 큰 불확실성(합성 클릭·기본값)을 가장 앞에 둔다

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** 합성 클릭 수용 여부, capture 단계 키 우선권, iframe cross-origin 좌표 — 스파이크 필요
- **Phase 4:** main world 알림 창 교체와 isolated world 통신 보안, SW 잠듦 재현 시험 방법
- **Phase 5:** 숨은 탭 타이머 제한 실측
- **Phase 6:** 화면 정리 프롬프트·구조화 출력 형식, 가림 규칙

Phases with standard patterns (skip research-phase):
- **Phase 2:** 코드보다 시험 운영 — 연구 불필요
- **Phase 3:** 명령판·스크롤·양식 UI는 일반 패턴

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | 버전은 npm으로 확인(HIGH). TS 7 도구 호환과 웨일 sync는 미확인 |
| Features | HIGH | 승인된 설계에서 직접 |
| Architecture | MEDIUM | 설계 4장 + MV3 일반 지식. 개별 API 문서 재확인은 계획 단계에서 |
| Pitfalls | MEDIUM | 설계 11장과 일반 MV3 경험. 회사 시스템 동작은 실측 필요 |

**Overall confidence:** MEDIUM

### Gaps to Address

- 회사 시스템이 합성 클릭을 받는지: Phase 1 스파이크, 안 되면 CDP 예비 수단 결정
- 회사 PC 확장 설치 정책: Phase 1 착수 전 이용자 PC에서 확인
- 웨일 `storage.sync` 동작: Phase 1·3에서 실측, 그 전까지 파일 내보내기·가져오기 기본
- 숨은 탭 속도: Phase 5에서 측정
- 디자인 리뷰·엔지니어링 리뷰 PENDING(GSTACK REVIEW REPORT): UI가 들어가는 Phase 1 계획 전에 저장소 워크플로(`docs/DESIGN.md`, `/plan-eng-review`)대로 처리

## Sources

### Primary (HIGH confidence)
- 설계 문서 `docs/superpowers/specs/2026-09-23-tremor-browser-helper-design.md`
- npm 레지스트리 버전·peer 정보(2026-09-23)
- [Chrome Web Store rollback](https://developer.chrome.com/docs/webstore/rollback), [Update your item](https://developer.chrome.com/docs/webstore/update)

### Secondary (MEDIUM confidence)
- [chromium-dev: isTrusted events from content script](https://groups.google.com/a/chromium.org/g/chromium-dev/c/94t2J_Jylyw)
- MV3 service worker 수명, storage 할당량, 숨은 탭 타이머 — 일반 지식

### Tertiary (LOW confidence)
- 웨일 계정 동기화의 `storage.sync` 지원 — 자료 없음

---
*Research completed: 2026-09-23*
*Ready for roadmap: yes*
