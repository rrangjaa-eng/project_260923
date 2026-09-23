# Phase 1: 클릭 도우미 기반 - Research

**Researched:** 2026-09-23
**Domain:** Chromium MV3 확장 — 모든 프레임 입력 가로채기 + 요소 수집·공간 색인 + Shadow DOM 오버레이 + service worker 단일 저장소
**Confidence:** MEDIUM (패키지 버전·호환 범위는 npm 레지스트리에서 이번 세션에 직접 확인 — HIGH. 브라우저 API 세부 동작은 학습 지식 — 계획에서 실행 확인 단계로 검증)

## Summary

Phase 1은 저장소에 코드가 하나도 없는 상태(greenfield — `git ls-files`에 `.ts/.tsx/.js` 없음, `package.json` 없음)에서 시작한다. 그래서 첫 계획은 **걸어 다니는 뼈대(Walking Skeleton)**다: 의존성 승인 → 도구 세트(빌드·린트·타입·단위·e2e) → "확장 아이콘에서 도우미 끄기 → service worker가 `storage.sync`에 한 번 쓰기 → 모든 프레임의 content script가 받아 모드 표시를 걷음" 한 경로를 끝까지 잇는 tracer. 이 경로가 저장소(형식 버전 포함)·메시지·오버레이·팝업·연습 사이트·Playwright 확장 로드를 한 번에 증명한다.

그 위에 수직 조각을 쌓는다: (1) 떨림 걸러내기 + 모드 판정(입력 파이프라인), (2) 요소 수집기 + 격자 색인 + 자석 커서(한 프레임 안), (3) 프레임 통합 + 번호표 + 위험 확인 화면, (4) 머무르기 클릭 + 끌어서 놓기 두 번 누르기 + 대신 누르기 한계 스파이크, (5) 사이트별 끄기 동기화·"도울 수 없음"·업데이트 대비·형식 변환 실패 + 5,000요소 50ms 측정 + 독립 DOM 감사.

**Primary recommendation:** WXT 0.21.4 + TypeScript **6.0.3(고정)** + zod 4 + Vitest 5(happy-dom) + Playwright 1.63, 오버레이는 프레임워크 없이 순수 DOM(Phase 1 화면은 테두리·번호표·모드 표시·확인 카드·팝업뿐). Preact는 명령판이 생기는 Phase 3에서 따로 승인받는다. 모든 설치는 의존성 승인 체크포인트 뒤에만.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 떨림 걸러내기(키·클릭 간격, 자동 반복, 더블클릭) | content script — 입력이 들어온 프레임 | — | 입력은 커서·포커스가 있는 프레임으로만 들어온다. 첫 단계에서 걸러야 사이트 단축키보다 먼저다(D-06, D-17) |
| 입력 중/도우미 판정 | content script — 그 프레임 | 맨 위 프레임(표시만) | 포커스는 프레임마다 다르다. 표시는 맨 위(D-02, D-03, D-16) |
| 요소 수집·격자 색인·자석 커서·강조 테두리·머무르기 | content script — 그 프레임 | — | 50ms 목표 때문에 프레임을 건너지 않는다(D-02, D-05) |
| 번호표 번호 매기기·번호표 그리기·모드 표시·확인 화면 | content script — 맨 위 프레임 | 하위 프레임(요소 보고, 누르기 실행) | 번호가 프레임 사이에서 겹치지 않게 한 곳에서(D-03) |
| 프레임 사이 메시지 중계 | service worker | — | 사이트가 닿지 않는 확장 내부 통로만(D-09) |
| 모든 저장(sync/local) 쓰기·형식 버전·변환 | service worker | content script·팝업(부탁만) | 단일 저장자(D-24, D-25) |
| 도우미 끄기(전체/사이트) 화면 | 확장 팝업(action popup) | service worker(저장) | 설계 8장 "확장 아이콘에서"(D-20) |
| "도울 수 없음" 아이콘 표시 | service worker(`chrome.action`) | — | content script가 못 들어가는 페이지이므로 확장 쪽에서만 가능(D-21) |
| 옛 도우미 걷어 내기 / 새 도우미 넣기 | content script(자기 정리) / service worker(`onInstalled`) | — | D-22 |
| 위험한 버튼 판별·번호표 우선순위·히스테리시스·필터·형식 변환 | 순수 함수(`src/core/`) | — | DOM·chrome 없이 단위 시험(D-30) |
| 연습 사이트 | 시험 고정물(`tests/practice-site/`) | — | 실제 회사 시스템은 쓰지 않는다(D-14, D-28) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wxt | 0.21.4 [VERIFIED: npm registry, 2026-08-11] | MV3 빌드(manifest 생성, content script `allFrames`/`runAt`, 팝업, 크롬 zip) | Vite 기반. 확장 진입점·manifest·개발 재적재를 한 번에. 설계가 "빌드 도구는 구현 계획에서 정한다"고 열어 둔 자리(D-01, STACK.md) |
| vite | 8.3.0 [VERIFIED: npm registry] | WXT·Vitest의 번들러 | wxt peerDependencies `vite: ^6.3.4 \|\| ^7.0.0 \|\| ^8.0.0-0`이 **optional 아님**(peerDependenciesMeta에 없음) → 직접 devDependency로 둔다 [VERIFIED: npm view wxt peerDependencies/peerDependenciesMeta] |
| typescript | **6.0.3 (고정)** [VERIFIED: npm registry] | 언어, strict | latest는 7.0.2지만 typescript-eslint 8.70.1의 peer가 `typescript: >=4.8.4 <6.1.0` [VERIFIED: npm view typescript-eslint peerDependencies] → 7.x를 쓰면 린트가 깨진다. wxt peer `typescript >=5.4`와도 맞는다 |
| zod | 4.6.5 [VERIFIED: npm registry] | 저장 데이터 형식 검사·버전 변환 | 저장소 값은 다른 PC·옛 버전에서 온 외부 입력으로 본다(D-25) |

