# 단일 스위치 1차 검증 기록

2026-10-01 18:25 KST · draft PR15 · 기준 main `64976a778d13ac884fbce8b4027be433d8d0c4fe`

승인된 8단계 구현과 push/draft PR 갱신 범위다. merge·배포·2차 실행기·권한 변경은 하지 않았다. 게시된 cloud의 Node24.19.0/pnpm10.33.0/준비 Chromium153을 재사용했고 새 설치·환경 재생성은 없다. CI는 Node22다.

## 실제 검사와 수정

- 기본 Space 링크→한글 새 문장·중간 수정→검색→본문/스크롤→뒤로→탭 전체 여정 통과. 기존 영향84/84, unit130의 선행 결과와 이후 검사 범위를 구분한다.
- 늦은 apply 응답 뒤 후속 search: 실제 RED→modeGeneration 재검사 GREEN.
- 실행 전 부모 확인과 최종 authorization 응답 지연 뒤 쉬기: 각각 RED 클릭1→source 문서/모드 세대·자식 취소 전파·최종 검사로 클릭0.
- timeout/unknown→resume→새 executing 중 옛 authorization: 현재 pendingAction ID 검사만 일시 제외한 RED에서 done, 원본 복원 GREEN에서 refused. 옛 클릭0, 새 명시 클릭1.
- 전역/사이트 disable: RED에서250ms 동안 scrollY8→26, 명시적 전환 정리 후 정지·패널 제거·재개 release만 소비. 최초 enabled 초기화는 입력 capture를 초안 복구로 잘못 취급하지 않도록 구분.
- form action/method 및 submitter formaction/formmethod/formtarget 변경5건: RED 제출1→실효 제출 설정 identity 재검사 GREEN 제출0.
- 부모 hidden/inert/전체 clip, 추가 부분 clip: 확인 취소·관계/부모 문서/현재 가시성 검증. 부분 노출 iframe은 단일 스위치에서 보수적으로 제외(기존 pointer 수집 유지).
- iframe src 속성 변경과 별개로 자식 location 탐색: 실제 RED(확인/대상 상태 잔존)→탭 loading 때 기존 대상 폐기, 새 문서 보고는 invalidate. 원래 초안 보존·그룹에서 새 입력칸 선택 GREEN1.
- legacy F→1: RED 클릭1→exclusive 입력 소유권과 공통 pressOrDrag 차단 후 클릭0. switch 진입 때 기존 확인/끌기 예약도 취소.
- 민감 textarea/OTP 단위: RED→capture 거부 GREEN. 미완성 한글 삭제: RED에서 완성된 가 삭제→중성→초성 단계 취소 GREEN.
- unknown 응답 자동 재시도0, 프레임 교체, worker port 단절 뒤 초안 보존·새 선택 통과. CDP로 real worker target을 종료한 시도는 대체 serviceworker 이벤트를10초 내 관찰하지 못했다. 이것을 실제 worker 정지/재시작 통과로 간주하지 않는다. 기존 lifecycle의 실제 browser 재실행과 연결 프로토콜 검사를 구분한다.

새 안전/DOM 묶음23/23(3.0분), 추가경계15/15(2.7분), 작업ID1/1(12.6초), 자식 탐색1/1(13초) 통과. 이 묶음은 서로 겹치므로 합계로 독립 테스트 수를 만들지 않는다. 최신 cheap gate type/lint exit0, 전체 unit21파일131개 exit0. 전체 로컬 E2E/UI와 최종 HEAD CI는 다음 실행에서 기록한다.

## review · QA · cso · design-review

준비된 Superpowers 요청 검토와 gstack review/qa/cso/design-review 지침을 적용했다. 독립 gpt-6.1-sol/high 에이전트는 읽기전용 전체 변경·승인 계약·로그를 검토했고 직접 실행했다고 주장하지 않았다. P1 지연 실행·legacy 우회와 P2 민감 textarea·조합 삭제를 수정했다. 추가 지연 승인/작업ID 경계까지 재검토한 결과 새 미해결 P1/P2 없음. 실제 실패·수정·재실행은 주 구현자가 수행했다.

보안 검토는 Chrome sender tab/frame/id, strict 실행 payload, 문서·모드·작업ID 권한, 민감 capture 제외, actionId 중복 방지, no retry, 제출 identity, 부모 관계·가시성, 기존 실행 진입점에 한정한다. OWASP 전체 인증·백엔드·외부 서비스 검증이나 침투 시험 통과를 주장하지 않는다. 새 extension 권한·네트워크 요청·외부 서비스 데이터 수집은 추가하지 않았다.

실제 DOM은360/768/1280px에서 label/list/listitem/aria-current, 최소48px 표적·15px 글자, 패널/선택 항목 경계, 페이지 scroll0를 측정했다. screenshot/측정 JSON을 전체 UI 보고서에 보존한다. 기존 토큰과 승인된 작업판의 지속 명령면 예외를 SYSTEM에 기록했다. 전체 screen-reader 운용 합격이나 모든 줌/실사이트 접근성을 보장하지 않는다.

## CI와 남은 검증

