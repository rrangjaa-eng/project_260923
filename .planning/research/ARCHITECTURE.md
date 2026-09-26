# Architecture Research

**Domain:** Chromium MV3 확장 — 페이지 오버레이 + 입력 가로채기 + 기록·재생 자동화
**Researched:** 2026-09-23
**Confidence:** MEDIUM-HIGH (구성은 승인된 설계 4장. MV3 제약은 Chrome 문서 기반)

## Standard Architecture

### System Overview

```
┌──────────────── 각 탭 · 각 프레임 (content script, isolated world) ────────────────┐
│  입력 필터 ──▶ 모드 판정(입력 중/도우미) ──▶ 클릭 도우미 · 명령 키                   │
│      ▲                                           │                                   │
│  window capture 단계 keydown/pointer             ▼                                   │
│  요소 수집기(보이는 요소, 공간 색인, MO 모아서 갱신) ──▶ 프레임 보고(하위→맨 위)       │
│  틀 기록기 · 단계 실행기 · 양식 한 장 보기                                           │
│  [맨 위 프레임만] 오버레이 UI (Shadow DOM, closed): 강조·번호표·카드·확인 화면       │
├───────────────── main world 스크립트 (틀 실행 중에만 활성) ─────────────────────────┤
│  window.alert / confirm 가로채기 ──(CustomEvent/postMessage)──▶ content script       │
└──────────────────────────────────┬──────────────────────────────────────────────────┘
                                   │ chrome.runtime 메시지 (타입 있는 메시지 규약)
┌──────────────────────────────────▼──────────────────────────────────────────────────┐
│ service worker (언제든 잠듦)                                                        │
│  설정·동기화 저장소(sync/local, 형식 버전) · 틀 저장소 · 실행 조정기(storage.session) │
│  탭·작업판 상태 · declarativeNetRequest 세션 규칙(탭별 이미지·광고 차단)             │
│  AI 창구(화면 정리만, 한도·검사) · 활동 기록(local, 2주)                             │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| 입력 필터 | 모든 키·포인터 입력을 가장 먼저 받아 떨림을 거른다 | `window.addEventListener(..., {capture: true})`, 순수 함수 필터(시간·좌표 기준) |
| 모드 판정 | 포커스가 입력칸/contenteditable이면 키를 원래대로 | `document.activeElement` + shadow root 안 포커스 추적 |
| 요소 수집기 | 누를 수 있는 요소 목록(위치·이름·종류) | IntersectionObserver로 보이는 것만, MutationObserver 모아서, 공간 색인 |
| 프레임 통합 | 하위 프레임 요소를 맨 위 좌표계로 합친다 | 각 프레임이 `frameId`+자기 요소를 보고, 맨 위가 iframe 오프셋으로 변환. cross-origin은 service worker 경유 |
| 클릭 도우미 | 자석/번호/순서/머무르기 | 요소 목록과 필터된 입력만 받는다 |
| 오버레이 UI | 그리기 | 맨 위 프레임에 Shadow DOM 하나, `pointer-events: none` 강조 레이어 + 상호작용 레이어 분리 |
| 판별기(민감칸·위험 버튼·제출 버튼) | 순수 함수 + 사이트별 이용자 설정 | 단위 시험 대상 |
| 틀 기록기 | 누른 요소·입력 값을 단계로 | 요소 식별자 묶음(id/name/라벨/글자/aria/경로/프레임 경로) |
| 요소 찾기 | 식별자 묶음 → 요소, 점수 | 여러 방식이 같은 요소를 가리킬수록 점수↑, 문턱 미만이면 멈춤 |
| 실행 조정기 | 어느 틀·몇 단계·받은 값, 실행 잠금 | service worker, 단계마다 `storage.session`에 기록 |
| 알림 창 가로채기 | 틀 실행 중에만 alert/confirm 처리 | main world content script, "제출 직후 첫 창 하나만 확인" 규칙 |
| AI 창구 | 화면 정리 호출 한 곳 | 개인정보 모양 가림, 한도, zod로 답 검사 |

## Recommended Project Structure

```
src/
├── entrypoints/            # WXT 진입점
│   ├── background.ts       # service worker
│   ├── content.ts          # all_frames, isolated world
│   ├── main-world.content.ts  # world: MAIN (알림 창 가로채기)
│   └── popup/ or options/  # 아이콘 메뉴(도우미 끄기, "도울 수 없음")
├── core/                   # 순수 로직 — DOM·chrome 없이 단위 시험
│   ├── tremor-filter.ts
│   ├── magnet.ts           # 히스테리시스
│   ├── hint-order.ts       # 번호표 우선순위
│   ├── classifiers/        # 민감칸·위험 버튼·제출 버튼
│   ├── locator-score.ts    # 요소 찾기 점수
│   ├── variable-detect.ts  # 바뀌는 값 후보
│   └── schema/             # 저장 형식 + 버전 변환(zod)
├── page/                   # content script 쪽 DOM 코드
│   ├── collector/          # 요소 수집기, 공간 색인, 프레임 보고
│   ├── input/              # 이벤트 가로채기, 모드 판정
│   ├── overlay/            # Shadow DOM UI(Preact)
│   └── automation/         # 기록기, 단계 실행기
├── worker/                 # service worker 쪽
│   ├── storage/            # sync/local/session 래퍼
│   ├── runner/             # 실행 조정, 잠금, 복구
│   ├── blocking/           # declarativeNetRequest 세션 규칙
│   └── ai/                 # 화면 정리 창구
├── shared/messages.ts      # 메시지 타입(판별 유니온)
tests/
├── unit/                   # Vitest
├── e2e/                    # Playwright + 확장 로드
└── practice-site/          # 로컬 연습용 가짜 사이트(정적 HTML)
```

### Structure Rationale

- **core/를 순수 함수로:** 설계 10장의 단위 시험 목록이 거의 전부 여기에 떨어진다. DOM·chrome 없이 빠르게 TDD 가능
- **page/와 worker/ 분리:** "각 부분은 요소 목록과 필터된 입력만 주고받는다"(설계 4장)를 폴더 경계로 강제
- **practice-site/를 저장소 안에:** 모든 시험의 대상이자 Playwright 고정물

## Architectural Patterns

### Pattern 1: 입력 파이프라인 (capture → filter → mode → dispatch)

**What:** 모든 입력을 window capture 단계에서 한 번만 받아 순서대로 넘긴다.
**When to use:** 첫 단계부터. 사이트 단축키보다 먼저 받으려면 capture가 필수(설계 11장 ④).
**Trade-offs:** 사이트가 `document`보다 먼저 `window` capture를 걸었으면 순서 싸움이 생긴다 → 가능한 빨리(`document_start`) 등록.

### Pattern 2: 맨 위 프레임이 그린다 (frame reporting)

**What:** 모든 프레임이 요소를 보고하고, 오버레이는 맨 위 프레임 하나만 그린다.
**When to use:** 회사 시스템 iframe 본문. 번호가 프레임마다 중복되지 않게.
**Trade-offs:** cross-origin iframe은 자기 위치를 모른다 → 부모가 iframe 요소 위치를, 자식이 내부 좌표를 보고해 합친다. 스크롤·크기 변화 때 다시 보고.

### Pattern 3: 단계마다 체크포인트 (resumable runner)

**What:** 틀 실행 상태를 단계마다 `storage.session`에 쓰고, 깨어나면 이어 간다. 제출 단계는 "시작 전/누름/결과 확인" 세 상태로 나눠 쓴다.
**When to use:** 틀 실행 전부(④).
**Trade-offs:** 쓰기 비용이 있지만 단계 수가 적어 문제없다. "누름"까지 기록되고 결과가 없으면 절대 다시 누르지 않고 "확인 필요".

### Pattern 4: 판별기 = 순수 함수 + 사이트 설정 덮어쓰기

**What:** 기본 규칙(단어 목록·값 모양)을 순수 함수로 두고, 사이트별 이용자 설정이 마지막에 덮어쓴다.
**Trade-offs:** 규칙이 한곳에 모여 시험하기 쉽다. 단어 목록이 sync 용량을 조금 쓴다.

## Data Flow

### Request Flow (자석 커서 클릭)

```
pointermove(capture) → 입력 필터(60Hz 제한) → 공간 색인 최근접 → 히스테리시스
   → 잡은 요소 변경 시 overlay 강조(rAF)
