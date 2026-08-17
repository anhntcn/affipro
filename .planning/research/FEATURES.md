# Feature Research

**Domain:** Internal-first AI content-generation SaaS (multichannel affiliate copy) with a quality-optimization loop
**Researched:** 2026-08-17
**Confidence:** MEDIUM (web sources on LLM-tooling norms cross-checked across multiple independent vendors; product-specific decisions are opinionated inference from PROJECT.md + codebase map)

## Scope Note

This milestone adds five capabilities on top of the existing one-shot generator: **Google login, per-user history, content scoring (human + LLM-as-judge), a prompt-optimization dashboard, and generate-time config.** The categorization below is calibrated for **internal team scale (a handful of trusted users)**, not public SaaS. That distinction is what makes several "obvious" SaaS features into anti-features here.

## Feature Landscape

### Table Stakes (Users Expect These)

Missing these makes the optimization loop non-functional or the app feel broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Google login (single provider) | Every per-user feature (history, scoring attribution) requires identity; team already has Google Workspace | LOW | Supabase Google OAuth; JWT verified server-side via thin `verifyUser(token)` per PROJECT.md. No email/password, no other providers. |
| Per-user generation history: list + detail | Users regenerate constantly; losing prior outputs is the #1 complaint in AI writing tools. History is the substrate scoring/dashboard read from | MEDIUM | List (newest first, product-name/snippet), detail view showing all 4 channels + the config + prompt_version used. Store input, output, config, prompt_version on **every** generation from day one (PROJECT.md key decision). |
| Copy-to-clipboard per block | Already exists; core workflow is copy-then-paste into FB/TikTok/Telegram | LOW | Preserve existing behavior across the new history detail view too. |
| Human feedback: thumbs up/down per generation (or per channel) | Explicit rating is the cheapest signal and the ground truth the LLM-judge is calibrated against | LOW | Binary reduces cognitive load and yields more data (cross-source consensus). Attach score to generation_id + channel. See anti-features re: over-granular scales. |
| LLM-as-judge auto-scoring with a rubric | This is the core value driver: "average quality score rises over time." Human votes are sparse; the judge fills coverage | MEDIUM | Rubric criteria already named: hook strength, naturalness (anti-"văn dịch máy"), CTA strength. Use **analytic** rubric (score each criterion separately) not holistic — debuggable and reveals *why* a prompt regressed. Output structured JSON. Runs inline in `/api/generate` per PROJECT.md (no queue yet). |
| Store prompt_version + config with each generation | Without version tagging there is no optimization loop, only diff-tracking | LOW | "Prompt versioning without evals is just diff tracking" — the value is the score↔version join. A monotonic version string/hash on the system prompt is enough at this scale. |
| Generate-time config: channel selection, tone, video length | Users don't always need all 4 channels; length (15/30/45/60s) and tone materially change output | MEDIUM | Config is both a UX feature and an experiment axis — it must be persisted alongside prompt_version so the dashboard can slice by it. |
| Optimization dashboard: score-by-prompt_version/config | The whole point of collecting scores. Lets the team see which prompt/config wins | MEDIUM | Aggregate: avg score per criterion, grouped by prompt_version and by config. Table + simple trend/bar is enough; see anti-features re: heavy BI. |

### Differentiators (Competitive Advantage)

