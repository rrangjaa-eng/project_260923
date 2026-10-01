# 설치본 시작·종료 회귀 조사

환경: 최신 project_260923 클라우드, pnpm 10.33.0, Node 24.19.0, Chrome for Testing 153.0.8010.12. 시간은 KST.
분기: `codex/installed-page-investigation`, 기준 `cb182d44c025a49feb66f44184867be1b0f3dd28`(제품 `9741b0c`).
수정 제품: `6aeb4ce4dff8ed807ae7364d84004ba35e2d76a7`.
전달 상태: **보류**. 새 CI64의 전체 E2E8건이 실패했으며 다음 턴에서 회귀 수정과 새 HEAD 검증을 이어간다.
2차 작업은 로컬 `codex/phase2-cloud-design` / `f21a215`에 보존하고 중지했다. PR13/14 코드를 병합·복사하지 않았다.

## 신고와 재현

사용자는 공개 두산아트센터 페이지에서 `이 페이지에서는 도울 수 없어요. 다른 탭에서 쓰세요.`를 보았고, Space로 활동 선택과 종료가 제대로 되지 않는다고 신고했다. 원인을 이 문구 하나로 단정하지 않았다.

원본 ZIP `/tmp/tremor-browser-helper-9741b0c.zip`의 SHA256은 `5af8a15e27f7b29e462170297ee3efc82e7a21cd19e0de2321dfe61bc91776b6`이다. 9개 파일은 동일 제품 SHA의 production 출력과 모두 바이트 단위로 일치했다. manifest는 `<all_urls>`, top/child frame, `document_start`를 포함하고 두산 도메인을 제외하지 않는다.

실제 Chromium에 ZIP을 풀어 `Extensions.loadUnpacked`로 처음 설치했다. 설치 전에 열린 일반 HTTP 탭은 root 0·ping 수신자 없음·`도울 수 없음`이었다. 새로고침 뒤 root 1·ping 성공, 설치 후 새 탭도 성공했다. 브라우저가 연 action popup(`chrome.action.openPopup`)에 CDP로 붙어 trusted Space down/up을 보냈다. 원본은 선택 표시와 Space 선택 처리가 없어 활동이 시작되지 않았다. popup.html을 별도 탭으로 여는 대체 시험과 구분했다.

두산 공개 URL과 example.com의 실제 브라우저 읽기는 `ERR_TUNNEL_CONNECTION_FAILED`로 차단됐다. 접근 제한을 우회하지 않았다. 로컬 Node HTTPS 서버의 일반 문서로 설치·팝업·초점 흐름을 검증한다. 이 결과는 해당 공개 사이트 지원 판정이 아니다. 인증·예매·제출은 조작하지 않았다.

## 최소 수정

- 팝업은 ‘활동 선택 시작’부터 고정 순서로 순환한다. Space를 놓을 때 선택한 카드 하나만 실행한다. 반복 keydown은 추가 실행하지 않는다. 시작을 명시적으로 선택하면 연결을 확인하고 팝업을 닫아 페이지 그룹 순환으로 이어간다.
- 일반 웹 탭의 수신자가 없으면 현재 URL을 대조한 뒤 기존 scripting 권한으로 연결한다. 제한 URL은 거절한다. content의 문서 소유 가드로 중복 주입이 입력 처리기를 겹쳐 만들지 않게 한다.
- 상태를 뒤집는 토글과 별도로 ‘즉시 정지 · 도우미 전체 종료’가 항상 있다. 켜기 응답이 대기 중이어도 이 정지를 선택할 수 있다. 페이지 ‘조절·쉬기’에도 전체 끄기 항목이 있다. 마우스 전환과 전체 끄기는 서로 다른 동작이다.
- 끄기 요청은 저장 응답보다 먼저 각 페이지를 무효화·정지한다. 로컬 차단을 영속화하고, 손상된 원본은 보존한다. 동기화 읽기·쓰기 대기가 끄기를 막지 않게 한다. 로컬 켜기 commit이 지연되더라도 실행 정지는 먼저 적용된다. 늦은 해제·응답은 명시적인 새 켜기 성공 없이 재개시키지 않는다.
- 초기 설정·안전 상태 읽기 전에는 입력을 가로채지 않는다. storage 변경 이후 도착하는 옛 초기 응답과 실패를 revision으로 걸러낸다. 저장된 안전 키의 손상은 정지로 처리한다.
- 확장 관리 비활성화 뒤 이전 content 표시·입력을 정리한다. 포트 외에 컨텍스트 유효성 검사도 사용한다. 팝업 오류 시 확장 관리에서 끄고 페이지를 새로고침하는 탈출 안내를 제공한다. 페이지 초점 밖의 전역 정지나 브라우저 API 전체 불통 때의 즉시 성공을 보장하지 않는다.

새 의존성·권한·네이티브 실행기는 추가하지 않았다. 사용자 PC 설정을 변경하지 않았다.

## 검증 기록

