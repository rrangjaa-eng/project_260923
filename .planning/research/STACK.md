# Stack Research

**Domain:** Personal CLI browser-automation tool (reservation/booking) — hybrid deterministic-replay + on-failure-LLM engine
**Researched:** 2026-09-23
**Confidence:** HIGH (engine verdict verified against the actual shipped `@browserbasehq/stagehand@4.1.0` type declarations and README, pulled directly from the npm tarball; supporting-library versions verified against `registry.npmjs.org`)

## Engine Verdict: Direct Playwright (not Stagehand)

**Verdict: Build directly on Playwright. Do not adopt `@browserbasehq/stagehand`.**

### How the verdict was reached

`docs.stagehand.dev`, `deepwiki.com`, and `github.com`'s API were all blocked by the sandbox's egress proxy, so official prose docs could not be fetched. Instead I downloaded the actual published package (`registry.npmjs.org/@browserbasehq/stagehand/-/stagehand-4.1.0.tgz`, current `latest` as of 2026-09-23) and read its shipped `dist/index.d.mts` type declarations and `README.md` directly — this is a stronger source than docs prose because it's the literal contract the code ships with. Findings below are evidence, not inference.

### The four gate criteria, checked against v4.1.0 source

**(1) Can `claude -p` be the LLM, wrapped as a custom client? — Technically yes, but fights the grain.**
v4 replaced the old `LLMClient` abstract class with a typed `ClientLLM` callback (`ClientLLMSchema`, `generate` function) that the SDK docstring explicitly calls "An LLM callback implemented locally by the SDK consumer. It never crosses the wire." You register it via `model: { source: "client" }` at `Stagehand.create()`/`stagehand.init`. So the extension point genuinely exists and never requires a Browserbase/OpenAI/Anthropic API key.
The catch: `generate`'s contract is not a simple chat-completion. Its `messages` are an MCP-sampling-shaped structure with `text` / `image` / `tool_use` / `tool_result` content blocks (`annotations.audience`, `priority`, `lastModified` — literally MCP's sampling schema), and act()/observe()/extract() expect the callback to return specific `tool_use` blocks matching Stagehand's *internal*, unpublished tool schemas (those prompts/schemas are compiled into `dist/index.mjs`, not part of the public type surface). `claude -p` is a coding-agent CLI, not a raw completion endpoint — it has its own system prompt, its own tool-use loop, and a strong pull toward prose/tool-use rather than emitting one bare, exactly-shaped JSON `tool_use` block. Making `claude -p --output-format json` reliably satisfy this contract requires writing and maintaining a translation adapter against an *undocumented* internal schema, with no prior art (a search for existing "Stagehand + Claude Code CLI" integrations returned nothing). Verdict on this criterion alone: possible, but high-effort, unofficial, and brittle across Stagehand version bumps. Confidence: MEDIUM (extension point exists, HIGH) / LOW (that it stays robust in practice).

**(2) Can we detect a self-heal to clear the "confirmed" flag? — Yes, but the signal is Browserbase's server-side cache, and it's redundant with our own design.**
Every `act()`/`observe()`/`extract()` result carries a typed, always-present `cacheMetadata: { status: "HIT" | "MISS" | "DISABLED", missReason?, tokensSaved?, ... }` (confirmed in the shipped types, doc-commented "Cache observability for one act/observe/extract call… a miss carries why it missed"). A `MISS` on a step that previously produced a `HIT` is a clean, typed signal that fresh inference ran. Good news, except: this cache is explicitly **server-side, hosted on Browserbase's servers** (confirmed via the `4.1.0` release notes and the SDK's hard dependency on `@browserbasehq/sdk`), not a local disk cache — v4's changelog explicitly says the old *local* `enableCaching` option was removed and replaced by this server-side mechanism. Whether it degrades gracefully (reports `DISABLED`) or silently requires a Browserbase account/API key to do anything useful when running a fully local browser + client LLM is not resolvable from the public type surface, and the primary docs that would confirm this are the ones the sandbox blocked. This matters because it directly touches the "Max 요금제 안에서, 평소 비용 0원" constraint: if the cache needs a Browserbase account, that's a second paid dependency beyond Claude Max. More importantly — **our own design already needs its own plan-JSON cache** (`search`/`apply` steps saved to a per-site plan file, per `docs/designs/browser-automation.md`), independent of any engine. Detecting "this step needed repair" is then just "our step failed → we called `ask-claude` to fix it → it worked → we re-save that step" — an app-level fact we already produce ourselves, with no dependency on Stagehand's internal cache metadata at all. Confidence: MEDIUM that Stagehand's own signal is usable standalone (account dependency unverified); HIGH that we don't need it because our design already tracks this itself.

