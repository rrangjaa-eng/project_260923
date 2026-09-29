# Phase 6: 화면 정리 (AI) - Context

**Gathered:** 2026-09-24
**Status:** Ready for planning (미리 쓴 계획 — 아래 "앞선 단계 의존" 확인 후 실행)
**Source:** PRD Express Path (docs/superpowers/specs/2026-09-23-tremor-browser-helper-design.md)

<domain>
## Phase Boundary

설계 10-1 "만드는 순서" 6번: **화면 정리(AI, 키를 누를 때만)**. 이용자가 처음 보는 복잡한 화면에서 명령판의 "화면 정리"를 누르면, 요소 수집기가 만든 요소 목록(종류·보이는 글자·대략의 위치)을 service worker의 **AI 창구 한 곳**을 거쳐 작고 저렴한 Claude 모델에 보내 중요한 요소 9개를 고르게 하고, 고른 요소에 1~9 번호표를 붙인다. AI는 번호만 붙이고 절대 누르지 않는다. AI 키가 없거나, 한 달 한도를 넘었거나, 호출이 실패했거나, 답이 이상하면 자주 누른 순서 번호표로 대신하고 나머지 기능은 그대로 동작한다. 밖으로 나가는 것은 이 요소 목록뿐이고, 입력칸 값은 보내지 않으며 개인정보 모양은 가린다.

요구사항: AI-01, AI-02, AI-03, AI-04, AI-05, AI-06 (ROADMAP Phase 6).

설계 검토(CEO·디자인·엔지니어링)는 모두 끝났고, 설계의 모든 결정은 잠긴 결정이다(GSTACK REVIEW REPORT, "NO UNRESOLVED DECISIONS"). 다시 열지 않는다.

### 앞선 단계 의존 (이 계획은 미리 썼다)
이 계획은 Phase 1 실행 중(16개 중 12개 완료, 커밋 `f468b6e` 기준)에 미리 썼다. Phase 2~5는 아직 실행 전이고, Phase 3·4·5 계획은 다른 스레드에서 동시에 쓰는 중이다. 실행 전에 아래가 끝났는지와 결과가 이 계획의 가정과 맞는지 확인하고, 다르면 이 계획을 다시 맞춘다(`/gsd-plan-phase 6 --research`로 다시 조사하거나 계획만 고친다).
- **Phase 1 (계획 13~16 실행 전):** 요소 수집기(`src/page/collector/collector.ts`의 `Item`: id·rect·name·kind·fingerprint·danger), 맨 위 프레임이 모든 프레임 요소를 모아 번호 매기기(`src/core/hint-order.ts`의 `orderHints`: 고정 번호 → 자주 누른 요소 → 커서 근처), 요소 식별 묶음(`src/core/fingerprint.ts`), 자주 누른 기록(`presses:<origin>` in storage.local, `PressesV1`), 단일 저장자(`src/worker/storage-writer.ts`), 확장 내부 메시지(`src/shared/messages.ts`), 번호표 오버레이(`src/page/overlay/hints.ts`). Phase 6은 이 위에 쌓는다. 01-13~16(사이트별 저장 항목·형식 변환 보호·크기 고정·서체)의 결과도 가정한다.
- **Phase 3 (계획 작성 중, 브랜치 `claude/phase3-plans-ng6f32`):** 명령판(0)과 고정 카드 자리 — 둘째 장 **7번 "화면 정리(AI)"** 카드 자리를 Phase 3이 지켜 둔다(Phase 3 D-06). 설정 화면(확장 옵션 페이지 또는 팝업 확장 — Phase 3이 정함)과 새 화면 템플릿 절차(Phase 3 D-38). 민감칸 판별 **한 곳의 함수**(Phase 3 D-26 — AI 전송도 이 함수를 쓴다). 설정 파일 내보내기가 AI 키를 담지 않는다는 결정(Phase 3 D-35). Phase 3의 파일 이름·메시지 이름이 정해지면 이 계획의 해당 부분을 맞춘다.
- **Phase 4 (계획 작성 중):** 활동 기록(2주, 이 PC만). 화면 정리 사건을 기록에 남길지는 Claude's Discretion(아래) — 활동 기록 모듈이 있으면 그 규칙(입력 값 없음)을 따른다.
- **Phase 5 (계획 작성 중):** ROADMAP상 Phase 6은 Phase 5에 의존하지만, 기능으로는 작업판·뒤에서 실행을 쓰지 않는다. 명령판·번호표·설정 화면만 쓴다.
- **Phase 2 (중간 이용자 시험):** 번호표 기본값(크기·순서)이 바뀌면 Phase 6의 번호 붙이기도 그 결과를 따른다.

