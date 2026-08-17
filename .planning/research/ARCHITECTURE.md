# Architecture Research

**Domain:** Auth + persistence + LLM-judge scoring on an existing Express + Vite React modular monolith (Supabase Cloud, single Docker container)
**Researched:** 2026-08-17
**Confidence:** MEDIUM-HIGH (existing architecture read directly; Supabase mechanics cross-checked against official docs)

## Scope

This document answers: how do Supabase Auth, a Postgres data model, and an inline LLM-judge integrate into the *existing* monolith (`server.ts` Express BFF + Vite SPA), and how do the module boundaries, auth→verify→Gemini→persist data flow, and build order fall out — while keeping Supabase isolated behind Express so leaving it later is cheap.

The milestone context already fixes the major decisions (SPA never queries Supabase directly; generation stores `input`/`config`/`prompt_version`/`output`; scores are a separate table; LLM-judge inline first; single container + Cloud now). This research validates those decisions against 2026 Supabase reality and specifies the *seams* that make them work.

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Browser (React SPA)                            │
│  App shell · InputForm · ResultDisplay · [NEW] History · Dashboard    │
│                                                                        │
│  [NEW] supabase-js used ONLY for Auth (Google OAuth) → obtains JWT     │
│         └─ getSession() → access_token                                 │
│  Zustand store: attaches `Authorization: Bearer <jwt>` to every fetch  │
└───────────────────────────────┬──────────────────────────────────────┘
                                 │  HTTPS  /api/*   (Bearer JWT)
                                 │  Supabase DB/REST NEVER called here
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  Express server (BFF — single process)                │
│                                                                        │
│  [NEW] verifyUser(token)  ── thin auth seam (jose + JWKS)             │
│           │ returns { userId, email, role } or 401                    │
│           ▼                                                            │
│  Route handlers:  /api/generate   /api/generations   /api/scores      │
│           │                                                            │
│  ┌────────┴─────────┐   ┌──────────────┐   ┌─────────────────────┐    │
│  │ generation svc   │   │ scoring svc  │   │ repo layer (data)   │    │
│  │ (Gemini call)    │   │ (LLM-judge)  │   │ profiles/gens/scores│    │
│  └────────┬─────────┘   └──────┬───────┘   └──────────┬──────────┘    │
│           │                    │                       │              │
│           ▼                    ▼                       ▼              │
│      @google/genai       @google/genai        [NEW] db client        │
│      (content)           (judge inline)       (service role key)     │
└───────────┬────────────────────┬───────────────────────┬─────────────┘
            │                     │                       │
            ▼                     ▼                       ▼
     Gemini API            Gemini API              Supabase Cloud
     (generation)          (judge scoring)         Postgres + Auth
                                                   (RLS as safety net)
```

**The two load-bearing seams** (everything else is ordinary app code):

1. `verifyUser(token)` — the *only* place that knows how Supabase issues/signs tokens.
2. `db` repository module — the *only* place that holds a Supabase connection/key.

Isolate these two and "leaving Supabase" or "self-hosting Supabase" becomes an env-var + two-file change instead of a rewrite.

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| SPA Auth (`src/lib/auth.ts`) | Trigger Google OAuth, hold session, expose `getToken()` | `supabase-js` `auth` submodule ONLY (no `.from()` calls) |
| Zustand store | Attach `Authorization: Bearer <jwt>` to every `/api` fetch; hold history/dashboard state | Extend existing `useStore.ts` with an authed `apiFetch` wrapper |
| `verifyUser(token)` | Verify JWT signature + expiry, return `{ userId, email, role }` or throw 401 | `jose` `createRemoteJWKSet` + `jwtVerify` against Supabase JWKS |
| Auth middleware | Express middleware that calls `verifyUser`, attaches `req.user` | `app.use('/api', requireUser)` |
| Generation service | Build prompt (with `prompt_version`, `config`), call Gemini, return `GeneratedContent` | Extract from current `server.ts` inline handler |
| Scoring service (LLM-judge) | Given a generation, call Gemini as judge, produce metric scores | New module; called inline after generation persists |
| Repository layer (`repo`) | All CRUD for profiles / generations / scores | Single `db` module using service-role client (or `pg`) |
| DB client (`src/server/db.ts`) | Own the Supabase URL + service-role key; the single connection point | `@supabase/supabase-js` service client, or `postgres`/`pg` + connection string |
| Postgres schema + RLS | Store data; enforce per-user isolation as defense-in-depth | SQL migrations; RLS policies keyed on `auth.uid()` / `user_id` |

## Recommended Project Structure

The repo is currently client-only under `src/` with `server.ts` at root. Introduce a `src/server/` tree so the growing backend has real module boundaries, and keep the two anti-lock-in seams as their own files.

```
affipro/
├── server.ts                    # thin entry: wire middleware + routers, start Express
├── src/
│   ├── server/                  # [NEW] all backend code (was inline in server.ts)
│   │   ├── auth/
│   │   │   ├── verifyUser.ts     # ★ SEAM 1: token → {userId,email,role} (jose+JWKS)
│   │   │   └── requireUser.ts    # Express middleware wrapping verifyUser
│   │   ├── db/
│   │   │   ├── client.ts         # ★ SEAM 2: owns Supabase URL + service-role key
│   │   │   └── repo/
│   │   │       ├── profiles.ts   # upsert profile on first login
│   │   │       ├── generations.ts# insert/list generations
│   │   │       └── scores.ts     # insert human + llm_judge scores
│   │   ├── services/
│   │   │   ├── generation.ts     # prompt build + Gemini call (from server.ts)
│   │   │   └── judge.ts          # LLM-as-judge scoring (inline)
│   │   ├── routes/
│   │   │   ├── generate.ts        # POST /api/generate  (generate→persist→judge)
│   │   │   ├── generations.ts     # GET  /api/generations (history)
│   │   │   └── scores.ts          # POST /api/scores (human vote), GET dashboard
│   │   └── config.ts             # env parsing (PORT, keys, SUPABASE_URL, JWKS_URL)
│   ├── lib/
│   │   ├── auth.ts               # [NEW] SPA-side supabase-js Auth wrapper (OAuth only)
│   │   └── utils.ts              # relocate cn() here (existing anti-pattern fix)
│   ├── store/useStore.ts         # extend: authed apiFetch, history, dashboard state
│   ├── components/               # + History, Dashboard, ScoreVote, LoginButton
│   └── types.ts                  # + Generation, Score, Profile, GenerationConfig
├── supabase/
│   └── migrations/*.sql          # [NEW] schema + RLS, runnable on Cloud & self-hosted
└── Dockerfile                    # [NEW] single app container
```

### Structure Rationale

- **`src/server/auth/verifyUser.ts` is a single file on purpose.** It is the entire "how does auth work" surface. When self-hosting, only its JWKS URL changes (an env var). When leaving Supabase, you rewrite *this one file* to verify your new provider's tokens — route handlers keep calling `req.user` unchanged.
- **`src/server/db/client.ts` is the only module importing the Supabase key.** Repos import `client`, never Supabase directly. Swap Cloud→self-hosted, or Supabase→plain Postgres, by editing this one module. This directly satisfies the "migrate off = change URL+key" principle in PROJECT.md.
- **`services/` vs `routes/` split** keeps Gemini/judge logic testable without HTTP, and lets the judge later move to a worker by importing the same `services/judge.ts` from a queue consumer.
- **`supabase/migrations/`** are plain SQL so they run identically on Cloud today and a self-hosted container later — no proprietary migration format.

## Architectural Patterns

### Pattern 1: Thin auth seam — verify the JWT in Express, never trust the client

**What:** The SPA authenticates with Supabase (Google OAuth) and receives a JWT. Every `/api` request carries it as a Bearer token. Express verifies it locally against Supabase's JWKS using `jose`. The SPA never calls Supabase's database/REST API.
**When to use:** Whenever you want provider independence + a server that owns all business rules (exactly this project).
**Trade-offs:** One extra verification hop per request (negligible — JWKS is cached in-process); you must handle token refresh on the client. In exchange, the backend is the single authorization authority and the DB provider is swappable.

**Example:**
```typescript
// src/server/auth/verifyUser.ts  — the whole "how auth works" surface
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL!));
// Cloud:      https://<ref>.supabase.co/auth/v1/jwks
// Self-host:  https://auth.mydomain.tld/auth/v1/jwks  ← only this env var changes

export async function verifyUser(token: string) {
  const { payload } = await jwtVerify(token, JWKS, {
    // issuer/audience checks pin the token to your project
  });
  return {
    userId: payload.sub as string,
    email: payload.email as string | undefined,
    role: (payload.app_metadata as any)?.role ?? 'member', // app_metadata, NOT user_metadata
  };
}
```
```typescript
// src/server/auth/requireUser.ts
export const requireUser = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try { req.user = await verifyUser(token); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
};
// server.ts:  app.use('/api', requireUser)
```

> Note (2026): Supabase now recommends **asymmetric signing keys** (ES256/RS256) verified via JWKS — prefer this over the legacy shared HS256 `JWT_SECRET`. JWKS is edge-cached ~10 min; on key rotation allow ~20 min overlap. `jose`'s remote JWKS set handles fetch + cache for you.

### Pattern 2: Express is the authorization gate; RLS is defense-in-depth

**What:** Because the SPA never touches the DB, Express holds the service-role connection (which *bypasses* RLS) and enforces ownership itself (`WHERE user_id = req.user.userId`). RLS policies keyed on `user_id` are still enabled as a safety net.
**When to use:** When the backend is the only DB client and you want provider portability (RLS is Postgres-standard, so it survives a move to plain Postgres).
**Trade-offs:** You must be disciplined — every repo query must scope by `req.user.userId`; a bug there is a data-leak, and the service role won't catch it. RLS as a backstop mitigates this. Storing `role` in `app_metadata` (server-controlled) not `user_metadata` (user-editable) is mandatory for any role-based check.

**Example:**
```typescript
// src/server/db/repo/generations.ts — every read is ownership-scoped in code
export const listGenerations = (userId: string) =>
  db.from('generations').select('*').eq('user_id', userId).order('created_at', { ascending: false });
```
```sql
-- Safety net (defense-in-depth). Also makes a future "SPA talks to Supabase directly"
-- pivot safe, and enforces isolation even if a repo query forgets its filter.
alter table generations enable row level security;
create policy own_generations on generations
  for all using (auth.uid() = user_id);
```

### Pattern 3: Inline LLM-judge with an extraction seam

**What:** After `/api/generate` persists the generation, it calls `services/judge.ts` *in the same request* to produce `llm_judge` scores, persists them, and returns everything. The judge is a plain function, not wired to HTTP or the DB — so it can later be invoked by a queue worker without change.
**When to use:** Low volume / internal team (this milestone). The key test from the research: *does a human need the result in real time?* Here they do (they see scores next to output), and volume is tiny — so inline is correct and a queue would be over-engineering now.
**Trade-offs:** Adds one Gemini round-trip to request latency (a second or two). Acceptable internally; becomes the reason to extract a worker when public/volume grows. The seam makes that extraction a routing change, not a rewrite.

**Example:**
```typescript
// routes/generate.ts — orchestration; note the judge call is trivially removable
const gen   = await generationService.run(req.body, req.user.userId); // Gemini
const saved = await repo.generations.insert(gen);                      // persist first
const scores = await judge.score(saved);          // ← inline today
await repo.scores.insertMany(saved.id, scores);   //   later: enqueue(saved.id) instead
return res.json({ generation: saved, scores });
```
> Extraction path (documented for later): swap the two `judge`+`insertMany` lines for `queue.enqueue(saved.id)`; a worker process imports the *same* `services/judge.ts` and `repo`. No schema change — `scores` already keyed by `generation_id`, so async writes just arrive later. Return the generation immediately; SPA polls `GET /api/generations/:id/scores`.

## Data Flow

### Request Flow — the core `auth → verify → Gemini → persist` path

```
[User submits form + is logged in]
        ↓  Zustand attaches Bearer <jwt>
POST /api/generate
        ↓
requireUser → verifyUser(token)         → req.user = { userId, role }
        ↓  (401 short-circuits here if invalid)
generationService.run(input, config)    → Gemini generateContent (JSON mode)
        ↓
repo.generations.insert({               → Supabase Postgres
   user_id, input, config(jsonb),
   prompt_version, output(jsonb) })
        ↓
judge.score(generation)                 → Gemini (as judge) → metric scores
        ↓
repo.scores.insertMany(gen_id, [        → Postgres (source='llm_judge')
   {metric, value}, ... ])
        ↓
res.json({ generation, scores })
        ↓
Zustand stores result → ResultDisplay + score badges render
```

Human vote is a separate, later flow: `POST /api/scores { generation_id, metric, value }` → `verifyUser` → `repo.scores.insert({ source: 'human', ... })`.

### State Management

```
supabase-js Auth  ──session/JWT──►  Zustand store  ──Bearer──►  /api/*
      ▲                                   │
      └── onAuthStateChange ──────────────┘  (store holds token + user;
                                              components read via useStore)
```
The store gains an `apiFetch(path, opts)` helper that injects the current token and centralizes 401 handling (redirect to login). Components never construct auth headers themselves.

### Key Data Flows

1. **Login:** `LoginButton` → `supabase.auth.signInWithOAuth({ provider: 'google' })` → redirect → session → store → first authed call to `/api/me` upserts a `profiles` row.
2. **Generate + judge:** the core path above — one request produces a persisted generation *and* its `llm_judge` scores.
3. **History:** `GET /api/generations` → `repo.listGenerations(userId)` → rendered list; each item links to stored `output` + scores.
4. **Dashboard:** `GET /api/scores/summary?group_by=prompt_version` → aggregate query grouping scores by `prompt_version`/`config` → comparison view for prompt optimization.

## Suggested Build Order

Dependencies dictate a strict-ish order; each step is shippable.

1. **Phase 0 (prereq, already flagged in PROJECT.md):** fix runnable bugs (valid Gemini model, `responseSchema`, JSON guard, UI null-guard). Auth/DB should sit on a working base.
2. **DB client seam + schema** (`db/client.ts` + `supabase/migrations`): create `profiles`, `generations`, `scores` tables with RLS. No app behavior yet — but everything downstream needs the repo layer and it's the lock-in seam, so build it deliberately first.
3. **Auth seam** (`verifyUser` + `requireUser` + SPA `auth.ts` + login UI + store `apiFetch`): gate `/api/generate`. Depends on nothing but establishes `req.user` that persistence needs.
4. **Persist generations** (extract `services/generation.ts`, `repo/generations.ts`, wire into `/api/generate`): now every generation is saved with `input`/`config`/`prompt_version`/`output`. Requires #2 (repo) and #3 (`userId`).
5. **Generation config UI** (video length, tone, priority channels → flows into `config` jsonb + prompt): requires #4 so config is persisted alongside output.
6. **History view** (`GET /api/generations` + UI): requires #4.
7. **Scoring — human votes** (`scores` table already exists; add `POST /api/scores` + vote UI): requires #4 (a generation to score).
8. **Scoring — inline LLM-judge** (`services/judge.ts` wired into `/api/generate`): requires #4; independent of #7 but shares the `scores` table.
9. **Dashboard** (aggregate by `prompt_version`/`config`): requires #7/#8 to have score data.
10. **Docker packaging** (single container, env-driven config): can proceed once #3/#4 exist; finalize last so all env vars are known.

**Critical ordering constraint:** the two seams (#2 DB client, #3 auth) must land before any feature that reads/writes data or calls `/api` under auth. Everything after #4 is largely parallelizable in pairs.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Internal team (now, <100 users) | Single container + Supabase Cloud, inline judge. No queue, no worker. This is the target — do not add infrastructure. |
| Public launch (1k–10k) | Add rate-limit + quota middleware on `/api` (already in PROJECT.md backlog); move judge to a **background worker + queue** (the extraction seam) so generation latency stays low; use Supavisor transaction-mode pooling (port 6543) for connection efficiency. |
| Larger (10k+) | Consider self-hosted Supabase (cost/control) using the documented migration; split judge worker to its own container; add caching for dashboard aggregates. |

### Scaling Priorities

1. **First bottleneck: request latency from the inline judge.** Extract `services/judge.ts` to a queue consumer (seam already in place); return generation immediately, deliver scores async.
2. **Second bottleneck: DB connections under concurrency.** Switch the `db/client.ts` connection string to Supavisor transaction pooler (6543); this is a one-line env change because the connection is isolated.

## Anti-Patterns

### Anti-Pattern 1: SPA calling Supabase DB/REST directly

**What people do:** Use `supabase-js` `.from('generations').select()` in React because it's convenient.
**Why it's wrong:** Re-couples the frontend to Supabase, defeating the anti-lock-in principle in PROJECT.md, scatters authorization logic into the client, and forces you to expose RLS-dependent access publicly.
**Do this instead:** SPA uses `supabase-js` for **Auth only**. All data goes through Express `/api/*`. Enforce this with a lint rule / code review: `supabase` import allowed only in `src/lib/auth.ts`.

### Anti-Pattern 2: Scattering the Supabase key/URL across the codebase

**What people do:** Instantiate `createClient(url, key)` in each route or repo file.
**Why it's wrong:** Every file becomes a migration blast-radius; moving to self-hosted or off Supabase touches N files.
**Do this instead:** One `db/client.ts` exports the configured client; everything imports that. Migration = edit one file + env vars (confirmed by research: self-hosting changes only host, keys, and JWKS URL).

### Anti-Pattern 3: Trusting `user_metadata` or client-sent role for authorization

**What people do:** Read `role` from the client body or from `user_metadata` in the JWT.
**Why it's wrong:** `user_metadata` is end-user editable — a member could grant themselves admin. (Explicitly warned against in Supabase docs.)
**Do this instead:** Store `role` in server-controlled `app_metadata`; read it inside `verifyUser`; never accept role from the request body.

### Anti-Pattern 4: Building the queue/worker now

**What people do:** Add Redis/BullMQ for the judge "to be ready."
**Why it's wrong:** Over-engineering for an internal tool; adds a service to the single-container topology PROJECT.md deliberately chose. The judge result is wanted in real time at this scale.
**Do this instead:** Inline judge behind `services/judge.ts` with the documented extraction seam. Add the queue only at the public-launch bottleneck.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth | SPA `supabase-js` OAuth → JWT; Express verifies via `jose` + JWKS | Use asymmetric signing keys (2026 default); JWKS URL is the only auth coupling point |
| Supabase Postgres | Single `db/client.ts` w/ service-role key (bypasses RLS) | RLS enabled as safety net; connection string swappable Cloud↔self-hosted |
| Google Gemini | `@google/genai` server-side, two call sites: generation + judge | Key stays server-side (unchanged from today); judge reuses same client |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| SPA ↔ Express | HTTP `/api/*` + Bearer JWT | The only channel; no direct DB from SPA |
| routes ↔ services | Direct function calls | Services are HTTP-agnostic → unit-testable, worker-extractable |
| services/repo ↔ Supabase | Only via `db/client.ts` | The DB lock-in seam |
| auth middleware ↔ Supabase | Only via `verifyUser.ts` (JWKS) | The auth lock-in seam |
| judge (now) ↔ judge (later worker) | Same `services/judge.ts`, different caller | Inline call today; `queue.enqueue` later — no logic change |

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Existing architecture / seam placement | HIGH | Read `server.ts`/`useStore.ts` structure directly from codebase map |
| JWT verify via jose + JWKS (asymmetric) | MEDIUM-HIGH | Confirmed against official Supabase docs (signing-keys, jwts guides) |
| RLS as defense-in-depth + app_metadata rule | MEDIUM-HIGH | Confirmed against Supabase secure-data / RLS docs |
| Self-host migration = env-var swap | MEDIUM | Confirmed general path (CLI dump, Supavisor ports); exact self-host auth-key setup should be re-verified at migration time |
| Inline-vs-worker judge tradeoff | MEDIUM | General LLM-as-judge guidance; decision already aligned with PROJECT.md |

## Sources

- [Introducing JWT Signing Keys — Supabase](https://supabase.com/blog/jwt-signing-keys)
- [JWT Signing Keys | Supabase Docs](https://supabase.com/docs/guides/auth/signing-keys)
- [JSON Web Token (JWT) | Supabase Docs](https://supabase.com/docs/guides/auth/jwts)
- [New API Keys and Asymmetric Authentication (self-hosting) | Supabase Docs](https://supabase.com/docs/guides/self-hosting/self-hosted-auth-keys)
- [Securing your data | Supabase Docs](https://supabase.com/docs/guides/database/secure-data)
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [RLS Performance and Best Practices | Supabase Docs](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Self-Hosting with Docker | Supabase Docs](https://supabase.com/docs/guides/self-hosting/docker)
- [Migrate from Supabase Cloud to Self-Hosted — Meetrix](https://meetrix.io/blogs/migrate-supabase-cloud-to-self-hosted/)
- [Connection Pooling for Self-Hosted Supabase — Supascale](https://www.supascale.app/blog/connection-pooling-for-selfhosted-supabase-a-complete-guide)
- [LLM as Judge: The Agent Safety Pattern — MindStudio](https://www.mindstudio.ai/blog/llm-as-judge-agent-safety-pattern)

---
*Architecture research for: Supabase auth/persistence + inline LLM-judge on an Express + Vite React monolith*
*Researched: 2026-08-17*
