# Project Research Summary

**Project:** 브라우저 자동화 도구 (이름 미정) — personal reservation/booking watcher-and-submitter CLI
**Domain:** Hybrid browser-automation CLI: deterministic plan replay with on-failure LLM self-healing, applied to reservation slot-watching + auto-booking
**Researched:** 2026-09-23
**Confidence:** HIGH

## Executive Summary

This is a single-user CLI that watches a reservation site for an open slot matching saved criteria and finishes the submission automatically — but only through steps a human has actually seen succeed once. The domain splits into two existing tool families (alert-only watchers like CampNab/Recbot, and auto-booking snipers like resy_bot/AutoRes), and this project deliberately combines the sniper family's outcome (finish the submission) with the watcher family's caution (never act on an unseen step) — a combination neither family in the wild actually ships. The core technical bet, validated against real competitor behavior, is architecturally novel in this space: a one-time Claude-generated plan per site, cached to a local JSON file and replayed with zero LLM calls thereafter, with repair-on-failure that re-verifies a fix by executing it before ever caching it.

The stack research settled the project's single open engineering question with direct evidence rather than inference: **build on Playwright directly, not `@browserbasehq/stagehand`.** Stagehand's headline value (cached, self-healing natural-language actions) is what this project's own `ask-claude` + Site Plan Store architecture already reimplements at the plan-step level; adopting it would mean fighting an undocumented internal tool-call schema to wire in `claude -p`, taking on a CDP-only (not real Playwright) dependency and an unverified Browserbase cloud-cache requirement, and building suppression logic to keep its native self-heal from silently conflicting with the project's own confirmation-reset safety rule. Direct Playwright, TypeScript strict, `@clack/prompts`, `zod`, `execa`, and `commander` form a small, mature, dependency-light stack matched to a solo-maintained personal tool.

The biggest risks are not technical unknowns but safety-discipline failures around money-adjacent, non-idempotent actions: duplicate submission (no third-party site offers an idempotency key), a syntactically-valid-but-semantically-wrong LLM repair slipping past validation into a live submit, and session-expiry or bot-detection being misread as an ordinary step failure and silently burning the Claude repair budget. All three are addressed by patterns the approved design already commits to (pre-click "submit-attempted" breadcrumb, confirmation reset fanned out to every task sharing a repaired site plan, and dedicated first-class stop-condition checks that run before any repair attempt) — the research's main contribution is flagging exactly where the naive implementation of each pattern goes subtly wrong (e.g., a JSON-flag lock instead of a real OS-level lock; confirmation-reset keyed on step type instead of on any `checkSlot`/`apply` mutation) and insisting on a local fixture site so these paths are tested deliberately, never against the real target site.

## Key Findings

### Recommended Stack

