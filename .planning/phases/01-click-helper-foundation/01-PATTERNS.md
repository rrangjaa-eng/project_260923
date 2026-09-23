# Phase 1: 클릭 도우미 기반 - Pattern Map

**Mapped:** 2026-09-23
**Files analyzed:** Phase 1 계획이 만드는 새 파일 전부(RESEARCH.md "Recommended Project Structure")
**Analogs found:** 0 / 전부

## File Classification

이 저장소에는 응용 코드가 없다(greenfield). 확인: `git ls-files`의 추적 파일은 `.claude/`·`.planning/`·`docs/` 아래 문서와 `CLAUDE.md`, `.gitignore`, `scripts/*.sh`뿐이고 `.ts/.tsx/.js/.mjs` 파일과 `package.json`이 없다. 따라서 모든 새 파일은 "No Analog Found"이며, 계획은 RESEARCH.md의 패턴을 기준으로 삼는다.

| New File (group) | Role | Data Flow | Closest Analog | Match Quality |
|------------------|------|-----------|----------------|---------------|
| `package.json`, `tsconfig.json`, `wxt.config.ts`, `eslint.config.js`, `vitest.config.ts`, `playwright.config.ts` | config | — | none | no analog |
| `src/entrypoints/background.ts`, `src/worker/*` | service worker | event-driven, request-response | none | no analog |
| `src/entrypoints/content.ts`, `src/page/**` | content script | event-driven | none | no analog |
| `src/entrypoints/popup/*` | extension page | request-response | none | no analog |
| `src/core/*` | pure logic | transform | none | no analog |
| `src/shared/messages.ts` | contract | — | none | no analog |
| `tests/practice-site/*` | test fixture | static | none | no analog |
| `tests/unit/*`, `tests/e2e/*` | tests | — | none | no analog |

## Pattern Assignments

없음(분석 대상 코드 없음).

## Shared Patterns

코드 analog가 없으므로 공유 패턴은 문서에서 온다. 모든 계획이 따른다.

### 디자인 토큰
**Source:** `docs/design/tokens.css` (`:host` 변수), `docs/design/SYSTEM.md`
**Apply to:** `src/page/overlay/*`, `src/entrypoints/popup/*`
오버레이·팝업 스타일은 tokens.css의 변수만 쓴다. 새 색·서체·radius·그림자를 만들지 않는다. 값을 복제하지 않고 tokens.css를 가져온다.

### 메시지 규약
**Source:** RESEARCH.md Pattern 2·4, `src/shared/messages.ts`(Plan 01-01이 만듦)
**Apply to:** content script·SW·팝업 사이의 모든 통신
판별 유니온 `type` 필드, `sender.id === chrome.runtime.id` 확인, `window.postMessage` 사용 금지.

### 단일 저장자
**Source:** RESEARCH.md Pattern 4, `src/worker/storage-writer.ts`(Plan 01-01이 만듦)
**Apply to:** 저장이 필요한 모든 계획
content script·팝업은 `storage/request`만 보낸다. `chrome.storage.*.set`은 `storage-writer.ts`에만 있다.

### 입력 파이프라인
**Source:** RESEARCH.md Pattern 1, `src/page/input/pipeline.ts`(Plan 01-02가 만듦)
**Apply to:** 키·포인터를 다루는 모든 계획
새 리스너를 따로 달지 않고 파이프라인에 처리기를 등록한다(isTrusted·떨림 필터·모드 판정을 한 번만 거치게).

## No Analog Found

위 표의 모든 파일. 계획은 RESEARCH.md "Architecture Patterns"·"Code Examples"·"Recommended Project Structure"를 참고 기준으로 쓴다.

## Metadata

**Analog search scope:** 저장소 전체(`git ls-files`)
**Pattern extraction date:** 2026-09-23