Aligned with Core Value: natural, buyer-psychology-correct Vietnamese copy, improving measurably over time.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-channel, per-criterion scoring (not one score per generation) | A generation can have a great FB post and a weak video hook; a single blended score hides this and misdirects prompt tuning | MEDIUM | Analytic rubric applied per channel. This is the biggest lever on judge usefulness — most consumer tools only do one thumbs-up per output. |
| Human vote vs. LLM-judge agreement view | Surfaces when the judge drifts from human taste — the guardrail that keeps the auto-score trustworthy | MEDIUM | Judge alignment can swing 0.40→0.75 on the same criterion depending on rubric wording. Showing agreement lets the team recalibrate the rubric, not just the generation prompt. |
| Side-by-side prompt_version comparison | Directly answers "did v3 beat v2?" — the loop's core question, mirroring LangSmith/Langfuse/PromptLayer registries | MEDIUM | Diff the prompt text + show score deltas per criterion. At internal scale a two-version compare view beats a full experiment framework. |
| "Regenerate with adjusted config" from a history item | Guided regeneration (Jasper "Rephrase", Notion "Try again with…") — iterate on a known-good input without retyping | LOW-MEDIUM | Branching (new generation row) not overwrite, so history/scores stay intact and comparable. |
| Vietnamese-tuned rubric criteria | Naturalness for VN buyer psychology is the moat; a generic English rubric won't catch "văn dịch máy" | MEDIUM | Encode the "sounds machine-translated" failure mode explicitly as a rubric edge case — judges fall back to generic plausibility without spelled-out edge cases. |
| Favorite/star a generation | Lightweight curation of reusable winners; cheap and expected by Jasper/Copy.ai users | LOW | Distinct from the quality vote — favorite = "I'll reuse this," vote = "this is good." Don't conflate. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| 5-star (or 1-10) human rating scale | "More granular = better data" | Multi-point scales add noise without improving alignment; humans don't rate consistently; higher cognitive load lowers already-low response rates | Binary thumbs up/down + optional freetext comment on downvotes only |
| Background worker / queue for the LLM-judge | "Scoring shouldn't block generation" | Over-engineering at internal scale; PROJECT.md explicitly defers this. Adds infra, failure modes, ops | Run judge inline in `/api/generate`; make it best-effort (don't fail the generation if judge fails); revisit only if latency hurts |
| Full BI/analytics suite (cohorts, funnels, custom charts) | "Dashboard should be powerful" | Weeks of work for a handful of internal users; distracts from the loop | One opinionated dashboard: score-per-criterion by prompt_version and by config, plus a trend line |
| Automatic prompt auto-optimization / self-tuning agent | "Let the system improve its own prompts" | The team's judgment *is* the product's edge; auto-tuning needs far more eval rigor and can silently regress naturalness | Human-in-the-loop: dashboard informs, humans edit the prompt and bump the version |
| Role-based permissions / member-admin split now | "We'll need it for public" | Premature; PROJECT.md scopes this to the public-ready phase. Every user is trusted internally | Ship flat auth (any logged-in Google user = full access); add RBAC in the public-ready milestone |
| Rate limiting / quota now | Listed as a requirement | Correctly belongs to the public-ready phase; internal team won't abuse it and it complicates every `/api` call | Defer to public-ready milestone (PROJECT.md already sequences it there) |
| Editable rich-text output editor (like Jasper docs) | "Let me tweak the copy in-app" | Large surface area; users already copy-paste into their real platforms | Keep copy-to-clipboard; regenerate-with-config covers most iteration needs |
| Comment threads / collaborative editing on generations | PromptLayer/Langfuse have feedback threads | Collaboration overhead unjustified for a small co-located team | Single freetext note field on a downvote is enough signal |
| Blended single quality score per generation | "One number is simpler" | Hides per-channel/per-criterion tradeoffs — the exact information the optimization loop needs | Keep scores decomposed; compute a display average only for sorting, never as the sole stored value |

## Feature Dependencies

```
Google login (auth)
    └──requires──> nothing (foundation)

Per-user history
    └──requires──> Google login (user_id to attribute rows)
    └──requires──> persist {input, output, config, prompt_version} per generation

Generate-time config
    └──requires──> config persisted on generation row  ──enables──> dashboard slicing

Human feedback (thumbs)
    └──requires──> per-user history (something to attach a score to)

LLM-as-judge scoring
    └──requires──> rubric criteria + prompt_version tagging
    └──enhanced-by──> human feedback (calibration / agreement view)

Optimization dashboard
    └──requires──> LLM-judge scores + human votes + prompt_version + config on rows

Regenerate-with-config
    └──requires──> history detail + generate-time config
    └──conflicts-with──> overwrite-on-regenerate (must branch, not overwrite)
```

### Dependency Notes

- **Everything downstream requires auth + persistence first.** Auth and the generation-persistence schema (input/output/config/prompt_version) are the true foundation phase — history, scoring, and dashboard are all just reads/writes over it.
- **prompt_version + config must be captured before any scoring is built.** Retrofitting versioning onto un-tagged historical rows is lossy; tag from the first persisted generation (PROJECT.md decision).
- **LLM-judge is enhanced by, not blocked by, human votes.** Ship the judge with a fixed rubric; use human votes to validate/recalibrate it. The agreement view is a differentiator layered on top, not a prerequisite.
- **Regenerate must branch, not overwrite.** Overwriting destroys the score history that makes prompt_versions comparable — a direct conflict with the optimization loop.

## MVP Definition

### Launch With (v1 of this milestone)

- [ ] Google login (Supabase OAuth, JWT verified server-side) — foundation for all user features
- [ ] Persist every generation: input, 4-channel output, config, prompt_version, user_id — the loop's substrate
- [ ] Generate-time config: channel selection, tone, video length — feeds both UX and experiment axes
- [ ] Per-user history list + detail (with existing copy-to-clipboard) — retention + scoring surface
- [ ] Human thumbs up/down per channel — ground-truth signal
- [ ] LLM-as-judge inline scoring, analytic rubric (hook/naturalness/CTA per channel), structured JSON — auto-coverage
- [ ] Optimization dashboard: avg score per criterion by prompt_version and by config — closes the loop

### Add After Validation (v1.x)

- [ ] Human-vs-judge agreement view — once enough human votes exist to compare
- [ ] Side-by-side prompt_version diff + score delta — once ≥2 meaningful versions exist
- [ ] Regenerate-with-adjusted-config from a history item — once history detail is in use
- [ ] Favorite/star generations — when users ask to reuse winners

### Future Consideration (public-ready milestone)

- [ ] Rate limiting + quota per user — PROJECT.md sequences to public
- [ ] Member/admin RBAC — needed only with external users
- [ ] Freetext comment on downvotes — if binary proves too coarse for the team

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Google login | HIGH | LOW | P1 |
| Persist generation + prompt_version + config | HIGH | MEDIUM | P1 |
| Generate-time config (channel/tone/length) | HIGH | MEDIUM | P1 |
| History list + detail | HIGH | MEDIUM | P1 |
| Human thumbs up/down (per channel) | HIGH | LOW | P1 |
| LLM-as-judge analytic scoring | HIGH | MEDIUM | P1 |
| Optimization dashboard (score by version/config) | HIGH | MEDIUM | P1 |
| Human-vs-judge agreement view | MEDIUM | MEDIUM | P2 |
| Prompt_version side-by-side compare | MEDIUM | MEDIUM | P2 |
| Regenerate-with-config | MEDIUM | LOW | P2 |
| Favorite/star | MEDIUM | LOW | P2 |
| Rate limit / quota | HIGH (public only) | MEDIUM | P3 |
| RBAC member/admin | LOW (internal) | MEDIUM | P3 |

**Priority key:** P1 = must have for this milestone · P2 = add after core loop validated · P3 = defer to public-ready milestone

## Competitor / Prior-Art Feature Analysis

| Feature | Jasper / Copy.ai | LangSmith / Langfuse / PromptLayer | Our Approach |
|---------|------------------|-------------------------------------|--------------|
| History | Document/output history, star, regenerate | Trace registry, per-generation records | Per-user history over persisted generations; branch on regenerate |
| Human feedback | Thumbs / star on outputs | Score attached to trace/generation id | Binary thumbs per channel, attached to generation_id |
| LLM-as-judge | Not core / hidden | First-class evals, rubric criteria, structured output | Inline analytic rubric (hook/naturalness/CTA), VN-tuned edge cases |
| Prompt versioning | N/A (product tool) | Registry: SHA/hash, tags, side-by-side diff, A/B batch | Monotonic prompt_version on every row; two-version compare view |
| Dashboard | Usage analytics | Score-by-version, agreement, cost/latency | One opinionated view: score-per-criterion by version + config |
| Regenerate UX | Guided ("Rephrase" / adjust params) | N/A | Regenerate-with-adjusted-config, branching not overwrite |

## Sources

- [Understanding LLM-as-a-Judge: Benefits, Biases, and Best Practices — Jimin Lee (Medium)](https://medium.com/@jiminlee-ai/understanding-llm-as-a-judge-benefits-biases-and-best-practices-4b4d5cc3cbcd)
- [Rubric-Based Evaluations & LLM-as-a-Judge — Adnan Masood (Medium)](https://medium.com/@adnanmasood/rubric-based-evals-llm-as-a-judge-methodologies-and-empirical-validation-in-domain-context-71936b989e80)
- [LLM as a Judge prompts: templates, rubrics, and best practices — Galtea](https://galtea.ai/blog/llm-as-a-judge-prompts-templates-rubrics-and-best-practices)
- [Exploring LLM-as-a-Judge — Weights & Biases](https://wandb.ai/site/articles/exploring-llm-as-a-judge/)
- [Langfuse vs Langchain vs PromptLayer: Feature Comparison](https://blog.promptlayer.com/langfuse-vs-langchain-vs-promptlayer/)
- [Prompt Versioning Without Evals Is Just Diff Tracking — Respan](https://www.respan.ai/blog/prompt-versioning-iteration-loop)
- [Langfuse vs Langsmith: Prompt Versioning and Tracing — Paradigma](https://en.paradigmadigital.com/techbiz/langfuse-vs-langsmith-prompt-versioning-tracing/)
- [AI UX Patterns | Regenerate — ShapeofAI](https://www.shapeof.ai/patterns/regenerate)
- [Jasper vs. Copy.ai — Zapier](https://zapier.com/blog/jasper-vs-copy-ai/)
- [5 stars vs. thumbs up/down — Appcues](https://www.appcues.com/blog/rating-system-ux-star-thumbs)
- [Beyond thumbs up and thumbs down — shima ghassempour (Microsoft DS+AI, Medium)](https://medium.com/data-science-at-microsoft/beyond-thumbs-up-and-thumbs-down-a-human-centered-approach-to-evaluation-design-for-llm-products-d2df5c821da5)
- [How to capture User Feedback for Evaluation of LLM apps — Langfuse](https://langfuse.com/faq/all/user-feedback)

---
*Feature research for: internal-first AI affiliate-content generator with quality-optimization loop*
*Researched: 2026-08-17*
