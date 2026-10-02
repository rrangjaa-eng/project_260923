# 작업 현황표

## Space 실행 대기 정지 — 2026-10-02 12:33 KST

`codex-switch-pending-stop`은 PR22/53162c9 후속이다. 실행 대기 중 새 Space로 쉬고 같은 release는 소비한다. 보호 간격 뒤 새 Space는 재개만 하며 중단 명령을 재전송하지 않는다. 늦은 설정 응답의 재개 P2와 즉시 입력 튐도 RED→GREEN으로 막았다.

| 항목 | 확인된 결과 | 남은 상태 |
|---|---|---|
| 최종 로컬 | type/lint/build, unit283/283, 복구·이동취소·재적용E2E11/11(3.0분), UI101/101(4.0분,0fail/skip/flaky) | PC IME·운동 사용성·실사이트 미검증 |
| 단계별 검사 | 안내 한 줄 복원 전 최종 pending/controls/reapply/navigation21/21(7.0분), UI101/101(4.1분) | 최신소스 전체E2E 성공으로 합산하지 않음 |
| PR20 | 243aa2c, [CI77](https://github.com/rrangjaa-eng/project_260923/actions/runs/36955570396) success: unit262/E2E341 | draft·미병합 |
| PR21 | CI79 failure: unit272pass/E2E342pass·1fail. 안내 복원5cb98de, 기존복구6/6(1.6분) 재통과 | [CI81](https://github.com/rrangjaa-eng/project_260923/actions/runs/36959932418) 실행중 |
| PR22 | [draft PR22](https://github.com/rrangjaa-eng/project_260923/pull/22), 제품9aa3b42→안내4fd1d5b→문서53162c9. 문서 충돌 없이 mergeable=true 확인 | [CI82](https://github.com/rrangjaa-eng/project_260923/actions/runs/36960602815) 대기중, PR merge 없음 |
| 새 후속 | [draft PR23](https://github.com/rrangjaa-eng/project_260923/pull/23), codex-switch-pending-stop, 제품e10cec4 | 전체CI 별도 확인 필요·미병합 |

[Space 정지 검증](verification/2026-10-02-pending-space-stop.md) · [구조화 결과](verification/pending-space-stop-results.json) · [CI79 원인·수정](verification/2026-10-02-ci79-notice.md). PR21/22의 같은 안내 수정은 이력을 보존한 cherry-pick이며 force-push·PR merge·deploy·ZIP교체 없음. 기존 늦은 이동 취소 기록은 이 문서 끝에 보존했다. 다음 후보는 앞으로 이동/이동 불가 안내·현재 명령 승인, 그 뒤 다중 스크롤 영역이다. native/C#·새민감수집·교차사이트요약은 확장하지 않는다.

## CI79 안내 회귀 수정 — 2026-10-02 12:23 KST

PR20 CI77은 최종success(unit262/E2E341,31.6분). PR21 e736350의 CI79는 failure(unit272pass, E2E342pass/1fail,32.9분). 기존 복구 테스트가 요구하는 초안 보존 안내가 새 비교 문구에서 누락됐다. 실제 값과 초안 보존은 통과했다. 안내 한 줄을 복원했고 테스트는 변경하지 않았다. 수정 소스 type/lint/unit272/272 및 기존복구E2E6/6을 새로 확인했다. 후속전체CI는 별도이며 완료 전 성공으로 표시하지 않는다. [원인·검증](verification/2026-10-02-ci79-notice.md). **13:08 KST 후속:** CI81도342pass/1fail(31.6분), 보존 복원 때 변경 이유 문구를 제거한 회귀였다. 세 정보 동시 단위1RED→GREEN 뒤 변경 이유·보존·비교 안내를 모두 복원했고 기존양식+복구14/14(6.2분), unit272/type/lint/build를 재검증했다. [CI81 원인·수정](verification/2026-10-02-ci81-notice.md).

PR22 및 대기 중 Space 정지 후속은 보존 중이며 이 문구 수정을 순서대로 반영한다. merge/deploy·ZIP교체 없음. 아래 날짜별 대기 문구는 해당 시점 이력이다.

## 재개·텍스트 재적용 확인 — 2026-10-02 11:40 KST

PR19 뒤에 이미 보존된 `codex-form-controls-errors`/`243aa2c`를 발견해 중복 구현하지 않고 [draft PR20](https://github.com/rrangjaa-eng/project_260923/pull/20)으로 연결했다. PR20 base는 `codex-switch-form-navigation`/`930ab0f`이며 main은 변경하지 않았다. 이번 재개에서 PR20 소스의 타입·린트·단위262/262와 production 선택흐름6/6(3.8분, exit0)을 새로 확인했다. [CI77](https://github.com/rrangjaa-eng/project_260923/actions/runs/36955570396)은 실행 중이며 성공으로 계산하지 않는다. PR19 [CI76](https://github.com/rrangjaa-eng/project_260923/actions/runs/36948311828)은 단위251/브라우저335 success였고 아래 과거의 PR생성·CI대기 문구를 현재 상태로 사용하지 않는다.

후속 `codex-form-reapply-confirmation`은 PR20/243aa2c 위에서 **현재 입력값과 작성 문장 비교 → 취소 먼저/1초 보호 → 명시적 재적용**을 구현했다. 일반 거절 뒤에도 초안·대상을 보존하고, 비교 후 값이 다시 바뀌면 receiver가 거절한다. 쉬기·끄기·늦은 capture·unknown 확인 경계를 검사한다. 검색/제출/자동 재시도 없음. 새 비교값은 저장하지 않고 기존 메모리/표시 경계만 사용한다. 교차사이트 요약/최근값 자동수집/보호저장소로 확장하지 않는다.

| 항목 | 확인된 결과 | 남은 범위 |
|---|---|---|
| 새 단위 | 최초4 RED→GREEN; 경계 추가 후 새10/10·전체272/272 pass | 실제 PC/운동 사용성 별도 |
| 독립 검토 | gpt-6.1-sol/high가 코드·최신 단위/브라우저 시험을 읽고 추가 P1/P2 없음 확인 | 검토 범위와 실제 실행 결과를 구분 |
| 브라우저·화면 | production 새2+기존양식/문서편집기/프레임 총48/48 pass,6.6분,exit0 | 기본 자동UI101/101 pass,0fail/skip/flaky,exit0 |
| Git | [draft PR21](https://github.com/rrangjaa-eng/project_260923/pull/21) 생성·open/draft·미병합, 제품53ce30f 일반push 완료 | 최종HEAD 전체CI 확인 필요 |

[범위·이유·검증](verification/2026-10-02-form-reapply.md). 기존 open Shadow DOM 표시의 중간/낮은 잔여위험을 해결했다고 주장하지 않는다. 회사 시스템 시험·merge/deploy·설치ZIP교체·새권한/의존성 없음. 실제PC IME/손사용감, 사이트별 오류 원문, custom/radio/multiple, 최근값·민감판별 전체, 실제Windows/USB 및 Phase4~6은 여전히 남는다.

## 선택·체크·입력 오류 안내 후속 — 2026-10-02 11:13 KST

기준 PR19 source `930ab0fafe7a446ac1d0c296d8e5b72c035e7638`, 로컬 `codex/form-controls-errors`, 보존 원격 `codex-form-controls-errors`. native 단일 select/checkbox·선택칸 validity 안내를 구현했다. 기존 PR19 수정·중복생성·merge/deploy 없음. 저장모델 기준은 구현 gpt-6.1-sol/medium, 독립검토 gpt-6.1-sol/high이며 현재 채팅 모델 전환을 주장하지 않는다.

| 항목 | 확인된 결과 | 남은 범위 |
|---|---|---|
| 구현 | 선택칸만 capture·명시 apply·input/change·stale 검사·오류 읽기·긴 원문 읽기쪽 | custom/radio/multiple/site 오류원문 제외 |
| 단위·빌드 | 최종 unit262/262, type/lint/production build 통과 | 실제 PC 별도 |
| 브라우저 | 전체341/341 29.7분은 최종 읽기쪽·줄바꿈 보완 전. 보완 후 최신 기본UI101/101 3.2분+실제Space6/6 3.8분. 모두 fail/skip/flaky0 | 최종 전체341 재실행으로 표현하지 않음 |
| 화면·독립검토 | 360/768/1280px DOM·이미지; 좁은 영문 카드 overflow RED→GREEN. 자동쉬기/unknown 보완; 확인된 미해결P1/P2 없음 | Windows IME·실제사이트·손떨림 사용성 미검증 |
| CI·Git | 측정 시간에 맞춰 E2E35/job40분, YAML 통과. 후속 브랜치에 소스·검증 보존 | 원격 CI 실행은 별도; 새 PR 없음 |

[검증·지원범위](verification/2026-10-02-form-controls.md), [단계별 구조화 결과](verification/form-controls-results.json). 기존 ZIP·권한 보존, 자동제출·최근값수집·외부전송·OS연결 없음. 전체 INPT-03/PRIV-01/실제PC검증은 완료로 바꾸지 않는다.

## 양식 탐색 후속 — 2026-10-02 03:36 KST

기준 PR18/6fce6f5, 로컬 `codex/switch-form-navigation`. 최신 게시 클라우드에서 승인된 입력칸 metadata 목록·필드 이동·작업 보존·명시적 적용·원래 화면 복귀를 구현했다. 선택칸만 capture하며 필드별 문장·커서/선택·undo·부분한글은 메모리에 보존한다. 무효화 시 원래 문장을 복원하고 양식 문장은 대상 없이 명시 복구한다. 새 개인 데이터 수집이 필요한 최근값 카드는 구현하지 않았다.

| 이번 결과 | 실제 근거 | 남은 상태 |
|---|---|---|
| 설계·제품 | [설계](superpowers/specs/2026-10-02-form-navigation-design.md), [검증](verification/2026-10-02-form-navigation.md) | input/textarea subset; INPT-03 전체 완료 아님 |
| 타입·린트·단위 | 최종 type/lint exit0, unit251/251pass | 실제 PC 별도 |
| 관련 실제 확장 | 모든 switch+문서/프레임96/96pass,17.7분,0fail/skip/flaky. 새양식7·기존문서/프레임38 포함 | 같은 제품의 추가 맥락1/1pass16.4초 |
| 기본 자동 화면 | ui-review run-jQ4Ot3,101/101pass3.3분,exit0 | overview/긴선택칸 360/768/1280px DOM+실제 이미지 확인 |
| 안전·UX | 독립 P2 4건 RED/수정/재검토; 미해결 P1/P2 없음. [구조화 증거](verification/form-navigation-results.json) | 정적 검토와 실제 테스트 구분 |
| CI 시간 한도 | E2E30분/job35분, YAML parse pass. 전체335 시험·Node22·frozen install·contents:read 유지 | 최종 draft PR HEAD 전체CI 별도 관찰 |
| 원격 저장 | 소스·증거 커밋 후 새 draft PR 생성 진행 | 실제 PR번호는 생성 응답 뒤 기록 |

부모가 PR16 CI71·PR17 CI73·PR18 CI75 최종 success를 확인했다. PR18 CI75/run36899740939 원본 job110495937559는 unit246/246, E2E327/327(23.4분), 정상 종료이며 PR18 본문은 부모가 갱신했다. child는 중복 조회/실행하지 않았다.

기존 ZIP·PR15~18은 보존하며 merge/deploy·새권한·실제OS 연결은 이번에 수행하지 않았다. 다음 결정은 select/체크 위젯·사이트 오류 읽기와 변경된 입력값 재적용 확인 UI의 범위다. 실제PC IME/운동 사용성·INPT-01 최근값 수집·PRIV-01 전체 판별은 열린 상태다.

## 문구 관리 후속 — 2026-10-02 02:24 KST

로컬 `codex/switch-phrase-management`, 기준PR17/035ce70. 기존 INPT-02 저장/삽입 흐름에 현재작성문장으로 명시교체·삭제/취소/1초확인, writer 큐의 목록 충돌·현재 승인 검사, worker 취소세대 검사를 추가했다. 독립 리뷰 P2(옛 done 승인 뒤 쉬기에도 저장)를 RED→GREEN으로 수정했다. 페이지 제출·민감칸 수집·외부전송은 없다.

현재 최종type/lint exit0, unit246/246. 기본UI101/101pass3.2분은 미리보기 페이지 추가 전 실행이며 공통스타일은 불변. 짧은 미리보기에서도 새문장이 가려지는 실제 화면 결함을 발견해 24grapheme 쪽과 Space 이전/다음 선택으로 보완했다. 최종 새6+기존doc-editor/editor-frames38 **44/44pass3.8분,exit0**. 긴한글/이모지/줄바꿈 Space미리보기까지 확인. [문구 관리 검증](verification/2026-10-02-phrase-management.md). [draft PR18](https://github.com/rrangjaa-eng/project_260923/pull/18)을 실제 생성했다. base=codex-phase2-fake-handoff/035ce70, head=codex-switch-phrase-management; open/draft/미병합. 제품검증source e360466, PR번호 기록은 문서만 변경하며 최종HEAD의 전체CI는 아직 미확정이다.

PR17 최종CI73는 **success**, E2E321/321·unit223/223. 결과는 이 후속 브랜치에 기록해 통과한 PR17을 반복 실행하지 않는다. 남은 INPT-01 최근값, INPT-03 양식전체, PRIV-01 민감판별전체·실제PC 검증은 열린 상태다.

## 최신 후속 상태 — 2026-10-02 01:58 KST

PR16 source c608d00의 CI70는 E2E313건 단언 통과 뒤 20분 단계 timeout으로 **failure**다. 시간을 25분으로 조정한 `baafce22511698bcbb2c164cc3afe821ba6bbc93`를 PR16에 일반 push했다. job30분·시험·권한은 유지하며 새 CI는 부모가 관찰한다.

후속 `codex/phase2-fake-handoff`는 baafce2 기반이다. strict payload/reply gate·Space 단일 소유권·전환/취소복귀·초안 보존을 로컬 fake로 구현했다. 독립 리뷰 P2 두 건을 RED→GREEN으로 수정했고 unit223/223·새E2E8/8·기존file-practice7/7이 통과했다. 자동 화면 첫 실행99pass/2fail 뒤 겹친 빌드를 배제한 최종검사101/101pass,0fail/skip/flaky,3.3분,exit0. 최종type/lint도exit0. [검증 전문](verification/2026-10-02-fake-handoff.md). [draft PR17](https://github.com/rrangjaa-eng/project_260923/pull/17)을 실제 생성했다. base=codex-phase2-file-practice/baafce2, head=codex-phase2-fake-handoff. open/draft/미병합. 최종HEAD035ce70의 CI73/run36895970686는 success: unit223/223·E2E321/321,20.9분,Node22.23.3. PR16CI는 부모에게 맡긴다.

다음 승인된 bounded 작업은 기존 INPT-02 local 문구 관리의 수정/삭제이다. 저장 문구 스냅샷 선택 → 현재 작성 문장으로 바꾸기 또는 삭제 → 취소 먼저/1초 보호 확인 → 단일 저장자에서 목록 일치·현재 승인 재검증 후 쓰기. 취소/쉬기/옛 응답은 실행·재시도 없이 초안을 보존한다. 최근값 수집(INPT-01), 양식 전체 모아 보기(INPT-03), 민감판별 전체(PRIV-01)는 여전히 미완료다. 자동 제출·외부 전송·실제OS 연결은 추가하지 않는다.

갱신: 2026-10-01 23:56 KST · [draft PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) · 전달 로컬 `codex/installed-page-investigation` / 원격 PR 작업 브랜치 `codex-single-switch-phase1`

## 남은 개발 재개 — 2026-10-02 00:56 KST

작업명: `PR16 | 파일 선택 연습·안전 계약`. 기존 세션 재사용, 로컬 `codex/phase2-file-practice`, 원격 `codex-phase2-file-practice`; PR15/20440e6·설치ZIP은 보존. 부모가 CI67/run36880332412 최종success와 PR15본문 갱신을 직접 확인했다. 최신 남은 개발 진행 승인으로 PC 시험을 클라우드 개발의 대기조건으로 삼지 않는다.

| 이번 진행 | 실제 결과 | 다음 작업 |
|---|---|---|
| 기존 계획 대조 | 8단계 핵심/선택/초점/초안/탭/종료 구현 완료. 오래된 미체크박스를 중복 구현하지 않음 | 실제PC TEST/DIST, 문구관리·최근값·양식전체, 실제OS/USB, 반복업무는 남음 |
| 보류 회귀 | f21a215의 실제 worker stop만 복원, 최신제품 기준1/1 pass22초 | PR13/14 복사·병합 없음 |
| 파일 선택 안전 | 고정 가짜provider·토큰/요청/세션/문서·모드/만료/확인1초/정지latch/3초응답유실unknown. 최종 전용16/16·전체164/164 pass | 실제 파일/API 전송은 구현하지 않음 |
| 독립 리뷰 P2 수정 | 동일요청 pause반복 재실행 RED3 fail/13 pass→16pass. 전송latch와 응답대기중 새요청 차단. 내부input초점 변경+orphanup UI RED1fail→GREEN1pass16.3초 | 리뷰2건 수정. 정상 새요청·초안 보존 유지 |
| 연습UI/DOM | 선택·확인·취소·복귀·쉬기·종료/키복구·3viewport 관련5pass; 수정된 초점회귀별도1pass. 좁은화면 지속표시 RED1fail→3viewport GREEN | 화면3장 갱신. 실제OS 실행으로 표시하지 않음 |
| 기존 자동 화면 검토 | 기존 실행40492 회수: **101/101 pass**,0fail/skip/flaky,3.4분,exit0 | 수정 전 실행이며 새6건과 구분. 공통엔진/패널/기존popup 불변. 중복100검사 없음 |
| 최종 type/lint/build | exit0·production build pass. 기존ZIP 대비permissions/host/content_scripts 동일 | 새권한/설치/OS/네트워크/260917접근 없음 |
| 전체검증/새PR | [draft PR16](https://github.com/rrangjaa-eng/project_260923/pull/16) 생성 완료·최종HEAD의 전체CI 확인 진행 | PR15 대상으로 별도 stacked PR. merge/release/deploy 없음 |

[최종 수정·검증 기록](verification/2026-10-02-file-practice.md). 완료된 1차를 새로 만들지 않았고 `.planning` human_needed를 임의로 통과시키지 않았다. 현재 기록의 미확정 전체CI는 최종수치 확인 뒤 보완한다.

환경 긴급 보고는 613bbe9에 보존했다. 선택ID와 ready는 런타임 확인, 명령은 Linux6.18.44/x86_64에서 성공, exec도구 응답에는 독립호스트유형·PC연결식별자가 없다. 확인을 반복하거나 PC로 전환하지 않았다.

다음 승인된 클라우드 항목은 가짜provider 경계의 문서/모드/세션 변경 및 결과불명 테스트벡터와 입력소유권 복귀를 확대하는 것이다. 실제 파일 연결, nativeMessaging 권한·Windows host등록·USB접근·웹스토어게시/배포는 승인 필요 항목으로 분리한다. 반복업무 자동화는 현 파일 흐름의 실제연결 이후 설계 순서를 유지한다.

## 설치본 신고 대응 — 현재 우선 작업

사용자가 기존 ZIP의 페이지 연결·Space 활동 선택·종료 문제를 신고했다. 기존 자동299 통과로 신고를 닫지 않고 실제 설치와 네이티브 popup부터 재현했다. 2차 설계/worker 후속은 로컬 `codex/phase2-cloud-design`의 `f21a215`에 보존하고 중지했다.

**최종 검증·Git 전달:** 제품 `3ae6ad2`, 검사 HEAD `91c0ae5`의 CI65는 최종 success다(단위148/148·E2E305/305,17.0분,Node22.23.3). 사용자가 설치 ZIP의 Git 작업 브랜치 저장을 새로 승인했다. 최종 ZIP을 새 프로필에 실제 설치한 Space 시작·한글 검색·읽기·즉시 정지·일반 키 복구 smoke도1/1 통과했다. 전달 파일을 `downloads/`에 보존한 `2a0b3f5`를 PR15 작업 브랜치와 안전 브랜치 양쪽에 일반 push 완료했다. GitHub 파일 화면·raw 다운로드 모두 HTTP200이며 다운로드 ZIP·안내·SHA파일의 로컬 바이트 일치를 확인했다. Library403 재시도·우회, 제품 코드 변경·merge·release·deploy는 하지 않는다.

| 항목 | 최신 실제 결과 | 남은 범위 |
|---|---|---|
| 수정 제품 SHA | `3ae6ad29fd3e77e43cdb68c51d540035e1002b16`; 첫 로딩 초안·고정 카드 식별자·늦은 복원 가드 | 원격 양쪽 `91c0ae562214816093d29fc60203d6b109f71cb8` 확인. PR15 open/draft, head91c0ae5 확인. merge 없음 |
| 실제 설치·Space 시작·즉시 정지 | 최신 production 설치/팝업5건 및 한글 전체여정1건 **6/6 pass**,3.6분,exit0. HTTPS 기존/새 탭·held Space·일반 입력·관리 비활성화·손상·지연 켜기 포함 | `/tmp/urgent-release-native-final.log`의 최종 빌드. 두산 공개 사이트는 `ERR_TUNNEL_CONNECTION_FAILED`, 미검증 |
| 종료 경합 | 손상/읽기 실패/늦은 켜기/로컬 commit 지연 회귀 및 독립 검토 수정 | 저장·페이지 API 전체 불통 때 전역 정지 성공을 보장하지 않음 |
| 최신 type/lint/unit/build | type/lint exit0, 전체unit148/148, production build pass. 비동기 조건 함수 정리 후 해당8건 재검사8/8 | `/tmp/urgent-release-{unit,type-final,lint-final}.log`. 새 CI Node22 결과 별도 확인 |
| 자동 화면 검토 | 최종 CI65 전체305/305에 기존 UI100 및 확장로드smoke 포함 | 실제 운동 사용성 검증은 아님 |
| 새 권한/의존성 | manifest storage/scripting/tabs·all_urls·content_scripts 동일, package/lock/config 변경 없음 | 새 권한·설치·네이티브 실행기 없음 |
| 독립 안전 검토 | 종료·초기 응답 revision 경계 검토에서 미해결 P1/P2 없었음 | 이후 전체 CI에서 초안·선택 복원7건 발견. 검토 범위를 전체 제품 통과로 확대하지 않음 |
| 신규 CI64 | [run 36861983233](https://github.com/rrangjaa-eng/project_260923/actions/runs/36861983233), SHA `3027291`: **failure**, E2E296/304 pass·8 fail,18.3분,exit1 | 초안·선택 복원7건 및 popup 경고1건 수정 필요; 과거 CI62 결과를 재사용하지 않음 |
| CI 실패 관련 로컬 재현 | production 관련26건: **18 pass·같은8 fail**,3.8분,exit1 | `/tmp/urgent-ci64-target-red.log`; 테스트 단언 유지. 전체 수백 건 재실행 없음 |
| 수정 후 집중 결과 | 상태단위 RED5 fail·1 pass→6/6 GREEN; 기존 text/selection E2E13/13 GREEN; W1·같은 카드 이동 반복2/2 GREEN | 기존 실패8건의 기대값 모두 유지. `/tmp/urgent-draft-state-{red,green,final}.log`, `/tmp/urgent-draft-target-green.log`, `/tmp/urgent-popup-warning-green.log` |
| 지연 draft/read 후속 | 실제 RED1 fail·7 pass→최소 응답 가드 후8/8 GREEN. untouched 정상 저장 초안 복구도 유지 | `/tmp/urgent-draft-late-{red,green,final}.log`; 기존 modeGeneration·현재초안의도·disposed 재검사. 독립 검토 미해결P1/P2 없음 |
| 현재 최종 검증 | production 영향48/48 pass,7.8분,exit0; 마지막 조건 함수의 final 빌드에서 native/전체여정6/6 pass | `/tmp/urgent-final-impact.log`, `/tmp/urgent-release-native-final.log`. 전체 수백 건은 새 CI에서 한 번 확인 |
| 신규 CI65 | [run36871344925](https://github.com/rrangjaa-eng/project_260923/actions/runs/36871344925), head `91c0ae5`, job110399604371: **success**, type/lint/build pass,unit148/148·E2E305/305,17.0분 | 2026-10-01 23:06 KST 종료. GitHub 실제 jobs·로그 직접 확인. 후속 전달 커밋은 제품 소스 변경 없음 |
| 최종 설치물 | [ZIP](../downloads/tremor-browser-helper-3ae6ad2.zip),9파일,1,163,247 bytes, SHA256 `bf84ada9a8b1f211b6d43318c02da1fd53b4482aafa41f648b4c9aef1eec2bdb`; integrity·production바이트대조·기존권한대조 pass | 사용자 승인에 따라 ZIP을 Git 추적·PR15 브랜치 push 완료. 실제 raw 다운로드 바이트 일치 pass. Library는 저장되지 않음 |
| 최종 교체 안내 | [한국어 설치·교체·시작·종료 안내](../downloads/README.ko.md), [SHA256SUMS](../downloads/SHA256SUMS) | CI 대기 문구 제거. 구버전 끄기/제거·새버전 하나 로드·기존 탭 새로고침 안내 |
| Library 교체 | 공식 업로드 도우미 첫 시도·허용된 1회 재시도 모두 전송 전 exit1; 기존 파일 유지 | tools/list network 오류; 연결 확인 HTTP tunnel403. 현재 read의 version_id는 null, 원본 xattr version0 보존. 직접/raw 업로드 우회 없음 |

[재현·수정·검증 전문](verification/2026-10-01-installed-popup-safety.md) · [새 설치·시작·종료 안내](verification/single-switch-install-and-stop.md). 아래 이전 마감은 역사 기록이며 이번 실사용 신고의 해결 근거가 아니다. merge·배포는 수행하지 않는다.

이전 Library 교체 시도는 실패했고 기존 파일은 그대로다. 사용자 새 승인으로 전달 방식은 Git 작업 브랜치의 `downloads/`로 변경됐다. 구 `9741b0c`·중간 `6aeb4ce` ZIP은 전달하지 않는다. 아래 Library 오류 기록은 역사적 차단 증거다.

업로드 도우미의 오류는 `library upload failed: hosted apps tools/list request failed: network`, exit1이며 결과 stdout은 0 bytes였다. 업로드 준비·바이트 전송·최종 저장 이전 단계다. 실패 호스트는 `chatgpt.com`이고, 같은 공식 엔드포인트의 별도 연결 확인에서 `Tunnel connection failed: 403 Forbidden`을 관측했다. 프록시의 연결 거절은 확인됐지만 정책 이름·거절 사유 본문은 제공되지 않았다. 비공식 업로드, 서명 URL 추측, 인증정보·환경 변경은 수행하지 않았다.

초안7건의 원인은 첫 안전 로딩의 `false→true`도 `enabledChanged→invalidate`를 호출해 아직 가져온 적 없는 빈 초안을 보존 대상으로 표시한 것이다. `invalidate`는 실제 선택한 대상·텍스트·작성 중 음절 또는 이미 명시한 초안이 있을 때만 보존하도록 수정했다. 첫 로딩/사용 전 다시 켜기/begin은 capture를 허용하고, 쉬기·편집한 문장·명시적 빈 새 문장은 유지하는 실제 controller 단위6건으로 확인했다.

팝업 W1의 실제 클릭 기록은 도우미 켜기 `(28,537.390625,t589.7)` 뒤 사이트 끄기 `(28,529.59375,t623.4)`였다. 서로 다른 카드가 7.8px/33.7ms에 놓여 기존300ms/16px 좌표 필터가 사이트 클릭을 거절했고 저장은 `{}`였다. 화면 위치 대신 고정 단축키를 카드 공통 식별자로 사용해 같은 카드 반복은 거르고 다른 카드는 허용했다. 위치가 움직인 같은 카드를 빠르게 다시 누르는 신규 검사도 RED(다시 켜짐)→GREEN(꺼짐 유지)이며 W1의 원래 경고·role 단언은 그대로다. 증거: `/tmp/urgent-popup-toggle-events-red.json`, `/tmp/urgent-popup-site-storage-red.json`, `/tmp/urgent-popup-moving-red.log`.

제품·인계 체크포인트는 안전 원격 `codex-installed-page-investigation`에 저장하고 필수 검사를 마쳐 PR15 `codex-single-switch-phase1`에 fast-forward 반영한다. 새 HEAD CI 최종 결과까지 확인한다. PR15 본문은 이전 완료 설명이 남아 있어 부모의 갱신 대상이며, 이 턴에서 변경·재시도하지 않았다. 자동 압축은 이미 저장된 모델 기본 임계값·total을 유지했고 현재 런타임의 compact 실행은 관찰하지 못했다. 환경·설정·Library 연결은 더 변경하지 않았다.

최종 ZIP 추가 실행 명령은 `source /workspace/.cloud-onboarding/workflow-env.sh && CI=true pnpm exec playwright test --config docs/verification/package-smoke/playwright.config.ts`였다. 새 깨끗한 프로필·ZIP 직접 압축 해제·실제 native popup·로컬 HTTPS·저장소 직접 변경 없음으로 **1/1 pass,58.3초,exit0**. 화면3장은 `downloads/evidence/`에 저장했다. 전달용 검사 스크립트만 추가했고 제품 소스는 변경하지 않았다. 초기 스크립트의 Buffer+문자열 lint1건은 UTF-8 read로 정리했으며 최종 type/lint 검사 결과를 함께 보존한다. 기존 전체 검사는 중복 실행하지 않았다. PR 본문 최종 갱신은 부모가 처리한다. 실제 두산 접속·Windows IME·운동 사용성은 미검증이며 사용자 추가 테스트를 완료 조건으로 요구하지 않는다.

## 이전 1차 구현 마감 기록

최신 사용자 승인(계획 제시 뒤 `진행해`)에 따라 제품 구현을 계속한다. 별도 문서 체크포인트 `58cc6e8`은 `codex/single-switch-design-checkpoint`에 보존했으며 개발 승인을 설계 대기로 되돌리지 않는다.

기존 GSD/인계/요구사항과 새 8단계의 연결·대체 계약은 [프로젝트 매핑](superpowers/plans/2026-10-01-single-switch-project-map.md)에 저장했다. 공식 GSD 상태 명령으로 결정·재개 위치만 기록했으며 planner/checker/verify-work/phase 완료는 수행하지 않았다. 기존 19개 PLAN/SUMMARY와 human_needed 기록은 보존한다. 코드·설계·계획·운영 규칙·현황·후속 회귀 초안을 Git/PR에 저장한다. 런타임 인증정보·캐시는 제외한다.

| 최신 체크포인트 | 실제 결과 | 남은 작업 |
|---|---|---|
| 최종 구현 SHA | 제품 구현 최종 SHA `9741b0c467671a8e345b7663954b3495ba87f6f8`; 후속 커밋은 문서만 변경 | 실제 PC·실사이트 검증은 별도 |
| 최종 CI62 | [run 36852334422](https://github.com/rrangjaa-eng/project_260923/actions/runs/36852334422), SHA `9741b0c`: **success**, E2E299/299, unit135/135, type/lint/build pass | worker 종료 후 재시작 timeout 시나리오와 자동 압축 runtime은 통과로 계산하지 않음 |
| CI60 (`e3287e1`) | **최종 success, E2E292/292**, type/lint/unit131 pass | 후속 선택·패널 변경까지 포함한 결과는 아님 |
| 선택범위·초점 복원 | `0dfb4ba`: input/textarea 범위·방향 capture, grapheme cursor/anchor, 선택 교체/삭제/undo. 유효한 대상의 명시적 복원만 focus | 실제 PC·실사이트 검증은 후속 |
| 적용과 포커스 분리 | 이메일 선택 API 미지원 및 focus 중 종류 변경 RED→단위 GREEN. 적용은 초점 이동 없이, 복원은 값·유형·활성 상태 재검증 | 실제 PC·실사이트 검증 별도 |
| 작업판 지속 맥락 | 목록만 스크롤. 360/768/1280px에서 제목 top31px, 상태 top75.8px, 선택56px·글자18px·페이지scroll0. screenshot 직접 확인 | 모든 줌/스크린리더 검증으로 확대하지 않음 |
| 최신 단위·type/lint | 최종 CI62에서 unit135/135, type/lint pass | 실제 PC·실사이트 검증 별도 |
| 선택·패널 E2E | 6/6 pass. 전체 switch 영향40/41(9.2분), 공백 fixture 실제 커서를 끝으로 명시한 재검사1/1 pass | full296에서 해당 시나리오도 통과 |
| 전체 로컬 UI/E2E | `0dfb4ba`의 `run-FpP8BY`: **296/296 pass**, 0 fail/skip/flaky,16.2분,exit0. switch41·기본UI100·확장로드smoke3 모두 같은 실행의 부분집합 | 이후 작은 표시 보완까지 이 전체 통과에 포함하지 않음 |
| 최종 표시 보완 | 선택/삽입 위치를 토큰 기반 mark/caret으로 표시하고 긴 초안 내부만 scroll. 마우스 전환 전 작업판 종료 표시. 3건 RED→입력5 포함8/8 GREEN, 긴 초안 상태·경계 재검사1/1 pass | 구현 SHA의 최종 CI는 아래 run 참조 |
| 최종 기본 UI | 새 표시 코드의 `run-jwbVzP`: **100/100 pass**,0 fail/skip/flaky,3.2분,exit0. type/lint pass | 이전전체296과 합산하지 않음 |
| 독립 review/cso/QA | 신규 선택·포커스·패널 및 후속 표시 코드 읽기 검토: 새 미해결 P1/P2 없음. 기존 안전 검토와 실제 회귀 근거 보존 | 실제 OS·운동 사용성은 별도 |
| PR 본문 | child에서는 명시 승인 인용도 도구 출력으로 분류돼 재거절. 부모가 주 대화의 직접 승인으로19:46 KST 실제 갱신·본문 확인 성공 | 이후 최종 결과의 본문 갱신은 부모가 처리. child 추가 재시도 없음 |
| 자동 압축 설정 | 제공 CLI0.159.0-alpha.3 스키마 pass. 임계값 미설정=모델 기본값 보존, scope=`total` | 현재 호스팅 세션 적용·실행 상태는 관찰 불가 |
| 1차 사용자 검증 | 실사이트·실제PC IME·오선택·피로·속도는 미실행. [재현 인계](verification/2026-10-01-single-switch-pc-check.md) 작성 | CI 통과와 실제 사용자 합격은 별개 |

로그: `/tmp/switch-editor-parent-red.log`, `/tmp/switch-journey-first.log`, `/tmp/switch-safety-red.log`, `/tmp/switch-pause-red.log`, `/tmp/switch-mode-confirm-red.log`, `/tmp/switch-journey-safety-green.log`, `/tmp/switch-integration-unit.log`, `/tmp/switch-pr-{type,lint}.log`, `/tmp/switch-impact-regression.log`. 초기 조회 기준 unit125·관련E2E22는 이번 여정 전에 통과한 기반이며 전체 기능 완료를 의미하지 않는다.

이 표는 사용자 보고용 현황이다. GSD 페이즈 상태의 원본은 `.planning/`이며 이 표가 이를 대체하지 않는다. 통과는 아래 실제 실행 범위에 한정한다.

| 작업 | 상태 | 실제 검증·근거 | PR | 다음 단계 |
|---|---|---|---|---|
| 새 클라우드 환경 확인 | 완료 | 선택 환경 ready, 기준 SHA `64976a7`, 게시 규칙 확인. 설정 version 메타데이터 일치는 별도 확인 못 함 | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 현재 환경에서 후속 작업 |
| 기존 확장 기준선 | 통과 | CI 프로덕션 build·확장 로드 smoke 3/3·typecheck·lint·unit 115/115. 2026-10-01 실행 | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 관련 변경 시 필요한 검사만 실행 |
| 기존 입력 실패 / 단계1 | 관련 경계 수정·검증 완료 | 기존 두 실패 이번 4/4 및 반복20/20 통과, 간헐 원인은 미확정. 늦은 비활성 프레임 보고 회귀 RED→수정 후 관련 E2E52 통과. `b00f90a` | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 최종 회귀에서 간헐 실패 관측 계속 |
| 1차 단일 스위치 설계 | 사용자 승인됨 | 2026-10-01 개발절차 진행 승인·정정 전달. 기존 Library 검토안 `libfile_12389aee1b948191b3c77c1db73bc0dc` | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 승인 설계를 구현계획으로 연결 |
| 1차 구현계획 | 사용자 실행 승인됨 | 기존 클라우드 직접 단계별 실행 승인. Library `libfile_5afac0f680c881919d6a4c6adde9d209` | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 승인된 8단계 순차 진행 |
| 모델·추론 매핑 / 새 세션명 규칙 | 로컬 저장·커밋 완료 | `e7614ab`: AGENTS·Codex 설정만 포함. TOML 파싱·제공 스키마·매핑·diff 확인 통과 | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 새 세션 생성 쪽에서 기준 명시. 다른 checkout 반영은 별도 단계 |
| Node 버전 일치 | 조정 필요 | cloud 24.19.0 / CI 22 고정. package engines는 >=22, 게시 클라우드 스크립트에는 Node22 핀 없음 | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 후속 환경 조정 여부 결정. 이번에 설치·변경 없음 |
| 제품 구현 / 단계2 | 첫 수직 흐름 통과 | Space 시작→페이지 항목→링크 실행1회 실제 CI E2E pass (6.7초). type/lint pass, 신규 단위6파일10 pass | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 다음 단계3~7 통합 검증 계속 |
| 제품 구현 / 단계3~5 | 주요 통합 통과·잔여 계약 검사 필요 | 새 한글·중간 수정·입력 적용 및 안전 실행 경계 실제 검사 통과. 전체unit130 통과 | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 기존 입력 실행 통합, 프레임/중복/민감칸 검사 확대 |
| 제품 구현 / 단계6~8 | 첫 웹 활동과 승인된 1차 제품 범위 구현 완료 | 전체 여정 및 확인·복구 통합 검증, CI62 성공. 실제 PC·실사이트 사용성은 미검증 | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 별도 PC 시험 후 후속 범위 판단 |
| 작업 현황표 / 유지 지침 | 로컬 저장·커밋 완료 | 이 파일과 AGENTS 유지 지침만 포함한 `docs: add maintained work status table` 커밋. 필수 항목·유지 지침·diff 정적 확인 통과 | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 상태 변경 때 갱신하고 사용자에게 표시 |
| 원격 반영 | draft PR15 게시됨 | 기존 원격 `codex` 때문에 첫 push 경로 충돌. 기존 ref 보존 후 `codex-single-switch-phase1`에 게시. 같은 head 중복 PR 없음 확인 | [PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15) | 같은 PR에서 잔여 구현·검증 계속. 병합·배포 없음 |

초기 검증 로그: `/tmp/single-switch-smoke.log`, `/tmp/single-switch-type.log`, `/tmp/single-switch-lint.log`, `/tmp/single-switch-unit.log`, `/tmp/single-switch-focused-e2e.log` (현재 클라우드의 로컬 로그). 설계·계획 원문은 Git과 PR15에 포함한다. 최신 검사 결과는 위 표에 한정한다. 전체 로컬 E2E·자동 UI 검토는 위 실패를 포함하며, 실제 PC 사용성은 미실행이다.

최신 구현 로그: `/tmp/switch-task1-green.log` (관련52 pass), `/tmp/switch-mode-report-red.log` (늦은 프레임 모드 보고 RED), `/tmp/switch-click-proxy.log` (실제 Space 링크 실행 pass), `/tmp/switch-checkpoint-type.log`, `/tmp/switch-checkpoint-lint.log`, `/tmp/switch-checkpoint-unit.log` (신규10 pass). 각 로컬 로그는 그 실행의 검증 범위에 한정하며 최종 종합 결과는 위 CI62를 참조한다. HTTP 문서에서 crypto.randomUUID 미지원과 content script의 storage.session 접근 차단을 실제 오류로 확인해 getRandomValues ID 및 백그라운드 읽기 중계로 수정했다.

최신 마감: 구현 SHA `9741b0c467671a8e345b7663954b3495ba87f6f8`의 [CI62](https://github.com/rrangjaa-eng/project_260923/actions/runs/36852334422)는 success이며 E2E299/299, unit135/135, type/lint/build가 통과했다. 제품 구현과 해당 자동 검증은 완료로 기록한다. 실제 PC·IME·운동 사용성·실사이트는 미검증이다. CI run에서 worker 종료 후 재시작을 기다린 timeout 시나리오는 통과하지 않았으며, 자동 압축 설정의 파일/스키마 검증은 호스팅 runtime에서 실제 적용·실행됐다는 증거가 아니다. 둘 다 통과 수치에 포함하지 않는다. 후속 문서 커밋은 제품 구현 SHA를 바꾸지 않는다.

## Git 다운로드 검증 완료 — 2026-10-01 23:55 KST

[실제 확인한 ZIP 파일 화면](https://github.com/rrangjaa-eng/project_260923/blob/codex-single-switch-phase1/downloads/tremor-browser-helper-3ae6ad2.zip) · [실제 다운로드 ZIP](https://raw.githubusercontent.com/rrangjaa-eng/project_260923/refs/heads/codex-single-switch-phase1/downloads/tremor-browser-helper-3ae6ad2.zip) · [교체 안내](https://github.com/rrangjaa-eng/project_260923/blob/codex-single-switch-phase1/downloads/README.ko.md). 세 파일의 GitHub/raw 응답200·실제 다운로드 바이트 일치 근거는 [기록](verification/package-smoke/download-verification.json)에 보존했다. 새 전달 커밋에는 제품 코드 변경이 없어 제품SHA3ae6ad2와 CI65 검사HEAD91c0ae5는 그대로다. 전달 후 새 HEAD의 자동CI는 CI65 최종success와 별개이며 아직 완료로 계산하지 않는다. 최종 typecheck·lint는 exit0이다. Library 저장은 하지 않았고 merge/release/deploy는 수행하지 않았다.

새 draft PR16을 실제 생성했다: https://github.com/rrangjaa-eng/project_260923/pull/16 . base=codex-single-switch-phase1/20440e6, head=codex-phase2-file-practice, open/draft/미병합. 제품 수정 커밋d9160f1, 후속 PR번호 기록은 문서만 변경한다. 검증된PR15는 그대로다. 최종 전체CI결과는 별도 안전기록브랜치에 보존해 같은제품의 전체검사 반복을 피한다.

## 2026-10-02 01:12 KST: 만료 후 쉬기 복귀 경계

전체CI69가 실행되는 동안 expiry 경계를 추가 점검했다. page.clock으로 실제연습화면에서 쉬기뒤61초를 앞당긴 다음 같은파일을고르면 flow.select가거절되나 UI의 executing이남아 Space종료메뉴로 돌아오지 못하는 RED1fail을 확인했다. 실패한선택도 적용0·새시작ready로돌아오도록 최소수정했다. 새시작Space는 재개만 하고 종료까지Space만으로가능한 실제회귀를 포함해 **최종관련UI7/7pass,1.4분,exit0**다. 최종type/lint도exit0. 이실제제품수정때문에 기존CI69를최종통과로사용하지 않고 새HEAD 전체CI를확인한다. 환경/권한변경이나 같은소스의 중복전체실행이아니다.

## 대기 중 이동 취소 후속 — 2026-10-02 11:57 KST

`codex-switch-navigation-guards`는 PR21/e736350 뒤의 별도 후속이다. 이전 PR20/21 HEAD는 유지한다. 탭 조회/ping/pause 응답 대기 중 쉬기·끄기·source탭제거 후 늦은 뒤로/탭활성화가 실행되는 경계를 worker6줄로 막았다. 독립 검토가 찾은 삭제된 취소카운터 P2도 RED→GREEN으로 수정했다.

| 항목 | 실제 확인 | 남은 범위 |
|---|---|---|
| 단위 | 첫2RED/2GREEN, 탭제거 추가1RED/5GREEN, 최종신규6/6·전체278/278 | 일반 pending Space 정지는 별도 미지원 |
| 실제 브라우저 | 첫1fail/2pass: 기존한글전체여정·탭제거pass, pending Space 쉬기 가정fail. 실제 초점이탈 쉬기로 좁힌 최종취소2/2pass22.6초 | 최초3개 전체통과로 표현하지 않음 |
| 변경범위 | worker 취소검사6줄, UI/메시지/권한/의존성 불변 | 전달 전 모든지연·이미실행한이동 취소를 보장하지 않음 |
| Git/CI | 후속 PR 미생성, 소스·증거 보존 준비 | PR20 CI77·PR21 CI79 전체검사 실행중 |

[검증·다음 우선순위](verification/2026-10-02-navigation-cancel.md), [구조화 근거](verification/navigation-cancel-results.json). 다음 핵심은 **일반 실행 대기 중 Space 정지**, 이후 앞으로 이동/실패안내, 그 다음 다중스크롤영역 설계다. C#/native/USB·민감수집/교차사이트요약은 확장하지 않는다. 회사시스템 시험·merge/deploy·ZIP교체 없음.
