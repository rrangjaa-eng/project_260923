# NAV-06 제한 더블클릭 구현

## 승인된 범위

사용자는 범위 검토 `c67cda60a9cad62ef976b38eb77e712ba4f39a75`의 추천에 “추천대로 해”라고 승인했다. `codex-switch-explicit-doubleclick`은 PR35 제품 `e590416bda80434390f1defbe8f3bb7aa2ab3ef2` 소스와 최종 검증/범위 검토 문서를 보존한다. 새 merge/deploy/ZIP 교체·권한·의존성 추가 없음.

명령판의 읽기·이동 → 더블클릭·제한에서 최상위 HTTP(S) 문서의 일반 `button[type=button]`을 직접 선택하고 전체 이름을 확인한다. 취소 우선·1초 보호 후 확인하면 synthetic `dblclick(detail=2)`만1회 전달한다. click/pointer/mousedown/focus 순서나 click2회·자동 fallback은 없다. handler가 없거나 click 선행을 요구하는 사이트는 효과가 없을 수 있다. 완료 안내는 이벤트 전달과 사이트 결과 확인을 구분한다.

링크·submit/reset·입력/편집/복합·민감/위험 판정·iframe은 제외한다. native 버튼이라는 이유로 임의 JavaScript 부작용이 없다고 주장하지 않는다. iframe/custom 고정은 확대하지 않는다.

## 실행과 취소 계약

- 기존 PR35 capture를 재사용해 같은 DOM 노드·문서·identity·유일성·eligible·viewport와 제거 이력을 검사한다. 순수 native eligibility를 별도 파일로 옮겨 실행 경로의 import 순환을 피했으며 핀 조건은 바꾸지 않았다.
- 정확한 선택 대상·action ID·종류·confirmed·승인 정보를 명령에 묶는다. worker 승인 확인과 실제 content 실행 양쪽에서 검사한다. double-confirm 대기 중 일반 press로 바꾼 메시지도 거절한다.
- 늦은 승인 응답 뒤 worker 취소 세대와 문서를 재검사하고, 최종 content에서 capture와 현재 실행 상태를 다시 확인한다. 제거/재삽입·이름/종류·disabled·스크롤·쉬기·설정 변경은 실행을 무효화한다.
- 문서별 기존 action gate가 중복 ID를 거절한다. 결과 unknown/ack 유실 이후 capability를 버리고 unresolved 상태에서 추가 전달을 거절한다. 사이트 효과 성공을 보장하거나 자동 재시도하지 않는다.
- 확인/목록은 기존 패널·디자인 토큰과 전체 이름 페이지 읽기를 사용한다. 설정이나 입력값을 새로 저장하지 않는다.

## 실패 재현과 검증 상태

최초 executor가 새 kind를 거절하는1RED, 메뉴가 없는 controller1RED를 확인했다. 전달 구현 뒤 happy-dom의 `isTrusted`가 undefined인 테스트 환경 차이를 발견해 단위 검증은 이벤트 종류/개수/detail에 집중하고 실제 Chromium에서 false를 검증한다. 첫 controller fixture의 불필요한 시작 입력도 고친 뒤 실제 메뉴 부재 RED를 확인했다.

독립 검토와 자체 조사에서 doubleClick 승인을 일반 press로 바꿔 click1회가 실행되는 P2를 확인했다. 실제 controller RED→pending 명령 기준의 역방향 binding→관련67/67GREEN으로 보완했다. 최종 독립 읽기 검토에서 추가 actionable P1/P2 없음. 실행 검증과 읽기 검토는 구분한다.

전체 단위·실제 Chromium 기능/경계·기존 회귀·자동UI·최종CI는 실행 후 실제 수치로 기록한다. 직전 CI107435건이70분14초여서 새 경계 검사에 필요한 CI 브라우저 제한85분/전체job90분으로 조정했다. 검사 자체는 생략하지 않는다.

## 남은 한계

일반 두 click 선행 시퀀스, 네이티브 trusted 입력, iframe/custom 대상은 지원하지 않는다. 실제 Windows 한국어 IME·운동 사용성·실사이트·native UI·두 PC 검증은 별도다. 더블클릭 요구 전체 플랫폼 완료로 확대하지 않는다.

## draft 게시 전 검증 — 2026-10-03 21:01 KST

타입·린트·전체unit486/486(47파일) 통과. 새 기능/경계 실제 Chromium9/9(3.1분), 긴 이름·1초 보호·360/768/1280px·표적56px 검사1/1(27.7초) 통과. 첫 기능 검사에서 실패 없음. 관련 기존 회귀·자동UI·전체CI는 다음 단계이며 아직 최종 성공으로 세지 않는다.

## 최종 로컬 검증 완료 — 2026-10-03 21:15 KST

[draft PR36](https://github.com/rrangjaa-eng/project_260923/pull/36), 제품 `codex-switch-explicit-doubleclick`/`26bd9912fb21041ec8fa3ecefd9fbbf570a8fa37`. 타입·린트·전체unit486/486(47파일), 실제 Chromium기능9/9(3.1분)·이름/화면1/1(27.7초), 기존 클릭/떨림/핀/이동취소 회귀43/43(8.5분), 자동UI101/101(3.9분) 통과. 실패/flaky/skip0. [구조화된 결과](explicit-doubleclick-results.json).

[CI108](https://github.com/rrangjaa-eng/project_260923/actions/runs/37121613912)은 전체 브라우저 검사 진행 중이며 최종 성공으로 세지 않는다. 테스트 merge4741959와 제품26bd991의 tree583d3b7d19aac6c2c9468cc91667dcc2ffbc5807 일치를 확인했다. 제품HEAD를 고정한 `codex-pr36-verification-record`에 결과를 기록한다. main/PR31–35 원격 HEAD와 기존 ZIP hash 불변을 재확인했다. 실제 PC/사용자/실사이트·native/두 PC의 한계는 유지한다.
