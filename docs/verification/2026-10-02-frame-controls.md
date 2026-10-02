# iframe 양식 컨트롤 검증과 최종 승인 보완

기준: draft PR28 `0422cdeaeba7c87aa144f4593360fbdb5b415c56` 및 검증 기록 `2e9f848`. `codex-switch-frame-controls`는 합성 iframe 회귀와 재현된 승인 결함만 다룬다. PR27/28·회사 시스템·설치 ZIP을 보존하며 merge/deploy·권한·수집·저장 확장은 없다.

## 경계와 재현

기존 흐름은 worker가 부모 frame-check와 top action-check를 확인한 뒤 자식에게 전달하고, 자식이 다시 top 승인을 요청한다. 최초 가시성 확인 뒤 부모가 스크롤되는 동안 전달 또는 최종 top 승인 응답이 지연되면, 자식의 최종 요청은 현재 부모 가시성을 검사하지 않아 화면 밖 컨트롤을 적용했다.

- 수정 전 정상/취소/쉬기/문서 이동·노드 교체/unknown 회귀12/12(5.9분) 통과.
- 실제 Chromium에서 radio/multiple × 전달 보류/최종 승인 응답 보류4건 모두 RED. iframe.bottom<0 및 실제 전달 완료 후 값이 바뀐 것을 확인했다.
- worker 최종 child action-check가 승인 요청 전후에 visibleReport를 다시 확인하도록 수정해4/4(1.3분) GREEN.
- 단위 승인 경계5RED/2pass→7pass. 독립 재검토에서 첫/마지막 visibility 응답 대기 중 정상 동일문서 report 객체 갱신을 거절하는2RED를 추가했다. 이 승인 경로에서만 문서 세대·path가 같은 갱신을 허용하고 마지막 await의 취소/child/top 교체 negative3건도 더했다. 최종 단위12건, 전체364/364(39파일) 통과.

## 최종 동작 계약

자식 sender의 report 존재·문서 세대·path, 승인 원본 top 문서, 취소 epoch를 확인한다. top 승인 응답 및 부모 가시성 응답의 각 await 뒤에도 동일 조건을 확인한다. 최종 승인 경로에서는 같은 문서의 정상 report 갱신을 허용하지만, 기존 목록/첫 execute 검사의 report 객체 비교는 유지한다. 취소값 삭제를0으로 되살리지 않는다.

새 페이지 이벤트 감시기나 메시지 필드·권한은 추가하지 않았다. 실제 필드 상태/토큰/명시 적용/unknown 중지 경계는 유지한다. 유한 횟수의 메시지 검증이며 모든 프로세스 사이의 가시성 변화를 원자적으로 보장하지 않는다.

검사는 `practice.test` 같은 출처와 기존 지원 `other.test` 교차 출처의 합성 HTTP fixture만 사용한다. 부모·형제 프레임 선택 불변, click/submit0, 변경 이벤트1회, 선택값 영속 저장 없음 및 허용 fixture 밖 요청0을 검사한다. 초기 고정400ms 대기는 최종 테스트에서 held 전달·응답 완료 latch로 교체했다.

## 현재 검증 상태

최종 type/lint와 전체unit364/364 통과 후 체크포인트를 저장한다. 새16+기존 frame visibility4+pending10=30건은 정상 report 갱신 보완 전 빌드로 실행 중이다. 최종 소스 관련 브라우저와 새 draft PR 최종HEAD 전체CI는 아직 완료하지 않았다. 결과는 이 문서와 WORK-STATUS에 갱신한다.

CI95의 기존369건39.9분에 새 iframe16건(선행12건5.9분+회귀4건1.3분)을 추가하므로 E2E55분/job60분으로 실행 여유만 늘렸다. 테스트별 제한·retry·단언은 완화하지 않았다.

실제 Windows IME·이용자 체감·실사이트, sandbox/특수 scheme/새 권한이 필요한 frame은 이번 검증에 포함하지 않는다. NAV-02 새로고침·새 탭·탭 닫기는 구현하지 않았다.