</domain>

<decisions>
## Implementation Decisions

### 구조 (앞 단계 결정 이어받기)
- **D-01:** Phase 1의 구조를 그대로 쓴다: 모든 프레임에 content script, **맨 위 프레임이 모든 프레임의 요소 목록을 모아** 번호를 매긴다(Phase 1 D-02·D-03). 화면 정리도 맨 위 프레임이 모은 목록(iframe 안 요소 포함)을 쓰고, 로딩·결과 표시는 맨 위 프레임의 오버레이가 맡는다. 프레임끼리의 메시지는 service worker를 거친다(설계 4장, 엔지니어링 검토 1번).
- **D-02:** 도우미는 `isTrusted` 입력에만 반응하고 입력 필터(떨림 걸러내기)가 가장 먼저 받는다. 화면 정리는 이용자가 명령판 카드를 실제로 눌렀을 때만 시작한다 — 사이트가 만든 가짜 입력으로는 AI가 불리지 않는다(설계 5장·8장, 엔지니어링 검토 4번).
- **D-03:** 모든 저장은 service worker 하나가 순서대로 한다(단일 저장자). 새로 저장하는 데이터(화면 정리 결과, AI 사용량, AI 설정)에도 형식 버전을 붙이고, 형식 변환이 실패하면 원래 데이터를 그대로 두고 알린다(설계 7장, 엔지니어링 검토 6번).
- **D-04:** **AI 창구는 service worker 안의 한 곳**이다. AI 호출은 모두 이 창구를 거친다. content script·페이지는 AI를 직접 부르지 않고, 창구에 "화면 정리해 줘"를 부탁만 한다(설계 4장 "AI 창구 (화면 정리만)", 6.10 "AI 호출은 모두 이 창구 한 곳을 거친다").

### 화면 정리 동작 (AI-01)
- **D-05:** 시작은 **키를 누를 때만**: 명령판 둘째 장 7번 "화면 정리(AI)" 카드(고정 자리, SYSTEM.md·Phase 3 D-06). 페이지를 열 때나 번호표를 켤 때 저절로 AI를 부르지 않는다(설계 3장 "키를 누를 때만", 6.10).
- **D-06:** 요소 수집기가 만든 요소 목록(종류, 보이는 글자, 대략의 위치)을 AI에 보내 **이 화면에서 중요한 요소 9개**를 고르게 하고, 고른 요소에 1~9 번호표를 붙인다(설계 6.10, AI-01).
- **D-07:** 작고 저렴한 Claude 모델을 쓴다(설계 6.10). 프로젝트 연구가 정한 모델은 `claude-haiku-4-5`(입력 $1 / 출력 $5 per 1M, `.planning/research/STACK.md`). 실행할 때 모델 ID가 아직 유효한지 확인한다.
- **D-08:** AI는 번호만 붙이고 **절대 직접 누르지 않는다.** AI 결과로 클릭·포커스·입력 이벤트가 생기는 경로가 코드에 없어야 하고, 번호표로 누르는 것은 이용자의 키 입력뿐이다. 위험한 버튼은 AI가 골라도 Phase 1의 보호(빨간 테두리 + "정말 누를까요? Enter = 예", 확인 화면 보호)가 그대로 걸린다(설계 6.10·8장, AI-06, ROADMAP 성공 기준 3).

