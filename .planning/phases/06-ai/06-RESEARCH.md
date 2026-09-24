# Phase 6: 화면 정리 (AI) - Research

**Researched:** 2026-09-24
**Domain:** Chromium MV3 확장 service worker에서 Anthropic Claude API(구조화 출력)를 호출해 요소 목록에 번호를 매기는 기능. 개인정보 가림, 로컬 캐시, 월 한도, 실패 대체(fallback)가 핵심.
**Confidence:** MEDIUM — SDK·API 표면(모델 ID, 구조화 출력, 오류 코드, CORS 회피)은 이번 세션에 웹 검색으로 재확인해 HIGH. Playwright 확장 service worker 네트워크 가로채기 가능 여부, Chrome storage.local 정확한 축출 정책, 정규식 가림 규칙의 정밀도는 LOW~MEDIUM(단위 시험으로 고정 필요).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

D-01~D-30 (구조·화면 정리 동작·보내는 것과 개인정보·저장된 결과 다시 쓰기·한 달 사용 한도·AI 키·답 검사와 대체·화면·의존성·권한·시험), `.planning/phases/06-ai/06-CONTEXT.md`에서 그대로 복사:

- **D-01:** Phase 1의 구조를 그대로 쓴다: 모든 프레임에 content script, 맨 위 프레임이 모든 프레임의 요소 목록을 모아 번호를 매긴다(Phase 1 D-02·D-03). 화면 정리도 맨 위 프레임이 모은 목록(iframe 안 요소 포함)을 쓰고, 로딩·결과 표시는 맨 위 프레임의 오버레이가 맡는다. 프레임끼리의 메시지는 service worker를 거친다.
- **D-02:** 도우미는 `isTrusted` 입력에만 반응하고 입력 필터(떨림 걸러내기)가 가장 먼저 받는다. 화면 정리는 이용자가 명령판 카드를 실제로 눌렀을 때만 시작한다 — 사이트가 만든 가짜 입력으로는 AI가 불리지 않는다.
- **D-03:** 모든 저장은 service worker 하나가 순서대로 한다(단일 저장자). 새로 저장하는 데이터(화면 정리 결과, AI 사용량, AI 설정)에도 형식 버전을 붙이고, 형식 변환이 실패하면 원래 데이터를 그대로 두고 알린다.
- **D-04:** AI 창구는 service worker 안의 한 곳이다. AI 호출은 모두 이 창구를 거친다. content script·페이지는 AI를 직접 부르지 않고, 창구에 "화면 정리해 줘"를 부탁만 한다.
- **D-05:** 시작은 키를 누를 때만: 명령판 둘째 장 7번 "화면 정리(AI)" 카드(고정 자리). 페이지를 열 때나 번호표를 켤 때 저절로 AI를 부르지 않는다.
- **D-06:** 요소 수집기가 만든 요소 목록(종류, 보이는 글자, 대략의 위치)을 AI에 보내 이 화면에서 중요한 요소 9개를 고르게 하고, 고른 요소에 1~9 번호표를 붙인다.
- **D-07:** 작고 저렴한 Claude 모델을 쓴다. 프로젝트 연구가 정한 모델은 `claude-haiku-4-5`(입력 $1 / 출력 $5 per 1M). 실행할 때 모델 ID가 아직 유효한지 확인한다.
- **D-08:** AI는 번호만 붙이고 절대 직접 누르지 않는다. AI 결과로 클릭·포커스·입력 이벤트가 생기는 경로가 코드에 없어야 하고, 번호표로 누르는 것은 이용자의 키 입력뿐이다. 위험한 버튼은 AI가 골라도 Phase 1의 보호(빨간 테두리 + "정말 누를까요? Enter = 예", 확인 화면 보호)가 그대로 걸린다.
- **D-09:** AI로 보내는 것은 요소 종류·보이는 글자·대략의 위치뿐이다. 페이지 주소·제목·입력칸 값·속성 값(id·name·href 등)은 보내지 않는다. 답과 목록을 맞춰 보기 위한 요청 안 임시 번호만 더한다.
- **D-10:** 입력칸의 값은 어떤 경우에도 보내지 않는다. 요소 글자 중 이메일·전화번호·숫자 긴 줄 같은 개인정보 모양은 가려서 보낸다. 가림은 AI 창구(service worker)에서 보내기 직전에 한 번 더 해서, 어떤 경로로 온 목록도 가림을 건너뛰지 못하게 한다.
- **D-11:** 민감칸 판별은 Phase 3의 한 곳의 판별 함수를 그대로 쓴다(PRIV-01: 민감칸 값은 AI 전송 어디에도 남지 않는다).
- **D-12:** 확장 전체에서 밖으로 나가는 요청은 이 화면 정리 요청뿐이다.
- **D-13:** 보낸 요청에 입력칸 값이 없고 이메일·전화번호·긴 숫자 모양이 가려진 것을 시험으로 확인한다.
- **D-14:** 결과는 사이트 + 페이지 주소 형태로 `chrome.storage.local`에 저장하고, 같은 화면에서는 AI를 다시 부르지 않고 저장된 번호를 쓴다.
- **D-15:** 저장된 결과의 요소는 Phase 1의 요소 식별 묶음(`Fingerprint`)으로 기억하고, 다시 쓸 때 `isSameElement`로 지금 화면의 요소와 맞춘다.
- **D-16:** 이용자가 정한 한 달 사용 한도를 넘으면 AI를 부르지 않고 알린 뒤 자주 누른 순서 번호표로 대신한다. AI 사용량은 `chrome.storage.local`(이 PC만)에 둔다.
- **D-17:** AI 사용 키가 없으면 화면 정리만 꺼지고 나머지는 모두 동작한다. 키가 없을 때 화면 정리 카드를 누르면 자주 누른 순서 번호표로 대신한다.
- **D-18:** AI 키는 이 PC에만(`chrome.storage.local`) 저장하고 동기화하지 않으며, 설정 파일 내보내기에도 넣지 않는다. 키는 content script·페이지에 절대 넘기지 않는다 — 키를 읽는 코드는 service worker의 AI 창구와 키를 넣는 확장 설정 화면뿐이다. 키는 코드·커밋·시험 파일에 절대 넣지 않는다.
- **D-19:** AI 답은 검사한다: 고른 요소가 보낸 목록에 있는 것만 받아들이고, 하나라도 맞지 않으면 그 답 전체를 버리고 자주 누른 순서 번호표로 대신한다. 답 형식 검사는 zod로 한다.
- **D-20:** 대체 번호는 Phase 1의 번호 순서 그대로다: 고정 번호 → 자주 누른 요소 → 커서 근처(`orderHints`). 대체하는 경우: 키 없음, 한도 초과, 호출 실패(네트워크·오류 응답·시간 초과), 답이 목록 밖 요소를 고름, 답 형식이 틀림.
- **D-21:** AI가 실패해도 나머지 기능은 모두 정상 동작한다 — 화면 정리 실패가 번호표·자석 커서·명령판 등 다른 기능을 막거나 멈추지 않는다.
- **D-22:** 상태(SYSTEM.md 상태 표 "화면 정리(AI)"): 불러오는 중 "화면을 정리하는 중" + [Esc 취소](0.3초 안에 끝나면 표시 안 함) · 실패·한도 초과 "자주 누른 순서로 번호를 붙였어요" · 성공 = 번호표 + "AI가 고른 번호" 표시.
- **D-23:** 모든 오버레이는 `docs/design/SYSTEM.md`(안 A 등대)와 `docs/design/tokens.css`만 따른다: Shadow DOM 안, 새 색·서체·radius·그림자 금지. 카피 규칙: 질문 "…할까요?", 알림 "…했어요", 오류 "원인. 다음 행동.", 키 이름은 영어(`Enter`, `Esc`)·스페이스바만 한글.
- **D-24:** 설정 화면에 AI 키 넣기와 한 달 사용 한도 칸을 더한다. 설정 화면은 Phase 3이 만든 곳을 쓰고, SYSTEM.md에 템플릿이 없으면 DESIGN.md §4-1대로 먼저 SYSTEM.md에 템플릿을 더한 뒤 만든다.
- **D-25:** AI 호출에는 프로젝트 연구가 정한 대로 공식 `@anthropic-ai/sdk`를 쓴다(service worker에서 `dangerouslyAllowBrowser: true`). 이 패키지는 아직 승인 목록에 없으므로 새 의존성 = 이유 한 줄 + 승인 후 — 실행 첫 단계에서 승인받고, 승인 전에는 설치하지 않는다. 승인되지 않으면 `fetch` 직접 호출 + zod 검사로 간다.
- **D-26:** 새 권한은 더하지 않는 것을 기본으로 한다. `host_permissions: ['<all_urls>']`가 이미 `api.anthropic.com`을 포함한다. 새 권한이 필요해지면 새 권한이므로 만들 때 승인받는다.
- **D-27:** 단위 시험(설계 10장 명시 "AI 답 검사" 포함): 답 검사(목록 밖 요소 → 전체 버림, 형식 틀림 → 버림), 개인정보 모양 가림, 보내는 목록에 값·주소가 없음, 결과 저장 열쇠(사이트 + 페이지 주소), 한 달 사용량·한도, 저장 형식 변환.
- **D-28:** 확장을 띄운 브라우저 시험(Chromium, `CI=true`): 명령판 → 화면 정리 → 번호표 1~9, 같은 화면 다시 → AI 안 부름, 키 없음·한도 초과·호출 실패·목록 밖 답 → 자주 누른 순서 대체, AI 결과로 눌림 없음, iframe 안 요소 포함. 자동 시험은 진짜 AI를 부르지 않는다 — 가짜 AI 응답으로 대신하고, 진짜 키는 CI·저장소 어디에도 두지 않는다.
- **D-29:** 모든 기능은 로컬 연습 사이트에서 먼저 시험한다. 회사 시스템에서는 시험하지 않는다.
- **D-30:** UI 완료 판정은 저장소 규칙대로: 싼 게이트(lint·typecheck·build) → 별도 에이전트의 독립 DOM 감사(`CI=true`, 스크린샷 육안 금지) → 수정 → 전체 게이트 한 번.

