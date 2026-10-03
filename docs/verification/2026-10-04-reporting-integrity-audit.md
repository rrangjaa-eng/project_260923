# 보고 원칙과 기술 기록 대조

## 범위와 판단 기준

2026-10-04 KST에 현재 checkout, Git 이력, 저장된 검증 문서, GitHub PR21·30·31–37과 선택한 CI 원본을 대조했다. 현재 작업에서 직접 실행한 명령과 보존된 과거 기록을 구분한다. 전체 과거 대화, 당시 호스팅 런타임의 적용 모델, 실제 PC·사용자 시험은 이번 조사에서 확인할 수 없다. 따라서 과거 모든 보고의 진위를 판정하거나 의도적 거짓 여부를 추정하지 않는다. 공개 기술 근거만 기록하며 사용자 대화 원문·개인정보·비공개 작업기록은 포함하지 않는다.

저장소 Codex 지침은 루트 `AGENTS.md`다. 파일 첫 문단은 `CLAUDE.md`의 Codex 적용판이며 명시적 조정이 우선한다고 규정하고, `.codex/config.toml`도 승인 범위 등의 근거로 AGENTS를 참조한다. 최우선 보고 원칙을 AGENTS 앞부분에 추가한다. 적용 범위는 해당 파일을 읽는 checkout이며 main·다른 checkout·다른 도구·호스팅 런타임까지 자동 반영됐다는 뜻이 아니다. `CLAUDE.md` 원본은 변경하지 않는다.

## 확인된 항목

