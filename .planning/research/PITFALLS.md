# Pitfalls Research

**Domain:** 접근성 보조 MV3 확장 + 업무 시스템 기록·재생 자동화
**Researched:** 2026-09-23
**Confidence:** MEDIUM

단계 번호는 설계 10-1 "만드는 순서"를 따른다: ① 클릭 도우미 ② 중간 이용자 시험 ③ 이동·입력 ④ 틀 자동화 ⑤ 작업판 ⑥ 화면 정리(AI).

## Critical Pitfalls

### Pitfall 1: 사이트가 확장이 만든 클릭을 무시한다

**What goes wrong:** `element.click()`/`dispatchEvent`는 `isTrusted=false`다. 일부 사이트(보안 솔루션, 일부 그룹웨어 버튼)는 이를 무시하거나 막는다. 번호표·자석 커서·틀 전부가 무력해진다.
**Why it happens:** 봇 방지, 또는 `mousedown`→`mouseup`→`click` 순서·좌표를 검사하는 위젯.
**How to avoid:** ①의 첫 작업으로 연습 사이트 + (가능하면) 실제 회사 시스템 버튼 몇 개에서 합성 클릭이 먹히는지 스파이크(설계 11장 ①). pointer/mouse 이벤트 전체 순서를 좌표와 함께 보내는 헬퍼를 만든다. 그래도 안 되면 `chrome.debugger` CDP 입력(isTrusted=true, "디버깅 중" 띠)을 사이트별 예비 수단으로 검토.
**Warning signs:** 강조는 되는데 눌러도 반응 없음, 사람이 누르면 됨.
**Phase to address:** ① (스파이크를 첫 계획에)

### Pitfall 2: 떨림 필터가 의도한 입력까지 먹는다 / 못 거른다

**What goes wrong:** 간격이 길면 빠른 정상 입력이 사라지고, 짧으면 떨림 재입력이 통과한다. 이용자가 "안 눌린다" 또는 "두 번 눌린다"고 느끼면 바로 안 쓴다.
**Why it happens:** 개발자가 자기 손으로 기본값을 정함.
**How to avoid:** 간격·잡는 범위·머무르기 시간을 전부 설정값으로 두고, ②의 실제 이용자 시험에서 맞춘다. 필터는 순수 함수로 경계값 단위 시험.
**Warning signs:** 활동 기록의 되돌리기 횟수가 높음.
**Phase to address:** ①(구현) · ②(기본값)

### Pitfall 3: 제출 중복 — 되돌릴 수 없는 일

**What goes wrong:** 결과 판정이 애매해 다시 누르거나, service worker가 제출 도중 잠들었다 깨어나 같은 단계를 다시 실행. 전자결재 중복 상신.
**Why it happens:** "실패하면 재시도"라는 일반 자동화 습관, 메모리 상태 유실.
**How to avoid:** 제출 단계를 시작 전/누름/결과 세 상태로 `storage.session`에 먼저 쓰고 누른다. "누름" 이후 불분명하면 무조건 "확인 필요". 재시도 코드 경로 자체를 만들지 않는다. Playwright로 SW 강제 종료 시험.
**Warning signs:** 실행기 코드에 retry 루프가 있음.
**Phase to address:** ④

### Pitfall 4: 확인 화면을 떨림이 통과한다

**What goes wrong:** 스페이스바로 제출 버튼을 고른 직후 떨림으로 스페이스바가 한 번 더 들어가 확인까지 됨.
**How to avoid:** 확인 화면 뜬 뒤 1초 모든 입력 무시, 확인 키는 Enter(또는 스페이스바 1초 누르기)로 선택 키와 다르게. ①의 위험 버튼 재확인에서 먼저 만들어 ④가 재사용.
**Warning signs:** 확인 화면이 스페이스바에 반응함.
**Phase to address:** ①(구현) · ④(제출 확인 재사용)

