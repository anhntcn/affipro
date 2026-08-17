# Roadmap: Affiliate Content Pro (Affipro)

## Overview

Affipro turns raw product info + an affiliate link into a natural, Vietnamese-tuned multi-channel content set via Gemini. This milestone bolts five capabilities onto the existing React/Vite/Express one-shot generator — Google login, per-user history, generate-time config, a human + LLM-as-judge scoring loop, and a prompt-optimization dashboard — then packages it for internal deployment. The journey is dependency-forced: first make the fragile generator correct and lock it with CI (Phase 0), then land the two anti-lock-in seams (auth, then persistence+schema) that every per-user feature needs, then build the scoring loop and the dashboard that make quality measurable over time, and finally package as a single Docker container against Supabase Cloud. The load-bearing decision threading all phases: capture an immutable prompt_version + config snapshot from the very first persisted generation, so the optimization loop stays analyzable.

## Phases

**Phase Numbering:**

- Integer phases (0, 1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 0: Fix-to-run + CI net** - Make the Gemini generator correct and lock it with tests before auth/DB churn
- [ ] **Phase 1: Auth + Google OAuth** - Google login with server-verified JWTs behind the verifyUser seam
- [ ] **Phase 2: Persistence + Generate Config** - DB seam + schema with immutable prompt_version/config snapshot, history, and generate-time config
- [ ] **Phase 3: Scoring Loop** - Human thumbs + inline LLM-as-judge scores with bias mitigation
- [ ] **Phase 4: Optimization Dashboard** - Compare scores by prompt_version/config with human-vs-judge agreement
- [ ] **Phase 5: Docker Packaging** - Single container serving SPA + /api against Supabase Cloud

## Phase Details

### Phase 0: Fix-to-run + CI net

**Goal**: The existing generator produces reliable, schema-validated content and never crashes on bad model output, with a CI net that stops the known bugs regressing when later phases rewrite server.ts.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04, FIX-05, FIX-06
**Success Criteria** (what must be TRUE):

  1. User generates content end-to-end using a valid, re-verified Gemini model id (the `gemini-3.7-flash` id in server.ts is RE-VERIFIED against live docs at build time, not assumed invalid; a bad/unknown id fails a CI allowlist check)
  2. When Gemini returns truncated or malformed JSON, the user sees a clear Vietnamese error instead of a white screen (finishReason checked, parse guarded, Zod-validated server-side, ErrorBoundary + null-guards client-side)
  3. Server reads PORT from the environment and boots fail-fast with a clear message when a required env var is missing; `.env.local.example` exists and AI Studio template metadata/README are cleaned up
  4. CI runs automatically on every change: a model-id allowlist check plus happy-path and malformed-response integration tests, so a reintroduced bad model id or unguarded parse fails the build

**Plans**: 4/4 plans executed
**Wave 1**

- [x] 00-01-PLAN.md — Foundation slice: testable createApp() + Zod contract + pinned MODEL_ID/ALLOWLIST + responseSchema + happy-path test (wave 1, FIX-01/FIX-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 00-02-PLAN.md — Failure-handling slice: finishReason gate + single retry + Vietnamese error + fail-fast loadEnv()/PORT + tests (wave 2, FIX-03/FIX-05)
- [x] 00-03-PLAN.md — Client-resilience slice: ErrorBoundary + null-guarded ResultDisplay + jsdom render test (wave 2, FIX-04)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 00-04-PLAN.md — CI net + cleanup: static allowlist check + GitHub Actions (Bun) + .env.local.example + template metadata cleanup (wave 3, FIX-01/FIX-05/FIX-06)

### Phase 1: Auth + Google OAuth

**Goal**: A user can sign in with Google and reach the generator only when authenticated, with every /api request verified server-side behind the thin verifyUser seam.
**Mode:** mvp
**Depends on**: Phase 0
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):

  1. User signs in with their Google account (Supabase OAuth PKCE) and lands back in the app authenticated
  2. The session survives a browser refresh and the user can sign out; expired sessions prompt a graceful re-login rather than silent failures
  3. Every `/api/*` request is rejected (401) without a valid Bearer JWT — verified by signature via jose+JWKS (issuer/audience asserted) through the `verifyUser(token)` seam; a forged/decoded-only token is rejected by a test
  4. The SPA uses the Supabase SDK only to obtain the JWT (never a direct DB query); all data access flows through Express, and the built client bundle contains no service_role key

**Plans**: TBD
**UI hint**: yes

### Phase 2: Persistence + Generate Config

**Goal**: Every generation is saved for its owner with an immutable prompt_version + config snapshot, the user can pick generate-time config (video length / tone / channels), and browse their own history.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: HIST-01, HIST-02, HIST-03, HIST-04, CONF-01, CONF-02, CONF-03, CONF-04
**Success Criteria** (what must be TRUE):

  1. User chooses video length (e.g. 15/30/45/60s — length constrains scene count), tone, and priority channels before generating, and those choices persist into the generation's `config` (jsonb)
  2. Every generation is written to the DB with input, resolved config, prompt_version (full immutable snapshot: prompt body + model id + config), output, status, timestamp, and user_id — one stored row alone can reproduce the exact request
  3. User sees a list of their own generations (newest first) and can reopen any past generation to view its full 4-channel detail
  4. A user only ever sees their own history: Express filters by user_id AND RLS is enabled in the same migration as each table (an anon-key query returns none of another user's rows)

**Plans**: TBD
**UI hint**: yes

### Phase 3: Scoring Loop

**Goal**: Each generation can be scored both by a quick human thumbs vote and by an inline LLM-as-judge on a Vietnamese analytic rubric, stored comparably so the optimization signal is trustworthy.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: SCORE-01, SCORE-02, SCORE-03, SCORE-04, SCORE-05
**Success Criteria** (what must be TRUE):

  1. User gives a fast binary thumbs up/down per channel (no 5-star scale), stored in a dedicated `scores` table (source=human, metric, value, note) keyed by generation_id
  2. An LLM-as-judge automatically scores each generation per channel on an analytic rubric (hook, natural-Vietnamese / anti-"văn dịch máy", CTA), running inline in `/api/generate` behind the `services/judge.ts` seam, with judge_model + rubric_version stored per score
  3. Judge bias is mitigated: judge uses a different model/config than the generator (or it is explicitly noted), length is normalized, and human-vs-judge agreement is trackable — a shared-model score is never reported as quality
  4. Regenerating creates a new branched generation record (never overwrites the old one), preserving the full score history for comparison

**Plans**: TBD

### Phase 4: Optimization Dashboard

**Goal**: The team can see which prompt_version and config produce better content, and can trust the auto-score by seeing how well it agrees with human votes.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):

  1. Dashboard shows average score grouped by `prompt_version`
  2. Dashboard shows average score grouped by `config` (video length / tone / channel)
  3. Dashboard shows the human-vs-judge agreement level so the team can gauge how much to trust the auto-score
  4. User can compare two prompt_versions side-by-side (scores + sample content) to decide which prompt wins

**Plans**: TBD
**UI hint**: yes

### Phase 5: Docker Packaging

**Goal**: The whole app runs as a single configurable container against Supabase Cloud, with a documented path to self-host.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: DEPLOY-01, DEPLOY-02
**Success Criteria** (what must be TRUE):

  1. The app builds into one Docker container (Express serves the SPA build + `/api`), configured entirely via environment variables with no secrets baked into the image
  2. The container connects to Supabase Cloud through the single `db/client.ts` seam (the only place holding URL+key), boots fail-fast on missing env, and registered OAuth redirect URLs work for the deployed host
  3. Documentation records the migrate-to-self-host path (which env vars / seams change), so leaving Supabase Cloud is an env + two-file change, not a rewrite

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 0 → 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Fix-to-run + CI net | 4/4 | In Progress|  |
| 1. Auth + Google OAuth | 0/TBD | Not started | - |
| 2. Persistence + Generate Config | 0/TBD | Not started | - |
| 3. Scoring Loop | 0/TBD | Not started | - |
| 4. Optimization Dashboard | 0/TBD | Not started | - |
| 5. Docker Packaging | 0/TBD | Not started | - |
