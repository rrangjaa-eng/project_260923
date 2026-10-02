# worker 재시작 공백: 클라우드 조사·회귀 기록

2026-10-01 20:31 KST · 조사 브랜치 `codex/phase2-cloud-design` · 기준 `cb182d4` · 제품 코드 `9741b0c467671a8e345b7663954b3495ba87f6f8` 유지

## 기존 실패와 실제 원인

기존 `/tmp/switch-worker-real.log`는 `Target.closeTarget` 뒤 `context.waitForEvent('serviceworker', { timeout: 10000 })`에서 실패했다. 그 시도는 실제 정지/재시작 통과로 바꾸지 않는다. 현재 Chromium에서 target ID와 Playwright Worker 객체가 재사용될 수 있어 새 이벤트를 기다리는 것만으로 재시작을 판정할 수 없다.

작은 probe로 확장 로드가 성공한 뒤, 확장 팝업 CDP 세션에서 `ServiceWorker.enable`과 `stopAllWorkers`를 사용했다. `workerVersionUpdated`가 running→stopping→stopped→starting→running으로 변했고, worker의 메모리 표식은 사라졌다. `storage.session` 시험 값과 초안은 보존됐다. 따라서 새 target ID 대신 **실제 stopped 관측 + 메모리 소실 + session 보존**을 동시에 검사한다. CDP의 정지 명령은 [공식 ServiceWorker protocol](https://chromedevtools.github.io/devtools-protocol/tot/ServiceWorker/)에 있으며 시험 도구 안에서만 쓴다. 확장 권한을 추가하지 않았다.

PR11 `0ca4bef`의 `04-01-PLAN.md` Task3에도 확장 팝업 CDP와 명시적 sendMessage 깨우기, 메모리/session 비교가 제안돼 있었다. 이 계획을 현재 자동화 제품이 구현됐다는 근거로 사용하지 않고 시험 방법만 참조했다.

## 회귀 시험과 실행

`tests/e2e/switch-pending.e2e.ts`에 실제 정지 회귀를 추가했다. 한글 초안 `안녕`과 삭제 확인 상태를 준비하고 다음을 확인한다.

- `stopped`가 실제 관찰되고 기존 global 메모리 표식이 소실된다.
- 확인은 paused로 취소되고 화면/`storage.session` 초안은 유지된다.
- worker 정지·복구 및 첫 재개 Space 뒤 클릭 수는 0이다.
- 새 목록에서 대상을 다시 선택하고 새 확인 입력을 줬을 때만 클릭 수가 1이다.
- 기존 포트 단절 회귀에도 재선택 뒤의 명시 실행을 보강했다.

실행 환경은 `workflow-env.sh`의 pnpm10.33.0 / Node24.19.0이며 package의 Node>=22를 만족한다. Node22 CI나 실제 사용자 Chrome/Edge 실행으로 표시하지 않는다. 실제 실행파일은 `/workspace/.cloud-onboarding/browsers/chromium` → Chromium1243, Chrome for Testing153.0.8010.12다. 의존성 설치나 환경 재생성은 하지 않았다.

| 확인 | 실제 결과 |
|---|---|
| 확장 로드 smoke probe | exit0, 실제 작업판 표시 |
| 회귀 RED | 정지 명령 없이 실행: 메모리 `old-worker`가 남아 toBeNull 실패, exit1 |
| 실제 정지 + 기존 포트 재연결 | 2/2 pass, 28.8초, exit0 |
| 포트 재연결에 새 선택/실행까지 보강 | 2/2 pass, 35.3초, exit0 |
| 최종 실제 정지 회귀 | 새 명시 실행까지 1/1 pass, exit0 (최종 로그 참고) |
| typecheck / lint | exit0 |
| production build | 관련 E2E global setup의 build pass |
| 전체 unit/E2E/화면 검토 | 이번 재실행 없음. 제품 코드 불변이며 이전 CI62와 구분 |

로그: `/tmp/phase2-worker-smoke.log`, `/tmp/phase2-worker-close.log`, `/tmp/phase2-worker-stop.log`, `/tmp/phase2-worker-regression-{red,green,final,complete}.log`. 지속 근거는 이 문서와 Git의 회귀 시험이다.

이번은 기존 메모리 재생성의 **시험 관찰 조건 공백**을 채웠다. 제품 변경이 필요하다는 증거는 발견하지 않았다. 기존 closeTarget→새 이벤트 대기 timeout의 결과는 그대로 실패 이력으로 남긴다. 실제 Windows IME·운동 사용성·실사이트, OS 프로세스 강제 종료, 자동 압축 runtime 적용·실행은 여전히 검증하지 않았다. 새 시험은 CI62의 299개에 소급 포함하지 않는다. 문서 커밋의 CI63 종료 결과는 부모가 확인한다.

## 후속 PR 대조

GitHub CLI 조회는 GraphQL Forbidden으로 실패했고 연결된 GitHub 읽기 도구로 PR9~15의 열린 상태와 설명을 확인했다. PR14 `f69f496`의 Program/InputExecutor/NativeHostRegistration/portable-hand client/publish 스크립트와 안전 리뷰를 읽었다. PR13 안전 off 수정은 현재 제품에 포함됐다고 가정하지 않는다. 코드 병합·복사·실행은 하지 않았다. gstack으로 Chrome 공식 문서에 접속한 시도는 ERR_TUNNEL_CONNECTION_FAILED였고 공식 문서 텍스트를 제공 웹 도구로 확인했다.

2차 최소 제안과 PR 재사용 판단은 [설계안](../superpowers/specs/2026-10-01-single-switch-phase2-design.md)에 있다. 새 제품 구현을 시작하기 전 설계 검토와 작은 구현계획이 필요하다. PC 시험을 그 문서 작성의 선행 차단 조건으로 두지 않는다.
