---
phase: 01-click-helper-foundation
verified: 2026-09-26T11:45:00Z
status: human_needed
score: 101/103 must-haves verified
covered_files:
  - .planning/REQUIREMENTS.md
  - .planning/phases/01-click-helper-foundation/01-01-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-01-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-02-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-02-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-03-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-03-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-04-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-04-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-05-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-05-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-06-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-06-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-07-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-07-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-08-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-08-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-09-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-09-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-10-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-10-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-11-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-11-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-12-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-12-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-13-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-13-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-14-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-14-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-15-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-15-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-16-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-16-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-17-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-17-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-18-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-18-SUMMARY.md
  - .planning/phases/01-click-helper-foundation/01-19-PLAN.md
  - .planning/phases/01-click-helper-foundation/01-19-SUMMARY.md
  - package.json
  - playwright.config.ts
  - src/core/confirm-guard.ts
  - src/core/danger.ts
  - src/core/drag-two-press.ts
  - src/core/dwell-timer.ts
  - src/core/fingerprint.ts
  - src/core/frame-path.ts
  - src/core/frame-tree.ts
  - src/core/grid-index.ts
  - src/core/hint-order.ts
  - src/core/magnet.ts
  - src/core/settings-schema.ts
  - src/core/tremor-filter.ts
  - src/core/unsupported-url.ts
  - src/entrypoints/background.ts
  - src/entrypoints/content.ts
  - src/entrypoints/popup/index.html
  - src/entrypoints/popup/main.ts
  - src/page/click/drag.ts
  - src/page/click/press.ts
  - src/page/collector/collector.ts
  - src/page/input/mode.ts
  - src/page/input/pipeline.ts
  - src/page/overlay/confirm-dialog.ts
  - src/page/overlay/hints.ts
  - src/page/overlay/mode-indicator.ts
  - src/page/overlay/ring.ts
  - src/page/overlay/toast.ts
  - src/shared/messages.ts
  - src/types/chrome.d.ts
  - src/worker/relay.ts
  - src/worker/storage-writer.ts
  - wxt.config.ts
covered_digest: "v1:sha256:2067c96c477bc29edb82b3cd3ea7bb9a98d85670b8d3bc383ec49963bfdb5a0b"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "연습 페이지가 window.open('')으로 연 맨 위 about:blank 새 창에는 도우미가 들어가지 않는다(아이콘의 '도울 수 없음' 판정과 같다) (01-17 truth 9)"
    reason: "실행 중 사용자 결정으로 반대 방향이 됐다 — 주소 없는 새 창(결재 팝업 패턴)에는 도우미가 반드시 들어가야 한다. 01-17-SUMMARY key-decisions '[User decision, 실행 중]'에 기록됐고, 01-19 truth 1·2가 그 반대 동작(여는 쪽 출처를 사이트로 따름)을 must-have로 다시 정의했으며 blank-popup.e2e.ts 11개가 이를 증명한다. 불투명 출처 about: 창만 시작하지 않는 가드(content.ts:137)가 원래 truth의 안전 의도(도울 수 없음 판정과 일치)를 유지한다"
    accepted_by: "사용자(01-17 실행 중 결정, 01-17-SUMMARY.md key-decisions에 기록)"
    accepted_at: "2026-09-26T03:30:00Z"
re_verification:
  previous_status: gaps_found
  previous_score: 80/84
  gaps_closed:
    - "같은 출처·다른 출처·중첩 iframe 안의 요소에도 번호표가 붙고, 번호는 페이지 전체에서 한 번만 매겨져 중복이 없다 (01-07 truth 1; ELEM-02) — srcdoc·about:blank+document.write 프레임 포함"
    - "iframe 안 입력칸에 초점이 가면 맨 위 모드 표시가 '입력 중'이 된다 (01-07 truth 5; KEY-01) — srcdoc·about:blank·designMode·contenteditable 본문 편집기 포함"
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "설정이 깨졌거나 더 새 형식일 때도 '도우미 끄기'(전역)가 된다 (D-25 — 목표 '방해되면 즉시 끌 수 있다'의 한 경계 상태)"
    addressed_in: "Phase 1 머지 직후 /gsd-quick (사용자 결정 2026-09-26, STATE.md:146) — 로드맵의 뒤 페이즈가 아니라 사용자가 범위를 정한 알려진 후속 작업"
    evidence: "STATE.md:146 'D-25: 설정이 깨졌거나 더 새 형식이어도 도우미 끄기는 항상 된다 — 그 PC의 storage.local에만 꺼짐 표시를 쓰고 sync 원본은 건드리지 않는다. Phase 1 머지 직후 /gsd-quick으로 처리'. 현재 코드: storage-writer.ts:203-208 setEnabled가 readAndValidateSettings 실패 시 preserved-original로 거절(lifecycle.e2e.ts:159가 이 거절을 단언). 같은 상태에서 '이 사이트에서 끄기'는 된다 — writeSiteDisabledOnce(storage-writer.ts:151-173)는 settings를 읽지 않고 site:<origin> 키만 쓰고, content.ts:644 syncEnabled가 siteDisabled를 합친다(코드 읽기 근거, 이 조합 전용 e2e는 없음)"