### Pitfall 5: iframe 좌표·번호 꼬임

**What goes wrong:** 회사 시스템 본문이 iframe 안. 번호가 프레임마다 1부터 중복되거나, 강조 위치가 어긋남, 스크롤하면 틀어짐.
**How to avoid:** 맨 위 프레임 통합(ARCHITECTURE Pattern 2), 연습 사이트에 중첩·cross-origin iframe 양식을 넣어 ①부터 시험.
**Warning signs:** 같은 번호 두 개, 강조가 요소 옆에 뜸.
**Phase to address:** ①

### Pitfall 6: 알림 창(alert/confirm)이 모든 것을 멈춘다

**What goes wrong:** 네이티브 confirm이 뜨면 페이지 JS가 멈추고 오버레이도 못 띄움. 틀이 영원히 멈추거나, 반대로 가로채기가 너무 넓어 위험한 창을 자동 확인.
**How to avoid:** main world에서 틀 실행 중에만 교체, "제출 확인 직후 첫 창 하나"만 확인, 나머지는 취소+멈춤+글 표시. main world ↔ isolated 통신은 페이지가 위조할 수 없게 토큰 확인.
**Phase to address:** ④

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| 저장 값에 형식 버전 없이 시작 | 빠름 | 첫 변경 때 이용자 설정 날아감 | 절대 안 됨 — ①부터 `schemaVersion` |
| 판별 단어를 코드에 하드코딩 | 빠름 | 사이트별 설정 불가 | ① 초기만, ③에서 설정으로 |
| 요소 찾기를 CSS 경로 하나로 | 구현 쉬움 | 화면 조금만 바뀌어도 막힘 | 안 됨 — 여러 방식 점수 |
| 오버레이를 페이지 DOM에 직접 | 쉬움 | 사이트 CSS와 충돌 | 안 됨 — Shadow DOM |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `storage.session` | content script에서 바로 읽으려다 실패 | 기본은 신뢰 컨텍스트만. SW가 중개하거나 `setAccessLevel` |
| `storage.sync` | 용량(약 100KB, 항목 8KB, 분당 120회 쓰기) 무시 | 용량 감시·사전 알림, 자주 누른 기록 같은 잦은 쓰기는 local |
| 웨일 동기화 | 크롬처럼 된다고 가정 | 확인 전까지 파일 내보내기·가져오기를 기본 수단으로 |
| declarativeNetRequest | 전역 규칙으로 모든 탭 이미지 차단 | 세션 규칙 + `tabIds`로 틀 실행 탭만 |
| 웹스토어 배포 | 롤백을 "옛 zip 다시 올리기"로 생각 | 대시보드 롤백, 안 되면 더 높은 버전 번호로 재게시, 지연 게시 |
| Anthropic API | 키를 sync에 저장 | local에만, 코드·커밋에 금지 |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| pointermove마다 전체 요소 거리 계산 | 커서 끊김 | 60Hz 제한 + 공간 색인 | 요소 수천 개 |
| MutationObserver 콜백마다 재수집 | CPU 100%, 강조 지연 | 모아서(마이크로태스크/idle) 한 번 | 잦은 DOM 갱신 회사 시스템 |
| `getBoundingClientRect` 대량 호출 | 레이아웃 강제 반복 | 읽기 묶기, IntersectionObserver | 5,000 요소 |
| 뒤쪽 탭 타이머·rAF 의존 | 뒤에서 도는 틀이 수 분씩 멈춤 | SW 조정 + DOM 이벤트 기반 진행, 11장 ③ 측정 | 탭 숨김 5분 이후 |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| 민감칸 값을 최근 값·틀·기록·AI에 흘림 | 비밀번호·주민번호 유출 | 판별기 한 곳, 모든 저장·전송 경로가 통과하도록, 단위 시험 |
| AI 전송에 입력 값·개인정보 모양 포함 | 외부 유출 | 값 제외 + 이메일·전화·긴 숫자 가림 + 시험 |
| main world 메시지 신뢰 | 페이지가 "확인" 신호 위조 | 무작위 토큰, 출처 확인 |
| 틀 파일 가져오기 무검사 | 악성 단계 주입 | zod 검사, 가져온 틀의 제출 단계 표시 |
| 모든 사이트 권한을 조용히 요청 | 신뢰 저하 | 설치 화면 고지(설계 8장) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| 숫자·스페이스바가 입력칸에서 가로채짐 | 글자를 못 씀 | 모드 판정 + 크게 모드 표시 |
| 작은 번호표·얇은 테두리 | 안 보임 | 크기를 컨디션 모드 설정으로 |
| 도우미 끄는 길이 깊음 | 방해될 때 일을 못 함 | 아이콘 한 번 + 명령판에서 바로 |
| 오류 문구가 작고 기술적 | 무엇을 할지 모름 | 큰 글씨, "Enter=예 / Esc=취소" 같은 행동 안내 |