| 보고·표시 | 실제 근거 | 불일치와 이어진 작업 | 영향·정정 |
|---|---|---|---|
| AGENTS가 PR15 브랜치와 당시 승인을 “현재”로 표시 | 조사 시작 HEAD `75adca0531eb84cb9100e59a54efda4e3bc5ea33`, 제품 PR37 `7eeda02f547fbd50db6310a455686bb0b5ce76e4`; 원격 PR31–37 모두 draft·미병합 | 이후 증분 작업 동안 오래된 지침 잔존 | 잘못된 재개 기준이 될 수 있다. 현재 작업은 실제 Git/최신 기록을 대조했으므로 옛 main/PR15로 구현했다는 증거는 없다. 고정된 현재 승인·브랜치 문구를 최신 요청/WORK-STATUS/원격 상태 대조 원칙으로 정정 |
| PR21 본문 상단 CI86 success, 하단 동일 CI86 실행 중 | [CI86](https://github.com/rrangjaa-eng/project_260923/actions/runs/36963423003) job110701938269 completed/success, 원본 unit272/브라우저343; 조사 시 원격 본문 양쪽 문구 확인 | 후속 작업 중 모순된 상태 표시가 남음. 그 표시가 특정 의사결정의 원인이었는지는 확인 불가 | 실제 CI 성공 자체는 근거 있음. 본문 정리 필요. 이번 감사에서 원격 본문은 수정하지 않음 |
| CI79 첫 안내 수정과 국소 복구6/6 통과 | [CI79 기록](2026-10-02-ci79-notice.md), [CI81 후속](2026-10-02-ci81-notice.md), Git `5cb98de`→`db53a59` | 보존 안내 복원 때 변경 이유를 제거한 불충분한 수정 뒤 후속 개발 진행. CI81·82·84에서도 안내 회귀 확인 | 검증 범위 부족과 회귀 전파. 해당 실패에서 값·초안 손실이 확인됐다는 근거는 없음. 세 안내 동시 검증·수정 후 CI86–88 성공. 첫 수정 문서에 당시 기록/후속 정정 표지 추가 |
| PR34 적용 되돌리기 문서가 전체 CI 진행/대기로 끝남 | [별도 증거 dd485e6](https://github.com/rrangjaa-eng/project_260923/blob/dd485e6ff0fc4c7efc3f458f05fdde4d2888e827/docs/verification/ci104-final-results.json), 원격 [CI104](https://github.com/rrangjaa-eng/project_260923/actions/runs/37106687759) success, unit441/브라우저420 | 최종 증거가 별도 문서 브랜치에 있고 후속 작업 checkout의 개별 문서는 예전 체크포인트 유지 | 성공 증거는 존재한다. 진행 중 오해/검색 누락을 막도록 해당 문서에 최종 immutable 링크 추가 |
| 일부 결과 JSON의 model/reasoning 라벨 | `form-controls-results.json`, `scroll-regions-results.json`; 다른 문서는 model_requested 구분 | 실제 세션 적용값의 실측 여부가 필드명만으로 불분명 | 실제 적용 모델은 이번 조사로 알 수 없다. 과거 라벨을 보존하면서 실측 증거로 해석하지 않는다는 주석 추가. 향후 요청/확인 적용값 구분 |

CI79·81·82·84의 failure와 CI86·87·88의 success를 GitHub에서 재조회했다. CI86은 원본 job 로그의272/343도 재대조했다. 과거 실패를 성공으로 바꿔 썼다는 증거는 이 대조 범위에서 발견하지 못했다. 이는 위 상태 불일치나 불충분한 수정·후속 진행을 부인하는 말이 아니며, 전체 과거 보고에 대한 무오류 보장도 아니다.

## 현재 PR37 실행·검증 대조

환경은 실제 `pwd`, `git status`, 검사 명령과 GitHub 조회가 실행되는 상태다. 제품 수정 전 기준은 PR36 `26bd9912fb21041ec8fa3ecefd9fbbf570a8fa37`이며, 증거 포함 checkout `42681235b445a5a6c335f99c8590668f64d1b0e6`에서 SAFE-04를 분기했다. 수정 후 제품은 `7eeda02f547fbd50db6310a455686bb0b5ce76e4`이다. 이번 지침·감사는 제품 소스를 바꾸지 않는다.

- 로컬: type/lint, unit505/505(49파일), 새 기능8건 포함 Chromium 회귀42/42, 자동UI101/101. 실패/flaky/skip0. 당시 실제 로그와 구조화된 결과를 대조했다.
- [PR37](https://github.com/rrangjaa-eng/project_260923/pull/37)은 draft·미병합. [CI109](https://github.com/rrangjaa-eng/project_260923/actions/runs/37127421940)은 2026-10-04 00:03:59 KST completed/success, unit505/505·Chromium453/453. [원본 로그·SHA 근거](https://github.com/rrangjaa-eng/project_260923/blob/8631236568b5f2aab77c7dc32bea6bd78857a9d5/docs/verification/ci109-final-results.json).
- 위 자동 검사 통과는 제품 전체 무결함, 과거 모든 리뷰 해결, 실제 PC·IME·운동 사용성·실사이트 검증을 뜻하지 않는다.
- main `9394b0146f9ba169f57e47ce3274bdff57b74dfe`, PR31–36 HEAD와 배포 ZIP SHA256 `bf84ada9a8b1f211b6d43318c02da1fd53b4482aafa41f648b4c9aef1eec2bdb` 보존을 확인했다. 새 merge/deploy/ZIP 교체 없음.

## PR30 병합 후 리뷰 — 현재 코드 재현 확인

[초안 정리 P2 리뷰](https://github.com/rrangjaa-eng/project_260923/pull/30#discussion_r4170786719)는 2026-10-03 08:58:14 KST 작성됐다. PR30 병합 시각은08:52:36 KST로 리뷰는 병합5분38초 후다. 따라서 이 리뷰를 병합 전에 알고도 무시했다고 단정할 수 없다. 작성 뒤 언제 확인했는지는 현재 기록만으로 알 수 없다.

현재 코드의 `FormDrafts`는 set/get/hasUnapplied만 제공하며 `form-refresh`는 현재 필드 목록을 바꾼다. 실제 controller 임시 검사에서 제거/식별 변경 × 새로고침/닫기 4RED와 깨끗한 제거 대조2GREEN(총6건, exit1)을 확인했다. 네 실패 모두 화면 초안 길이0, 현재 접근 가능한 다음 칸의 명시 적용 뒤에도 itemScan과 미적용 안내를 유지하고 navigation 요청0이었다. 깨끗한 대조는 confirming에 진입했다. 원래 문서의 “문장 버리기로 만든 빈 초안과 원래 값 차이” 제한과 동일 문제로 간주하지 않는다. 제품 수정은 이번 감사 이후 결정하며 이번 문서 변경에 포함하지 않는다.


재현은 현재 `7eeda02`와 동일한 제품 코드 및 happy-dom controller 환경에서 수행했다. 실제 Chromium·실제 사이트의 추가 재현은 이번 감사에서 하지 않았다. 임시 검사 파일은 삭제했고 제품/정식 테스트 파일을 변경하지 않았다. [관측값](reporting-integrity-observations.json). 기존 CI109의453/453은 이 새 부정 시나리오를 포함하지 않으므로 미해결 문제와 모순되지 않는다.

확인된 영향은 사이트가 필드를 제거하거나 의미를 바꾼 뒤 접근 불가능한 초안이 남아 작업판의 새로고침·탭 닫기를 차단하는 것이다. 기존 브라우저 네이티브 조작 전체가 막힌다는 뜻은 아니다. PR30 병합 후 PR31–37 작업이 진행되는 동안 이 코드 경계가 남아 있었다. 당시 리뷰 인지·의도적 무시 여부는 확인할 수 없다. “최종 읽기 재검토 추가P1/P2 없음”은 해당 검토에서 발견한 결과로 한정해야 하며 모든 후속 리뷰가 해결됐다는 뜻으로 확대하면 부정확하다. 이 미해결 P2를 현재 현황에 명시하고 수정은 별도 결정으로 남긴다.

## 문서 변경 검증과 미결정 사항

지침·당시 기록 표지·최종 증거 링크·모델 실측 한계·감사 결과만 변경한다. 제품, 정식 테스트, 의존성, 권한, CI 워크플로는 변경하지 않는다. JSON 파싱과 diff 검사를 수행한다. 문서 저장/원격 PR 작성과 제품 CI 성공은 각각 실제 결과로 구분한다. PR21 원격 본문 정리와 PR30 제품 수정은 수행하지 않았다. main 병합은 승인되지 않았으며 새 기능 착수는 중지 상태다.


재현 순서: 양식 첫 칸에 띄어쓰기로 미적용 초안 작성 → 목록 복귀 → 첫 필드 제거 또는 라벨/보고 identity 변경 → 연결된 필드만 collector에 보고 → 양식 목록 새로 읽기 → 남은 다음 칸 명시 적용 → 원래 화면 복귀 → 새로고침/탭 닫기. 원인 위치는 `src/core/form-navigation.ts`의 FormDrafts, `switch-controller.ts`의 form-refresh와 unapplied 검사다. 임시 검사 코드는 보존하지 않았으므로 공개 근거는 이 절차·현재 소스·관측 JSON이며, 원본 임시 로그는 실행 환경에만 남아 있다.


저장 확인 — 2026-10-04 00:14 KST: [draft PR38](https://github.com/rrangjaa-eng/project_260923/pull/38), 브랜치 `codex-reporting-integrity-audit`, 지침·감사 commit `89a3d35b55e9b8723bda0089d686715cd28efa17` 일반 push 완료. 타입·린트·JSON4개 파싱·diff 검사 통과. AGENTS SHA256은 변경 전 `36edcd2da9afec7a1de1abd17dccc409b40ad90152308792407cf3878e719d66`, 변경 후 `52bbc323e3198fccf103a31200a13a980fc03c613a036ff286fe48dd76a0676c`. `CLAUDE.md` SHA256 `49c43c1854536e266a8d81d96b296d3eca1d37e6ba203fa914eb0f8082768d05` 불변. 이 후속 저장 메모는 문서만 바꾸며 PR38 자체 CI 완료를 뜻하지 않는다.
