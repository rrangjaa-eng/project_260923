# 메뉴 B1 계획 문서 검증

2026-10-04 KST. 문서 브랜치 `codex-switch-menu-design`, 기준283572609b7662f78dac569ab885f03a876a89bb. 제품·기존 시험·설정·의존성은 변경하지 않는다. 이 기록은 계획 완성에 대한 근거이며 기능 완료 보고가 아니다.

- 실제 `pnpm typecheck` exit0: WXT0.21.4 prepare 후 tsc --noEmit. `/tmp/menu-plan-typecheck.log`의 성공 출력을 직접 대조했다.
- 실제 `pnpm lint` exit0: eslint . 오류 없음. `/tmp/menu-plan-lint.log` 출력 대조.
- 명세/계획 자체 검토: canonical nav:tabs 유지, 단축 메뉴가 실행 승인하지 않음, formActive 복귀 보존, 초기 storage 지연과 전환 세대 경합, 결과 불명/컨트롤 미적용 전환 거절, old settings 원본 보존을 명시했다.
- 계획의 파일·함수 계약과 Task1–5 의존성을 대조했다. 직접 구현할 동작과 미구현 후속 키보드를 분리했다. placeholder 없음. spec 필수 계약7줄이 plan Global Constraints에 동일하게 들어간다.
- 실제 상대 링크5개 존재·명세/계획 전역 계약7줄 일치 검사 PASS, git diff --cached --check exit0. 변경은 docs 아래4파일뿐이다. 기존 ZIP SHA256 bf84ada9a8b1f211b6d43318c02da1fd53b4482aafa41f648b4c9aef1eec2bdb 유지.
- disconnect 알림 후 읽기 명령 exit0으로 파일/터미널 접근을 재확인했다. 명세93줄·계획122줄 및 현황/검증 파일4개가 staged, 기존 HEAD2835726인 상태를 확인해 중복 commit/push 없이 이어갔다. 새 환경 생성 없음.
- CLI GitHub API 조회는 Forbidden. 연결된 GitHub get_pr_info로 PR39 draft/open/merged=false/head62577af를 확인했다. Git 원격 ref 조회는 성공했다. 도구 제한을 PR 상태 미확인이나 자동 승인 거절과 혼동하지 않는다.
- 단위/E2E/전체CI/성능20쌍/실사용자 검증은 미실행. 기존 CI113 수치를 이번 문서 검사로 재실행했다고 표시하지 않는다. 새 PR은 만들지 않고 원격 문서 브랜치로 검토 전달한다: 현재 workflow는 모든 PR에 긴 E2E를 실행하므로 문서만의 중복 실행을 피한다. CI 설정 자체는 바꾸지 않는다.

명세와 계획은 사용자 검토를 기다린다. 두 문서 작성을 명시적으로 요청받아 함께 제출했으며 별도 미승인 구현 단계로 넘어가지 않는다. 새 권한·머지·배포·ZIP교체는 없다.
