# 작업 현황표

갱신: 2026-10-01 19:54 KST · [draft PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) · 로컬 `codex/single-switch-phase1` → 원격 `codex-single-switch-phase1`

최신 사용자 승인(계획 제시 뒤 `진행해`)에 따라 제품 구현을 계속한다. 별도 문서 체크포인트 `58cc6e8`은 `codex/single-switch-design-checkpoint`에 보존했으며 개발 승인을 설계 대기로 되돌리지 않는다.

기존 GSD/인계/요구사항과 새 8단계의 연결·대체 계약은 [프로젝트 매핑](superpowers/plans/2026-10-01-single-switch-project-map.md)에 저장했다. 공식 GSD 상태 명령으로 결정·재개 위치만 기록했으며 planner/checker/verify-work/phase 완료는 수행하지 않았다. 기존 19개 PLAN/SUMMARY와 human_needed 기록은 보존한다. 코드·설계·계획·운영 규칙·현황·후속 회귀 초안을 Git/PR에 저장한다. 런타임 인증정보·캐시는 제외한다.

| 최신 체크포인트 | 실제 결과 | 남은 작업 |
|---|---|---|
| 원격 저장 | 선택·패널 `0dfb4ba` 원격 보존, 표시 보완도 같은 Draft PR15로 저장 | 최종 HEAD CI 결과는 PR checks/최종 보고와 구분해 확인 |
| CI60 (`e3287e1`) | **최종 success, E2E292/292**, type/lint/unit131 pass | 후속 선택·패널 변경까지 포함한 결과는 아님 |
| 선택범위·초점 복원 | `0dfb4ba`: input/textarea 범위·방향 capture, grapheme cursor/anchor, 선택 교체/삭제/undo. 유효한 대상의 명시적 복원만 focus | 실제 PC·실사이트 검증은 후속 |
| 적용과 포커스 분리 | 이메일 선택 API 미지원 및 focus 중 종류 변경 RED→단위 GREEN. 적용은 초점 이동 없이, 복원은 값·유형·활성 상태 재검증 | 최종 CI 확인 |
| 작업판 지속 맥락 | 목록만 스크롤. 360/768/1280px에서 제목 top31px, 상태 top75.8px, 선택56px·글자18px·페이지scroll0. screenshot 직접 확인 | 모든 줌/스크린리더 검증으로 확대하지 않음 |
| 최신 단위·type/lint | 전체21파일135개 pass, type/lint exit0 | 새 최종 HEAD 원격 CI |
| 선택·패널 E2E | 6/6 pass. 전체 switch 영향40/41(9.2분), 공백 fixture 실제 커서를 끝으로 명시한 재검사1/1 pass | full296에서 해당 시나리오도 통과 |
| 전체 로컬 UI/E2E | `0dfb4ba`의 `run-FpP8BY`: **296/296 pass**, 0 fail/skip/flaky,16.2분,exit0. switch41·기본UI100·확장로드smoke3 모두 같은 실행의 부분집합 | 이후 작은 표시 보완까지 이 전체 통과에 포함하지 않음 |
| 최종 표시 보완 | 선택/삽입 위치를 토큰 기반 mark/caret으로 표시하고 긴 초안 내부만 scroll. 마우스 전환 전 작업판 종료 표시. 3건 RED→입력5 포함8/8 GREEN, 긴 초안 상태·경계 재검사1/1 pass | 최종 전체 CI 확인 |
| 최종 기본 UI | 새 표시 코드의 `run-jwbVzP`: **100/100 pass**,0 fail/skip/flaky,3.2분,exit0. type/lint pass | 이전전체296과 합산하지 않음 |
| 독립 review/cso/QA | 신규 선택·포커스·패널 및 후속 표시 코드 읽기 검토: 새 미해결 P1/P2 없음. 기존 안전 검토와 실제 회귀 근거 보존 | 실제 OS·운동 사용성은 별도 |
| PR 본문 | child에서는 명시 승인 인용도 도구 출력으로 분류돼 재거절. 부모가 주 대화의 직접 승인으로19:46 KST 실제 갱신·본문 확인 성공 | 이후 최종 결과의 본문 갱신은 부모가 처리. child 추가 재시도 없음 |
| 자동 압축 설정 | 제공 CLI0.159.0-alpha.3 스키마 pass. 임계값 미설정=모델 기본값 보존, scope=`total` | 현재 호스팅 세션 적용·실행 상태는 관찰 불가 |
| 1차 사용자 검증 | 실사이트·실제PC IME·오선택·피로·속도는 미실행. [재현 인계](verification/2026-10-01-single-switch-pc-check.md) 작성 | 사이트 선정은 자동 구현/검증 차단 사유가 아님 |

로그: `/tmp/switch-editor-parent-red.log`, `/tmp/switch-journey-first.log`, `/tmp/switch-safety-red.log`, `/tmp/switch-pause-red.log`, `/tmp/switch-mode-confirm-red.log`, `/tmp/switch-journey-safety-green.log`, `/tmp/switch-integration-unit.log`, `/tmp/switch-pr-{type,lint}.log`, `/tmp/switch-impact-regression.log`. 초기 조회 기준 unit125·관련E2E22는 이번 여정 전에 통과한 기반이며 전체 기능 완료를 의미하지 않는다.

이 표는 사용자 보고용 현황이다. GSD 페이즈 상태의 원본은 `.planning/`이며 이 표가 이를 대체하지 않는다. 통과는 아래 실제 실행 범위에 한정한다.

