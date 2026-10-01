# 기존 프로젝트 문서와 단일 스위치 구현 연결

갱신: 2026-10-01 17:31 KST · [draft PR #15](https://github.com/rrangjaa-eng/project_260923/pull/15)

## 기준 문서와 보존 관계

사용자의 최신 승인에 따라 8단계 구현을 계속한다. 이번 1차는 기존 로드맵 Phase 1과 같은 번호가 아니다. 새 계획을 다시 생성하거나 기존 완료 기록을 삭제하지 않는다.

| 문서 | 역할과 현재 관계 |
|---|---|
| `AGENTS.md`, `.codex/config.toml` | 한국어/KST·모델 기준·기존 클라우드/Git 작업 규칙. Git 추적되며 현재 PR에 포함. 파일만으로 실행 세션 모델 자동 변경을 주장하지 않음 |
| `.planning/PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md` | 기존 제품 전체 범위·78개 요구·6개 Phase의 원본. 이번 PR로 기존 Phase를 완료했다고 표시하지 않음 |
| `.planning/STATE.md`, `state.json` | 기존 GSD 상태. 공식 GSD 상태 명령으로 새 승인·진행·재개 문서 참조만 기록. 페이즈 완료/requirements-complete 호출 없음 |
| `.planning/HANDOFF.json`, Phase1의 SUMMARY/VERIFICATION/UAT/REVIEW | 과거 작업·당시 검증·남은 사람 시험의 증거. 최신 구현 검증으로 덮어쓰지 않음 |
| `260928 gpt.md` | 범용 웹 활동 우선과 후속 C# 휴대형 실행기의 결정 보존. 확장만으로 가능한 활동을 먼저 검증하며 실행기는 2차 이후 |
| [원 설계](../specs/2026-09-23-tremor-browser-helper-design.md) | 전체 제품의 기존 결정·보안 제한·마우스 방식 계약. 현재 단일 스위치 요구는 아래 승인 설계로 확장 |
| [승인된 1차 설계](../specs/2026-10-01-single-switch-phase1-design.md), [승인된 8단계 계획](2026-10-01-single-switch-phase1.md) | 현재 기능·실행 순서의 기준. 설계·계획·직접 실행 방식 모두 사용자 승인 전달됨 |
| [별도 설계 체크포인트](../specs/2026-10-01-single-switch-phase1-review-checkpoint.md) | 최신 승인 맥락을 놓쳤던 문서 체크포인트 이력. 설계만/승인 대기 문구는 최신 승인으로 대체됨. 당시 실제 검증 범위만 보존 |
| `docs/design/SYSTEM.md`, `tokens.css`, `DECISIONS.md` | 시각 기준 유지. 새 작업판의 지속 배경·가림 범위와 키 안내에 대한 정합성 검토는 남음 |
| [현황표](../../WORK-STATUS.md) | 현재 구현·검사·PR·다음 단계의 사용자 보고. GSD 원본 상태를 대체하지 않음 |

## 기존 6개 Phase에 대한 위치

GSD 실제 조회: Phase 1의 19개 PLAN과 19개 SUMMARY가 있으나 `disk_status=partial`, `roadmap_complete=false`, 전체 완료 Phase=0이다. 기존 `01-VERIFICATION.md`는 `human_needed`, 101/103이고, `WINDOWS.md`의 열린 결함 3건도 보존한다. 조회의 `progress_percent=100`은 존재하는 계획 요약 개수 기준이지 제품 전체·사용자 시험 완료가 아니다. STATE 본문과 frontmatter의 오래된 진행 표시 차이는 완료 근거로 사용하지 않는다.

Phase 2(TEST/DIST)의 PC 이용자 시험과 배포는 미실행이다. 이번은 사용자가 범용 웹 활동과 단일 스위치 조작을 우선하기로 승인한 Phase 1 기반 보강 + Phase 3 일부 기능의 선행 개발이다. 이 순서 변경이 과거 Phase 2 합격을 뜻하지 않는다. Phase 4 틀·활동 기록, Phase 5 뒤쪽 실행/작업판 전체, Phase 6 AI는 미구현 상태를 유지한다.

## 승인된 8단계와 기존 요구 매핑

| 현재 단계 | 기존 항목/자산 | 실제 상태와 남은 계약 |
|---|---|---|
| 1 입력/조합 경계 | Phase1 KEY-02/FILT, 입력 pipeline/mode, 01-19 편집기 보호 | 늦은 비활성 프레임 보고 RED→수정. 관련52 pass 이력. 원 간헐 실패 근본 원인 미확정, 실제 PC IME 미검증 |
| 2 공통 엔진 | FILT-01/02, CLICK-01, KEY-01/02 | Space down 대상 고정/up 1회·반복/합성/조합 보호, 초기 실제 링크 실행 통과. 기존 모든 실행 진입점 통합 계약 검사 남음 |
| 3 프레임·실행 | ELEM-02, CLICK/SAFE 경계, 기존 relay/collector/fingerprint | 송신자·문서 세대·actionId·활성/의미/목적지 재검증. 경합·worker 재시작·옛 응답의 후속 실행 검사 확대 필요 |
| 4 순환 작업판 | Phase3 NAV-02/05/PERS-01 일부, Phase5 BORD와 목적 일부 공유 | 고정 그룹·6개 묶음·속도/보호 설정·삭제 대상 순서 유지 통과. 기존 번호 고정·컨디션 전체·BORD 전체 완료 아님. DOM/디자인 감사 남음 |
| 5 한글·편집 | Phase3 INPT-01/02/03, NAV-04, PRIV-01 일부 | 새 한글·중간 삭제/재조합·공백·문구 저장/삽입·input 적용·외부 값 충돌·조합 쉬기 통과. 최근값 카드·양식 전체·문구 관리 전체·민감 판별 전체 미완료 |
| 6 검색·읽기 | Phase3 NAV-01/02/03 일부 | GET form 실제 검색·결과 선택·본문/자동 스크롤 정지·뒤로·열린 지원 탭 Space 여정 통과. 다중 스크롤 영역·앞으로/새탭/닫기/복구 전체 미구현 |
| 7 확인·복구 | SAFE-02/03/04/05, 제출 재시도 금지 원칙 | 1초 보호·새 release 1회, 무입력/모드 변경 확인 취소·쉬기·초안 보존 통과. 늦은 응답·재연결·프레임 이동·민감 데이터 검사 확대 필요 |
| 8 최종 검증 | Phase1 검증/Phase2 TEST-01/02/03, DIST는 별도 | unit130·신규 통합8·영향E2E84·type/lint/build pass. 전체CI/독립리뷰/QA/cso/DOM·PC 시험 미완료. 배포 없음 |

위는 연결 관계이며 기존 REQUIREMENTS의 unchecked 항목을 포괄 완료로 바꾸지 않는다. 단일 스위치 새 한글 작성은 기존 최근 값 카드보다 확장된 기능이고, 이번 검색 여정은 Phase3 전체 대체가 아니다.

## 충돌·대체 계약

- `SAFE-02/03`, 원 설계, PROJECT/HANDOFF의 Enter·Esc·스페이스 1초 확인은 **마우스 보조 모드**의 기존 계약으로 보존한다. 단일 스위치 모드는 보호 후 순환 선택·새 down/up로 확인하고 취소도 순환한다.
- `KEY/NAV/INPT`의 숫자·0·화살표·Alt+숫자는 기존 방식으로 유지하지만 단일 스위치의 필수 입력에서 제외한다. 그룹→항목 순환과 작업판의 공백/편집 명령이 대체한다.
- 과거 `어느 사이트에서든` 목표는 지원의 지향점이다. 1차 합격은 로컬 연습 사이트의 기본 활동이며 모든 실서비스·브라우저 밖 동작을 보장하지 않는다. 회사 시스템 실제 시험 금지는 유지한다.
- 휴대형 실행기·canvas/OS/파일 창·전역 정지는 후속 범위다. 원 인계의 기술 결정(C#·휴대형·권한/USB 저장)은 보존하고 지금 복사·실행하지 않는다.
- 초안과 새 문구는 각각 session/local이며 자동 동기화하지 않는다. 과거 STOR 설정 동기화의 전체 요구 완료로 표시하지 않는다.
- 기존 01-VERIFICATION/HANDOFF의 과거 전체 pass와 현재 클라우드 검증은 날짜·범위를 나눠 기록한다. 과거 결과를 새 코드 검증으로 재사용하지 않는다.

## 실제 완료·미완료·재개

제품 체크포인트 `7e8b9f3`(전체 여정), `a22791e`(실행 안전·복구). 검사 명령과 로그는 현황표에 연결한다. 현재 단계 1~7의 **주요 흐름 통과**이며 모든 단계 계약/최종 완료 주장이 아니다.

후속 안전 검사는 실제 `tests/e2e/switch-pending.e2e.ts`로 활성화했다. 늦은 apply 응답·실행 전달 전 pause·unknown·프레임 교체·연결 단절과 끄기/제출 설정/부모 프레임 가시성/DOM 묶음 23건 통과. 기존 `.pending` 초안은 과거 작성 기록이며 현재 검증의 원본이 아니다. 조합 중 삭제·마지막 승인 응답 지연·서로 다른 pendingAction ID·부분 가림의 추가 RED→관련15+단독1 GREEN, 독립 지적 재검토에서 새 P1/P2 없음. 다음은 전체 UI/E2E와 최종 CI 종료 확인이다. 전체 단계 완료나 PC 통과를 주장하지 않는다.

이 PR에서는 공식 GSD CLI의 진행/로드맵 조회와 상태 결정·세션 기록만 수행한다. GSD planner/checker/execute-phase/verify-work/complete-phase를 새로 수행했다고 주장하지 않는다. 기존 `.planning`은 이 상태 도구를 통해서만 변경하며 오래된 PLAN/SUMMARY/HANDOFF/검증 보고는 삭제·재작성하지 않는다.
