# Fake handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. 최신사용자지시로같은세션에서직접실행한다.

**Goal:** 실제외부연결없이엄격한파일프로토콜및Space소유권전환을검증한다.
**Architecture:** 순수zod parser/reply gate + 기존switch-engine을소유자1명만구동하는handoff. 독립확장연습화면은가짜함수호출만연결한다.
**Tech Stack:** 기존TypeScript/zod/Playwright/Vitest/WXT.
**Spec:** ../specs/2026-10-02-fake-handoff-design.md

## Global Constraints
- PR16/c608d00·CI70보존,부모관찰CI를조회/재시작하지않는다.
- 실제OS/외부message/native/파일/네트워크/새권한0. 한국어·기존토큰/Space down-up·쉬기/정지 유지.

## Review Focus
- expired stop은현재context만허용;foreigncontext stop이소유권을바꾸면안됨.
- transfer중held/반복/orphanup/조합/수정키는실행0.
- 복귀재개입력은선택0·초안보존.
- 옛응답·원객체수정·중복requestId는pending재활성화0.
- 정상일치응답도수락1회·stop후실행0.

### Task 1: strict payload와reply gate
Files: src/core/file-protocol.ts, tests/unit/file-protocol.test.ts.
Produces: parseFileRequest(input:unknown,now:number,context:FileContext):FileProtocolRequest|null; FileReplyGate(context).arm(payload,now):boolean / take(payload,now):FileProtocolReply|null / changeContext(context):void / expire(now):boolean.
- [ ] valid명령·token/extra/version/만료/foreigncontext/oldreply/중복/원객체수정 테스트 RED→구현→GREEN.

### Task 2: single-owner handoff
Files: src/core/switch-handoff.ts, tests/unit/switch-handoff.test.ts.
Consumes: createSwitchState/reduceSwitch. Produces: SwitchHandoff(states).key(surface,event):OwnedAction[] / transfer(owner,now) / cancel(now) / pause(now) / stop(now) / complete(action,result,now):boolean / tick(now) / snapshot(surface).
- [ ] 양쪽전달1회·held전환·취소복귀세대·초안·oldresult·repeat/IME/modified·정지latch RED→최소구현→GREEN.

### Task 3: 가짜연결연습UI
Files: src/entrypoints/handoff-practice/{index.html,main.ts}, tests/e2e/handoff-practice.e2e.ts.
Consumes: Task1/2/기존panel. 본문역할·연습역할동작횟수와초안은로컬메모리만. gate에가짜status response를함수로반환한다.
- [ ] 실제Space전환/재개/취소/복귀/정지·초점이동·지속시제품표시 E2E RED→구현→GREEN.

### Task 4: 검증·독립리뷰·Git/PR
- [ ] type/lint/unit/build·관련기존file-practice및새UI·자동UI검토.
- [ ] 새전체변경독립리뷰1회,지적은RED→GREEN과관련검사로수정.
- [ ] PR16/c608d00에쌓는별도draftPR,Git상태/실제결과/후속문구관리·긴양식범위보존. merge/deploy없음.

진행: 모든작업미실행. 같은세션지속기록을이파일/WORK-STATUS에갱신한다. 인터페이스사전대조: Task3는Task1의handoffGeneration과Task2의generation을같은값으로사용;contextmode는현재owner engine modeGeneration;선택token은외부파일경로아님.