### 보내는 것과 개인정보 (AI-02, PRIV-01)
- **D-09:** AI로 보내는 것은 **요소 종류·보이는 글자·대략의 위치뿐**이다(AI-02). 페이지 주소·제목·입력칸 값·속성 값(id·name·href 등)은 보내지 않는다. 답과 목록을 맞춰 보기 위한 요청 안 임시 번호만 더한다.
- **D-10:** 입력칸의 값은 어떤 경우에도 보내지 않는다. 요소 글자 중 **이메일·전화번호·숫자 긴 줄** 같은 개인정보 모양은 가려서 보낸다(설계 6.10). 가림은 AI 창구(service worker)에서 보내기 직전에 한 번 더 해서, 어떤 경로로 온 목록도 가림을 건너뛰지 못하게 한다.
- **D-11:** 민감칸 판별은 Phase 3의 **한 곳의 판별 함수**를 그대로 쓴다(Phase 3 D-26, PRIV-01: 민감칸 값은 AI 전송 어디에도 남지 않는다).
- **D-12:** 확장 전체에서 밖으로 나가는 요청은 이 화면 정리 요청뿐이다(설계 8장 "데이터는 서버로 보내지 않는다. 밖으로 나가는 것은 이용자가 '화면 정리'를 눌렀을 때 AI로 가는 요소 목록뿐이다").
- **D-13:** 보낸 요청에 입력칸 값이 없고 이메일·전화번호·긴 숫자 모양이 가려진 것을 **시험으로 확인**한다(ROADMAP 성공 기준 2).

### 저장된 결과 다시 쓰기 (AI-03)
- **D-14:** 결과는 **사이트 + 페이지 주소** 형태로 `chrome.storage.local`에 저장하고, 같은 화면에서는 AI를 다시 부르지 않고 저장된 번호를 쓴다(설계 6.10·7장 "화면 정리 결과 = 이 PC만", AI-03).
- **D-15:** 저장된 결과의 요소는 Phase 1의 **요소 식별 묶음**(id·name·라벨 글자·버튼 글자·aria·페이지 안 위치 경로·프레임 경로, `Fingerprint`)으로 기억하고, 다시 쓸 때 `isSameElement`로 지금 화면의 요소와 맞춘다(설계 6.2 "요소 식별 방법은 6.8의 '요소 찾기'와 같은 방식").

### 한 달 사용 한도 (AI-04)
- **D-16:** 이용자가 정한 **한 달 사용 한도**를 넘으면 AI를 부르지 않고 알린 뒤 자주 누른 순서 번호표로 대신한다(설계 6.10·9장, AI-04). AI 사용량은 `chrome.storage.local`(이 PC만)에 둔다(설계 7장).

### AI 키 (AI-05)
- **D-17:** AI 사용 키가 없으면 **화면 정리만 꺼지고 나머지는 모두 동작**한다(AI-05). 키가 없을 때 화면 정리 카드를 누르면 자주 누른 순서 번호표로 대신한다(ROADMAP 성공 기준 3).
- **D-18:** AI 키는 **이 PC에만**(`chrome.storage.local`) 저장하고 동기화하지 않으며, 설정 파일 내보내기에도 넣지 않는다(설계 7장, Phase 3 D-35). 키는 **content script·페이지에 절대 넘기지 않는다** — 키를 읽는 코드는 service worker의 AI 창구와 키를 넣는 확장 설정 화면뿐이다(설계 7장, 엔지니어링 검토 6번). 키는 코드·커밋·시험 파일에 절대 넣지 않는다(CLAUDE.md).