| 검사 | 실제 상태 | 증거 |
|---|---|---|
| 원본 ZIP 실제 설치·기존/새 탭·native popup | 재현 완료 | `/tmp/installed-local-probe.log`, `/tmp/native-popup-probe.log` |
| 손상·읽기 실패·대기 켜기 단위 RED | 3 실패(exit 1), 수정 후 통과 | `/tmp/helper-stop-red.log`, `/tmp/helper-stop-green.log` |
| 로컬 해제 commit 지연 RED | 실패(exit 1), 순서/즉시 정지 수정 | `/tmp/helper-local-race-red.log` |
| 원본 ZIP의 새 설치 시작 검사 RED | 실패(exit 1), 선택 시작 없음 | `/tmp/installed-popup-red.log` |
| 설치·종료/기존 한글 전체 활동 초기 회귀 | 7/7 통과 | `/tmp/urgent-e2e.log` |
| 안전/수명 회귀 첫 확장 실행 | 15 통과·5 실패(exit 1) | `/tmp/urgent-final-e2e.log` |
| 후속 회귀 | 19 통과·1 실패(exit 1); 대기 켜기의 토글 문구로 정지에 들어갈 수 없어 독립 정지 버튼 추가 | `/tmp/urgent-final-e2e2.log` |
| 독립 정지 버튼·native popup·Chrome 확장 관리 | 5/5 통과; 초기 gate/held-selection 변경까지 최종46 검사에서 재확인 | `/tmp/installed-popup-final.log` |
| 전체 단위 | 140/140 통과 | `/tmp/urgent-unit-all.log` |
| 최신 type/lint | 통과(exit 0) | `/tmp/urgent-type.log`, `/tmp/urgent-lint.log`; 커밋 전 `/tmp/urgent-checkpoint-type.log`, `/tmp/urgent-checkpoint-lint.log` |
| 화면 자동 검사100 | 100/100 통과, 실패·불안정·스킵 0 | `/tmp/urgent-ui-review.log`, `/workspace/.cloud-onboarding/ui-review-runs/run-E13OCD/results.json` |
| 최신 설치/기본 활동/편집기 회귀 | 46/46 통과(exit 0), production build 포함 | `/tmp/urgent-latest-e2e.log`; installed-popup, switch-journey, doc-editor, editor-frames, switch-disable |
| 신규 CI64 전체 | **296 pass·8 fail**,18.3분,exit1. Node22.23.3의 type/lint/unit140/build pass | [run36861983233](https://github.com/rrangjaa-eng/project_260923/actions/runs/36861983233), head `3027291`, job110368157034 |
| CI 실패 관련 로컬 재현 | **18 pass·같은8 fail**,3.8분,exit1; production build pass | `/tmp/urgent-ci64-target-red.log`, lifecycle/switch-editor-feedback/switch-recovery/switch-text |

실패 기록은 삭제하거나 최종 통과 수에 합치지 않는다. 기존 CI62의 E2E299 통과는 이번 실제 설치 신고의 해결 근거가 아니다. 전체 E2E 수백 개를 로컬에서 재실행하지 않았다. 별도 신규 CI 결과는 최신 작업 현황표에 기록한다.

## 검토와 남은 범위

독립 안전 검토에서 지연된 local 해제, 손상 안전 키, 초기 응답·실패 덮어쓰기, 초기 설정 미로딩 경계를 발견해 수정했다. 보안 경계는 extension sender ID, 정확한 popup URL, 탭 URL 재대조, 제한 URL 거절이다. DOM은 textContent/text node를 사용하고 기존 디자인 토큰·56px 카드·가시적 선택·600px popup 상한을 유지한다. 실제 native popup DOM 수치와 disabled 뒤 정상 키·클릭을 검사한다.

실제 Windows 한국어 IME·운동 사용성·사용자 설치 프로필 및 두산 사이트 동작은 미검증이다. 수정 ZIP은 새 SHA로 구분하며 기존 설치본 비활성화를 유지하고 교체 시 중복 로드를 피하도록 안내한다. 2차 확장·파일창·실행기 작업은 이 신고 해결 결과를 전달한 뒤 별도로 재개한다. merge·배포·새 권한은 실행하지 않는다.

## CI64 실패 인계

- 초안·선택 복원7건: `switch-editor-feedback:4`, `switch-recovery:21,106`, `switch-text:22`의 input/textarea 두 경우와 `:51,68`. 기존 문장·선택이 초안에 누락되거나 panel이 없어 실패했다. 단언을 삭제·완화하지 않았다.
- 코드 경로: 초기 로딩의 `currentEnabled=false→true`도 `enabledChanged()`를 호출하고 `invalidate()`가 빈 초안을 보존 대상으로 표시한다. capture 후 `!preservedDraft` 조건 때문에 실제 문장·선택을 가져오지 않는다. 첫 로딩·`switch/begin`과 이미 사용자가 편집한 작업의 보존을 구분하는 후속 수정이 필요하다. A/B 수정 검증은 아직 하지 않았다.
- popup 경고1건: `lifecycle:212`, 사이트 토글 뒤 형식 변환 실패 경고로 복귀해야 하지만 저장 거절 경고가 남았다. 소스/재현 조사 중이며 실제 원인은 미확정이다. 자동 순환·scrollIntoView와 기존 좌표 기반 카드 떨림 필터의 상호작용도 확인할 대상이다.
- 실패 [artifact11162833228](https://github.com/rrangjaa-eng/project_260923/actions/runs/36861983233/artifacts/11162833228)는 GitHub Actions에 보존됐다. 관련26건 로컬 재현도 동일한8건 실패(18 pass,3.8분,exit1)였으며 로그는 `/tmp/urgent-ci64-target-red.log`다.
- 공식 Library 도우미는 최초와 허용된 재시도 모두 tools/list network 오류로 업로드 전 exit1이었다. 같은 호스트 연결 확인의 tunnel403을 관측했고 기존 Library 두 파일은 그대로다. 수정 ZIP은 `/tmp`에만 있으며 원격 Git에 ZIP 자체를 저장하지 않았다. 정확한 파일 경로·해시는 현황표에 보존한다.