**(3) Can we guarantee a submit click is never re-executed after failure? — Yes, engine-agnostic, if we bypass the AI wrapper for that one step.**
The type declarations contain **no** `retry` / `retries` / `attempts` field anywhere in `act()`'s params or the constructor — confirmed by grepping the full 5,042-line declaration file. This matches a Stagehand-published example that manually hand-rolls retry/backoff *around* `act()`, implying the SDK itself doesn't auto-retry a failed action. That said, "self-heal" (a boolean `selfHeal` option, on by default) means an element-resolution failure inside a single `act()` call could plausibly trigger one internal re-resolution + re-click before surfacing as failure — this specific internal behavior isn't verifiable from the public types, and the docs page that would state it (`docs.stagehand.dev/v4/basics/act`) was blocked. The safe, verifiable mitigation is the same regardless of engine: never route the `submit` step through an AI-driven "figure out the click for me" call. Resolve the submit selector once (during planning/recovery, no side effects), record "제출 시도" to disk, then fire the click via the deterministic, non-AI primitive — Stagehand's own README recommends exactly this pattern for its own "Locator" API ("Use locators for deterministic Playwright-style actions: `await page.locator(actions[0].selector).click()`"), and plain Playwright's `page.locator(selector).click()` gives the identical guarantee with a fully documented, non-experimental API. Confidence: HIGH — this criterion is satisfiable either way, so it isn't a reason to pick Stagehand.

**(4) Can page content be masked before it reaches the LLM? — Only partially built-in; the real filter has to be ours regardless of engine.**
There is a genuine built-in `mask: Locator[]` option (found twice in the types, on screenshot-related config) that visually blacks out chosen elements before a screenshot is captured — useful for the *vision* channel. But the accessibility-tree *text* that Stagehand also sends alongside the screenshot (confirmed: "Stagehand includes a PNG screenshot… along with the page accessibility tree") has no redact/sanitize/PII option anywhere in the types — a filled `<input value="홍길동">` would still appear as plain text in that tree. Nothing in the SDK offers to filter that. The only place this can actually be enforced is inside whatever function sits between "raw page content" and "bytes sent to the model" — which, per our own design (`docs/designs/browser-automation.md`: "실행기가 현재 페이지의 요약… 목적을 `ask-claude`에 넘기고"), is **our own code**, not Stagehand's. If we build `ask-claude` ourselves (required regardless of engine, since `claude -p` must be the transport), we already own the point where real name/phone values get replaced with `{{name}}`/`{{phone}}` before anything leaves the process — identical effort whether the page summary underneath came from Playwright's accessibility snapshot or Stagehand's. Confidence: HIGH that this is achievable, but it's achieved by *our* code, not by adopting Stagehand.

### Why this tips to Playwright, not just "Stagehand passes narrowly"

The deciding factor isn't that any single criterion fails outright — it's that **our design's `ask-claude` + plan-JSON architecture already reimplements exactly what Stagehand's headline feature (natural-language `act()`/`observe()` with built-in cache + self-heal) provides**, at the plan-step level, through our own `claude -p` boundary. Once that's true, adopting Stagehand buys us:
- A CDP-only browser driver, not actually Playwright (v3+ dropped Playwright entirely for direct CDP — despite "Playwright-style" naming, `page.goto`/`page.locator` are a Stagehand reimplementation, not the real library, so none of Playwright's documentation, community answers, or `codegen`/trace-viewer tooling transfers directly)
- A hard dependency on `@browserbasehq/sdk` and, for the one feature (`cacheMetadata`) we might actually have wanted, ambiguous reliance on Browserbase's cloud
- An unofficial, adapter-heavy integration for `claude -p` against an undocumented internal tool-call schema, for a natural-language layer (`act`/`observe`) our design doesn't end up calling in the main loop anyway (the design's `ask-claude` already returns explicit plan steps, not natural-language instructions for Stagehand to interpret)
- A very young major version (v4 published this month, per npm — a "protocol-first monorepo" rewrite with active schema churn: e.g. `LanguageModelV2`→`V3` migrations mid-cycle in the AI SDK client) — higher breakage risk for a tool one person maintains solo

