# Stack Research

**Domain:** 접근성 보조용 Chromium MV3 브라우저 확장 (크롬·엣지·웨일, 윈도우)
**Researched:** 2026-09-23
**Confidence:** MEDIUM (버전은 npm 레지스트리에서 직접 확인 — HIGH. 웨일 동기화 동작은 확인 못 함 — LOW)

> 이 문서는 추천이다. 새 의존성은 저장소 규칙대로 "이유 한 줄 + 승인" 뒤에 들인다. 이 조사 단계에서는 아무것도 설치하지 않았다.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| WXT | 0.21.4 (npm, 2026-08) | MV3 확장 빌드 프레임워크(Vite 기반) | manifest 생성, `all_frames`·`world: "MAIN"` content script, Shadow DOM UI(`createShadowRootUi`), 크롬/엣지 zip, 개발 중 HMR·자동 재적재를 한 번에 준다. 설계가 "빌드 도구는 구현 계획에서 정한다"고 열어 둔 자리에 가장 손이 덜 가는 선택 |
| TypeScript | 6.x 최신(보수) 또는 7.0.2(latest) | 언어, strict | 저장소 규칙: strict·`any` 금지. 7.0은 네이티브 컴파일러로 바뀐 첫 메이저라 도구(WXT peer `>=5.4`, ESLint 타입 규칙) 호환을 Phase 1 착수 때 확인한다. 막히면 6.x로 고정 |
| Vite | 8.3.0 | WXT 내부 번들러 | WXT peer `^6.3.4 \|\| ^7 \|\| ^8`. 직접 설정할 일은 적다 |
| pnpm | 10.33 (환경에 설치됨) | 패키지 매니저 | 저장소 규칙: pnpm만 |
| Node.js | 22.x (환경 22.22) | 빌드·시험 실행 | WXT engines `node >=22` |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Preact | 10.29.8 | 오버레이 UI(명령판, 카드, 확인 화면, 양식 한 장 보기, 작업판) | 약 4KB. 모든 페이지·모든 프레임에 들어가므로 React보다 가볍게. 자석 커서 강조 같은 "매 프레임" 경로는 프레임워크 없이 DOM 하나를 직접 움직인다 |
| zod | 4.6.5 | 저장 데이터 형식 검사·버전 변환, 틀 파일 가져오기 검사, AI 답 검사 | 가져온 파일·저장소·AI 답은 모두 외부 입력으로 보고 검사한다 |
| flatbush | 4.6.2 | 요소 위치 공간 색인(격자 대안) | 5,000개 요소에서 "커서에 가장 가까운 요소" 찾기를 50ms 안에. 정적 R-tree라 화면 변화 때 통째로 다시 만든다(모아서 갱신과 잘 맞음). 단순 격자로 충분하면 들이지 않는다 |
| @anthropic-ai/sdk | 0.128.0 | 화면 정리(AI) 호출 | 저장소 규칙상 SDK 우선. service worker에서 `dangerouslyAllowBrowser: true`로 호출. 모델은 `claude-haiku-4-5`(입력 $1 / 출력 $5 per 1M, 가장 작고 저렴) |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest 5.0.1 + happy-dom 20.x | 단위 시험(떨림 필터, 히스테리시스, 번호표 우선순위, 요소 찾기 점수, 민감칸·위험 버튼 판별, 형식 변환, AI 답 검사) | 순수 함수로 떼어 내면 DOM 없이도 대부분 시험된다 |
| @playwright/test 1.63.0 | 확장을 띄운 브라우저 시험 | `chromium.launchPersistentContext` + `--load-extension`. MV3 service worker는 `context.serviceWorkers()`로 잡고, 강제 종료로 "잠들었다 깨기"를 재현 |
| 로컬 연습 사이트 | 모든 기능 시험 대상 | 설계 10장 목록(작은 버튼, 긴 양식, 늦게 뜨는 칸, iframe 양식, alert/confirm, 위험 버튼, 5,000요소 페이지 등). 정적 HTML로 저장소 안에 둔다 |
| ESLint 10 + typescript-eslint | 린트 | `no-explicit-any` error |

## Installation