### Supporting (dev)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 5.0.1 [VERIFIED: npm registry] | 단위 시험 | `src/core/` 순수 함수 TDD(D-30). peer vite ^6.4\|\|^7\|\|^8 [VERIFIED] |
| happy-dom | 20.14.5 [VERIFIED: npm registry] | 단위 시험용 DOM | 누를 수 있는 요소 판정·편집 가능 판정처럼 DOM 속성만 읽는 함수 시험(레이아웃 값은 없음 — 위치 관련은 e2e로) |
| @playwright/test | 1.63.0 [VERIFIED: npm registry] | 확장을 띄운 크롬 시험 | `chromium.launchPersistentContext` + `--load-extension`, `context.serviceWorkers()`로 SW 접근. 브라우저 바이너리는 `pnpm exec playwright install chromium`로 받는다(네트워크 필요) |
| eslint | 10.11.0 [VERIFIED: npm registry] | 린트 | `pnpm lint` 게이트 |
| typescript-eslint | 8.70.1 [VERIFIED: npm registry] | TS 린트 규칙 | `@typescript-eslint/no-explicit-any: error`(저장소 규칙 `any` 금지) |
| @fontsource/ibm-plex-sans-kr | 5.3.0 [VERIFIED: npm registry, license OFL-1.1] | 서체 파일(400·700) | SYSTEM.md "IBM Plex Sans KR, 확장 안에 파일로 넣는다(OFL)". 400·700 woff2만 가져온다(패키지 전체 24MB 중 번들에는 쓰는 파일만 들어감) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| WXT | @crxjs/vite-plugin / 손으로 짠 esbuild | 설정을 직접 쥐지만 manifest·zip·재적재를 손으로 만든다(STACK.md) |
| 순수 DOM 오버레이 | Preact 10.29.8 | Phase 1 화면(테두리·번호표·모드 표시·확인 카드·팝업)은 순수 DOM으로 충분. 명령판·양식 한 장 보기가 오는 Phase 3에서 따로 승인(CLAUDE.md "요청 없는 추상화 금지") |
| 직접 격자 | flatbush 4.6.2 | 설계 4장이 "격자(공간 색인)"로 정함. 격자로 50ms를 못 맞추면 그때 승인받아 들인다 |
| `chrome.debugger` CDP 입력 | — | **설계 11장 ⑤가 금지**("개발자 도구(debugger) 방식은 쓰지 않는다"). STACK.md의 2차 예비안은 쓰지 않는다(D-13) |
| 정적 서버 패키지(serve, http-server) | `node:http`로 쓴 작은 스크립트 | 연습 사이트는 정적 파일 + 두 출처(다른 출처 iframe)만 필요. 새 의존성 없이 된다 |

**Installation (승인 뒤에만, Plan 01-01 Task 3):**
```bash
pnpm add zod@4.6.5
pnpm add -D wxt@0.21.4 vite@8.3.0 typescript@6.0.3 vitest@5.0.1 happy-dom@20.14.5 @playwright/test@1.63.0 eslint@10.11.0 typescript-eslint@8.70.1 @fontsource/ibm-plex-sans-kr@5.3.0
pnpm exec playwright install chromium
```

## Package Legitimacy Audit

