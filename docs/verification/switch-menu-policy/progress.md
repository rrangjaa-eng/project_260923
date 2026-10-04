# SDD ledger — plan: docs/superpowers/plans/2026-10-04-switch-menu-policy.md

2026-10-04 KST. 명세/계획72c183ed 및 순차 직접 구현→독립 검토 승인 후 시작. 제품62577af의 이력을 보존한 codex-switch-menu-b1. merge/deploy/ZIP 변경 제외.

Ruling: 기존 격리 클라우드 checkout에서 독립 브랜치 사용 — branch/worktree 요청과 AGENTS의 중복 worktree 지양을 함께 충족 — 잘못 판단하면 작업 격리 재점검 필요.
Ruling: executing-plans 부속 sdd-workspace/task-start/task-done 및 TDD writing-good-tests 리소스를 제공 경로/로컬 검색에서 찾지 못함 — 계획 본문을 직접 읽고 RED/GREEN·BASE·결정을 이 Git 추적 장부에 기록 — 자동 장부 도구가 주는 누락 방지 보장은 직접 대조로 대체.
Pre-flight: Task1 legacy 배열→Task3 more; Task2 InteractionLayout/guard→Task3 root/profile; Task3 UI→Task4/5 검증. 명칭·ID 일치. Task2 legacy만 노출은 Task3 short 공개와 구분.
Ruling: 단계별 관련 회귀 및 전체 단위, 최종 통합CI 사용 — 승인된 계획대로 동일 전체 장기E2E 반복 금지 — 좁은 검사만으로 전체 완료 주장하지 않음.

Task 1: in progress. BASE 72c183ed548bf5ec6dcf7aa778a2a3b37b12b612. 먼저 기존 navigation/scroll 기준 검사와 메뉴 literal fixture를 고정한다.

Task 1: RED 새 모듈 부재 collection 실패(exit1) 확인 → 최소 배열 추출 → GREEN82/82. 원본 controller에도 새 navigation trace를 적용해78/78 확인 후 추출본 복구. 전체단위591/591 exit0. 기존 assertion 삭제/완화 없음.
Ruling: 선택 원리 대안 검토 요청으로 Task1만 보존하고 Task2–5 대기 — 새로운 프로필·UI 및 긴 CI/성능 실행을 시작하지 않음 — B1 전체 검증·완료는 미달 상태로 남는다.
Task 1: 타입·린트 exit0, diff --check exit0. 독립 읽기 검토에서 제품 P1/P2 미발견.
Final: minor (deferred): nav:tabs 테스트 응답에 tabs 배열이 없어 성공 하위목록→읽기→root 복귀를 실제 검증하지 않음. 기존 승인 ID trace와 원본/추출 후 동등성만 증명. 제품 menu/up 불변이며 후속 방향 결정 전 테스트 범위를 확대하지 않는다.
Task 1: 구현·단위 검증 보존. 전체 B1 완료는 아님; E2E/최종CI·완료 근거 검사 미실행.