human_verification:
  - test: "CR-01 — Windows + MS 한국어 입력기(크롬·엣지·웨일)에서 문서 전체 편집기(designMode·contenteditable 본문)에 글자를 쓰다가 Esc → F(번호표) → 한글 입력"
    expected: "모드 표시는 '도우미'에 머물고 문서 글자가 바뀌지 않는다. Esc를 다시 누르면 원래 캐럿 자리로 돌아가 입력이 이어진다"
    why_human: "CDP Input.imeSetComposition·insertText로는 초점 옮기기가 5/5 막는다(doc-editor.e2e.ts:280/288/296 통과). 하지만 실제 OS IME의 조합 시작 여부는 헤드리스 Chromium에서 재현할 수 없다"
  - test: "초점 옮기기의 blur 부작용 — 실제 사이트 편집기(CKEditor 4, SmartEditor 2)에서 본문에 쓰다가 Esc로 나오고, 다시 Esc 또는 본문을 눌러 돌아오기"
    expected: "편집기 도구 막대가 사라진 채 굳거나, 자동 저장·'수정됨' 표시가 오작동하거나, 내용이 바뀌는 일이 없다. 캐럿은 돌아온다"
    why_human: "contenteditable 본문에서는 초점 옮기기가 blur·focusout을 두 번 일으킨다(spike 실측). 실제 편집기가 여기에 어떻게 반응하는지는 연습 페이지로 흉내 낼 수 없고, 실제 사이트는 D-14에 따라 CI에서 불러오지 않는다"
  - test: "WR-02 — 나옴 상태(문서 전체 편집기에서 Esc)에서 오른쪽 클릭 메뉴의 '붙여넣기'와 '잘라내기'"
    expected: "문서가 바뀌지 않는다"
    why_human: "브라우저 기본 오른쪽 클릭 메뉴는 Playwright로 누를 수 없어 trusted paste/cut을 만들 수 없다. 코드(pipeline.ts:450-470의 paste/cut/drop/dragover window capture 차단)는 있지만 자동 시험 증거가 없다. drop 경로는 doc-editor.e2e.ts:502가 증명한다"
  - test: "WR-03(1회차) topDocOrigins 경쟁 — 실제 주소 탭이 about:blank로 이동하는 순간 옛 문서가 늦게 보낸 메시지가 새 about: 문서의 사이트 정체를 덮어쓰지 않는지"
    expected: "새 창·이동한 탭의 사이트 카드와 사이트 끄기가 항상 올바른 출처를 가리킨다"
    why_human: "가드(background.ts:256, sender.tab.url이 about:일 때만 기록)와 양성 시험(blank-popup.e2e.ts:519)은 있다. 하지만 이 경쟁은 결정적으로 재현할 수 없어 RED 시험이 없다(01-REVIEW.md IN-01, 01-REVIEW-FIX.md WR-03 'requires human verification')"
  - test: "이용자 PC 설치 — 이용자가 실제로 쓰는 Chrome/Edge/Whale 프로필에 빌드(압축 해제 또는 비공개 링크) 설치"
    expected: "일반 사이트에서 왼쪽 아래에 '도우미' 표시가 뜬다. 아이콘 메뉴에 번호 카드 1~4가 열린다. 아이콘에서 도우미를 끌 수 있다"
    why_human: "설치, 권한 안내, 실제 프로필 동작은 샌드박스 Playwright Chromium 밖이다"
  - test: "기본값 체감 — 연습 사이트에서 실제 손으로 작은 버튼에 대충 다가가기, 이웃한 두 요소 사이에서 떨기, 잡힌 요소 바로 옆 이웃을 직접 클릭하기"
    expected: "잡힌 요소가 떨림에 깜박이지 않는다. 24px 안의 정확한 이웃 클릭이 잡힌 요소로 가는 설계(히스테리시스)를 받아들일지, Phase 2에서 조정할지 이용자가 판단한다"
    why_human: "포착 여유 48px, 히스테리시스 24px, 떨림 300ms, 머무르기 800ms는 체감 값이다. Phase 2(TEST-02)에서 조정한다"
  - test: "두 번째 PC 동기화 — 같은 브라우저 계정으로 두 번째 PC에 로그인한 뒤, 첫 PC에서 도우미 전체 끄기와 한 사이트 끄기"
    expected: "보통 동기화 지연 안에 두 번째 PC가 두 설정을 모두 따른다(01-02·01-13 backstop truth, STOR-01)"
    why_human: "backstop truth다. 시험은 serviceWorker의 storage.sync.set으로 원격 쓰기를 흉내 낼 뿐이고, 실제 기기 간 chrome.storage.sync는 CI에서 돌릴 수 없다"
  - test: "판단 등급 금지 사항 11건 검토(01-09, 01-12, 01-16, 01-17×2, 01-18×4, 01-19×2) — 아래 본문 '금지 사항(prohibitions)' 표"
    expected: "모두 지켜진다. LLM 판정(권위 없음)은 11건 모두 '지켜짐'이고, 근거 시험을 표에 적었다"
    why_human: "unverified-prohibition — human review recommended. 판단 등급 금지 사항이고, 먼저 실패하는 부정 시험 게이트가 연결돼 있지 않다"