`gsd_run query package-legitimacy check --ecosystem npm …` 실행 결과(2026-09-23). 모든 패키지가 레지스트리에 있고, 공식 저장소 URL이 있으며, `postinstall`이 없다(`npm view <pkg> scripts.postinstall` 빈 값). 다만 판정기가 주간 다운로드 수를 가져오지 못했고(`unknown-downloads`), 최신 버전이 최근에 나온 패키지는 `too-new`가 붙어 **모두 SUS**로 나왔다. 규칙대로 설치 전 사람 확인 체크포인트가 필요하다.

| Package | Registry | Age (latest publish) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| wxt | npm | 2026-08-11 | unknown | github.com/wxt-dev/wxt | [SUS] unknown-downloads | Flagged — planner must add checkpoint |
| vite | npm | recent | unknown | github.com/vitejs/vite | [SUS] too-new, unknown-downloads | Flagged — planner must add checkpoint |
| typescript | npm | 2026-07-08 | unknown | github.com/microsoft/TypeScript | [SUS] unknown-downloads | Flagged — planner must add checkpoint |
| zod | npm | 2026-09-13 | unknown | github.com/colinhacks/zod | [SUS] too-new, unknown-downloads | Flagged — planner must add checkpoint |
| vitest | npm | 2026-09-15 | unknown | github.com/vitest-dev/vitest | [SUS] too-new, unknown-downloads | Flagged — planner must add checkpoint |
| happy-dom | npm | 2026-09-12 | unknown | github.com/capricorn86/happy-dom | [SUS] too-new, unknown-downloads | Flagged — planner must add checkpoint |
| @playwright/test | npm | 2026-09-04 | unknown | github.com/microsoft/playwright | [SUS] too-new, unknown-downloads | Flagged — planner must add checkpoint |
| eslint | npm | 2026-09-18 | unknown | github.com/eslint/eslint | [SUS] too-new, unknown-downloads | Flagged — planner must add checkpoint |
| typescript-eslint | npm | 2026-09-21 | unknown | github.com/typescript-eslint/typescript-eslint | [SUS] too-new, unknown-downloads | Flagged — planner must add checkpoint |
| @fontsource/ibm-plex-sans-kr | npm | 2026-07-19 | unknown | github.com/fontsource/font-files | [SUS] unknown-downloads | Flagged — planner must add checkpoint |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** 위 10개 전부(사유: 다운로드 수 조회 실패·최근 배포). 이름은 STACK.md와 공식 저장소가 일치한다. planner는 설치 작업 앞에 `checkpoint:human-verify`(gate="blocking-human")를 둔다.

## Architecture Patterns

### System Architecture Diagram

```
 [사람의 키·마우스 (isTrusted)]
        │ window capture, document_start 에 등록 (사이트 핸들러보다 먼저)
        ▼
 ┌──────────── 각 프레임 content script (isolated world) ────────────┐
 │ isTrusted 아님 → 무시(D-09)                                        │
 │ 떨림 필터(간격·반복·더블클릭) ──▶ 모드 판정(입력칸/편집기?)        │
 │        │ 입력 중이면 숫자·스페이스바는 원래대로 통과                │
 │        ▼ 도우미면                                                   │
 │ 요소 수집기(보이는 요소, MO 모아서) ─▶ 격자 색인 ─▶ 자석(히스테리시스)│
 │        │ 강조 테두리(이 프레임 Shadow DOM) · 머무르기 원              │
 │        ├─ 스페이스바/클릭 → 대신 누르기(pointer/mouse/focus/click)  │
 │        └─ 1~9 · Enter · Esc → SW 경유 맨 위 프레임으로 전달         │
 │ 요소 목록 보고(프레임 id, 자기 viewport 좌표, 자식 iframe 오프셋) ─┐ │
 └────────────────────────────────────────────────────────────────────┼─┘
                                                                      ▼
 ┌──────────── service worker (언제든 잠듦) ─────────────┐   chrome.runtime 메시지
 │ 메시지 중계(프레임→맨 위, 맨 위→프레임, tabId+frameId)  │◀──────────────┘
 │ 단일 저장자: sync(설정·사이트별 끄기·고정 번호),        │
 │             local(자주 누른 기록), 형식 버전·변환        │
 │ chrome.action: "도울 수 없음" · 팝업 상태               │
 │ onInstalled: 열린 탭 모든 프레임에 새 도우미 주입       │
 └────────────────────────────┬──────────────────────────┘
                              ▼
 ┌──────── 맨 위 프레임 content script ────────┐     ┌─── 확장 팝업 ───┐
 │ 프레임 트리 합성(getFrameId로 iframe 짝짓기) │     │ 도우미 끄기      │
 │ 번호표 1~9 매기기(고정→자주→근처)·그리기     │     │ (전체/이 사이트) │
 │ 모드 표시(왼쪽 아래, 커서 80px이면 비킴)      │     │ 도울 수 없음 표시│
 │ 위험 확인 화면(1초 보호, Enter/Esc)          │     └────────┬────────┘
 └─────────────────────────────────────────────┘              │ 저장 부탁 → SW
```

