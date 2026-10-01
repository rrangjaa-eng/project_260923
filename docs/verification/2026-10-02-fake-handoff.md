# 가짜 프로토콜·입력 소유권 검증

2026-10-02 01:56 KST · base PR16/baafce2 · codex/phase2-fake-handoff. 외부 메시지 수신, 실제 파일/OS 접근, native host, 새 권한은 없다. 고정 가짜 provider를 로컬 함수로 호출한다.

## 구현과 재현

version1/허용8명령/opaque token/strict extra 필드 거절, 실행만료·문서/모드/세션/소유권세대·3초 응답기한·중복/옛응답거절은 순수 parser/gate로 검증한다. token은 인증수단이 아니며 실제 외부 프로토콜이나 서로 다른 기기의 시계 계약은 구현하지 않았다.

기존 switch-engine의 Space down/up을 소유자 한 명만 받는다. 전환·취소복귀는 세대를 올리고 양쪽 누름/승인을 버리며 초안을 보존한다. 첫 새 입력은 재개만 한다. 무입력은 쉬기로 이어지며 자동 동의·재시도는 없다.

독립 리뷰에서 P2 두 건을 수정했다.
- 입력칸에서 놓은 키를 전달하지 않아 첫 새 재개가 소비됨: 실제 확장 시험에서 groupScan 기대/paused 실제 RED1fail → 해제 정리 전달 후 GREEN. 기본 입력은 막지 않는다.
- pending에서 시작한 정지 누름 중 응답이 먼저 도착하면 정지 유실: 단위 RED1fail/13pass → down 시점 stop 의도 latch 후14pass. 실제 UI에서도 응답 완료 후 release가 연습 전체를 종료한다. 이미 완료한 응답의 효과까지 취소했다고 표시하지 않는다.

## 실제 검사

| 검사 | 결과 |
|---|---|
| protocol/handoff 최초 TDD | protocol39fail/5pass→45pass; handoff6fail/5pass→11pass, setter/stop2fail→13pass |
| 최종 전체 단위 | 26파일223/223pass, exit0 |
| type/lint | 자동 화면 검토 시작 시 둘 다exit0 |
| 관련 기존 file-practice | 7/7pass(새UI 포함14건 실행의 부분집합), 제품 소스 불변 |
| 최종 새 handoff production E2E | 8/8pass54.7초, exit0 |
| 기본 자동 화면 검토 첫 실행 | run-8YG5bH:99pass/2fail,3.4분,exit1. hints 초기 표시 빈값 실패. 별도 production build가 겹쳤으므로 성공으로 계산하지 않음 |
| 기본 자동 화면 검토 최종 | run-bvUsDo:101/101pass,0fail/skip/flaky,3.3분,exit0. 다른 빌드 없이 실행. 첫 실패의 원인은 빌드 겹침으로 의심되나 독립적인 원인 증명은 아님 |
| 전체 후속 CI73 | 최종035ce70/run36895970686 **success**. Node22.23.3, type/lint/build pass, unit223/223·E2E321/321,20.9분. 2026-10-02 02:21:50 KST 완료 |

360/768/1280px DOM에서 패널 화면 안, 선택56px 이상·글자18px 이상, 역할/시제품 제목·상태·취소 첫 항목을 확인했다. [360px](handoff-practice-360.png) · [768px](handoff-practice-768.png) · [1280px](handoff-practice-1280.png). 스크린샷은 보조 근거다.

실제 OS 창 소유권·다른 프로세스 입력·Windows 한국어 IME·운동 사용성·실제 업무 사이트는 미검증이다. 페이지 포커스 밖 전역 정지를 보장하지 않는다. PR13/14 복사/병합·PR15ZIP교체·배포는 없다. PR16 baafce2 CI는 부모가 관찰하며 여기서 조회/재실행하지 않는다.

다음 기존 요구: INPT-01 최근값 카드 전체, INPT-02 문구 수정/관리, INPT-03 입력칸 전체를 큰 양식으로 모으기(제출 없이 복귀), PRIV-01 전체 민감판별은 미완료다. 다음 bounded 작업은 기존 local 문구 목록의 명시적 수정/삭제·취소/확인·저장소 충돌 거절이다. 최근값 자동 수집·전체 양식·자동 제출·외부 전송을 이 작업에 포함하지 않는다.

최종 type/lint exit0. production manifest와 PR15 전달 ZIP의 permissions/host_permissions/content_scripts 비교는 모두 동일이다. 의존성·공통 엔진·공통 패널 소스는 base 대비 변경0. 검증은 실제 Playwright 확장 환경과 DOM 실측으로 수행했으며 native gstack가 이 확장을 조작했다고 표시하지 않는다.

실제 draft PR17: https://github.com/rrangjaa-eng/project_260923/pull/17 . 기준PR16/baafce2, 원격head codex-phase2-fake-handoff. 후속 PR번호 기록 커밋은 문서만 변경한다. 전체CI결과는 후속 상태 브랜치에 기록해 같은 소스의 전체 실행을 반복하지 않는다.

CI73 실제 job110483412445의 전체로그/상태를 확인했다. 이 결과는 후속 문구 관리 브랜치에서 기록하므로 이미 통과한 PR17 HEAD를 문서 변경으로 재실행하지 않는다. PR16 CI는 조회하지 않았다.