against Playwright, which is mature (`playwright@1.63.0`), has the actual accessibility-tree/DOM snapshot APIs, `locator().click()` determinism, `launchPersistentContext`/`storageState` for the `login <site>` reuse requirement, and doesn't require building an adapter for anything — we write `ask-claude` once, feed it a page summary we already control, and get back plan-JSON steps we execute with well-documented Playwright calls.

This confirms — with evidence, not just the earlier unverified guess — the direction `docs/designs/browser-automation.md`'s own "Next Steps" already leaned toward ("스택 확정: TypeScript + Playwright 제안").

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | strict mode (repo rule) | Language | Fixed by repo constraint; strict + no `any` catches malformed plan-step handling before it reaches a browser action |
| Node.js | ≥22.18 LTS line | Runtime | Matches what Playwright/Stagehand both target in 2026; has stable `fs` atomic-write primitives and native TS type-stripping available if ever needed for scripts |
| pnpm | (repo rule) | Package manager | Fixed by repo constraint |
| playwright | ^1.63.0 | Browser engine (goto/click/fill/locator, persistent context, accessibility snapshot) | See verdict above. Use the **core `playwright`** package (not `@playwright/test`) since this is a CLI, not a test suite — `@playwright/test` is only needed as a dev dependency if you want Playwright's own test runner, which we don't (vitest is our test runner, see below) |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@clack/prompts` | ^1.8.1 | Interactive terminal prompts with pick-lists | `task new`'s form: `select`/`multiselect`/`groupMultiselect` for date, people count, check-interval (1/3/5/10분), deadline. Actively maintained (published 2026-09-13), minimal dependency footprint, excellent keyboard-driven pick-list UX — the same style already asked for in the design brainstorm ("내가 질문에서 선택할 수 있게 하라고") |
| `zod` | ^4.6.5 | Schema validation of the plan JSON, task JSON, and `ask-claude` output | Validate the site-plan format (`search`/`apply` steps: `goto`/`click`/`fill`/`select`/`waitFor`/`checkSlot`/`submit`/`expectSuccess`) both when loading from disk and when a Claude-repaired step comes back — the design explicitly requires "형식 검사" before ever saving a repaired step. Also gives you `z.infer<>` types for free, keeping strict-TS honest without hand-written interfaces drifting from validation |
| `execa` | ^10.0.1 | Spawning `claude -p` as a child process | Optional but recommended over raw `node:child_process`: promise-based, no `shell: true` needed (avoids shell-injection surface when interpolating page summaries into the prompt), clean stdout/stderr capture, good timeout/kill handling — useful since `ask-claude` needs to bound how long it waits on a `claude -p` call during a live slot-check race |
| `commander` | ^15.0.0 | CLI subcommand parsing (`task new`, `login <site>`, `run <task>`, `task resolve <task>`) | Small, fixed set of subcommands; commander is the de facto standard, zero-surprise choice — no need for a heavier framework (oclif, yargs) for four commands |

### Local File Storage (tasks, plans, logs)

**No library — plain `node:fs/promises` + `zod`.** This is a personal, single-user tool with a handful of JSON files (one per task, one per site plan, one append-only run-log). Pulling in a "local database" library (lowdb, nedb, etc.) would be exactly the kind of unrequested abstraction CLAUDE.md's Simplicity First rule warns against. Recommended pattern:
- Read: `JSON.parse(await readFile(path, 'utf8'))` → validate with the corresponding `zod` schema → typed object
- Write: write to `path + '.tmp'` then `rename()` to the final path (atomic on the same filesystem) so a crash mid-write never corrupts a task/plan file
- Logs: append-only newline-delimited JSON (one JSON object per run), written with `appendFile` — trivial to `tail`/`grep` by hand later, no query library needed

### Per-Site Lock File

**Hand-rolled, not `proper-lockfile`.** `proper-lockfile` (latest `4.1.2`) was last published 2021-01-25 — over five years stale with no ecosystem-standard replacement that's meaningfully better for this narrow a need. For a single-machine, single-user tool, the standard atomic-lock pattern is a ~20-line function:
1. `fs.open(lockPath, 'wx')` (exclusive create — throws `EEXIST` if the lock already exists) to atomically claim the lock, writing the current PID + timestamp into it
2. On `EEXIST`, read the existing PID and check liveness with `process.kill(pid, 0)` (throws if the process is gone) to detect and clear a stale lock left by a crashed prior run — this directly answers the design's "두 번째 `run`은 이유를 알리고 끝난다" requirement while also self-healing from a crash without manual cleanup
3. Release by `unlink`ing the lock file in a `finally` block

This avoids depending on an abandoned package for something this small, and matches the "no abstractions for single-use code" rule.

### Test Runner

| Tool | Purpose | Notes |
|------|---------|-------|
| `vitest` | ^5.0.1 | Unit/integration tests for plan-schema validation, lock logic, recovery-loop state machine, and mocked `ask-claude`/Playwright calls | Latest `major` (5.x) published 2026-09-15 under the `latest` npm tag (not a prerelease tag), native TS + ESM support with no config for a plain Node/TS project, fast watch mode — fits the TDD loop CLAUDE.md requires (`test-driven-development` skill: failing test → minimal implementation → refactor). Since it's a very fresh major version, pin the exact version in `package.json` rather than a loose `^5` range until a couple of patch releases land |

Lighter alternative if you want zero test-framework dependency at all: Node's built-in `node:test` + `node:assert/strict`, using Node 22's native TypeScript stripping (`--experimental-strip-types`) instead of a transform step. Viable, but weaker assertion/mocking ergonomics than vitest — recommend vitest as the default given this project will lean on TDD throughout.

## Installation

```bash
# Core
pnpm add playwright