---

# Phase 1: 클릭 도우미 기반 — 재검증 보고서

**페이즈 목표:** 이용자가 어느 사이트에서든(iframe 본문 포함) 원하는 요소를 마우스를 대충 가져가거나 숫자 키 하나로 누를 수 있고, 떨림으로 인한 잘못 누름과 위험한 버튼 오조작이 막히며, 방해되면 즉시 끌 수 있다
**검증 시각:** 2026-09-26T11:45:00Z (HEAD `5794198`, 작업 트리 깨끗함)
**상태:** human_needed
**재검증:** 예. 1차(2026-09-24, gaps_found 80/84)의 빈 곳이 닫혔는지 확인했다.

## MVP 모드 메모

ROADMAP은 이 페이즈를 `**Mode:** mvp`로 표시한다. 하지만 목표가 사용자 이야기 형식이 아니다. 1차와 마찬가지로 Success Criteria 기준의 goal-backward 검증을 했다. 목표 문장을 사용자 이야기 형식으로 바꾸는 일은 개발자의 후속 작업으로 남는다.

## 사용자 흐름 (도출)

| 단계 | 기대 | 증거 | 상태 |
|------|------|------|------|
| 사이트 열기 | 왼쪽 아래 '도우미' 표시, 맨 위 프레임만 | helper-toggle.e2e.ts:6, dom-audit | ✓ |
| 대충 다가가기 | 48px 안 가장 가까운 요소를 잡고 두꺼운 테두리, 떨림에 안정 | magnet.e2e.ts | ✓ |
| 클릭·스페이스바 | 잡힌 요소가 눌리고 페이지는 스크롤되지 않음 | press.e2e.ts | ✓ |
| F + 숫자(iframe 포함) | 프레임을 넘어 번호가 겹치지 않고, 숫자로 누름 | frames.e2e.ts, **editor-frames.e2e.ts:121/266/465/489/500** | ✓ (1차의 srcdoc·about:blank 빈 곳이 닫힘) |
| 편집기 안 입력 | '입력 중' 표시, 글자 정상. Esc로 도우미 | editor-frames.e2e.ts:150/296/313/335, doc-editor.e2e.ts:58/64/70 | ✓ (실제 IME는 사람 확인) |
| 위험 버튼 | 끌려가지 않고, 머무르기 없음, 빨간 확인, 1초 보호, Enter만 | danger/confirm/dwell e2e, editor-frames.e2e.ts:280, dwell.e2e.ts:257 | ✓ |
| 끄기 | 아이콘에서 전체·이 사이트 끄기, 새 창에서도 됨 | helper-toggle, site-toggle, blank-popup.e2e.ts:413 | ✓ (깨진 설정에서의 전역 끄기는 D-25 후속) |
| 결과 | "어느 사이트에서든(iframe 본문 포함)" | 연습 사이트 + 편집기형 iframe + 주소 없는 새 창 | ✓ (실제 사이트 편집기 체감은 사람 확인) |

## 검증자가 직접 돌린 증거 (SUMMARY 인용 아님)

- `pnpm lint` exit 0, `pnpm typecheck` exit 0
- `CI=true pnpm test`를 **한 번** 실행(프로덕션 빌드 포함, exit 0): 단위 **101/101 passed**(13 files), e2e **234 passed (5.9m)**, 0 failed, flaky 표시 없음. 오케스트레이터가 준 수치와 같다
- overlay-perf(같은 실행): 정상 p95 **18.5ms**, 부하 p95 **24.4ms**. 둘 다 50ms 아래
- 빌드된 `.output/chrome-mv3/manifest.json`의 content_scripts: `"all_frames":true,"match_about_blank":true,"run_at":"document_start"`. `match_origin_as_fallback`은 없다(data:·blob:은 범위 밖, 01-17 결정)
- `gsd verify.artifacts`: 계획 19개 전체 **67/67 통과**(01-17 5/5, 01-18 8/8, 01-19 4/4, 01-01~16 50/50 회귀 없음)
- `gsd verify.key-links`: **49/49 연결됨**(01-17 3/3, 01-18 4/4, 01-19 3/3, 01-01~16 39/39)
- `grep -rnE "fetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|\.postMessage\(" src/` 결과 없음. `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` 결과 없음. `any` 결과 없음
- 최신 커밋의 GitHub CI는 이 검증에서 확인하지 않았다(로컬 `CI=true` 실행으로 대신함)

## 1차 gap 대조

