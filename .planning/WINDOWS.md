---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-09-23T20:23:44.219Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 1 | deviation | .planning/phases/01-click-helper-foundation/01-07-PLAN.md |  | Task 2 acceptance grep expects chrome.runtime.getFrameId in collector.ts, but that API doesn't exist in Chrome (Firefox-only) — replaced with frame-path.ts index-path design per orchestrator decision; RESEARCH A2 corrected in SUMMARY | open |  | 2026-09-23T20:23:44.219Z |  |

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
  }
]
````