| 작업 | 상태 | 실제 검증·근거 | PR | 다음 단계 |
|---|---|---|---|---|
| 새 클라우드 환경 확인 | 완료 | 선택 환경 ready, 기준 SHA `64976a7`, 게시 규칙 확인. 설정 version 메타데이터 일치는 별도 확인 못 함 | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 현재 환경에서 후속 작업 |
| 기존 확장 기준선 | 통과 | CI 프로덕션 build·확장 로드 smoke 3/3·typecheck·lint·unit 115/115. 2026-10-01 실행 | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 관련 변경 시 필요한 검사만 실행 |
| 기존 입력 실패 / 단계1 | 관련 경계 수정·검증 완료 | 기존 두 실패 이번 4/4 및 반복20/20 통과, 간헐 원인은 미확정. 늦은 비활성 프레임 보고 회귀 RED→수정 후 관련 E2E52 통과. `b00f90a` | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 최종 회귀에서 간헐 실패 관측 계속 |
| 1차 단일 스위치 설계 | 사용자 승인됨 | 2026-10-01 개발절차 진행 승인·정정 전달. 기존 Library 검토안 `libfile_12389aee1b948191b3c77c1db73bc0dc` | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 승인 설계를 구현계획으로 연결 |
| 1차 구현계획 | 사용자 실행 승인됨 | 기존 클라우드 직접 단계별 실행 승인. Library `libfile_5afac0f680c881919d6a4c6adde9d209` | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 승인된 8단계 순차 진행 |
| 모델·추론 매핑 / 새 세션명 규칙 | 로컬 저장·커밋 완료 | `e7614ab`: AGENTS·Codex 설정만 포함. TOML 파싱·제공 스키마·매핑·diff 확인 통과 | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 새 세션 생성 쪽에서 기준 명시. 다른 checkout 반영은 별도 단계 |
| Node 버전 일치 | 조정 필요 | cloud 24.19.0 / CI 22 고정. package engines는 >=22, 게시 클라우드 스크립트에는 Node22 핀 없음 | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 후속 환경 조정 여부 결정. 이번에 설치·변경 없음 |
| 제품 구현 / 단계2 | 첫 수직 흐름 통과 | Space 시작→페이지 항목→링크 실행1회 실제 CI E2E pass (6.7초). type/lint pass, 신규 단위6파일10 pass | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 다음 단계3~7 통합 검증 계속 |
| 제품 구현 / 단계3~5 | 주요 통합 통과·잔여 계약 검사 필요 | 새 한글·중간 수정·입력 적용 및 안전 실행 경계 실제 검사 통과. 전체unit130 통과 | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 기존 입력 실행 통합, 프레임/중복/민감칸 검사 확대 |
| 제품 구현 / 단계6~8 | 첫 웹 활동 통과·최종 검증 미완료 | 읽기/스크롤 정지/뒤로/탭 전체 여정과 확인·복구 통합8 통과. 독립 리뷰·QA·보안·PC 검증 미실행 | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 승인된 계획 순서로 잔여 계약·최종 검사 |
| 작업 현황표 / 유지 지침 | 로컬 저장·커밋 완료 | 이 파일과 AGENTS 유지 지침만 포함한 `docs: add maintained work status table` 커밋. 필수 항목·유지 지침·diff 정적 확인 통과 | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 상태 변경 때 갱신하고 사용자에게 표시 |
| 원격 반영 | draft PR15 게시됨 | 기존 원격 `codex` 때문에 첫 push 경로 충돌. 기존 ref 보존 후 `codex-single-switch-phase1`에 게시. 같은 head 중복 PR 없음 확인 | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 같은 PR에서 잔여 구현·검증 계속. 병합·배포 없음 |

초기 검증 로그: `/tmp/single-switch-smoke.log`, `/tmp/single-switch-type.log`, `/tmp/single-switch-lint.log`, `/tmp/single-switch-unit.log`, `/tmp/single-switch-focused-e2e.log` (현재 클라우드의 로컬 로그). 설계·계획 원문은 Git과 PR15에 포함한다. 최신 검사 결과는 위 표에 한정한다. 전체 로컬 E2E·자동 UI 검토는 위 실패를 포함하며, 실제 PC 사용성은 미실행이다.

최신 구현 로그: `/tmp/switch-task1-green.log` (관련52 pass), `/tmp/switch-mode-report-red.log` (늦은 프레임 모드 보고 RED), `/tmp/switch-click-proxy.log` (실제 Space 링크 실행 pass), `/tmp/switch-checkpoint-type.log`, `/tmp/switch-checkpoint-lint.log`, `/tmp/switch-checkpoint-unit.log` (신규10 pass).새 코드 검증 범위에 한정하며 전체 기능 완료를 의미하지 않는다. HTTP 문서에서 crypto.randomUUID 미지원과 content script의 storage.session 접근 차단을 실제 오류로 확인해 getRandomValues ID 및 백그라운드 읽기 중계로 수정했다.

최신 재개: CI60은 최종 성공이다. 선택·패널의 full296 및 이후 표시의 집중8·기본UI100을 서로 구분했다. 최종 전체 CI는 해당 HEAD의 원격 실행 결과를 확인한다. 승인된 같은 PR15 구현·저장을 계속하며 설계 승인 대기로 복귀하지 않는다. 실제 PC 인계와 전체 GSD phase 완료를 자동 검사 합격과 혼동하지 않는다.