### Recommended Project Structure
```
package.json · pnpm-lock.yaml · tsconfig.json · wxt.config.ts
eslint.config.js · vitest.config.ts · playwright.config.ts
src/
├── entrypoints/
│   ├── background.ts          # service worker: 중계·단일 저장자·action·onInstalled
│   ├── content.ts             # allFrames, runAt document_start, isolated world
│   └── popup/                 # index.html + main.ts (도우미 끄기, 도울 수 없음)
├── core/                      # 순수 함수 — DOM·chrome 없음, Vitest
│   ├── tremor-filter.ts       # 간격·자동 반복·더블클릭
│   ├── drag-two-press.ts      # 끌기 시작 → 놓을 곳 상태 기계
│   ├── grid-index.ts          # 격자 공간 색인, 최근접 찾기
│   ├── magnet.ts              # 잡기 범위·히스테리시스·위험 버튼 예외
│   ├── hint-order.ts          # 고정→자주→근처 1~9
│   ├── fingerprint.ts         # 요소 식별 묶음·일치 점수(6.8 방식)
│   ├── danger.ts              # 위험한 버튼 판별(기본 단어 목록)
│   ├── confirm-guard.ts       # 1초 보호·Enter/스페이스바 1초/Esc 상태 기계
│   ├── settings-schema.ts     # zod 스키마 + schemaVersion + migrate()
│   └── unsupported-url.ts     # "도울 수 없음" URL 판정
├── page/                      # content script 쪽 DOM
│   ├── input/                 # capture 등록, isTrusted, 모드 판정, 키 라우팅
│   ├── collector/             # 요소 수집기, MO 모아서, 프레임 보고
│   ├── click/                 # 대신 누르기, 자석 연결, 머무르기
│   └── overlay/               # Shadow DOM 호스트, 토큰 CSS, 테두리·번호표·모드 표시·확인 카드
├── worker/
│   ├── storage-writer.ts      # 순서대로 쓰는 단일 저장자
│   └── relay.ts               # 프레임 메시지 중계
├── shared/messages.ts         # 판별 유니온 메시지 타입
└── styles/tokens.css          # docs/design/tokens.css 를 가져오는 진입(값 복제 금지)
tests/
├── unit/                      # Vitest
├── e2e/                       # Playwright (fixtures.ts가 확장 로드)
└── practice-site/             # 정적 HTML + serve.mjs(node:http, 두 출처)
```

### Pattern 1: 입력 파이프라인 (capture → isTrusted → filter → mode → dispatch)
**What:** 모든 키·포인터 입력을 `window.addEventListener(type, h, { capture: true })`로 `document_start`에 등록해 가장 먼저 받는다. 같은 대상·같은 단계의 리스너는 등록 순서대로 불리므로, 페이지 스크립트보다 먼저 실행되는 content script(`run_at: document_start`)가 사이트 단축키보다 앞선다 [ASSUMED: DOM 이벤트 디스패치 규칙 + Chrome 문서의 document_start 설명 — Plan 01-05 e2e(사이트 단축키 페이지)로 확인].
**When to use:** 첫 조각부터. 도우미가 쓰는 키(스페이스바·1~9·Enter·Esc)는 도우미 모드일 때 `preventDefault()` + `stopImmediatePropagation()`.
**Trade-offs:** 사이트가 `window` capture에 먼저 등록할 방법은 없지만(우리가 먼저 실행), 사이트가 `keydown` 대신 `keypress`/`beforeinput`을 쓰면 그 이벤트도 막아야 한다 → 도우미 키의 keypress·keyup도 함께 막는다.

