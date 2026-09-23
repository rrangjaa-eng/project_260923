# Walking Skeleton — 손 떨림 브라우저 도우미 (이름 미정)

**Phase:** 1
**Generated:** 2026-09-23

## Capability Proven End-to-End

> 이용자가 확장 아이콘 메뉴에서 "도우미 끄기"를 누르면, service worker가 그 설정을 형식 버전과 함께 `chrome.storage.sync`에 한 번 쓰고, 연습 사이트의 모든 프레임에 들어간 도우미가 그 변화를 받아 왼쪽 아래 모드 표시를 걷어 내고, 다시 켜면 되돌아온다 — 이것이 Playwright로 확장을 띄운 크롬(`CI=true` 프로덕션 빌드)에서 자동으로 확인된다.

뼈대는 두 계획에 걸쳐 완성된다: Plan 01-01(의존성 승인 → 도구 세트 → service worker가 형식 버전이 붙은 기본 설정을 `storage.sync`에 쓰고 읽는 tracer), Plan 01-02(팝업 → 단일 저장자 → 모든 프레임 content script → Shadow DOM 모드 표시 tracer). 한 계획에 넣으면 파일이 15개를 넘어 계획 크기 기준을 넘기 때문에 나눴다.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| 형태 | Chromium Manifest V3 확장 하나(크롬·엣지·웨일) | 설계 3·4장(D-01) |
| 빌드 | WXT 0.21.4 + Vite 8.3.0 | manifest·진입점·`allFrames`/`runAt`·zip을 한 번에. 설계가 "구현 계획에서 정한다"고 열어 둔 자리(연구 추천, 의존성 승인 체크포인트 뒤에만 설치) |
| 언어 | TypeScript 6.0.3 고정, strict, `any` 금지 | 저장소 규칙. 7.x는 typescript-eslint 8.70.1 peer(`<6.1.0`)와 맞지 않음 |
| 데이터 계층 | `chrome.storage.sync`(설정·사이트별 끄기·고정 번호) / `chrome.storage.local`(자주 누른 기록·알림) / 서버 없음 | 설계 7장(D-23, D-31) |
| 저장 규칙 | service worker 하나가 순서대로 쓰는 단일 저장자, 모든 값 `{schemaVersion, data}` + zod 검사, 변환 실패 시 원본 보존 | 엔지니어링 검토 6번, 설계 7장(D-24, D-25) |
| 메시지 | `chrome.runtime` 메시지만(판별 유니온 `type`), `sender.id` 확인, `postMessage` 안 씀 | 엔지니어링 검토 4번(D-09) |
| 입력 | 각 프레임 content script가 `window` capture로 `document_start`에 등록, `isTrusted`만, 떨림 필터 → 모드 판정 → 기능 | 설계 4·5장(D-06, D-09) |
| 프레임 | 한 프레임 안의 일(자석·테두리·머무르기·입력칸 판정)은 그 프레임에서, 번호표·모드 표시·확인 화면은 맨 위 프레임 | 엔지니어링 검토 1번(D-02, D-03) |
| UI | 프레임워크 없는 순수 DOM + Shadow DOM(open) + `docs/design/tokens.css`만 | SYSTEM.md(D-26). Preact는 명령판이 오는 Phase 3에서 따로 승인 |
| 인증 | 없음 | 서버·계정 없음 |
| 배포 대상 | Phase 1은 로컬(`pnpm build` → `.output/chrome-mv3`를 압축 해제로 로드). 웹스토어 비공개 배포는 Phase 2 | 설계 7·8장, ROADMAP Phase 2 |
| 시험 | Vitest 5(순수 함수) + Playwright 1.63(확장 로드, `page.route`로 `practice.test`·`other.test` 두 출처에 `tests/practice-site/` 제공), CI는 Chromium만 | 설계 10장(D-28, D-29) |
| 디렉터리 | `src/entrypoints/`(background·content·popup) · `src/core/`(순수) · `src/page/`(DOM) · `src/worker/` · `src/shared/` · `tests/unit` · `tests/e2e` · `tests/practice-site` | RESEARCH.md "Recommended Project Structure" |

