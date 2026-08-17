---
phase: 00
slug: fix-to-run-ci-net
status: secured
# threats_open = count of OPEN threats at or above workflow.security_block_on (high) severity
threats_open: 0
asvs_level: 1
created: 2026-08-17
---

# Phase 00 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Verified at ASVS L1 (grep-depth) via the secure-phase short-circuit — the STRIDE
> register was authored at plan time and all threats classify CLOSED, so no separate
> auditor pass was required. Evidence was gathered directly from the implementation.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client → Express `/api/generate` | Untrusted `productInfo` / `affiliateLink` cross into the server and are interpolated into the LLM prompt | User-supplied strings (untrusted) |
| Gemini model → Express | Model output is untrusted data — must be schema-validated before it is returned to the client | LLM JSON (untrusted) |
| process env → server boot | Missing/invalid config must fail fast at boot, not surface as a runtime 500 mid-request | `GEMINI_API_KEY` (secret), `PORT`, `NODE_ENV` |
| server JSON → React render | Client renders the server payload; a missing/renamed field must not crash the render (defense in depth) | Validated 4-channel content |
| source repo → CI | CI is the enforcement boundary blocking a regressed model id / unguarded parse before merge | Source diff |
| repo docs/metadata → onboarding | Template metadata must not misrepresent the app or point at a nonexistent env file | Docs / config templates |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-00-01 | Tampering | Malformed/renamed-key model output returned to client | high | mitigate | `responseSchema` (`server.ts:18,166`) + `GeneratedContentSchema.safeParse` double-guard before `res.json` (`server.ts:199`); invalid shape → non-2xx | closed |
| T-00-02 | Tampering | Oversized / prompt-injection input inflating cost or steering output | medium | mitigate | `express.json({ limit: "32kb" })` caps body (`server.ts:309`) | closed |
| T-00-03 | DoS | Cost-drain via unthrottled paid Gemini calls on `/api/generate` | medium | accept | Rate limiting deferred to public-ready phase (PUB-01/PUB-02); documented-accepted (below `high` threshold) | closed |
| T-00-04 | Info Disclosure | `GEMINI_API_KEY` leaking to the client bundle | high | mitigate | Key read from `process.env` server-side only (`server.ts:217`); **zero references to the key anywhere in `src/`** (client-clean); not needed in CI | closed |
| T-00-05 | DoS / Tampering | Malformed/truncated model output crashing the server (unguarded parse / undefined text) | high | mitigate | `finishReason` read before `.text` (`server.ts:170`), guarded `JSON.parse`, Zod safeParse, single bounded retry | closed |
| T-00-06 | Info Disclosure | Leaking `error.message` / stack / raw JSON to the client | high | mitigate | Internal reason → generic Vietnamese message (`vietnameseErrorFor`); detail logged server-side via `console.error` only; response body is `{ error: <VN string> }` (confirmed leak-free in code review, `assertNoLeak` test) | closed |
| T-00-07 | DoS | Retry loop amplifying paid calls | medium | mitigate | Retry bounded to exactly one, only for transient reasons; deterministic content blocks never retried. **Reinforced post-review (WR-01/02, `98d9127`):** `DETERMINISTIC_BLOCK_FINISH` now covers `SAFETY`/`RECITATION`/`BLOCKLIST`/`PROHIBITED_CONTENT`/`SPII`/`IMAGE_SAFETY` | closed |
| T-00-08 | Misconfiguration | Server booting with missing/blank `GEMINI_API_KEY` and failing per-request | high | mitigate | `loadEnv()` fail-fast `process.exit(1)` at boot (`server/config.ts:43`). **Reinforced (WR-03, `f52b295`):** `PORT` now validated (`.int().min(1).max(65535)`) so a non-numeric port fails boot instead of binding a random port | closed |
| T-00-09 | DoS (client availability) | Missing-field payload throwing during render → white screen | high | mitigate | Null-guard every `.map`/`.join` in `ResultDisplay` + class `ErrorBoundary` fallback wrapping the results branch | closed |
| T-00-10 | Info Disclosure | ErrorBoundary fallback leaking a raw error/stack to the user | low | mitigate | Fallback renders a fixed Vietnamese message only; caught error is `console.error`-logged, never rendered | closed |
| T-00-11 | Tampering | A future edit reintroduces a bad/unknown/shut-down model id | high | mitigate | Static allowlist check in CI asserts `MODEL_ID ∈ ALLOWLIST` on every push/PR (`scripts/check-model-allowlist.mjs`, `.github/workflows/ci.yml:35`) — no quota spent. **Reinforced (CR-01, `4512c92`):** fabricated `gemini-3.x` ids removed so the guardrail no longer sanctions a nonexistent id | closed |
| T-00-12 | Tampering | An unguarded-parse / crash regression slips into `server.ts` | high | mitigate | Full Vitest suite (happy + malformed + safety + config + render) runs in CI on every push/PR (`ci.yml:32`) | closed |
| T-00-13 | Info Disclosure | Adding a `GEMINI_API_KEY` secret to CI (unnecessary leak surface) | medium | mitigate | Workflow carries NO Gemini secret; tests mock the SDK, allowlist check is static (no network) | closed |
| T-00-14 | Info Disclosure | Stale template metadata / README pointing at a nonexistent env file misleads onboarding | low | mitigate | Template metadata replaced with real Affipro identity; `.env.local.example` documents the real key | closed |
| T-00-SC | Tampering (supply chain) | Malicious/typosquatted deps or action drift | high | mitigate | Plan-time package legitimacy audit (zod/vitest/supertest/testing-library/jsdom — established, no postinstall); CI uses `bun install --frozen-lockfile` (`ci.yml:26`) + tagged action versions | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Only open threats at or above `high` count toward `threats_open`.*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-00-01 | T-00-03 | Cost-drain via unthrottled paid Gemini calls. Rate limiting + per-user quota is explicitly deferred to the public-ready phase (PUB-01/PUB-02) per CONTEXT §deferred; Phase 0 is internal-team only. Severity medium (below the `high` block threshold). | team (via plan disposition) | 2026-08-17 |
| AR-00-02 | (infra) | Server binds `0.0.0.0`. Acceptable for internal/dev; to be revisited alongside rate limiting in the public-ready phase per RESEARCH §Security Domain. | team (via plan disposition) | 2026-08-17 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-17 | 14 | 14 | 0 | gsd secure-phase (ASVS L1 short-circuit; evidence from implementation + code-review remediation) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