### Pattern 2: 맨 위 프레임이 번호를 매긴다 (프레임 트리 합성)
**What:** 각 프레임은 `{frameId, 요소[](자기 viewport 좌표), 자식 iframe[]: {childFrameId, offsetX, offsetY, clip}}`를 SW에 보고한다. 부모 프레임은 자기 문서의 각 `<iframe>`에 `chrome.runtime.getFrameId(iframeEl)`을 불러 자식 frameId를 알고, iframe의 content box 위치를 오프셋으로 붙인다(D-03). SW는 이것을 탭의 맨 위 프레임(frameId 0)에 넘기고, 맨 위는 트리를 따라 오프셋을 더해 모든 요소를 맨 위 좌표로 바꾼 뒤 1~9를 한 번만 매긴다 → 번호 중복 없음.
**When to use:** 번호표, 모드 표시의 커서 비킴, 확인 화면.
**Trade-offs:** 다른 출처 iframe은 자기 위치를 모르므로 반드시 부모가 오프셋을 보고한다. 스크롤·크기 변화 때 다시 보고한다(모아서). `runtime.getFrameId`는 Chrome 106+ [ASSUMED — Plan 01-07 e2e(중첩·다른 출처 iframe)로 확인].

### Pattern 3: 대신 누르기 (synthetic press)
**What:** 잡은 요소 가운데 좌표로 `pointerover → pointerenter → mouseover → pointerdown → mousedown → focus → pointerup → mouseup → click`을 차례로 보낸다(D-13). 커서가 이미 잡은 요소 위에 있는 마우스 클릭은 **원래 이벤트를 그대로 통과**시킨다(브라우저의 진짜 클릭 = `isTrusted: true`라 호환성이 가장 좋음). 커서가 잡은 요소 밖이면 원래 이벤트를 막고 대신 누른다. `<select>`는 이용자의 실제 키 입력(스페이스바 keydown 처리 중)에서 `showPicker()`로 연다 [ASSUMED: HTMLSelectElement.showPicker는 일시적 사용자 활성화가 필요 — Plan 01-12 스파이크로 확인].
**When to use:** 자석 커서·번호표·머무르기.
**Trade-offs:** 머무르기 클릭은 사용자 활성화가 없어 새 창·파일 선택 창·선택 목록이 막힐 수 있다 → 이것을 연습 사이트 스파이크로 기록한다(D-13). 키·클릭 처리 중의 대신 누르기는 같은 작업 안이라 활성화가 남아 새 창이 열릴 가능성이 높다 [ASSUMED — 스파이크로 확인].

### Pattern 4: 단일 저장자 + 형식 버전
**What:** 팝업·content script는 `{type: 'storage/request', op}`만 보낸다. SW의 `storage-writer.ts`가 Promise 줄로 순서대로 `chrome.storage.sync/local`에 쓴다(D-24). 모든 값은 `{schemaVersion, data}`. 읽을 때 `migrate(raw)`가 zod로 검사하고, 옛 버전이면 변환을 차례로 적용한다. 검사·변환이 실패하면 **아무것도 쓰지 않고**(원본 보존) 메모리에서는 기본값으로 돌며 `storage.local`의 `notice:migration-failed`에 알림을 남기고 팝업·모드 표시로 알린다(D-25).
**키 나누기:** `settings`(전역: 켜짐, 키 배치, 떨림 간격, 잡는 범위, 머무르기, 위험 단어, 끌기 두 번 누르기) · `site:<origin>`(사이트별 끄기, 고정 번호) — 한 항목 8KB 미만, 쓰기는 모아서(분당 한도 `MAX_WRITE_OPERATIONS_PER_MINUTE` 120 [ASSUMED: chrome.storage.sync 할당량 — PITFALLS.md]). 자주 누른 기록은 `storage.local`의 `presses:<origin>`.

### Pattern 5: 오버레이 = Shadow DOM(open) + 토큰만 + 확대 역보정
**What:** 프레임마다 호스트 하나(`<tremor-helper-root>`, `position: fixed; inset: 0; pointer-events: none; z-index: 2147483647`), 안에 `docs/design/tokens.css`의 `:host` 변수만 쓰는 스타일. 사이트 CSS를 받지도 주지도 않는다(`all: initial` on host). 크기는 페이지 확대와 무관하게 고정: SW가 `chrome.tabs.getZoom(tabId)`·`tabs.onZoomChange`로 확대 비율을 content script에 알리고, 오버레이 루트에 `zoom: 1/비율`(또는 `transform: scale`)을 건다(D-26) [ASSUMED — DOM 감사에서 확대 110%·200%로 실측].
**Open vs closed:** SYSTEM.md는 "Shadow DOM 안"만 정하고 모드는 정하지 않았다. **open**으로 한다: 독립 DOM 감사(CLAUDE.md)가 Playwright로 오버레이의 계산된 스타일을 실측해야 하기 때문. 페이지가 오버레이를 읽거나 지울 수 있는 위험은 위협 모델에서 accept(오버레이에는 페이지에 이미 있는 글자·번호만 있고, 누르기·확인은 isolated world의 isTrusted 키 처리로만 일어나 DOM 조작으로 위조할 수 없음).
**서체:** Shadow DOM 안의 `@font-face`는 크롬에서 적용되지 않으므로 [ASSUMED], `FontFace` API로 문서 `document.fonts`에 'IBM Plex Sans KR' 400·700을 등록하고 woff2 파일은 `web_accessible_resources`로 연다. 실패하면 `'Malgun Gothic', sans-serif`(SYSTEM.md 대체).