### Claude's Discretion

- 한 달 사용 한도의 단위와 기본값 — 횟수 vs 금액. 기본 제안: 횟수. 사용자 확인 질문을 스레드에 올렸다.
- 저장된 AI 번호를 언제 쓰는지 — 기본 제안: "화면 정리"를 다시 누를 때만 저장된 번호를 쓴다. 사용자 확인 질문을 스레드에 올렸다.
- "페이지 주소"를 저장 열쇠로 만드는 규칙(쿼리·해시, URL 안 개인정보, iframe 회사 시스템 구분).
- 저장된 결과의 요소가 지금 화면에서 일부/전부 안 보일 때: 빈 번호를 자주 누른 순서로 채울지, 전부 안 보이면 AI를 다시 부를지.
- 고정 번호와 AI가 고른 번호가 겹칠 때 우선순위 — 기본 제안: 고정 번호가 자리를 지키고 AI가 나머지를 채운다.
- 요소가 9개 이하일 때 AI를 부를지.
- 보내는 목록의 크기 상한·글자 자르기, "대략의 위치" 표현 방법, 위험한 버튼 표시를 목록에 넣을지.
- 가릴 모양의 정확한 규칙(이메일, 한국 휴대폰·일반 전화, 숫자 긴 줄 길이 기준, 주민번호·계좌·카드 모양) — 단위 시험으로 고정한다.
- 프롬프트 문구, 구조화 출력 형식(JSON schema), `max_tokens`, 시간 초과·재시도 횟수, SDK 설정.
- Esc 취소 때 요청을 끊는 방법과 취소한 호출을 사용량에 셀지, 실패 원인별 안내 문구.
- 설정 화면에서 키를 보여 주는 방법(가려 보이기)·지우기, 한 달의 경계(이 PC 달력 기준).
- 활동 기록(Phase 4)이 있으면 화면 정리 사건(AI 사용/대체, 이유)을 입력 값 없이 남길지.
- 자동 시험에서 가짜 AI 응답을 넣는 방법(service worker 요청 가로채기, 시험 전용 주소 설정 등) — 진짜 키 없이, 제품 코드에 시험용 뒷문을 남기지 않는 쪽으로.
- 메시지 타입 이름, 파일 배치(`ai/` 창구 폴더), 저장 형식 버전 올리는 방법.

### Deferred Ideas (OUT OF SCOPE)

- AI 글 써 주기(AIX-01), AI 틀 복구(AIX-02) — 다음 버전. AI는 화면 정리 한 곳에만 쓴다.
- AI가 요소를 직접 누르기 — 하지 않는다(REQUIREMENTS Out of Scope).
- 명령판·설정 화면·민감칸 판별 자체 — Phase 3. Phase 6은 카드 하나와 설정 칸 두 개를 더할 뿐이다.
- 활동 기록 모듈 자체 — Phase 4.
- 회사 시스템에서 확인 — 회사 시스템 완성 뒤.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|--------------------|
| AI-01 | 이용자가 명령판에서 "화면 정리"를 누르면 이 화면에서 중요한 요소 9개에 1~9 번호표가 붙는다 | Architecture(System Diagram, Pattern 1·3), Code Examples(client.ts), Standard Stack |
| AI-02 | AI로 보내는 것은 요소 종류·보이는 글자·대략의 위치뿐이고, 입력칸 값은 보내지 않으며 이메일·전화번호·긴 숫자 같은 개인정보 모양은 가려진다 | Code Examples(mask.ts, request-builder.ts), Common Pitfalls, Security Domain, Validation Architecture(AI-02 행) |
| AI-03 | 같은 사이트·같은 페이지 주소에서는 저장된 결과를 다시 쓰고 AI를 다시 부르지 않는다 | Architecture(gateway.ts 1단계), Common Pitfalls 4, Assumptions A3 |
| AI-04 | 이용자가 정한 한 달 사용 한도를 넘으면 AI를 부르지 않고 알린다 | Architecture(gateway.ts 3단계), Common Pitfalls 5, Assumptions A4 |
| AI-05 | AI 사용 키가 없으면 화면 정리만 꺼지고 나머지는 모두 동작하며, 키는 이 PC에만 저장되고 동기화되지 않는다 | Architecture(gateway.ts 2단계), Security Domain, Project Constraints |
| AI-06 | AI 답이 보낸 목록에 없는 요소를 고르거나 호출이 실패하면 그 답을 버리고 자주 누른 순서 번호표로 대신하며, AI 결과로 요소가 직접 눌리는 일은 없다 | Architecture Pattern 1·2, Code Examples(response-schema.ts), Anti-Patterns, Validation Architecture |
</phase_requirements>

## Summary

Phase 6은 명령판 "화면 정리(AI)" 카드 하나로 시작해, service worker 안의 **AI 창구 한 곳**(`src/worker/ai/gateway.ts`)이 요소 목록을 받아 개인정보를 가리고, 사이트+페이지 주소 캐시와 월 사용 한도를 먼저 확인한 뒤에만 `claude-haiku-4-5`를 호출한다. 답은 zod로 검사해 "보낸 목록에 없는 id가 하나라도 있으면 답 전체를 버린다"(D-19)를 그대로 구현하고, 실패·한도 초과·키 없음·검사 실패는 모두 같은 대체 경로(`orderHints`의 고정→자주 누른 요소→커서 근처)로 귀결시킨다. AI는 번호만 매기고 절대 누르지 않는다 — 이 경로에는 클릭·포커스·입력 이벤트 디스패치 코드가 전혀 없어야 한다.

핵심 기술 확인 사항(이번 세션 웹 검색으로 재검증): `@anthropic-ai/sdk`는 2023년부터 공식 조직(`anthropics/anthropic-sdk-typescript`)이 배포하는 활성 패키지이고(npm `time.created` 2023-01-31, 최신 `0.128.0`, `2026-09-22` 갱신), peerDependency가 `zod: "^3.25.0 || ^4.0.0"`이라 저장소의 `zod@4.6.5`와 호환된다. MV3 service worker는 `host_permissions`에 `<all_urls>`가 있으면 페이지의 CORS 제약을 받지 않는다 — 그러나 SDK 자체는 "브라우저류 전역"을 감지해 안전장치를 걸므로 `dangerouslyAllowBrowser: true`가 여전히 필요할 가능성이 높다(재확인 필요, 아래 Pitfall 1). 구조화 출력(`output_config.format.type: "json_schema"`)은 응답을 `response.content[0].text`에 유효한 JSON 문자열로 담아 주지만, 배열 길이(`minItems`/`maxLength` 등) 제약은 서버가 강제하지 않으므로 **우리 zod 스키마로 직접 다시 검사**해야 한다(D-19와 정확히 일치하는 설계).

