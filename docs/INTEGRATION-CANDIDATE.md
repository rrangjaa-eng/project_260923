# PR15–25 통합 후보

**2026-10-02 후속:** 사용자 승인으로 PR26을 main/`a0738fb832bd04abdb5397c09bbef3f38279e86c`에 병합했다. [병합 증거](verification/pr26-merge-results.json)와 최신 작업 현황을 따른다. 아래 후보 준비·승인 대기 표기는 당시 이력이다. 배포와 ZIP 교체는 하지 않았다.

갱신: 2026-10-02 15:26 KST. 후보 브랜치: `codex-single-switch-integration`. main 대상 draft 검토용이며 merge·deploy·ZIP 교체는 하지 않았다.

## 통합 방식과 출처

확인한 main은 `64976a778d13ac884fbce8b4027be433d8d0c4fe`, 제품 기준은 PR25 `6592a1a54473eb2a0a2ae815634f03aef0adc69a`이다. merge-base가 main과 같고 main 전용 커밋0/제품 전용52다. 따라서 PR25에서 새 브랜치를 직접 만들었다. 불필요한 merge/rebase/squash 없이 제품 이력과 기존 PR을 보존한다. PR25 CI91 결과 기록 `0ea52f6`만 문서 cherry-pick했고 이 후보에서 제품·테스트·빌드·권한 코드는 바꾸지 않는다.

[PR별 원격 SHA·조상·패치 비교 증거](verification/integration-ancestry.json). PR15–20 및23–25 최종 HEAD는 제품 기준의 조상이다. PR21·22 최신 HEAD 전체가 조상인 것은 아니다. 다음 런타임/테스트 수정은 동일 stable patch-id로 후속에 반영됐다. 문서 문맥이 다른 커밋 전체가 동일하다고 주장하지 않는다.

| 선행 수정 | 포함된 수정 | 내용 |
|---|---|---|
| PR21 5cb98de | 4fd1d5b | 초안 보존 안내 |
| PR21 db53a59 / PR22 2625172 | 3474347 | 변경 이유·보존·비교 안내 동시 복원 |
| PR21 b3f8caa / PR22 50082f4 | 36f3a9c | CSS 표시 준비 대기 후 기존 엄격한 단언 |

PR8–14의 HEAD는 포함되지 않았고 해당 브랜치 전용 런타임 패치와 동일한 패치도 없다. PR13 D-25와 후보의 안전 종료는 같은 문제 영역의 별도 구현이다. PR13의 schema marker/손상 설정 켜기 정책은 가져오지 않았다. 후보는 독립 helperSafetyOff 값과 손상 설정의 켜기 거절 정책이다. settings-schema와 기존 storage-writer 단위 파일은 main 그대로다.

PR14의 portable-hand C#/네이티브 호스트, worker bridge, 보호 USB 저장소는 없다. wxt.config.ts/package.json/pnpm-lock.yaml은 main과 동일하며 새 권한·의존성이 없다. 기존 민감 필드 차단, 사용자가 작성한 문구의 로컬 저장, 세션 초안은 제품 범위에 포함된다. 가짜 파일 연습은 실제 파일·네이티브 전달 구현이 아니다. `.planning/STATE.md`와 `260928 gpt.md`의 차이는 상속한 PR15 기록이며 이번에 편집하지 않는다. 과거 로드맵의 존재는 구현 완료 증거가 아니다.

## 지원 범위와 남은 검증

- 일반 최상위 웹 문서에서 Space 그룹/항목 스캔, 한글 조합·문구 관리·검색, 읽기, 양식 필드 이동·초안·적용·재적용 확인을 제공한다.
- native 단일 select와 checkbox를 지원한다. 모든 custom 위젯·복합 입력·사이트별 오류 의미를 해석한다고 보장하지 않는다.
- 페이지 전체 또는 보이는 일반 세로 overflow 영역을 선택한다. iframe, Shadow DOM 내부, 가로·canvas/custom 스크롤, 양식 편집기 내부는 영역 선택 범위 밖이다.
- 실행 대기 및 자동 스크롤 중 새 Space는 정지에 사용한다. 늦은 응답으로 재개하지 않으며 이미 브라우저에 실행된 효과를 되돌리지는 않는다.
- 주소창·브라우저 메뉴·확장 설치·OS/다른 앱은 전역 Space 제어 범위 밖이다.
- 최근값 자동 수집(INPT-01)과 민감정보 판별 전체(PRIV-01)는 미완료이며 기존 민감 필드 차단만으로 완료를 주장하지 않는다.
- 실제 PC Windows 한국어 IME·운동 사용성·실사이트는 별도 미검증이다. 기존 open Shadow DOM 관련 F1/F2 보류 항목도 전체 보안 승인으로 간주하지 않는다.

## 검증과 승인 경계

제품 기준 PR25의 [CI91](https://github.com/rrangjaa-eng/project_260923/actions/runs/36969554948)은 unit313/313, 전체 E2E358/358 성공이다. 이는 선행 제품 증거이며 통합 후보의 새 CI 성공을 대신하지 않는다. 통합 후보에서 type/lint/unit/build와 설치·종료 회귀를 새로 실행하고, main 대상 draft PR 최종 HEAD의 CI에서 전체 E2E를 다시 확인한다. 결과는 작업 현황과 별도 검증 기록에 남긴다. 실패·미완료 결과를 성공으로 합산하지 않는다.

**최종 확인:** [draft PR26](https://github.com/rrangjaa-eng/project_260923/pull/26)의 `a453089c77a5130931cbd37fd948fb251cd33afa`에서 [CI92](https://github.com/rrangjaa-eng/project_260923/actions/runs/36973766821) workflow/job이 success로 종료했다. unit313/313·전체E2E358/358(36.3분), CI production build 및 type/lint를 원본 로그와 단계 결과로 확인했다. 로컬 type/lint/build/unit313 및 설치·끄기3/3도 통과했다. [최종 증거](verification/ci92-final-results.json). 이 기록은 제품 HEAD를 바꾸지 않는 `codex-pr26-verification-record` 문서 브랜치에 저장한다.

병합 판단 전 확인할 것은 새 후보 전체 CI, 지원 경계 검토와 사용자 merge 승인이다. 배포·설치본 교체에는 별도 승인과 패키지 검증이 필요하며 실제 PC/사용성/실사이트 시험은 이 자동 검증으로 대체하지 않는다. 기존 PR15–25와 PR8–14를 닫거나 retarget하지 않는다.

## 보존한 과거 설치 파일

`downloads/tremor-browser-helper-3ae6ad2.zip`은 제품 `3ae6ad29fd3e77e43cdb68c51d540035e1002b16`의 1,163,247바이트 과거 ZIP이다. SHA256은 `bf84ada9a8b1f211b6d43318c02da1fd53b4482aafa41f648b4c9aef1eec2bdb`다. PR16–25 기능은 미포함이다. 안내문만 과거 제품임을 명확히 하며 ZIP 바이트를 바꾸지 않는다. 이전 download-verification 기록의 README 해시는 당시 안내문 증거이고 현재 안내문의 해시는 downloads/SHA256SUMS를 따른다.