[CI58](https://github.com/rrangjaa-eng/project_260923/actions/runs/36837027233): HEAD1b7fb0a, tested merge fdd7b290cc9b3d407eeab480e9f521e960dbda8b. type/lint/unit pass, E2E262pass/3fail. doc-editor 초기 typing2와 drag settings undefined1. fixture는 API 주입과 실제 기본 설정 저장 완료를 구분해 대기하도록 보강했다. 이3사례×5 현재 cloud15/15pass(22초); doc-editor 간헐 원인은 미확정이다. 테스트를 스킵하거나 단언을 약화하지 않았다. 최종 전체/Node22 CI에서 재관찰한다.

실제 PC의 OS IME, 운동 사용성·피로/오선택/속도, 지원 실사이트 한 곳 시험은 미실행이다. 권장 다음 사용자 시험은 검색→읽기이며 최초1.5초 순환/0.3초 입력 보호를 실제 사용자가 조절한다. 지원 범위는 plain input/textarea·GET 검색 form과 수집 가능한 페이지 대상이다. rich editor 직접 삽입·브라우저 밖 전역 정지·파일 창·전체 GSD phase 완료는 보장하지 않는다.

## 재현과 운영 기록

`source /workspace/.cloud-onboarding/workflow-env.sh`; cheap gate `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`; 실제 production extension `CI=true pnpm exec playwright test ...`; 최종 전체 자동 검토 `ui-review --full`. 현재 목록은30파일290개다. 브라우저 실행 실패가 아니라 실제 DOM assertion 실패를 재현했다.

상세 임시 로그: `/tmp/switch-safety-final.log`, `/tmp/switch-final-boundaries.log`, `/tmp/switch-old-action-id-{red,green}.log`, `/tmp/switch-child-navigation-{red,trace}.log`, `/tmp/switch-ci58-focused.log`, `/tmp/switch-checkpoint-final-{type,lint,unit}.log`. 이 문서의 결과·범위·명령이 Git에 남는 기록이고 임시 파일은 보조 증거다.

Codex config는 제공0.159.0-alpha.3 스키마 검증 통과. 자동 압축 임계값을 미설정으로 모델 기본값 보존, 전체 문맥 total scope만 명시했다. 임의 context window/토큰 임계값이나 현재 호스팅 세션의 적용·압축 실행을 주장하지 않는다. AGENTS/현황/계획은 승인·PR·브랜치·검사·남은 계약을 복원 기준으로 보존한다.

## 18:55 KST 전체 실행 종료와 후속 체크포인트

실제 `ui-review --full` 결과는288pass/2fail/0skip/0flaky,14.9분,exit1이다. `run-Wb5Kjn/results.json` 및 HTML/로그는 `/workspace/.cloud-onboarding/ui-review-runs/run-Wb5Kjn/`에 있다. 같은 JSON에서 기존 UI 기본7파일100건100pass, 신규 작업판 DOM3pass를 추출했다. 선택행 높이56px, 폰트18px,360/768/1280px 패널경계와page.scrollY0를 측정하고 screenshot을 직접 읽었다. screenshot은 전체패널이 스크롤되면 제목/상태도 위로 사라짐을 보여 준다. 지속 맥락 표시 UX 보완은 후속이며 모든 디자인 기준 통과로 표시하지 않는다.

[CI59](https://github.com/rrangjaa-eng/project_260923/actions/runs/36842952628)는 HEAD295a2aa에서 **completed/failure**:289pass/1fail(15.3분). type/lint/unit pass. 유일 실패는 switch-pending의 응답유실 시험에서 recovering 대신 paused다. CI58의3실패는 이번 CI에서 통과했으며 초기typing의 모든 간헐 원인을 해결했다고 단정하지 않는다.

원래 lost-reply fixture는 실제 anchor fragment 탐색도 일으켰다. 대상loading 폐기가 unknown과 경쟁하여 paused가 되는 것은 안전하지만, 모드세대가 바뀌었다는 이유로 늦은unknown 결과의 안내까지 무시한 **제품 표시 결함**을 별도 RED로 확인했다. 두 경우를 분리했다: 탐색 없는 fixture는 recovering을 계속 요구하고, 탐색 있는 fixture는 대상폐기된 paused에서 명시적결과불명 안내를 추가로 요구한다. 수정은 실행권한·재개동작을 복원하지 않고 진단만 보존한다. 둘×3 실제E2E6pass(32.8초), 클릭1·자동재실행0·재개입력 선택0. 단순 기대값 완화나 스킵이 아니다.

로컬 full의 designMode 재누름 typing 실패는 helper가200ms만 기다려 기본300ms 보호와 겹칠 수 있는 준비 조건도 있었다. 새누름 복귀는350ms 뒤로 맞추고 빠른 재누름 거절/F1 시험은 그대로 유지했다. 별도로 꺼진 동안 편집기 초점이 바뀌면 다시켜기 때 currentMode 보고가 누락되는 실제 RED를 재현하여 child 재보고/top표시 갱신을 수정했다. 관련4사례×3 E2E12pass(29.1초), 마지막type/lint/unit131pass,production build pass. 전체를 재실행하여 통과했다고 주장하지 않는다.

후속 code/문서/GSD 재개 기록을 같은 PR15에 보존한다. 최종 HEAD의 새 CI 종료와 단계8 전체·독립 검토는 다음 재개에서 확인한다(부모의 이번 턴 안전 체크포인트 지시). 단계5 원 계획의 입력칸 선택범위 기억/복원은 현재 `captureTextTarget` 값만 구현되어 남아 있다. 이것을 PC 검증 미실행과 혼동하지 않는다. 실제PC OSIME/운동 사용성/지원 실사이트도 별도 남는다.
