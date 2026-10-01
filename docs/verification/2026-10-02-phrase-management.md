# 저장 문구 관리: bounded 구현·검증

2026-10-02 02:17 KST · 기준PR17/035ce70 · codex/switch-phrase-management. 최신 진행 지시로 기존 INPT-02 저장/삽입 흐름을 수정/삭제까지 확장했다. 이미 승인된 bounded 실행 지시에 따라 짧은 설계를 공유하고 직접 구현했으며 새 아키텍처나 양식 전체를 만들지 않았다.

## 설계·동작

글쓰기→문구→문구 관리→저장 문구 선택→현재 작성 문장으로 바꾸기 또는 삭제→취소 먼저/1초 보호 확인이다. 바꾸기 전 기존 문구와 새 문장을 read-only 미리보기로 보여 준다. 화면 검사에서 짧은 새 문장도 max-height에 가려져, 24grapheme씩 기존/바꿀 문장의 쪽을 표시하고 Space로 이전/다음을 선택하도록 보완했다. 줄바꿈/탭은 ↵/⇥로 보여 주고 저장할 원문은 바꾸지 않는다. 취소가 첫 항목이며 미리보기 이동으로 확인은 실행되지 않는다. 확인 전까지 local 문구는 바뀌지 않고 현재 초안/선택된 페이지 입력값은 보존한다. 길이1~1000자 완성 문장만 저장/교체하며 초과를 자르거나 미완성 음절을 자동 저장하지 않는다.

20개 이내 문구 목록을 스냅샷으로 선택한다. 삽입도 화면에 표시했던 스냅샷의 같은 문구를 사용한다. 새 저장·교체·삭제는 동일 writer 큐에서 현재 목록을 읽고, expected 목록/선택 index를 비교하며 현재 action-check 승인을 확인한다. 승인 확인 뒤 목록을 다시 읽고 마지막 승인을 확인한다. 손상 목록·목록 충돌·중복 교체·취소된 요청은 원본을 유지한다. 중복 저장은 기존20개를 잃지 않는다.

writer의 마지막 승인 응답이 늦게 오면 쉬기/끄기 뒤에도 저장될 수 있는 P2를 독립 리뷰에서 찾았다. 실제 relay/writer 단위 RED1fail→worker 취소 세대를 await 전후 비교하는 최소수정→쉬기/cancel-peers2/2 GREEN. 실제 확장에서도 두 번째 승인 done 응답을 보류→쉬기 또는 도우미 off→해제했을 때 삭제0·패널 재활성화0·문장 보존을 확인했다.

정지 후 이미 완료한 저장까지 되돌린다고 보장하지 않는다. chrome.storage는 다른 도구가 쓰는 임의 외부 변경과 원자적 CAS를 제공하지 않는다. 이 구현은 단일 writer 큐와 알려진 conflict/취소 경계를 검사하며 모든 외부 쓰기 경합을 원자적으로 막았다고 표시하지 않는다.

## 실제 검사

| 검사 | 결과 |
|---|---|
| 저장자 TDD | stub RED3fail/7pass→10pass. 승인 중 외부목록변경 RED1→GREEN, 최종read 중 승인취소 RED1→GREEN |
| 메시지 TDD | valid update RED1→strict schema GREEN; nested authorization extra RED1→GREEN |
| 최초 UI | 기능 없는 상태에서 문구 관리 선택 RED3fail. 기존 기대값 유지 |
| 기존 회복/pending + 새 기본3 | production19/19pass4.8분. 최종취소세대 수정 전의 영향 실행 |
| 최종 새UI | production5/5pass2.4분. 교체·취소·충돌·쉬기·늦은승인/끄기·페이지제출0 포함 |
| 최종unit/type/lint | 30파일246/246pass; 최종type/lint exit0 |
| 자동 기본 화면 | run-IHfLfC:101/101pass,0fail/skip/flaky,3.2분,exit0. 미리보기 쪽 보완 전 실행, 공통CSS/패널 불변 |
| 최종 새6+doc-editor/editor-frames38 | production44/44pass3.8분,exit0. 미리보기 쪽 보완 최종 source; 긴 한글/이모지/줄바꿈 Space 읽기와 최종취소세대 포함 |
| 전체CI | 후속 PR 최종 HEAD에서 별도 확인 |

확인 화면 360/768/1280px DOM에서 화면 경계 안·선택56px 이상·글자18px 이상·제목과 취소 가시성을 검증했다. [360px](phrase-confirm-360.png) · [768px](phrase-confirm-768.png) · [1280px](phrase-confirm-1280.png). 고정 짧은 문구와 360px의 긴 한글/이모지/줄바꿈 미리보기까지 확인했다. 모든 길이·모든 언어·실제 운동 사용성을 확인한 것은 아니다.

INPT-01 사이트/칸별 최근값 자동수집은 구현하지 않았다. INPT-03 양식 전체를 큰 입력칸으로 모으기, select/checkbox, 양식 validation/복귀 전체도 미구현이다. PRIV-01 전체 민감판별은 원래 열린 요구로 유지한다. 민감칸 수집·자동 제출·외부전송·새 권한·의존성·OS 연결·ZIP교체·merge/deploy 없다. Windows IME·운동 사용성은 별도 미검증이다.

미리보기 helper는 RED2fail→GREEN2pass. 공통CSS/패널과 기존pointer UI 경로는 불변이며 쪽 이동 후에는 새UI6+기존문서/프레임38과 unit246/type/lint를 검증했다. 기본UI101의 실행 시점을 최신 쪽 이동 source 전체에 확대하지 않는다. manifest는 이전 전달ZIP과 permissions/host_permissions/content_scripts 모두 동일하다.

실제 draft PR18: https://github.com/rrangjaa-eng/project_260923/pull/18 . base=PR17/035ce70, head=codex-switch-phrase-management. 제품 source e360466; 이 PR번호 기록은 문서만 변경한다. 전체CI 최종결과는 아직 미확정이며 통과로 계산하지 않는다. 다음 재개는 이 브랜치에서 전체CI 확인이며 완료된 구현·검사를 재승인 대기로 돌리지 않는다.