# Supporting
pnpm add @clack/prompts zod execa commander

# Dev dependencies
pnpm add -D vitest typescript @types/node
pnpm exec playwright install chromium
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Playwright (direct) | `@browserbasehq/stagehand` v4 | If this later becomes a multi-site, high-volume agent product where natural-language `act()` across many unseen sites (no hand-written plan format) is worth the CDP lock-in, Browserbase account, and building/maintaining a `claude -p`→MCP-tool-call adapter. Not this project's shape today — see Engine Verdict above |
| `@clack/prompts` | `inquirer` (^14.2.2, also actively maintained) | If you need prompt types clack doesn't have out of the box (e.g. `editor`, `checkbox` with search) — inquirer is heavier but more feature-complete. `enquirer` (last published 2023) should be avoided — unmaintained |
| Hand-rolled lock file | `proper-lockfile` (^4.1.2) | If you'd rather have a dependency than ~20 lines of code and are comfortable with a 5-year-stale package; its stale-lock detection (mtime-based) is more configurable than the simple PID-liveness check above |
| `vitest` | `node:test` (built-in) | If you want strictly zero test-framework dependencies; accept weaker mocking/assertion ergonomics |
| `execa` | `node:child_process` (`execFile`) | If you want zero dependencies for process spawning; you lose the promise API and some safety conveniences, but it's entirely sufficient for a single `claude -p` invocation pattern |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `@browserbasehq/stagehand` | Server-side (Browserbase) caching for its headline self-heal feature with unverified free/offline behavior; CDP-only despite "Playwright-style" branding (not real Playwright, so Playwright docs/community answers don't transfer); requires an unofficial, undocumented-schema adapter to make `claude -p` satisfy its `ClientLLM` contract; very young v4 rewrite with active breaking churn; and its core value (cache + self-heal) duplicates what this project's own plan-JSON + `ask-claude` design already provides | Direct `playwright` |
| Claude Agent SDK / `claude --bare` | Both require an API key, violating the explicit constraint to use headless `claude -p` under the Max subscription with zero incremental API cost | `claude -p` spawned via `execa`/`child_process`, wrapped in one `ask-claude` function |
| `enquirer` | Unmaintained since mid-2023 | `@clack/prompts` |
| `proper-lockfile` as the default | Unmaintained since 2021 for a need this narrow | Hand-rolled `fs.open(path, 'wx')` PID lock |
| A local "database" library (lowdb, nedb, sqlite) | Unrequested abstraction for a handful of JSON files a single user reads/writes; adds a dependency and a query surface nothing in this project needs | Plain `fs/promises` + `zod`-validated JSON, atomic write-then-rename |
| `mcp__hearthbot__*` tools | Explicitly out of scope per this research's constraints | N/A |