**Primary recommendation:** SDK 승인(D-25) 뒤 `src/worker/ai/` (I/O)와 `src/core/ai/` (순수 함수: 가림·프롬프트 인코딩·답 검사·캐시 열쇠)로 분리해서 만들고, 모든 "AI를 쓸 수 없음" 판정(키 없음·한도 초과·호출 실패·검사 실패·취소)을 한 가지 공통 결과 타입으로 모아 `orderHints`에 위임한다. e2e 시험은 진짜 네트워크를 타지 않고 `context.route()`로 `api.anthropic.com`을 가짜 응답으로 막는 방식을 1순위로 시도하되, MV3 service worker 자신이 만드는 요청이 기본으로 라우팅되는지는 확인되지 않았으므로(아래 Pitfall 6) 스파이크로 먼저 검증한다.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 명령판 "화면 정리" 카드·로딩/실패 오버레이 | 맨 위 프레임(content script) | — | 오버레이는 Phase 1 D-01·Pattern 2대로 맨 위 프레임 하나만 그린다 |
| 요소 목록 수집(마스킹 전 원본) | 각 프레임(content script) → 맨 위로 통합 | — | Phase 1 요소 수집기·프레임 통합을 그대로 재사용(D-01) |
| 개인정보 가림(email·전화·긴 숫자) | service worker(AI 창구, 보내기 직전) | core/ 순수 함수(가림 규칙 자체) | D-10: "어떤 경로로 온 목록도 가림을 건너뛰지 못하게" — 신뢰 경계를 SW 쪽 끝에 둔다 |
| 민감칸 판별 | Phase 3의 한 곳의 판별 함수(재사용) | — | D-11, PRIV-01 — 이 phase가 새로 만들지 않는다 |
| 월 한도·캐시 조회/저장·AI 호출·답 검사 | service worker(AI 창구, 단일 저장자와 같은 프로세스) | — | D-03, D-04 — 모든 저장은 SW 하나, AI 호출도 SW 한 곳 |
| Anthropic Messages API 호출(네트워크 I/O) | service worker(`worker/ai/client.ts`) | — | host_permissions로 CORS 우회, 키는 SW만 접근(D-18) |
| 번호 순서 결정(AI 픽 + 고정 + 대체) | core/ 순수 함수(`hint-order.ts` 확장) | — | Phase 1 D-11 순서 규칙을 깨지 않고 AI 픽을 한 단계로 끼워 넣는다 |
| AI 키 입력·월 한도 설정 화면 | 확장 설정 화면(Phase 3 산출물) | — | Phase 3 D-38 절차, 이 phase는 칸 두 개만 더한다(D-24) |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | `0.128.0`(npm, 2026-09-22 최신) [VERIFIED: npm registry `npm view @anthropic-ai/sdk version/time.created/time.modified/repository.url`, 이번 세션 실행] | `claude-haiku-4-5` 호출 | 공식 SDK, 저장소 규칙상 SDK 우선(D-25). **아직 미승인 — 실행 첫 단계에서 이유 한 줄("공식 SDK로 구조화 출력·재시도·타입을 직접 구현하지 않는다") + 승인 필요, 승인 전 설치 금지** |
| `zod` | `4.6.5`(이미 설치됨, `package.json`) [VERIFIED: package.json:20, `"zod": "4.6.5"`] | AI 답 검사, 가림 결과·캐시 스키마 | 이미 프로젝트 표준(settings-schema.ts 전체가 zod). `@anthropic-ai/sdk`의 peerDependency `zod: "^3.25.0 \|\| ^4.0.0"` [VERIFIED: npm registry `npm view @anthropic-ai/sdk peerDependencies`, 이번 세션 실행]와 호환 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (신규 없음) | — | — | 마스킹·캐시 열쇠·프롬프트 인코딩은 모두 순수 함수로 새 의존성 없이 구현 가능 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@anthropic-ai/sdk` | `fetch` 직접 호출 + zod 검사 | D-25가 이미 정한 대안: SDK 승인이 거절되면 이 경로로. `output_config` 요청 바디·헤더(`x-api-key`, `anthropic-version`)를 직접 구성해야 하므로 요청 빌더 코드가 늘지만 번들 크기는 줄어든다 |
| SDK의 `.parse()` 헬퍼(zod 자동 검증) | `client.messages.create()` 원시 호출 후 우리 zod 스키마로 직접 `safeParse` | **권장.** `.parse()`가 배열 길이 제약(`minItems` 등)을 "클라이언트에서 대신 검사"한다는 주장은 2026-06 캐시 정보로 이번 세션에 재확인하지 못했다(`[ASSUMED]`) — D-19의 "하나라도 맞지 않으면 전체를 버림" 규칙은 어차피 우리가 직접 짜야 하므로, `.parse()`에 기대지 않고 `response.content[0].text`를 `JSON.parse` 뒤 우리 zod 스키마로 검사하는 쪽이 더 적고 테스트하기 쉬운 코드다(Simplicity First) |

**Installation:**
```bash
# 승인 후에만 실행
pnpm add @anthropic-ai/sdk
```

**Version verification:** `npm view @anthropic-ai/sdk version` → `0.128.0`(2026-09-22 최신, `.planning/research/STACK.md`가 이미 이 버전을 확인했고 이번 세션도 동일하게 재확인). 실행 시점에 한 번 더 확인 권장(모델 ID도 함께, 아래 Pitfall 3).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@anthropic-ai/sdk` | npm | 3년 7개월(2023-01-31 최초 배포, 2026-09-22 최근 갱신) [VERIFIED: npm registry `npm view @anthropic-ai/sdk time.created/time.modified`] | 확인 못 함(레지스트리 다운로드 API 응답 없음, LOW) | `github.com/anthropics/anthropic-sdk-typescript` [VERIFIED: npm registry `npm view @anthropic-ai/sdk repository.url`] | OK | Approved — `gsd_run query package-legitimacy check`는 스코프 패키지명 해석 문제로 `SUS`(unknown-age/unknown-downloads/no-repository)를 반환했으나, 위 `npm view` 원시 조회로 직접 반박: 생성일·최근 갱신일·공식 저장소 URL이 모두 존재해 seam이 못 찾은 신호를 수동으로 확인했다 |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none (seam의 자동 SUS 판정은 위 수동 검증으로 해소됨 — 그래도 실행 전 체크포인트에서 사람이 한 번 더 승인)
**postinstall 스크립트:** `npm view @anthropic-ai/sdk scripts.postinstall` → 빈 값(없음) [VERIFIED: npm registry, 이번 세션 실행] — 의심 신호 없음

## Project Constraints (from CLAUDE.md)

저장소 루트 `CLAUDE.md`는 이 프로젝트(손 떨림 브라우저 도우미, WXT MV3 확장)가 아니라 다른 프로젝트(PLANT8 ERP, Next.js/Drizzle/Cloud Run)의 설명이다(`.planning/STATE.md` Blockers/Concerns에도 이미 기록됨: "저장소 루트 CLAUDE.md의 제품·스택 설명은 다른 제품 — 규칙만 적용"). Next.js 관련 지시("This is NOT the Next.js you know" 등)는 이 저장소에 적용되지 않는다. 아래는 실제로 적용되는 일반 공학 규칙만 추린 것:

| 규칙 | 이 phase에서의 의미 |
|------|---------------------|
| pnpm만 | `pnpm add @anthropic-ai/sdk`(승인 후) |
| TypeScript strict, `any` 금지 | AI 응답은 `unknown` → zod `safeParse`로 좁힌다 |
| 시크릿은 코드·커밋에 절대 금지 | AI 키는 `chrome.storage.local`에만, 시험 코드·픽스처에 진짜 키를 넣지 않는다(D-18, D-29) |
| TDD: 실패 테스트 → 최소 구현 → 리팩터 | 답 검사·가림·캐시 열쇠·한도 계산을 core/ 순수 함수로 먼저 Vitest RED로 |
| 새 의존성 = 이유 한 줄 + 승인 후 | `@anthropic-ai/sdk`(D-25가 이미 이유를 정했다: SDK 우선) — 실행 첫 작업으로 승인 확인 |
| 완료 판정은 `CI=true`로 | e2e는 `CI=true` 프로덕션 빌드로 확인(가짜 AI 응답 사용) |
| UI는 독립 DOM 감사 | 로딩 오버레이·"AI가 고른 번호" 표시·실패 문구는 별도 에이전트가 `CI=true` DOM으로 판정(D-30) |
| 한 커밋 한 의도 | AI 게이트웨이·메시지 확장·hint-order 확장·설정 화면 칸을 계획 단위로 쪼갤 근거 |

## Architecture Patterns

### System Architecture Diagram

