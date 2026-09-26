---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 0
total_count: 3
last_updated: 2026-09-24T08:54:30.714Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 1 | deviation | .planning/phases/01-click-helper-foundation/01-07-PLAN.md |  | Task 2 acceptance grep expects chrome.runtime.getFrameId in collector.ts, but that API doesn't exist in Chrome (Firefox-only) — replaced with frame-path.ts index-path design per orchestrator decision; RESEARCH A2 corrected in SUMMARY | open |  | 2026-09-23T20:23:44.219Z |  |
| 2 | 01 | unrun-verify | src/entrypoints/background.ts |  | 응답 없음 판정의 1초 타임아웃 분기(respondsToSitePing)가 e2e로 직접 재현되지 않음 — 보내기 실패 분기로만 간접 검증됨(01-13) | open |  | 2026-09-24T07:35:24.754Z |  |
| 3 | 01 | unrun-verify | src/entrypoints/content.ts |  | 진짜 확장 업데이트로 옛 content script의 chrome.runtime.id가 무효화되어 모든 리스너가 정지되는 전체 왕복은 이 Playwright/CDP 샌드박스에서 자동 e2e로 검증 불가(reload()가 컨텍스트를 무효화하지 않음) — 실제 Chrome에서 사람이 확장 업데이트로 최종 확인 필요(SUMMARY D6) | open |  | 2026-09-24T08:54:30.714Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "1",
    "file": ".planning/phases/01-click-helper-foundation/01-07-PLAN.md",
    "line": null,
    "description": "Task 2 acceptance grep expects chrome.runtime.getFrameId in collector.ts, but that API doesn't exist in Chrome (Firefox-only) — replaced with frame-path.ts index-path design per orchestrator decision; RESEARCH A2 corrected in SUMMARY",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-23T20:23:44.219Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "01",
    "file": "src/entrypoints/background.ts",
    "line": null,
    "description": "응답 없음 판정의 1초 타임아웃 분기(respondsToSitePing)가 e2e로 직접 재현되지 않음 — 보내기 실패 분기로만 간접 검증됨(01-13)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-24T07:35:24.754Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "01",
    "file": "src/entrypoints/content.ts",
    "line": null,
    "description": "진짜 확장 업데이트로 옛 content script의 chrome.runtime.id가 무효화되어 모든 리스너가 정지되는 전체 왕복은 이 Playwright/CDP 샌드박스에서 자동 e2e로 검증 불가(reload()가 컨텍스트를 무효화하지 않음) — 실제 Chrome에서 사람이 확장 업데이트로 최종 확인 필요(SUMMARY D6)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-24T08:54:30.714Z",
    "resolved_at": null,
    "milestone": null
  }
]
````
