# 작업 현황표

갱신: 2026-10-01 16:13 KST · 브랜치: `codex/single-switch-phase1-design`

이 표는 사용자 보고용 현황이다. GSD 페이즈 상태의 원본은 `.planning/`이며 이 표가 이를 대체하지 않는다. 통과는 아래 실제 실행 범위에 한정한다.

| 작업 | 상태 | 실제 검증·근거 | PR | 다음 단계 |
|---|---|---|---|---|
| 새 클라우드 환경 확인 | 완료 | 선택 환경 ready, 기준 SHA `64976a7`, 게시 규칙 확인. 설정 version 메타데이터 일치는 별도 확인 못 함 | PR 미생성 | 현재 환경에서 후속 작업 |
| 기존 확장 기준선 | 통과 | CI 프로덕션 build·확장 로드 smoke 3/3·typecheck·lint·unit 115/115. 2026-10-01 실행 | PR 미생성 | 관련 변경 시 필요한 검사만 실행 |
| 관련 E2E | 실패 잔존 | 70 pass / 2 fail, exit 1. `doc-editor.e2e.ts:64, :280` 모드 복귀/조합 보호. 원인 미확정 | PR 미생성 | 승인 후 좁힌 재현·원인 조사 제안 |
| 1차 단일 스위치 설계 | 사용자 승인 대기 | 설계 파일 작성·전문 전달·Library 저장 완료. `libfile_12389aee1b948191b3c77c1db73bc0dc` | PR 미생성 | 검색→결과 읽기 시나리오와 설계 검토 |
| 모델·추론 매핑 / 새 세션명 규칙 | 로컬 저장·커밋 완료 | `e7614ab`: AGENTS·Codex 설정만 포함. TOML 파싱·제공 스키마·매핑·diff 확인 통과 | PR 미생성 | 새 세션 생성 쪽에서 기준 명시. 다른 checkout 반영은 별도 단계 |
| Node 버전 일치 | 조정 필요 | cloud 24.19.0 / CI 22 고정. package engines는 >=22, 게시 클라우드 스크립트에는 Node22 핀 없음 | PR 미생성 | 후속 환경 조정 여부 결정. 이번에 설치·변경 없음 |
| 제품 구현 | 시작 전 | 새 제품 코드 변경 없음. 설계 승인·구현계획 검토 전 | PR 미생성 | 설계 승인 후 계획 작성·실행 방식 결정 |
| 작업 현황표 / 유지 지침 | 로컬 저장·커밋 완료 | 이 파일과 AGENTS 유지 지침만 포함한 `docs: add maintained work status table` 커밋. 필수 항목·유지 지침·diff 정적 확인 통과 | PR 미생성 | 상태 변경 때 갱신하고 사용자에게 표시 |
| 원격 반영 | 미실행 | 이번 작업에서 push·새 PR·merge·배포·환경 재게시 없음 | PR 미생성 | 별도 사용자 요청 범위에서 진행 |

검증 로그: `/tmp/single-switch-smoke.log`, `/tmp/single-switch-type.log`, `/tmp/single-switch-lint.log`, `/tmp/single-switch-unit.log`, `/tmp/single-switch-focused-e2e.log`. 상세 실패와 미실행 범위는 [1차 설계 문서](superpowers/specs/2026-10-01-single-switch-phase1-design.md) §10에 있다. 전체 E2E·화면 자동 검토·실제 PC 사용성은 이번 미실행이다.