TypeScript (strict) + Node ≥22.18 + pnpm are fixed by repo convention. The engine decision — the one real fork in the road — resolves to **direct `playwright` (^1.63.0)**, not Stagehand (see Executive Summary and `STACK.md`'s Engine Verdict for the full four-gate analysis). Supporting libraries are deliberately minimal: no local database, no `proper-lockfile` (5 years stale — hand-roll a ~20-line PID-liveness lock instead), just plain `node:fs/promises` + `zod` for atomic JSON read/write.

**Core technologies:**
- `playwright` ^1.63.0 — browser engine (goto/click/fill/locator, persistent context, accessibility snapshot) — mature, real Playwright docs/tooling apply, gives full control over redaction and step semantics
- `zod` ^4.6.5 — schema validation for task/plan JSON and every `ask-claude` response — the single gate that keeps a malformed or semantically-wrong repair from ever being cached
- `execa` ^10.0.1 — spawns `claude -p` without `shell: true`, with clean timeout/kill handling for the live repair path
- `@clack/prompts` ^1.8.1 — `task new`'s picker-first form UX
- `commander` ^15.0.0 — the four-command CLI surface (`task new`, `login`, `run`, `task resolve`)
- `vitest` ^5.0.1 (pinned exact, very fresh major) — TDD loop test runner

**What NOT to use:** `@browserbasehq/stagehand` (see verdict above), Claude Agent SDK / `claude --bare` (both require an API key, violating the zero-marginal-cost Max-plan constraint), `enquirer`/`proper-lockfile` (unmaintained), any local "database" library (unrequested abstraction for a handful of JSON files).

### Expected Features

The approved design (`PROJECT.md` Active requirements) already covers essentially every domain table-stakes item this research surfaced. No feature additions are recommended; the research instead confirms scope and flags one explicit, reasoned gap.

**Must have (table stakes) — all already scoped in v1:**
- Structured `task new` criteria form (site, date, party size, contact, interval, deadline)
- `login <site>` one-time login + persistent profile reuse
- `run <task>` interval polling loop with deadline stop and per-site lock
- Auto-submit on match, gated by first-run human confirmation
- Never-retried submit + ambiguous outcome → "확인 필요" + `task resolve`
- Stop conditions (CAPTCHA, new-payment screen, logged-out, Claude error, profile lock)
- Per-run activity log

**Should have (differentiators) — the actual product thesis:**
- Any-site generalization via one-time AI planning + cached deterministic replay — no tool surveyed (CampNab, resy_bot, restaurant-cli, etc.) does this; each is single-platform
- Explicit safety layer: first-run confirm, confirmation invalidated by any repaired step, never-retry-submit — no surveyed sniper tool describes anything like this; they optimize purely for speed
- Zero marginal AI cost after first successful run

**Defer (v1.x / v2+):**
- Outcome push notification (Discord/Slack/push) — explicitly deferred in the design (Open Question #2); acceptable while `run` is used in the foreground, but domain table-stakes for any unattended long-deadline use, so flag for a near-future milestone
- "Show me once" plan capture, multi-site simultaneous watch, company-task automation, mobile control, unified reservation hub — already correctly sequenced post-v1 in `PROJECT.md`

**Anti-features correctly excluded:** CAPTCHA/bot-detection bypass, proxy rotation/fingerprint spoofing, blind submit retry, payment-info storage, sub-30s polling, free-text/NLP task creation (all conflict with either the project's explicit constraints or its trust model).

### Architecture Approach

A five-layer system (CLI → Orchestration/Runner → Engine Adapter → Storage) with one deliberately narrow boundary function, `ask-claude`, as the sole entry point to any LLM call. The Engine Adapter is the only folder that would change shape if the engine decision were ever revisited; everything above it talks to `execute(step)`/`getPageSummary()`, never to `page.click()` directly. The Site Plan Store *is* the cache (no second cache to reconcile with, now that Stagehand is out), and it is only ever written after a repaired step has been executed for real and verified to succeed — never on a merely schema-valid suggestion.

**Major components:**
1. **Store layer** (Task Store, Site Plan Store, shared zod schemas) — pure filesystem CRUD, zero dependency on the engine; buildable and testable first
2. **`ask-claude`** — the only function that spawns `claude -p`; purpose-tagged (`search-plan`/`apply-plan`/`repair-step`) request/response, no browser access, no side effects
3. **Engine Adapter (Playwright direct)** — step executor for the 8 step types (`goto`/`click`/`fill`/`select`/`waitFor`/`checkSlot`/`submit`/`expectSuccess`) + page-summary extraction, which is also where redaction is enforced
4. **Repair loop** — cache-then-repair pattern: ask-claude → validate → execute-to-verify → write-back only on real success → fan out confirmation reset if `apply[]` was touched
5. **Confirmation gate + Submit guard** — the safety-critical seam; built and unit-tested in isolation with a fake Engine Adapter before wiring into the full Runner, since this is what the product's core value proposition actually rests on
6. **Stop-condition detectors** — pure classifier functions over the page summary, run every tick and specifically before `submit`
7. **Runner** — the loop itself (interval, deadline, per-site lock), assembled last from already-independently-tested parts

### Critical Pitfalls

1. **Duplicate submission / double booking** — no third-party site offers an idempotency key; the only lever is client-side discipline: a crash-safe, fsynced "submit-attempted" record written *before* the click, a real OS-level per-site lock (not a read-then-write JSON flag), and submit never wrapped in generic retry/backoff logic.
2. **Silent wrong booking after an LLM repair** — a repaired step can pass syntactic validation and "run successfully" while silently targeting the wrong slot/field, because validation checks "did it execute," not "does it still mean what the original step meant." Mitigation: confirmation-gate reset on *any* mutation of `checkSlot`/`apply`/`submit` (not just "trivial" ones), and show the user a diff of what changed, not just the final values.
3. **Session/login expiry misread as a generic step failure** — must be detected as its own first-class, high-priority check before any `ask-claude` repair call, or the repair loop will burn its budget hallucinating fixes against a login page.
4. **Bot detection/rate limiting from the watch loop itself** — even polite, non-evasive polling is behaviorally distinguishable from a human. Add small jitter (±10-15%) within the existing 30s floor/1min default, and prefer headed over headless mode — this is politeness, not the evasion the design explicitly excludes.
5. **`claude -p` operational risks bundled at the `ask-claude` boundary** — latency (repair round-trip losing a fast-moving slot), shared usage-limit pool with interactive Claude Code use, malformed/non-JSON output, and prompt injection from untrusted page content — all four must be handled inside `ask-claude` itself, since nothing else in the executor can catch them.

## Implications for Roadmap

Based on combined research, suggested phase structure (dependency order matches `ARCHITECTURE.md`'s Suggested Build Order, condensed to roadmap-level phases; the engine question it lists as an open spike is already resolved by `STACK.md`'s verdict, so no separate spike phase is needed):

### Phase 1: Data Foundations + Fixture Site
**Rationale:** Every other component depends on the task/plan schemas, and `PITFALLS.md` Pitfall 11 is explicit that repair/stop-condition/submit-safety behavior must never be developed against the real target site — the fixture site needs to exist before that work starts, not be retrofitted after.
**Delivers:** Task Store, Site Plan Store, shared `zod` schemas (Task, SitePlan, Step), atomic JSON read/write; a minimal local fixture app (slot-listing page, form, submit button, toggles for slot count / CAPTCHA / session-expired-redirect / ambiguous-hung-submit).
**Addresses:** Structured `task new` input (table stakes).
**Avoids:** Pitfall 11 (testing against real sites), Pitfall 6 (date/timezone — schema should carry the site's literal date-string format, not a `Date` round-trip).

### Phase 2: `ask-claude` Boundary
**Rationale:** Isolated, engine-independent, and the single chokepoint every LLM-related risk funnels through — buildable and unit-testable (mocked `claude -p`) before any browser code exists.
**Delivers:** `ask-claude()` with purpose-tagged prompts (`search-plan`/`apply-plan`/`repair-step`), schema-validated responses, pattern-based redaction pass over the full outgoing payload, usage-limit error detection.
**Addresses:** Any-site generalization differentiator.
**Avoids:** Pitfall 8 (latency/usage-limits/malformed-output/injection), Pitfall 9 (PII leakage beyond the task's own fields).

### Phase 3: Engine Adapter (Playwright Direct)
**Rationale:** Depends on the schema from Phase 1 and the (already-settled) engine decision from `STACK.md`; nothing about the browser needs to exist before Phase 2, so this can follow or run in parallel with it.
**Delivers:** `EngineAdapter` interface + `playwright-adapter.ts` implementing the 8 step types, `getPageSummary()`, `launchPersistentContext(profileDir)` for `login`.
**Uses:** `playwright` ^1.63.0.
**Implements:** Engine Adapter component (the only folder that stays engine-neutral in fact, not just intent).
**Avoids:** Pitfall 5 (persistent profile locking — stale-lock auto-recovery vs. live-lock refusal, always closed in a `finally`), Pitfall 7 (SPA loading-state races — `checkSlot` needs a readiness signal beyond element-attached).

### Phase 4: Repair Loop + Confirmation Semantics
**Rationale:** Wires Phases 1–3 together into the cache-then-repair pattern that is the product's actual technical thesis; must be co-designed with confirmation logic per `PITFALLS.md`, not built independently.
**Delivers:** Repair loop (ask-claude → validate → execute-to-verify → write-back), confirmation-reset fan-out to every task sharing a repaired site plan.
**Addresses:** Step-level self-heal with bounded retries (2/step, 5/run), confirmation-invalidation requirement.
**Avoids:** Pitfall 2 (silent wrong booking after repair) — the single most safety-critical pitfall in this research; requires a diff shown to the user and reset keyed on *any* `checkSlot`/`apply` mutation, not step type.

### Phase 5: Safety-Critical Path (Stop Conditions, Confirmation Gate, Submit Guard)
**Rationale:** Per `ARCHITECTURE.md`'s build order, this is deliberately built and tested in isolation with a fake Engine Adapter before wiring into the full Runner loop, since this is what the Core Value ("절대 제출하지 않으면서") actually rests on.
**Delivers:** Stop-condition detectors (CAPTCHA, new-payment screen, logged-out, Claude error, profile lock, bot-block), confirmation gate (y/n, 5-min timeout), submit guard (pre-click breadcrumb, never-retry, outcome classification).
**Addresses:** Duplicate-submission guard, stop-condition table stakes (all P1 in `FEATURES.md`).
**Avoids:** Pitfall 1 (duplicate submission — highest-severity, unrecoverable if it occurs), Pitfall 3 (session-expiry misread as generic failure), Pitfall 4 (bot detection — add polling jitter here).

### Phase 6: Runner + CLI
**Rationale:** Deliberately last among non-CLI components so it assembles stable, independently-tested parts rather than being where bugs are first discovered; CLI commands are thin orchestration once the Runner exists.
**Delivers:** Interval/deadline loop wiring Phases 2–5 together; `task new`, `login`, `run`, `task resolve` commands; run log.
**Addresses:** Remaining table-stakes features (recurring polling, deadline/auto-stop, run/activity log).

### Phase 7: Real-Site Validation
**Rationale:** `PROJECT.md` leaves the first target site unresolved (Open Question #1), and `PITFALLS.md` Pitfall 10 requires a ToS/automation-clause review as part of site selection, not an afterthought once building has started; this must happen after the fixture-site suite passes, not before.
**Delivers:** Chosen first target site (documented ToS review), end-to-end run validating the design doc's success criteria (cold-start plan generation, zero-Claude-calls on second run, selector self-heal + persistence, confirmation reset on apply-step repair, all stop conditions, no-retry-on-ambiguous-submit).
**Addresses:** Final product validation.
**Avoids:** Pitfall 10 (ToS/legal exposure) — prefer lower-stakes reservation categories (small local venues, camping) over major ticketing platforms subject to statutes like the BOTS Act.

### Phase Ordering Rationale

- Store layer and `ask-claude` are ordered first because both are provably engine-independent (`ARCHITECTURE.md`'s Structure Rationale) — this lets schema and LLM-boundary work start immediately without waiting on any browser decision, and that decision is already made (`STACK.md`).
- The Repair Loop is ordered before the Confirmation Gate/Submit Guard phase because the safety-critical phase needs to know "was `apply[]` just repaired" as an input it can test against with a fake adapter — building it after gives Phase 5 something real to integrate rather than a stub.
- The Runner is last among engine/logic components specifically so it has independently-tested parts to assemble, per `ARCHITECTURE.md`'s explicit reasoning — this avoids debugging the safety-critical logic *and* the loop/interval mechanics simultaneously.
- Real-site validation is last and gated on both technical readiness (fixture-site suite passing) and a non-technical precondition (ToS review, site selection) that the research flags as still open in `PROJECT.md`.

### Research Flags

Needs deeper research during planning:
- **Phase 2 (`ask-claude` boundary):** `claude -p --output-format json`'s exact contract, usage-limit error signature, and `--allowedTools`/`--max-turns` behavior were only confirmed via web search (LOW confidence per `ARCHITECTURE.md`/`PITFALLS.md`), not official docs (blocked by sandbox egress). Verify against `claude --help` / live behavior early in this phase.
- **Phase 7 (real-site validation):** Site-specific research is required once a target is chosen — DOM shape, date/URL literal formats, ToS automation clause, and actual bot-detection posture are all unknowns until a specific site is picked (Open Question #1 in `PROJECT.md` is still unresolved).

Standard patterns (skip formal research-phase, rely on TDD + design doc):
- **Phase 1 (data foundations):** Plain `fs/promises` + `zod` CRUD and a static-HTML fixture app are well-understood, low-risk patterns.
- **Phase 3 (Engine Adapter):** Direct Playwright has mature, complete official documentation; no open questions remain after the Stack research's engine verdict.
- **Phase 4–6 (repair loop, safety path, runner):** Fully specified by the approved design doc's own state machine and step schema (`docs/designs/browser-automation.md`); the work here is disciplined implementation of already-settled rules, not new research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Engine verdict verified against the actual shipped `@browserbasehq/stagehand@4.1.0` type declarations and README (downloaded from npm, not inferred from docs prose); all supporting-library versions verified directly against `registry.npmjs.org` |
| Features | MEDIUM | Based on public GitHub READMEs and vendor marketing pages for competitor tools (CampNab, resy_bot, AutoRes, etc.) — self-reported feature lists, not independently verified by direct use; HIGH confidence specifically on what the approved design already commits to |
| Architecture | HIGH for component boundaries and state machine (derived directly from the approved, settled design doc) / LOW-MEDIUM for Stagehand- and `claude -p`-specific claims (web search only, official docs blocked by sandbox egress) |
| Pitfalls | MEDIUM | Cross-checked against multiple web sources (Playwright GitHub issues, bot-detection vendor docs, legal/statute references); project-specific severity judgments are LOW-confidence extrapolation from the design doc, not externally verified against this project's actual behavior |

**Overall confidence:** HIGH — the one genuinely open engineering question (engine choice) was resolved with primary-source evidence, and the architecture/safety patterns are pinned to an already-approved design doc rather than inferred from scratch.

### Gaps to Address

- **First target site is still unresolved** (`PROJECT.md` Open Question #1): blocks Phase 7 and its ToS review; should be resolved before that phase, not during it.
- **`claude -p` headless CLI's exact operational contract** (JSON output shape, usage-limit error signature, timeout behavior) was only checked via web search, not official Anthropic docs (blocked by sandbox egress in this research pass) — verify directly against `claude --help`/real invocations at the start of Phase 2 before the `ask-claude` schema is finalized.
- **Stagehand's exact internal self-heal retry behavior on a mid-click element-resolution failure** could not be confirmed (docs.stagehand.dev unreachable) — does not change the Playwright verdict (the mitigation, a deterministic `locator().click()` for `submit`, applies either way), but noted for completeness since it was the one unresolved sub-question in the engine analysis.
- **Outcome notification (Discord/Slack/push) is a known, explicitly deferred v1 gap**, not an unresolved research question — `FEATURES.md` flags it as domain table-stakes for any unattended, long-deadline use; revisit once `run` is used beyond foreground/attended sessions.

## Sources

### Primary (HIGH confidence)
- `registry.npmjs.org/@browserbasehq/stagehand/-/stagehand-4.1.0.tgz` — downloaded and read directly: `dist/index.d.mts` type declarations, `README.md`
- `registry.npmjs.org` — direct registry version checks for every library cited in `STACK.md`
- `docs/designs/browser-automation.md` — approved project design doc (primary source for architecture, step schema, safety rules, state machine)
- `.planning/PROJECT.md` — Core Value, Active requirements, constraints, Key Decisions

### Secondary (MEDIUM confidence)
- Competitor tool READMEs/pages: CampNab, Recbot, webrender/campsite-checker, restaurant-cli, restaurant-mcp, lost-dinosaur/resy_bot, al3xisrobles/resbot, AutoRes
- Playwright persistent-context GitHub issues (#35466, #5258, #19499) — profile lock/corruption behavior
- Cloudflare bot-detection docs, headless-browser-detection vendor writeups
- BOTS Act (Wikipedia) — legal/statute context for ToS risk reasoning
- Stagehand caching docs / Browserbase blog (referenced via web search, not fetched directly)

### Tertiary (LOW confidence)
- Web search on `claude -p --output-format json` headless CLI behavior — community guide sites, not Anthropic's own docs; flagged for re-verification during Phase 2
- Web search on Stagehand's internal self-heal retry order on element-resolution failure — unresolved, does not affect the engine verdict

---
*Research completed: 2026-09-23*
*Ready for roadmap: yes*