### 답 검사와 대체 (AI-06)
- **D-19:** AI 답은 검사한다: 고른 요소가 **보낸 목록에 있는 것만** 받아들이고, **하나라도 맞지 않으면 그 답 전체를 버리고** 자주 누른 순서 번호표로 대신한다(설계 6.10, AI-06). 답 형식 검사는 zod로 한다(프로젝트 연구 STACK.md).
- **D-20:** 대체 번호는 Phase 1의 번호 순서 그대로다: 고정 번호 → 자주 누른 요소 → 커서 근처(`orderHints`, Phase 1 D-11). 대체하는 경우: 키 없음, 한도 초과, 호출 실패(네트워크·오류 응답·시간 초과), 답이 목록 밖 요소를 고름, 답 형식이 틀림(설계 9장, ROADMAP 성공 기준 3).
- **D-21:** AI가 실패해도 **나머지 기능은 모두 정상 동작**한다 — 화면 정리 실패가 번호표·자석 커서·명령판 등 다른 기능을 막거나 멈추지 않는다(설계 6.10, ROADMAP 성공 기준 3).

### 화면 (상태 표·디자인)
- **D-22:** 상태(SYSTEM.md 상태 표 "화면 정리(AI)"): 불러오는 중 "화면을 정리하는 중" + [Esc 취소](0.3초 안에 끝나면 표시 안 함) · 실패·한도 초과 "자주 누른 순서로 번호를 붙였어요" · 성공 = 번호표 + "AI가 고른 번호" 표시.
- **D-23:** 모든 오버레이는 `docs/design/SYSTEM.md`(안 A 등대)와 `docs/design/tokens.css`만 따른다: Shadow DOM 안, 새 색·서체·radius·그림자 금지. 카피 규칙: 질문 "…할까요?", 알림 "…했어요", 오류 "원인. 다음 행동.", 키 이름은 영어(`Enter`, `Esc`)·스페이스바만 한글(SYSTEM.md, Phase 1 D-26, Phase 3 D-36·D-37).
- **D-24:** 설정 화면에 **AI 키 넣기**와 **한 달 사용 한도** 칸을 더한다. 설정 화면은 Phase 3이 만든 곳을 쓰고, SYSTEM.md에 템플릿이 없으면 DESIGN.md §4-1대로 먼저 SYSTEM.md에 템플릿을 더한 뒤 만든다(Phase 3 D-38, CLAUDE.md 프론트엔드 규칙).

### 의존성·권한
- **D-25:** AI 호출에는 프로젝트 연구가 정한 대로 공식 `@anthropic-ai/sdk`를 쓴다(`.planning/research/STACK.md` "저장소 규칙상 SDK 우선", service worker에서 `dangerouslyAllowBrowser: true`). 이 패키지는 아직 승인 목록에 없으므로 **새 의존성 = 이유 한 줄 + 승인 후**(CLAUDE.md) — 실행 첫 단계에서 승인받고, 승인 전에는 설치하지 않는다. 승인되지 않으면 `fetch` 직접 호출 + zod 검사로 간다(STACK.md 대안 표).
- **D-26:** 새 권한은 더하지 않는 것을 기본으로 한다. `host_permissions: ['<all_urls>']`가 이미 `api.anthropic.com`을 포함한다. 새 권한이 필요해지면 새 권한이므로 만들 때 승인받는다(Phase 1 D-13, CLAUDE.md).

### 시험
- **D-27:** 단위 시험(설계 10장 명시 "AI 답 검사" 포함): 답 검사(목록 밖 요소 → 전체 버림, 형식 틀림 → 버림), 개인정보 모양 가림, 보내는 목록에 값·주소가 없음, 결과 저장 열쇠(사이트 + 페이지 주소), 한 달 사용량·한도, 저장 형식 변환.
- **D-28:** 확장을 띄운 브라우저 시험(Chromium, `CI=true`): 로컬 연습 사이트에서 명령판 → 화면 정리 → 번호표 1~9, 같은 화면 다시 → AI 안 부름, 키 없음·한도 초과·호출 실패·목록 밖 답 → 자주 누른 순서 대체, AI 결과로 눌림 없음, iframe 안 요소 포함. **자동 시험은 진짜 AI를 부르지 않는다** — 가짜 AI 응답으로 대신하고, 진짜 키는 CI·저장소 어디에도 두지 않는다.
- **D-29:** 모든 기능은 로컬 연습 사이트에서 먼저 시험한다. 회사 시스템에서는 시험하지 않는다(설계 10장, 11장 ①, 2026-09-23 사용자 결정).
- **D-30:** UI 완료 판정은 저장소 규칙대로: 싼 게이트(lint·typecheck·build) → 별도 에이전트의 독립 DOM 감사(`CI=true`, 스크린샷 육안 금지) → 수정 → 전체 게이트 한 번(CLAUDE.md).

