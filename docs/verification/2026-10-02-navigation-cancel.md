# 대기 중인 브라우저 이동 취소

기준: PR21 `e736350fba086bfb38a40070db24d4d53a74fef7`. 브랜치 `codex-switch-navigation-guards`. PR20/21 검증 HEAD는 변경하지 않는다.

## 발견과 수정

다음 Space 핵심 흐름을 고르면서 기존 읽기·이동의 worker 경계를 조사했다. `switch/navigation`은 탭 목록 조회, 대상 탭 ping, 대상 쉬기 응답을 기다린 뒤 사용자가 이미 쉬거나 껐는지 확인하지 않고 뒤로 이동/탭 활성화를 실행했다. 실제 relay 단위에서 query대기 중 pause와 ping대기 중 cancel 두 경우를 RED로 재현했다(정상 요청 두 경우는 GREEN).

navigation 시작 시 기존 취소 세대 값을 등록하고 각 비동기 대기 뒤 동일한지 검사하는 6줄을 추가한다. source 탭 로딩/쉬기/취소는 기존 취소 세대를 바꾸므로 늦은 응답이 이동하지 않는다. source 탭 제거는 기존 map 삭제와 `undefined` 비교로 무효화한다. 최초 수정의 `??0` 때문에 삭제를 구분하지 못하는 P2를 독립 검토가 찾아, 추가 RED1→GREEN을 확인했다. 대상 pause 응답 대기 중 취소도 검사한다. 작업을 재전송하거나 이미 브라우저 API에 전달된 이동을 되돌리는 기능은 아니다. worker가 요청을 받기 전의 모든 메시지 지연까지 해결했다고 주장하지 않는다.

수집 데이터·권한·저장 형식·message schema·화면·Space 메뉴는 변경하지 않는다. C#/native/USB, 다른 탭 내용 요약, 민감정보 수집은 추가하지 않는다.

## 검증

- 새 relay 단위6/6: query대기 후 pause, targetping대기 후 cancel, 정상back/activate 각1회, source탭제거, targetpause대기 후 cancel.
- 전체 단위278/278, 타입 검사 통과. 첫 린트는 시험용 async 함수3개에 await가 없어 실패했으며 Promise 반환으로 고친 뒤 린트 통과. 제품 검사 조건을 약화하지 않았다.
- `CI=true pnpm exec playwright test tests/e2e/switch-navigation-cancel.e2e.ts tests/e2e/switch-journey.e2e.ts` 첫 실행: 1fail/2pass(3.0분). 기존 한글 전체 여정과 source탭제거 검사는 통과했으나, 일반 pending 중 Space로 쉬기를 가정한 새 시험이 실패했다.
- 실제 초점이탈 쉬기로 경계를 좁힌 최종 `CI=true pnpm exec playwright test tests/e2e/switch-navigation-cancel.e2e.ts`: 2/2pass(22.6초, exit0). 제품 코드는 첫 브라우저 검사와 동일하다. 따라서 기존 전체여정1pass와 최종취소2pass를 확인했지만 최초3개 실행 전체를 통과라고 표현하지 않는다.
- 독립 gpt-6.1-sol/high 검토: 탭제거 P2를 위 회귀로 수정했고 추가 P1/P2를 발견하지 못했다. 정적 검토와 직접 실행 근거를 구분한다.

기존 PR21의 UI101/101 결과를 이 소스의 새 실행으로 계산하지 않는다. 화면·스타일은 바뀌지 않았고 이번 변경은 worker의 비동기 이동 취소 경계에 한정한다. Windows IME/손사용감/실사이트/회사 시스템은 검증하지 않았다. merge/deploy/ZIP교체 없음.

## 다음 권장 묶음

우선 현재 CI77/79와 이 취소 회귀를 마감한다. 실제 E2E에서 일반 실행 대기 중 Space가 현재 정지로 처리되지 않고 3초 뒤 recovering으로 가는 미지원 경계를 확인했다. 최초 새 E2E는 Space를 쉬기로 가정해1fail/2pass였으며, 이번 취소세대 수정은 실제 초점이탈 쉬기로 좁혀 다시 검사한다. 이 실패를 제품 전체 Space 정지 완료로 바꾸지 않는다. 다음 최우선 묶음은 일반 실행 대기 중 새 Space down/up의 정지 소유권·release소비·재개만·늦은 승인 차단이다. 그 뒤 NAV-02 일부인 Space `앞으로`와 이동 불가 안내를 제안한다. 현재 메시지 schema는 tabs/back/activate만, 읽기·이동 메뉴는 뒤로/열린탭만 제공한다. 정상 history A→B→뒤로→앞으로, history없음/지원불가, 취소/모드변경/탭제거·응답불명에서 추가 이동0, 초안보존을 검증해야 한다. navigation 전체에 현재문서/현재명령 authorization을 넣는 범위도 함께 검토한다.

그 다음은 NAV-01 다중 스크롤 영역이다. 현재 controller는 window.scrollBy만 호출한다. 목표영역 선택·활성표시·영역제거/프레임/쉬기 경계를 먼저 설계해야 하므로 버튼 하나 추가와 같은 크기로 취급하지 않는다. radio/multiple/custom widget, 사이트 임의 오류 원문, 최근값 자동수집, 보호저장소는 이보다 먼저 무조건 확장하지 않는다. INPT-03 전체와 Phase3를 완료로 표시하지 않는다.
