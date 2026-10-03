# SAFE-04 작업판 현재 사이트 끄기

## 승인 범위와 동작 계약

기존 계속 진행 요청과 후속 5개 완료 기준 승인에 따라 PR36 제품을 기준으로 구현한다. 작업판 `조절·쉬기`에서 `이 사이트에서 끄기 · 다시 켜기는 확장 아이콘`을 Space로 선택하면 현재 HTTP(S) 최상위 출처의 기존 `site:<origin>.data.disabled`만 true로 저장한다. 기존 고정 번호, 다른 출처와 전체 enabled 설정을 보존한다. 새 권한·의존성·저장 스키마는 추가하지 않는다.

선택 시 순환과 스크롤을 멈추고 사용 중인 대상 capability를 폐기한다. worker는 현재 sender의 최상위 문서, 정확한 URL/출처, pending 명령과 세대가 일치하는지 먼저 검사한 뒤 자식 프레임을 정지한다. 저장은 기존 `setSiteDisabled`에 선택적 승인 검사를 추가한 경로로 단일 큐·공유 sync 한도를 사용한다. 팝업의 기존 쓰기 합치기는 유지하며 작업판의 개별 승인 요청과 합치지 않는다. 대기 뒤 최신 사이트 항목을 다시 읽고 최종 승인과 외부 변경 여부를 검사한다. 손상된 원본은 초기화하지 않는다.

취소·탭/문서 변경·지연·중복 요청을 거절하고 자동 재시도하지 않는다. 실제 쓰기 시도 뒤 응답 유실은 unknown이며 꺼졌다고 단정하지 않는다. 저장 변경 통지는 기존 content 경로를 통해 해당 사이트의 입력을 돌려준다. 재활성화는 **기존 확장 아이콘 팝업** 경로이며, 꺼진 상태에서 Space만으로 다시 켜는 수단이나 네이티브 UI 조작을 추가하지 않는다.

## 실패 재현과 독립 검토

- 저장 승인 취소/외부 변경/응답 유실 3RED를 재현하고 guarded writer로 GREEN.
- 독립 검토: 끄기 승인을 직접 전달된 페이지 press로 바꾸면 실행되는 P2를 controller RED(expected refused, received done)로 재현했다. 최종 페이지 executor에서 pending site-off 명령의 페이지 실행을 거절한다.
- 독립 검토: 늦은 옛 끄기 요청이 거절 전에 자식 pause를 보내는 P2를 RED(child pause 발생)로 재현했다. 현재 명령 첫 승인 후에만 action 소비와 자식 취소를 수행하도록 순서를 바꿨다.
- 최종 독립 읽기 재검토: 추가 actionable P1/P2 없음. 검토자는 파일 수정·테스트 실행 없이 최신 diff와 부정 테스트를 확인했다.
- 타입·린트·전체 단위505/505(49파일) 통과. 초기 브라우저7/7 후 두 경계 보완과 응답 유실 테스트를 추가했으며, 최종 브라우저 회귀·자동UI·전체CI는 진행 중이다.

## 검증과 한계

새 브라우저 검사는 합성 practice.test/other.test만 사용한다. 출처 A/B, iframe 입력 반환, reload 유지, 팝업 재활성화, 지연 승인 중 pause/URL변경/설정변경/timeout, 저장 실패와 committed write 응답 유실을 검사한다. 360/768/1280px에서 작업판 가로 경계를 검사한다. 단위 검사는 quota 대기 후 취소, 손상된 scalar 원본, 핀 보존, exact-action 최종 실행 경계와 중복 요청을 포함한다.

실제 Windows 한국어 IME·운동 사용성·실제 Chrome/Edge/Whale 프로필·실사이트·네이티브 UI·두 PC 동기화는 미검증이다. 회사 시스템을 테스트하지 않는다. 기존 PR31–36/main·배포 ZIP을 보존하고 merge/deploy/ZIP 교체를 하지 않는다.

## 최종 로컬 검증 — 2026-10-03 22:53 KST

[draft PR37](https://github.com/rrangjaa-eng/project_260923/pull/37), 제품 `codex-switch-site-off`/`7eeda02f547fbd50db6310a455686bb0b5ce76e4`. 타입·린트·unit505/505(49파일), 새 기능8건 포함 Chromium 회귀42/42(4.5분), 자동UI101/101(3.9분) 통과. 실패/flaky/skip0. 독립 재검토 추가P1/P2 없음. [구조화된 결과](site-off-results.json).

[CI109](https://github.com/rrangjaa-eng/project_260923/actions/runs/37127421940)은 타입·린트·단위 단계 성공 후 전체 브라우저 검사 진행 중이다. checkout 예정 mergeff4ed7e6과 제품7eeda02의 treeefc5f2d214517508dadd919dfcd0eed205814b55 일치를 확인했다. 최종 CI 성공으로 세지 않는다. 제품 HEAD를 고정하고 별도 `codex-pr37-verification-record`에 결과를 기록한다.