```
[명령판 "화면 정리" 카드(맨 위 프레임, 사용자가 직접 누름 — D-05)]
        │ hints/press 아님, 새 메시지: ai/cleanup-request
        ▼
[맨 위 프레임이 이미 들고 있는 통합 요소 목록(frames/reports, Phase 1)]
   items: {id, name, kind, rect, fingerprint, danger}[]  ← 원본(가림 전)
        │ chrome.runtime.sendMessage
        ▼
┌───────────────────── service worker: src/worker/ai/gateway.ts (AI 창구, D-04 한 곳) ─────────────────────┐
│ 1. 캐시 조회 — cache-key.ts(site+page 주소) → 저장된 픽이 있으면 SDK 호출 없이 즉시 반환(AI-03)            │
│ 2. 키 있음? (chrome.storage.local) — 없으면 즉시 fallback                                                  │
│ 3. 이번 달 사용량 < 한도? (chrome.storage.local, 월 경계) — 넘으면 즉시 fallback                            │
│ 4. request-builder.ts: 요소 9개↔150개로 자르기 · 이름 60자 절단 · 9분면 위치 인코딩 · 임시 id(t1..tN) 부여   │
│ 5. mask.ts(core/ai): 보이는 글자 안 이메일·전화·긴 숫자 가림 (Phase 3 민감칸 함수는 값 자체를 이미 제외)     │
│ 6. client.ts: @anthropic-ai/sdk, model=claude-haiku-4-5, output_config json_schema, AbortSignal 연결       │
│ 7. response-schema.ts(core/ai): response.content[0].text → JSON.parse → zod safeParse                     │
│      → picks 중 하나라도 보낸 tempId 목록 밖이면 **답 전체 버림**(D-19)                                    │
│ 8. 성공 시: 캐시 저장(Fingerprint 목록) + 이번 달 사용량 +1                                                 │
│      실패/한도초과/키없음/검사실패/호출실패: fallback 사유만 반환(사용량 카운트 안 함, 취소도 안 함)         │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────┘
        │ ai/cleanup-result { kind: 'ai', tempIdOrder: string[] } | { kind: 'fallback', reason }
        ▼
[맨 위 프레임: core/hint-order.ts 확장 — pins → aiPicks(있으면) → presses → cursor]
        │
        ▼
[placeLabels + showHints(Phase 1 그대로) + "AI가 고른 번호" 표시 또는 실패 문구]
```

파일 안 화살표가 "밖으로 나가는 요청"과 겹치는 지점은 5→6뿐이다(D-12: 확장 전체에서 유일하게 밖으로 나가는 요청).

### Recommended Project Structure

`.planning/research/ARCHITECTURE.md`가 이미 `worker/ai/` 폴더를 제안했다. 여기에 "가림·답 검사·캐시 열쇠·프롬프트 인코딩은 DOM·chrome 없는 순수 함수"라는 저장소의 `core/`·`worker/` 분리 원칙(ARCHITECTURE.md "Structure Rationale")을 적용해 순수 로직은 `core/ai/`로 뺀다(Phase 1이 `core/fingerprint.ts`·`core/hint-order.ts`·`core/danger.ts`를 그렇게 뒀다):

```
src/core/ai/
├── mask.ts              # 이메일·전화·긴 숫자 가림 정규식(순수 함수, 단위 시험 대상)
├── request-builder.ts   # Item[] → 자르기·절단·위치 인코딩·임시 id 부여(순수)
├── response-schema.ts   # zod 스키마 + validate(picks, sentTempIds): 답 검사(순수)
└── cache-key.ts         # 사이트+페이지 주소 → 캐시 열쇠 문자열(순수)
src/worker/ai/
├── gateway.ts            # 메시지 수신 → 캐시/키/한도 확인 → client 호출 → 저장(단일 진입점, D-04)
├── client.ts             # @anthropic-ai/sdk 초기화·호출 래퍼(진짜 네트워크 I/O, 여기만 SDK를 import)
└── usage-store.ts        # 월 사용량 저장/조회(storage-writer.ts의 enqueue 패턴 재사용)
src/core/settings-schema.ts  # (기존 파일에 추가) AiResultV1 · AiUsageV1 스키마, aiResultKey()·aiUsageKey()
src/shared/messages.ts        # (기존 파일에 추가) 'ai/cleanup-request' · 'ai/cleanup-result' · 'ai/cleanup-cancel'
```

### Pattern 1: 단일 결과 타입으로 모든 "AI 못 씀" 사유를 좁히기

**What:** gateway.ts의 반환 타입을 `{ kind: 'ai'; tempIdOrder: string[] } | { kind: 'fallback'; reason: FallbackReason }`로 두고, `FallbackReason = 'no-key' | 'over-limit' | 'call-failed' | 'invalid-response' | 'canceled'` 하나로 통일한다.
**When to use:** gateway.ts의 모든 조기 반환 지점(1~7단계 어디서든).
**Example:**
```typescript
// src/worker/ai/gateway.ts (개념 스케치 — Phase 1 storage-writer.ts의 enqueue·Promise 패턴을 그대로 따른다)
export type CleanupResult =
  | { kind: 'ai'; tempIdOrder: string[] }
  | { kind: 'fallback'; reason: 'no-key' | 'over-limit' | 'call-failed' | 'invalid-response' | 'canceled' };
```
D-20이 "대체하는 경우"를 5가지로 열거했으므로(키 없음·한도 초과·호출 실패·목록 밖 요소·형식 틀림 — 마지막 둘은 `invalid-response` 하나로 합쳐도 D-19 규칙(전체 버림)을 그대로 만족한다) 이 유니온이 그 5가지 + 취소를 정확히 덮는다.

### Pattern 2: 답 검사는 "전체 버림"이지 "부분 필터"가 아니다

**What:** D-19 "하나라도 맞지 않으면 그 답 전체를 버리고"는 잘못된 id만 걸러내고 나머지는 살리는 일반적인 "느슨한 검증" 패턴과 다르다.
**When to use:** `core/ai/response-schema.ts`의 validate 함수.
**Example:**
```typescript
// src/core/ai/response-schema.ts
import { z } from 'zod';

const AiResponseSchema = z.object({
  picks: z.array(z.string()).max(9),
});

export function validateAiResponse(raw: unknown, sentTempIds: readonly string[]): string[] | null {
  const parsed = AiResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return null; // 형식 틀림 — 전체 버림
  }
  const sentSet = new Set(sentTempIds);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of parsed.data.picks) {
    if (!sentSet.has(id)) {
      return null; // 목록 밖 요소가 하나라도 있으면 전체 버림(D-19) — 그 id만 빼지 않는다
    }
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id); // 중복 id는 첫 등장만(API가 uniqueItems를 강제하지 않으므로 여기서 중복 제거)
    }
  }
  return ordered;
}
```
이 함수가 `null`을 반환하는 모든 경로는 gateway.ts에서 `{ kind: 'fallback', reason: 'invalid-response' }`로 이어진다.

### Pattern 3: hint-order.ts에 AI 픽을 새 우선순위 단계로 끼워 넣기

**What:** Phase 1 `orderHints`(고정 → 자주 누른 요소 → 커서 근처)에 "AI 픽"을 고정과 자주 누른 요소 사이에 끼운다(CONTEXT.md discretion 기본 제안: "이용자가 고정한 번호가 그 자리를 지키고 AI 고른 요소가 나머지 번호를 채운다").
**When to use:** `orderHints` 호출부(맨 위 프레임 content script)가 AI 결과를 받은 직후.
**Example:**
```typescript
// src/core/hint-order.ts — 기존 orderHints 시그니처에 선택 인자 추가(하위 호환 유지)
export function orderHints(opts: {
  items: HintItem[];
  pins: Pin[];
  presses: PressCount[];
  cursor: { x: number; y: number };
  aiPicks?: Fingerprint[]; // 신규: tempIdOrder → Fingerprint로 변환해 전달(캐시 재사용 시에도 같은 타입)
}): HintEntry[][] {
  // ... 기존 pins 처리 뒤,
  // presses 큐를 만들기 전에: aiPicks를 순서대로 순회하며 isSameElement로 매칭되는
  // 첫 미사용 item을 usedItemIds에 추가하고 pinnedByNumber 다음 빈 번호부터 채운다.
  // (queue 필터링에서 aiPicks로 채워진 id도 제외해야 presses 단계에서 중복 배정되지 않는다)
}
```
**주의:** 이 변경은 Phase 1 파일을 건드리므로 기존 단위 시험(순서 규칙)이 깨지지 않는지 회귀 시험이 필요하다 — `aiPicks` 생략 시 기존 동작과 100% 동일해야 한다(옵션 인자, 기본값 없음 처리).

### Anti-Patterns to Avoid