### Pattern 6: 옛 도우미 자기 정리 (D-22)
**What:** content script는 시작 때 `chrome.runtime.connect({name: 'alive'})` 포트를 연다. 확장이 업데이트·재적재되면 옛 content script의 포트에 `onDisconnect`가 오고 `chrome.runtime.id`가 `undefined`가 된다 → 등록한 모든 리스너를 `AbortController.abort()`로 한 번에 떼고 호스트 요소를 지운다. SW의 `runtime.onInstalled`는 `chrome.tabs.query({})` 후 각 탭 모든 프레임에 `chrome.scripting.executeScript({target: {tabId, allFrames: true}, files: [content script 출력 경로]})`로 새 도우미를 넣는다(권한 `scripting`) [ASSUMED — e2e에서 `chrome.runtime.reload()`로 확인].

### Anti-Patterns to Avoid
- **프레임마다 번호표 그리기:** 번호 중복·겹침 → Pattern 2.
- **pointermove마다 전체 요소 거리 계산:** 60Hz 제한(rAF로 마지막 좌표만) + 격자.
- **MutationObserver 콜백마다 재수집:** 콜백은 "더러움" 표시만, 다음 rAF/idle에 한 번 수집.
- **`getBoundingClientRect` 읽기·쓰기 섞기:** 수집 때 읽기만 묶어서, 그리기는 transform만.
- **content script가 `chrome.storage`에 직접 쓰기:** 단일 저장자 위반(D-24).
- **isTrusted 아닌 입력에 반응:** 사이트가 가짜 Enter로 확인 화면을 넘길 수 있다(D-09).
- **CDP/debugger 입력:** 설계 금지(D-13).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| manifest·진입점·zip·재적재 | 직접 빌드 스크립트 | WXT | MV3 진입점·manifest 생성이 까다롭다 |
| 저장 값 검사·변환 | 손으로 쓴 타입 가드 | zod 스키마 | 다른 PC·옛 버전 값은 외부 입력 |
| 확장 로드 브라우저 시험 | 퍼핏티어 스크립트 | @playwright/test `launchPersistentContext` | SW 접근·trusted 입력(`page.mouse`/`page.keyboard`는 CDP 입력이라 isTrusted=true) |

**Key insight:** 격자 색인·히스테리시스·필터는 작고 설계가 직접 정했으므로 직접 만든다(단위 시험으로 고정). 도구 체인만 라이브러리에 맡긴다.

## Common Pitfalls

### Pitfall 1: 사이트가 대신 누른 클릭을 무시한다
**What goes wrong:** `isTrusted=false` 클릭을 무시하는 위젯. **How to avoid:** 커서가 요소 위면 진짜 클릭 통과(Pattern 3), 전체 이벤트 순서 보내기, 연습 사이트에 "isTrusted 검사 버튼"을 두어 스파이크 결과를 기록(D-14). 회사 시스템 확인은 Phase 2. **Warning signs:** 강조는 되는데 반응 없음.

### Pitfall 2: 필터가 정상 입력을 먹는다
**How to avoid:** 간격·잡는 범위·머무르기 시간을 전부 설정값으로(Phase 2에서 이용자와 맞춤). 경계값 단위 시험(간격 −1ms / +1ms).

### Pitfall 3: 확인 화면을 떨림이 통과한다
**How to avoid:** 확인 카드가 뜬 시점부터 1초 동안 모든 키·클릭을 삼킨다(모든 프레임에 "모달 열림" 방송), 확인은 Enter 또는 스페이스바 1초 누르기, 방금 누른 스페이스바는 확인이 아니다(D-19).

### Pitfall 4: iframe 좌표·번호 꼬임
**How to avoid:** Pattern 2 + 연습 사이트에 중첩 iframe과 다른 출처 iframe(`localhost` ↔ `127.0.0.1`)을 둔다.

### Pitfall 5: 확대하면 번호표가 커진다/작아진다
**How to avoid:** Pattern 5 역보정, DOM 감사에서 확대 비율 바꿔 실측.

