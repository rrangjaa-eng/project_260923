# 작업 현황표

갱신: 2026-10-01 18:25 KST · [draft PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) · 로컬 `codex/single-switch-phase1` → 원격 `codex-single-switch-phase1`

최신 사용자 승인(계획 제시 뒤 `진행해`)에 따라 제품 구현을 계속한다. 별도 문서 체크포인트 `58cc6e8`은 `codex/single-switch-design-checkpoint`에 보존했으며 개발 승인을 설계 대기로 되돌리지 않는다.

기존 GSD/인계/요구사항과 새 8단계의 연결·대체 계약은 [프로젝트 매핑](superpowers/plans/2026-10-01-single-switch-project-map.md)에 저장했다. 공식 GSD 상태 명령으로 결정·재개 위치만 기록했으며 planner/checker/verify-work/phase 완료는 수행하지 않았다. 기존 19개 PLAN/SUMMARY와 human_needed 기록은 보존한다. 코드·설계·계획·운영 규칙·현황·후속 회귀 초안을 Git/PR에 저장한다. 런타임 인증정보·캐시는 제외한다.

| 최신 체크포인트 | 실제 결과 | 남은 작업 |
|---|---|---|
| 한글 검색·읽기·뒤로·탭 전체 여정 | 기존 실제 Space 여정 통과 | 현재 안전 변경 후 전체 회귀 예정 |
| 늦은 응답·실행 전달 전 쉬기 | 각각 RED 재현 → 승인 세대 재검증, 후속 검색/옛 클릭 0회 | 최종 전체 회귀 |
| 전역/사이트 끄기 | RED에서 250ms 뒤 스크롤 8→26; 수정 후 정지·패널 제거·새 release 재개 통과 | 실제 사용자 조작 검증 |
| 확인 중 제출 설정 변경 | action/method/formaction/formmethod/formtarget 5건 RED(제출1) → GREEN(제출0) | 모든 서비스 제출 지원 보장은 아님 |
| 부모 iframe hidden/inert/잘림 | RED에서 확인 상태 잔존 → 부모 관계·문서 세대·현재 clip 검증 후 목록 제외, 제출0 통과 | 실제 서비스 프레임 시험 |
| worker 연결·프레임 교체·unknown | 연결 단절 훅과 실제 iframe 탐색, unknown 응답 자동 재시도0 통과 | CDP real worker 종료는 대체 worker 이벤트 timeout; 실제 정지/재시작 통과 주장하지 않음 |
| 기존 숫자키 우회 | F→1 RED 실행1 → 단일 스위치 소유권 검사 후 실행0 | 모드 전환의 기존 예약 확인 추가 검사 |
| 민감 textarea·OTP | 단위 RED → capture 거부 GREEN | OS IME/실제 사용자 시험 별도 |
| 새 DOM/안전 묶음 | 23/23, 3.0분, exit0 (`switch-safety-final.log`) | 전체 자동 UI 검토 예정 |
| typecheck / lint / unit | type/lint exit0, 전체21파일131개 exit0 | 후속 조합 수정 검사 |
| CI #58 (HEAD 1b7fb0a) | type/lint/unit pass; E2E262 pass/3 fail | 설정 준비 조건 보강. 해당3사례×5 현재 cloud15/15 pass; editor 간헐 원인 미확정, 전체/새CI 관찰 |
| 독립 코드/보안/접근성 검토 | gpt-6.1-sol/high 지적 P1/P2 수정 후 추가 경계 검토: 새 미해결 P1/P2 없음 | 전체 UI/E2E·실제 PC는 별도 |
| 최종 지연 승인·작업 ID·조합 삭제·부분 가림 | 추가 RED 재현 → 관련15/15 + ID1/1 GREEN | 전체 회귀/CI 대기 |
| iframe src 속성 변경 없는 자식 탐색 | RED 확인 → loading 시 기존 대상 폐기 + 문서 교체 invalidate 후1/1 GREEN, 초안 보존·새선택 | 전체 회귀 |

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

초기 검증 로그: `/tmp/single-switch-smoke.log`, `/tmp/single-switch-type.log`, `/tmp/single-switch-lint.log`, `/tmp/single-switch-unit.log`, `/tmp/single-switch-focused-e2e.log` (현재 클라우드의 로컬 로그). 설계·계획 원문은 Git과 PR15에 포함한다. 최신 검사 결과는 위 표에 한정한다. 전체 로컬 E2E·자동 UI 검토는 다음 검사, 실제 PC 사용성은 미실행이다. CI #58은 위 실패를 포함한다.

최신 구현 로그: `/tmp/switch-task1-green.log` (관련52 pass), `/tmp/switch-mode-report-red.log` (늦은 프레임 모드 보고 RED), `/tmp/switch-click-proxy.log` (실제 Space 링크 실행 pass), `/tmp/switch-checkpoint-type.log`, `/tmp/switch-checkpoint-lint.log`, `/tmp/switch-checkpoint-unit.log` (신규10 pass).새 코드 검증 범위에 한정하며 전체 기능 완료를 의미하지 않는다. HTTP 문서에서 crypto.randomUUID 미지원과 content script의 storage.session 접근 차단을 실제 오류로 확인해 getRandomValues ID 및 백그라운드 읽기 중계로 수정했다.
