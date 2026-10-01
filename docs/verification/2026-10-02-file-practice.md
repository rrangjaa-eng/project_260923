# 파일 선택 연습: 수정·검증 기록

2026-10-02 00:56 KST · 기준PR15/20440e6 · codex/phase2-file-practice. 실제 OS/파일 연결·권한·외부전송은 없다. 고정 가짜provider와 독립 확장 file-practice.html만 구현했다. 기존 Space 엔진·패널·디자인 토큰을 재사용한다.

## 실제 재현과 수정

- 보류 f21a215의 actual worker stop 회귀를 최신제품에 복원: 1/1pass22초. 제품을 다시 구현하지 않았다.
- 조정기 최초 RED5fail/7pass→12pass. 요청없는 확인·1초내 확인·임의토큰·문서/모드/세션/요청세대변경·만료·취소/쉬기/정지·늦은응답을 검사한다.
- 응답없는 provider deadline: RED1fail/12pass(executing 잔류)→13pass. 3초 뒤unknown·재시도0·late성공상태변경0.
- 독립리뷰 P2: done/lost/전송중 요청에서 pause반복→resume→선택으로 같은 요청재실행. RED3fail/13pass→16pass. dispatched latch, awaitingReply 경계, 새request ID의 명시begin만 허용.
- 독립리뷰 P2: 실제Space down→inputfocus→keyup 뒤confirming 잔류. UIRED1fail→GREEN1pass16.3초. focusin 및 입력/조합/수정키 전환에서 rest가 pressed와 승인 모두 폐기. orphanup실행0·재개입력선택0·새명시선택후완료1.
- 좁은화면: global제목이 overlay뒤에 놓일수있어 panel h2에 지속 시제품표시 assertion을 추가. RED1fail→3viewportGREEN. 제목에는 실제 파일/OS 입력 없음, confirmation preview에도 실제전송없음을 표시.

## 검사와 근거

| 검사 | 결과 |
|---|---|
| `pnpm test:unit` | 24파일164/164pass,exit0 |
| `pnpm typecheck`, `pnpm lint` | 최종exit0 |
| production E2E `file-practice.e2e.ts` | 관련5pass + 초점회귀최종별도1pass. 선택·취소·쉬기·확인·종료·일반키·360/768/1280·hold 포함 |
| `ui-review` 기존40492/run-bTzDDs | 101/101pass,fail/skip/flaky0,3.4분,exit0. P2수정전의 기존화면영향실행이며 새화면6건을 대신하지 않음 |
| production build | E2E setup에서exit0 |
| 이전ZIP manifest 비교 | permissions/host_permissions/content_scripts 그대로 |
| 전체CI | 새draftPR의 최종HEAD에서 확인예정; 미확정 |

로그: /tmp/phase2-review-{latch-red,latch-green,focus-red,focus-green,ui-green}.log, /tmp/phase2-scope-label-red.log, /tmp/phase2-final-{type,lint,all-unit}.log. 원본UI101 결과는 /workspace/.cloud-onboarding/ui-review-runs/run-bTzDDs/results.json. 지속근거는 Git의 회귀/설계/이문서와 화면3장이다.

[360px](file-practice-360.png) · [768px](file-practice-768.png) · [1280px](file-practice-1280.png). DOM 검사에서각56px 이상·글자18px 이상·화면경계내·취소먼저·상태가시성을 확인했다. screenshot은 보조자료다. 실제Windows IME·손사용감·파일창·파일선택/업로드·두산사이트·모든앱 전역정지는 미검증/미구현이다.

## 다음 경계

cloud에서 독립 실행상태/문서·모드·세션변경의 negative protocol vectors는 현재승인범위다. 실제 파일의브라우저전달은 즉시업로드될수있으므로 파일대화상자/요청창소유권·확인후재검증·nativeMessaging 권한/host등록을 별도 승인/Windows검증해야 한다. 현재 연습은 이를 완료했다고 표시하지 않는다. PR13/14코드를복사·실행하지 않았다. 기존PR15와ZIP을교체하지 않았고merge/deploy/release없다.

새 draft PR16을 실제 생성했다: https://github.com/rrangjaa-eng/project_260923/pull/16 . base=codex-single-switch-phase1/20440e6, head=codex-phase2-file-practice, open/draft/미병합. 제품 수정 커밋d9160f1, 후속 PR번호 기록은 문서만 변경한다. 검증된PR15는 그대로다. 최종 전체CI결과는 별도 안전기록브랜치에 보존해 같은제품의 전체검사 반복을 피한다.

## 2026-10-02 01:12 KST: 만료 후 쉬기 복귀 경계

전체CI69가 실행되는 동안 expiry 경계를 추가 점검했다. page.clock으로 실제연습화면에서 쉬기뒤61초를 앞당긴 다음 같은파일을고르면 flow.select가거절되나 UI의 executing이남아 Space종료메뉴로 돌아오지 못하는 RED1fail을 확인했다. 실패한선택도 적용0·새시작ready로돌아오도록 최소수정했다. 새시작Space는 재개만 하고 종료까지Space만으로가능한 실제회귀를 포함해 **최종관련UI7/7pass,1.4분,exit0**다. 최종type/lint도exit0. 이실제제품수정때문에 기존CI69를최종통과로사용하지 않고 새HEAD 전체CI를확인한다. 환경/권한변경이나 같은소스의 중복전체실행이아니다.