```bash
# 승인 후에만 실행한다 (이번 단계에서는 실행하지 않음)
pnpm dlx wxt@latest init   # 또는 수동 구성
pnpm add preact zod
pnpm add -D typescript vitest happy-dom @playwright/test eslint typescript-eslint
# 필요해질 때: pnpm add flatbush @anthropic-ai/sdk
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| WXT | @crxjs/vite-plugin 2.7.1 | Vite 설정을 직접 쥐고 싶을 때. 다만 main world 스크립트·Shadow DOM UI·zip을 손으로 만들어야 한다 |
| WXT | 손으로 짠 esbuild 스크립트 | 의존성을 최소화해야 할 때. 개발 중 재적재가 불편하다 |
| Preact | 순수 DOM + 작은 헬퍼 | 오버레이가 몇 개 안 되면. 명령판·양식 한 장 보기·작업판까지 가면 컴포넌트가 낫다 |
| Preact | Svelte 5 | 팀이 Svelte에 익숙하면. 컴파일 결과는 작지만 도구가 하나 더 붙는다 |
| @anthropic-ai/sdk | `fetch` 직접 호출 | 번들 크기가 문제일 때만. 저장소 규칙은 SDK 우선 |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| webextension-polyfill | 크로미움 전용이라 필요 없고 2024년 이후 갱신이 없다 | `chrome.*` 직접(WXT의 `browser` 래퍼도 가능) |
| React + 대형 UI 키트 | 모든 페이지·모든 프레임에 주입되므로 무게와 CSS 충돌이 크다 | Preact + Shadow DOM 안의 자체 CSS |
| 페이지 CSS에 섞이는 전역 스타일 | 회사 시스템 CSS와 서로 깨진다 | Shadow DOM(closed) 안에만 스타일 |
| `chrome.storage.sync`에 틀·기록 저장 | 전체 약 100KB, 항목당 8KB, 쓰기 분당 120회 제한 | 틀·기록은 `storage.local` + 파일 내보내기(설계 7장 그대로) |
| content script에서 `setTimeout` 기반 뒤쪽 탭 실행기 | 숨은 탭 타이머는 최소 1초, 5분 뒤 분당 1회로 느려진다 | 실행 조정은 service worker + 메시지, 단계 진행은 DOM 이벤트·MutationObserver로 |
| `requestAnimationFrame`에 틀 실행 의존 | 숨은 탭에서 rAF가 멈춘다 | rAF는 화면 그리기(강조)에만 |
| AI 결과로 직접 클릭 | 설계 금지(AI는 번호만) | 번호표 붙이기만 |

## Stack Patterns by Variant

**사이트가 확장이 만든 클릭(`isTrusted=false`)을 거부하면 (설계 11장 ①):**
- 1차: 사용자 이벤트의 좌표는 바꿀 수 없으므로, 원래 클릭을 막고 잡은 요소에 `element.click()`/`dispatchEvent`를 보낸다(대부분의 사이트는 이것으로 충분)
- 2차 예비: `chrome.debugger` + CDP `Input.dispatchMouseEvent`는 `isTrusted=true` 입력을 만든다. 단 브라우저 상단에 "디버깅 중" 띠가 뜨고 `debugger` 권한이 필요하다. Phase 1 스파이크에서 회사 시스템이 거부하는지 먼저 본다

**웨일에서 설치·동기화:**
- 웨일은 크롬 웹스토어 설치를 지원한다. `chrome.storage.sync`가 웨일 계정으로 동기화되는지는 확인하지 못했다(LOW) → 설정 파일 내보내기·가져오기를 처음부터 넣는다(설계 7장과 같음)

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| wxt@0.21.4 | vite ^6.3.4 \|\| ^7 \|\| ^8, typescript >=5.4, node >=22 | npm peerDependencies로 확인 |
| vitest@5.0.1 | vite ^6.4 \|\| ^7 \|\| ^8, happy-dom/jsdom | npm peerDependencies로 확인 |
| typescript@7.0.2 | 네이티브 컴파일러 첫 메이저 | ESLint 타입 인식 규칙·WXT 타입 생성과의 호환은 Phase 1에서 확인(MEDIUM) |
| `world: "MAIN"` content script | Chrome 111+ | alert/confirm 가로채기에 사용 |
| `chrome.storage.session` | Chrome 102+ | 기본 접근은 확장 페이지·service worker만. content script가 읽으려면 `setAccessLevel` 필요 |

## Sources

- npm 레지스트리(`npm view`, 2026-09-23): wxt, @crxjs/vite-plugin, vite, typescript, vitest, @playwright/test, preact, zod, flatbush, @anthropic-ai/sdk 버전·peer — HIGH
- claude-api 스킬 모델 표(2026-06 캐시): `claude-haiku-4-5` $1/$5 — HIGH
- [Rollback a published Chrome Web Store item](https://developer.chrome.com/docs/webstore/rollback) — 웹스토어 롤백 존재 — HIGH
- [Update your Chrome Web Store item](https://developer.chrome.com/docs/webstore/update) — 지연 게시 — HIGH
- [chromium-dev: isTrusted events from content script](https://groups.google.com/a/chromium.org/g/chromium-dev/c/94t2J_Jylyw) — content script 이벤트는 isTrusted=false — MEDIUM
- 웨일의 `storage.sync` — 공개 자료를 찾지 못함 — LOW

---
*Stack research for: 손 떨림 브라우저 도우미*
*Researched: 2026-09-23*
