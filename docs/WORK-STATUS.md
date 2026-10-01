# 작업 현황표

갱신: 2026-10-01 18:55 KST · [draft PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) · 로컬 `codex/single-switch-phase1` → 원격 `codex-single-switch-phase1`

최신 사용자 승인(계획 제시 뒤 `진행해`)에 따라 제품 구현을 계속한다. 별도 문서 체크포인트 `58cc6e8`은 `codex/single-switch-design-checkpoint`에 보존했으며 개발 승인을 설계 대기로 되돌리지 않는다.

기존 GSD/인계/요구사항과 새 8단계의 연결·대체 계약은 [프로젝트 매핑](superpowers/plans/2026-10-01-single-switch-project-map.md)에 저장했다. 공식 GSD 상태 명령으로 결정·재개 위치만 기록했으며 planner/checker/verify-work/phase 완료는 수행하지 않았다. 기존 19개 PLAN/SUMMARY와 human_needed 기록은 보존한다. 코드·설계·계획·운영 규칙·현황·후속 회귀 초안을 Git/PR에 저장한다. 런타임 인증정보·캐시는 제외한다.

| 최신 체크포인트 | 실제 결과 | 남은 작업 |
|---|---|---|
| 원격 안전 수정 | `295a2aa` (제품 `dcbc395`) PR15에 보존; 아래 후속 수정도 같은 head에 저장 | draft 유지, merge/deploy 없음 |
| 전체 로컬 `ui-review --full` | **288/290 pass, 2 fail**, 14.9분, exit1 | 최종 수정 뒤 전체 합격 미확정; 이유는 아래 |
| UI 기본 범위 / 새 DOM | 같은 full JSON에서100/100, 새 DOM3/3 pass. 360/768/1280px 선택56px·글자18px·페이지scroll0, screenshot 직접 검토 | 패널 내부 스크롤 때 heading/status가 위로 사라지는 UX 보완 검토 |
| CI58 (1b7fb0a) | E2E262 pass/3 fail | 초기typing2/drag준비조건1, CI59에서 해당3건 pass |
| CI59 (295a2aa) | **289/290 pass, 1 fail**, 15.3분; type/lint/unit pass. 최종failure | unknown test recovering 기대/paused 수신. 아래 실제계약 회귀로 조사·수정 |
| unknown+탐색 경합 | 추가 RED: paused에서 결과불명 안내 소실. 수정 후 탐색없는 recovering/탐색후 paused 각각3회 **6/6 pass**, 클릭1·자동재실행0·재개는선택아님 | 새 HEAD CI 결과 확인 필요 |
| 문서 편집기 현재초점 표시 | 전역 끄기 중 이동한 초점이 다시켜기 때 반영되지 않는 RED→현재모드 재보고/표시갱신. 관련4사례×3 **12/12 pass** | 초기typing 간헐 원인 전체를 확정한 것은 아님 |
| 로컬 full의 재누름 실패 | 200ms 대기가 기본300ms 떨림 보호와 겹침. 새누름은350ms 뒤로 맞춤; 빠른거절/F1·본문불변·typing 단언 유지, 위12에 포함 | 완전한 최종 전체 결과는 후속CI |
| 늦은승인/작업ID/끄기/제출/프레임/한글삭제 | RED→안전묶음23·추가경계15·ID1·자식탐색1 pass (서로겹침) | 전체 합격으로 합산하지 않음 |
| 최신 type/lint/unit/build | exit0/exit0/21파일131개 exit0; 집중E2E의production build 성공 | 최종head CI 종료는 다음 재개에서 확인 |
| 독립 review/cso/QA | 앞선4지적과 추가2경계를 수정·재검토. 마지막표시/fixture수정은 주구현자 실제회귀검증 | 최종HEAD 독립·전체 검토를 포괄 완료로 표시하지 않음 |
| 8단계/사용자 검증 | 첫Space 웹활동 통과, 전체8단계 계약 완료는 아님 | 입력칸 선택범위 capture/복원 계약 미구현(현재값/초안 커서만 처리). 실제PC IME·사용성·지원사이트 시험 미실행 |

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

최신 재개: CI59는 진행 중이 아니라 최종 실패다. 후속 수정의 현재 HEAD는 새 CI 자동 실행 대상이며 이 체크포인트는 종료 결과를 미리 통과로 기록하지 않는다. 새 CI 종료 확인→필요한 원인 조사/영향검사→단계5 선택범위 계약·단계8 UI/PC 검증으로 이어간다. 승인된 설계/구현/push를 다시 승인 대기로 되돌리지 않는다. 기존290 full은 반복 실행하지 않았다.
