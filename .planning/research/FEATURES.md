# Feature Research

**Domain:** Personal reservation slot-watching + auto-booking CLI (campsite/restaurant/ticket-style watchers and booking macros)
**Researched:** 2026-09-23
**Confidence:** MEDIUM — based on public GitHub READMEs, vendor marketing pages, and community writeups for existing watcher/sniper tools (self-reported feature lists, not verified by direct use); HIGH confidence on what the approved design already commits to.

## Feature Landscape

The domain splits into two families that this project deliberately straddles:

1. **Alert-only watchers** (CampNab, Recbot, campsite-checker) — poll a site/API, notify a human, never submit. Explicitly state they "cannot make the reservation for you."
2. **Auto-booking snipers** (resy_bot, AutoRes, Open-Table-Bot, restaurant-cli) — wake at a known release time, submit automatically, optimize for speed at the moment of drop.

This project's Core Value ("찾으면 사람이 보지 않은 단계로는 절대 제출하지 않으면서 신청까지 자동으로 끝낸다") sits deliberately between these: it commits to the auto-booking family's outcome (finish the submission) while importing the alert-only family's caution (never act on an unseen step) — a combination neither family in the wild actually offers.

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Structured criteria input (site, date, party size, contact info) | Every watcher/sniper tool (CampNab, resy_bot, restaurant-cli) takes a saved search, not a one-off click | LOW | v1: `task new` form with picking over typing — already scoped |
| Session/login reuse across checks | No tool in this space re-authenticates on every poll; that would be both slow and suspicious to the target site | LOW–MEDIUM | v1: `login <site>` opens a browser once, profile folder persists state — already scoped |
| Recurring availability polling on an interval | This is the entire premise of "watcher" tools; every example found (CampNab, recbot, resy_bot's daemon) polls on a schedule | LOW–MEDIUM | v1: `run` loop with interval — already scoped. Design's 30s-minimum/1min-default interval is stricter courtesy than most scrapers bother to set |
| Deadline / auto-stop | Watches are bounded — a camping trip date passes, an event happens. Open-ended polling is what gets tools rate-limited/banned | LOW | v1: deadline on `run` — already scoped |
| Auto-submit on match | The auto-booking half of the domain (resy_bot, AutoRes, restaurant-cli's "sniper") exists specifically because alert-only tools (CampNab, recbot) fall short of this — users graduate to sniper tools precisely to skip the "click through manually before it's gone" step. This is also this product's stated Core Value, so it is non-negotiable for this project even though it's a differentiator relative to the wider watcher market | HIGH | v1: `run`'s apply phase + submit — already scoped |
| Duplicate-submission guard | Reservation/ticket sites do not idempotently handle repeat submits; blind-retry-until-success (common in naive scraping scripts) risks double-booking or duplicate charges. No credible tool in this space claims to retry submits freely | MEDIUM | v1: "submit attempt" record + never-retry + `task resolve` for ambiguous outcomes — already scoped, and stricter than most sniper bots (which usually just retry until a 2xx) |
| Run/activity log | Every scheduled/daemon-style tool in this space (resy_bot's "background daemon", recbot's scan history) keeps some record of what happened, since the user isn't watching in real time | LOW | v1: per-run log of actions, stop reason, Claude call count — already scoped |
| Outcome notification | Sniper tools researched (resy_bot) support Discord/Slack/Pushover/Ntfy webhooks specifically because the user is not staring at a terminal when a slot drops at 3am | LOW–MEDIUM | **Gap in v1**: design defers this to terminal output + run log only (Open Question #2, explicitly deferred). Flagging for roadmap: this is domain table-stakes the design knowingly ships without in v1 — acceptable for a single-user CLI run in foreground, but worth revisiting once `run` is left unattended for long deadlines |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|--------------------|------------|-------|
| Any-site generalization via one-time AI planning + cached replay | Every tool surveyed is single-site (resy_bot = Resy only, campsite-checker = recreation.gov only, restaurant-cli plugins = one platform each). This project's "Claude plans once, executes deterministically forever after" (Stagehand-style cache) is the actual novel bet — no hand-written macro per site | HIGH | Already the design's stated differentiator #1 ("어떤 사이트든"). Directly validated against Stagehand's real architecture in the design doc's Landscape section |
| Explicit safety layer around auto-submit (first-run confirm, confirmation invalidated by any step repair, never-retry + manual resolve) | Sniper bots in the wild (resy_bot, Open-Table-Bot) optimize purely for speed — none of the surveyed tools describe a "confirm once, then re-confirm if the AI changed anything before your next submit" safety valve. This is the domain-specific trust mechanism that makes "AI plans, then AI-modified code submits unattended" acceptable for money-adjacent actions | MEDIUM | Design's #3 stated differentiator ("안전하게 자동") — already scoped in full across first-run confirmation, submit rules, and stop conditions |
| Zero marginal AI cost after first successful run | Sniper tools either don't use AI at all (pure scripted API calls) or (hypothetically) would re-invoke an LLM every poll, which is both costly and slow for the repeated availability check. Caching to zero Claude calls after the first successful plan is a real cost/speed edge over a "full AI agent per check" design | LOW (given the plan-cache is already required for differentiator #1) | Design explicitly rejected "완전 AI 에이전트" for this reason |
| (Post-v1, not to build now) Show-me-once training, multi-site simultaneous watch, unified booking hub | Roadmap-listed future differentiators; no tool surveyed does "record a human doing it once, turn that into a plan" — closest analog is browser-use/workflow-use's record-and-replay, which is a good precedent but still early-stage per the design's own Landscape research | — | Do not pull forward into v1; listed here only to confirm no v1 feature accidentally forecloses them |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| CAPTCHA solving / bot-detection bypass | Real ticket-bot tooling treats this as standard (OCR/AI solvers, $0.001–0.003/solve, fallback to human solvers) — it feels like "just another blocker to engineer around" | Explicitly excluded by project constraints; also the highest-risk category legally/ethically in the domain (BOTS Act 2016 exists specifically for this pattern) and the design already treats CAPTCHA as a hard stop, not a puzzle to solve | Stop and log when a CAPTCHA/bot-detection screen appears (already in design's "멈추는 경우") |
| Proxy rotation / fingerprint spoofing / multi-account pools | Standard in scalper-grade ticket bots (50+ residential IPs, per-session fingerprint rotation) to survive rate limits at scale | This tool serves one person making one legitimate reservation, not defeating anti-scalping defenses at volume; adopting these tactics would turn a "polite single watcher" into the exact abusive traffic pattern the design's site-courtesy constraint (≥30s interval) is trying to avoid | Single browser profile, single identity, conservative polling interval — already the design's approach |
| Blind retry of ambiguous/failed submit | The naive/default behavior in most scraping scripts ("if not success, try again") because it maximizes chance of winning a race for a scarce slot | Directly causes duplicate bookings/charges on sites that don't dedupe idempotently — the single most dangerous failure mode for a tool that touches money and personal commitments | Never-retry-submit + "확인 필요" state + `task resolve` — already the design's core safety rule |
| Storing or auto-filling payment card details | Some auto-booking flows (event/ticket bots) go all the way through payment to guarantee the win | Explicit project exclusion (security); also the design's own boundary for "meaningfully automated" — new payment-info screens are a hard stop, not a fill-in target | Only complete reservations against site-saved payment methods; stop and log when a new-payment-info screen appears (already in design) |
| Sub-30-second polling / aggressive refresh | Faster polling = smaller chance of missing a slot in a hot race (this is literally why "smart sniping with connection pre-warming" exists in resy_bot) | Violates the project's explicit site-courtesy constraint and increases detection/ban risk for no benefit in the non-drop-time, no-refresh-race domains (camping/general restaurant availability) this tool targets first | 30s floor / 1min default interval — already the design's constraint |
| Scheduler/cron daemon, multi-user web UI, mobile control | resy_bot ships a "background daemon" and web interface; users naturally ask "why do I have to run this by hand?" | Explicit v1 out-of-scope — adds process-management, auth, and multi-surface complexity to what's currently a single command a single person runs on their own machine; premature before the core engine (plan/cache/repair/safety rules) is proven on one real site | One-shot `run` invoked manually or via the user's own OS scheduler later, once the core loop is trusted — already the design's stated post-v1 order |
| Free-text/NLP task creation ("tell it what you want in a sentence") | Feels more natural than filling a form, and several restaurant-mcp/CLI tools lean on chat-style interfaces | This system's entire trust model depends on structured, validated inputs feeding a plan format the executor can run deterministically without re-interpreting intent each time; free text reintroduces ambiguity exactly where the design goes out of its way to remove it (see: never-submit-on-unseen-step) | Picker-first structured form (`task new`), with a single free-form "other site-specific value" escape hatch — already the design's approach |

## Feature Dependencies

```
Structured task input (task new)
    └──requires──> Plan format (search/apply step schema)
                       └──enables──> Self-heal/repair on failure
                       └──enables──> Any-site generalization (first-run Claude plan)

Session reuse (login)
    └──requires──> Browser profile persistence
    └──enables──> Unattended polling (run)

Auto-submit on match
    └──requires──> Deadline/stop condition (else runs forever)
    └──requires──> Duplicate-submission guard (else double-books)
    └──requires──> First-run confirmation (else unsafe on an unseen plan)

First-run confirmation
    └──requires──> Per-task "confirmed" state
                       └──reset-by──> Any repair to checkSlot/apply steps (confirmation invalidation)

Duplicate-submission guard (never-retry-submit)
    └──produces──> Ambiguous "확인 필요" outcomes
                       └──requires──> task resolve (only way to unstick a task after ambiguous submit)

Run log
    └──requires──> Stop-condition detection (CAPTCHA, payment screen, session loss, Claude error, profile lock)
                       └──else log entries have nothing meaningful to record

Outcome notification (Discord/SMS/push) ──enhances──> Run log
    (not in v1; log substitutes for it while the tool is run in foreground)

CAPTCHA/proxy/fingerprint bypass ──conflicts──> Site-courtesy constraint (≥30s interval, single identity)
Blind submit retry ──conflicts──> Duplicate-submission guard
```

### Dependency Notes

- **Auto-submit requires deadline + duplicate-submission guard:** without a deadline, `run` has no exit condition; without the guard, a match found while a previous submit's result is unclear would double-book. Both are already load-bearing in v1's scope, not addable later.
- **First-run confirmation requires per-task confirmed-state, and that state is reset by repair:** this is the mechanism that makes "AI can rewrite the apply/checkSlot steps" safe. If confirmation state isn't wired to repair events, the safety differentiator silently degrades into "confirm once, ever" — a materially weaker guarantee than the design commits to. Worth an explicit test case at build time.
- **Duplicate-submission guard produces ambiguous outcomes, which only `task resolve` can clear:** these two are one feature split across two commands. Shipping the guard without `task resolve` would leave the user with tasks permanently stuck in "확인 필요."
- **Outcome notification enhances but doesn't replace the run log:** for v1 (foreground, single run, bounded deadline), the log is sufficient per the design's own Open Question #2 answer. This dependency note exists so that if a later phase extends deadlines to "walk away for hours," notification gets pulled forward rather than assumed already covered by table-stakes status.
- **CAPTCHA/proxy/fingerprint bypass conflicts with the site-courtesy constraint:** these are the same "make it look less like a bot" impulse that ticket-scalping tooling leans into. The project's own constraints (30s floor, no bypass, single profile) are the correct boundary and match this research's anti-feature findings — no changes recommended to the design here.

## MVP Definition

### Launch With (v1 — already fully scoped by the approved design)

- [ ] `task new` structured form (site, date/range, time, party size, contact, interval, deadline, free-form extras) — table stakes
- [ ] `login <site>` one-time interactive login + profile reuse — table stakes
- [ ] `run <task>`: polling loop + deadline stop + site-level lock (one run per site at a time) — table stakes
- [ ] First-run submit confirmation (y/n), confirmation invalidated by any checkSlot/apply repair — differentiator, and the feature that makes auto-submit acceptable
- [ ] Never-retried submit + ambiguous-outcome → "확인 필요" + `task resolve` — table stakes (prevents duplicate booking)
- [ ] Stop conditions: CAPTCHA/bot-block, new-payment-info screen, logged-out, Claude/`claude -p` error, profile lock, slow-wake-after-sleep — table stakes
- [ ] Run log: actions taken, stop reason, Claude call count — table stakes
- [ ] First-run Claude planning + step-level self-heal with bounded retries (2/step, 5/run), save-only-after-success — differentiator (any-site generalization)

No additions recommended to v1 scope from this research — the approved design already covers every domain table-stakes item except outcome notification, and that omission is explicitly reasoned (Open Question #2) rather than an oversight.

### Add After Validation (v1.x)

- [ ] Outcome notification beyond terminal/log (Discord/Slack/push) — trigger: once `run` is used with deadlines long enough that the user isn't watching the terminal (matches domain table-stakes for unattended sniper-style tools; currently a known, accepted v1 gap)
- [ ] "Show me once" plan capture (record a human's manual booking instead of a practice run) — trigger: after the practice-run flow proves reliable on the first real site; already next in the design's post-v1 order
- [ ] Multiple simultaneous site watches with first-match-wins — trigger: after single-site reliability is proven

### Future Consideration (v2+)

- [ ] Company/internal-system repetitive-task automation on the same engine — defer: different risk profile (no money/scarcity race), validate the reservation use case first
- [ ] Mobile-triggered runs on a home machine — defer: requires a always-on host + remote trigger surface, out of scope for a single local CLI
- [ ] Unified "all reservations in one place" hub — defer: needs multiple site plans proven individually first; premature abstraction before there's more than one plan to unify

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Structured task input | HIGH | LOW | P1 |
| Login/session reuse | HIGH | LOW–MEDIUM | P1 |
| Polling loop + deadline | HIGH | LOW–MEDIUM | P1 |
| Auto-submit on match | HIGH | HIGH | P1 |
| First-run confirmation + confirmation invalidation | HIGH | MEDIUM | P1 |
| Never-retry submit + task resolve | HIGH | MEDIUM | P1 |
| Stop-condition detection | HIGH | MEDIUM | P1 |
| Run log | MEDIUM | LOW | P1 |
| First-run AI plan + self-heal + cache | HIGH | HIGH | P1 (this is the product's technical thesis — see design's Success Criteria 2–4) |
| Outcome push notification | MEDIUM | LOW–MEDIUM | P2 |
| Show-me-once plan capture | MEDIUM | HIGH | P2 |
| Multi-site simultaneous watch | MEDIUM | HIGH | P3 |
| Company task automation | LOW (for this milestone) | HIGH | P3 |
| Mobile control | LOW (for this milestone) | HIGH | P3 |
| Unified reservation hub | LOW (for this milestone) | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (all already in the approved v1 design)
- P2: Should have, add when possible (deferred by design, with stated triggers)
- P3: Nice to have, future consideration (design's own post-v1 roadmap order)

## Competitor Feature Analysis

| Feature | Alert-only watchers (CampNab, Recbot) | Auto-booking snipers (resy_bot, AutoRes, Open-Table-Bot) | This Project's Approach |
|---------|----------------------------------------|-------------------------------------------------------------|--------------------------|
| Auto-submit | Never — "cannot make the reservation for you" | Always, optimized for speed at a known release time | Yes, but gated by first-run human confirmation and never retried |
| Site coverage | Single platform per tool (recreation.gov, Reserve America) | Single platform per tool (Resy-only, OpenTable-only) | Any site, via one-time AI-generated plan cached for replay |
| Safety rails on submit | N/A (never submits) | None described — optimizes purely for winning the race | First-run confirm, confirmation reset on any AI-modified step, never-retry-submit |
| Notification | Core feature (the entire product) | Present (Discord/Slack/Pushover/Ntfy) | Terminal + run log only in v1 (explicit, reasoned gap) |
| CAPTCHA/anti-bot handling | Not applicable (read-only scraping) | Actively bypassed in the broader ticket-bot ecosystem | Hard stop, never bypassed (project constraint) |
| Polling politeness | Vendor-controlled (paid service, opaque interval) | Optimized for a single race moment, not sustained polling | User-set interval, 30s floor / 1min default (explicit constraint) |
| Cost model | Subscription ($10/mo typical) | Free (self-hosted) or subscription (AutoRes) | Zero marginal cost after first plan (Claude Max plan, cached execution) |

## Sources

- [Campnab FAQ](https://campnab.com/faq) — MEDIUM confidence (vendor page)
- [How to Get Campsite Availability Notifications on Recreation.gov](https://campnab.com/blog/how-to-get-campsite-availability-notifications-on-recreation-gov) — MEDIUM
- [Recbot](http://recbot.site/) — MEDIUM (vendor/project page, self-reported "does not book" framing)
- [webrender/campsite-checker](https://github.com/webrender/campsite-checker) — MEDIUM (open-source project README)
- [How to Reserve a Campsite at Sold-Out Campgrounds: Best Campsite Trackers](https://huntandpeckblog.com/best-campsite-trackers/) — MEDIUM (independent review)
- [restaurant-cli (omarshahine)](https://github.com/omarshahine/restaurant-cli) — MEDIUM (open-source project README)
- [restaurant-mcp](https://github.com/jrklein343-svg/restaurant-mcp) — MEDIUM
- [lost-dinosaur/resy_bot](https://github.com/lost-dinosaur/resy_bot) — MEDIUM (open-source project README, "smart sniping", notification channels)
- [al3xisrobles/resbot](https://github.com/al3xisrobles/resbot) — MEDIUM
- [AutoRes](https://www.autores.io/) — LOW-MEDIUM (vendor marketing page)
- [Best CAPTCHA Solving APIs for Web Scraping (Scrapfly, 2026)](https://scrapfly.io/blog/posts/best-captcha-solving-api) — MEDIUM (industry blog)
- [Proxy Rotation, CAPTCHA Solving, and Anti-Bot Fingerprinting](https://www.context.dev/blog/proxy-rotation-captcha-solving-and-anti-bot-fingerprinting) — MEDIUM
- [7 Best Ticket Proxies (roundproxies, 2026)](https://roundproxies.com/blog/best-ticket-proxies/) — LOW-MEDIUM (vendor-adjacent listicle, used only for scalper-tooling pattern confirmation)
- [Ticketing Bot Detection: Stop Scalpers in 2026 (Sentinel)](https://sntlhq.com/blog/ticketing-bot-detection) — MEDIUM (referenced for BOTS Act / ToS context, informs anti-feature reasoning)
- `/home/user/project_260923/docs/designs/browser-automation.md` — HIGH (approved project design, primary source for v1 scope and dependency claims)
- `/home/user/project_260923/.planning/PROJECT.md` — HIGH (Core Value and requirements, primary source for prioritization)

---
*Feature research for: personal reservation-booking automation CLI*
*Researched: 2026-09-23*
