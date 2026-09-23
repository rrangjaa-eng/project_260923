# Architecture Research

**Domain:** Hybrid browser-automation CLI (plan-once / replay-deterministically / repair-only-the-broken-step, with reservation-safety rules)
**Researched:** 2026-09-23
**Confidence:** HIGH for component boundaries and state machine (derived directly from the approved design doc, `docs/designs/browser-automation.md`, which is the project's own settled spec) / LOW-MEDIUM for engine-specific claims about Stagehand and the `claude -p` CLI (web search only, no official docs fetched via MCP — flagged per-claim below)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                              CLI Layer                                │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌────────────────────┐   │
│  │ task new  │ │  login    │ │    run    │ │   task resolve      │   │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └──────────┬──────────┘   │
├────────┴─────────────┴─────────────┴──────────────────┴──────────────┤
│                          Orchestration Layer                          │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                             Runner                              │  │
│  │  loop: search-steps → stop-condition detectors → checkSlot      │  │
│  │        → (no slot: wait interval / deadline) → apply-steps      │  │
│  │        → first-run confirmation gate → submit guard             │  │
│  │  on any step failure → repair loop                               │  │
│  └───────┬───────────────────┬───────────────────┬─────────────────┘  │
│          │                   │                   │                    │
│  ┌───────▼──────┐   ┌────────▼────────┐  ┌───────▼───────────┐       │
│  │ Repair loop  │   │ Stop-condition  │  │ Per-site lock      │       │
│  │ (bounded)    │   │ detectors       │  │ (proper-lockfile)  │       │
│  └───────┬──────┘   └─────────────────┘  └────────────────────┘       │
│          │                                                            │
│  ┌───────▼──────┐                                                     │
│  │  ask-claude  │──── spawns ────▶  `claude -p` child process         │
│  └──────────────┘   (--output-format json)                            │
├─────────────────────────────────────────────────────────────────────┤
│                         Engine Adapter (boundary)                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Playwright (direct)   OR   Stagehand (act/extract/observe)      │  │
│  │  execute(step) → result        getPageSummary() → summary        │  │
│  └────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                              Storage Layer                            │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────────┐  │
│  │  Task Store   │  │ Site Plan Store   │  │  Run Log               │  │
│  │  (per task    │  │ (per site domain, │  │  (append-only,         │  │
│  │  JSON file)   │  │  search[]/apply[])│  │  per run)               │  │
│  └──────────────┘  └──────────────────┘  └───────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Browser profile directories (one per site, holds login state) │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Talks to |
|-----------|-----------------|----------|
| CLI commands (`task new`, `login`, `run`, `task resolve`) | Terminal I/O only: prompt for form fields, launch a visible browser for manual login, kick off a run, let the user reconcile a `needs-check` task. No business logic. | Task Store, Site Plan Store, Runner, Engine Adapter (for `login` only) |
| Task Store | CRUD for task files: form values, status (`new`/`confirmed`/`submit-attempted`/`needs-check`/`done`), timestamps. One task = one local JSON file. Owns status transitions — nothing else writes task status directly. | Filesystem only. Read by Runner/CLI, written by Runner (status changes) and CLI (`task new`, `task resolve`) |
| Site Plan Store | CRUD for site plan files: `search[]` and `apply[]` step arrays, keyed by site domain. Multiple tasks for the same site share one plan. | Filesystem only. Read by Runner every loop tick, written only by the Repair loop after a repaired step is verified to actually work |
| `ask-claude` | The **only** function that spawns `claude -p`. Input: a purpose tag (`search-plan` / `apply-plan` / `repair-step`) + a redacted page summary + the step schema. Output: a schema-validated list of steps. No browser access, no side effects — pure request/response. | `claude` CLI child process only. Called by Runner (first-time plan generation) and Repair loop (fixing a broken step) |
| Runner | Orchestrates one `run`: interval loop, deadline check, drives search→checkSlot→apply, invokes stop-condition detectors every tick, delegates to repair loop on step failure, delegates to confirmation gate + submit guard around `submit`, writes to Run Log. The only component that sees the full flow end to end. | Task Store, Site Plan Store, Engine Adapter, Repair loop, Stop-condition detectors, Confirmation gate, Submit guard, Run Log, Per-site lock |
| Repair loop | Takes one failing step + current page summary, calls `ask-claude` with purpose `repair-step`, schema-validates the response, **executes the candidate for real** via the Engine Adapter, and only on real success writes it back to the Site Plan Store. Enforces the 2-per-step / 5-per-run caps. Reports back to the Runner whether the repaired step touched `search[]` (silent) or `apply[]` (must reset confirmation for every task on that site). | ask-claude, Engine Adapter, Site Plan Store |
| First-run confirmation gate | Sits between "apply steps ready to submit" and the submit guard. Checks `task.confirmed`. If false: prints the filled-in values + page summary, asks y/n with a 5-minute timeout. `y` → proceed to submit guard and flip `confirmed=true`. `n`/timeout → abort the run without submitting, log the reason. | Task Store (read/write `confirmed`), terminal I/O |
| Submit guard | Wraps exactly one step (`submit`) plus its outcome check (`expectSuccess`). Writes `submit-attempted` to the Task Store **before** clicking (crash-safety breadcrumb). Clicks once, never retries, classifies the outcome into `done` or `needs-check`. Refuses to run at all if the task is already `submit-attempted` or `needs-check` — those require `task resolve` first. | Task Store, Engine Adapter, Run Log |
| Stop-condition detectors | Pure classifier functions run over the page summary at every loop tick and specifically right before `submit`: CAPTCHA/bot-block screen, new-payment-info screen, logged-out redirect, `claude -p` usage/error signal bubbled up from ask-claude, browser-profile-already-open lock error, interval-oversleep (logged only, does not stop). Any positive match aborts the run with nothing submitted. | Runner (called synchronously in the loop), Run Log |
| Per-site lock | File lock keyed by site domain (e.g. `proper-lockfile` against a `<site>.lock` path), acquired at the start of `run`, released on process exit (including crash via `onExit` cleanup). A second `run` for the same site fails fast with a message instead of queuing. | Filesystem lock file. Acquired/released by Runner around the whole run |
| Run log | Append-only record per run: steps executed, stop reason (if any), `ask-claude` call count, final task status. Used for the "same site twice = 0 Claude calls" success criterion and for debugging repairs. | Filesystem only, written by Runner throughout the run |

## Recommended Project Structure

```
src/
├── cli/                    # Thin command layer — no business logic
│   ├── task-new.ts
│   ├── login.ts
│   ├── run.ts
│   └── task-resolve.ts
├── store/
│   ├── task-store.ts        # task file CRUD + status transition guards
│   ├── site-plan-store.ts   # site plan file CRUD
│   └── schema.ts            # zod schemas: Task, SitePlan, Step (shared by store + ask-claude)
├── ask-claude/
│   ├── ask-claude.ts        # the single function; spawns `claude -p`
│   └── prompts.ts           # purpose-specific prompt templates (search-plan/apply-plan/repair-step)
├── runner/
│   ├── runner.ts             # loop, interval, deadline, orchestration
│   ├── repair-loop.ts        # bounded repair, cache-write-on-verified-success
│   ├── confirmation-gate.ts  # y/n prompt + confirmed flag transitions
│   ├── submit-guard.ts       # submit-attempted breadcrumb + no-retry + outcome classification
│   └── stop-conditions.ts    # pure detector functions over PageSummary
├── engine/
│   ├── engine-adapter.ts     # interface: execute(step), getPageSummary(), launch(profileDir)
│   ├── playwright-adapter.ts # direct Playwright implementation (default)
│   └── stagehand-adapter.ts  # optional, only if the engine spike clears all 4 gates
├── lock/
│   └── site-lock.ts          # per-site file lock wrapper
├── log/
│   └── run-log.ts            # append-only run record writer
└── redact.ts                 # strips reservation-holder name/phone before any ask-claude call
```

### Structure Rationale

- **`store/` is engine-agnostic and has zero runtime dependency on `engine/`.** Task and site plan files are just JSON on disk validated by shared zod schemas — this is what lets `task new`, `login`, and `task resolve` be built and tested before any browser engine decision is finalized.
- **`ask-claude/` has zero dependency on `engine/` or `store/`.** It only knows "purpose + page summary in, step list out" — this is the seam the constraints doc calls out explicitly (swap `claude -p` for an API call later without touching anything else).
- **`engine/` is the only folder that changes if Stagehand vs Playwright-direct is chosen.** Everything in `runner/` talks to `EngineAdapter`, never to `page.click()` or `stagehand.act()` directly — this containment is what keeps the rest of the codebase engine-neutral in fact, not just in intent.
- **`runner/submit-guard.ts` and `runner/confirmation-gate.ts` are separate files from `runner.ts`** because they encode the project's actual differentiating value (safety rules) and need to be unit-testable in isolation from the loop/interval mechanics.

## Architectural Patterns

### Pattern 1: Cache-then-repair (plan replay with verified-write-back)

**What:** The Site Plan Store is the cache. The Runner always tries the cached step first. On failure, the Repair loop asks Claude for a fix, **executes it for real**, and only writes it back if execution actually succeeded. The plan file is therefore always a record of steps that have been proven to work at least once — never a record of what Claude merely suggested.
**When to use:** Any time repeated runs hit a mostly-stable target (same site, same DOM shape) with occasional breakage.
**Trade-offs:** Requires an extra "execute the candidate to verify" round trip before caching (slower repair), but eliminates the failure mode of caching a plausible-looking-but-wrong step.

**Example:**
```typescript
async function repairStep(step: FailingStep, ctx: RunContext): Promise<Step> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const candidate = await askClaude({ purpose: "repair-step", step, pageSummary: ctx.pageSummary });
    if (!validateStep(candidate)) continue;
    const result = await ctx.engine.execute(candidate); // real execution, not a dry run
    if (result.ok) {
      await sitePlanStore.replaceStep(ctx.site, step.section, candidate);
      return candidate;
    }
  }
  throw new RepairExhaustedError(step);
}
```

### Pattern 2: Confirmation as a per-site, not per-task, gate

**What:** `confirmed` lives on the task, but repairing an `apply[]` step (including the `submit` selector) resets `confirmed=false` for **every task tied to that site plan**, not just the task being run. A `search[]`-only repair never touches confirmation.
**When to use:** Any time a shared, mutable plan backs multiple independent tasks and a change to it changes what "the human already saw this" means.
**Trade-offs:** Slightly more bookkeeping (repair loop must know which array it patched and fan out the reset), but it's the only way to honor "사람이 보지 않은 단계로는 절대 제출하지 않는다" when plans are shared.

**Example:**
```typescript
if (repairedSection === "apply") {
  const tasksOnSite = await taskStore.listBySite(site);
  await Promise.all(tasksOnSite.map(t => taskStore.setConfirmed(t.id, false)));
}
```

### Pattern 3: Durable pre-action breadcrumb for non-idempotent operations

**What:** Before doing something that cannot be safely retried (clicking `submit`), write a persisted marker (`submit-attempted`) first. If the process crashes between the write and the outcome check, the marker survives and blocks any future automatic retry — the human must resolve it via `task resolve`.
**When to use:** Any side effect with real-world consequences (payment, reservation, irreversible mutation) driven by a possibly-flaky automation loop.
**Trade-offs:** Adds a disk write on the hot path and a state that must be explicitly drained by a human command, but is the only correct answer for "never double-submit."

## Data Flow

### Run Flow (`run <task>`)

```
run <task>
  ↓
[Per-site lock: acquire] → fail fast if already held
  ↓
[Task Store: read task]  [Site Plan Store: read site plan]
  ↓
loop (until deadline):
  Engine Adapter.execute(search[] steps)
    ↓ on step failure → Repair loop → ask-claude → Engine Adapter (verify) → Site Plan Store (write-back)
  Engine Adapter.getPageSummary() → Stop-condition detectors
    ↓ positive match → Run Log (reason) → exit, nothing submitted
  checkSlot result
    ├─ no match → sleep(interval) → loop
    └─ match → Engine Adapter.execute(apply[] steps, up to but not including submit)
                 ↓ on step failure → Repair loop (same as above; apply-section repair resets confirmed site-wide)
                 ↓
               Confirmation gate: task.confirmed?
                 ├─ false → prompt y/n (5 min) ── n/timeout → Run Log → exit
                 │                              └─ y → Task Store: confirmed=true → continue
                 └─ true → continue
                 ↓
               Submit guard:
                 Task Store: status=submit-attempted (write BEFORE click)
                 Engine Adapter.execute(submit) → expectSuccess check
                   ├─ matched   → Task Store: status=done   → Run Log → exit
                   └─ ambiguous → Task Store: status=needs-check → Run Log → exit
  ↓
[Per-site lock: release] (always, including on crash)
```

### Key Data Flows

1. **Plan generation (cold start):** `run` finds no `search[]` (or no `apply[]`, triggering the "연습 실행"/practice-run described in the design doc) for the site → Runner calls `ask-claude` directly (not through the repair loop) with purpose `search-plan`/`apply-plan` → validated steps are executed once to prove they work → written to Site Plan Store. This is the only path where Claude is called *before* any failure occurs.
2. **Repair (warm path):** Engine Adapter step execution fails → Repair loop takes over, `ask-claude` → validate → execute-to-verify → Site Plan Store write-back → confirmation fan-out if `apply[]` was touched. This is the dominant steady-state path after the first successful run.
3. **Privacy redaction:** Task Store values (name, phone) never reach `ask-claude` directly — the Runner substitutes them with `{{placeholder}}` tokens before building any page summary or prompt sent to the CLI child process, and re-substitutes real values only when the Engine Adapter actually fills a form field locally.
4. **Status write ownership:** Only the Runner (via Confirmation gate / Submit guard) and the CLI's `task resolve` command ever write `task.status`. The Task Store itself does not compute transitions — it exposes explicit methods (`setConfirmed`, `markSubmitAttempted`, `markDone`, `markNeedsCheck`, `resolve`) so illegal transitions (e.g. re-attempting submit on a `needs-check` task) are a store-level rejection, not just a Runner-level convention.

## Task Status State Machine

```
                    ┌─────────────────────────────────────────┐
                    │   apply[] repair on this site (any task) │
                    │   resets confirmed → false                │
                    └───────────────┬────────────────────────┘
                                    │
   ┌─────┐   first run reaches     ▼        ┌───────────┐
   │ new │──submit, user answers y──────────▶│ confirmed │
   └──┬──┘   (submit executes in the         └─────┬─────┘
      │       same step as this transition)         │
      │ n / 5min timeout                             │ subsequent runs skip the
      │ (no submit attempted,                        │ y/n prompt and go straight
      │  run just ends)                               │ to submit when a slot matches
      ▼                                               ▼
   [run ends, task stays "new"]              write submit-attempted
                                              (persisted BEFORE the click,
                                               survives a crash)
                                                       │
                                              click submit, evaluate
                                              expectSuccess ONCE — never retried
                                                       │
                                    ┌──────────────────┴──────────────────┐
                                    ▼                                     ▼
                                 ┌──────┐                          ┌─────────────┐
                                 │ done │                          │ needs-check │
                                 └──────┘                          └──────┬──────┘
                                (terminal;                                │
                                 run never                          task resolve
                                 re-runs this task)                       │
                                                          ┌────────────────┴────────────────┐
                                                          ▼                                  ▼
                                                    "안 됨" (not applied)              "신청됨" (applied)
                                                  → back to confirmed,               → done
                                                    can run again and
                                                    attempt submit again
```

Notes on the state machine:
- **`confirmed` is not strictly one of the five linear states** — it is a boolean that gates the transition into `submit-attempted`. The five states named in the question map as: `new` (unconfirmed, never submitted), `confirmed` (seen a submit once, or repair never touched `apply[]`, safe to auto-submit), `submit-attempted` (durable pre-click breadcrumb; only ever observed persisted-across-runs if the process died mid-submit), `needs-check` (outcome unknown, blocks all further runs of this task until resolved), `done` (terminal success).
- **`submit-attempted` is normally transient within a single run** — it's written, then immediately resolved to `done` or `needs-check` in the same execution. It only becomes an externally-visible, blocking state if the process crashes between the write and the outcome check — which is exactly the crash-safety property it exists for.
- **Any task on a site whose `apply[]` plan gets repaired loses `confirmed`, even if that specific task wasn't the one running.** This is a fan-out write from the Repair loop through the Task Store, not something the Runner can skip.
- **`task resolve` is the only way out of `needs-check`.** It is also the only way to safely re-arm a task after an ambiguous submit, since the Runner refuses to touch a `needs-check` (or lingering `submit-attempted`) task at all.

## Suggested Build Order

1. **Engine spike (blocks everything downstream of the Engine Adapter).** Test the 4 gates from the design doc against Stagehand on one real page: (a) can `claude -p` be wired in as its LLM client, (b) can the app detect when Stagehand healed a step (to drive the confirmed-reset rule), (c) can automatic re-submission be prevented, (d) can page content be redacted before it reaches Stagehand's internal LLM calls. Web research here (see Sources) found no confirmed off-the-shelf answer for (a) or (b) — budget this as a real spike, not a formality. If any gate fails, default to Playwright-direct.
2. **Store layer: Task Store + Site Plan Store + shared zod schemas.** Pure filesystem code, no engine, no CLI. Fully unit-testable first. Everything else depends on the schemas defined here.
3. **`ask-claude`.** Depends only on the step schema from (2). Unit-testable by mocking the `claude` child process (or running it for real against a fixture page summary). Nothing about the browser needs to exist yet.
4. **Engine Adapter + step executor for the 8 step types** (`goto`/`click`/`fill`/`select`/`waitFor`/`checkSlot`/`submit`/`expectSuccess`), plus page-summary extraction. Depends on the engine decision from (1) and the schema from (2).
5. **Repair loop.** Wires (2)+(3)+(4) together: on step failure, call ask-claude, validate, execute-to-verify, write back, report which section was touched. This is where the cache-then-repair pattern becomes real and testable end to end (break a selector on purpose, confirm it self-heals and persists).
6. **Stop-condition detectors.** Pure functions over `PageSummary`; can be built and unit-tested in parallel with (4)/(5) since they don't depend on live execution, only on the summary shape.
7. **Per-site lock + Run log.** Cross-cutting infra; depends only on (2) for file paths/task-site association. Can be built any time after (2), in parallel with (3)–(6).
8. **Confirmation gate + Submit guard.** The safety-critical seam — depends on (2) [status writes], (4) [executing submit], (5) [knowing whether apply[] was just repaired]. Build and test this in isolation with a fake Engine Adapter before wiring it into the full Runner loop, since this is the component the project's core value proposition actually rests on.
9. **Runner (the loop itself: interval, deadline, wiring 4–8 together).** The integration point; deliberately last among the non-CLI components so it has stable, independently-tested parts to assemble.
10. **CLI commands** (`task new`, `login`, `run`, `task resolve`). Thin orchestration over everything above; `login`'s only novel piece is launching a persistent browser profile context, which the Engine Adapter from (4) should already expose.
11. **End-to-end validation against one real target site**, against the design doc's 6 success criteria (cold-start plan generation, zero-Claude-calls on the second run, selector self-heal + persistence, confirmation reset on apply-step repair, hard-stop detectors, no-retry-on-ambiguous-submit).

This mirrors the design doc's own "Next Steps" ordering; the value added here is the explicit dependency reasoning (why the store layer and `ask-claude` can and should be built and tested before any engine code exists, and why the confirmation/submit-guard seam should be built and tested in isolation rather than only inside the full Runner loop).

## Anti-Patterns

### Anti-Pattern 1: Letting the engine's own self-heal/cache run instead of the project's repair loop

**What people do:** Enable Stagehand's `selfHeal: true` + `cacheDir` and treat that as "the caching and repair are done, just call `act()`."
**Why it's wrong:** Stagehand's self-heal calls its own configured LLM client internally and updates its own cache file with no exposed hook proving *when* a healed action fires — which breaks two hard project constraints at once: "all Claude calls go through `ask-claude`" and "a repaired apply-step must reset confirmation." You'd be trusting an opaque library-internal event to drive a safety rule.
**Do this instead:** If Stagehand is used at all, use it purely as an execution primitive (disable its self-heal, or treat any exception from `act()` as the *only* failure signal) and keep repair, caching decisions, and confirmed-reset entirely in the project's own Repair loop — exactly as it would work against Playwright directly.

### Anti-Pattern 2: Caching a Claude-suggested step without executing it first

**What people do:** Trust the schema-valid step Claude returns and write it straight to the Site Plan Store to save a round trip.
**Why it's wrong:** A schema-valid selector can still be wrong (matches the wrong element, or nothing). Caching it blind means the *next* run replays a broken step with zero signal that anything needs fixing — worse than not caching at all, because it silently poisons the "second run = 0 Claude calls" success criterion.
**Do this instead:** Always execute the candidate for real via the Engine Adapter before writing it to the Site Plan Store (Pattern 1 above).

### Anti-Pattern 3: Treating `confirmed` as per-task state only

**What people do:** Store `confirmed` on the task and only reset it when *that* task's plan changes.
**Why it's wrong:** Site plans are shared across tasks. If task A's run triggers a repair to the site's `apply[]` steps, and task B (which shares the same site plan, unconfirmed or not) runs next, task B would auto-submit against a plan a human never actually watched succeed — exactly the failure mode the confirmation gate exists to prevent.
**Do this instead:** Repair loop fans the reset out to every task on the affected site (Pattern 2 above), not just the task that happened to trigger the repair.

## Integration Points

### External Services / Processes

| Integration | Pattern | Notes |
|---|---|---|
| `claude -p` CLI (headless Claude Code) | `child_process.spawn('claude', ['-p', prompt, '--output-format', 'json', ...])`, parse the single JSON result from stdout | Confidence LOW (web search, not official docs fetched): `--output-format json` returns one structured result object and exits; `stream-json` exists for multi-turn use but is not needed here since `ask-claude` is a single request/response per call. `--allowedTools`/`--max-turns` can constrain a scripted invocation for safety. |
| Browser profile directory (per site) | Playwright `launchPersistentContext(profileDir)` (or engine-equivalent) | `login` writes to it, `run` reads it; "profile locked" stop-condition is detected by the launch call failing/timing out because another process holds the profile. |

### Internal Boundaries

| Boundary | Communication | Notes |
|---|---|---|
| Runner ↔ Engine Adapter | Direct function calls (`execute(step)`, `getPageSummary()`) | This is *the* engine-neutrality seam. Nothing outside `engine/` should import Playwright or Stagehand types. |
| Runner/Repair loop ↔ `ask-claude` | Direct function call, typed request (`purpose`, redacted `pageSummary`) → typed response (validated `Step[]`) | No shared mutable state; `ask-claude` never touches the Task/Site Plan Store or the browser. |
| Repair loop ↔ Site Plan Store | Write-after-verify only | The only writer of plan files besides the initial cold-start plan generation. |
| Confirmation gate / Submit guard ↔ Task Store | Explicit named methods per transition (`setConfirmed`, `markSubmitAttempted`, `markDone`, `markNeedsCheck`) | Prevents illegal transitions (e.g. submitting a `needs-check` task) from being a convention instead of an enforced rule. |

## Engine Boundary: Where Stagehand vs Playwright-Direct Changes Things

Everything above this section is written to hold under either engine. Only the Engine Adapter (`engine/` folder) changes shape:

**Playwright-direct** (recommended default, per the design doc's own fallback rule):
- You implement `execute(step)` per step type yourself (`page.goto`, `page.click(selector)`, `page.fill`, `page.selectOption`, `page.waitForSelector`, `checkSlot` via locator text/attribute/count, `submit` click, `expectSuccess` via URL/text wait).
- You build `getPageSummary()` yourself (e.g. `page.accessibility.snapshot()` or a filtered/trimmed DOM serialization) — full control over what gets redacted before it ever reaches `ask-claude`.
- The project's own Site Plan Store **is** the cache; there's no second cache to reconcile with.
- Self-heal detection is trivial: your own Repair loop *is* the only thing that can heal a step, so "this was just healed" is a fact you already have, not something to infer from a library event.
- `login` uses `chromium.launchPersistentContext(profileDir)` directly.
- Cost: you own and maintain the step vocabulary, selector logic, and DOM/accessibility-tree filtering yourself — more code, but every constraint in this document is enforceable in first-party code with no library behavior to fight.

**Stagehand** (only if the Phase-1 spike clears all 4 design-doc gates):
- `act()`/`extract()`/`observe()` would replace the click/fill/select-ish step executors; Stagehand v3+ drives the browser over CDP rather than a plain Playwright `Page`, so `getPageSummary()` and step execution both go through Stagehand's API surface instead of raw Playwright.
- Stagehand exposes an abstract `LLMClient` interface and supports custom/OpenAI-compatible clients (MEDIUM confidence — confirmed in Stagehand's own docs surface), but no confirmed first-class adapter for a `claude -p` **subprocess** specifically (LOW confidence — not found in docs or issues); this would need to be built and would still have to route through `ask-claude` to satisfy the single-entry-point constraint, which pushes against Stagehand's own architecture (it expects to own LLM calls internally).
- Stagehand's own `cacheDir` + `selfHeal: true` caching **duplicates** the Site Plan Store and Repair loop conceptually. Running both means either disabling Stagehand's self-heal (treating Stagehand purely as "hands," with all judgment in this project's Repair loop) or accepting two independent, potentially inconsistent repair/cache systems. No documented callback exists to observe "Stagehand just healed this" from the outside (LOW confidence, web search only) — so the confirmed-reset signal would have to come from your own repair attempts, not Stagehand's.
- `act()` has no built-in automatic retry (MEDIUM confidence, docs-referenced) — so the "never retry submit" rule doesn't fight the library, but it also isn't provided by the library; it's still 100% the Submit guard's job either way.
- Net effect on this architecture: the Engine Adapter interface stays the same, but its Stagehand implementation would need to actively suppress/ignore Stagehand's native caching and self-heal to avoid a second, uncontrolled source of "the plan changed" — which mostly cancels out the reason to adopt it (less code to write) for this project's specific safety requirements.

## Sources

- `docs/designs/browser-automation.md` (approved design doc, project-internal, HIGH confidence — primary source for all component boundaries, the step schema, the safety rules, and the state machine)
- `.planning/PROJECT.md` (project constraints — `ask-claude` single-entry-point rule, redaction requirement, 30s minimum interval, no payment storage)
- Stagehand official docs referenced in search results: `docs.stagehand.dev/v3/basics/act`, `docs.stagehand.dev/examples/caching`, `docs.stagehand.dev/v3/configuration/models` (MEDIUM confidence — official doc URLs surfaced by web search, not fetched directly via MCP docs tool)
- Web search, general/community sources on Stagehand LLMClient customization, self-heal cache behavior, and `act()` retry behavior (LOW confidence — no MCP docs/context7 tool available in this environment; treat as spike-validation targets, not settled facts)
- Web search on Claude Code CLI headless mode (`claude -p --output-format json`) (LOW confidence — community guide sites, not Anthropic's own docs; should be re-verified against `claude --help` / official docs during implementation)
- Web search on `proper-lockfile` (npm, v4.1.2) for the per-site lock implementation (MEDIUM confidence — npm registry page)

---
*Architecture research for: Hybrid browser-automation CLI (reservation/application domain)*
*Researched: 2026-09-23*