- **AI 응답으로 직접 클릭·포커스·입력 디스패치:** 설계·요구사항이 명시적으로 금지(AI-06, D-08). `ai/cleanup-result` 메시지 핸들러 어디에도 `element.click()`/`dispatchEvent` 호출이 있으면 안 된다 — 코드 리뷰 체크리스트 항목으로 명시할 것.
- **가림을 content script에서만 하고 SW에서 생략:** D-10이 "SW에서 보내기 직전에 한 번 더" 가림을 요구한 이유는 content script가 조작되거나 새 경로가 생겨도 마지막 방어선이 있어야 하기 때문. `client.ts`가 `mask.ts`를 거치지 않은 텍스트를 SDK에 넘기는 코드 경로를 만들지 않는다.
- **`.parse()` SDK 헬퍼에 배열 길이·중복 검증을 위임:** 위 Alternatives Considered 참고 — 우리 zod 스키마로 직접 검사한다.
- **오류를 하나의 `catch`로 뭉뚱그려 실패 사유를 잃는 것:** D-20이 사유별 문구를 요구하므로(discretion: "실패 원인별 안내 문구") SDK 타입 오류(`Anthropic.AuthenticationError` 등)를 매핑해 최소 "키 문제/연결 문제/한도 문제"로는 구분한다.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON 스키마 강제 출력 | 프롬프트로 "JSON만 답해"를 부탁하고 정규식으로 추출 | `output_config.format: {type:'json_schema', schema}` | Haiku 4.5가 서버 단에서 스키마를 강제한다 — 파싱 실패 자체가 크게 준다 [CITED: platform.claude.com/docs/en/build-with-claude/structured-outputs] |
| 재시도·타임아웃 | 직접 `setTimeout`+재시도 루프 | SDK 기본값(`maxRetries: 2`, 429/5xx/네트워크 오류만 재시도) [CITED: github.com/anthropics/anthropic-sdk-typescript README] | 오류 코드별 재시도 가능 여부(STACK.md·claude-api 스킬)를 SDK가 이미 구현했다 |
| 오류 분류 | 응답 상태코드를 직접 switch | SDK 타입 오류 클래스(`Anthropic.AuthenticationError`, `RateLimitError`, `APIError` 등) | 타입 좁히기로 `any` 없이 처리 가능(CLAUDE.md `any` 금지) |
| 답 검사 | 손으로 JSON 파싱 후 필드별 if | zod `safeParse`(D-19가 이미 지정) | 프로젝트 전체가 zod로 저장 형식을 검사하는 기존 패턴과 통일 |

**Key insight:** 이 phase에서 "새로 발명할 것"은 사실상 없다 — 가림 정규식·9분면 위치 인코딩·캐시 열쇠 정규화만 이 프로젝트 고유의 규칙이고, 나머지는 SDK·zod·Phase 1 기존 코드의 조합이다.

## Runtime State Inventory

해당 없음 — Phase 6은 rename/refactor/migration이 아니라 신규 기능 추가(greenfield 내 확장)다.

## Common Pitfalls

### Pitfall 1: `dangerouslyAllowBrowser`가 없어도 될 거라 착각
**What goes wrong:** "MV3 SW는 host_permissions로 CORS를 우회하니 `dangerouslyAllowBrowser`가 필요 없다"고 결론 내리고 빼버리면, SDK가 실행 시점에 자신이 브라우저류 전역(예: `fetch`가 전역에 있고 Node가 아님)에서 실행 중임을 감지해 즉시 에러를 던질 수 있다.
**Why it happens:** "CORS 우회"와 "SDK의 자체 안전장치"는 서로 다른 레이어다 — CORS는 서버·브라우저 네트워크 스택의 제약, `dangerouslyAllowBrowser`는 SDK가 "브라우저에서 API 키가 노출될 수 있다"는 자체 판단으로 거는 가드다[CITED: getcoai.com/news/claudes-api-now-supports-cors-requests, simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access]. MV3 service worker(`ServiceWorkerGlobalScope`)가 이 SDK의 "브라우저 감지" 로직에 정확히 어떻게 걸리는지는 이번 세션에 SDK 소스로 직접 확인하지 못했다(`[ASSUMED]`).
**How to avoid:** D-25가 이미 `dangerouslyAllowBrowser: true`를 지정했으므로 그대로 켠다. 실행 첫 계획에서 **스파이크 task**로 실제 SW 빌드(`wxt build`, `chrome.storage`가 바인딩된 상태)에서 `new Anthropic({apiKey, dangerouslyAllowBrowser: true})` 생성 + 더미 호출 1회가 성공하는지 먼저 확인한다(가짜 키로 401을 받아도 "요청이 나갔다"는 것 자체가 확인이다).
**Warning signs:** SDK 생성자에서 즉시 throw, 또는 `fetch`가 아예 호출되지 않음.
**Phase to address:** ⑥, 계획의 첫 task로

### Pitfall 2: 구조화 출력 스키마 제약을 신뢰해서 우리 쪽 검사를 생략
**What goes wrong:** `output_config`의 JSON 스키마에 `maxItems: 9`나 `uniqueItems: true`를 넣고 "서버가 지켜줄 것"이라 믿으면, 배열 길이·중복 제약이 서버에서 강제되지 않아(`[CITED: claude-api 스킬 2026-06 캐시, 이번 세션 API 문서 검색으로는 이 세부사항을 재확인하지 못함 — ASSUMED로 하향]`) 9개 초과나 중복 id가 그대로 온다.
**How to avoid:** 스키마에는 `type`·`properties`·`additionalProperties: false`만 걸고(공식 문서가 명시적으로 요구하는 것[CITED: platform.claude.com/docs/en/build-with-claude/structured-outputs]), 길이·중복·목록 밖 id는 위 Pattern 2의 `validateAiResponse`가 전부 우리 코드에서 검사한다.
**Phase to address:** ⑥, 답 검사 단위 시험(D-27)

### Pitfall 3: 모델 ID가 바뀌었는데 하드코딩된 채 방치
**What goes wrong:** `claude-haiku-4-5`는 별칭(alias)이고 실제 스냅샷은 `claude-haiku-4-5-20251001`이다[CITED: 웹 검색, platform.claude.com/docs/en/models/haiku-4-5/overview, llm-stats.com/models/claude-haiku-4-5-20251001]. 별칭은 시간이 지나면 새 스냅샷을 가리키도록 바뀔 수 있어, 알림 없이 동작이 달라질 위험이 있다.
**How to avoid:** D-07대로 별칭(`claude-haiku-4-5`)을 쓰되, 실행 시점에 `npm view`/API 문서로 별칭이 유효한지 한 번 더 확인(D-07이 이미 요구). 비용에 민감하면 고정 스냅샷 ID로 바꾸는 것도 고려할 수 있으나 이는 Claude's Discretion 밖의 새 결정이라 사용자 확인 필요.
**Phase to address:** ⑥, 계획 착수 전 확인

### Pitfall 4: 캐시 열쇠가 "같은 화면"을 구분하지 못하거나 과하게 구분
**What goes wrong:** `origin + pathname`만 쓰면 해시 라우팅 SPA(`#/expense/123`)가 전부 같은 캐시를 공유해 다른 화면인데 옛 번호를 재사용한다. 반대로 쿼리 문자열까지 그대로 쓰면 세션 토큰·주문 ID 같은 개인정보가 캐시 열쇠(로컬 저장 값)에 그대로 남고, 매번 다른 열쇠가 되어 캐시가 사실상 무의미해진다.
**How to avoid:** `origin + pathname + hash`를 캐시 열쇠로 쓰고 쿼리 문자열은 버린다(CONTEXT.md discretion 항목과 직접 연결, `[ASSUMED]` — 사용자 확인 필요). 회사 시스템처럼 최상위 URL이 항상 같고 본문이 iframe SPA인 경우는 URL만으로 구분이 안 되므로, **캐시 재사용 여부를 요소 매칭 결과로 한 번 더 검증**한다: 저장된 9개 Fingerprint 중 `isSameElement`로 지금 화면에서 매칭되는 개수가 임계값(예: 절반) 미만이면 "낡음"으로 보고 캐시를 쓰지 않는다(discretion 항목 "전부 안 보이면 저장이 낡은 것으로 보고 AI를 다시 부를지"의 확장). **키를 누를 때만** 원칙(D-05)을 지키려면 이 재호출도 사용자가 "화면 정리"를 다시 누른 시점에만 일어나야 한다 — 자동 재호출 금지.
**Phase to address:** ⑥, 캐시 열쇠 단위 시험