click/space(capture) → 필터 → 모드=도우미? → 원래 이벤트 막기 → 위험 버튼? (재확인 : element.click())
   → 활동 기록(무엇을 눌렀는지, 값 없음) → 자주 누른 기록 +1
```

### State Management

```
storage.sync   ← 설정, 컨디션 모드, 고정 번호, 자주 가는 곳, 문구, 민감칸 설정 (용량 감시)
storage.local  ← 자주 누른 기록, 최근 값, 화면 정리 결과, AI 사용량, 활동 기록, 틀, AI 키
storage.session← 틀 실행 상태 (setAccessLevel로 content script 접근 여부 결정)
모든 저장 값   ← { schemaVersion, data } — 변환 실패 시 원본 보존 + 알림
```

### Key Data Flows

1. **틀 실행:** 명령판 → SW 실행 잠금 확인 → 시작 URL 이동 → 값 카드 → content script 단계 실행기(요소 찾기) → 단계마다 SW 체크포인트 → 제출 직전 멈춤·확인 → 첫 알림 창만 자동 확인 → 결과 판정(성공/확인 필요) → 활동 기록
2. **뒤에서 실행:** 같은 흐름이 뒤쪽 탭에서. 이용자 입력이 필요하면 SW가 작업판 "확인 대기"에 넣고 알림
3. **화면 정리:** 명령판 → 요소 목록(글자 가림) → SW AI 창구(한도 확인) → Haiku → zod 검사 → 목록에 있는 것만 → 번호표. 실패 시 자주 누른 순서

## Scaling Considerations

한 이용자용이라 "사용자 수" 확장은 해당 없다. 대신 **페이지 크기**가 확장 축이다.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 요소 수백 개 | 선형 탐색으로도 충분 |
| 요소 5,000개(목표) | 보이는 요소만 + 공간 색인 + 60Hz 제한 + MO 모아서 → 50ms |
| 무한 스크롤·거대 표 | 화면 밖 요소 제외, 색인 재구성을 idle 콜백으로 |

### Scaling Priorities

1. **첫 병목:** MutationObserver 폭주(회사 시스템의 잦은 DOM 갱신) → 모아서 갱신 + 변경 범위만 다시 수집
2. **둘째 병목:** 오버레이 다시 그리기 → 강조 레이어는 transform만 바꾼다

## Anti-Patterns

### Anti-Pattern 1: 프레임마다 오버레이 그리기
**What people do:** 각 iframe이 자기 번호표를 그림 → **Why it's wrong:** 번호 중복, 겹침 → **Do this instead:** 맨 위 프레임 통합(Pattern 2)

### Anti-Pattern 2: service worker 메모리에 실행 상태
**What people do:** 전역 변수에 틀 진행 상태 → **Why it's wrong:** 30초 유휴 뒤 잠들면 사라짐 → **Do this instead:** 단계마다 `storage.session`

### Anti-Pattern 3: 알림 창 항상 가로채기
**What people do:** 평소에도 confirm을 자동 확인 → **Why it's wrong:** 의도치 않은 삭제·상신 → **Do this instead:** 틀 실행 중, 제출 확인 직후 첫 창 하나만(설계 6.8)

### Anti-Pattern 4: 판별 로직을 UI 코드에 흩어 놓기
**Why it's wrong:** 민감칸·위험 버튼 규칙이 기능마다 달라짐 → **Do this instead:** core/classifiers 한 곳

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Anthropic API(`claude-haiku-4-5`) | SW에서 SDK, 키는 local | host_permissions에 api.anthropic.com. 키 없으면 이 기능만 끔 |
| Chrome Web Store | 비공개(unlisted) 링크, 지연 게시, 롤백 | 엣지·웨일도 웹스토어 설치 가능 |
| 브라우저 계정 동기화 | `storage.sync` | 같은 브라우저끼리만 |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| content ↔ SW | `chrome.runtime.sendMessage`/port, 판별 유니온 타입 | SW가 잠들어 있으면 메시지가 깨운다 |
| 하위 프레임 ↔ 맨 위 프레임 | SW 경유 `chrome.tabs.sendMessage(tabId, msg, {frameId})` 또는 `postMessage` | cross-origin 대비 SW 경유가 안전 |
| main world ↔ isolated world | `CustomEvent`/`postMessage` | 페이지가 위조할 수 있으므로 비밀 토큰·출처 확인 |

## Suggested Build Order (설계 10-1과 일치)

1. core 순수 함수(필터·히스테리시스·번호표) → 요소 수집기·프레임 통합 → 입력 파이프라인 → 오버레이 → 도우미 끄기
2. (중간 이용자 시험 — 코드 변경은 기본값 조정뿐)
3. 명령판(이후 기능의 입구) → 스크롤·되돌리기 → 판별기(민감칸) → 입력 줄이기 → 양식 한 장 보기 → 컨디션 모드·맞춤 설정
4. 요소 찾기 점수 → 기록기 → 실행 조정기(체크포인트·잠금) → 제출 확인 → 알림 창 → 막힘·다시 기록 → 활동 기록
5. 작업판 → 뒤에서 실행(확인 대기) → 탭별 차단 → 반복 패턴 알림
6. AI 창구 → 화면 정리

## Sources

- 설계 문서 4·5·6·7장 — HIGH
- Chrome 확장 문서(MV3 service worker 수명, `storage.session` 접근 수준, `world: "MAIN"`, declarativeNetRequest 세션 규칙 `tabIds`) — 일반 지식, 이번에 개별 페이지 재확인은 안 함 — MEDIUM
- [Chrome Web Store rollback](https://developer.chrome.com/docs/webstore/rollback) — HIGH

---
*Architecture research for: 손 떨림 브라우저 도우미*
*Researched: 2026-09-23*
