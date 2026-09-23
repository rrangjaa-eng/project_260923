# 브라우저 자동화 도구 (이름 미정)

## What This Is

조건을 양식으로 한 번 넣어 두면 브라우저를 자동으로 움직여 목표를 끝내는 개인용 CLI 도구다. 첫 버전은 예약·신청이다. 식당·공연·캠핑장 같은 예약 사이트에서 빈자리가 날 때까지 확인하다가, 조건에 맞는 자리가 나면 신청까지 끝낸다. 사용자(랑쟈) 한 사람이 자기 컴퓨터에서 쓴다.

## Core Value

조건에 맞는 빈자리가 나면, 사람이 보지 않은 단계로는 절대 제출하지 않으면서 신청까지 자동으로 끝낸다.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] 사용자가 `task new`에서 사이트·날짜·시간대·인원·예약자 정보·확인 간격·마감 시각을 양식으로 넣어 작업을 저장할 수 있다 (값이 정해진 항목은 고르기)
- [ ] 사용자가 `login <사이트>`로 연 브라우저 창에서 한 번 로그인하면, 이후 실행이 그 로그인 상태를 재사용한다
- [ ] 사용자가 `run <작업>` 한 번으로 빈자리를 간격마다 확인하고, 마감 시각이 지나면 끝나게 할 수 있다
- [ ] 처음 쓰는 사이트는 Claude가 실행 계획을 만들고, 같은 사이트 두 번째 실행부터는 Claude 호출이 0번이다
- [ ] 단계가 깨지면 Claude가 그 단계만 고치고, 성공한 뒤에만 저장한다 (단계당 2번, 실행당 5번 한도)
- [ ] 새 작업의 첫 실행은 제출 직전에 멈춰 y/n을 묻고, y면 그 자리에서 제출한다
- [ ] Claude가 빈자리 판정이나 신청 단계를 고치면 확인이 풀려 다음 제출 전에 다시 묻는다
- [ ] 제출은 절대 다시 시도하지 않고, 결과가 불분명하면 "확인 필요"로 끝나며 `task resolve`로 정리한다
- [ ] CAPTCHA·새 결제 정보·로그인 풀림·Claude 오류·프로필 잠김을 만나면 아무것도 제출하지 않고 이유를 기록하고 멈춘다
- [ ] 실행마다 한 일, 멈춘 이유, Claude 호출 횟수를 기록한다

### Out of Scope

- 반복 업무(회사 웹시스템)·정보 수집 — 첫 버전 이후. 같은 엔진으로 나중에 붙인다
- 정기 실행(스케줄러)·웹 화면·휴대폰 조종 — 첫 버전은 명령 한 줄 실행만
- 여러 사용자 — 혼자 쓰는 도구
- CAPTCHA·봇 차단 우회 — 사이트 예의, 하지 않는다
- 결제 정보 저장·입력 — 보안상 하지 않는다
- 한 번 보여주면 배우기, 여러 곳 동시 감시, 모든 예약 한 곳 — 첫 버전 이후 로드맵

## Context

- 설계 문서: `docs/designs/browser-automation.md` (/office-hours, 2026-09-23 승인, PR #6)
- 저장소 `rrangjaa-eng/project_260923`의 `browser-automation` 브랜치가 기준이다. main은 별개 프로젝트(PLANT8 ERP 도구 설정)다
- 기존 도구 조사: Stagehand(TS, MIT)가 캐시·자가 복구로 이 하이브리드와 거의 같다. 다만 `claude -p` 연결은 확인되지 않았다
- 첫 대상 사이트는 아직 정해지지 않았다
- 첫 버전 이후 순서: 보여주면 배우기 → 여러 곳 동시 감시 → 회사 업무 → 휴대폰 조종 → 모든 예약 한 곳

## Constraints

- **Claude 호출**: headless `claude -p`를 자식 프로세스로 부른다. Max 요금제 안에서 하고, `ask-claude` 함수 하나 뒤에 둔다 — 추가 비용 없이 쓰고, 나중에 그 함수만 API로 바꾸기 위해서다. Agent SDK 패키지와 `--bare`는 쓰지 않는다. 둘 다 API 키가 필요하다
- **스택**: TypeScript strict, pnpm, `any` 금지 — 저장소 규칙
- **개인정보**: Claude에 보내는 페이지 정보에서 예약자 이름·연락처는 가린다
- **사이트 예의**: 확인 간격은 30초 이상이고 기본 1분이다
- **시크릿**: 비밀번호·결제 정보를 저장하지 않는다. 로그인 상태는 브라우저 프로필 폴더에만 남긴다

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 하이브리드(평소엔 실행기, 막힐 때만 Claude) | 순수 스크립트는 사이트마다 손이 가고, 완전 AI는 반복 확인마다 비용이 든다 | — Pending |
| Claude는 Max의 `claude -p`, 함수 하나 뒤에 | 비용 0원. 속도가 필요하면 함수만 API로 교체한다 | — Pending |
| 첫 버전은 예약·신청만 | 엔진은 같으니 사용자가 실제로 쓸 것부터 만든다 | — Pending |
| 새 작업의 첫 실행만 제출 직전 확인 | 계획이 틀려도 잘못된 신청이 나가지 않는다 | — Pending |
| 엔진(Stagehand 또는 Playwright 직접)은 조사에서 결정 | Stagehand가 필수 동작 4가지를 지킬 수 있는지 확인이 먼저다 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-23 after initialization*