## Stack Patterns by Variant

**If the roadmap later adds the "여러 곳 동시 감시" (multi-site concurrent watch) milestone:**
- Keep Playwright; run one browser context per site (already implied by the per-site lock file), not one shared context — avoids cross-site state bleed and keeps the per-site lock model consistent
- Because the current per-site lock design (one `run` per site at a time) generalizes cleanly to "one lock-checked worker per site running concurrently," no new libraries needed

**If `ask-claude` later needs to move from `claude -p` to the Anthropic API (per the design's stated escape hatch for speed):**
- Only the internals of the `ask-claude` function change (swap `execa` child-process call for an HTTP call); its signature (page summary + purpose in, plan steps out) and every consumer of it (recovery loop, planner) stay identical
- `zod` schemas validating the returned plan steps don't change either way — this is exactly why the design puts a single function boundary there

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `playwright@1.63.0` | Node ≥18 (project uses ≥22.18) | No known conflicts with `zod@4.6.5`, `@clack/prompts@1.8.1`, `execa@10.0.1`, or `commander@15.0.0` — all are independent, no shared peer-dependency constraints |
| `vitest@5.0.1` | Node ≥22.18 recommended | Very recently released major (2026-09-15); pin the exact version rather than `^5` until a few patch releases land |
| `zod@4.6.5` | — | Note for later: `@browserbasehq/stagehand@4.1.0` itself depends on `zod@4.4.3` — irrelevant once Stagehand is not a dependency, but worth knowing if this verdict is ever revisited |

## Sources

- `registry.npmjs.org/@browserbasehq/stagehand/-/stagehand-4.1.0.tgz` — downloaded and read directly: `dist/index.d.mts` (5,042 lines, full type surface: `ClientLLMSchema`, `CacheMetadataSchema`, `CacheStatusSchema`, `StagehandCreateOptionsSchema`, `ActionSchema`, `mask` options — grepped for `retry`/`retries`/`attempt`/`heal`/`redact`/`sanitize`/`pii`) and `README.md`. Confidence: HIGH — primary shipped source, not prose docs
- `registry.npmjs.org` — direct registry queries (reachable without proxy restriction) for every version number cited: `playwright` 1.63.0, `@playwright/test` 1.63.0, `@browserbasehq/stagehand` 4.1.0, `@clack/prompts` 1.8.1, `inquirer` 14.2.2, `enquirer` 2.4.1 (stale since 2023), `zod` 4.6.5, `proper-lockfile` 4.1.2 (stale since 2021), `vitest` 5.0.1, `commander` 15.0.0, `execa` 10.0.1. Confidence: HIGH
- WebSearch (multiple queries on Stagehand caching, self-heal, `claude -p` headless mode, terminal-prompt libraries) — used to form hypotheses that were then checked against the primary source above where possible. Confidence: MEDIUM/LOW standalone, upgraded to HIGH where corroborated by the shipped type declarations
- `docs.stagehand.dev`, `deepwiki.com`, `github.com` (API/raw) — blocked by the sandbox's network egress proxy during this research; official prose docs for `act()`'s exact internal retry/self-heal execution order (criterion 3's remaining open edge case) could not be directly fetched. Flagged as a gap below
- `docs/designs/browser-automation.md` and `.planning/PROJECT.md` — read directly for the project's own architecture, constraints, and the "Cross-Model Perspective" section that raised Stagehand as a candidate without having verified the four gate criteria

## Open Gap

Stagehand's exact internal behavior when a single `act()` call's element-resolution fails mid-click (does self-heal re-attempt the click itself, or only re-resolve-then-report-failure) could not be confirmed because `docs.stagehand.dev` was unreachable from this sandbox. This does not change the verdict — the recommended mitigation (deterministic `locator().click()` for the submit step, never an AI-driven wrapper) sidesteps the question entirely and applies equally under Playwright.

---
*Stack research for: personal browser-automation CLI (reservation/booking), hybrid deterministic-replay + on-failure-LLM engine*
*Researched: 2026-09-23*
