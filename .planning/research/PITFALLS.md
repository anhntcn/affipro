# Pitfalls Research

**Domain:** Adding Supabase Auth/DB + LLM-as-judge scoring loop to an existing Express + Gemini app (internal-first, then public)
**Researched:** 2026-08-17
**Confidence:** MEDIUM (web-corroborated against Supabase docs, Google AI dev forum, and LLM-judge papers) / HIGH for the codebase-specific bugs (verified against the codebase map)

> Phase names below map to the PROJECT.md decision "Sửa lỗi chạy được (Phase 0) trước khi thêm auth/DB", and the Active requirements order: **Phase 0 = fix-to-run**, **Phase 1 = Auth + Google OAuth**, **Phase 2 = Persistence + generate config**, **Phase 3 = Scoring loop (human + LLM-judge, prompt_version/config)**, **Phase 4 = Dashboard**, **Phase 5 = Docker + Supabase Cloud**, **Phase 6 = Public-ready (rate limit / quota / roles)**.

## Critical Pitfalls

### Pitfall 1: Trusting an unverified JWT (decode instead of verify)

**What goes wrong:**
Express `verifyUser(token)` decodes the Supabase JWT (e.g. `jwt.decode` / base64 split) and reads `sub`/`email` without verifying the signature. Anyone can forge a token with any `sub` and impersonate any user — RLS downstream is then operating on an attacker-chosen `user_id`.

**Why it happens:**
`jwt.decode()` looks like it "works" in the happy path and returns the claims, so the missing signature check is invisible until exploited. Tutorials often show decode for brevity.

**How to avoid:**
Verify the signature. With Supabase's new **asymmetric JWT signing keys**, fetch the public keys from `https://<project>.supabase.co/auth/v1/.well-known/jwks.json` and verify with `jose` (`createRemoteJWKSet` + `jwtVerify`), asserting `issuer` = `https://<project>.supabase.co/auth/v1` (the `/auth/v1` suffix is mandatory and easy to miss) and the expected `audience` (`authenticated`). Simplest robust alternative for internal scale: call `supabase.auth.getUser(token)` server-side, which round-trips to Supabase to validate. Keep this behind the thin `verifyUser(token)` seam that PROJECT.md already mandates.

**Warning signs:**
Code uses `jwt.decode`, `atob`, or manual base64 split; no JWKS/secret configured; auth "works" even when you paste a hand-edited token; no `issuer`/`audience` assertions.

**Phase to address:** Phase 1 (Auth). Add a decode-only regression test: a forged token must be rejected.

---

### Pitfall 2: service_role key leaks to the client or is used as the default DB client

**What goes wrong:**
The `service_role` key **bypasses RLS entirely**. If it reaches the browser bundle, or if the Express layer uses a single service_role Supabase client for all queries, every row of every table is reachable regardless of the RLS policies you wrote — and it fails silently until data is already exposed.

**Why it happens:**
service_role is convenient (no RLS friction during development), and Vite will happily inline any env var prefixed `VITE_` into the client bundle. Copy-pasting a working `.env` into the frontend is a one-keystroke disaster.

**How to avoid:**
service_role key lives **only** in Express, never `VITE_`-prefixed, never returned to the client. For user-scoped reads/writes, create a per-request Supabase client that carries the **user's** JWT (so RLS applies), and reserve service_role only for deliberate admin operations (e.g. the LLM-judge writing scores as a trusted system actor). This aligns with PROJECT.md's "SPA không gọi thẳng Supabase" decision. Grep the built bundle for the service_role prefix in CI.

**Warning signs:**
`VITE_SUPABASE_SERVICE_ROLE...` anywhere; a single global admin client used for user data; RLS policies that "never seem to block anything" in testing.

**Phase to address:** Phase 1 (Auth) establishes the seam; re-verify in Phase 5 (Docker env) and Phase 6 (public).

---

### Pitfall 3: RLS forgotten or disabled — public schema exposed via anon key