| 1차 gap | 원인 | 수정 (코드) | 증명 시험 (이번 실행에서 통과) | 판정 |
|---|---|---|---|---|
| G1: srcdoc·about:blank+document.write iframe에 번호표·떨림 필터·자석이 없다 (01-07 T1, ELEM-02) | content script에 about: 프레임 매칭이 없었다 | content.ts:127 `matchAboutBlank: true`. 문서 다시 쓰기 감시(content.ts:159-177, MutationObserver → `cleanupOldHelper()` → `frame/reinject`). background.ts:327-345는 보낸 프레임 하나에만 `executeScript`(`frameIds:[sender.frameId]`) | editor-frames.e2e.ts:121(srcdoc 번호 1회), 132·251(100ms 두 번 클릭 → 1), 244(document.write 프레임 테두리), 266(번호 누르기 정확히 1회, 옛 인스턴스 동시 누름 없음), 280(위험 → 확인 → Enter 1회), 346·411(다시 쓰기 뒤 호스트 1개·frame/state 1회·누름 1회), 465(about:blank 뒤 이동), 489(다른 출처 안 srcdoc), 500(모든 장에서 번호 중복 없음, 다섯 버튼 모두 기본 자리 20px 안), 541(presses:null 없음) | **닫힘** |
| G2: 그 프레임 입력칸·편집기에 초점이 가도 '도우미'로 남는다 (01-07 T5, KEY-01) | 같은 원인 | 같은 주입 수정 + 문서 전체 편집기 Esc(mode.ts:65-121, pipeline.ts:202-273) | editor-frames.e2e.ts:150·296(srcdoc·document.write 입력칸 → typing, Esc → helper), 313(designMode 자동 반복 1회, FILT-02), 335(contenteditable 본문 → typing), doc-editor.e2e.ts:58/64/70(Esc → 도우미, 글자 막힘, 다시 누르면 입력) | **닫힘** |

1차 Info였던 "자식 프레임 머무르기가 맨 위 확인 화면 뒤에서 계속된다"(content.ts 231-259)도 01-18이 고쳤다. `childConfirmOpen`(content.ts:230/439/451/502)을 넣었고, dwell.e2e.ts:257(재현)과 291(닫은 뒤 정상)이 통과한다. IN-04(site/query 실패 시 사이트 끄기 fail-open)도 01-18이 고쳤다. 사이트 상태 재시도·fail-closed(content.ts:211, 644, 1090-1136)와 site-toggle.e2e.ts:440/462/528가 근거다.

## 목표 달성

### Roadmap Success Criteria

| # | Truth | 상태 | 근거 |
|---|---|---|---|
| SC1 | 연습 사이트에서 대충 다가가 클릭·스페이스바, 또는 번호표 + 숫자로 누른다. 떨려도 잡힌 요소가 바뀌지 않고, 번호가 프레임 사이에서 겹치지 않는다 | ✓ VERIFIED | magnet·press·hints·frames e2e. 편집기형 iframe까지 editor-frames.e2e.ts:500(장 안 번호 중복 없음) |
| SC2 | 같은 키·자리 재입력, 자동 반복, 의도치 않은 더블클릭이 한 번. 머무르기는 원이 찬 뒤에만. 입력칸·편집기 안 글자 정상과 '입력 중/도우미' 표시 | ✓ VERIFIED | input-filter·dwell e2e. 1차 예외였던 iframe 편집기는 editor-frames.e2e.ts:132/251/313/335, doc-editor.e2e.ts로 닫힘. 실제 한국어 IME는 사람 확인 |
| SC3 | 위험 버튼: 끌림 없음, 머무르기 없음, 번호 → 빨간 확인, 1초 무시, Enter 또는 스페이스 1초만 | ✓ VERIFIED | danger·confirm·dwell e2e. about:blank 프레임 위험 버튼은 editor-frames.e2e.ts:280. 자식 프레임 머무르기 vs 확인 화면은 dwell.e2e.ts:257 |
| SC4 | 5,000개 페이지에서 50ms 안 강조 자동 측정 + 스파이크 기록 | ✓ VERIFIED | overlay-perf p95 18.5 / 24.4ms(이번 실행). spike.e2e 표 재생성 |
| SC5 | 아이콘에서 전체 또는 이 사이트 끄기, 다른 PC 적용, 설정·웹스토어에서 '도울 수 없음' | ✓ VERIFIED (동기화는 흉내) | helper-toggle, site-toggle, blank-popup.e2e.ts:384/413(새 창 탭도 끌 수 있음), site-toggle.e2e.ts:28. 실제 두 PC → 사람 확인. 깨진 설정의 전역 끄기 → D-25 후속(아래) |

### 계획 must-have truth