### Pitfall 6: 50ms 측정이 거짓으로 통과한다
**What goes wrong:** 테두리 이동 애니메이션(80ms) 끝을 재거나, 가짜(untrusted) 마우스 이벤트로 재면 실제와 다르다. **How to avoid:** `page.mouse.move`(trusted)로 옮기고, 페이지 쪽 capture 리스너의 `event.timeStamp`부터 오버레이 테두리의 목표 위치 스타일이 바뀐 시점(MutationObserver, 같은 `performance.now()` 시간축)까지를 잰다. 30회 이상 옮겨 p95 < 50ms.

## Code Examples

코드는 실행자가 쓴다. 여기서는 확인이 필요한 API 모양만 적는다.

- WXT content script 정의: `export default defineContentScript({ matches: ['<all_urls>'], allFrames: true, runAt: 'document_start', main(ctx) {…} })` [ASSUMED: WXT 문서 — Plan 01-01에서 `wxt build` 결과 `manifest.json`의 `content_scripts[0].all_frames === true`, `run_at === "document_start"`로 확인]
- Playwright 확장 로드: `chromium.launchPersistentContext('', { channel: 'chromium', args: ['--disable-extensions-except=' + ext, '--load-extension=' + ext] })`, SW는 `context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')` [CITED: playwright.dev/docs/chrome-extensions]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MV2 background page(항상 살아 있음) | MV3 service worker(언제든 잠듦) | Chrome MV3 | 상태는 저장소에, 메모리 상태 금지 |
| 구 headless 는 확장 불가 | `channel: 'chromium'` 새 headless에서 확장 로드 | Playwright 1.4x+ | CI에서 headless로 확장 e2e 가능 [CITED: playwright.dev/docs/chrome-extensions] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | document_start content script의 window capture 리스너가 사이트 단축키보다 먼저 불린다 | Pattern 1 | KEY-02 실패 → 사이트 단축키 페이지 e2e가 잡는다 |
| A2 | `chrome.runtime.getFrameId(iframeEl)`로 자식 frameId를 얻는다(Chrome 106+) | Pattern 2 | 번호 통합 실패 → 중첩·다른 출처 iframe e2e가 잡는다 |
| A3 | 키·클릭 처리 중 대신 누르기는 사용자 활성화가 남아 새 창이 열리고, 머무르기는 막힌다 | Pattern 3 | 스파이크 결과로 기록만(Phase 1 목표는 "막히는지 확인") |
| A4 | Shadow DOM 안 `@font-face`는 적용되지 않아 `document.fonts`에 등록해야 한다 | Pattern 5 | 서체가 대체 서체로 보임 → DOM 감사가 `font-family` 실측 |
| A5 | `chrome.tabs.getZoom`/`onZoomChange`로 확대 역보정이 된다 | Pattern 5 | 크기 고정 실패 → DOM 감사가 잡는다 |
| A6 | `chrome.storage.sync` 분당 쓰기 120회 한도 | Pattern 4 | 쓰기 실패 → 쓰기를 모으므로 영향 작음 |
| A7 | WXT `defineContentScript`의 `allFrames`/`runAt` 옵션 이름 | Code Examples | 빌드 manifest 검사가 잡는다 |
| A8 | 확장 재적재 뒤 옛 content script에서 `runtime.id`가 undefined, 포트 onDisconnect | Pattern 6 | 옛 도우미가 키를 가로챔 → e2e(`runtime.reload`)가 잡는다 |

## Open Questions (RESOLVED)