**What goes wrong:**
Tables created via SQL migration or the Table Editor have **RLS OFF by default**. Because Supabase auto-generates a REST API over the `public` schema, any table without RLS is readable (and often writable) by anyone holding the anon key — which is public by design. For a `generations` table storing every user's content and prompts, this is a full data leak.

**Why it happens:**
RLS is a separate, easy-to-forget step after `CREATE TABLE`. The app appears to work because the service_role/authenticated path returns data; nobody tests the raw anon path.

**How to avoid:**
Every table gets `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` **in the same migration** as its `CREATE TABLE`, plus explicit policies (`user_id = (select auth.uid())` for owner-scoped rows). Add a migration-lint / test that enumerates `public` tables and fails if any has `rowsecurity = false`. Default-deny: no policy = no access.

**Warning signs:**
`pg_tables` shows `rowsecurity = false`; a table with no `CREATE POLICY`; querying a table with only the anon key returns rows.

**Phase to address:** Phase 2 (Persistence) — the schema phase. Verification: anon-key query returns zero rows for another user's data.

---

### Pitfall 4: LLM-judge self-preference / position / verbosity bias makes the optimization loop chase noise

**What goes wrong:**
The whole point of the scoring loop is "điểm chất lượng trung bình tăng theo thời gian" — but if Gemini judges Gemini-generated content, self-preference bias (documented range −38% to +90% on ArenaHard), verbosity bias (judge score tracks length at r=.87 vs .44 for humans), and position bias (order swaps shift pairwise accuracy >10%) mean the score measures the judge's quirks, not real quality. You then "optimize" prompt_version toward longer, more verbose output and congratulate yourself on a rising number.

**Why it happens:**
Using the same model for generation and judging is the path of least resistance, and inline in `/api/generate` (per the PROJECT.md decision) it's tempting to reuse the same client/model. A single pointwise 1–10 score looks objective.

**How to avoid:**
(1) Judge with a **different model** than the generator where feasible (or at minimum a different, explicitly-noted config) to blunt self-preference. (2) Use a **structured rubric** with concrete criteria (persuasiveness, natural Vietnamese tone / "không văn dịch máy", CTA presence, factual alignment to product) rather than a single vague score. (3) Cap/normalize for length so verbosity isn't rewarded. (4) For any pairwise comparison, randomize order and/or run both orders and average. (5) **Calibrate against the human votes** you're already collecting — track judge-vs-human agreement over time; if it drifts, the judge is untrustworthy. (6) Store the judge's model id + rubric version alongside the score so results are comparable.

**Warning signs:**
Judge model == generator model; average score rising while human votes flat or falling; scores correlate with output length; single scalar score with no rubric; no human-agreement metric on the dashboard.

**Phase to address:** Phase 3 (Scoring loop). Verification: report inter-rater agreement between LLM-judge and human votes on a held-out sample before trusting the number.

---

### Pitfall 5: Prompt/config versioning that can't actually reconstruct a comparison (optimization loop is un-analyzable)

**What goes wrong:**
Generations are stored with a bare `prompt_version` string but not the full inputs needed to compare fairly: the actual prompt template body, model id, generation config (video length, tone, priority channel from the new config feature), Gemini `generationConfig`, and the judge's rubric version. Six weeks later the dashboard "compares prompt_version A vs B" but the two cohorts also differ in model, temperature, and rubric — so the comparison is meaningless and the loop can't produce a real conclusion.

**Why it happens:**
"Store prompt_version" sounds sufficient, and PROJECT.md correctly flags versioning as critical — but a version *label* without the version *content* and the surrounding config is a half-measure. Config drift (model swap, tone options added later) silently confounds cohorts.

**How to avoid:**
Persist an immutable, hashed snapshot: `prompt_version` (semantic label) **plus** the resolved prompt template, `model_id`, full `generationConfig`, the user-chosen config (length/tone/channel), and `judge_model`/`rubric_version` — all on the `generations` row (or a joined `prompt_templates`/`configs` table keyed by hash). Never mutate a version in place; new content = new version. This is the single most important schema decision for the milestone's success metric.

