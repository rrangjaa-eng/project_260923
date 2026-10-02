# 양식 탐색 검증 기록

기준 PR18 HEAD6fce6f5, 로컬 codex/switch-form-navigation. 최신 게시 클라우드에서 진행했고 환경 재생성·설치·기존 ZIP 교체는 하지 않았다. Node24.19.0/pnpm10.33.0/Chrome for Testing153.0.8010.12, 준비된 workflow-env/browser 경로를 보존했다. Node22 CI와 실제 PC 검증은 로컬 결과와 구분한다.

부모 확인: PR16 CI71, PR17 CI73 성공. PR18 CI75/run36899740939도 최종 success; 원본 job110495937559에 unit246/246, E2E327/327(23.4분), 정상 종료. PR18 본문은 부모가 갱신했고 child는 해당 CI를 중복 조회/실행하지 않았다.

## TDD와 독립 검토

- 필드 metadata 안정 순서·민감 제외·immutable 복사와 identity/document별 draft cache: 단위 RED2fail/1pass→3pass.
- 실제 확장 baseline load1/1pass. 양식 메뉴 미구현은 실제 UI1fail로 확인.
- 첫 실제 양식 검증에서 label 안 textarea 기본 내용이 이름에 섞이는 문제 발견. 보고 이름/identity를 값 없는 DOM 라벨로 생성하고 live associated-label 민감 검사 추가. 단위 RED1→GREEN, 참조 root가 control/contenteditable인 경우도 RED1→GREEN. 원래 collector/포인터 동작은 변경하지 않고 switch metadata만 정제했다.
- 독립 safety/UX 검토 P2: 무효화 시 원래 workspace 소실, 확인 쉬기 뒤 일반 메뉴와 양식 상태 혼합, 라벨 참조 root의 값 노출. 실제 UI 앞의 두 경계 RED2fail 확인 후 원래 workspace 복원/메모리 복구, form root의 양식 목록 복귀로 보완.
- 복구한 문장의 추가 편집 보존 P2도 raw textContent 비교로 RED1fail(공백 1개 소실)→메모리 복구 flag 수정→최종 관련 회귀에서 GREEN을 확인했다. toHaveText의 공백 정규화가 이를 놓칠 수 있어 새 양식의 문장 assertions를 정확한 textContent 비교로 강화했다. 최종 독립 코드 재검토에서 남은 P1/P2를 찾지 못했다. 정적 검토는 실제 테스트 통과와 구분한다.

최종 실제 검증: typecheck/lint exit0, unit31파일251/251pass. lint 첫14지적은 보완했다. 양식 UI 중간 실행6pass/1fail(3.2분)은 한글 메뉴 상위 이동 fixture를 한 번 덜 한 문제였고 수정했다.

| 검사 | 실제 결과 |
|---|---|
| 모든 switch + doc-editor/editor-frames | **96/96pass,17.7분,exit0**,0fail/skip/flaky. 새 양식7·기존문서/프레임38 포함 |
| 추가 긴 선택칸 맥락 DOM | **1/1pass,16.4초,exit0**. 동일 제품 source에 테스트 assertions만 추가, 360/768/1280px 제목·상태·표적·페이지scroll0·Space나가기 검증 |
| 기본 ui-review | **101/101pass,3.3분,exit0**,0fail/skip/flaky. run-jQ4Ot3, 최종 source의 type/lint 및 production build 포함 |
| CI YAML·권한 계약 | YAML parse pass. E2E25→30분/job30→35분. Node22·frozen lock install·read-only GitHub permissions·전체시험 유지. 기존 ZIP manifest의 permissions/host_permissions/content_scripts 동일 |
| 전체CI | 새 draft PR 최종 HEAD에서 별도 관찰 필요. 로컬 --list는335건이며 실행 성공의 근거가 아님 |

새 양식7건의 JSON 기록상 실행 합은223.56초다. PR18 CI75의 전체23.4분에 이 추가 흐름을 더하면 기존25분 제한에 여유가 없어 시간 한도만 조정했다. 클라우드 환경 설치/설정 재생성은 하지 않았다.

360/768/1280px overview DOM에서는 선택56px 이상·폰트18px 이상·뷰포트 경계를 확인했다. 이미지 form-overview-*.png를 작성자·독립 검토자가 실제 확인했다. 긴 선택칸 맥락 form-context-*.png 3장을 작성자가 실제 확인했다. 자동 확대/WCAG 전체·모든 UI 상태 합격으로 확대하지 않는다.

## 남은 범위

INPT-03은 지원 input/textarea subset이다. select/checkbox 등의 위젯, 사이트 유효성 오류 읽기, 모든 사이트 지원은 미완료다. 사이트가 값을 바꾼 칸은 같은 칸 재선택만으로 기존값 검사를 해제하지 않으며, 변경값과 초안을 비교한 재적용 확인 UI는 후속 결정이다. 최근값 카드의 새 개인 데이터 수집, 실제OS/파일 연결/권한/배포는 별도 승인 대상이다. 실제 PC 한국어 IME와 운동 사용성은 미검증이며 클라우드 소스 작업을 그 확인 대기로 돌리지 않는다.

실제 검사 stats·기준SHA·소스 파일 해시는 [구조화 결과](form-navigation-results.json)에 보존한다. 현황/PR 번호와 전체CI의 후속 상태는 WORK-STATUS 및 최종 PR 본문을 기준으로 이어간다.