### Claude's Discretion
- **한 달 사용 한도의 단위와 기본값** — 횟수(화면 정리 호출 수)로 할지 금액(응답의 사용 토큰 × 가격)으로 할지. 기본 제안: **횟수**(예측이 쉽고 가격표가 바뀌어도 틀리지 않음), 기본값은 연구가 정한다. **2026-09-24 사용자 확정: 기본 제안대로 횟수(보낸 요청 수)** — 이제 잠긴 결정이다.
- **저장된 AI 번호를 언제 쓰는지** — 기본 제안: 같은 화면에서 **"화면 정리"를 다시 누를 때만** 저장된 번호를 쓰고(AI를 다시 부르지 않음), 평소에 번호표를 켤 때는 Phase 1 순서 그대로 둔다("키를 누를 때만" 원칙). **2026-09-24 사용자 확정: 기본 제안대로** — 이제 잠긴 결정이다.
- "페이지 주소"를 저장 열쇠로 만드는 규칙(쿼리·해시를 버릴지, 주소 안의 개인정보 모양을 어떻게 할지, 본문이 iframe 안에 있어 맨 위 주소가 늘 같은 회사 시스템을 어떻게 구분할지).
- 저장된 결과의 요소가 지금 화면에서 일부 또는 전부 안 보일 때: 빈 번호를 자주 누른 순서로 채울지, 전부 안 보이면 저장이 낡은 것으로 보고 AI를 다시 부를지.
- 고정 번호(이용자가 직접 고정)와 AI가 고른 번호가 겹칠 때의 우선순위 — 기본 제안: 이용자가 고정한 번호가 그 자리를 지키고 AI 고른 요소가 나머지 번호를 채운다.
- 화면의 요소가 9개 이하일 때 AI를 부를지.
- 보내는 목록의 크기 상한·글자 자르기, "대략의 위치"를 나타내는 방법(화면 비율 반올림, 구역 이름 등), 위험한 버튼 표시를 목록에 넣을지.
- 가릴 모양의 정확한 규칙(이메일, 한국 휴대폰·일반 전화, 숫자 긴 줄의 길이 기준, 주민번호·계좌·카드 모양 포함) — 단위 시험으로 고정한다.
- 프롬프트 문구, 구조화 출력 형식(JSON schema), `max_tokens`, 시간 초과·재시도 횟수, SDK 설정.
- Esc 취소 때 요청을 끊는 방법과 취소한 호출을 사용량에 셀지, 실패 원인별 안내 문구(키가 틀림, 연결 안 됨 등 — 카피 규칙 "원인. 다음 행동.").
- 설정 화면에서 키를 보여 주는 방법(가려 보이기)·지우기, 한 달의 경계(이 PC 달력 기준).
- 활동 기록(Phase 4)이 있으면 화면 정리 사건(AI 사용/대체, 이유)을 입력 값 없이 남길지.
- 자동 시험에서 가짜 AI 응답을 넣는 방법(service worker 요청 가로채기, 시험 전용 주소 설정 등) — 진짜 키 없이, 제품 코드에 시험용 뒷문을 남기지 않는 쪽으로.
- 메시지 타입 이름, 파일 배치(프로젝트 연구 ARCHITECTURE.md는 `ai/` 창구 폴더를 제안), 저장 형식 버전 올리는 방법.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 설계와 범위
- `docs/superpowers/specs/2026-09-23-tremor-browser-helper-design.md` — 기준 설계. 3장(범위: 화면 정리는 "키를 누를 때만"), 4장(구조·AI 창구·iframe), 6.2(번호표 순서·요소 식별), 6.10(화면 정리 전부), 7장(저장: 화면 정리 결과·AI 사용량·AI 키 = 이 PC만, 키는 content script에 절대 넘기지 않음), 8장(보안: 밖으로 나가는 것은 AI 요소 목록뿐, 민감칸은 AI 전송에서 뺌, 위험한 버튼), 9장(오류: AI 호출 실패·한도 초과·목록 밖 답), 10장(시험: AI 답 검사 단위 시험)
- `.planning/ROADMAP.md` — Phase 6 목표·성공 기준 1~3
- `.planning/REQUIREMENTS.md` — AI-01~06, PRIV-01(민감칸 값은 AI 전송 어디에도 남지 않음), Out of Scope("AI가 요소를 직접 누르기"), AIX-01·02(다음 버전)
- `.planning/PROJECT.md` — 제약(Privacy: 밖으로 나가는 것은 화면 정리 요소 목록뿐, Security: AI 키는 이 PC에만)