| 계획 | truth 수 | 상태 | 비고 / 증거 |
|---|---|---|---|
| 01-01 ~ 01-06 | 31 | ✓ 30 + ⚠ 1 backstop | 회귀 확인: 해당 e2e 전부 이번 전체 실행에서 통과, 산출물·링크 전부 통과. 01-02의 실제 다른 PC truth는 `verification: backstop` → insufficient_spec → 사람 확인 |
| 01-07 iframe | 6 | ✓ **6/6** (1차 4/6) | T1·T5가 01-17로 닫힘(위 gap 대조) |
| 01-08 ~ 01-12 | 24 | ✓ 24/24 | 회귀 없음 |
| 01-13 사이트 끄기·도울 수 없음 | 6 | ✓ 5 + ⚠ 1 backstop | 실제 다른 PC → 사람 확인 |
| 01-14 ~ 01-16 | 12 | ✓ 12/12 | 회귀 없음. dom-audit 16/16(5794198의 감사 경고 4건 수정 뒤에도 통과) |
| **01-17** 편집기형 iframe | 10 | ✓ 9 + override 1 | T1 → :121/:266/:465/:489. T2 → :500. T3 → :251/:244. T4 → :150/:296/:313/:335 + doc-editor Esc. T5 → :313. T6 → :280. T7 → :346(맨 위), :411(자식). T8 → :346(frame/state 정확히 1, 호스트 1), :411(관찰 창 0건, 호스트 1, 누름 1). T10 → :541. **T9(맨 위 about:blank 새 창에는 도우미 없음)는 사용자 결정으로 뒤집혔다** → PASSED (override), 01-19 T1·T2로 대체 |
| **01-18** 확인 화면·IN-04·문서 편집기 Esc | 6 | ✓ 6/6 | T1 → dwell.e2e.ts:257. T2 → dwell.e2e.ts:291. T3 → site-toggle.e2e.ts:440. T4 → site-toggle.e2e.ts:462(fail-closed, 알림 1회, 회복)·528. T5 → doc-editor.e2e.ts:58/64/70/76(F 동작). T6 → 게이트 통과 |
| **01-19** 주소 없는 새 창·전체 게이트 | 3 | ✓ 3/3 | T1 → blank-popup.e2e.ts:206/231(호스트 1, 누름 1), 262(여는 쪽 사이트 끄기 따름), 446(기록 키), 466(새 창 안 iframe). unsupported-url 단위 7개. T2 → :384/:413(아이콘·메뉴), :311/:334(noopener는 도울 수 없음, 실측), site-toggle.e2e.ts:28(chrome://version 유지). T3 → 이번 전체 게이트 0 failed, 네트워크·postMessage grep 결과 없음 |

**점수:** 103개 중 **101개 검증**(roadmap SC 5 + 계획 truth 98).
- 검증 100개 + override 1개(01-17 T9)
- 사람 증거가 필요한 backstop 2개(01-02, 01-13의 실제 다른 PC, insufficient_spec)
- FAILED 0개. PRESENT_BEHAVIOR_UNVERIFIED 0개

행동에 의존하는 truth는 모두 이번 실행에서 통과한 이름 붙은 e2e가 있다. 목록: 확인 화면 중 자식 머무르기 멈춤, 옛 인스턴스 정리 뒤 늦은 비동기 조용함, fail-closed 재시도·회복, Esc 나옴·복귀·캐럿 복원.

### 계획 간 모순과 사용자 재결정 (정리)

- **01-17 T9 ↔ 01-19 T1:** 01-17은 "맨 위 about:blank 새 창에는 도우미 없음"을 요구했다. 실행 중 사용자가 결재 팝업 패턴을 지원하라고 결정했다(01-17-SUMMARY key-decisions). 코드는 01-19를 따른다(content.ts:137 가드는 불투명 출처만 제외). frontmatter `overrides`에 기록했다.
- **01-18 key_link "compositionstart이면 resumeDocumentEditor()":** CR-01 사용자 결정으로 없앴다(STATE.md:147). 복귀 신호는 Esc 다시 누름, 편집기 누름, 다른 요소 focusin이다. 그 뒤 초점 옮기기로 다시 결정했다(STATE.md:149). pipeline.ts:428-436에 compositionstart 복귀가 없음을 확인했다. doc-editor.e2e.ts:365는 "조합 시도는 복귀 신호가 아니다"를 단언한다. 01-18 truth 5의 문장 자체(Esc → 도우미, 글자 막힘, 다시 누르면 입력)는 그대로 성립한다.
- **STATE.md:141:** "한글 조합 시작(compositionstart)도 복귀 신호"라는 옛 결정 줄이 남아 있다. 이 줄은 :147·:149가 대체했다. 기록끼리 어긋나지만 코드와는 무관하다(ℹ️).

### D-25와 목표 "방해되면 즉시 끌 수 있다"

- **현재 동작:** 동기화된 settings가 깨졌거나 더 새 형식이면 '1 도우미 끄기'가 거절된다. 근거는 storage-writer.ts:203-208(`preserved-original`)이고, lifecycle.e2e.ts:159가 원본 불변과 안내 문구를 단언한다.
- **같은 상태에서 되는 것:** '2 이 사이트에서 끄기'는 된다. 이유는 셋이다.
  - `writeSiteDisabledOnce`(storage-writer.ts:151-173)는 settings를 읽지 않고 `site:<origin>` 키만 쓴다.
  - content script는 migration 실패 때 기본값(enabled true)으로 돌면서 `syncEnabled`(content.ts:644)에서 siteDisabled를 합친다.
  - 팝업의 사이트 카드는 경고 카드와 따로 그려진다.
  - 이 조합(깨진 settings + 사이트 끄기)만 겨냥한 e2e는 없다. 근거는 코드 읽기다.
- **판정:** 목표 문장을 모든 상태에서 완전히 만족하지는 않는다. 다만 설정이 깨진 드문 경계 상태에 한정되고, 그 상태에서도 사이트 단위로는 즉시 끌 수 있다. 사용자가 **"Phase 1 머지 직후 /gsd-quick으로 처리"**로 범위를 정했다(STATE.md:146). 그래서 gap이 아니라 `deferred`(사용자가 정한 알려진 후속)로 기록했다. 페이즈 상태에는 영향이 없다.

### 필수 산출물 (01-17 ~ 01-19)

| 산출물 | 상태 | 세부 |
|---|---|---|
| tests/practice-site/editor-frames.html | ✓ | srcdoc, document.write, designMode, contenteditable, about:blank 뒤 이동, 다른 출처 안 srcdoc. 외부 주소 없음 |
| tests/e2e/editor-frames.e2e.ts | ✓ | 16개, 전부 통과 |
| src/entrypoints/content.ts | ✓ | `matchAboutBlank`(:127), 다시 쓰기 감시(:159-177), `childConfirmOpen`, `SITE_STATE_UNREADABLE_MESSAGE`(:51, :1096), about: 가드(:137), `cleanupOldHelper`(:1168) |
| src/entrypoints/background.ts | ✓ | `frame/reinject`(:327), `failSiteQueryForE2E`(:176), `siteOriginOfTab`(:39), `topDocOrigins` 기록 가드(:256) |
| src/shared/messages.ts | ✓ | `FrameReinjectMessage`(:197, :226) |
| src/page/input/mode.ts | ✓ | `escapeDocumentEditor`/`resumeDocumentEditor`/`currentMode`의 focusSink 우선(:65-121) |
| src/page/overlay/mode-indicator.ts | ✓ | `getFocusSink`/`isFocusSink`(role=application, aria-label '도우미', DOM감사-4) |
| src/core/unsupported-url.ts | ✓ | `inheritedSiteOrigin`(:44-70), 단위 7개 |
| tests/practice-site/{dwell-frame,doc-editor,blank-popup}.html | ✓ | 로컬 연습 페이지만 |
| tests/e2e/{dwell,site-toggle,doc-editor,blank-popup}.e2e.ts | ✓ | 10 / 19 / 13 / 11개, 전부 통과 |

### 핵심 연결

| From | To | Via | 상태 |
|---|---|---|---|
| content.ts | background.ts | 다시 쓰기 감시 → `cleanupOldHelper()` → `sendMessage({type:'frame/reinject'})` | WIRED (content.ts:161-177) |
| background.ts | content.ts | `executeScript({target:{tabId, frameIds:[frameId]}, files: manifest content_scripts[0].js})` | WIRED (background.ts:331-343) |
| relay → content.ts(자식) | 확인 화면 방송 | `confirm/state {open}` → `childConfirmOpen` → `evaluateMagnet` 조기 반환 | WIRED (content.ts:439/451/502) |
| content.ts(자식) | background.ts | `site/query` 재시도 250→5000ms, 실패 시 fail-closed | WIRED (content.ts:644, :1090-1136) |
| pipeline.ts | mode.ts | Esc → `escapeDocumentEditor(active)`, 다시 Esc → `resumeDocumentEditor({restoreSelection:true})` | WIRED (pipeline.ts:210, :242) |
| background.ts | unsupported-url.ts | `siteOriginOfTab` → `inheritedSiteOrigin`. site/query·recordPress·setSiteDisabled가 사용 | WIRED (:298, :316, :358) |
| popup/main.ts | content.ts | about: 탭은 `site/ping` 답의 origin으로 사이트 카드를 그린다 | WIRED (gsd key-links 통과) |

### 데이터 흐름 (Level 4)

| 대상 | 데이터 | 출처 | 실제 데이터 | 상태 |
|---|---|---|---|---|
| 새 창 사이트 정체 | 사이트 출처 | 프레임 0 `sender.origin`(Chrome) / 문서 자신의 `window.origin` | 예 (blank-popup.e2e.ts:262/446) | ✓ FLOWING |
| 편집기 iframe 누른 기록 | presses 키 | 맨 위 사이트 출처(`cachedTopOrigin`, site/query) | 예 (editor-frames.e2e.ts:541) | ✓ FLOWING |
| 자식 프레임 사이트 끄기 | siteDisabled / siteState | `site/query` → storage.sync `site:<origin>` | 예 (site-toggle.e2e.ts:462) | ✓ FLOWING |

### 동작 스팟 체크

| 동작 | 명령 | 결과 | 상태 |
|---|---|---|---|
| 린트·타입 | `pnpm lint`, `pnpm typecheck` | exit 0 / exit 0 | ✓ PASS |
| 전체 게이트(프로덕션 빌드) | `CI=true pnpm test` (1회) | 단위 101, e2e 234 passed, exit 0 | ✓ PASS |
| about: 프레임 주입 | 빌드 manifest 확인 | `match_about_blank:true` | ✓ PASS |
| 50ms 강조 | 같은 실행의 overlay-perf | p95 18.5 / 24.4ms | ✓ PASS |

### 프로브 실행

`scripts/*/tests/probe-*.sh`가 없고, 계획이 프로브를 선언하지 않았다. 해당 없음.

### 요구사항 대조

| 요구사항 | 계획 | 상태 | 근거 |
|---|---|---|---|
| ELEM-01 | 01-04 | ✓ SATISFIED | magnet.e2e |
| ELEM-02 | 01-07, 01-17, 01-19 | ✓ SATISFIED (1차 PARTIAL) | frames.e2e + editor-frames.e2e 16개 + blank-popup.e2e 11개 |
| ELEM-03 | 01-04 | ✓ SATISFIED | magnet.e2e |
| ELEM-04 | 01-16 | ✓ SATISFIED | overlay-perf p95 18.5/24.4ms |
| FILT-01 | 01-03, 01-17 | ✓ SATISFIED | input-filter.e2e, editor-frames.e2e.ts:132/251/465 |
| FILT-02 | 01-03, 01-17 | ✓ SATISFIED | input-filter.e2e, editor-frames.e2e.ts:313 |
| FILT-03 | 01-03 | ✓ SATISFIED | input-filter.e2e |
| FILT-04 | 01-11 | ✓ SATISFIED | drag.e2e |
| CLICK-01 | 01-04, 01-15 | ✓ SATISFIED | magnet·zoom e2e |
| CLICK-02 | 01-05, 01-12 | ✓ SATISFIED | press·spike e2e (isTrusted만 받는 버튼 한계는 기록됨) |
| CLICK-03 | 01-06, 01-15 | ✓ SATISFIED | hints.e2e |
| CLICK-04 | 01-10, 01-18 | ✓ SATISFIED | dwell.e2e (자식 프레임 vs 확인 화면 포함) |
| KEY-01 | 01-03, 01-17, 01-18 | ✓ SATISFIED (자동) + ? 실제 IME 사람 확인 | editor-frames·doc-editor e2e |
| KEY-02 | 01-05 | ✓ SATISFIED | press·hints·spike |
| SAFE-01 | 01-08, 01-10, 01-18 | ✓ SATISFIED | danger·dwell e2e |
| SAFE-02 | 01-09 | ✓ SATISFIED | confirm.e2e |
| SAFE-03 | 01-09 | ✓ SATISFIED | confirm.e2e |
| SAFE-04 | 01-02, 01-13, 01-18, 01-19 | ✓ SATISFIED (D-25 경계 상태는 사용자 후속) | helper/site-toggle, blank-popup e2e |
| SAFE-05 | 01-13, 01-19 | ✓ SATISFIED | site-toggle.e2e.ts:28/50, blank-popup.e2e.ts:334/384 |
| STOR-01 | 01-02, 01-13 | ✓ SATISFIED (흉내) + ? 실제 두 PC | helper-toggle:142, site-toggle:245 |
| STOR-02 | 01-01, 01-14 | ✓ SATISFIED | lifecycle.e2e |

페이즈 요구사항 ID 21개가 모두 적어도 한 계획의 `requirements`에 있다. REQUIREMENTS.md는 Phase 1에 다른 ID를 매핑하지 않으므로 고아 요구사항이 없다.

ℹ️ REQUIREMENTS.md 추적표(:188-210)는 아직 여러 ID를 "Gaps Found"로 표시한다. 상태 기록이 늦은 것일 뿐 코드 문제는 아니다. 오케스트레이터가 완료 처리할 때 갱신할 항목이다.

### 금지 사항(prohibitions) — 판단 등급, LLM 판정(권위 없음)

| 출처 | 금지 | 판정 | 근거 |
|---|---|---|---|
| 01-09 (SAFE-02) | 위험 버튼은 확인 없이 눌리지 않고, 페이지가 만든 Enter·click은 확인하지 않는다 | 지켜짐 | confirm-guard가 isTrusted=false를 무시. confirm.e2e |
| 01-12 (CLICK-02) | Phase 1에서 실제 회사 시스템을 시험하지 않는다 | 지켜짐 | fixtures.ts:66 `context.route('**/*')`가 practice.test·other.test 밖을 abort하고 기록 |
| 01-16 (ELEM-04) | 페이지 내용·기록·설정을 외부로 보내지 않는다 | 지켜짐 | src/ 네트워크 API grep 결과 없음 |
| 01-17 (ELEM-02) | document.write 다시 쓰기에서 두 번 제출 없음 | 지켜짐 | editor-frames.e2e.ts:266/346/411(카운터 정확히 1) |
| 01-17 (ELEM-02) | 실제 편집기 사이트·CDN을 불러오지 않는다 | 지켜짐 | 연습 페이지에 외부 URL 없음(grep), fixtures route abort |
| 01-18 (SAFE-01) | 확인 화면 중 어떤 요소도 확인 없이 눌리지 않는다(다른 프레임 머무르기 포함) | 지켜짐 | dwell.e2e.ts:257 |
| 01-18 (SAFE-04) | 끈 사이트가 읽기 실패로 조용히 다시 돌지 않는다 | 지켜짐 | content.ts:644 fail-closed, site-toggle.e2e.ts:462 |
| 01-18 (SAFE-04) | 재읽기·알림은 확장 안에서만 | 지켜짐 | chrome.runtime·storage만 사용, 네트워크 grep 결과 없음 |
| 01-18 (KEY-01) | '도우미' 표시 중에 글자가 조용히 들어가지 않는다 | 지켜짐 (CDP 기준) | doc-editor.e2e.ts:58/64/70/280/288/296. 실제 IME·오른쪽 클릭 붙여넣기는 사람 확인 |
| 01-19 (SAFE-04) | 새 창 사이트 정체는 Chrome·문서가 준 값으로만 정한다 | 지켜짐 | background.ts:256(frameId 0 `sender.origin`, tab.url이 about:일 때만), content.ts:137/184(`window.origin`). 메시지 본문 origin은 대조용 |
| 01-19 (ELEM-02) | 새 창 지원도 외부 전송 없음 | 지켜짐 | grep 결과 없음, `window.opener`·`postMessage` 없음 |

### 안티패턴

| 파일 | 줄 | 패턴 | 심각도 | 영향 |
|---|---|---|---|---|
| src/** | — | TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER, `any`, 네트워크 API | 없음 | — |
| src/worker/storage-writer.ts | 203-208 | 깨진 settings에서 전역 끄기 거절(D-25) | ⚠️ Warning (사용자 후속) | 사이트 끄기로 대체 가능. /gsd-quick 예정 |
| src/page/input/pipeline.ts | 36, 260-273 | 나옴 상태에서 Tab도 EDITING_KEYCODES로 삼킨다 | ℹ️ Info | 편집기에서 Esc로 나온 동안 Tab 초점 이동이 막힌다. must-have 영향 없음. Phase 2 체감 확인에서 볼 만하다 |
| .planning/STATE.md | 141 | 옛 KEY-01 결정(compositionstart 복귀)이 새 결정(:147/:149)과 함께 남아 있다 | ℹ️ Info | 기록 불일치, 코드 무관 |
| 01-REVIEW.md IN-01~IN-03 | — | 2회차 Info(topDocOrigins 잔여 경쟁, ping 재시도 창 추정치, TDD 증거 편차) | ℹ️ Info | IN-01은 사람 확인 항목 4번으로 올렸다 |

### 사람 확인 필요 항목

1. **CR-01 실제 한국어 IME.** Windows와 MS 한국어 입력기(크롬·엣지·웨일)에서 다음을 해 본다.
   - 해 볼 것: 문서 전체 편집기에서 Esc → F → 한글 입력.
   - 기대: 문서가 그대로이고, 다시 Esc를 누르면 캐럿이 원래 자리로 돌아온다.
   - 사람이 필요한 이유: CDP로는 5/5 막히는 것을 확인했지만, OS IME는 재현할 수 없다.
2. **초점 옮기기의 blur 부작용.** 실제 CKEditor 4와 SmartEditor 2에서 확인한다.
   - 확인할 것: Esc로 나오고 돌아올 때 도구 막대, 자동 저장, '수정됨' 표시가 어떻게 동작하는지.
   - 사람이 필요한 이유: contenteditable에서는 blur·focusout이 2회 일어난다. 실제 사이트는 CI에서 불러오지 않는다.
3. **오른쪽 클릭 메뉴의 붙여넣기·잘라내기 차단(WR-02).** 나옴 상태에서 해 보고 문서가 그대로인지 본다.
   - 사람이 필요한 이유: 브라우저 기본 메뉴는 자동화할 수 없다. 코드는 pipeline.ts:450-470에 있다.
4. **topDocOrigins 경쟁(WR-03 1회차 / IN-01).** 실제 탭이 about:blank로 이동할 때 사이트 카드와 사이트 끄기가 올바른 출처를 가리키는지 본다.
   - 사람이 필요한 이유: 이 경쟁은 결정적으로 재현할 수 없다.
5. **이용자 PC 설치.** 실제 프로필에 설치한다.
   - 기대: 표시가 뜨고, 메뉴 1~4가 있고, 끄기가 된다.
6. **기본값 체감.** 48px / 24px / 300ms / 800ms를 실제 손으로 판단한다. 조정은 Phase 2 TEST-02에서 한다.
7. **두 번째 PC 동기화.** 전체 끄기와 사이트 끄기가 다른 PC에 적용되는지 본다. backstop 2개와 STOR-01에 해당한다.
8. **판단 등급 금지 사항 11건 검토.** 위 표를 본다. LLM 판정은 11건 모두 '지켜짐'이지만 권위가 없다.

### Gap 요약

1차의 유일한 근본 원인은 닫혔다. srcdoc·about:blank 프레임에 content script가 주입되지 않던 문제다.
- `matchAboutBlank: true`로 주입한다.
- document.write로 문서를 다시 쓰면 옛 인스턴스가 스스로 물러나고, 그 프레임에만 다시 주입한다. 이중 누르기는 없다.
- 문서 전체 편집기에서는 Esc 초점 옮기기가 동작한다.
- 주소 없는 새 창은 여는 쪽 사이트를 따른다.

이 넷 모두 이번 검증자 실행에서 통과한 이름 붙은 e2e가 있다. 1차에 Info·Warning이던 두 가지도 함께 고쳐졌다. 자식 프레임 머무르기가 확인 화면 뒤에서 계속되던 문제와 site/query 실패 시 fail-open이다. 1차에 통과한 truth는 회귀가 없다.

자동으로 검증할 수 있는 must-have에서 남은 빈 곳은 없다. 남은 것은 다음과 같다.
- 사람 확인 8개 묶음: 실제 IME, 실제 편집기 blur, 오른쪽 클릭 메뉴, 재현 불가 경쟁, 설치, 체감, 다중 PC, 판단 등급 금지 사항
- 사용자가 범위를 정한 D-25 후속

그래서 상태는 **human_needed**다.

---

_Verified: 2026-09-26T11:45:00Z_
_Verifier: Claude (gsd-verifier)_
