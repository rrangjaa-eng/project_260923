# 작업 현황표

갱신: 2026-10-01 17:08 KST · 현재 브랜치: `codex/single-switch-phase1` (승인된 계획 구현)

최신 사용자 승인(계획 제시 뒤 `진행해`)에 따라 제품 구현을 계속한다. 별도 문서 체크포인트 `58cc6e8`은 `codex/single-switch-design-checkpoint`에 보존했으며 개발 승인을 설계 대기로 되돌리지 않는다.

| 최신 체크포인트 | 실제 결과 | 남은 작업 |
|---|---|---|
| 한글 새 문장·중간 수정·검색·읽기·뒤로·열린 탭 | 실제 Space만으로 전체 여정 통과 | 지원 실사이트·PC 사용성은 별도 |
| 한글 완료 후 상위 메뉴 복귀 | 실제 E2E 실패 재현 → 수정 → 통과 | 조합 취소·쉬기·복구 추가 검사 |
| 위 신규 E2E / typecheck / lint | 2/2 (2.8분), exit 0 / exit 0 / exit 0 | 이후 안전 변경은 영향 검사 재실행 |
| 위험·대상 변경·무입력 확인 | 회귀 검사 작성·진행 중 | 안전 경계 수정·회귀·최종 리뷰/QA |

로그: `/tmp/switch-editor-parent-red.log`, `/tmp/switch-journey-first.log`, `/tmp/switch-journey-type.log`, `/tmp/switch-journey-lint.log`. 초기 조회 기준 unit125·관련E2E22는 이번 여정 전에 통과한 기반이며 전체 기능 완료를 의미하지 않는다.

이 표는 사용자 보고용 현황이다. GSD 페이즈 상태의 원본은 `.planning/`이며 이 표가 이를 대체하지 않는다. 통과는 아래 실제 실행 범위에 한정한다.

| 작업 | 상태 | 실제 검증·근거 | PR | 다음 단계 |
|---|---|---|---|---|
| 새 클라우드 환경 확인 | 완료 | 선택 환경 ready, 기준 SHA `64976a7`, 게시 규칙 확인. 설정 version 메타데이터 일치는 별도 확인 못 함 | PR 미생성 | 현재 환경에서 후속 작업 |
| 기존 확장 기준선 | 통과 | CI 프로덕션 build·확장 로드 smoke 3/3·typecheck·lint·unit 115/115. 2026-10-01 실행 | PR 미생성 | 관련 변경 시 필요한 검사만 실행 |
| 기존 입력 실패 / 단계1 | 관련 경계 수정·검증 완료 | 기존 두 실패 이번 4/4 및 반복20/20 통과, 간헐 원인은 미확정. 늦은 비활성 프레임 보고 회귀 RED→수정 후 관련 E2E52 통과. `b00f90a` | PR 미생성 | 최종 회귀에서 간헐 실패 관측 계속 |
| 1차 단일 스위치 설계 | 사용자 승인됨 | 2026-10-01 개발절차 진행 승인·정정 전달. 기존 Library 검토안 `libfile_12389aee1b948191b3c77c1db73bc0dc` | PR 미생성 | 승인 설계를 구현계획으로 연결 |
| 1차 구현계획 | 사용자 실행 승인됨 | 기존 클라우드 직접 단계별 실행 승인. Library `libfile_5afac0f680c881919d6a4c6adde9d209` | PR 미생성 | 승인된 8단계 순차 진행 |
| 모델·추론 매핑 / 새 세션명 규칙 | 로컬 저장·커밋 완료 | `e7614ab`: AGENTS·Codex 설정만 포함. TOML 파싱·제공 스키마·매핑·diff 확인 통과 | PR 미생성 | 새 세션 생성 쪽에서 기준 명시. 다른 checkout 반영은 별도 단계 |
| Node 버전 일치 | 조정 필요 | cloud 24.19.0 / CI 22 고정. package engines는 >=22, 게시 클라우드 스크립트에는 Node22 핀 없음 | PR 미생성 | 후속 환경 조정 여부 결정. 이번에 설치·변경 없음 |
| 제품 구현 / 단계2 | 첫 수직 흐름 통과 | Space 시작→페이지 항목→링크 실행1회 실제 CI E2E pass (6.7초). type/lint pass, 신규 단위6파일10 pass | PR 미생성 | 다음 단계3~7 통합 검증 계속 |
| 제품 구현 / 단계3~5 | 코드 작성·통합 검증 진행 중 | 프레임 실행 중계/가드, 작업판, 한글 조합/편집·문구/입력 적용 코드 저장. 단위 통과. 전체 웹 여정은 아직 검증 전 | PR 미생성 | 한글 작성·수정→검색 실제 여정, 프레임/중복/민감칸 검사 |
| 제품 구현 / 단계6~8 | 미완료 | 읽기/스크롤/뒤로/탭·확인/복구 초안 연결됨. 통합/회귀/독립 리뷰·QA·보안·사용자 검증 미실행 | PR 미생성 | 승인된 계획 순서로 검사·수정·최종 인계 |
| 작업 현황표 / 유지 지침 | 로컬 저장·커밋 완료 | 이 파일과 AGENTS 유지 지침만 포함한 `docs: add maintained work status table` 커밋. 필수 항목·유지 지침·diff 정적 확인 통과 | PR 미생성 | 상태 변경 때 갱신하고 사용자에게 표시 |
| 원격 반영 | 개발 우선 정정으로 보류 | push·PR 생성 전 중단. 준비 중 typecheck/lint는 실제 통과. 원격 main SHA `64976a7` 확인; gh API는 Forbidden | PR 미생성 | 규칙 PR을 선행조건으로 삼지 않고 개발계획 우선 |

검증 로그: `/tmp/single-switch-smoke.log`, `/tmp/single-switch-type.log`, `/tmp/single-switch-lint.log`, `/tmp/single-switch-unit.log`, `/tmp/single-switch-focused-e2e.log` (현재 클라우드의 로컬 로그). 상세 설계와 실패 증거는 위 Library 문서에 있으며 설계 파일은 이번 PR에 포함하지 않는다. 전체 E2E·화면 자동 검토·실제 PC 사용성은 이번 미실행이다.

최신 구현 로그: `/tmp/switch-task1-green.log` (관련52 pass), `/tmp/switch-mode-report-red.log` (늦은 프레임 모드 보고 RED), `/tmp/switch-click-proxy.log` (실제 Space 링크 실행 pass), `/tmp/switch-checkpoint-type.log`, `/tmp/switch-checkpoint-lint.log`, `/tmp/switch-checkpoint-unit.log` (신규10 pass).새 코드 검증 범위에 한정하며 전체 기능 완료를 의미하지 않는다. HTTP 문서에서 crypto.randomUUID 미지원과 content script의 storage.session 접근 차단을 실제 오류로 확인해 getRandomValues ID 및 백그라운드 읽기 중계로 수정했다.