### 프로젝트 연구 (AI 부분)
- `.planning/research/STACK.md` — `@anthropic-ai/sdk`(service worker, `dangerouslyAllowBrowser: true`), 모델 `claude-haiku-4-5`, zod로 AI 답 검사, `fetch` 대안
- `.planning/research/ARCHITECTURE.md` — AI 창구 위치(SW), 흐름 "명령판 → 요소 목록(글자 가림) → SW AI 창구(한도 확인) → Haiku → zod 검사 → 목록에 있는 것만 → 번호표. 실패 시 자주 누른 순서", `ai/` 폴더
- `.planning/research/PITFALLS.md` — 키를 sync에 저장하지 않기, AI 전송에 입력 값·개인정보 모양 포함 금지, 가림 단위 시험·목록 밖 답 거부 시험
- `.planning/research/FEATURES.md`, `SUMMARY.md` — 화면 정리는 번호표의 또 다른 출처, 가장 마지막 단계

### Phase 1 (이 단계가 쌓는 바탕)
- `.planning/phases/01-click-helper-foundation/01-CONTEXT.md` — Phase 1 결정 D-01~D-31(구조·키·안전·저장·화면·시험)
- `.planning/phases/01-click-helper-foundation/01-PATTERNS.md`, `01-RESEARCH.md` — 코드 패턴과 연구
- `.planning/phases/01-click-helper-foundation/01-*-SUMMARY.md` — 이미 만든 것(01~12)
- `.planning/phases/01-click-helper-foundation/01-13-PLAN.md` ~ `01-16-PLAN.md` — 아직 실행 전인 Phase 1 계획
- `.planning/phases/01-click-helper-foundation/deferred-items.md` — Phase 1에서 미룬 것
- 코드: `src/page/collector/collector.ts`(`Item`, `buildFrameReport`), `src/core/hint-order.ts`(`orderHints` — 대체 번호 순서), `src/core/fingerprint.ts`(`matchScore`, `isSameElement`), `src/core/settings-schema.ts`(형식 버전, `siteKey`, `pressesKey`, `PressesV1`), `src/core/danger.ts`, `src/shared/messages.ts`(`Message` 판별 합집합, `parseMessage`), `src/worker/storage-writer.ts`(단일 저장자), `src/worker/relay.ts`, `src/entrypoints/background.ts`, `src/entrypoints/content.ts`, `src/page/overlay/hints.ts`, `wxt.config.ts`(권한)

### Phase 3 (계획 작성 중 — 이 브랜치에는 없고 `origin/claude/phase3-plans-ng6f32`에 있다)
- `git show origin/claude/phase3-plans-ng6f32:.planning/phases/03-navigation-input-condition/03-CONTEXT.md` — 명령판 고정 카드 자리(D-06: 둘째 장 7 화면 정리), 민감칸 한 곳의 판별 함수(D-26), 설정 파일에 AI 키 제외(D-35), 설정 화면·새 템플릿 절차(D-38)