**Warning signs:**
`prompt_version` is a free-text column edited by hand; the same version label maps to different prompt bodies over time; model id or temperature not stored per generation; dashboard groups by version only.

**Phase to address:** Phase 2 (schema) defines it; Phase 3 (scoring) and Phase 4 (dashboard) consume it. Verification: from a stored row alone you can reproduce the exact request that produced it.

---

### Pitfall 6: Request-count rate limiting mistaken for cost control before going public

**What goes wrong:**
Before public launch you add `express-rate-limit` (100 req / 15 min) and call cost protection "done." But LLM cost is driven by **tokens, not requests** — one request with a huge `productInfo` paste (the input is interpolated directly into the prompt with no length cap, per CONCERNS.md) can cost 50x a normal call, and the scoring loop **doubles** every generation's cost (generate + judge). A handful of large requests drains the Gemini budget while staying under the request limit.

**Why it happens:**
Request-count limiting is the default everywhere and is trivial to add, so it feels like the box is checked. Token accounting requires deliberate tracking.

**How to avoid:**
Track three dimensions **per user**: request rate (RPM), **token budget** (tokens per day/window), and concurrency cap. Add a hard **budget cap** (spend or token ceiling per user per period) that returns 429 before the ceiling. Enforce a **server-side max length** on `productInfo`/`affiliateLink` (also mitigates prompt injection). Account for the judge call in the same budget. Log tokens per request from Gemini's `usageMetadata`.

**Warning signs:**
Only `express-rate-limit` by request count; no input length cap server-side; no per-user token/spend tracking; judge cost not counted; no `usageMetadata` logging.

**Phase to address:** Phase 6 (Public-ready) for full per-user quota; but the **input length cap + token logging** should land in Phase 0/Phase 3 because cost risk exists the moment the judge doubles spend internally.

---

### Pitfall 7: Structured output assumed safe — unguarded `JSON.parse` still 500s under `responseSchema`

**What goes wrong:**
You add a Gemini `responseSchema` and assume the output is now guaranteed valid JSON, so `JSON.parse(text)` stays unguarded (the existing `server.ts:97` bug). But with structured output, Gemini can still: exceed `maxOutputTokens` and return **truncated/unparseable** JSON (with `finishReason = MAX_TOKENS`, `text`/`parsed` may be empty), or (Flash especially) enter a **token-repetition loop inside a JSON literal** and run to the token ceiling (~30% of requests in some reported workloads). The endpoint 500s and the UI crashes on the missing fields (`ResultDisplay.tsx` `.map()` bug).

**Why it happens:**
"Schema = guaranteed shape" is a reasonable-sounding but false assumption; the failure is intermittent and model-dependent, so it passes local testing.

**How to avoid:**
Keep the schema **and** defend: wrap `JSON.parse` in try/catch, strip markdown code fences, check `finishReason` for `MAX_TOKENS`/`SAFETY` and surface a clear error, set a generous-but-bounded `maxOutputTokens`, and **validate the parsed object with Zod** against the `GeneratedContent` type before returning. On the client, add optional chaining / default arrays and a React error boundary around `ResultDisplay`.

**Warning signs:**
`JSON.parse(text)` with no try/catch; no `finishReason` check; no post-parse validation; UI maps arrays without null-guards; no error boundary.

**Phase to address:** Phase 0 (fix-to-run) — this is the already-known bug cluster. Verification: an integration test feeding a truncated/malformed model response returns a clean 4xx/5xx and the UI shows a graceful error, not a white screen.

---

### Pitfall 8: The already-known Phase-0 bugs regress after auth/DB churn

**What goes wrong:**
The five known defects — invalid model id `gemini-3.7-flash` (`server.ts:85`), unguarded `JSON.parse` (`server.ts:97`), no rate limit, hardcoded `PORT=3000`, missing `.env.local` — get fixed once, then silently regress when Phase 1–5 rewrite `server.ts` to add auth middleware, DB writes, and Docker env. With **zero tests** in the repo, nothing catches it.