1. **번호표를 켜는 단축키 기본값** — RESOLVED: 설계 키 표에 없어 Claude 재량(CONTEXT). 기본값 `F`(Vimium 관례, 참고 제품), 설정 `keymap.toggleHints`로 바꿀 수 있게 둔다. 입력 중 모드에서는 글자로 들어간다. Phase 2 이용자 시험에서 조정.
2. **끌어서 놓기 두 번 누르기를 켜는 자리** — RESOLVED: 명령판이 Phase 3이므로 팝업의 설정 스위치("끌어서 놓기를 두 번 누르기로", 기본 꺼짐). 켜면 `draggable="true"` 요소를 누를 때 끌기 시작, 다음 누름이 놓을 곳.
3. **Shadow DOM open/closed** — RESOLVED: open(Pattern 5 이유, 위협 모델 accept).
4. **떨림 필터가 입력칸 안의 타이핑에도 적용되나** — RESOLVED: 적용한다. 설계 5장 "떨림 걸러내기 (키보드·마우스 공통)"이고 입력 필터가 모든 입력을 가장 먼저 받는다(D-06). 입력칸에서는 필터를 통과한 키를 원래대로 둔다(D-16).
5. **초기 기본값(떨림 간격·잡는 범위·머무르기)** — RESOLVED: 설정 가능한 값으로 두고 초깃값은 `tremorIntervalMs: 300`, `captureMarginPx: 48`, `switchHysteresisPx: 24`, `dwellMs: 800`(설계 6.4 예시 0.8초). Phase 2 이용자 시험에서 맞춘다.
6. **"도울 수 없음"을 아이콘에 어떻게** — RESOLVED: `chrome.action.setTitle({tabId, title: '도울 수 없음'})` + 배지 글자 `없음`(배지 배경 `--muted` #4A5568) + 팝업 본문 "도울 수 없음"(SYSTEM.md 상태 표 "아이콘에 '도울 수 없음'"). 판정: URL이 `http:`/`https:`/`file:`가 아니거나 웹스토어 주소(`chromewebstore.google.com`, `chrome.google.com/webstore`)이거나, content script ping에 답이 없음.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 빌드·시험 | ✓ | 22.22.2 | — (WXT engines `node >=22` 충족) |
| pnpm | 패키지 | ✓ | 10.33.0 | — |
| Playwright Chromium 바이너리 | e2e | ✗(미설치) | — | 승인 뒤 `pnpm exec playwright install chromium`(프록시 경유 네트워크) |
| npm 레지스트리 | 설치 | ✓(프록시 경유 `npm view` 성공) | — | — |

**Missing dependencies with no fallback:** 없음(설치 가능)
**Missing dependencies with fallback:** Playwright 브라우저 — 승인 뒤 설치

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 인증 없음 |
| V3 Session Management | no | — |
| V4 Access Control | yes(확장 내부) | 확장 메시지는 `sender.id === chrome.runtime.id` 확인, 외부 연결(`externally_connectable`) 없음 |
| V5 Input Validation | yes | 저장소 값은 zod로 검사(D-25), 메시지는 판별 유니온 + 런타임 검사, 페이지 이벤트는 `isTrusted`만(D-09) |
| V6 Cryptography | no | 저장 값 암호화 없음(민감칸은 Phase 3) |
| V14 Configuration | yes | 최소 권한: `storage`, `scripting`, `tabs`(URL 판정·확대), host `<all_urls>`. `debugger`·`contentSettings`·`webNavigation` 없음 |

### Known Threat Patterns for MV3 content script

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 사이트가 가짜 키 이벤트로 확인 화면 통과 | Spoofing | `event.isTrusted`가 아니면 무시(D-09) |
| 사이트가 `window.postMessage`로 도우미 메시지 흉내 | Spoofing | 도우미 부분끼리는 `chrome.runtime` 메시지만, `postMessage` 수신 안 함(D-09) |
| 사이트가 오버레이 DOM 조작(open shadow) | Tampering | 누르기·확인은 isolated world 키 처리로만 → accept(위협 모델) |
| 설치 공급망(npm) | Tampering | 버전 고정 + `pnpm-lock.yaml` + 설치 전 사람 확인(Legitimacy Audit) |
| 옛 도우미가 키를 계속 가로챔 | Denial of Service | 자기 정리(Pattern 6) |
| 저장소 오염(다른 PC·옛 버전) | Tampering | zod 검사·실패 시 원본 보존(D-25) |

## Sources

### Primary (HIGH confidence)
- 설계 문서 4·5·6·7·8·9·10·11장, GSTACK REVIEW REPORT
- `npm view` (2026-09-23): wxt, vite, typescript, typescript-eslint(peer typescript `<6.1.0`), zod, vitest, happy-dom, @playwright/test, eslint, @fontsource/ibm-plex-sans-kr(OFL-1.1), wxt peerDependencies/peerDependenciesMeta
- `gsd_run query package-legitimacy check` (2026-09-23)
- `docs/design/SYSTEM.md`, `docs/design/tokens.css`

### Secondary (MEDIUM confidence)
- playwright.dev/docs/chrome-extensions — 확장 로드·SW 접근·`channel: 'chromium'`
- `.planning/research/STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md`

### Tertiary (LOW confidence)
- Chrome API 세부(getFrameId 버전, showPicker 활성화 조건, 재적재 뒤 runtime.id) — 학습 지식, 계획의 e2e로 확인

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 버전·peer 범위를 레지스트리에서 확인(TS 6.0.3 고정 근거 포함)
- Architecture: MEDIUM-HIGH — 설계가 결정, 세부 API는 e2e로 확인
- Pitfalls: MEDIUM

**Research date:** 2026-09-23
**Valid until:** 2026-10-07 (도구 버전이 빠르게 바뀜)
