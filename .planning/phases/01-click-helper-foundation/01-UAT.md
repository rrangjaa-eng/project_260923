---
status: testing
phase: 01-click-helper-foundation
source: [01-VERIFICATION.md]
started: 2026-09-26T11:29:23Z
updated: 2026-09-26T11:29:23Z
---

## Current Test

number: 1
name: CR-01 — 실제 한국어 입력기에서 문서 전체 편집기 Esc → F → 한글 입력
expected: |
  모드 표시는 '도우미'에 머물고 문서 글자가 바뀌지 않는다. Esc를 다시 누르면 원래 캐럿 자리로 돌아가 입력이 이어진다
awaiting: user response

## Tests

### 1. CR-01 — Windows + MS 한국어 입력기(크롬·엣지·웨일)에서 문서 전체 편집기(designMode·contenteditable 본문)에 글자를 쓰다가 Esc → F(번호표) → 한글 입력
expected: 모드 표시는 '도우미'에 머물고 문서 글자가 바뀌지 않는다. Esc를 다시 누르면 원래 캐럿 자리로 돌아가 입력이 이어진다
result: [pending]

### 2. 초점 옮기기의 blur 부작용 — 실제 사이트 편집기(CKEditor 4, SmartEditor 2)에서 본문에 쓰다가 Esc로 나오고, 다시 Esc 또는 본문을 눌러 돌아오기
expected: 편집기 도구 막대가 사라진 채 굳거나, 자동 저장·'수정됨' 표시가 오작동하거나, 내용이 바뀌는 일이 없다. 캐럿은 돌아온다
result: [pending]

### 3. WR-02 — 나옴 상태(문서 전체 편집기에서 Esc)에서 오른쪽 클릭 메뉴의 '붙여넣기'와 '잘라내기'
expected: 문서가 바뀌지 않는다
result: [pending]

### 4. WR-03(1회차) topDocOrigins 경쟁 — 실제 주소 탭이 about:blank로 이동하는 순간 옛 문서의 늦은 메시지가 새 about: 문서의 사이트 정체를 덮어쓰지 않는지
expected: 새 창·이동한 탭의 사이트 카드와 사이트 끄기가 항상 올바른 출처를 가리킨다
result: [pending]

### 5. 이용자 PC 설치 — 실제로 쓰는 Chrome/Edge/Whale 프로필에 빌드 설치
expected: 일반 사이트에서 왼쪽 아래에 '도우미' 표시가 뜬다. 아이콘 메뉴에 번호 카드 1~4가 열린다. 아이콘에서 도우미를 끌 수 있다
result: [pending]

### 6. 기본값 체감 — 연습 사이트에서 실제 손으로 작은 버튼에 대충 다가가기, 이웃한 두 요소 사이에서 떨기, 잡힌 요소 바로 옆 이웃 직접 클릭
expected: 잡힌 요소가 떨림에 깜박이지 않는다. 24px 히스테리시스 설계를 받아들일지 Phase 2(TEST-02)에서 조정할지 이용자가 판단한다
result: [pending]

### 7. 두 번째 PC 동기화 — 같은 브라우저 계정의 두 번째 PC에서, 첫 PC의 도우미 전체 끄기와 한 사이트 끄기
expected: 보통 동기화 지연 안에 두 번째 PC가 두 설정을 모두 따른다(01-02·01-13 backstop, STOR-01)
result: [pending]

### 8. 판단 등급 금지 사항 11건 검토 — 01-VERIFICATION.md 본문 '금지 사항(prohibitions)' 표
expected: 모두 지켜진다(LLM 판정은 11건 모두 '지켜짐', 권위 없음)
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