**Why it happens:**
`server.ts` is a single fragile handler that "the entire app hinges on" (CONCERNS.md). Every subsequent phase edits it. No regression net exists.

**How to avoid:**
In Phase 0, fix all five **and** lock them with tests/guards: a smoke test that the configured model id is in an allowlist and a mocked-Gemini happy-path + malformed-path integration test; `const PORT = Number(process.env.PORT) || 3000`; bind `127.0.0.1` in dev; document `.env` (create `.env.example`, fix README's `.env.local` reference); validate required env vars at boot (fail fast if `GEMINI_API_KEY` / Supabase keys missing). Run the tests in CI so later phases can't merge a regression.

**Warning signs:**
Model id is a bare string literal, not from env/allowlist; no boot-time env validation; no CI; `server.ts` edited across phases with no test diff; server still binds `0.0.0.0` with no auth.

**Phase to address:** Phase 0 fixes + establishes the CI test net; every later phase relies on it.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| LLM-judge inline in `/api/generate` (no queue) | Simple; matches PROJECT.md decision | Doubles latency + cost per request; a judge failure can fail the whole generate; hard to re-score historically | OK at internal scale; revisit when judge cost/latency hurts or you need re-scoring — move to async job |
| Same model for generate + judge | One client, one key | Self-preference bias corrupts the optimization signal | Only until you have a second model wired; never for the number you report as "quality" |
| In-memory rate limiter (single container) | No Redis dependency | Resets on container restart; breaks if you ever run >1 replica | OK for internal single-container; must move to Redis-backed before horizontal scale |
| `prompt_version` as a hand-edited string | Fast to add | Un-analyzable cohorts if content/config drift under the same label | Never — snapshot the full resolved prompt + config from day one |
| No response caching by input hash | Less code | Identical inputs re-pay generate + judge cost | Acceptable now; add hash cache if repeated inputs appear |
| Skipping React error boundary | Ship UI faster | One bad payload = white screen, no recovery | Never once real users (even internal) rely on it — trivial to add |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Auth (Google OAuth) | Decode JWT client-side and trust `sub`; verify against legacy HS256 secret after rotating to asymmetric keys | Verify via JWKS (`createRemoteJWKSet`) or `auth.getUser()`; assert issuer `/auth/v1` + audience; handle 20-min JWKS cache on key rotation |
| Supabase Postgres RLS | Forget to `ENABLE ROW LEVEL SECURITY`; call `auth.uid()` bare in policies; use views that bypass RLS | Enable RLS in the create migration; wrap as `(select auth.uid())`; set `security_invoker=true` on views (PG15+) |
| Gemini `@google/genai` v2.4 | Invalid/hardcoded model id; assume `responseSchema` guarantees parseable JSON | Pin a valid `gemini-2.5-flash`-class id from env/allowlist; keep schema **and** guard parse + Zod-validate + check `finishReason` |
| Google OAuth redirect | Redirect URLs not registered for prod domain / Docker host | Register both dev and prod redirect URLs in Supabase + Google console; drive from env, not hardcoded |
| Supabase Cloud from Docker | Missing/failed env → app boots then 500s on first request | Validate all required env vars at container start; fail fast with a clear message |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `auth.uid()` unwrapped in RLS policy | Slow queries as `generations` grows; `auth_rls_initplan` warning | Use `(select auth.uid())` so it's evaluated once per query | Noticeable at thousands+ rows / list queries with order/limit |
| Judge call inline blocks the response | generate latency ~doubles; UI spinner drags | Acceptable internally; make judge async / fire-and-forget or queue when it hurts | When users notice the wait or judge adds seconds |
| No token/cost logging | Gemini bill surprises; can't attribute cost | Log `usageMetadata` tokens per generate + judge from day one | Immediately once the judge doubles spend |
| Unbounded input length | Large pastes inflate token cost + latency | Server-side max length on `productInfo`/`affiliateLink` | Any time; worse public |
| In-memory limiter under multi-replica | Limits leak; users exceed quota | Redis-backed limiter before scaling out | The moment you run >1 container |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Decode-not-verify JWT | Full user impersonation, RLS operates on forged `user_id` | Verify signature (JWKS/`getUser`) + issuer + audience |
| service_role key in client bundle or as default DB client | Total RLS bypass, all users' generations/prompts exposed | Server-only; per-request user-JWT client for user data; grep bundle in CI |
| RLS off on `public` tables | Anyone with anon key reads/writes all rows via auto REST API | Enable RLS + owner policies in the create migration; lint for `rowsecurity=false` |
| No server-side input caps / URL validation | Prompt injection steering output; token cost inflation | Max lengths + validate `affiliateLink` as URL server-side; treat model output as untrusted |
| Server binds `0.0.0.0` with no auth/rate limit | Gemini-backed paid endpoint reachable on the network; cost-drain/DoS | Require JWT on all `/api`; bind `127.0.0.1` in dev; rate limit before public |
| Secrets in image/logs | Key leak via Docker layers or logs | Env at runtime, not baked into image; never log keys or full tokens |
| No per-user quota before public | One user (or leaked endpoint) drains the whole Gemini budget | Token budget + RPM + concurrency + hard spend cap per user before launch |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| White screen when model omits a field | Content lost, looks broken, no retry | Error boundary + default arrays + "regenerate" affordance |
| Generic Vietnamese error toast for every failure | User can't tell rate-limit vs model error vs auth expiry | Distinct messages: quota reached / login expired / try again |
| Silent quota exhaustion | User keeps clicking, nothing happens | Show remaining quota + a clear "daily limit reached" state |
| Dashboard shows rising judge score as "quality up" without human baseline | Team optimizes toward judge bias, not real quality | Show LLM-vs-human agreement alongside the trend |
| Session/JWT expiry not handled | Requests silently 401 mid-session | Detect 401, refresh token or prompt re-login gracefully |

## "Looks Done But Isn't" Checklist

- [ ] **Auth:** Verifies JWT *signature* (issuer + audience), not just decode — verify a forged token is rejected by a test.
- [ ] **RLS:** Every `public` table has `rowsecurity=true` and an owner policy — verify an anon-key query returns none of another user's rows.
- [ ] **service_role:** Not in the client bundle, not the default DB client — verify by grepping the built bundle and reviewing the DB client factory.
- [ ] **Gemini structured output:** Schema set **and** parse guarded + Zod-validated + `finishReason` checked — verify with a truncated/malformed-response test.
- [ ] **Prompt versioning:** A stored generation row alone reproduces the exact request (prompt body + model + config + judge/rubric) — verify by replaying one row.
- [ ] **LLM-judge:** Judge model/rubric recorded per score; human-agreement metric exists — verify the dashboard shows agreement, not just the trend.
- [ ] **Rate limit/quota:** Enforces tokens + requests + concurrency + spend cap per user; input length capped server-side — verify a huge paste and a rapid loop are both rejected.
- [ ] **Config/env:** `PORT` from env, required vars validated at boot, `.env.example` accurate, README fixed — verify a missing key fails fast with a clear message.
- [ ] **CI net:** Model-id allowlist + happy/malformed integration tests run in CI — verify a reintroduced bad model id fails the build.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| service_role leaked to client / repo | HIGH | Rotate anon + service_role keys immediately (all services/clients), audit access logs, purge from bundle/history, add CI grep |
| RLS was off on a live table | MEDIUM | Enable RLS + policies now, audit whether anon reads occurred, notify if internal data exposed |
| Optimization loop ran on biased judge scores | MEDIUM | Re-score a sample with a different model + human calibration; discount conclusions drawn from the biased period; keep raw generations so re-scoring is possible |
| `prompt_version` label reused for different content | HIGH | Backfill hashes where the prompt body is recoverable; treat ambiguous cohorts as unusable; enforce immutable snapshots going forward |
| Known Phase-0 bug regressed in prod | LOW–MEDIUM | Fix + add the missing regression test; the cost is the incident, not the fix — hence the CI net in Phase 0 |
| Gemini budget drained by unguarded input/quota | MEDIUM | Add input cap + per-user token/spend quota, set a provider-side budget alert, review `usageMetadata` logs to attribute |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Unverified JWT (decode-only) | Phase 1 (Auth) | Forged-token test is rejected; issuer/audience asserted |
| service_role leak / RLS bypass | Phase 1 (seam) + Phase 2 (schema) | Bundle grep clean; per-request user-JWT client used for user data |
| RLS off / public schema exposed | Phase 2 (schema) | Lint fails on `rowsecurity=false`; anon query returns no foreign rows |
| LLM-judge bias corrupts signal | Phase 3 (scoring) | Judge≠generator (or noted); rubric used; human-agreement reported |
| Un-analyzable prompt/config versioning | Phase 2 (schema) → Phase 4 (dashboard) | One stored row reproduces the exact request |
| Request-count ≠ cost control | Phase 6 (public) + input-cap early | Huge paste + rapid loop both 429; per-user token/spend enforced |
| Unguarded parse under `responseSchema` | Phase 0 (fix-to-run) | Truncated/malformed-response test → clean error, no white screen |
| Known Phase-0 bugs regress | Phase 0 + CI net | Model-id allowlist + integration tests run in CI on every phase |

## Sources

- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — MEDIUM
- [Securing your API | Supabase Docs](https://supabase.com/docs/guides/api/securing-your-api) — MEDIUM
- [Supabase RLS: Common Mistakes & the (select auth.uid()) Performance Trap](https://vibeappscanner.com/supabase-row-level-security) — MEDIUM
- [Supabase RLS Best Practices: Production Patterns](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — MEDIUM
- [JSON Web Token (JWT) | Supabase Docs](https://supabase.com/docs/guides/auth/jwts) — MEDIUM
- [JWT Signing Keys | Supabase Docs](https://supabase.com/docs/guides/auth/signing-keys) — MEDIUM
- [Introducing JWT Signing Keys | Supabase Blog](https://supabase.com/blog/jwt-signing-keys) — MEDIUM
- [Structured outputs | Gemini API | Google AI for Developers](https://ai.google.dev/gemini-api/docs/structured-output) — MEDIUM
- [Structured Output Returns None When max_output_tokens Exceeded (python-genai #1039)](https://github.com/googleapis/python-genai/issues/1039) — MEDIUM
- [Structured output: repetition loop runs to MAX_TOKENS (Google AI Dev Forum)](https://discuss.ai.google.dev/t/structured-output-repetition-loop-inside-a-json-number-literal-runs-to-max-tokens-flash-vertex/175138) — MEDIUM
- [Self-Preference Bias in LLM-as-a-Judge (arXiv 2410.21819)](https://arxiv.org/pdf/2410.21819) — MEDIUM
- [Judging the Judges: A Systematic Study of Position Bias in LLM-as-a-Judge (arXiv 2406.07791)](https://arxiv.org/abs/2406.07791) — MEDIUM
- [Rate limiting for LLM applications (Portkey)](https://portkey.ai/blog/rate-limiting-for-llm-applications/) — MEDIUM
- [LLM Rate Limiting and Token Quotas in Production (MetaCTO)](https://www.metacto.com/blogs/llm-rate-limiting-token-quotas-production) — MEDIUM
- `.planning/codebase/CONCERNS.md` (known bugs) — HIGH (verified against codebase)
- `.planning/PROJECT.md` (phase decisions, anti-lock-in seam) — HIGH

---
*Pitfalls research for: Supabase Auth/DB + LLM-judge scoring loop on Express + Gemini*
*Researched: 2026-08-17*
