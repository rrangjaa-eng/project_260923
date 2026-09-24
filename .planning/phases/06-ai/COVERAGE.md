# API Coverage — Anthropic Messages API (화면 정리 AI 창구)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> 범위: service worker의 AI 창구 한 곳(`src/worker/ai/client.ts`)이 부르는 Anthropic API 표면. 근거: 06-CONTEXT.md D-04·D-07·D-08·D-09·D-12·D-18·D-25, 06-RESEARCH.md "Standard Stack"·"Don't Hand-Roll", claude-api 스킬(2026-06 캐시).
> 한도 단위(횟수/금액)는 사용자 확인 대기다. 금액으로 바뀌면 `response usage tokens` 행을 INTEGRATE로 다시 정한다(06-06 계획 "사용자 확인 대기 선택" 참고).

| capability | decision | reason |
|---|---|---|
| messages.create (POST /v1/messages) | INTEGRATE | |
| system prompt | INTEGRATE | |
| structured outputs (output_config.format json_schema) | INTEGRATE | |
| API key auth (x-api-key) | INTEGRATE | |
| typed API errors and retries (maxRetries) | INTEGRATE | |
| request timeout | INTEGRATE | |
| request cancellation (AbortSignal) | INTEGRATE | |
| stop_reason handling (end_turn, max_tokens, refusal) | INTEGRATE | |
| dangerouslyAllowBrowser client option | INTEGRATE | |
| streaming (SSE) | OPT-OUT | not needed — 답은 번호 9개 이하의 짧은 JSON이라 한 번에 받는다 |
| tool use / function calling | OPT-OUT | explicitly out of scope — AI는 번호만 붙이고 아무 동작도 하지 않는다(D-08) |
| server tools (web search, web fetch, code execution) | OPT-OUT | explicitly out of scope — 밖으로 나가는 것은 요소 목록뿐이고 AI는 동작하지 않는다(D-08·D-12) |
| computer use | OPT-OUT | explicitly out of scope — AI가 요소를 직접 누르기는 하지 않는다(REQUIREMENTS Out of Scope) |
| vision / image input | OPT-OUT | explicitly out of scope — 보내는 것은 종류·보이는 글자·대략의 위치뿐이다(D-09) |
| PDF / document input and citations | OPT-OUT | not needed — 문서 입력이 없다 |
| extended / adaptive thinking | OPT-OUT | not needed — Haiku 4.5의 짧은 고르기 작업이라 지연과 비용만 는다 |
| effort parameter | OPT-OUT | not needed — Haiku 4.5에서는 오류다(CONTEXT specifics) |
| prompt caching | OPT-OUT | not needed — 고정 지시문이 Haiku 4.5 최소 캐시 길이(4096 토큰)보다 짧다 |
| token counting endpoint | OPT-OUT | not needed yet — 한 달 한도 단위를 횟수로 계획했다(사용자 확인 대기) |
| response usage tokens | OPT-OUT | not needed yet — 한도 단위가 횟수다. 사용자가 금액을 고르면 INTEGRATE로 바꾼다 |
| multi-turn conversation | OPT-OUT | not needed — 화면 정리 한 번에 한 번 묻고 끝난다 |
| sampling params and stop sequences | OPT-OUT | not needed — 답 형식은 구조화 출력이 정한다 |
| Message Batches | OPT-OUT | not needed — 키를 누른 즉시 답이 필요하다 |
| Files API | OPT-OUT | not needed — 올릴 파일이 없다 |
| Models API (list, retrieve) | OPT-OUT | not needed — 모델은 D-07로 고정하고 실행 시점에 문서로 한 번 확인한다 |
| mid-conversation system messages | OPT-OUT | not needed — 대화가 한 턴이다 |
| context editing and compaction | OPT-OUT | not needed — 대화가 한 턴이다 |
| memory tool | OPT-OUT | not needed — 저장은 확장이 chrome.storage.local에 한다(D-14) |
| MCP connector | OPT-OUT | explicitly out of scope — 밖으로 나가는 요청은 화면 정리 요청뿐이다(D-12) |
| fast mode and priority tier | OPT-OUT | not needed — Haiku 4.5 대상이 아니고 짧은 요청이다 |
| Admin API (usage and cost reports) | OPT-OUT | explicitly out of scope — 관리자 키가 필요하고 확장에 두지 않는다(D-18) |
| Managed Agents and Agent SDK | OPT-OUT | explicitly out of scope — 화면 정리는 한 번의 요청이다 |
| third-party platforms (Bedrock, Vertex, Foundry) | OPT-OUT | not needed — 이용자 본인의 Anthropic 키로 직접 부른다 |