### Pitfall 5: 월 한도 경계·취소 처리에서 사용량이 이중으로 세거나 새지 않음
**What goes wrong:** service worker가 요청 도중 잠들었다 깨어나거나, 사용자가 Esc로 취소한 시점과 SDK의 실제 응답 도착 시점이 겹치면 사용량을 두 번 세거나(레이스), 취소했는데도 세거나, 실패했는데 세는 문제가 생긴다.
**How to avoid:** `storage-writer.ts`의 `enqueue` 순차 큐 패턴을 그대로 재사용해 "캐시 확인 → 한도 확인 → 호출 → 성공 시 사용량 +1"을 하나의 큐 작업으로 직렬화한다(Phase 1 D-03 "단일 저장자"). 사용량 카운트는 **AI로부터 유효한 응답을 받아 검사까지 통과한 경우에만** +1(취소·실패·검사 실패는 세지 않음 — `[ASSUMED]`, CONTEXT.md discretion 항목, 사용자 확인 필요). 월 경계는 "이 PC 달력 기준"(discretion 항목) — `new Date().getFullYear()`/`getMonth()`로 로컬 타임존 사용(UTC 변환 없음).
**Phase to address:** ⑥, 사용량 단위 시험(D-27)

### Pitfall 6: e2e 시험에서 가짜 AI 응답이 실제로는 가로채지지 않음
**What goes wrong:** `tests/e2e/fixtures.ts`의 기존 `context.route('**/*', ...)`가 content script·팝업 페이지의 요청은 확실히 가로챈다(Phase 1 D-14·D-31이 이미 이 패턴으로 "밖으로 나가는 요청 없음"을 검증했다). 그러나 **MV3 확장 background service worker 자신이 만드는 `fetch()` 요청**이 기본으로 같은 방식으로 라우팅되는지는 확인되지 않았다 — Playwright는 "Service Worker가 만드는 네트워크 요청"을 가로채려면 **실험적 기능**을 켜야 한다고 문서화되어 있다(`PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1` 환경변수)[CITED: github.com/microsoft/playwright issue #15684 "(Experimental) Service Worker Network Events", playwright.dev/docs/next/service-workers-experimental]. 이 실험 기능이 "페이지를 제어하는 SW가 하는 subresource fetch"를 겨냥한 것인지, "확장 background SW가 직접 만드는 API 호출"에도 똑같이 적용되는지는 이번 세션에 확인하지 못했다(`[ASSUMED]`, 문서 접근이 egress 프록시에 막힘).
**How to avoid:** 계획 초반에 **스파이크**로 두 방법을 순서대로 시도한다: (1) `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1`를 켜고 기존 `context.route()` 패턴이 SW의 `api.anthropic.com` 호출을 잡는지 확인 — 되면 제품 코드 변경 없이 시험 가능(가장 단순). (2) 안 되면, WXT의 `import.meta.env.MODE`(빌드 모드, 이미 `CI` 분기로 dev/prod 빌드를 나누는 패턴이 `playwright.config.ts`·`fixtures.ts`에 있다)를 이용해 **시험 빌드에서만** `client.ts`의 SDK `baseURL`을 `http://127.0.0.1:<port>`(Playwright `global-setup.ts`가 띄우는 로컬 목 서버)로 바꾼다 — 이것은 "제품 코드에 시험용 뒷문"이 아니라 표준 빌드 모드 분기(개발/테스트 전용 설정)이므로 CONTEXT.md discretion 항목("제품 코드에 시험용 뒷문을 남기지 않는 쪽으로")을 만족한다. 진짜 키는 어느 경로에서도 CI·저장소에 두지 않는다(D-28).
**Warning signs:** e2e에서 `blockedRequests`에 `api.anthropic.com`이 잡히거나(요청이 갔지만 실패로 처리), 반대로 아무 요청도 관측되지 않아 가짜 응답 검증 자체가 무의미해짐.
**Phase to address:** ⑥, 계획 초반 스파이크(D-28 "자동 시험은 진짜 AI를 부르지 않는다")

## Code Examples

### 요소 목록 → 마스킹된 요청 페이로드

```typescript
// src/core/ai/mask.ts — 순수 함수, DOM·chrome 없음
// 정확한 정규식 경계값(긴 숫자 길이 기준 등)은 D-27대로 단위 시험으로 고정한다 — 아래는 초안(ASSUMED).
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// 한국 휴대폰(01[0-9])·일반 전화(0[2-6]X) — 구분자 있거나 없거나
const PHONE_RE = /0(?:1[0-9]|[2-6][1-9]?)[-.\s]?\d{3,4}[-.\s]?\d{4}/g;
// 긴 숫자 줄(주민번호·계좌·카드 모양 포괄) — 구분자 섞여도 숫자 8자리 이상 연속
const LONG_DIGITS_RE = /\d(?:[\d\-\s]{6,}\d)/g;

export function maskPii(text: string): string {
  return text
    .replace(EMAIL_RE, '[이메일]')
    .replace(PHONE_RE, '[전화번호]')
    .replace(LONG_DIGITS_RE, '[숫자]');
}
```

```typescript
// src/core/ai/request-builder.ts — Item[] → AI로 보낼 압축 목록(순수)
// 9분면 위치: rect 중심이 뷰포트를 3x3으로 나눈 어디에 있는지만 표시(정확한 좌표는 보내지 않는다, D-09).
type Zone = '좌상' | '중상' | '우상' | '좌중' | '중앙' | '우중' | '좌하' | '중하' | '우하';

const MAX_SENT_ITEMS = 150; // 5,000개 요소 페이지 대비 상한(ASSUMED — 토큰 비용·프롬프트 잡음 방지)
const MAX_TEXT_LEN = 60;

export function buildAiPayload(
  items: Array<{ id: string; name: string; kind: string; rect: { x: number; y: number; w: number; h: number } }>,
  viewport: { w: number; h: number },
): { tempId: string; kind: string; text: string; zone: Zone }[] {
  return items.slice(0, MAX_SENT_ITEMS).map((item, i) => ({
    tempId: `t${i.toString()}`, // 답과 목록을 맞춰 보는 요청 안 임시 번호(D-09) — item.id를 그대로 노출하지 않는다
    kind: item.kind,
    text: maskPii(item.name).slice(0, MAX_TEXT_LEN),
    zone: zoneOf(item.rect, viewport),
  }));
}
```

### 구조화 출력 요청(SDK, 승인 후)

```typescript
// src/worker/ai/client.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true }); // Pitfall 1

export async function requestCleanupPicks(
  payload: ReturnType<typeof buildAiPayload>,
  signal: AbortSignal,
): Promise<unknown> {
  const response = await client.messages.create(
    {
      model: 'claude-haiku-4-5', // D-07 — 실행 시점에 유효성 재확인(Pitfall 3)
      max_tokens: 500,
      system: '이 화면에서 사용자가 가장 먼저 눌러야 할 가능성이 높은 요소를 최대 9개, 중요한 순서로 고르세요. tempId만 답하세요.',
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: { picks: { type: 'array', items: { type: 'string' } } },
            required: ['picks'],
            additionalProperties: false, // 공식 문서 요구사항(CITED)
          },
        },
      },
    },
    { signal, maxRetries: 2 }, // Esc 취소 → AbortController.abort() → 이 signal
  );
  const text = response.content[0]?.type === 'text' ? response.content[0].text : undefined;
  return text ? JSON.parse(text) : undefined;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `response_format`/`output_format` | `output_config.format` | 2026 GA[CITED: docs.litellm.ai/docs/anthropic_unified/structured_output, github.com/helicone/helicone issue #5639] | 옛 이름을 쓰면 동작하지 않거나 deprecated 경고 — CONTEXT.md specifics에도 이미 반영됨 |

**Deprecated/outdated:** `output_format`(옛 파라미터명) — `output_config.format`으로 대체.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | MV3 SW에서도 `dangerouslyAllowBrowser: true`가 여전히 필요하다(SDK가 SW 전역을 "브라우저"로 감지) | Common Pitfalls 1, Code Examples | 틀리면 불필요한 플래그이거나, 반대로 플래그 없이 던지는 예외를 못 잡아 첫 스파이크가 실패 원인을 오판할 수 있음 — 스파이크로 즉시 확인되므로 비용 낮음 |
| A2 | `.parse()` SDK 헬퍼가 스키마에서 제거된 제약(`minItems` 등)을 클라이언트에서 대신 검증해 준다는 2026-06 캐시 정보 | Standard Stack Alternatives, Pitfall 2 | 틀려도 영향 없음 — 어차피 우리 zod로 직접 검사하도록 설계했으므로 이 주장에 의존하지 않는다 |
| A3 | 캐시 열쇠 = `origin + pathname + hash`(쿼리 버림) + Fingerprint 매칭 재검증 | Pitfall 4, Architecture | 회사 시스템 iframe SPA에서 캐시가 과하게 재사용되거나(다른 화면인데 같은 번호) 과하게 무효화될 수 있음 — CONTEXT.md가 이미 "사용자 확인 질문을 스레드에 올렸다"고 명시한 항목이므로 계획 전 재확인 필요 |
| A4 | 취소·실패·검사 실패는 월 사용량에 카운트하지 않고, 유효한 성공 응답만 카운트 | Pitfall 5 | 한도를 실제보다 관대하게(또는 엄격하게) 만들 수 있음 — CONTEXT.md discretion 항목, 사용자 확인 필요 |
| A5 | 가림 정규식(이메일·한국 전화·긴 숫자 8자리 이상)의 정확한 경계값 | Code Examples(mask.ts) | 과소 가림(개인정보 유출) 또는 과다 가림(정상 텍스트 훼손) — D-27이 이미 단위 시험으로 고정하도록 요구했으므로 계획에 전용 TDD task 필요 |
| A6 | 답이 AI 픽 9개 미만일 때 나머지 번호는 fallback 순서(presses→cursor)로 채운다 | Architecture Pattern 3 | 틀리면 번호가 비거나 사용자 기대와 다른 요소가 채워질 수 있음 — 명시적 결정 없음, 구현 전 확인 권장 |
| A7 | Playwright `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1`가 MV3 확장 background SW 자신의 `fetch()`도 가로챈다 | Pitfall 6 | 틀리면 1차 시험 전략이 무효 — 문서 접근이 egress 프록시에 막혀 확정하지 못함, 스파이크로 반드시 선(先)검증 |
| A8 | 스코프 요소 목록 상한 150개, 이름 60자 절단 | Code Examples(request-builder.ts) | 너무 작으면 중요한 요소가 후보에서 빠짐, 너무 크면 토큰 비용·프롬프트 잡음 증가 — 명시적 결정 없음 |

## Open Questions (RESOLVED)

1. **`dangerouslyAllowBrowser`의 정확한 감지 조건** (RESOLVED)
   - What we know: 플래그가 없으면 브라우저류 전역에서 SDK가 막는다는 것은 SDK의 공개 동작(공식 문서·블로그로 확인)이다.
   - What's unclear: MV3 `ServiceWorkerGlobalScope`가 정확히 어떤 전역 신호(`window` 유무, `navigator.userAgent` 등)로 "브라우저"로 판정되는지는 SDK 소스 코드 확인이 필요하다(이번 세션엔 하지 않음).
   - Recommendation: 계획의 첫 task를 "SDK 초기화 스파이크"로 두고, 실패하면 `fetch` 직접 구현(D-25 대안)으로 즉시 전환할 수 있게 request-builder.ts/response-schema.ts는 SDK와 무관하게 설계했다(이미 그렇게 함 — `client.ts`만 SDK를 import).
   - **RESOLVED:** 06-04 Task 1의 스파이크 A(승인된 SDK 설치 직후, 프로덕션 빌드 SW에서 `dangerouslyAllowBrowser: true`로 초기화·가짜 AI 호출)가 확인하고 결과를 06-04-SUMMARY에 적는다. 실패하면 D-25 대안인 `fetch` 직접 구현으로 바꾼다 — 06-01 Task 1의 `reject-fetch` 선택과 같은 경로이고, `client.ts`만 바뀐다.

2. **Playwright로 확장 service worker의 outbound fetch를 가로챌 수 있는가** (RESOLVED)
   - What we know: 실험적 환경변수가 존재하고, 일반 페이지 요청은 기존 fixtures.ts 패턴으로 확실히 가로챈다.
   - What's unclear: 확장 background SW 전용 사례의 공식 검증 사례를 찾지 못함(egress 차단으로 1차 문서 접근 실패).
   - Recommendation: Pitfall 6의 2단계 스파이크(환경변수 우선, 실패 시 빌드 모드 baseURL 치환)를 계획 첫 wave에 포함.
   - **RESOLVED:** 06-01 Task 2(wave 1)의 스파이크 B가 이 두 단계를 순서대로 시도하고, 양성 대조(SW에서 `api.anthropic.com`으로 보낸 요청이 가짜 AI에 잡힘)로 확인한 방법을 06-01-SUMMARY에 적는다. SDK 경로에서 같은 가로채기가 되는지는 06-04 Task 1이 다시 확인한다.

3. **캐시·한도의 정확한 정책(discretion 항목 다수)** (RESOLVED)
   - What we know: CONTEXT.md가 이미 "사용자 확인 질문을 스레드에 올렸다"고 여러 항목에 명시했다.
   - What's unclear: 그 스레드의 실제 답변이 이 연구 시점에는 반영되지 않았을 수 있다.
   - Recommendation: `/gsd-plan-phase` 실행 전 CONTEXT.md의 최신 상태(사용자 답변 반영 여부)를 다시 확인 — 이 문서의 A3·A4·A6은 답변이 없을 때의 기본 제안이다.
   - **RESOLVED:** 06-06 "사용자 확인 대기 선택"이 기본 제안으로 정했다 — 한도 단위는 보낸 요청 수, 저장된 번호는 "화면 정리" 카드를 다시 누를 때만 쓴다. 저장 열쇠·낡음 판정은 06-06 Task 1, 사용량을 세는 시점은 06-06 Task 2, 취소한 요청의 사용량은 06-07 Task 1이 맡는다. 이용자 답이 다르면 바꿀 자리가 06-06의 그 절에 적혀 있다.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|----------|----------|
| `@anthropic-ai/sdk`(npm 레지스트리 접근) | 설치·타입 확인 | ✓ | `0.128.0`(이번 세션 `npm view` 성공) | — |
| `api.anthropic.com` 실제 네트워크 호출 | 런타임 AI 호출 | 미확인(이 연구 세션은 실제 API를 호출하지 않음 — 과제 제약) | — | 개발 중에는 사용자 본인 키로 수동 확인, 자동 시험은 항상 가짜 응답(D-28) |
| `PLAYWRIGHT_BROWSERS_PATH` 크로미움 | e2e 실행 | 환경변수로 제공됨(`tests/e2e/fixtures.ts:16-19`) | — | — |
| Playwright 실험적 SW 네트워크 가로채기 | e2e에서 가짜 AI 응답 주입 | 미확인(Open Question 2) | `@playwright/test` `1.63.0`(package.json) | 빌드 모드 baseURL 치환(Pitfall 6 대안) |

**Missing dependencies with no fallback:** 없음(둘 다 대안이 있음).
**Missing dependencies with fallback:** 위 표의 마지막 두 항목.

## Validation Architecture

> `.planning/config.json`의 `workflow.nyquist_validation`은 `false`이지만, 이 phase의 research 요청이 이 섹션을 명시적으로 요구했으므로(orchestrator 지시) 작성한다 — Phase 6의 답 검사·가림 규칙이 특히 "봤을 때 됐다 싶지만 실은 안 된" 위험이 큰 영역이라 계획 단계에서 테스트 지도가 있는 편이 안전하다.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `5.0.1` + happy-dom `20.14.5`(단위), `@playwright/test` `1.63.0`(e2e) |
| Config file | `vitest.config.ts`(기존), `playwright.config.ts`(기존) |
| Quick run command | `pnpm test:unit` |
| Full suite command | `pnpm test` (`test:unit && test:e2e`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| AI-01 | 화면 정리 → 9개에 1~9 번호표 | e2e | `pnpm test:e2e -g "화면 정리"` | ❌ Wave 0 |
| AI-01 | 같은 사이트·페이지 재방문 시 AI 재호출 없이 저장된 번호 사용 | e2e + unit(캐시 열쇠) | `pnpm test:unit -t "cache-key"` / e2e | ❌ Wave 0 |
| AI-02 | 요청에 입력 값 없음·이메일/전화/긴숫자 가림 | unit | `pnpm test:unit -t "mask"` | ❌ Wave 0 |
| AI-03 | 캐시 재사용, AI 재호출 안 함 | e2e(네트워크 카운트 확인) | `pnpm test:e2e -g "캐시"` | ❌ Wave 0 |
| AI-04 | 월 한도 초과 시 AI 호출 안 함 | unit(한도 계산) + e2e | `pnpm test:unit -t "usage"` | ❌ Wave 0 |
| AI-05 | 키 없으면 화면 정리만 꺼지고 나머지 정상 | e2e | `pnpm test:e2e -g "키 없음"` | ❌ Wave 0 |
| AI-06 | 목록 밖 id·호출 실패 → 답 버림 + fallback 번호, 직접 눌림 없음 | unit(`validateAiResponse`) + e2e | `pnpm test:unit -t "response-schema"` | ❌ Wave 0 |
| PRIV-01(AI 전송 부분) | 민감칸 값이 AI 전송 어디에도 없음 | unit(Phase 3 판별 함수와 통합) | `pnpm test:unit -t "sensitive"` | Phase 3 의존, ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm test:unit`(core/ai/*는 DOM 없이 빠르게 돈다)
- **Per wave merge:** `pnpm test` (`CI=true`로 e2e 포함)
- **Phase gate:** 전체 스위트 green 뒤 `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/core/ai/mask.test.ts` — AI-02, 이메일·전화·긴숫자 경계값(A5)
- [ ] `tests/unit/core/ai/response-schema.test.ts` — AI-06, "하나라도 틀리면 전체 버림" 정확히
- [ ] `tests/unit/core/ai/cache-key.test.ts` — AI-03, 쿼리/해시 정규화(A3)
- [ ] `tests/unit/worker/ai/usage-store.test.ts` — AI-04, 월 경계·취소 미카운트(A4)
- [ ] `tests/e2e/ai-cleanup.e2e.ts` — 연습 사이트에 가짜 AI 응답 주입(Pitfall 6 스파이크 결과에 따라 방식 결정), 9개 번호·재사용·키없음·한도초과·목록밖답 전 경로
- [ ] `tests/practice-site/` — 화면 정리에 적합한 연습 페이지(버튼 다수, 이메일·전화번호가 보이는 텍스트, 입력칸에 개인정보스러운 값) 추가 필요
- [ ] 프레임워크 설치: 신규 없음(zod·Vitest·Playwright 이미 존재), `@anthropic-ai/sdk`는 승인 후 `pnpm add`

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | 아니오(사용자 인증 없음, 단일 사용자 로컬 도구) | — |
| V3 Session Management | 아니오 | — |
| V4 Access Control | 부분(확장 내부 메시지만) | `sender.id === chrome.runtime.id` 확인(이미 `background.ts:69`에 존재하는 패턴을 새 `ai/*` 메시지에도 동일 적용) |
| V5 Input Validation | 예 | zod(`response-schema.ts`, 신규 메시지 스키마) — 모든 SW 진입점은 이미 zod discriminated union(`messages.ts`)을 거친다 |
| V6 Cryptography | 아니오(암호화 저장 안 함 — Phase 3 D-27이 "암호화 없이 저장"을 이미 사용자에게 고지하기로 결정) | — |
| V9 Communications(추가, AI 호출 특성상 중요) | 예 | HTTPS만(SDK 기본), 키는 헤더로만 전송, 로그에 키·원문 텍스트를 남기지 않는다 |

### Known Threat Patterns for MV3 확장 + 외부 LLM 호출

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| AI 키 노출(저장·로그·번들) | Information Disclosure | `chrome.storage.local`에만(sync 금지, D-18), 코드·커밋·시험 픽스처에 금지(CLAUDE.md), content script·페이지에 절대 전달 안 함 — 키를 읽는 코드는 `worker/ai/client.ts`와 설정 화면 저장 로직뿐 |
| 데이터 유출(입력 값·URL·개인정보) | Information Disclosure | D-09(항목 종류만), D-10(가림, SW 마지막 방어선), D-12(유일한 외부 요청 경로) |
| 프롬프트 주입(사이트 텍스트가 AI 지시로 오독됨) | Tampering | AI는 번호만 매길 뿐 절대 실행 권한이 없다(D-08) — 프롬프트 주입이 성공해도 "이상한 요소를 고르는" 정도의 피해로 국한되고, 그 픽조차 `validateAiResponse`가 sent-id 목록 밖이면 버린다. 위험 버튼은 AI가 골라도 Phase 1의 확인 화면 보호가 그대로 걸린다(D-08 후단) — 이중 방어 |
| 비용 남용(과호출로 청구액 급증) | Denial of Service(비용판) | 월 한도(AI-04) + 캐시 재사용(AI-03) + "키를 누를 때만" 시작(D-05, 자동 트리거 없음) |
| 응답 변조·환각(목록 밖 요소, 형식 오류) | Tampering / Repudiation | zod 전체 버림 검증(D-19), 실패 시 결정적 fallback(orderHints) |
| 확장 내부 메시지 위조(다른 확장·페이지가 `ai/cleanup-request` 위조) | Spoofing | 기존 `sender.id !== chrome.runtime.id`면 무시하는 패턴(`background.ts:69`)을 새 메시지에도 동일 적용, `externally_connectable` 없음 |

## Sources

### Primary (HIGH confidence)
- npm registry(`npm view @anthropic-ai/sdk version/time.created/time.modified/repository.url/peerDependencies/scripts.postinstall`, 이번 세션 직접 실행) — `@anthropic-ai/sdk` 존재·최신 버전·공식 저장소·peer 호환성
- 저장소 코드(이번 세션 Read): `src/page/collector/collector.ts`, `src/core/hint-order.ts`, `src/core/fingerprint.ts`, `src/core/settings-schema.ts`, `src/shared/messages.ts`, `src/worker/storage-writer.ts`, `src/worker/relay.ts`, `src/entrypoints/background.ts`, `src/core/danger.ts`, `src/core/confirm-guard.ts`, `src/page/overlay/hints.ts`, `wxt.config.ts`, `package.json`, `playwright.config.ts`, `tests/e2e/fixtures.ts`
- [Structured outputs - Claude Platform Docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — `output_config.format`, `additionalProperties: false` 요구사항
- [Claude Haiku 4.5 overview](https://platform.claude.com/docs/en/models/haiku-4-5/overview), [llm-stats.com](https://llm-stats.com/models/claude-haiku-4-5-20251001) — 모델 ID·가격 재확인

### Secondary (MEDIUM confidence)
- [Claude's API now supports CORS requests (Simon Willison)](https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/), [getcoai.com](https://getcoai.com/news/claudes-api-now-supports-cors-requests/) — `dangerouslyAllowBrowser`·`anthropic-dangerous-direct-browser-access` 헤더 배경
- [anthropic-sdk-typescript README/GitHub](https://github.com/anthropics/anthropic-sdk-typescript) — 재시도·타임아웃 기본값
- [Chrome extension MV3 host_permissions CORS 우회 설명](https://www.buildwithmatija.com/blog/bypass-cors-chrome-extension-manifest-v3) — SW의 CORS 우회 근거
- [Chrome storage.local 10MB 기본 할당량](https://developer.chrome.com/docs/extensions/reference/api/storage) — 캐시 축출 정책 설계 근거
- [Playwright (Experimental) Service Worker Network Events, issue #15684](https://github.com/microsoft/playwright/issues/15684) — `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS` 환경변수 존재

### Tertiary (LOW confidence)
- `gsd_run query package-legitimacy check`의 `@anthropic-ai/sdk` 자동 판정(`SUS`) — 스코프 패키지명 파싱 문제로 신호를 못 읽은 것으로 보임(원시 `npm view`로 반박·해소)
- 구조화 출력의 배열 길이 제약 미지원·`.parse()` 클라이언트측 검증 주장(claude-api 스킬 2026-06 캐시) — 이번 세션 공식 문서 재검색으로 세부사항을 재확인하지 못함(A2로 하향, 설계상 영향 없음)
- MV3 확장 background SW가 Playwright 실험적 SW 네트워크 이벤트 대상에 포함되는지 여부 — 문서 접근이 egress 프록시에 막혀 미확인(A7, Open Question 2)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 버전·peer·모델 ID·구조화 출력 형식 모두 이번 세션 재확인
- Architecture: HIGH — 전부 기존 저장소 패턴(relay.ts, storage-writer.ts, messages.ts, hint-order.ts)의 직접 확장
- Pitfalls: MEDIUM — 핵심 실패 지점(SDK 브라우저 감지, Playwright SW 라우팅)이 문서 접근 제약으로 완전히 확정되지 않아 스파이크 필요
- 보안: MEDIUM — 위협 패턴은 설계 문서·기존 코드 패턴에서 직접 도출(HIGH급 근거), ASVS 레벨 매핑 자체는 이 세션의 판단(도구 검증 없음)

**Research date:** 2026-09-24
**Valid until:** 2026-10-08(2주) — Anthropic 모델 별칭·API 세부사항(구조화 출력)은 빠르게 바뀌는 영역이라 표준 30일보다 짧게 잡는다