## "Looks Done But Isn't" Checklist

- [ ] **자석 커서:** 5,000요소 페이지에서 50ms 측정했는가(Playwright 자동 측정)
- [ ] **번호표:** iframe 안 요소도 번호가 붙고 중복 없는가
- [ ] **도우미 끄기:** 사이트별로 끈 설정이 다른 PC로 동기화되는가
- [ ] **제출:** SW 강제 종료 후 이어 가기에서 재제출이 없는가
- [ ] **알림 창:** 두 번째 confirm이 취소+멈춤으로 처리되는가
- [ ] **민감칸:** 최근 값·틀·활동 기록·AI 요청 네 곳 모두에서 빠지는가
- [ ] **형식 변환:** 변환 실패 시 원본이 그대로 남는가
- [ ] **"도울 수 없음":** 크롬 설정·웹스토어 페이지에서 아이콘 표시가 되는가

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| 합성 클릭 거부 | HIGH | 사이트별 CDP 입력 예비 수단 또는 해당 사이트 제외 |
| 기본값이 안 맞음 | LOW | ② 시험 반복, 맞춤 설정 재실행 |
| 잘못된 버전 배포 | MEDIUM | 도우미 끄기로 버티기 → 웹스토어 롤백 → 재게시 |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 합성 클릭 거부 | ① | 스파이크 결과 기록, 연습 사이트 e2e |
| 필터 기본값 | ①·② | 단위 시험 + 이용자 시험 기록 |
| 확인 화면 보호 | ① | e2e: 확인 직후 스페이스바 무시 |
| iframe | ① | 연습 사이트 iframe 양식 e2e |
| 사이트 단축키 충돌(11장 ④) | ① | capture 단계 가로채기 e2e |
| 민감칸 누출 | ③(판별기)·④·⑥ | 단위 시험 + 저장소 검사 |
| 제출 중복 | ④ | SW 강제 종료 e2e |
| 알림 창 | ④ | 연습 사이트 alert/confirm e2e |
| 뒤쪽 탭 속도(11장 ③) | ⑤ | 숨은 탭 실행 시간 측정 |
| AI 누출·환각 | ⑥ | 가림 단위 시험, 목록 밖 답 거부 시험 |
| 회사 PC 정책(11장 ②) | ① 착수 전 | 이용자 PC에서 설치 확인 |

## Sources

- 설계 문서 5·6·8·9·10·11장 — HIGH
- [chromium-dev: isTrusted events](https://groups.google.com/a/chromium.org/g/chromium-dev/c/94t2J_Jylyw) — MEDIUM
- Chrome 숨은 탭 타이머 제한(intensive throttling), `storage.sync` 할당량 — 일반 지식 — MEDIUM
- [Chrome Web Store rollback](https://developer.chrome.com/docs/webstore/rollback) — HIGH

---
*Pitfalls research for: 손 떨림 브라우저 도우미*
*Researched: 2026-09-23*