## Stack Touched in Phase 1

- [ ] Project scaffold (WXT, TypeScript strict, ESLint, Vitest, Playwright) — Plan 01-01
- [ ] Routing — 확장 진입점: service worker, 모든 프레임 content script, 팝업 — Plan 01-01·01-02
- [ ] Database — `storage.sync` 실제 쓰기(팝업 끄기)와 읽기(content script 반영) — Plan 01-01·01-02
- [ ] UI — 팝업의 "도우미 끄기" 카드가 모드 표시를 켜고 끔 — Plan 01-02
- [ ] Deployment — 문서화된 로컬 실행: `pnpm build` 후 크롬 "압축해제된 확장 프로그램 로드"로 `.output/chrome-mv3`, 자동 확인은 `CI=true pnpm test:e2e`

## Out of Scope (Deferred to Later Slices)

- 명령판·키 스크롤·되돌리기·입력 줄이기·양식 한 장 보기·민감칸·컨디션 모드·맞춤 설정(Phase 3)
- 틀 자동화·알림 창 가로채기·활동 기록(Phase 4), 작업판·뒤에서 실행(Phase 5), 화면 정리 AI(Phase 6)
- 웹스토어 비공개 배포·설치 화면 권한 안내(Phase 2), 회사 시스템 클릭 확인(회사 시스템 완성 뒤)
- Preact·Lucide 아이콘·flatbush(필요해지는 phase에서 따로 승인)

## Subsequent Slice Plan

Phase 1 안에서 뼈대 위에 쌓는 조각(각 조각 뒤에 이용자가 새로 할 수 있는 일이 생긴다):

- 01-03: 떨림 재입력·자동 반복·의도치 않은 더블클릭이 한 번으로 줄고, 입력칸에서는 글자가 입력되며 모드 표시가 "입력 중"/"도우미"로 바뀐다
- 01-04: 커서를 대충 가져가면 가장 가까운 요소가 굵은 테두리로 잡히고, 화면이 바뀌거나 스크롤해도 따라온다
- 01-05: 잡힌 요소가 클릭·스페이스바로 눌리고, 사이트 자체 단축키보다 도우미 키가 먼저 동작한다
- 01-06: 번호표를 켜서 숫자 키로 누른다(고정 → 자주 → 근처)
- 01-07: iframe(중첩·다른 출처) 안 요소에도 번호가 겹침·중복 없이 붙고 눌린다
- 01-08: 위험한 버튼은 끌려오지 않고 빨간 점선으로 표시된다
- 01-09: 번호로 위험한 버튼을 고르면 1초 보호 뒤 Enter로만 누르는 확인 화면이 뜬다
- 01-10: 머무르기 클릭 / 01-11: 끌어서 놓기 두 번 누르기
- 01-12: 대신 누르기 한계(연습 사이트만) 스파이크 기록
- 01-13: 사이트별 끄기·"도울 수 없음" / 01-14: 형식 변환 실패 보존·옛 도우미 정리
- 01-15: 사이트를 확대·축소해도 테두리·번호표·모드 표시·확인 화면이 같은 크기
- 01-16: 오버레이 서체·5,000요소 50ms 측정·독립 DOM 감사·전체 `CI=true` 게이트

이후 phase는 이 뼈대의 결정(저장 규칙·메시지·프레임 분담·오버레이 규칙)을 바꾸지 않고 조각을 더한다:

- Phase 2: 중간 이용자 시험(연습 사이트) + 웹스토어 비공개 배포 (회사 시스템 클릭 확인은 회사 시스템 완성 뒤)
- Phase 3: 명령판(0)을 입구로 이동·입력·컨디션
- Phase 4: 틀 자동화 + 활동 기록
- Phase 5: 작업판·뒤에서 실행·반복 패턴 알림
- Phase 6: 화면 정리(AI)