### 디자인
- `docs/design/SYSTEM.md` — 명령판 카드 자리(둘째 장 7 "화면 정리(AI)"), 상태 표 "화면 정리(AI)" 줄, 카피 규칙, 번호표·확인 화면 템플릿
- `docs/design/tokens.css` — 쓸 수 있는 토큰의 전부
- `docs/design/DECISIONS.md` — 디자인 결정 기록(시스템을 벗어날 때 여기에 먼저)
- `docs/DESIGN.md` — §4 새 화면·컴포넌트 절차, §6 품질 바닥

### 저장소 규칙
- `CLAUDE.md` — pnpm만, TypeScript strict, `any` 금지, 시크릿 금지, TDD, 새 의존성·새 권한은 이유 한 줄 + 승인, 완료 판정은 `CI=true`, UI는 독립 DOM 감사, `.planning/` 수동 편집 금지

</canonical_refs>

<specifics>
## Specific Ideas

- 명령판 둘째 장: 1 앞으로 · 2 탭 닫기 · 3 새 탭 · 4 틀 기록 · 5 번호 고정 · 6 양식 한 장 보기 · **7 화면 정리(AI)** · 8 더블클릭(SYSTEM.md).
- 상태 문구(SYSTEM.md 상태 표): "화면을 정리하는 중" + [Esc 취소] / "자주 누른 순서로 번호를 붙였어요" / "AI가 고른 번호".
- 설계 9장 오류 표의 AI 두 줄: "AI 호출 실패·한도 초과 → 화면 정리만 건너뛰고 자주 누른 순서 번호표로 대신", "AI 답이 목록에 없는 요소를 고름 → 답을 버리고 자주 누른 순서 번호표로 대신".
- 가릴 개인정보 모양의 예(설계 6.10): 이메일, 전화번호, 숫자 긴 줄. 요소 글자에 사람 이름이 들어가는 경우(예: "홍길동님 로그아웃")는 설계가 가림 대상으로 정하지 않았다.
- claude-api 스킬(2026-06 캐시)에서 확인한 사실 — 연구가 실행 시점에 다시 확인한다: `claude-haiku-4-5`는 구조화 출력(`output_config.format`, JSON schema, 모든 객체에 `additionalProperties: false`, `minItems`·`maxLength` 같은 제약은 지원 안 함)을 지원한다. Haiku 4.5의 프롬프트 캐시 최소 길이는 4096 토큰이라 짧은 고정 지시문은 캐시되지 않는다. `effort`는 Haiku 4.5에서 오류다. 오류 코드: 400·401·402·403·404·413(재시도 안 함), 429·500·529(재시도 가능). 응답의 `usage.input_tokens`·`usage.output_tokens`로 사용량을 셀 수 있다. TypeScript 프로젝트의 기본은 공식 SDK다.

</specifics>

<deferred>
## Deferred Ideas

다른 phase 또는 다음 버전에 배정된 항목. Phase 6 계획에 넣지 않는다.

- AI 글 써 주기(AIX-01), AI 틀 복구(AIX-02) — 다음 버전(설계 3장). AI는 화면 정리 한 곳에만 쓴다(PROJECT.md).
- AI가 요소를 직접 누르기 — 하지 않는다(REQUIREMENTS Out of Scope).
- 명령판·설정 화면·민감칸 판별 자체 — Phase 3. Phase 6은 카드 하나와 설정 칸 두 개를 더할 뿐이다.
- 활동 기록 모듈 자체 — Phase 4.
- 회사 시스템에서 확인 — 회사 시스템 완성 뒤(설계 11장 ①, 2026-09-23 사용자 결정).

</deferred>

---

*Phase: 06-ai*
*Context gathered: 2026-09-24 via PRD Express Path*
